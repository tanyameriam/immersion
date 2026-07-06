"use client";

import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useWaitlist } from "@/components/WaitlistContext";

export default function Hero() {
  const { openWaitlist } = useWaitlist();

  return (
    <section className="pt-[72px]">
      <div className="mx-auto w-full max-w-[1280px] px-6 pt-10 md:px-10 md:pt-14 xl:px-20">
        <FadeUp>
          <h1
            className="font-bold tracking-[-0.04em] text-foreground"
            style={{
              fontSize: "clamp(3.75rem, 10.5vw, 9.5rem)",
              lineHeight: 0.95,
            }}
          >
            Layrrrd.
            <br />
            Save now.
            <br />
            Catch up
            <br />
            later.
          </h1>
        </FadeUp>
      </div>

      <div className="mt-8 border-t border-border md:mt-10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10 xl:px-20">
          <FadeUp delay={0.06}>
            <div className="max-w-xl">
              <p className="text-lg font-bold text-foreground">
                You&apos;re already saving great design content.
              </p>
              <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground md:text-base">
                Tweets. LinkedIn posts. Articles. Dribbble shots. Case
                studies. <span className="text-foreground">Layrrrd</span>{" "}
                turns everything you save into one weekly digest you&apos;ll
                actually read.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Button size="lg" onClick={openWaitlist}>
                Join Waitlist
              </Button>
              <span className="text-xs text-muted-foreground">
                Founding members · ₹99/month
              </span>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
