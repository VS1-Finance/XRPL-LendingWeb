import { describe, it, expect } from "vitest";
import { mockEngine } from "@/lib/mock-engine";
import type { ProvisionRequest } from "@/lib/engine-client";

// The mock engine backs mock-mode review, so it must echo the bot seed the same way the live engine
// does — and, like the live engine, must not crash if the untyped request carries a non-string seed.

const base: ProvisionRequest = { asset: "XRP", depositors: 1, borrowers: 1 };

describe("mockEngine bot seed", () => {
  it("echoes a supplied seed verbatim", async () => {
    const s = await mockEngine.createSession({ ...base, botSeed: "repro-xyz" });
    expect(s.config.botSeed).toBe("repro-xyz");
  });

  it("generates a seed-<hex> when omitted", async () => {
    const s = await mockEngine.createSession({ ...base });
    expect(s.config.botSeed).toMatch(/^seed-[0-9a-f]+$/);
  });

  it("generates when the seed is blank/whitespace", async () => {
    const s = await mockEngine.createSession({ ...base, botSeed: "   " });
    expect(s.config.botSeed).toMatch(/^seed-[0-9a-f]+$/);
  });

  it("does not crash on a non-string seed (untyped seam) and falls back to a generated one", async () => {
    // The request crosses an untyped boundary; a number/object must not throw on .trim().
    const bad = { ...base, botSeed: 12345 as unknown as string };
    const s = await mockEngine.createSession(bad);
    expect(s.config.botSeed).toMatch(/^seed-[0-9a-f]+$/);
  });

  it("carries the real scenario, coercing a non-string safely", async () => {
    const s = await mockEngine.createSession({ ...base, scenario: "calm" });
    expect(s.config.scenario).toBe("calm");
    const s2 = await mockEngine.createSession({ ...base, scenario: 99 as unknown as string });
    expect(s2.config.scenario).toBe("mixed");
  });
});
