"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthContext";
import { authErrorMessage } from "@/lib/auth-errors";
import { getStoredReferral } from "@/lib/referrals/client";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

export function SignInForm() {
  const { mode, setMode, signInWithEmail, signUpWithEmail, signInWithGoogle } =
    useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "google">("idle");
  const [referralCode, setReferralCode] = useState("");

  const signingUp = mode === "sign-up";

  useEffect(() => {
    setReferralCode(getStoredReferral()?.code ?? "");
  }, [signingUp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const result = signingUp
        ? await signUpWithEmail(name.trim(), email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      // Unverified accounts stay put: the modal swaps to the code step rather
      // than dropping them on a dashboard they can't use yet.
      if (!result.verified) {
        setStatus("idle");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
      setStatus("idle");
    }
  }

  async function handleGoogle() {
    setStatus("google");
    setError(null);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {signingUp && (
        <div className="space-y-2">
          <Label htmlFor="signin-name">Name</Label>
          <Input
            id="signin-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
      )}

      {signingUp && referralCode && (
        <div className="space-y-2">
          <Label htmlFor="signin-referral">Referral Code</Label>
          <Input id="signin-referral" value={referralCode} readOnly />
          <p className="text-xs text-muted-foreground">
            This code was added automatically from the referral link.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="signin-email">Email Address</Label>
        <Input
          id="signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {signingUp && (
          <p className="text-xs text-muted-foreground">
            At least 6 characters.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={status !== "idle"} className="w-full">
        {status === "submitting"
          ? signingUp
            ? "Creating account…"
            : "Signing in…"
          : signingUp
            ? "Create Account"
            : "Sign In"}
      </Button>

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">OR</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-3 border-[#dadce0] text-[#3c4043] hover:bg-[#f7f8f8]"
        onClick={handleGoogle}
        disabled={status !== "idle"}
      >
        <GoogleIcon className="h-4 w-4" />
        {status === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {signingUp ? "Already have an account?" : "Don't have an account yet?"}{" "}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(signingUp ? "sign-in" : "sign-up");
          }}
          className="text-foreground underline underline-offset-4"
        >
          {signingUp ? "Sign in" : "Create one"}
        </button>
      </p>
    </form>
  );
}
