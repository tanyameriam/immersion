"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { LoadingDog } from "@/components/LoadingDog";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hydrated, openAuth } = useAuth();
  // Onboarding state rides the shared preferences read - no extra Firestore
  // round trip just for the gate (this used to re-fetch the same doc).
  const { loaded, onboarded } = usePreferences();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) {
      openAuth("sign-in");
      router.replace("/");
    }
  }, [hydrated, user, openAuth, router]);

  // First-time users haven't finished setup yet — send them through
  // onboarding before they reach the dashboard.
  useEffect(() => {
    if (loaded && !onboarded) router.replace("/onboarding");
  }, [loaded, onboarded, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[72px]">
        <LoadingDog label={hydrated ? "Redirecting…" : "Loading Layrrrd…"} />
      </div>
    );
  }

  if (!loaded || !onboarded) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[72px]">
        <LoadingDog label="Loading Layrrrd…" />
      </div>
    );
  }

  return <>{children}</>;
}
