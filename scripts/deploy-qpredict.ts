/**
 * deploy-qpredict.ts - deploy the QPredict contract to the QoreChain EVM
 * (Diana testnet) through @qorechain/evm, inside a live PQC window.
 * Requires the window to be open (see the hardhat dev workspace window helper).
 */
import { createEvmClient, deployContract, evmAccountFromPrivateKey } from "@qorechain/evm";
import type { Hex } from "viem";
import { writeFileSync } from "node:fs";
import { qpredictAbi, qpredictBytecode } from "../contracts/QPredict.artifact.js";

async function main(): Promise<void> {
  const evmRpc = process.env.QORE_EVM_RPC_URL ?? "https://evm-testnet.qore.host";
  const privateKey = process.env.QORE_EVM_PRIVATE_KEY as Hex;
  if (!privateKey) throw new Error("Missing QORE_EVM_PRIVATE_KEY");

  const client = await createEvmClient({ endpoints: { evmRpc } });
  const account = evmAccountFromPrivateKey(privateKey);
  const wallet = client.getWalletClient(account);

  console.log(`network:  QoreChain EVM (chain id ${await client.getChainId()})`);
  console.log(`deployer: ${account.address}`);

  const hash = await deployContract(wallet, { abi: qpredictAbi, bytecode: qpredictBytecode });
  const receipt = await client.publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("No contract address in receipt");
  console.log(`QPredict deployed: ${receipt.contractAddress}`);
  console.log(`tx: ${hash}  block: ${receipt.blockNumber}`);

  writeFileSync(
    "qpredict-deployment.json",
    JSON.stringify(
      {
        contract: receipt.contractAddress,
        deployTx: hash,
        block: receipt.blockNumber.toString(),
        chainId: 9800,
        deployer: account.address,
        network: "qorechain-diana (testnet)",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("wrote qpredict-deployment.json");
}

main().catch((err: unknown) => {
  console.error("Deploy failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
