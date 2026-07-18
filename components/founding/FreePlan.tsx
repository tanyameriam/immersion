import { Check, Cookie } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { FadeUp } from "@/components/FadeUp";
import {
  FREE_MONTHLY_BISCUITS,
  FREE_BISCUITS_USED_SAMPLE,
} from "@/lib/founding-membership";

const freeIncluded = [
  "Unlimited bookmarks",
  "Unlimited AI summaries",
  "Weekly digest",
  "Smart search",
];

export function FoundingFreePlan() {
  const remaining = FREE_MONTHLY_BISCUITS - FREE_BISCUITS_USED_SAMPLE;

  return (
    <section
      id="free-plan"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            Or start free.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-[1.65] text-muted-foreground">
            Not ready to commit? Start on the free plan and upgrade to
            founding membership whenever you are.
          </p>
        </FadeUp>

        <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-8">
          <FadeUp delay={0.06}>
            <div className="h-full border border-border p-8">
              <h3 className="text-xl font-bold tracking-[-0.02em] text-foreground">
                Free plan includes
              </h3>
              <ul className="mt-6 space-y-4">
                {freeIncluded.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-[17px] text-foreground"
                  >
                    <Check className="size-5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="h-full border border-border p-8">
              <div className="flex items-center gap-3">
                <Cookie className="size-5 text-foreground" strokeWidth={1.5} />
                <h3 className="text-xl font-bold tracking-[-0.02em] text-foreground">
                  Rudolf&apos;s Biscuit Jar
                </h3>
              </div>

              <p className="mt-6 text-4xl font-bold tracking-[-0.03em] text-foreground">
                {FREE_MONTHLY_BISCUITS}{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  biscuits / month
                </span>
              </p>

              <Progress
                value={remaining}
                max={FREE_MONTHLY_BISCUITS}
                className="mt-6 flex-col items-stretch gap-2"
              >
                <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                  <span>Remaining this month</span>
                  <span className="tabular-nums">
                    {remaining} / {FREE_MONTHLY_BISCUITS}
                  </span>
                </div>
              </Progress>

              <p className="mt-6 text-[15px] leading-[1.65] text-muted-foreground">
                Every question you ask Rudolf costs one biscuit. The jar
                refills every month on the free plan - founding members get
                unlimited biscuits, forever.
              </p>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
