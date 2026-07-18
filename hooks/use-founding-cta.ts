"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { useRazorpayCheckout } from "@/hooks/use-razorpay-checkout";

/**
 * The "Become a Founding Member" action: signed-out visitors sign up first
 * (then click again once signed in), members-already go to their dashboard,
 * and signed-in free users get the Razorpay checkout right here.
 */
export function useFoundingCta() {
  const { user, openAuth } = useAuth();
  const { prefs } = usePreferences();
  const { buy, status, error } = useRazorpayCheckout();
  const router = useRouter();

  const join = () => {
    if (!user) {
      openAuth("sign-up");
      return;
    }
    if (prefs.plan === "pro") {
      router.push("/dashboard");
      return;
    }
    void buy({ product: "founding" });
  };

  return { join, busy: status === "opening" || status === "verifying", error };
}
