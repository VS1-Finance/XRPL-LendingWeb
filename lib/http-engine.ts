import type {
  ActionRequest,
  ActionResult,
  EngineClient,
  LogEntry,
  ProvisionRequest,
  ProvisionStep,
  SessionBalances,
} from "./engine-client";
import type { SessionConfig, SessionState, SessionSummary } from "./types";
import { actionLabel, actionDetail } from "./log-format";
import { currencyLabel } from "./format";

// The action-log row shape returned by GET /sessions/:id/log — raw, unformatted.
interface EngineLogRow {
  seq: number;
  ts: number;
  actor: string;
  role: string;
  by: "human" | "bot" | "system";
  action: string;
  code: string;
  hash?: string;
  params?: Record<string, string>;
}

// The live engine client: implements the same EngineClient interface the mock does, but over the
// engine's HTTP API. Binding the app to the real engine is choosing this implementation in client.ts.
// Response shapes from the engine match our types almost exactly (SessionState is identical); the
// small differences are reconciled here so nothing above this file changes.

// The browser always talks to the same-origin proxy (/api/engine), which forwards to the engine
// server-side. This keeps requests same-origin (no CORS) and lets SSE stream through unbuffered. A
// direct engine URL can still be forced via NEXT_PUBLIC_ENGINE_URL for local, proxy-less debugging.
const BASE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? "/api/engine";

// The engine's SessionSummary has no config field, but carries the real scenario and bot seed at the
// top level (which our SessionSummary folds into `config`); everything else matches ours.
type EngineSummary = Omit<SessionSummary, "config"> & { scenario?: string; botSeed?: string };

