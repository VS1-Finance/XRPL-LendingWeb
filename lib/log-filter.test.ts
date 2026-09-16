import { describe, it, expect } from "vitest";
import { matchesFilter, distinctActions, distinctActors, EMPTY_FILTER } from "./log-filter";
import type { LogEntry } from "./engine-client";

function entry(over: Partial<LogEntry>): LogEntry {
  return { seq: 1, ts: 0, actor: "depositor:0", role: "depositor", by: "human", action: "Deposit", code: "tesSUCCESS", ok: true, ...over };
}

describe("matchesFilter", () => {
  it("EMPTY_FILTER matches every entry", () => {
    expect(matchesFilter(entry({}), EMPTY_FILTER)).toBe(true);
    expect(matchesFilter(entry({ ok: false, code: "tecNO_AUTH" }), EMPTY_FILTER)).toBe(true);
  });

  it("filters by action", () => {
    expect(matchesFilter(entry({ action: "Deposit" }), { ...EMPTY_FILTER, action: "Deposit" })).toBe(true);
    expect(matchesFilter(entry({ action: "Withdraw" }), { ...EMPTY_FILTER, action: "Deposit" })).toBe(false);
  });

  it("filters by result", () => {
    expect(matchesFilter(entry({ ok: true }), { ...EMPTY_FILTER, result: "success" })).toBe(true);
    expect(matchesFilter(entry({ ok: true }), { ...EMPTY_FILTER, result: "rejected" })).toBe(false);
    expect(matchesFilter(entry({ ok: false }), { ...EMPTY_FILTER, result: "rejected" })).toBe(true);
  });

  it("filters by actor", () => {
    expect(matchesFilter(entry({ actor: "borrower:1" }), { ...EMPTY_FILTER, actor: "borrower:1" })).toBe(true);
    expect(matchesFilter(entry({ actor: "borrower:1" }), { ...EMPTY_FILTER, actor: "depositor:0" })).toBe(false);
  });

  it("combines filters with AND", () => {
    const f = { action: "Deposit", result: "success" as const, actor: "depositor:0" };
    expect(matchesFilter(entry({ action: "Deposit", ok: true, actor: "depositor:0" }), f)).toBe(true);
    expect(matchesFilter(entry({ action: "Deposit", ok: false, actor: "depositor:0" }), f)).toBe(false);
  });
});

describe("distinctActions / distinctActors", () => {
  it("returns sorted unique values", () => {
    const es = [entry({ action: "Withdraw", actor: "borrower:0" }), entry({ action: "Deposit", actor: "depositor:0" }), entry({ action: "Deposit", actor: "depositor:0" })];
    expect(distinctActions(es)).toEqual(["Deposit", "Withdraw"]);
    expect(distinctActors(es)).toEqual(["borrower:0", "depositor:0"]);
  });
});
