"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { apiFetch } from "@/lib/api-client";
import { PRO_PLAN } from "@/lib/billing/config";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** The subset of the checkout.js API we use (no official types exist). */
interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: () => void) => void;
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

// checkout.js is loaded on demand (only when someone actually upgrades) and
// memoized so repeated clicks don't inject duplicate script tags.
let razorpayScript: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  razorpayScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => {
      razorpayScript = null;
      reject(new Error("Failed to load Razorpay checkout"));
    };
    document.body.appendChild(s);
  });
  return razorpayScript;
}

const priceLabel = `₹${(PRO_PLAN.amountPaise / 100).toLocaleString("en-IN")}`;

export function PlanCard() {
  const { user } = useAuth();
  const { prefs, loaded, reload } = usePreferences();
  const [status, setStatus] = useState<
    "idle" | "opening" | "verifying" | "done"
  >("idle");
  const [error, setError] = useState("");

  const isPro = prefs.plan === "pro";

  async function handleUpgrade() {
    setError("");
    setStatus("opening");
    try {
      const res = await apiFetch("/api/payments/order", { method: "POST" });
      if (res.status === 409) {
        // Already upgraded elsewhere (e.g. webhook landed first): refresh.
        await reload();
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error(`Order API ${res.status}`);
      const order = await res.json();

      await loadRazorpayScript();
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Layrrrd",
        description: PRO_PLAN.name,
        prefill: { name: prefs.name || user?.name || "", email: user?.email ?? "" },
        handler: async (response) => {
          setStatus("verifying");
          try {
            const verify = await apiFetch("/api/payments/verify", {
              method: "POST",
              body: JSON.stringify(response),
            });
            if (!verify.ok) throw new Error(`Verify API ${verify.status}`);
            await reload();
            setStatus("done");
          } catch (err) {
            // The payment likely went through; the webhook will finish the
            // upgrade even if this confirmation call failed.
            console.error("Payment verification failed", err);
            setError(
              "Payment received. Your upgrade is being activated, refresh in a minute.",
            );
            setStatus("idle");
          }
        },
        modal: {
          // Closing the checkout without paying: nothing was charged.
          ondismiss: () => setStatus("idle"),
        },
      });
      rzp.on("payment.failed", () => {
        setError("Payment failed and you have not been charged. Please try again.");
      });
      rzp.open();
    } catch (err) {
      console.error("Upgrade failed", err);
      setError("Couldn't start the payment. Try again in a moment.");
      setStatus("idle");
    }
  }

  if (!loaded) return null;

  if (isPro) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            You&apos;re on {PRO_PLAN.name}. Full access, all yours. Thanks for
            supporting Layrrrd!
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
          You&apos;re on the free plan. Upgrade to {PRO_PLAN.name} for full
          access to everything Layrrrd can do.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {PRO_PLAN.name}: {priceLabel}, one-time payment.
        </p>
      </CardContent>
      <CardFooter className="gap-3">
        <Button
          size="sm"
          onClick={handleUpgrade}
          disabled={status === "opening" || status === "verifying"}
        >
          {status === "opening"
            ? "Opening checkout…"
            : status === "verifying"
              ? "Confirming payment…"
              : `Upgrade to ${PRO_PLAN.name}`}
        </Button>
        {error && <span className="text-sm text-muted-foreground">{error}</span>}
      </CardFooter>
    </Card>
  );
}
