"use client";

import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useWaitlist } from "@/components/WaitlistContext";

export default function Hero() {
  const { openWaitlist } = useWaitlist();

  return (
    <section className="flex h-screen flex-col pt-[72px]">
      <div className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 items-stretch overflow-hidden">
        <div className="flex flex-1 items-center px-6 md:px-10 xl:px-20">
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

        <FadeUp
          delay={0.1}
          className="hidden shrink-0 items-center justify-center pr-6 lg:flex xl:pr-20"
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-dog-poster.jpg"
            className="h-full w-auto max-w-[280px] object-contain xl:max-w-[340px]"
            aria-label="Illustrated dog mascot"
          >
            <source src="/hero-dog.webm" type="video/webm" />
            <source src="/hero-dog.mp4" type="video/mp4" />
          </video>
        </FadeUp>
      </div>

      <div className="border-t border-border">
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
