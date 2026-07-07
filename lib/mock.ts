import type { SessionState, SessionSummary } from "./types";

// Static sample data for building and reviewing the UI before it is wired to the engine. It matches
// the engine's response shapes.

export const mockSessions: SessionSummary[] = [
  {
    setupId: "session-4f2a91c3-demo",
    network: "devnet",
    seats: [
      { key: "issuer:0", role: "issuer", address: "rGUbdhmpMzxX9gNczpuHMYFuydVQ35HszH", occupant: { kind: "bot" } },
      { key: "owner:0", role: "owner", address: "rPbWoiiXggf5cz3CNY1oih75QpXwHuNQsC", occupant: { kind: "bot" } },
      { key: "depositor:0", role: "depositor", address: "rUsMQ5Y6UG6LvbrrG6uDkdaqgM3XhpwXZk", occupant: { kind: "human", id: "alice" } },
      { key: "depositor:1", role: "depositor", address: "rh4Ko6aSE6Zgh3d6b2ZqQSPFXJsWPGQFuf", occupant: { kind: "bot" } },
      { key: "borrower:0", role: "borrower", address: "rD7QWjj8aAu8GpzVXK5WJjwhwjogHbPA9V", occupant: { kind: "open" } },
    ],
    openSeats: ["borrower:0"],
  },
  {
    setupId: "session-9b7e02aa-audit",
    network: "devnet",
    seats: [
      { key: "issuer:0", role: "issuer", address: "rwBZZpa39kUiBd76Kfi5UK346Wi45Yj8s6", occupant: { kind: "bot" } },
      { key: "owner:0", role: "owner", address: "rNhu3S9bmvtaccJXr3VDiLdYLVcURWZCBS", occupant: { kind: "bot" } },
      { key: "depositor:0", role: "depositor", address: "rUqmMtuV2UVXPGH42w7Fk2dSgGoB8MFuUD", occupant: { kind: "bot" } },
      { key: "borrower:0", role: "borrower", address: "rHaMCBaaDB48Pa4pNmRf7frFWQwNNMSjVu", occupant: { kind: "bot" } },
    ],
    openSeats: [],
  },
];

export function mockSessionState(setupId: string): SessionState {
  return {
    setupId,
    vault: { assetsTotal: "90000.011", assetsAvailable: "80000", shareMptId: "00000001AACCF157E3B913D31CA2C27683CD4A21876462BA" },
    broker: { coverAvailable: "20000" },
    loans: [
      { loanId: "2020E3DCFB72CF376AD0B372DABA86FF4DB4D821C1D45A7571EFF5BE1D26BB98", borrower: "rD7QWjj8aAu8GpzVXK5WJjwhwjogHbPA9V", principalOutstanding: "10000", totalOutstanding: "10001.14", paymentRemaining: 1, defaulted: false },
    ],
    seats: [
      { key: "issuer:0", occupant: "bot" },
      { key: "owner:0", occupant: "bot" },
      { key: "depositor:0", occupant: "human", participant: "alice" },
      { key: "depositor:1", occupant: "bot" },
      { key: "borrower:0", occupant: "open" },
    ],
  };
}
