"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

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
    return <div className="min-h-screen pt-[72px]" />;
  }

  return <>{children}</>;
}
