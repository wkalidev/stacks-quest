import { describe, expect, it, beforeEach } from "vitest";
import { Cl, serializeCV } from "@stacks/transactions";
import { createHash } from "node:crypto";

// Tests for the DRAFT commit-reveal contract (contracts/stacks-quest-v3-draft.clar).
// NOT a test of any deployed/live contract — this only exercises the draft, run via
// the Clarinet simnet (in-memory, no real chain, no real funds).
//
// Run with: npm install && npm test
//
// These were written and syntax-checked but could not be executed inside the audit
// sandbox (npm install is unreliable against this repo's synced-folder mount there).
// Run locally and report back if anything fails — happy to fix.

const CONTRACT = "stacks-quest-v3"; // matches Clarinet.toml's target deployment name

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const BLOCKS_PER_DAY = 144;
const REGISTER_WINDOW_BLOCKS = 144;

// sha256(to-consensus-buff?(answer) ++ salt) — matches the Clarity contract's own
// hash derivation in reveal-answer. serializeCV(Cl.uint(x)) produces the exact same
// consensus-wire bytes Clarity's `to-consensus-buff?` produces for a uint.
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(clean, "hex"));
}

function computeAnswerHash(answer: number, saltHex: string): string {
  const rawAnswerBuff = serializeCV(Cl.uint(answer));
  const answerBuff = hexToBytes(
    typeof rawAnswerBuff === "string" ? rawAnswerBuff : Buffer.from(rawAnswerBuff).toString("hex"),
  );
  const saltBuff = hexToBytes(saltHex);
  const combined = new Uint8Array(answerBuff.length + saltBuff.length);
  combined.set(answerBuff, 0);
  combined.set(saltBuff, answerBuff.length);
  return createHash("sha256").update(combined).digest("hex");
}

const SALT_HEX = "11".repeat(32); // fixed 32-byte test salt
const ANSWER = 42;
const WRONG_SALT_HEX = "22".repeat(32);

// UIntCV.value is the raw bigint — read it directly off the CV shape rather than via
// a conversion helper, to avoid depending on the exact behavior of a given
// @stacks/transactions version's cvToValue/cvToJSON implementation.
function unwrapUint(cv: unknown): number {
  return Number((cv as { value: bigint }).value);
}

function currentDayId(): number {
  const { result } = simnet.callReadOnlyFn(CONTRACT, "get-current-day", [], deployer);
  return unwrapUint(result);
}

function createTestPuzzle(sender = deployer, answer = ANSWER, saltHex = SALT_HEX) {
  const hash = computeAnswerHash(answer, saltHex);
  return simnet.callPublicFn(
    CONTRACT,
    "create-puzzle",
    [
      Cl.stringAscii("number"),
      Cl.bufferFromHex(hash),
      Cl.uint(5), // 5% tolerance
      Cl.uint(1000000), // pool-stx
      Cl.uint(0),
      Cl.uint(0),
      Cl.uint(0),
    ],
    sender,
  );
}

describe("stacks-quest-v3-draft: create-puzzle", () => {
  it("lets the owner create a puzzle with a hash commitment, not a plaintext answer", () => {
    const dayId = currentDayId();
    const { result } = createTestPuzzle();
    expect(result).toBeOk(Cl.uint(dayId));

    const puzzle = simnet.callReadOnlyFn(CONTRACT, "get-today-puzzle", [], deployer);
    // get-today-puzzle returns (optional (tuple ...)) -> SomeCV whose .value is a
    // TupleCV whose .value is a { fieldName: ClarityValue } object.
    const fields = (puzzle.result as { value: { value: Record<string, { type: string }> } }).value.value;
    // The critical property: `answer` is `none` right after creation — the plaintext
    // answer is never readable on-chain until reveal-answer succeeds post end-block.
    expect(fields.answer.type).toBe("none");
    // The commitment itself IS public (that's the point of commit-reveal) — buff type.
    expect(fields["answer-hash"].type).toBe("buffer");
    expect(fields.revealed).toEqual(Cl.bool(false));
  });

  it("rejects create-puzzle from a non-owner", () => {
    const { result } = createTestPuzzle(wallet1);
    expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-OWNER
  });

  it("rejects a second create-puzzle for the same day", () => {
    createTestPuzzle();
    const { result } = createTestPuzzle();
    expect(result).toBeErr(Cl.uint(102)); // ERR-GAME-CLOSED
  });
});

