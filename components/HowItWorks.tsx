import { FadeUp } from "@/components/FadeUp";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Sign up.",
    description: "Choose Email or Telegram for your weekly digest.",
  },
  {
    title: "Save while scrolling.",
    description:
      "See something interesting? Forward it to Layrrrd. No folders. No tags. No organization.",
  },
  {
    title: "Receive your digest.",
    description:
      "Every week you'll get everything you've saved: organized, summarized, and prioritized.",
  },
  {
    title: "Gets smarter over time.",
    description: "The more you save, the more personal your digest becomes.",
  },
];

function stepBorderClasses(i: number, total: number) {
  const isLast = i === total - 1;
  const isTopRow = i < 2;
  const isLeftCol = i % 2 === 0;
  return cn(
    !isLast && "border-b border-border",
    !isTopRow && "md:border-b-0",
    isLeftCol && "md:border-r md:border-border"
  );
}

export default function HowItWorks() {
  return (
    <section className="border-t border-border py-[120px] md:py-[160px]">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            As simple
            <br />
            as forwarding
            <br />
            a link.
          </h2>
        </FadeUp>

        <div className="mt-16">
          <div className="grid md:grid-cols-2">
            {steps.map((step, i) => (
              <FadeUp key={step.title} delay={i * 0.06}>
                <div className={cn("py-8 md:p-12", stepBorderClasses(i, steps.length))}>
                  <span className="text-6xl font-bold tracking-[-0.03em] text-border md:text-7xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-6 text-xl font-bold tracking-[-0.02em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
