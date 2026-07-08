"use client";

import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useWaitlist } from "@/components/WaitlistContext";

const included = [
  "Unlimited saves from any page or app",
  "AI summary, TL;DR, and reading time on everything",
  "Weekly digest, grouped by topic, on the day you choose",
  "Recommendations picked for your interests",
  "Source and context kept with every save",
];

export default function Pricing() {
  const { openWaitlist } = useWaitlist();

  return (
    <section
      id="pricing"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <div className="grid gap-12 md:grid-cols-2 md:gap-8">
          <FadeUp delay={0.06}>
            <div>
              <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
                Become a
                <br />
                Founding
                <br />
                Member.
              </h2>
              <p className="mt-6 text-5xl font-bold tracking-[-0.03em] text-foreground md:text-6xl">
                ₹99
                <span className="text-2xl font-medium text-muted-foreground">
                  /month
                </span>
              </p>
              <p className="mt-6 max-w-sm text-[17px] leading-[1.65] text-muted-foreground">
                One plan. Everything included. Cancel any time.
              </p>
              <div className="mt-10">
                <Button size="lg" onClick={openWaitlist}>
                  Join Waitlist
                </Button>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <ul className="divide-y divide-border border-t border-border">
              {included.map((item) => (
                <li
                  key={item}
                  className="py-5 text-[17px] text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