describe("stacks-quest-v3-draft: play", () => {
  beforeEach(() => {
    createTestPuzzle();
  });

  it("accepts a valid guess/bet and does NOT reveal the answer anywhere", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "play",
      [Cl.uint(ANSWER), Cl.uint(1000000), Cl.uint(0)],
      wallet1,
    );
    expect(result).toBeOk(expect.anything());

    const attempt = simnet.callReadOnlyFn(
      CONTRACT,
      "get-attempt",
      [Cl.uint(currentDayId()), Cl.principal(wallet1)],
      deployer,
    );
    // get-attempt returns (optional (tuple ...)) -> SomeCV -> TupleCV -> fields object
    const fields = (attempt.result as { value: { value: Record<string, { type: string }> } }).value.value;
    // `registered` must be false — the contract cannot know if this guess is correct yet
    expect(fields.registered).toEqual(Cl.bool(false));
  });

  it("rejects a second play from the same player on the same day", () => {
    simnet.callPublicFn(CONTRACT, "play", [Cl.uint(ANSWER), Cl.uint(1000000), Cl.uint(0)], wallet1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "play",
      [Cl.uint(1), Cl.uint(1000000), Cl.uint(0)],
      wallet1,
    );
    expect(result).toBeErr(Cl.uint(101)); // ERR-ALREADY-PLAYED
  });

  it("rejects a bet below the token minimum", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "play",
      [Cl.uint(ANSWER), Cl.uint(1), Cl.uint(0)], // 1 microstx, min is 1_000_000
      wallet1,
    );
    expect(result).toBeErr(Cl.uint(107)); // ERR-INVALID-BET
  });

  it("rejects play() after the game window closes", () => {
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "play",
      [Cl.uint(ANSWER), Cl.uint(1000000), Cl.uint(0)],
      wallet1,
    );
    expect(result).toBeErr(Cl.uint(104)); // ERR-NO-GAME-TODAY (new day-id, no puzzle for it)
  });
});

describe("stacks-quest-v3-draft: reveal-answer", () => {
  let dayId: number;

  beforeEach(() => {
    dayId = currentDayId();
    createTestPuzzle();
  });

  it("rejects reveal-answer before the game window closes", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(SALT_HEX)],
      deployer,
    );
    expect(result).toBeErr(Cl.uint(102)); // ERR-GAME-CLOSED
  });

  it("rejects a reveal whose hash doesn't match the commitment (wrong salt)", () => {
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(WRONG_SALT_HEX)],
      deployer,
    );
    expect(result).toBeErr(Cl.uint(109)); // ERR-BAD-REVEAL
  });

  it("rejects a reveal whose hash doesn't match the commitment (wrong answer)", () => {
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER + 1), Cl.bufferFromHex(SALT_HEX)],
      deployer,
    );
    expect(result).toBeErr(Cl.uint(109)); // ERR-BAD-REVEAL
  });

  it("accepts a correct reveal after the window closes, exactly once", () => {
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    const ok = simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(SALT_HEX)],
      deployer,
    );
    expect(ok.result).toBeOk(Cl.bool(true));

    const again = simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(SALT_HEX)],
      deployer,
    );
    expect(again.result).toBeErr(Cl.uint(111)); // ERR-ALREADY-REVEALED
  });

  it("rejects reveal-answer from a non-owner", () => {
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(SALT_HEX)],
      wallet1,
    );
    expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-OWNER
  });
});

