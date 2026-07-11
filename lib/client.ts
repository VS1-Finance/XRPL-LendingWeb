import type { EngineClient } from "./engine-client";
import { mockEngine } from "./mock-engine";
import { httpEngine } from "./http-engine";

// The active engine client. Components import `engine` from here and never touch the implementation.
// The live HTTP engine is selected when NEXT_PUBLIC_USE_ENGINE is set (talking to a real engine via
// the /api/engine proxy) or when a direct NEXT_PUBLIC_ENGINE_URL is given; otherwise the in-memory
// mock backs the UI, so the app is fully reviewable with no engine running.
export const engine: EngineClient =
  process.env.NEXT_PUBLIC_USE_ENGINE || process.env.NEXT_PUBLIC_ENGINE_URL ? httpEngine : mockEngine;

// The Devnet transaction explorer. A settled transaction hash links here from the transaction log.
const EXPLORER_BASE = "https://devnet.xrpl.org";

export function txUrl(hash: string): string {
  return `${EXPLORER_BASE}/transactions/${hash}`;
}

export function accountUrl(address: string): string {
  return `${EXPLORER_BASE}/accounts/${address}`;
}
