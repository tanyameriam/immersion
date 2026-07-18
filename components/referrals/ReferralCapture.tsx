"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { storeReferralCode } from "@/lib/referrals/client";

export function ReferralCapture() {
  const { user, hydrated, openAuth } = useAuth();

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    const code = new URLSearchParams(window.location.search).get("ref");
    if (!code) return;

    storeReferralCode(code);
    if (!user) openAuth("sign-up");
  }, [hydrated, openAuth, user]);

  return null;
}
