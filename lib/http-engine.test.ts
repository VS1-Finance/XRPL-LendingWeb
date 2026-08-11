import { describe, it, expect } from "vitest";
import { withConfig, type EngineSummary } from "@/lib/http-engine";

// withConfig folds the engine summary's top-level scenario/botSeed into our `config` shape. This is the
// manual type-sync seam between the two repos, so pin: the real scenario shows (not the old hardcoded
// "mixed"), the seed is carried, and neither leaks to the top level of the web SessionSummary.

function engineSummary(over: Partial<EngineSummary> = {}): EngineSummary {
  return {
    setupId: "session-abc",
    network: "devnet",
    asset: "XRP",
    permissioned: true,
    seats: [],
    openSeats: [],
    ...over,
  } as EngineSummary;
}

describe("withConfig", () => {
  it("carries the real scenario and bot seed into config", () => {
    const out = withConfig(engineSummary({ scenario: "defaults", botSeed: "seed-1234abcd" }));
    expect(out.config.scenario).toBe("defaults");
    expect(out.config.botSeed).toBe("seed-1234abcd");
  });

  it("falls back to 'mixed' when the engine supplies no scenario", () => {
    const out = withConfig(engineSummary({ botSeed: "seed-1234abcd" }));
    expect(out.config.scenario).toBe("mixed");
  });

  it("leaves config.botSeed undefined when the engine supplies none (mock/older engine)", () => {
    const out = withConfig(engineSummary());
    expect(out.config.botSeed).toBeUndefined();
  });

  it("does not leak scenario/botSeed to the top level of the web summary", () => {
    const out = withConfig(engineSummary({ scenario: "calm", botSeed: "seed-1234abcd" }));
    expect("scenario" in out).toBe(false);
    expect("botSeed" in out).toBe(false);
  });

  it("preserves the rest of the summary", () => {
    const out = withConfig(engineSummary({ setupId: "session-xyz", asset: "RLUSD" }));
    expect(out.setupId).toBe("session-xyz");
    expect(out.config.asset).toBe("RLUSD");
  });
});
