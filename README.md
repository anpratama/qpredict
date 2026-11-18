# QPredict — sealed predictions on QoreChain

**Seal a prediction nobody can peek at — not even you. The chain settles it.**

QPredict is a mini-game for the **Quantum Pass** level of *Build Before Q-Day:
The QoreChain Developer Fest*. Live on the Diana testnet (chain ID 9800).

## The game

1. **Pick** EVEN or ODD in your browser.
2. **Seal it**: your guess is hashed with a random salt
   (`keccak256(player, guess, salt)`) and only the hash is sent on-chain.
   Nobody can read the guess from the hash — and you cannot change it.
3. **The chain fixes the outcome**: at commit time the `QPredict` contract
   mixes your commitment with the block your prediction lands in — its
   number, timestamp and proposer, none of which you can know exactly when
   you sign — and stores the resulting parity as the outcome.
4. **Reveal**: open your guess; the contract checks it against the seal and
   records win or loss permanently, with a public W/L record per player.
5. **No burying**: a prediction left unrevealed for more than 200 blocks can
   be *forfeited by anyone* and counts as a loss. Sealed means sealed.

## Why not blockhash?

The textbook design derives the outcome from a target block's hash. On
Diana's EVM lane the `BLOCKHASH` opcode returns `0` for past blocks — verified
on-chain on 2026-11-18 against blocks that carried our own transactions
(two deployed designs failed exactly this way before this one). The
landing-block context (number + timestamp + proposer, mixed with the
player's own commitment) is the chain-native substitute that actually
settles on QoreChain.

## On-chain proof (Diana testnet)

- Contract: `0x7f2006234a9f235abea91fd143af0d795b1cdbe8`
  (deploy tx `0x0e5971dbafe39c1bd276109cc5e93e018e20e8bf7538c5897a1c13bc67d87c4c`,
  block 10319872)
- Full lifecycle proven by `scripts/e2e-onchain.ts`: a prediction was sealed
  (tx `0x267d2d1f…eae9`), a reveal with the wrong salt was rejected by the
  contract (`CommitmentMismatch`), the true reveal settled
  (tx `0xa8ff12dc…7100`), and a second prediction won
  (commit `0xbe9b8c2c…42f5`, reveal `0x12c4f28c…8f41e`).
- Deployment used QoreChain's native flow: a registered ML-DSA-87 key and a
  live EVM authorisation window, opened with hybrid-signed transactions —
  see `qpredict-deployment.json`.

## Run it

- Web app: open `web/index.html` (any static server) with QoreX or MetaMask
  on the Diana testnet. Pick, seal, reveal.
- Contracts: `contracts/QPredict.sol` (solc 0.8.28). Deploy with
  `npm run deploy:qpredict` inside a live EVM window; re-run the proof with
  `npm run e2e`.

## Honest limits

- The outcome is fixed at commit time from landing-block context. A player
  who reads raw contract storage could peek at their own outcome before
  revealing — the forfeit rule is what keeps that from paying: unrevealed
  predictions become losses. This is a testnet game for leaderboard honour;
  no real value is staked or paid out.
- Testnet only. Diana resets periodically; if the contract is gone,
  redeploy with the command above and update the address in `web/app.js`.

Built with create-qorechain-dapp, `@qorechain/evm` and viem. MIT licence.
AI assistance is documented in `AI_USAGE.md`.
