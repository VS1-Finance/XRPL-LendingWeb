import { Section } from "../../ui/section";

interface StatItemProps {
  label?: string;
  value: string | number;
  suffix?: string;
  description?: string;
}

interface StatsProps {
  items?: StatItemProps[] | false;
  className?: string;
}

const DEFAULT_STATS: StatItemProps[] = [
  { label: "composed of", value: 4, description: "ledger amendments" },
  { label: "playable", value: 5, suffix: " roles", description: "any of which a human can assume" },
  { label: "settled on", value: 1, suffix: " ledger", description: "the XRP Ledger Devnet" },
  { label: "enforcement", value: 100, suffix: "%", description: "on-ledger, not in application code" },
];

export default function Stats({ items = DEFAULT_STATS, className }: StatsProps) {
  return (
    <Section className={className}>
      <div className="container mx-auto max-w-[960px]">
        {items !== false && items.length > 0 && (
          <div className="grid grid-cols-2 gap-12 sm:grid-cols-4">
            {items.map((item) => (
              <div
                key={`${item.label}-${item.description}`}
                className="flex flex-col items-start gap-3 text-left"
              >
                {item.label && (
                  <div className="text-muted-foreground text-sm font-semibold">{item.label}</div>
                )}
                <div className="flex items-baseline gap-2">
                  <div className="from-foreground to-brand bg-linear-to-r bg-clip-text text-4xl font-medium text-transparent drop-shadow-[2px_1px_24px_var(--brand-foreground)] transition-all duration-300 sm:text-5xl md:text-6xl">
                    {item.value}
                  </div>
                  {item.suffix && (
                    <div className="text-brand text-2xl font-semibold">{item.suffix}</div>
                  )}
                </div>
                {item.description && (
                  <div className="text-muted-foreground text-sm font-semibold text-pretty">
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
