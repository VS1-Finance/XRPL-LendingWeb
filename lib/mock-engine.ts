import type {
  ActionRequest,
  ActionResult,
  EngineClient,
  LogEntry,
  ProvisionRequest,
} from "./engine-client";
import type { LoanState, SeatSummary, SessionState, SessionSummary } from "./types";

// An in-memory implementation of the engine client. It is not the engine, but it behaves like it:
// actions succeed or are rejected with real ledger result codes, the session state moves in response,
// and every attempt is recorded in an append-only transaction log. This lets the whole end-to-end
// flow be reviewed — including on-ledger rejections — before the app is bound to the live engine, at
// which point only this module is replaced.

interface Session {
  summary: SessionSummary;
  state: SessionState;
  log: LogEntry[];
  seq: number;
  botsRunning: boolean;
  // Subjects the issuer has credentialed. A deposit or borrow from an un-credentialed subject is
  // rejected by the ledger with tecNO_AUTH — the enforcement the whole system exists to demonstrate.
  credentialed: Set<string>;
}

const sessions = new Map<string, Session>();

// A deterministic pseudo-random stream seeded per session, so provisioning and hashes are stable
// across renders without relying on Math.random (which would produce hydration mismatches).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashFrom(next: () => number): string {
  const hex = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < 64; i++) out += hex[Math.floor(next() * 16)];
  return out;
}

function addressFrom(next: () => number): string {
  const chars = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
  let out = "r";
  for (let i = 0; i < 33; i++) out += chars[Math.floor(next() * chars.length)];
  return out;
}

function idFrom(next: () => number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(next() * 16)];
  return out;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

// Builds a fresh session from a provisioning request. Mirrors the engine's deployment: issuer, owner
// (vault manager + originator), the requested depositor and borrower seats, a funded vault, and
// broker cover. Bots occupy every seat until a human claims one.
function provision(setupId: string, req: ProvisionRequest, seed: number): Session {
  const next = rng(seed);
  const depositors = clampInt(req.depositors, 2, 1, 6);
  const borrowers = clampInt(req.borrowers, 1, 1, 6);

  const seats: SeatSummary[] = [
    { key: "issuer:0", role: "issuer", address: addressFrom(next), occupant: { kind: "bot" } },
    { key: "owner:0", role: "owner", address: addressFrom(next), occupant: { kind: "bot" } },
  ];
  for (let i = 0; i < depositors; i++)
    seats.push({ key: `depositor:${i}`, role: "depositor", address: addressFrom(next), occupant: { kind: "bot" } });
  for (let i = 0; i < borrowers; i++)
    seats.push({ key: `borrower:${i}`, role: "borrower", address: addressFrom(next), occupant: { kind: "bot" } });

  const cover = req.coverAmount && req.coverAmount.trim() ? req.coverAmount.trim() : "20000";
  const summary: SessionSummary = {
    setupId,
    network: "devnet",
    seats,
    openSeats: [],
    config: {
      asset: req.asset?.trim() || "RLUSD",
      coverAmount: cover,
      paymentInterval: clampInt(req.paymentInterval, 60, 30, 86400),
      scenario: req.scenario?.trim() || "mixed",
    },
  };

  const state: SessionState = {
    setupId,
    vault: { assetsTotal: "0", assetsAvailable: "0", shareMptId: `000000${idFrom(next).toUpperCase()}${hashFrom(next).slice(0, 34)}` },
    broker: { coverAvailable: cover },
    loans: [],
    seats: seats.map((s) => ({ key: s.key, occupant: s.occupant.kind, participant: s.occupant.id })),
  };

  const credentialed = new Set<string>(seats.map((s) => s.address));

  return { summary, state, log: [], seq: 0, botsRunning: false, credentialed };
}

function syncSeats(session: Session) {
  session.state.seats = session.summary.seats.map((s) => ({
    key: s.key,
    occupant: s.occupant.kind,
    participant: s.occupant.id,
  }));
}

function seatOf(session: Session, seatKey: string): SeatSummary | undefined {
  return session.summary.seats.find((s) => s.key === seatKey);
}

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function now(): number {
  // Real wall-clock time in the browser; the log is ordered by seq regardless, so this is only used
  // for display. Falls back to a monotonic base where Date is unavailable.
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

async function settle<T>(value: T): Promise<T> {
  // A short delay stands in for ledger settlement, so pending/settled UI states are exercised.
  await new Promise((r) => setTimeout(r, 500));
  return value;
}

// Human-readable labels for the actions, used in the transaction log.
const ACTION_LABEL: Record<string, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  "issue-credential": "Issue credential",
  "revoke-credential": "Revoke credential",
  "set-max-assets": "Set maximum assets",
  "set-domain": "Set accepted credential",
  originate: "Originate loan",
  repay: "Repay loan",
  "miss-payment": "Missed payment",
};

function detailFor(action: string, params: Record<string, string> | undefined, asset: string): string | undefined {
  const amount = params?.amount;
  if (amount && Number(amount) > 0) return `${Number(amount).toLocaleString()} ${asset}`;
  const subject = params?.subject;
  if (subject) return short(subject);
  const domain = params?.domain;
  if (domain) return domain;
  return undefined;
}

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

