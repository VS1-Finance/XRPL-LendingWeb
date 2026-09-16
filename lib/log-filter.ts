import type { LogEntry } from "./engine-client";

// The Ledger Inspector's filter state. "all" is the pass-through sentinel for the action/actor
// dropdowns; result narrows to successful (tesSUCCESS → ok) or rejected entries.
export interface LogFilter {
  action: string; // an action label, or "all"
  result: "all" | "success" | "rejected";
  actor: string; // a seat key, or "all"
}

export const EMPTY_FILTER: LogFilter = { action: "all", result: "all", actor: "all" };

// True when the entry passes every active facet of the filter (AND semantics). "all"/"all"/"all"
// passes everything.
export function matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
  if (filter.action !== "all" && entry.action !== filter.action) return false;
  if (filter.result === "success" && !entry.ok) return false;
  if (filter.result === "rejected" && entry.ok) return false;
  if (filter.actor !== "all" && entry.actor !== filter.actor) return false;
  return true;
}

// The sorted, unique action labels present in the log — to populate the action filter's options.
export function distinctActions(entries: LogEntry[]): string[] {
  return [...new Set(entries.map((e) => e.action))].sort();
}

// The sorted, unique actor seat keys present in the log — to populate the actor filter's options.
export function distinctActors(entries: LogEntry[]): string[] {
  return [...new Set(entries.map((e) => e.actor))].sort();
}
