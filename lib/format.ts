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

// Vault shares mint at ~1e6 base units per whole asset for XRP/MPT vaults (Vault.Scale=0 but the
// share MPT is minted at scale 6); IOU vaults mint at vault.Scale. This constant is only needed for a
// standalone human-readable share price — position value uses a scale-invariant ratio and needs none.
const XRP_SHARE_SCALE = 6;

// A holder's position value in whole asset units: (holderShares / sharesTotal) * assetsTotal. This
// ratio is scale-invariant — holderShares and sharesTotal share the same base-unit scale, so it
// cancels. Returns null when the vault has no shares (fresh vault) so callers show "—" not a divide
// by zero, and null on any non-finite input.
export function positionValue(shares: string, sharesTotal: string, assetsTotal: string): number | null {
  const held = Number(shares);
  const total = Number(sharesTotal);
  const assets = Number(assetsTotal);
  if (!Number.isFinite(held) || !Number.isFinite(total) || !Number.isFinite(assets) || total <= 0) return null;
  return (held / total) * assets;
}

// A human-readable share price: whole asset units per one whole share. Normalizes raw share base
// units to whole shares by the share scale (IOU vaults use vault.Scale; XRP/MPT use 6). Returns null
// on a fresh/empty vault (no shares or no assets) so callers render "—".
export function sharePrice(assetsTotal: string, sharesTotal: string, scale?: number): number | null {
  const assets = Number(assetsTotal);
  const rawShares = Number(sharesTotal);
  if (!Number.isFinite(assets) || !Number.isFinite(rawShares) || rawShares <= 0) return null;
  const shareScale = scale && scale > 0 ? scale : XRP_SHARE_SCALE;
  const wholeShares = rawShares / 10 ** shareScale;
  if (wholeShares <= 0) return null;
  return assets / wholeShares;
}

// Unrealized yield of a current position: its value now minus the par basis of the shares held
// (par = 1.0 per whole share). Both inputs are whole asset units. Returns null when either is null.
// This is CURRENT unrealized yield, not lifetime P&L.
export function earned(positionValue: number | null, parBasis: number | null): number | null {
  if (positionValue == null || parBasis == null) return null;
  return positionValue - parBasis;
}