describe("stacks-quest-v3-draft: register-win + claim-reward", () => {
  let dayId: number;

  beforeEach(() => {
    dayId = currentDayId();
    createTestPuzzle();
    // wallet1 guesses correctly, wallet2 guesses wrong
    simnet.callPublicFn(CONTRACT, "play", [Cl.uint(ANSWER), Cl.uint(1000000), Cl.uint(0)], wallet1);
    simnet.callPublicFn(CONTRACT, "play", [Cl.uint(ANSWER + 1000), Cl.uint(1000000), Cl.uint(0)], wallet2);
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(SALT_HEX)],
      deployer,
    );
  });

  it("lets a correct guesser register-win, and rejects an incorrect guesser", () => {
    const win = simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    expect(win.result).toBeOk(Cl.bool(true));

    const lose = simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet2);
    expect(lose.result).toBeErr(Cl.uint(114)); // ERR-NOT-CORRECT
  });

  it("rejects a double register-win", () => {
    simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    const { result } = simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    expect(result).toBeErr(Cl.uint(115)); // ERR-ALREADY-REGISTERED
  });

  it("rejects register-win after the registration window closes", () => {
    simnet.mineEmptyBlocks(REGISTER_WINDOW_BLOCKS + 1);
    const { result } = simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    expect(result).toBeErr(Cl.uint(112)); // ERR-REGISTER-CLOSED
  });

  it("rejects claim-reward before the registration window closes", () => {
    simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    const { result } = simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet1);
    expect(result).toBeErr(Cl.uint(113)); // ERR-REGISTER-OPEN
  });

  it("rejects claim-reward from someone who never registered", () => {
    simnet.mineEmptyBlocks(REGISTER_WINDOW_BLOCKS + 1);
    const { result } = simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet2);
    expect(result).toBeErr(Cl.uint(106)); // ERR-NOT-WINNER
  });

  it("pays a single registered winner their bet back plus the full pool", () => {
    simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    simnet.mineEmptyBlocks(REGISTER_WINDOW_BLOCKS + 1);
    const { result } = simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet1);
    // bet (1_000_000) + full pool (1_000_000, only winner) = 2_000_000
    expect(result).toBeOk(
      Cl.tuple({ payout: Cl.uint(2000000), token: Cl.uint(0) }),
    );
  });

  it("rejects a double claim-reward", () => {
    simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    simnet.mineEmptyBlocks(REGISTER_WINDOW_BLOCKS + 1);
    simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet1);
    const { result } = simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet1);
    expect(result).toBeErr(Cl.uint(105)); // ERR-ALREADY-CLAIMED
  });
});

describe("stacks-quest-v3-draft: pro-rata split across multiple winners", () => {
  it("splits the pool evenly when two players both guess correctly", () => {
    const dayId = currentDayId();
    createTestPuzzle(); // pool-stx = 1_000_000

    // both wallet1 and wallet2 guess correctly, before end-block
    simnet.callPublicFn(CONTRACT, "play", [Cl.uint(ANSWER), Cl.uint(1000000), Cl.uint(0)], wallet1);
    simnet.callPublicFn(CONTRACT, "play", [Cl.uint(ANSWER), Cl.uint(1000000), Cl.uint(0)], wallet2);

    simnet.mineEmptyBlocks(BLOCKS_PER_DAY + 1);
    simnet.callPublicFn(
      CONTRACT,
      "reveal-answer",
      [Cl.uint(dayId), Cl.uint(ANSWER), Cl.bufferFromHex(SALT_HEX)],
      deployer,
    );

    simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet1);
    simnet.callPublicFn(CONTRACT, "register-win", [Cl.uint(dayId)], wallet2);

    simnet.mineEmptyBlocks(REGISTER_WINDOW_BLOCKS + 1);

    const claim1 = simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet1);
    const claim2 = simnet.callPublicFn(CONTRACT, "claim-reward", [Cl.uint(dayId)], wallet2);

    // pool (1_000_000) / 2 winners = 500_000 share each; payout = bet (1_000_000) + share
    expect(claim1.result).toBeOk(Cl.tuple({ payout: Cl.uint(1500000), token: Cl.uint(0) }));
    expect(claim2.result).toBeOk(Cl.tuple({ payout: Cl.uint(1500000), token: Cl.uint(0) }));
  });
});
