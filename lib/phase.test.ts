import { describe, it, expect } from "vitest";
import { phaseAllows, phaseLabel, formatCountdown } from "./phase";

describe("phaseAllows — mirrors the engine's phase gate exactly", () => {
  it("deposit is allowed only in subscription", () => {
    expect(phaseAllows("deposit", "subscription")).toBe(true);
    expect(phaseAllows("deposit", "investment")).toBe(false);
    expect(phaseAllows("deposit", "redemption")).toBe(false);
  });

  it("originate and request-loan are allowed only in investment", () => {
    for (const action of ["originate", "request-loan"]) {
      expect(phaseAllows(action, "subscription")).toBe(false);
      expect(phaseAllows(action, "investment")).toBe(true);
      expect(phaseAllows(action, "redemption")).toBe(false);
    }
  });

  it("withdraw is allowed in subscription and redemption, not investment", () => {
    expect(phaseAllows("withdraw", "subscription")).toBe(true);
    expect(phaseAllows("withdraw", "investment")).toBe(false);
    expect(phaseAllows("withdraw", "redemption")).toBe(true);
  });

  it("ungated actions (repay, manage-loan, credentials) are always allowed", () => {
    for (const phase of ["subscription", "investment", "redemption"] as const) {
      expect(phaseAllows("repay", phase)).toBe(true);
      expect(phaseAllows("manage-loan", phase)).toBe(true);
      expect(phaseAllows("issue-credential", phase)).toBe(true);
    }
  });

  it("null phase (non-closed-ended / unknown) gates nothing", () => {
    expect(phaseAllows("deposit", null)).toBe(true);
    expect(phaseAllows("originate", null)).toBe(true);
    expect(phaseAllows("withdraw", null)).toBe(true);
  });
});

describe("phaseLabel", () => {
  it("returns a human label per phase", () => {
    expect(phaseLabel("subscription")).toBe("Subscription");
    expect(phaseLabel("investment")).toBe("Investment");
    expect(phaseLabel("redemption")).toBe("Redemption");
  });
});

describe("formatCountdown", () => {
  it("formats short windows as m:ss", () => {
    expect(formatCountdown(252)).toBe("4:12");
    expect(formatCountdown(9)).toBe("0:09");
  });

  it("formats long windows as compact d/h", () => {
    expect(formatCountdown(2 * 86400 + 3 * 3600)).toBe("2d 3h");
    expect(formatCountdown(3600)).toBe("1h 0m");
  });

  it("handles zero, negative, and null", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(null)).toBe("—");
    expect(formatCountdown(undefined)).toBe("—");
  });
});
