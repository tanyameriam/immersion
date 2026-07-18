"use client";

import { Button } from "@/components/ui/button";
import { useJoinCta } from "@/hooks/use-join-cta";
import { FOUNDING_TIER1_PRICE } from "@/lib/founding-membership";

export function FoundingStickyMobileCta() {
  const joinCta = useJoinCta();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-6 py-4 backdrop-blur-md md:hidden">
      <span className="text-sm font-semibold text-foreground">
        {FOUNDING_TIER1_PRICE} · Lifetime
      </span>
      <Button onClick={joinCta}>Become a Founding Member</Button>
    </div>
  );
}
