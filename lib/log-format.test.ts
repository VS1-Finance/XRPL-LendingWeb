import { describe, it, expect } from "vitest";
import { logEntryParams } from "./log-format";

describe("logEntryParams", () => {
  it("returns the params bag when present", () => {
    const p = { amount: "500", loanId: "ABC" };
    expect(logEntryParams(p)).toEqual({ amount: "500", loanId: "ABC" });
  });

  it("returns undefined for a missing or empty params bag", () => {
    expect(logEntryParams(undefined)).toBeUndefined();
    expect(logEntryParams({})).toBeUndefined();
  });
});
