"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthContext";

/**
 * Real authentication panel — Google sign-in via Firebase. Replaces the former
 * mock email/password forms. Both the Sign In and Sign Up tabs render this
 * (Google treats new and returning accounts identically), so the friend's
 * tabbed AuthModal UI is preserved while the auth itself is real.
 */
export function GoogleAuthPanel({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { signInWithGoogle } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setStatus("submitting");
    setError(null);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Sign-in was cancelled or failed. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        className="w-full"
        onClick={handleGoogle}
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Opening Google…" : "Continue with Google"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-in"
          ? "Sign in with your Google account to reach your dashboard."
          : "Create your Layrrrd account instantly with Google."}
      </p>
    </div>
  );
}
