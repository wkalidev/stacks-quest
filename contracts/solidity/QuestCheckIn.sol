// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title QuestCheckIn
 * @notice Daily check-in streak contract — mirrors stacks-quest-agent-v3.clar on Base / Celo.
 *
 * Mechanic:
 *   - Users pay a small native-token fee once per day.
 *   - Consecutive days build a streak; streak bonuses are paid out at 7 / 30 / 100 days.
 *   - The check-in fee goes directly to the owner treasury wallet.
 *   - Streak bonuses are paid from the contract balance (funded by owner).
 */
contract QuestCheckIn is Ownable, ReentrancyGuard {
    // ── Errors ────────────────────────────────────────────────────────────
    error AlreadyCheckedIn();
    error InsufficientFee();
    error NativeTransferFailed();
    error InsufficientContractBalance();

    // ── Config ────────────────────────────────────────────────────────────
    uint256 public checkinFee    = 0.001 ether;  // 0.001 ETH / CELO
    uint256 public bonusAt7      = 0.002 ether;
    uint256 public bonusAt30     = 0.010 ether;
    uint256 public bonusAt100    = 0.050 ether;

    uint256 public constant SECONDS_PER_DAY = 86400;

    // ── Storage ───────────────────────────────────────────────────────────
    struct Streak {
        uint256 currentStreak;
        uint256 bestStreak;
        uint256 lastCheckinDay;
        uint256 totalCheckins;
    }

    mapping(address => Streak) public streaks;
    // user => dayId => checked-in
    mapping(address => mapping(uint256 => bool)) public checkins;

    uint256 public totalCheckins;
    uint256 public totalFeesCollected;

    // ── Events ────────────────────────────────────────────────────────────
    event CheckedIn(address indexed user, uint256 indexed day, uint256 streak, uint256 bonus);
    event BonusFunded(address indexed funder, uint256 amount);
    event FeeUpdated(uint256 newFee);

    // ── Constructor ───────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ── Views ─────────────────────────────────────────────────────────────
    function currentDayId() public view returns (uint256) {
        return block.timestamp / SECONDS_PER_DAY;
    }

    function hasCheckedInToday(address user) public view returns (bool) {
        return checkins[user][currentDayId()];
    }

    function getStreak(address user) external view returns (Streak memory) {
        return streaks[user];
    }

    function globalStats() external view returns (uint256 _totalCheckins, uint256 _totalFees, uint256 _day) {
        return (totalCheckins, totalFeesCollected, currentDayId());
    }

    // ── Check-in ──────────────────────────────────────────────────────────
    /**
     * @notice Check in for today. Must send exactly checkinFee as msg.value.
     *         Fee is forwarded directly to the owner; bonuses come from contract balance.
     */
    function dailyCheckin() external payable nonReentrant {
        if (msg.value < checkinFee)          revert InsufficientFee();
        if (hasCheckedInToday(msg.sender))   revert AlreadyCheckedIn();

        uint256 today = currentDayId();
        Streak storage s = streaks[msg.sender];

        bool isConsecutive = (s.lastCheckinDay + 1 == today);
        uint256 newStreak  = isConsecutive ? s.currentStreak + 1 : 1;
        uint256 newBest    = newStreak > s.bestStreak ? newStreak : s.bestStreak;

        s.currentStreak  = newStreak;
        s.bestStreak     = newBest;
        s.lastCheckinDay = today;
        s.totalCheckins += 1;

        checkins[msg.sender][today] = true;
        totalCheckins              += 1;
        totalFeesCollected         += checkinFee;

        // Forward fee to owner treasury
        (bool ok,) = owner().call{value: checkinFee}("");
        if (!ok) revert NativeTransferFailed();

        // Return any overpayment
        uint256 overpay = msg.value - checkinFee;
        if (overpay > 0) {
            (bool refund,) = msg.sender.call{value: overpay}("");
            if (!refund) revert NativeTransferFailed();
        }

        // Pay streak bonus if applicable
        uint256 bonus = _bonusFor(newStreak);
        if (bonus > 0) {
            if (address(this).balance < bonus) revert InsufficientContractBalance();
            (bool bonusOk,) = msg.sender.call{value: bonus}("");
            if (!bonusOk) revert NativeTransferFailed();
        }

        emit CheckedIn(msg.sender, today, newStreak, bonus);
    }

    // ── Owner: fund bonus pool ────────────────────────────────────────────
    function fundBonusPool() external payable onlyOwner {
        emit BonusFunded(msg.sender, msg.value);
    }

    // ── Owner: update fee ─────────────────────────────────────────────────
    function setCheckinFee(uint256 newFee) external onlyOwner {
        checkinFee = newFee;
        emit FeeUpdated(newFee);
    }

    // ── Owner: update bonus amounts ───────────────────────────────────────
    function setBonuses(uint256 _7day, uint256 _30day, uint256 _100day) external onlyOwner {
        bonusAt7   = _7day;
        bonusAt30  = _30day;
        bonusAt100 = _100day;
    }

    // ── Owner: emergency withdraw ─────────────────────────────────────────
    function withdrawEmergency(uint256 amount) external onlyOwner {
        if (address(this).balance < amount) revert InsufficientContractBalance();
        (bool ok,) = owner().call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    // ── Internal ──────────────────────────────────────────────────────────
    function _bonusFor(uint256 streak) internal view returns (uint256) {
        // Only pay once at exact milestone (not every multiple)
        if (streak == 100) return bonusAt100;
        if (streak == 30)  return bonusAt30;
        if (streak == 7)   return bonusAt7;
        return 0;
    }

    receive() external payable {}
}
