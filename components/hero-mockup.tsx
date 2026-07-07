import { Mockup, MockupFrame } from "@/components/ui/mockup";
import Glow from "@/components/ui/glow";

// A framed preview of the running application, used in the hero in place of a screenshot: a session
// with its seat grid, live vault state, and an active loan. It shows what the product is rather than
// a stock image.
export function HeroMockup() {
  return (
    <div className="relative w-full pt-12">
      <MockupFrame className="animate-appear opacity-0 delay-700" size="small">
        <Mockup type="responsive" className="bg-background">
          <div className="w-full bg-background p-6 text-left">
            {/* window chrome */}
            <div className="mb-5 flex items-center gap-2 border-b pb-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
              </div>
              <span className="ml-2 font-mono text-xs text-muted-foreground">session-4f2a91c3</span>
            </div>

            {/* seat grid */}
            <div className="mb-5 grid grid-cols-5 gap-2">
              {[
                { r: "Issuer", who: "bot" },
                { r: "Vault mgr", who: "bot" },
                { r: "Depositor", who: "you" },
                { r: "Originator", who: "bot" },
                { r: "Borrower", who: "open" },
              ].map((s) => (
                <div
                  key={s.r}
                  className={`rounded-lg border p-2.5 ${
                    s.who === "you" ? "border-primary/40 bg-primary/5" : "bg-muted/30"
                  }`}
                >
                  <div className="text-[11px] font-medium">{s.r}</div>
                  <div
                    className={`mt-1 text-[10px] ${
                      s.who === "you"
                        ? "text-primary"
                        : s.who === "open"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s.who === "you" ? "You" : s.who === "open" ? "Open" : "Bot"}
                  </div>
                </div>
              ))}
            </div>

            {/* live state row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Vault assets", value: "90,001.14" },
                { label: "Broker cover", value: "20,000" },
                { label: "Active loans", value: "1" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                  <div className="mt-1 font-mono text-sm font-medium">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Mockup>
      </MockupFrame>
      <Glow variant="top" className="animate-appear-zoom opacity-0 delay-1000" />
    </div>
  );
}
