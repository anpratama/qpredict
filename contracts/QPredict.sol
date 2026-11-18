// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title QPredict — sealed predictions on QoreChain.
/// @notice Predict the parity (even/odd) of a value derived from the block
/// your prediction lands in. You commit only a hash of your guess. At commit
/// time the contract mixes your commitment with the landing block's number,
/// timestamp and proposer — none of which you can know exactly when you sign
/// — and fixes the outcome. Afterwards you reveal the guess; the contract
/// checks it against the commitment and records the result permanently.
/// Predictions left unrevealed past the reveal window can be forfeited by
/// anyone and count as losses, so a sealed prediction can never be buried.
///
/// Why not blockhash? On Diana's EVM lane the BLOCKHASH opcode returns 0 for
/// past blocks (verified on-chain 2026-11-18 against blocks that carried our
/// own transactions), so blockhash-based outcomes cannot settle here. The
/// landing-block context is the chain-native substitute.
contract QPredict {
    struct Prediction {
        address player;
        bytes32 commitment;
        uint64 commitBlock;
        uint8 outcome; // fixed at commit: 0 = even, 1 = odd
        bool revealed;
        bool forfeited;
        bool won;
    }

    uint256 public constant REVEAL_WINDOW = 200;

    Prediction[] public predictions;
    mapping(address => uint256) public wins;
    mapping(address => uint256) public losses;

    event PredictionCommitted(uint256 indexed id, address indexed player, uint64 commitBlock);
    event PredictionRevealed(uint256 indexed id, address indexed player, uint8 outcome, bool won);
    event PredictionForfeited(uint256 indexed id, address indexed player);

    error AlreadyRevealed();
    error AlreadyForfeited();
    error CommitmentMismatch();
    error NotExpired(uint64 commitBlock, uint256 currentBlock);
    error BadGuess(uint8 guess);

    /// @notice Seal a prediction. `commitment` = keccak256(abi.encodePacked(player, guess, salt)),
    /// where guess is 0 (even) or 1 (odd).
    function commitPrediction(bytes32 commitment) external returns (uint256 id) {
        uint8 outcome = uint8(
            uint256(keccak256(abi.encodePacked(commitment, block.number, block.timestamp, block.coinbase, msg.sender))) & 1
        );
        id = predictions.length;
        predictions.push(
            Prediction({
                player: msg.sender,
                commitment: commitment,
                commitBlock: uint64(block.number),
                outcome: outcome,
                revealed: false,
                forfeited: false,
                won: false
            })
        );
        emit PredictionCommitted(id, msg.sender, uint64(block.number));
    }

    /// @notice Reveal a sealed prediction and settle it against the outcome
    /// that was fixed when it landed on-chain.
    function revealPrediction(uint256 id, uint8 guess, bytes32 salt) external {
        if (guess > 1) revert BadGuess(guess);
        Prediction storage p = predictions[id];
        if (p.revealed) revert AlreadyRevealed();
        if (p.forfeited) revert AlreadyForfeited();
        if (keccak256(abi.encodePacked(msg.sender, guess, salt)) != p.commitment) revert CommitmentMismatch();
        p.revealed = true;
        p.won = p.outcome == guess;
        if (p.won) {
            wins[msg.sender] += 1;
        } else {
            losses[msg.sender] += 1;
        }
        emit PredictionRevealed(id, msg.sender, p.outcome, p.won);
    }

    /// @notice Mark an unrevealed prediction as lost once its reveal window
    /// has passed. Anyone may call this; the player it belongs to takes the loss.
    function forfeitPrediction(uint256 id) external {
        Prediction storage p = predictions[id];
        if (p.revealed) revert AlreadyRevealed();
        if (p.forfeited) revert AlreadyForfeited();
        if (block.number <= uint256(p.commitBlock) + REVEAL_WINDOW) revert NotExpired(p.commitBlock, block.number);
        p.forfeited = true;
        losses[p.player] += 1;
        emit PredictionForfeited(id, p.player);
    }

    function predictionCount() external view returns (uint256) {
        return predictions.length;
    }

    function getPrediction(uint256 id) external view returns (Prediction memory) {
        return predictions[id];
    }
}
