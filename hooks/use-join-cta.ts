"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

/** Signed-in users go to their dashboard; everyone else hits sign-up. */
export function useJoinCta() {
  const { user, openAuth } = useAuth();
  const router = useRouter();

  return () => (user ? router.push("/dashboard") : openAuth("sign-up"));
}
