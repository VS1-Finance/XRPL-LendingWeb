import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Hero from "@/components/sections/hero/default";
import { Features } from "@/components/sections/features";
import Stats from "@/components/sections/stats/default";
import CTA from "@/components/sections/cta/default";
import Footer from "@/components/sections/footer/default";
import { HeroMockup } from "@/components/hero-mockup";

export default function HomePage() {
  return (
    <main className="flex-1">
      <Hero
        title="Permissioned lending on the XRP Ledger"
        description="A credential-gated lending market composed from four ledger amendments. Take any role yourself; deterministic bots keep the market alive around you."
        badge={
          <Badge variant="outline" className="animate-appear gap-2">
            <span className="text-muted-foreground">XRP Ledger reference implementation</span>
            <span className="flex items-center gap-1 font-mono text-xs">
              XLS-70 · 80 · 65 · 66
              <ArrowRight className="size-3" />
            </span>
          </Badge>
        }
        buttons={[
          { href: "/sessions/new", text: "Create a session", variant: "default" },
          { href: "#how", text: "Learn more", variant: "outline" },
        ]}
        mockup={<HeroMockup />}
      />

      <div id="how">
        <Features />
      </div>

      <Stats
        items={[
          { label: "composed of", value: 4, description: "ledger amendments" },
          { label: "playable", value: 5, suffix: " roles", description: "any of which a human can assume" },
          { label: "settled on", value: 1, suffix: " ledger", description: "the XRP Ledger Devnet" },
          { label: "enforcement", value: 100, suffix: "%", description: "on-ledger, not in application code" },
        ]}
      />

      <CTA
        title="Provision a session and take a role"
        buttons={[
          { href: "/sessions/new", text: "Create a session", variant: "default" },
          { href: "#how", text: "Learn more", variant: "outline" },
        ]}
      />

      <Footer
        name="XRPL Permissioned Lending"
        columns={[
          {
            title: "Amendments",
            links: [
              { text: "XLS-70 Credentials", href: "#how" },
              { text: "XLS-80 Permissioned Domains", href: "#how" },
              { text: "XLS-65 Single Asset Vault", href: "#how" },
              { text: "XLS-66 Lending Protocol", href: "#how" },
            ],
          },
          {
            title: "Platform",
            links: [
              { text: "Create a session", href: "/sessions/new" },
              { text: "How it works", href: "#how" },
            ],
          },
        ]}
        copyright="Reference implementation · XRP Ledger Devnet"
        showModeToggle={false}
      />
    </main>
  );
}
