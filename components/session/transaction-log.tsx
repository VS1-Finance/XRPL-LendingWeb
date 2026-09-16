"use client";

import { useMemo, useState } from "react";
import { ExternalLink, User, Bot, Settings, ChevronDown, ChevronRight } from "lucide-react";
import type { LogEntry } from "@/lib/engine-client";
import { txUrl } from "@/lib/client";
import { seatLabelForKey } from "@/lib/roles";
import { ledgerMessage } from "@/lib/ledger-codes";
import { matchesFilter, distinctActions, distinctActors, EMPTY_FILTER, type LogFilter } from "@/lib/log-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// The append-only record of everything that happened in the session, now inspectable: filter by action,
// result, or actor, and expand any row for the full transaction detail (raw params, ledger message,
// explorer link). This is the session's audit surface.
export function TransactionLog({ entries }: { entries: LogEntry[] }) {
  const [filter, setFilter] = useState<LogFilter>(EMPTY_FILTER);
  const [expanded, setExpanded] = useState<number | null>(null);

  const actions = useMemo(() => distinctActions(entries), [entries]);
  const actors = useMemo(() => distinctActors(entries), [entries]);
  const ordered = useMemo(
    () => [...entries].filter((e) => matchesFilter(e, filter)).sort((a, b) => b.seq - a.seq),
    [entries, filter],
  );

  return (
    <Card>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <FilterSelect
                value={filter.action}
                onChange={(v) => setFilter((f) => ({ ...f, action: v }))}
                allLabel="All actions"
                options={actions}
              />
              <FilterSelect
                value={filter.result}
                onChange={(v) => setFilter((f) => ({ ...f, result: v as LogFilter["result"] }))}
                allLabel="All results"
                options={["success", "rejected"]}
                labels={{ success: "Successful", rejected: "Rejected" }}
              />
              <FilterSelect
                value={filter.actor}
                onChange={(v) => setFilter((f) => ({ ...f, actor: v }))}
                allLabel="All actors"
                options={actors}
                labels={Object.fromEntries(actors.map((a) => [a, seatLabelForKey(a, a.split(":")[0] ?? a)]))}
              />
              {(filter.action !== "all" || filter.result !== "all" || filter.actor !== "all") && (
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setFilter(EMPTY_FILTER)}
                >
                  Clear
                </button>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {ordered.length} of {entries.length}
              </span>
            </div>
            {ordered.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No transactions match the filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="w-8 py-2.5 pl-6 pr-2" />
                      <th className="w-12 px-2 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">Actor</th>
                      <th className="px-3 py-2.5 font-medium">By</th>
                      <th className="px-3 py-2.5 font-medium">Action</th>
                      <th className="px-3 py-2.5 font-medium">Result</th>
                      <th className="px-3 py-2.5 pr-6 text-right font-medium">Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordered.map((e) => {
                      const isOpen = expanded === e.seq;
                      return (
                        <FragmentRow key={e.seq} entry={e} isOpen={isOpen} onToggle={() => setExpanded(isOpen ? null : e.seq)} />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// One log row plus its (conditionally rendered) detail panel. Split out so the expanded panel can span
// all columns via a second <tr>.
function FragmentRow({ entry: e, isOpen, onToggle }: { entry: LogEntry; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className="cursor-pointer border-b align-middle last:border-0 hover:bg-muted/30"
        onClick={onToggle}
      >
        <td className="py-2.5 pl-6 pr-2 text-muted-foreground">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground tabular-nums">{e.seq}</td>
        <td className="px-3 py-2.5 font-medium">{seatLabelForKey(e.actor, e.role)}</td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ByIcon by={e.by} />
            {e.by}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span>{e.action}</span>
          {e.detail && <span className="ml-1.5 text-muted-foreground">· {e.detail}</span>}
        </td>
        <td className="px-3 py-2.5">
          <Badge variant={e.ok ? "secondary" : "destructive"} className="font-mono text-[11px] font-normal" title={ledgerMessage(e.code)}>
            {e.code}
          </Badge>
        </td>
        <td className="px-3 py-2.5 pr-6 text-right">
          {e.hash ? (
            <a
              href={txUrl(e.hash)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(ev) => ev.stopPropagation()}
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {e.hash.slice(0, 12)}…{e.hash.slice(-6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b bg-muted/20 last:border-0">
          <td />
          <td colSpan={6} className="px-3 py-3 pr-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <Detail label="Result">
                <span className="font-mono">{e.code}</span> — {ledgerMessage(e.code)}
              </Detail>
              <Detail label="Actor">
                {seatLabelForKey(e.actor, e.role)} <span className="text-muted-foreground">({e.actor})</span>
              </Detail>
              <Detail label="Driven by">{e.by}</Detail>
              {e.detail && <Detail label="Detail">{e.detail}</Detail>}
              {e.params &&
                Object.entries(e.params).map(([k, v]) => (
                  <Detail key={k} label={k}>
                    <span className="font-mono break-all">{v}</span>
                  </Detail>
                ))}
              {e.hash && (
                <Detail label="Transaction">
                  <a href={txUrl(e.hash)} target="_blank" rel="noopener noreferrer" className="font-mono break-all underline underline-offset-2 hover:text-foreground">
                    {e.hash}
                  </a>
                </Detail>
              )}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-8 w-auto min-w-[9rem] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ByIcon({ by }: { by: LogEntry["by"] }) {
  const cls = "h-3.5 w-3.5 text-muted-foreground shrink-0";
  if (by === "human") return <User className={cls} />;
  if (by === "bot") return <Bot className={cls} />;
  return <Settings className={cls} />;
}
