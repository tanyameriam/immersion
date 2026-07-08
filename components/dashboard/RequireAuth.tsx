"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthContext";
import { LoadingDog } from "@/components/LoadingDog";

/** null = not yet checked, true/false = whether the user finished onboarding. */
type OnboardStatus = boolean | null;

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hydrated, openAuth } = useAuth();
  const router = useRouter();
  const [onboarded, setOnboarded] = useState<OnboardStatus>(null);

  useEffect(() => {
    if (hydrated && !user) {
      openAuth("sign-in");
      router.replace("/");
    }
  }, [hydrated, user, openAuth, router]);

  // First-time users haven't captured their interests yet — send them through
  // onboarding before they reach the dashboard.
  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!cancelled) setOnboarded(Boolean(snap.data()?.onboardedAt));
      } catch {
        // If we can't read the profile (e.g. the client-only test session has
        // no Firestore access), don't trap the user — let them through.
        if (!cancelled) setOnboarded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  useEffect(() => {
    if (onboarded === false) router.replace("/onboarding");
  }, [onboarded, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[72px]">
        <LoadingDog label={hydrated ? "Redirecting…" : "Loading Layrrrd…"} />
      </div>
    );
  }

  if (onboarded !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[72px]">
        <LoadingDog label="Loading Layrrrd…" />
      </div>
    );
  }

  return <>{children}</>;
}
