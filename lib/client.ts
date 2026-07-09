import type { EngineClient } from "./engine-client";
import { mockEngine } from "./mock-engine";

// The active engine client. Components import `engine` from here and never touch the implementation.
// Binding to the live engine is a one-line change: point this at the HTTP client instead of the mock.
export const engine: EngineClient = mockEngine;

// The Devnet transaction explorer. A settled transaction hash links here from the transaction log.
const EXPLORER_BASE = "https://devnet.xrpl.org";

export function txUrl(hash: string): string {
  return `${EXPLORER_BASE}/transactions/${hash}`;
}

export function accountUrl(address: string): string {
  return `${EXPLORER_BASE}/accounts/${address}`;
}
