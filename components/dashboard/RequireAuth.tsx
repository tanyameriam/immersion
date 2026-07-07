"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { LoadingDog } from "@/components/LoadingDog";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hydrated, openAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) {
      openAuth("sign-in");
      router.replace("/");
    }
  }, [hydrated, user, openAuth, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[72px]">
        <LoadingDog label={hydrated ? "Redirecting…" : "Loading Layrrrd…"} />
      </div>
    );
  }

  return <>{children}</>;
}
