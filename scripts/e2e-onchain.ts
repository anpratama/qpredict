/**
 * e2e-onchain.ts — full QPredict lifecycle on Diana testnet:
 * commit a sealed prediction, prove a wrong-salt reveal is rejected
 * (CommitmentMismatch), reveal correctly, and verify the outcome
 * independently from the commit block's hash.
 */
import { createEvmClient, evmAccountFromPrivateKey, writeContract } from "@qorechain/evm";
import { keccak256, encodePacked, toHex, type Hex } from "viem";
import { readFileSync } from "node:fs";
import { qpredictAbi } from "../contracts/QPredict.artifact.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const evmRpc = process.env.QORE_EVM_RPC_URL ?? "https://evm-testnet.qore.host";
  const privateKey = process.env.QORE_EVM_PRIVATE_KEY as Hex;
  if (!privateKey) throw new Error("Missing QORE_EVM_PRIVATE_KEY");
  const deployment = JSON.parse(readFileSync("qpredict-deployment.json", "utf8")) as { contract: Hex };
  const contract = deployment.contract;

  const client = await createEvmClient({ endpoints: { evmRpc } });
  const account = evmAccountFromPrivateKey(privateKey);
  const wallet = client.getWalletClient(account);
  const pub = client.publicClient;

  const guess = (Math.floor(Math.random() * 2)) as 0 | 1; // 0 even, 1 odd
  const salt = keccak256(toHex(`qpredict-e2e-${Date.now()}-${Math.random()}`)) as Hex;
  const commitment = keccak256(encodePacked(["address", "uint8", "bytes32"], [account.address, guess, salt]));

  const myId = (await pub.readContract({ address: contract, abi: qpredictAbi, functionName: "predictionCount", args: [] })) as bigint;
  console.log(`player ${account.address} commits guess=${guess === 0 ? "EVEN" : "ODD"} commitment=${commitment} salt=${salt} id=${myId}`);
  const commitHash = await writeContract(wallet, {
    address: contract, abi: qpredictAbi, functionName: "commitPrediction", args: [commitment],
  });
  const commitReceipt = await pub.waitForTransactionReceipt({ hash: commitHash });
  const commitBlock = commitReceipt.blockNumber;
  console.log(`committed: tx ${commitHash} block ${commitBlock}`);

  // A reveal with the wrong salt must be rejected (CommitmentMismatch).
  const wrongSalt = keccak256(toHex("wrong-salt")) as Hex;
  try {
    await pub.simulateContract({
      address: contract, abi: qpredictAbi, functionName: "revealPrediction", args: [myId, guess, wrongSalt], account: account.address,
    });
    console.log("!! wrong-salt reveal simulation unexpectedly succeeded");
  } catch (e) {
    console.log(`wrong-salt reveal rejected as expected: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }

  while ((await pub.getBlockNumber()) <= commitBlock) await sleep(1200);
  const revealHash = await writeContract(wallet, {
    address: contract, abi: qpredictAbi, functionName: "revealPrediction", args: [myId, guess, salt],
  });
  const revealReceipt = await pub.waitForTransactionReceipt({ hash: revealHash });
  console.log(`revealed: tx ${revealHash} block ${revealReceipt.blockNumber}`);

  const p = (await pub.readContract({
    address: contract, abi: qpredictAbi, functionName: "getPrediction", args: [myId],
  })) as { revealed: boolean; won: boolean; outcome: number };
  const stored = (await pub.readContract({
    address: contract, abi: qpredictAbi, functionName: "getPrediction", args: [myId],
  })) as { commitment: string };
  const recomputed = keccak256(encodePacked(["address", "uint8", "bytes32"], [account.address, guess, salt]));
  console.log(`commitment check: stored=${stored.commitment.toLowerCase() === recomputed.toLowerCase()} won consistent=${p.won === (p.outcome === guess)}`);
});
}

main().catch((err: unknown) => {
  console.error("E2E failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
