import type { SeatSummary } from "./types";

// Shorten a ledger address or hash for display.
export function shortId(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// A one-line summary of a session's seats, e.g. "3 bot · 1 you · 1 open".
export function seatBreakdown(seats: SeatSummary[]): string {
  const counts = { bot: 0, human: 0, open: 0 };
  for (const s of seats) counts[s.occupant.kind]++;
  const parts: string[] = [];
  if (counts.human) parts.push(`${counts.human} held`);
  if (counts.bot) parts.push(`${counts.bot} bot`);
  if (counts.open) parts.push(`${counts.open} open`);
  return parts.join(" · ") || "no seats";
}

// Render a decimal-string balance for display: thousands separators, trailing zeros trimmed. Non-numeric
// input is returned unchanged.
export function formatAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// A ledger currency code as the user typed it. Standard 3-character codes and "XRP" pass through; a
// non-standard currency is carried on-ledger as a 40-character hex code (see the engine's
// normalizeCurrency), which we decode back to its ASCII form, e.g. "524C555344…00" → "RLUSD". Anything
// that is not clean hex-ASCII is returned unchanged.
export function currencyLabel(code: string): string {
  if (!/^[0-9A-Fa-f]{40}$/.test(code)) return code;
  let out = "";
  for (let i = 0; i < code.length; i += 2) {
    const byte = parseInt(code.slice(i, i + 2), 16);
    if (byte === 0) break; // trailing NUL padding
    if (byte < 0x20 || byte > 0x7e) return code; // not printable ASCII — leave the raw code
    out += String.fromCharCode(byte);
  }
  return out || code;
}
