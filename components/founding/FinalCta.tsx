"use client";

import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useJoinCta } from "@/hooks/use-join-cta";
import { FOUNDING_REMAINING_SPOTS } from "@/lib/founding-membership";

export function FoundingFinalCta() {
  const joinCta = useJoinCta();

  return (
    <section className="border-t border-border py-[120px] md:py-[160px]">
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 px-6 md:grid-cols-2 md:gap-12 md:px-10 xl:px-20">
        <FadeUp>
          <div>
            <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              Ready to become a founding member?
            </h2>
            <p className="mt-5 max-w-md text-lg leading-[1.65] text-muted-foreground">
              {FOUNDING_REMAINING_SPOTS} spots left. Once they&apos;re gone,
              this offer won&apos;t come back.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.06} className="flex justify-end">
          <div className="inline-flex flex-col gap-4">
            <Button size="lg" className="w-full" onClick={joinCta}>
              Become a Founding Member
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={joinCta}
            >
              Continue with Free
            </Button>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
