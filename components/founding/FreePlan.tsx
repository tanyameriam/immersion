import { Check, Cookie } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { FadeUp } from "@/components/FadeUp";
import {
  BISCUIT_MINUTES,
  BISCUIT_PRICE_LABEL,
  FREE_DAILY_PLAY_HOURS,
  FREE_DAILY_PLAY_MINUTES,
} from "@/lib/founding-membership";

const freeIncluded = [
  "Unlimited bookmarks",
  "Unlimited AI summaries",
  "Weekly digest",
  "Smart search",
];

export function FoundingFreePlan() {
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
                  Rudolf&apos;s Play Time
                </h3>
              </div>

              <p className="mt-6 text-4xl font-bold tracking-[-0.03em] text-foreground">
                {FREE_DAILY_PLAY_HOURS} hours{" "}
                <span className="text-lg font-medium text-muted-foreground">
                  every day
                </span>
              </p>

              <Progress
                value={FREE_DAILY_PLAY_MINUTES}
                max={FREE_DAILY_PLAY_MINUTES}
                className="mt-6 flex-col items-stretch gap-2"
              >
                <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                  <span>A fresh full tank daily</span>
                  <span className="tabular-nums">
                    {FREE_DAILY_PLAY_MINUTES} min
                  </span>
                </div>
              </Progress>

              <p className="mt-6 text-[15px] leading-[1.65] text-muted-foreground">
                Rudolf plays with you for {FREE_DAILY_PLAY_HOURS} hours every
                day on the free plan. When he gets tired, a biscuit (
                {BISCUIT_PRICE_LABEL}) keeps him going for another{" "}
                {BISCUIT_MINUTES} minutes, and biscuits never expire. Founding
                members skip all of this: unlimited play time, forever.
              </p>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