class HttpEngineError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpEngineError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch (cause) {
    // A network-level failure (engine down, CORS blocked) surfaces as a thrown error so the UI drops
    // to its error boundary rather than hanging.
    throw new HttpEngineError(`engine unreachable at ${BASE_URL}`, 0, { cause });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new HttpEngineError(body?.error ?? `request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

// The engine summary carries the real vault asset but not the broker/timing config, so we build the
// config block from the summary's own asset (never a hardcoded currency) and leave the values the
// engine doesn't expose as best-effort. The Info tab reads live cover from state rather than this
// coverAmount, so it always shows the real figure regardless of what's here.
function withConfig(summary: EngineSummary): SessionSummary {
  // The scenario and bot seed live under `config` in our shape, not at the top level, so lift them out
  // of the spread. `?? "mixed"` preserves the current display when the engine supplies no scenario.
  const { scenario, botSeed, ...rest } = summary;
  return {
    ...rest,
    config: {
      asset: summary.asset,
      coverAmount: "0",
      paymentInterval: 60,
      scenario: scenario ?? "mixed",
      botSeed,
    },
  };
}

// Provisions a session over the SSE endpoint, forwarding each `step` event to onStep and resolving
// with the summary from the final `done` event. An `error` event (or a transport failure) rejects.
// EventSource cannot POST, so the stream is read from a fetch body and parsed as SSE frames by hand.
async function streamCreate(
  body: Record<string, unknown>,
  onStep: (step: ProvisionStep) => void,
): Promise<EngineSummary> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/sessions/stream`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new HttpEngineError(`engine unreachable at ${BASE_URL}`, 0, { cause });
  }
  if (!res.ok || !res.body) {
    throw new HttpEngineError(`provisioning failed to start (${res.status})`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: EngineSummary | null = null;
  let failure: string | null = null;

  // SSE frames are separated by a blank line; each frame carries an `event:` and a `data:` line.
  const handleFrame = (frame: string): void => {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    const parsed = JSON.parse(data);
    if (event === "step") onStep(parsed as ProvisionStep);
    else if (event === "done") summary = parsed as EngineSummary;
    else if (event === "error") failure = (parsed as { error?: string }).error ?? "provisioning failed";
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      handleFrame(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
    }
  }
  if (buffer.trim()) handleFrame(buffer);

  if (failure) throw new HttpEngineError(failure, 500);
  if (!summary) throw new HttpEngineError("provisioning ended without a session", 500);
  return summary;
}

// The engine action result omits `ok` (it is derivable) and names the action; the UI needs `ok` and
// the code/hash. tesSUCCESS is the only fully-successful result.
function toActionResult(res: { code: string; hash?: string }): ActionResult {
  return { code: res.code, hash: res.hash, ok: res.code === "tesSUCCESS" };
}

// Maps a UI action + params onto the action name and params the engine expects. Most pass straight
// through; a few UI names and parameter keys differ from the ledger-facing ones.
function toEngineAction(req: ActionRequest): ActionRequest {
  const params = { ...(req.params ?? {}) };
  switch (req.action) {
    case "set-max-assets":
      // The vault-manager "set maximum assets" is a VaultSet with AssetsMaximum.
      return { seat: req.seat, action: "set-vault", params: rename(params, "amount", "assetsMaximum") };
    case "set-domain":
      // The domain input carries the accepted credential type.
      return { seat: req.seat, action: "set-domain", params: rename(params, "domain", "credentialType") };
    case "originate":
      // Origination is bilateral; the engine takes the borrower seat and the principal.
      return { seat: req.seat, action: "originate", params: rename(params, "amount", "principal") };
    case "request-loan":
      // Borrower-initiated: same principal mapping as originate, but the borrower is the acting seat —
      // no separate borrower param.
      return { seat: req.seat, action: "request-loan", params: rename(params, "amount", "principal") };
    default:
      // deposit, withdraw, repay, issue-credential, revoke-credential, manage-loan pass through with
      // their params already keyed as the engine expects (amount, loanId, subject, borrower, ...).
      return { seat: req.seat, action: req.action, params };
  }
}

function rename(params: Record<string, string>, from: string, to: string): Record<string, string> {
  if (!(from in params)) return params;
  const { [from]: value, ...rest } = params;
  return { ...rest, [to]: value };
}

export const httpEngine: EngineClient = {
  async createSession(req: ProvisionRequest, onStep?: (step: ProvisionStep) => void) {
    // With a step sink, provision over the streaming endpoint so the caller sees each ledger step as
    // it settles; otherwise use the plain blocking create. Pool sizes, asset, and broker rates are
    // honoured by the engine (pool clamped there to a safe maximum).
    const body = {
      label: req.label,
      depositors: req.depositors,
      borrowers: req.borrowers,
      asset: req.asset,
      permissioned: req.permissioned,
      coverAmount: req.coverAmount,
      coverRatePercent: req.coverRatePercent,
      liquidationRatePercent: req.liquidationRatePercent,
      managementFeePercent: req.managementFeePercent,
      debtMaximum: req.debtMaximum,
      scenario: req.scenario,
      botSeed: req.botSeed,
    };
    if (onStep) {
      const summary = await streamCreate(body, onStep);
      return withConfig(summary);
    }
    const summary = await request<EngineSummary>("/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return withConfig(summary);
  },

  async getSession(setupId: string) {
    return withConfig(await request<EngineSummary>(`/sessions/${encodeURIComponent(setupId)}`));
  },

  async getState(setupId: string) {
    return request<SessionState>(`/sessions/${encodeURIComponent(setupId)}/state`);
  },

  async getBalances(setupId: string) {
    return request<SessionBalances>(`/sessions/${encodeURIComponent(setupId)}/balances`);
  },

  async getLog(setupId: string): Promise<LogEntry[]> {
    // The engine stores raw action rows; the display label and human-readable detail are formatted
    // here (the engine keeps the log lean and format-free). Fetch the summary alongside the log so
    // amount details are labelled in the vault's real asset (e.g. "500 XRP"), not a hardcoded default.
    const [rows, summary] = await Promise.all([
      request<EngineLogRow[]>(`/sessions/${encodeURIComponent(setupId)}/log`),
      request<EngineSummary>(`/sessions/${encodeURIComponent(setupId)}`),
    ]);
    const assetLabel = currencyLabel(summary.asset);
    return rows.map((r) => {
      // Carry the raw magnitude of amount-bearing actions (deposit/withdraw/originate/set-max) onto
      // the entry so the charts can plot real values; leave undefined when the row carries no number.
      const raw = Number(r.params?.amount ?? r.params?.principal ?? r.params?.assetsMaximum);
      const amount = Number.isFinite(raw) ? raw : undefined;
      return {
        seq: r.seq,
        ts: r.ts,
        actor: r.actor,
        role: r.role,
        by: r.by,
        action: actionLabel(r.action),
        code: r.code,
        ok: r.code === "tesSUCCESS",
        hash: r.hash,
        detail: actionDetail(r.params, assetLabel),
        amount,
      };
    });
  },

  async claimSeat(setupId: string, seat: string, participant: string) {
    const summary = await request<EngineSummary>(
      `/sessions/${encodeURIComponent(setupId)}/seats/${encodeURIComponent(seat)}/claim`,
      { method: "POST", body: JSON.stringify({ participant }) },
    );
    return withConfig(summary);
  },

  async releaseSeat(setupId: string, seat: string, participant: string) {
    const summary = await request<EngineSummary>(
      `/sessions/${encodeURIComponent(setupId)}/seats/${encodeURIComponent(seat)}/release`,
      { method: "POST", body: JSON.stringify({ participant }) },
    );
    return withConfig(summary);
  },

  async addParticipant(setupId: string, role: "depositor" | "borrower") {
    // Grows a pooled role by one bot-seated member: the engine derives, funds, and credentials a fresh
    // account, seats a bot on it, and returns the updated summary.
    const summary = await request<EngineSummary>(
      `/sessions/${encodeURIComponent(setupId)}/participants`,
      { method: "POST", body: JSON.stringify({ role }) },
    );
    return withConfig(summary);
  },

  async act(setupId: string, participant: string, req: ActionRequest) {
    const engineReq = toEngineAction(req);
    const res = await request<{ action: string; code: string; hash?: string }>(
      `/sessions/${encodeURIComponent(setupId)}/actions`,
      {
        method: "POST",
        body: JSON.stringify({ participant, seat: engineReq.seat, action: engineReq.action, params: engineReq.params }),
      },
    );
    return toActionResult(res);
  },

  async startBots(setupId: string) {
    await request(`/sessions/${encodeURIComponent(setupId)}/bots/start`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async stopBots(setupId: string) {
    await request(`/sessions/${encodeURIComponent(setupId)}/bots/stop`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
