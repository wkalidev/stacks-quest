// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title QuestGame
 * @notice Daily blockchain puzzle game — mirrors stacks-quest-v2.clar on Base / Celo.
 *
 * Mechanic:
 *   - Owner posts a daily puzzle (answer + tolerance %) and seeds reward pools.
 *   - Players submit a numeric guess + bet in native token or supported ERC-20.
 *   - Guesses within tolerance % of the answer are winners.
 *   - Winners split their token's reward pool proportionally to their bet.
 *   - Owner calls revealAnswer() to open claims after the day closes.
 *
 * Token IDs  (same enum as Clarity contract):
 *   0 = native (ETH on Base, CELO on Celo)
 *   1 = first supported ERC-20  (USDC on Base, cUSD on Celo)
 *   2 = second supported ERC-20 (USDT on Base, unused on Celo — set to address(0))
 */
contract QuestGame is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ────────────────────────────────────────────────────────────
    error AlreadyPlayed();
    error GameClosed();
    error InvalidGuess();
    error NoGameToday();
    error AlreadyClaimed();
    error NotWinner();
    error InvalidBet();
    error InvalidToken();
    error NativeTransferFailed();

    // ── Constants ─────────────────────────────────────────────────────────
    uint8  public constant TOKEN_NATIVE = 0;
    uint8  public constant TOKEN_ERC20_1 = 1;
    uint8  public constant TOKEN_ERC20_2 = 2;

    uint256 public constant SECONDS_PER_DAY = 86400;

    // Bet limits for native token (18 decimals): 0.001 – 1.0
    uint256 public constant MIN_BET_NATIVE = 0.001 ether;
    uint256 public constant MAX_BET_NATIVE = 1 ether;

    // Bet limits for ERC-20 (6 decimals assumed for USDC/cUSD): 1 – 100
    uint256 public constant MIN_BET_ERC20  = 1e6;
    uint256 public constant MAX_BET_ERC20  = 100e6;

    // ── Token config (set at deploy, immutable) ───────────────────────────
    address public immutable token1; // e.g. USDC on Base, cUSD on Celo
    address public immutable token2; // e.g. USDT on Base, address(0) if unused

    // ── Puzzle storage ────────────────────────────────────────────────────
    struct Puzzle {
        string  puzzleType;
        uint256 answer;
        uint256 tolerance;   // percent, e.g. 5 = 5%
        // native pools
        uint256 poolNative;
        uint256 betsNative;
        uint256 winnersNative;
        // ERC-20 #1 pools
        uint256 pool1;
        uint256 bets1;
        uint256 winners1;
        // ERC-20 #2 pools
        uint256 pool2;
        uint256 bets2;
        uint256 winners2;
        bool    revealed;
        uint256 startTime;
        uint256 endTime;
    }

    // dayId => Puzzle
    mapping(uint256 => Puzzle) public puzzles;

    // ── Attempt storage ───────────────────────────────────────────────────
    struct Attempt {
        uint256 guess;
        uint256 bet;
        uint8   token;
        bool    won;
        bool    claimed;
        uint256 timestamp;
    }

    // dayId => player => Attempt
    mapping(uint256 => mapping(address => Attempt)) public attempts;

    // ── Player stats ──────────────────────────────────────────────────────
    struct PlayerStats {
        uint256 totalPlayed;
        uint256 totalWon;
        uint256 bestStreak;
        uint256 currentStreak;
        uint256 lastPlayedDay;
    }

    mapping(address => PlayerStats) public playerStats;

    uint256 public totalGamesPlayed;

    // ── Events ────────────────────────────────────────────────────────────
    event PuzzleCreated(uint256 indexed dayId, string puzzleType, uint256 tolerance);
    event GuessMade(uint256 indexed dayId, address indexed player, uint256 guess, uint8 token, bool won);
    event RewardClaimed(uint256 indexed dayId, address indexed player, uint256 payout, uint8 token);
    event AnswerRevealed(uint256 indexed dayId, uint256 answer);

    // ── Constructor ───────────────────────────────────────────────────────
    constructor(address _token1, address _token2) Ownable(msg.sender) {
        token1 = _token1;
        token2 = _token2;
    }

    // ── Views ─────────────────────────────────────────────────────────────
    function currentDayId() public view returns (uint256) {
        return block.timestamp / SECONDS_PER_DAY;
    }

    function hasPlayedToday(address player) public view returns (bool) {
        return attempts[currentDayId()][player].timestamp > 0;
    }

    function getTodayPuzzle() external view returns (Puzzle memory) {
        return puzzles[currentDayId()];
    }

    function getAttempt(uint256 dayId, address player) external view returns (Attempt memory) {
        return attempts[dayId][player];
    }

    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function isCorrectGuess(uint256 guess, uint256 answer, uint256 tolerancePct) public pure returns (bool) {
        uint256 diff    = guess >= answer ? guess - answer : answer - guess;
        uint256 maxDiff = (answer * tolerancePct) / 100;
        return diff <= maxDiff;
    }

    // ── Owner: create puzzle ──────────────────────────────────────────────
    /**
     * @notice Post today's puzzle and seed the reward pools.
     * @param puzzleType  Short label, e.g. "block-height".
     * @param answer      Correct numeric answer (hidden off-chain until revealAnswer).
     * @param tolerance   Acceptable error in percent (e.g. 5 = within ±5%).
     * @param seedNative  Native token pool seed (sent as msg.value).
     * @param seed1       ERC-20 #1 pool seed (owner must have approved this contract).
     * @param seed2       ERC-20 #2 pool seed (0 if token2 unused).
     */
    // SECURITY NOTE (see SECURITY.md "Known Game-Design Limitation"): `puzzles` is a PUBLIC
    // mapping, so `answer` is readable via the auto-generated `puzzles(dayId)` getter as soon
    // as this function returns — long before `revealAnswer()`. Any player can read it on-chain
    // and guess with certainty. This cannot be patched on an already-deployed (non-upgradeable)
    // contract; a v3 with a commit-reveal scheme is needed. Do not seed large reward pools
    // until that ships.
    function createPuzzle(
        string calldata puzzleType,
        uint256 answer,
        uint256 tolerance,
        uint256 seedNative,
        uint256 seed1,
        uint256 seed2
    ) external payable onlyOwner {
        uint256 dayId = currentDayId();
        require(puzzles[dayId].startTime == 0, "Puzzle already exists");
        require(msg.value == seedNative, "msg.value mismatch");

        if (seed1 > 0) IERC20(token1).safeTransferFrom(msg.sender, address(this), seed1);
        if (seed2 > 0 && token2 != address(0)) IERC20(token2).safeTransferFrom(msg.sender, address(this), seed2);

        puzzles[dayId] = Puzzle({
            puzzleType:    puzzleType,
            answer:        answer,
            tolerance:     tolerance,
            poolNative:    seedNative,
            betsNative:    0,
            winnersNative: 0,
            pool1:         seed1,
            bets1:         0,
            winners1:      0,
            pool2:         seed2,
            bets2:         0,
            winners2:      0,
            revealed:      false,
            startTime:     block.timestamp,
            endTime:       block.timestamp + SECONDS_PER_DAY
        });

        emit PuzzleCreated(dayId, puzzleType, tolerance);
    }

    // ── Owner: reveal answer (opens claims) ───────────────────────────────
    function revealAnswer(uint256 dayId) external onlyOwner {
        Puzzle storage p = puzzles[dayId];
        require(p.startTime > 0, "No puzzle");
        p.revealed = true;
        emit AnswerRevealed(dayId, p.answer);
    }

    // ── Player: submit guess ──────────────────────────────────────────────
    /**
     * @param guess   Numeric guess.
     * @param bet     Bet amount in the smallest unit of the chosen token.
     * @param token   TOKEN_NATIVE | TOKEN_ERC20_1 | TOKEN_ERC20_2
     *
     * For TOKEN_NATIVE send bet as msg.value.
     * For ERC-20 tokens approve this contract first.
     */
    function play(uint256 guess, uint256 bet, uint8 token) external payable nonReentrant {
        uint256 dayId = currentDayId();
        Puzzle storage p = puzzles[dayId];

        if (p.startTime == 0)                    revert NoGameToday();
        if (hasPlayedToday(msg.sender))          revert AlreadyPlayed();
        if (block.timestamp >= p.endTime)        revert GameClosed();
        if (token > TOKEN_ERC20_2)               revert InvalidToken();
        if (token == TOKEN_ERC20_2 && token2 == address(0)) revert InvalidToken();

        _validateAndReceiveBet(bet, token);

        bool won = isCorrectGuess(guess, p.answer, p.tolerance);

        attempts[dayId][msg.sender] = Attempt({
            guess:     guess,
            bet:       bet,
            token:     token,
            won:       won,
            claimed:   false,
            timestamp: block.timestamp
        });

        if (token == TOKEN_NATIVE) {
            p.betsNative += bet;
            if (won) p.winnersNative += 1;
        } else if (token == TOKEN_ERC20_1) {
            p.bets1 += bet;
            if (won) p.winners1 += 1;
        } else {
            p.bets2 += bet;
            if (won) p.winners2 += 1;
        }

        PlayerStats storage ps = playerStats[msg.sender];
        ps.totalPlayed += 1;
        if (won) {
            ps.totalWon      += 1;
            ps.currentStreak += 1;
            if (ps.currentStreak > ps.bestStreak) ps.bestStreak = ps.currentStreak;
        } else {
            ps.currentStreak = 0;
        }
        ps.lastPlayedDay = dayId;
        totalGamesPlayed += 1;

        emit GuessMade(dayId, msg.sender, guess, token, won);
    }

    // ── Player: claim reward ──────────────────────────────────────────────
    function claimReward(uint256 dayId) external nonReentrant {
        Puzzle storage p  = puzzles[dayId];
        Attempt storage a = attempts[dayId][msg.sender];

        if (!p.revealed)  revert GameClosed();
        if (!a.won)       revert NotWinner();
        if (a.claimed)    revert AlreadyClaimed();

        a.claimed = true;

        uint256 pool;
        uint256 winners;
        if (a.token == TOKEN_NATIVE) {
            pool    = p.poolNative;
            winners = p.winnersNative;
        } else if (a.token == TOKEN_ERC20_1) {
            pool    = p.pool1;
            winners = p.winners1;
        } else {
            pool    = p.pool2;
            winners = p.winners2;
        }

        uint256 poolShare = winners > 0 ? pool / winners : 0;
        uint256 payout    = a.bet + poolShare;

        _sendPayout(payout, a.token, msg.sender);

        emit RewardClaimed(dayId, msg.sender, payout, a.token);
    }

    // ── Owner: emergency withdraw ─────────────────────────────────────────
    function withdrawEmergency(uint256 amount, uint8 token) external onlyOwner {
        _sendPayout(amount, token, msg.sender);
    }

    // ── Internal helpers ──────────────────────────────────────────────────
    function _validateAndReceiveBet(uint256 bet, uint8 token) internal {
        if (token == TOKEN_NATIVE) {
            if (bet < MIN_BET_NATIVE || bet > MAX_BET_NATIVE) revert InvalidBet();
            if (msg.value != bet) revert InvalidBet();
        } else {
            // Reject stray native value on ERC-20 plays — previously any ETH/CELO sent
            // alongside an ERC-20 bet was silently absorbed into the contract balance
            // with no refund path (recoverable only via owner emergency withdraw).
            if (msg.value != 0) revert InvalidBet();
            if (bet < MIN_BET_ERC20 || bet > MAX_BET_ERC20) revert InvalidBet();
            address tokenAddr = token == TOKEN_ERC20_1 ? token1 : token2;
            IERC20(tokenAddr).safeTransferFrom(msg.sender, address(this), bet);
        }
    }

    function _sendPayout(uint256 amount, uint8 token, address to) internal {
        if (token == TOKEN_NATIVE) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            address tokenAddr = token == TOKEN_ERC20_1 ? token1 : token2;
            IERC20(tokenAddr).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}
