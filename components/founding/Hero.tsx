"use client";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FadeUp } from "@/components/FadeUp";
import { useJoinCta } from "@/hooks/use-join-cta";
import {
  FOUNDING_CLAIMED_SPOTS,
  FOUNDING_TOTAL_SPOTS,
  FOUNDING_TIER1_CAP,
  FOUNDING_TIER1_PRICE,
  FOUNDING_TIER1_REMAINING,
  FOUNDING_TIER2_PRICE,
} from "@/lib/founding-membership";

export function FoundingHero() {
  const joinCta = useJoinCta();

  return (
    <section id="pricing" className="py-[120px] md:py-[160px]">
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 px-6 md:grid-cols-2 md:gap-12 md:px-10 xl:px-20">
        <FadeUp>
          <div>
            <Badge
              variant="outline"
              className="border border-border px-4 py-2 text-foreground"
            >
              Join the first 100 founding members
            </Badge>

            <h1
              className="mt-8 font-bold tracking-[-0.04em] text-foreground"
              style={{ fontSize: "clamp(2.25rem, 5.5vw, 4.75rem)", lineHeight: 0.98 }}
            >
              Become part of the journey.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-[1.65] text-muted-foreground">
              We&apos;re opening Layrrrd to just 100 founding members.
              You&apos;ll help shape the product as it&apos;s built, get
              lifetime access for a single one-time payment, and have a
              direct line to what we build next.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.08}>
          <div>
            <Card>
              <CardHeader>
                <Badge variant="secondary">
                  🍪 First {FOUNDING_TIER1_CAP} members
                </Badge>
                <CardTitle className="mt-2 normal-case tracking-normal">
                  Lifetime Membership
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-muted-foreground/50 line-through">
                      {FOUNDING_TIER2_PRICE}
                    </span>
                    <span className="text-5xl font-bold tracking-[-0.03em] text-foreground">
                      {FOUNDING_TIER1_PRICE}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    One-time payment
                    <br />
                    Lifetime founding membership
                  </p>
                </div>

                <div className="border border-dashed border-border p-4">
                  <Badge variant="secondary">Not yet open</Badge>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Then{" "}
                    <span className="font-semibold text-foreground">
                      {FOUNDING_TIER2_PRICE}
                    </span>{" "}
                    for members {FOUNDING_TIER1_CAP + 1}–{FOUNDING_TOTAL_SPOTS}
                  </p>
                </div>

                <div className="border-t border-dashed border-border pt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {FOUNDING_CLAIMED_SPOTS} / {FOUNDING_TIER1_CAP} claimed
                    </span>
                    <span className="text-muted-foreground">
                      {FOUNDING_TIER1_REMAINING} spots left
                    </span>
                  </div>
                  <Progress
                    value={FOUNDING_CLAIMED_SPOTS}
                    max={FOUNDING_TIER1_CAP}
                    className="mt-2"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button size="lg" className="w-full" onClick={joinCta}>
                  Become a Founding Member
                </Button>
              </CardFooter>
            </Card>

            <p className="mt-6 text-sm text-muted-foreground">
              Once all 100 memberships are claimed, Founding Membership will
              never be offered again.
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
