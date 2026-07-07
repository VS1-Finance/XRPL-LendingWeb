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
