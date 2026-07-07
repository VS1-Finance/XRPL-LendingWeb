import { cn } from "@/lib/utils";

// A page section wrapper with consistent horizontal padding and vertical rhythm, used by the
// landing-page blocks.
function Section({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("w-full px-4 py-12 sm:py-24 md:py-32", className)} {...props}>
      {children}
    </section>
  );
}

export { Section };
