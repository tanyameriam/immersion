"use client";

import { usePreferences } from "@/hooks/use-preferences";
import { useRazorpayCheckout } from "@/hooks/use-razorpay-checkout";
import { useFoundingStatus } from "@/hooks/use-founding-status";
import {
  FOUNDING_TIER1_PRICE,
  FOUNDING_TOTAL_SPOTS,
} from "@/lib/founding-membership";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PlanCard() {
  const { prefs, loaded } = usePreferences();
  const { buy, status, error } = useRazorpayCheckout();
  const { soldOut, remainingSpots, currentPriceLabel } = useFoundingStatus();

  if (!loaded) return null;

  if (prefs.plan === "pro") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            {prefs.foundingSpot
              ? `You're Founding Member #${prefs.foundingSpot} of ${FOUNDING_TOTAL_SPOTS}. Unlimited Rudolf play time, lifetime access, all yours. Thanks for building Layrrrd with us!`
              : "You have full lifetime access to Layrrrd, including unlimited Rudolf play time. Thanks for supporting Layrrrd!"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (soldOut) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            You&apos;re on the free plan. All {FOUNDING_TOTAL_SPOTS} founding
            memberships are claimed, and we&apos;re cooking up what comes next.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>
          You&apos;re on the free plan. Become a Founding Member for lifetime
          access and unlimited Rudolf play time, one payment, no renewals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Founding Membership: {currentPriceLabel ?? FOUNDING_TIER1_PRICE},
          one-time payment.
          {remainingSpots !== null && ` ${remainingSpots} of ${FOUNDING_TOTAL_SPOTS} spots left.`}
        </p>
      </CardContent>
      <CardFooter className="gap-3">
        <Button
          size="sm"
          onClick={() => void buy({ product: "founding" })}
          disabled={status === "opening" || status === "verifying"}
        >
          {status === "opening"
            ? "Opening checkout…"
            : status === "verifying"
              ? "Confirming payment…"
              : "Become a Founding Member"}
        </Button>
        {error && <span className="text-sm text-muted-foreground">{error}</span>}
      </CardFooter>
    </Card>
  );
}
