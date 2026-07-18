"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { apiFetch } from "@/lib/api-client";
import type { PaidProduct } from "@/lib/billing/plan";

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

// checkout.js is loaded on demand (only when someone actually buys) and
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

export type CheckoutStatus = "idle" | "opening" | "verifying" | "done";

/**
 * The order -> checkout.js -> verify flow shared by the dashboard plan card,
 * the biscuit card, and the founding page CTAs. `buy` resolves when the
 * modal closes (paid or dismissed); on success preferences are reloaded so
 * plan/biscuit state is fresh everywhere.
 */
export function useRazorpayCheckout() {
  const { user } = useAuth();
  const { prefs, reload } = usePreferences();
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState("");

  async function buy(input: { product: PaidProduct; quantity?: number }) {
    setError("");
    setStatus("opening");
    try {
      const res = await apiFetch("/api/payments/order", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (res.status === 409) {
        // Already upgraded elsewhere (e.g. webhook landed first), or sold
        // out: refresh so the UI reflects reality.
        await reload();
        const body = await res.json().catch(() => ({}));
        if (body?.code === "sold_out") {
          setError("All founding memberships are claimed.");
        }
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
        description: order.description ?? "Layrrrd",
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
            // grant even if this confirmation call failed.
            console.error("Payment verification failed", err);
            setError(
              "Payment received. Your purchase is being activated, refresh in a minute.",
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
      console.error("Purchase failed", err);
      setError("Couldn't start the payment. Try again in a moment.");
      setStatus("idle");
    }
  }

  return { buy, status, error };
}