// Records one attempt in the session log, whether it settled or was rejected.
function record(
  session: Session,
  seat: SeatSummary,
  by: LogEntry["by"],
  action: string,
  result: ActionResult,
  params: Record<string, string> | undefined,
) {
  session.seq += 1;
  session.log.push({
    seq: session.seq,
    ts: now(),
    actor: seat.key,
    role: seat.role,
    by,
    action: ACTION_LABEL[action] ?? action,
    code: result.code,
    ok: result.ok,
    hash: result.hash,
    detail: detailFor(action, params, "RLUSD"),
  });
}

// Applies an action to session state and returns the ledger result. Rejections carry the real result
// code and leave state unchanged, exactly as a rejected transaction would.
function apply(session: Session, seat: SeatSummary, req: ActionRequest, next: () => number): ActionResult {
  const amount = num(req.params?.amount);
  const vault = session.state.vault;

  switch (req.action) {
    case "deposit": {
      if (!session.credentialed.has(seat.address)) return { code: "tecNO_AUTH", ok: false };
      if (amount <= 0) return { code: "temBAD_AMOUNT", ok: false };
      if (vault) {
        vault.assetsTotal = String(num(vault.assetsTotal) + amount);
        vault.assetsAvailable = String(num(vault.assetsAvailable) + amount);
      }
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    case "withdraw": {
      if (amount <= 0) return { code: "temBAD_AMOUNT", ok: false };
      if (vault && num(vault.assetsAvailable) < amount) return { code: "tecINSUFFICIENT_FUNDS", ok: false };
      if (vault) {
        vault.assetsTotal = String(num(vault.assetsTotal) - amount);
        vault.assetsAvailable = String(num(vault.assetsAvailable) - amount);
      }
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    case "issue-credential": {
      const subject = req.params?.subject?.trim();
      if (subject) session.credentialed.add(subject);
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    case "revoke-credential": {
      const subject = req.params?.subject?.trim();
      if (subject) session.credentialed.delete(subject);
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    case "set-max-assets":
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    case "set-domain":
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    case "originate": {
      if (amount <= 0) return { code: "temBAD_AMOUNT", ok: false };
      if (vault && num(vault.assetsAvailable) < amount) return { code: "tecINSUFFICIENT_FUNDS", ok: false };
      const borrowerSeat = session.summary.seats.find((s) => s.role === "borrower");
      const loan: LoanState = {
        loanId: hashFrom(next),
        borrower: borrowerSeat?.address ?? addressFrom(next),
        principalOutstanding: String(amount),
        totalOutstanding: String(Math.round(amount * 1.0114 * 100) / 100),
        paymentRemaining: 1,
        defaulted: false,
      };
      session.state.loans.push(loan);
      if (vault) vault.assetsAvailable = String(num(vault.assetsAvailable) - amount);
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    case "repay": {
      const loan =
        session.state.loans.find((l) => !l.defaulted && l.paymentRemaining > 0 && l.borrower === seat.address) ??
        session.state.loans.find((l) => !l.defaulted && l.paymentRemaining > 0);
      if (!loan) return { code: "tecNO_ENTRY", ok: false };
      const returned = num(loan.principalOutstanding) + amount;
      loan.paymentRemaining = Math.max(0, loan.paymentRemaining - 1);
      loan.principalOutstanding = "0";
      loan.totalOutstanding = "0";
      if (vault) vault.assetsAvailable = String(num(vault.assetsAvailable) + returned);
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    case "miss-payment": {
      const loan =
        session.state.loans.find((l) => !l.defaulted && l.paymentRemaining > 0 && l.borrower === seat.address) ??
        session.state.loans.find((l) => !l.defaulted && l.paymentRemaining > 0);
      if (!loan) return { code: "tecNO_ENTRY", ok: false };
      loan.defaulted = true;
      const loss = num(loan.totalOutstanding);
      if (session.state.broker) {
        session.state.broker.coverAvailable = String(Math.max(0, num(session.state.broker.coverAvailable) - loss));
      }
      return { code: "tesSUCCESS", ok: true, hash: hashFrom(next) };
    }
    default:
      return { code: "temMALFORMED", ok: false };
  }
}

// Assigns a stable numeric seed from a setup id, so a session id maps to the same environment every
// time it is opened (until an action mutates it in memory).
function seedFor(setupId: string): number {
  let h = 2166136261;
  for (let i = 0; i < setupId.length; i++) {
    h ^= setupId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The shape createSession produces: "session-" + two 8-char hex groups. A shared link carrying such
// an id resolves (lazily provisioned so it is stable across visits); anything else is treated as an
// unknown session so join and not-found behave like they will against the real engine.
const SESSION_ID = /^session-[0-9a-f]{8}-[0-9a-f]{8}$/;

class UnknownSessionError extends Error {
  constructor(setupId: string) {
    super(`Unknown session: ${setupId}`);
    this.name = "UnknownSessionError";
  }
}

function ensure(setupId: string): Session {
  let session = sessions.get(setupId);
  if (!session) {
    if (!SESSION_ID.test(setupId)) throw new UnknownSessionError(setupId);
    session = provision(setupId, {}, seedFor(setupId));
    prime(session);
    sessions.set(setupId, session);
  }
  return session;
}

// Seeds a just-provisioned session with the activity a running environment would already show: the
// issuer credentials a depositor, the depositor funds the vault, and the owner originates a loan.
// Each of these lands in the transaction log as a bot/system action.
function prime(session: Session) {
  const next = rng(seedFor(session.summary.setupId) ^ 0x9e3779b9);
  const issuer = seatOf(session, "issuer:0");
  const owner = seatOf(session, "owner:0");
  const depositor = session.summary.seats.find((s) => s.role === "depositor");

  if (issuer && depositor) {
    const p = { subject: depositor.address };
    record(session, issuer, "system", "issue-credential", apply(session, issuer, { seat: issuer.key, action: "issue-credential", params: p }, next), p);
  }
  if (depositor) {
    const p = { amount: "90000" };
    record(session, depositor, "bot", "deposit", apply(session, depositor, { seat: depositor.key, action: "deposit", params: p }, next), p);
  }
  if (owner) {
    const p = { amount: "10000" };
    record(session, owner, "bot", "originate", apply(session, owner, { seat: owner.key, action: "originate", params: p }, next), p);
  }
}

export const mockEngine: EngineClient = {
  async createSession(req) {
    const seed = hashSeed(req);
    const id = `session-${idFrom(rng(seed))}-${idFrom(rng(seed + 1))}`;
    const session = provision(id, req, seedFor(id));
    prime(session);
    sessions.set(id, session);
    return settle(clone(session.summary));
  },

  async getSession(setupId) {
    return clone(ensure(setupId).summary);
  },

  async getState(setupId) {
    return clone(ensure(setupId).state);
  },

  async getLog(setupId) {
    return clone(ensure(setupId).log);
  },

  async claimSeat(setupId, seatKey, participant) {
    const session = ensure(setupId);
    for (const s of session.summary.seats) {
      if (s.occupant.kind === "human" && s.occupant.id === participant) s.occupant = { kind: "bot" };
    }
    const seat = seatOf(session, seatKey);
    if (seat) seat.occupant = { kind: "human", id: participant };
    syncSeats(session);
    return settle(clone(session.summary));
  },

  async releaseSeat(setupId, seatKey, participant) {
    const session = ensure(setupId);
    const seat = seatOf(session, seatKey);
    if (seat && seat.occupant.kind === "human" && seat.occupant.id === participant) {
      seat.occupant = session.botsRunning ? { kind: "bot" } : { kind: "open" };
    }
    syncSeats(session);
    return settle(clone(session.summary));
  },

  async addParticipant(setupId, role) {
    const session = ensure(setupId);
    // Next free index in the pool, e.g. depositor:0..2 already present -> depositor:3.
    const existing = session.summary.seats.filter((s) => s.role === role);
    const index = existing.length;
    const key = `${role}:${index}`;
    const next = rng(seedFor(setupId) ^ (0xa5a5a5a5 + session.summary.seats.length));
    const address = addressFrom(next);

    const seat: SeatSummary = { key, role, address, occupant: { kind: "bot" } };
    session.summary.seats.push(seat);
    // The issuer credentials the new account before it can transact — recorded like any other action.
    session.credentialed.add(address);
    const issuer = seatOf(session, "issuer:0");
    if (issuer) {
      record(session, issuer, "system", "issue-credential", { code: "tesSUCCESS", ok: true, hash: hashFrom(next) }, {
        subject: address,
      });
    }
    syncSeats(session);
    return settle(clone(session.summary));
  },

  async act(setupId, participant, req) {
    const session = ensure(setupId);
    const seat = seatOf(session, req.seat);
    if (!seat) return settle({ code: "temMALFORMED", ok: false });
    const next = rng(seedFor(setupId) + session.seq + num(req.params?.amount));
    const result = apply(session, seat, req, next);
    const by: LogEntry["by"] = seat.occupant.kind === "human" && seat.occupant.id === participant ? "human" : "bot";
    record(session, seat, by, req.action, result, req.params);
    if (result.ok) syncSeats(session);
    return settle(result);
  },

  async startBots(setupId) {
    const session = ensure(setupId);
    session.botsRunning = true;
    for (const s of session.summary.seats) if (s.occupant.kind === "open") s.occupant = { kind: "bot" };
    syncSeats(session);
    await settle(null);
  },

  async stopBots(setupId) {
    const session = ensure(setupId);
    session.botsRunning = false;
    await settle(null);
  },
};

function hashSeed(req: ProvisionRequest): number {
  const key = `${req.label ?? ""}|${req.asset ?? ""}|${req.depositors ?? ""}|${req.borrowers ?? ""}|${req.coverAmount ?? ""}|${req.scenario ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
