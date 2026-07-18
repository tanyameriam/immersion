"use client";

import { Button } from "@/components/ui/button";
import { useFoundingCta } from "@/hooks/use-founding-cta";
import { useFoundingStatus } from "@/hooks/use-founding-status";
import { FOUNDING_TIER1_PRICE } from "@/lib/founding-membership";

export function FoundingStickyMobileCta() {
  const { join, busy } = useFoundingCta();
  const { soldOut, currentPriceLabel } = useFoundingStatus();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-6 py-4 backdrop-blur-md md:hidden">
      <span className="text-sm font-semibold text-foreground">
        {currentPriceLabel ?? FOUNDING_TIER1_PRICE} · Lifetime
      </span>
      <Button onClick={join} disabled={busy || soldOut}>
        {soldOut ? "Sold out" : "Become a Founding Member"}
      </Button>
    </div>
  );
}
