// Named starting points for a new session. A template is a thin preset over the setup form — picking
// one fills the fields, which stay fully editable. Each maps only to combinations the engine actually
// provisions (any asset × public/permissioned), so a template always yields a working market.

export interface Template {
  id: string;
  label: string;
  summary: string;
  // The subset of the setup form a template sets. Anything omitted keeps the form's own default.
  values: {
    asset: string;
    permissioned: boolean;
    depositors: string;
    borrowers: string;
    cover: string;
    scenario: string;
    // Loan ceiling. Set on XRP presets to a faucet-realistic amount: an XRP vault funds each holder
    // this much real liquidity, so leaving it to the engine's large default makes provisioning glacial.
    // Omitted on IOU presets, whose liquidity is minted rather than funded.
    debtMax?: string;
  };
}

// A goal is the plain-language front door: pick what you want to do, and it chooses a fitting template
// and the seat role to drop you into. `claimRole` is the seat role auto-claimed on arrival at the
// session (a public vault has no credential-issuer seat, so "issue credentials" implies a permissioned
// template).
export interface Goal {
  id: string;
  label: string;
  summary: string;
  templateId: string;
  claimRole: string;
}

export const GOALS: Goal[] = [
  { id: "earn", label: "Earn yield", summary: "Deposit into the vault and earn a share of the interest borrowers pay.", templateId: "simple", claimRole: "depositor" },
  { id: "borrow", label: "Borrow", summary: "Draw a loan against vault liquidity and repay it over its term.", templateId: "permissioned", claimRole: "borrower" },
  { id: "manage", label: "Create & manage loans", summary: "Configure the vault and originate loans as the owner.", templateId: "permissioned", claimRole: "owner" },
  { id: "credential", label: "Issue credentials", summary: "Grant and revoke the credentials that gate a permissioned vault.", templateId: "permissioned", claimRole: "credentialIssuer" },
];

export function goalById(id: string): Goal | undefined {
  return GOALS.find((g) => g.id === id);
}

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export const TEMPLATES: Template[] = [
  {
    id: "simple",
    label: "Simple pool",
    summary: "Native XRP, open to anyone, a tiny pool. The fastest way to see a deposit settle.",
    values: { asset: "XRP", permissioned: false, depositors: "1", borrowers: "1", cover: "500", scenario: "calm", debtMax: "500" },
  },
  {
    id: "permissioned",
    label: "Permissioned market",
    summary: "An issued token gated by credentials — the tecNO_AUTH enforcement story, at moderate size.",
    values: { asset: "USD", permissioned: true, depositors: "2", borrowers: "2", cover: "2000", scenario: "mixed" },
  },
  {
    id: "stress",
    label: "Stress test",
    summary: "A larger permissioned XRP pool weighted toward defaults, to exercise the loss path.",
    values: { asset: "XRP", permissioned: true, depositors: "3", borrowers: "3", cover: "3000", scenario: "defaults", debtMax: "1000" },
  },
];
