import { describe, it, expect } from "vitest";
import { positionValue, sharePrice, earned } from "@/lib/format";

// Pure-function tests for the earnings-derivation helpers. These pin the two invariants that make the
// numbers trustworthy: positionValue is scale-invariant (the base-unit scale cancels), and both helpers
// return null — never NaN/Infinity — on a fresh/empty vault or non-finite input.

describe("positionValue", () => {
  it("is the holder's proportional share of total assets", () => {
    // Holds 1/4 of the shares → 1/4 of 400 assets = 100.
    expect(positionValue("250", "1000", "400")).toBe(100);
  });

  it("is scale-invariant — same ratio at scale 6 gives the same value", () => {
    // Shares scaled by 1e6 on both holder and total → the scale cancels, value is unchanged.
    expect(positionValue("250000000", "1000000000", "400")).toBe(100);
  });

  it("reflects appreciation: full holder gets all grown assets", () => {
    // Sole depositor holds every share; assets grew from 100 (par) to 105 → position worth 105.
    expect(positionValue("100000000", "100000000", "105")).toBe(105);
  });

  it("returns null on an empty vault (no shares) rather than dividing by zero", () => {
    expect(positionValue("0", "0", "0")).toBeNull();
    expect(positionValue("100", "0", "400")).toBeNull();
  });

  it("returns null on non-finite input", () => {
    expect(positionValue("abc", "1000", "400")).toBeNull();
    expect(positionValue("250", "xyz", "400")).toBeNull();
    expect(positionValue("250", "1000", "nope")).toBeNull();
  });
});

describe("sharePrice", () => {
  it("is 1.0 at par (assets == whole shares) for an XRP/MPT vault", () => {
    // 100 assets, 100e6 raw shares at scale 6 → 100 whole shares → price 1.0.
    expect(sharePrice("100", "100000000")).toBe(1);
  });

  it("rises above 1.0 after yield accrues", () => {
    // Assets grew to 105 against the same 100 whole shares → 1.05 per share.
    expect(sharePrice("105", "100000000")).toBeCloseTo(1.05, 10);
  });

  it("uses vault.Scale for IOU vaults when provided", () => {
    // Scale 2 → 100 raw shares = 1 whole share → 50 assets / 1 share = 50.
    expect(sharePrice("50", "100", 2)).toBe(50);
  });

  it("falls back to scale 6 when scale is 0 or missing", () => {
    expect(sharePrice("100", "100000000", 0)).toBe(1);
    expect(sharePrice("100", "100000000")).toBe(1);
  });

  it("returns null on an empty/fresh vault or non-finite input", () => {
    expect(sharePrice("0", "0")).toBeNull();
    expect(sharePrice("100", "0")).toBeNull();
    expect(sharePrice("bad", "100000000")).toBeNull();
  });
});

describe("earned", () => {
  it("is position value minus par basis", () => {
    expect(earned(105, 100)).toBe(5);
  });

  it("is zero at par", () => {
    expect(earned(100, 100)).toBe(0);
  });

  it("is null when either input is null", () => {
    expect(earned(null, 100)).toBeNull();
    expect(earned(105, null)).toBeNull();
    expect(earned(null, null)).toBeNull();
  });
});
