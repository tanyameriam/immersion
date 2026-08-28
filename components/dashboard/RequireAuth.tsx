"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { LoadingDog } from "@/components/LoadingDog";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hydrated, openAuth, needsVerification } = useAuth();
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
    if (needsVerification) return;
    if (loaded && !onboarded) router.replace("/onboarding");
  }, [needsVerification, loaded, onboarded, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[72px]">
        <LoadingDog label={hydrated ? "Redirecting…" : "Loading Layrrrd…"} />
      </div>
    );
  }

  // Signed in but unconfirmed: the code step replaces the page entirely. The
  // API and the Firestore rules refuse this session anyway, so rendering the
  // dashboard would only show a broken one.
  if (needsVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 pt-[72px]">
        <div className="w-full max-w-md">
          <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-foreground">
            Confirm your email.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One quick step before you start.
          </p>
          <div className="mt-6">
            <VerifyEmailForm />
          </div>
        </div>
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
