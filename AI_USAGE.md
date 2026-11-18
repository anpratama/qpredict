# AI usage

QPredict was built with substantial AI assistance (an AI agent, "Lux",
powered by Meta's Muse), directed and reviewed by the human builder,
Krisna Aji.

What the AI did:
- Game design: the sealed-prediction protocol (commitment scheme, outcome
  derivation, anti-burial forfeit rule) was drafted with the AI.
- Debugging against the live chain: two earlier designs that derived the
  outcome from the BLOCKHASH opcode failed on Diana testnet (the opcode
  returns 0 for past blocks there); the AI diagnosed this from on-chain
  reverts and redesigned the outcome derivation around landing-block
  context, which then settled successfully end-to-end.
- Code: `QPredict.sol`, the deployment and end-to-end scripts, and the
  zero-build web app were written with the AI and tested against the Diana
  testnet (seal, wrong-salt rejection, reveal, win and loss all observed
  on-chain).
- Documentation: this file and the README were drafted with the AI and
  checked against the deployed behaviour.

What the human did:
- Chose the concept and category, made every account and wallet step
  (hackathon registration, QoreX connection, repository creation), and
  reviewed and approved each submission field.

No AI-generated claim in this repository is unverified: every on-chain
statement links to a transaction on the Diana testnet.
