import { useState } from "react";
import { ShieldCheck, Coins, Settings2, FileSignature, HandCoins, User, Bot, CircleDashed, Plus, Loader2 } from "lucide-react";
import type { SeatSummary } from "@/lib/types";
import { seatLabel } from "@/lib/roles";
import { shortId } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROLE_ICON: Record<string, typeof User> = {
  issuer: Coins,
  credentialIssuer: ShieldCheck,
  owner: Settings2,
  depositor: Coins,
  borrower: HandCoins,
};

// The owner seat is presented as two role surfaces; its icon nods to origination too.
void FileSignature;

export function SeatGrid({
  seats,
  me,
  onClaim,
  onRelease,
  onAddParticipant,
}: {
  seats: SeatSummary[];
  me: string;
  onClaim: (seatKey: string) => void;
  onRelease: (seatKey: string) => void;
  onAddParticipant: (role: "depositor" | "borrower") => Promise<void>;
}) {
  // Seats are grouped so the structure reads clearly: the protocol-fixed system roles, then each
  // pooled role with its own "add" affordance at the end of the group.
  const system = seats.filter((s) => s.role === "issuer" || s.role === "credentialIssuer" || s.role === "owner");
  const depositors = seats.filter((s) => s.role === "depositor");
  const borrowers = seats.filter((s) => s.role === "borrower");

  const cardProps = { me, onClaim, onRelease };

  return (
    <div className="space-y-5">
      <SeatGroup title="System" count={system.length}>
        {system.map((seat) => (
          <SeatCard key={seat.key} seat={seat} {...cardProps} />
        ))}
      </SeatGroup>

      <SeatGroup title="Depositors" count={depositors.length} onAdd={() => onAddParticipant("depositor")}>
        {depositors.map((seat) => (
          <SeatCard key={seat.key} seat={seat} {...cardProps} />
        ))}
      </SeatGroup>

      <SeatGroup title="Borrowers" count={borrowers.length} onAdd={() => onAddParticipant("borrower")}>
        {borrowers.map((seat) => (
          <SeatCard key={seat.key} seat={seat} {...cardProps} />
        ))}
      </SeatGroup>
    </div>
  );
}

// A titled group of seat cards. Pooled groups carry a small "Add" button in the header to grow the
// pool by a bot participant; the button holds its own pending state during provisioning.
function SeatGroup({
  title,
  count,
  onAdd,
  children,
}: {
  title: string;
  count?: number;
  onAdd?: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  async function add() {
    if (!onAdd) return;
    setAdding(true);
    try {
      await onAdd();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* A fixed-height header so every group's baseline lines up, whether or not it can add. */}
      <div className="flex h-7 items-center gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
        {onAdd && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={adding}
            onClick={add}
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function SeatCard({
  seat,
  me,
  onClaim,
  onRelease,
}: {
  seat: SeatSummary;
  me: string;
  onClaim: (seatKey: string) => void;
  onRelease: (seatKey: string) => void;
}) {
  const key = seat.key;
  const Icon = ROLE_ICON[seat.role] ?? User;
  const isMine = seat.occupant.kind === "human" && seat.occupant.id === me;
  const heldByOther = seat.occupant.kind === "human" && seat.occupant.id !== me;

  return (
    <Card
      className={`flex flex-col gap-3 p-3.5 transition-colors ${
        isMine ? "border-foreground/40 bg-muted/30" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
          <Icon className="h-4 w-4 stroke-[1.5] text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{seatLabel(seat)}</div>
          <div className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
            {shortId(seat.address)}
          </div>
        </div>
        <OccupantBadge seat={seat} isMine={isMine} />
      </div>

      {isMine ? (
        <Button variant="outline" size="sm" className="w-full" onClick={() => onRelease(key)}>
          Release
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={heldByOther}
          onClick={() => onClaim(key)}
        >
          {heldByOther ? "Held by participant" : "Take this role"}
        </Button>
      )}
    </Card>
  );
}

function OccupantBadge({ seat, isMine }: { seat: SeatSummary; isMine: boolean }) {
  if (isMine) {
    return (
      <Badge className="gap-1 shrink-0">
        <User className="h-3 w-3" /> You
      </Badge>
    );
  }
  if (seat.occupant.kind === "human") {
    return (
      <Badge variant="secondary" className="gap-1 shrink-0 max-w-[7rem]">
        <User className="h-3 w-3 shrink-0" /> <span className="truncate">{seat.occupant.id}</span>
      </Badge>
    );
  }
  if (seat.occupant.kind === "bot") {
    return (
      <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground">
        <Bot className="h-3 w-3" /> Bot
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground">
      <CircleDashed className="h-3 w-3" /> Open
    </Badge>
  );
}
