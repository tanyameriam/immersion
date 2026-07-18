"use client";

import { useState } from "react";
import { Cookie } from "lucide-react";
import { usePreferences } from "@/hooks/use-preferences";
import { useRazorpayCheckout } from "@/hooks/use-razorpay-checkout";
import { remainingMs, FREE_DAILY_MS } from "@/lib/billing/playtime-math";
import {
  BISCUIT_MINUTES,
  BISCUIT_PRICE_LABEL,
  FREE_DAILY_PLAY_HOURS,
} from "@/lib/founding-membership";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PACK_SIZES = [1, 4, 10];

/** Rudolf play-time meter for the free plan: minutes left today, the
 * biscuit jar, and a top-up purchase. Hidden for founding members, who play
 * without limits. */
export function RudolfPlaytimeCard() {
  const { prefs, loaded } = usePreferences();
  const { buy, status, error } = useRazorpayCheckout();
  const [pack, setPack] = useState(PACK_SIZES[0]);

  if (!loaded || prefs.plan === "pro") return null;

  const leftMs = remainingMs(prefs.rudolf, Date.now());
  const leftMins = Math.floor(leftMs / 60000);
  const totalMins = Math.max(leftMins, Math.floor(FREE_DAILY_MS / 60000));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cookie className="size-4" strokeWidth={1.5} />
          Rudolf&apos;s play time
        </CardTitle>
        <CardDescription>
          Rudolf plays with you for {FREE_DAILY_PLAY_HOURS} hours every day on
          the free plan. When he gets tired, a biscuit ({BISCUIT_PRICE_LABEL})
          keeps him going for {BISCUIT_MINUTES} more minutes. Biscuits never
          expire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress
          value={leftMins}
          max={totalMins}
          className="flex-col items-stretch gap-2"
        >
          <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
            <span>Play time left today</span>
            <span className="tabular-nums">
              {leftMins} / {totalMins} min
            </span>
          </div>
        </Progress>
        <p className="text-sm text-muted-foreground">
          Biscuits in the jar:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {prefs.biscuitBalance}
          </span>
        </p>
      </CardContent>
      <CardFooter className="flex-wrap gap-3">
        <div className="flex gap-2">
          {PACK_SIZES.map((size) => (
            <Button
              key={size}
              size="sm"
              variant={pack === size ? "default" : "outline"}
              onClick={() => setPack(size)}
            >
              {size}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => void buy({ product: "biscuits", quantity: pack })}
          disabled={status === "opening" || status === "verifying"}
        >
          {status === "opening"
            ? "Opening checkout…"
            : status === "verifying"
              ? "Confirming payment…"
              : `Buy ${pack} biscuit${pack === 1 ? "" : "s"}, ${BISCUIT_PRICE_LABEL} each`}
        </Button>
        {error && <span className="text-sm text-muted-foreground">{error}</span>}
      </CardFooter>
    </Card>
  );
}
