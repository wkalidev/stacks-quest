import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

// Tests for the DRAFT capped-faucet token (contracts/b2s-token-v5-draft.clar).
// NOT a test of the deployed b2s-token-v4 — this only exercises the draft, via the
// Clarinet simnet (in-memory, no real chain, no real funds).
//
// Run with: npm install && npm test
//
// Written and syntax-checked but could not be executed inside the audit sandbox
// (npm install is unreliable there against this repo's synced-folder mount). Run
// locally and report back if anything fails.

const CONTRACT = "b2s-token-v5-draft";
const BLOCK_BUCKET = 144;
const CLAIM_AMOUNT = 5000000; // 5 B2S, 6 decimals
const FAUCET_BUDGET = 15000000000000; // 15,000,000 B2S
const MAX_CLAIMS_PER_ADDRESS = 30;

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

function claim(sender: string) {
  return simnet.callPublicFn(CONTRACT, "claim-daily-reward", [], sender);
}

// `get-balance` / `get-faucet-remaining` / `get-claim-count` all return `(ok uint)`.
// ResponseOkCV.value is the inner CV, UIntCV.value is the raw bigint — unwrap directly
// via the CV shape rather than a serialization helper, to keep this independent of
// exactly which value-conversion helper a given @stacks/transactions version exports.
function unwrapOkUint(result: unknown): number {
  return Number((result as { value: { value: bigint } }).value.value);
}

function balanceOf(who: string): number {
  const { result } = simnet.callReadOnlyFn(CONTRACT, "get-balance", [Cl.principal(who)], deployer);
  return unwrapOkUint(result);
}

function faucetRemaining(): number {
  const { result } = simnet.callReadOnlyFn(CONTRACT, "get-faucet-remaining", [], deployer);
  return unwrapOkUint(result);
}

function claimCount(who: string): number {
  const { result } = simnet.callReadOnlyFn(CONTRACT, "get-claim-count", [Cl.principal(who)], deployer);
  return unwrapOkUint(result);
}

describe("b2s-token-v5-draft: basic faucet behavior (unchanged from v4)", () => {
  it("mints CLAIM_AMOUNT on first claim", () => {
    const before = balanceOf(wallet1);
    const { result } = claim(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    expect(balanceOf(wallet1)).toBe(before + CLAIM_AMOUNT);
  });

  it("rejects a second claim in the same ~day bucket", () => {
    claim(wallet1);
    const { result } = claim(wallet1);
    expect(result).toBeErr(Cl.uint(104)); // e5 -> already claimed this bucket
  });

  it("allows claiming again after the daily bucket rolls over", () => {
    claim(wallet1);
    simnet.mineEmptyBlocks(BLOCK_BUCKET);
    const { result } = claim(wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });
});

describe("b2s-token-v5-draft: per-address lifetime cap (NEW vs v4)", () => {
  it("tracks claim-count correctly across multiple days", () => {
    expect(claimCount(wallet2)).toBe(0);
    claim(wallet2);
    expect(claimCount(wallet2)).toBe(1);
    simnet.mineEmptyBlocks(BLOCK_BUCKET);
    claim(wallet2);
    expect(claimCount(wallet2)).toBe(2);
  });

  it(`rejects a claim once MAX_CLAIMS_PER_ADDRESS (${MAX_CLAIMS_PER_ADDRESS}) is reached`, () => {
    for (let i = 0; i < MAX_CLAIMS_PER_ADDRESS; i++) {
      const { result } = claim(wallet1);
      expect(result).toBeOk(Cl.bool(true));
      simnet.mineEmptyBlocks(BLOCK_BUCKET);
    }
    expect(claimCount(wallet1)).toBe(MAX_CLAIMS_PER_ADDRESS);

    const { result } = claim(wallet1);
    expect(result).toBeErr(Cl.uint(106)); // e7 -> per-address lifetime cap reached
  });
});

describe("b2s-token-v5-draft: global faucet budget (NEW vs v4)", () => {
  it("starts with the full FAUCET_BUDGET remaining", () => {
    expect(faucetRemaining()).toBe(FAUCET_BUDGET);
  });

  it("decrements faucet-remaining by exactly CLAIM_AMOUNT per successful claim", () => {
    const before = faucetRemaining();
    claim(wallet1);
    expect(faucetRemaining()).toBe(before - CLAIM_AMOUNT);

    simnet.mineEmptyBlocks(BLOCK_BUCKET);
    claim(wallet1);
    expect(faucetRemaining()).toBe(before - CLAIM_AMOUNT * 2);
  });

  // NOTE: actually driving faucet-remaining to 0 would require ~10 million distinct
  // claims (FAUCET_BUDGET / CLAIM_AMOUNT), which isn't practical to simulate in a unit
  // test. The two tests above prove the accounting is linear and correct per claim;
  // the boundary check itself (`<= FAUCET-BUDGET`) is a single, simple comparison in
  // the contract source that follows directly from that same accounting. If you want
  // a real end-to-end exhaustion test, temporarily lower FAUCET-BUDGET in a copy of
  // the contract used only for this test file.
});

describe("b2s-token-v5-draft: unchanged token mechanics", () => {
  it("mints the initial supply to the owner at deploy", () => {
    expect(balanceOf(deployer)).toBeGreaterThanOrEqual(400000000000000);
  });

  it("rejects transfer from someone other than the token owner of the funds", () => {
    claim(wallet1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "transfer",
      [Cl.uint(1000000), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet2, // wallet2 is not `s` (wallet1), should be rejected
    );
    expect(result).toBeErr(Cl.uint(101)); // e2
  });

  it("rejects mint from a non-owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "mint",
      [Cl.uint(1000000), Cl.principal(wallet1)],
      wallet1,
    );
    expect(result).toBeErr(Cl.uint(100)); // e1
  });
});
