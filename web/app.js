// QPredict web app — zero-build, talks to the QPredict contract on Diana
// testnet (chain 9800) through the user's wallet (window.ethereum).
import { createPublicClient, createWalletClient, custom, http, keccak256, encodePacked, toHex } from "https://esm.sh/viem@2.57.19";

const CONTRACT = "0x7f2006234a9f235abea91fd143af0d795b1cdbe8";
const RPC = "https://evm-testnet.qore.host";
const ABI = [
  { type: "function", name: "commitPrediction", stateMutability: "nonpayable", inputs: [{ name: "commitment", type: "bytes32" }], outputs: [{ name: "id", type: "uint256" }] },
  { type: "function", name: "revealPrediction", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "guess", type: "uint8" }, { name: "salt", type: "bytes32" }], outputs: [] },
  { type: "function", name: "predictionCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getPrediction", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "player", type: "address" }, { name: "commitment", type: "bytes32" }, { name: "commitBlock", type: "uint64" },
    { name: "outcome", type: "uint8" }, { name: "revealed", type: "bool" }, { name: "forfeited", type: "bool" }, { name: "won", type: "bool" }] }] },
  { type: "function", name: "wins", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "losses", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
];

const $ = (id) => document.getElementById(id);
const pub = createPublicClient({ transport: http(RPC) });
let account = null;
let wallet = null;
let guess = null;

const store = {
  all() { try { return JSON.parse(localStorage.getItem("qpredict-mine") || "[]"); } catch { return []; } },
  add(e) { const a = this.all(); a.push(e); localStorage.setItem("qpredict-mine", JSON.stringify(a)); },
};

function log(msg) { $("log").textContent = msg; }

async function refresh() {
  if (!account) return;
  const [w, l, total] = await Promise.all([
    pub.readContract({ address: CONTRACT, abi: ABI, functionName: "wins", args: [account] }),
    pub.readContract({ address: CONTRACT, abi: ABI, functionName: "losses", args: [account] }),
    pub.readContract({ address: CONTRACT, abi: ABI, functionName: "predictionCount", args: [] }),
  ]);
  $("wins").textContent = String(w);
  $("losses").textContent = String(l);
  $("total").textContent = String(total);
  const mine = $("mine");
  mine.innerHTML = "";
  for (const e of store.all().filter((x) => x.player.toLowerCase() === account.toLowerCase())) {
    const p = await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "getPrediction", args: [BigInt(e.id)] });
    const row = document.createElement("div");
    row.className = "row";
    row.style.margin = "8px 0";
    const label = document.createElement("span");
    label.className = "mono";
    if (p.revealed) {
      label.innerHTML = `#${e.id} — you said ${e.guess === 0 ? "EVEN" : "ODD"}, chain said ${p.outcome === 0 ? "EVEN" : "ODD"} → `;
      const s = document.createElement("span");
      s.className = p.won ? "win" : "lose";
      s.textContent = p.won ? "WON" : "LOST";
      label.appendChild(s);
      row.appendChild(label);
    } else if (p.forfeited) {
      label.textContent = `#${e.id} — forfeited (never revealed)`;
      row.appendChild(label);
    } else {
      label.textContent = `#${e.id} — sealed (${e.guess === 0 ? "EVEN" : "ODD"}), block ${p.commitBlock}`;
      const btn = document.createElement("button");
      btn.textContent = "Reveal";
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const hash = await wallet.writeContract({ address: CONTRACT, abi: ABI, functionName: "revealPrediction", args: [BigInt(e.id), e.guess, e.salt], account });
          log(`reveal sent: ${hash}`);
          await pub.waitForTransactionReceipt({ hash });
          log(`revealed #${e.id}: ${hash}`);
          await refresh();
        } catch (err) { log(`reveal failed: ${err.message || err}`); btn.disabled = false; }
      };
      row.appendChild(label);
      row.appendChild(btn);
    }
    mine.appendChild(row);
  }
  if (!mine.children.length) mine.innerHTML = '<p style="color:var(--dim)">None yet — seal your first prediction above.</p>';
}

$("connect").onclick = async () => {
  if (!window.ethereum) { log("No wallet found — open this page inside QoreX or a browser with MetaMask."); return; }
  const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2648" }] });
  } catch { /* wallet may already be on Diana or handle the switch itself */ }
  account = addr;
  wallet = createWalletClient({ transport: custom(window.ethereum) });
  $("account").textContent = addr;
  $("commit").disabled = guess === null;
  await refresh();
};

for (const [btn, val] of [["pickEven", 0], ["pickOdd", 1]]) {
  $(btn).onclick = () => {
    guess = val;
    $("pickEven").classList.toggle("sel", val === 0);
    $("pickOdd").classList.toggle("sel", val === 1);
    $("commit").disabled = !account;
  };
}

$("commit").onclick = async () => {
  if (!account || guess === null) return;
  $("commit").disabled = true;
  try {
    const saltBytes = new Uint8Array(32);
    crypto.getRandomValues(saltBytes);
    const salt = toHex(saltBytes);
    const commitment = keccak256(encodePacked(["address", "uint8", "bytes32"], [account, guess, salt]));
    const hash = await wallet.writeContract({ address: CONTRACT, abi: ABI, functionName: "commitPrediction", args: [commitment], account });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    // The new prediction id is the count before this tx; recover it from the log position:
    const total = await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "predictionCount", args: [] });
    const id = Number(total) - 1;
    store.add({ id, guess, salt, player: account });
    $("commitInfo").textContent = `sealed #${id} in block ${receipt.blockNumber}`;
    log(`committed: ${hash}`);
    await refresh();
  } catch (err) {
    log(`commit failed: ${err.message || err}`);
  }
  $("commit").disabled = false;
};
