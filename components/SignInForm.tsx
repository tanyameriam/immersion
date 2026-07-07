"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthContext";
import { authErrorMessage } from "@/lib/auth-errors";

export function SignInForm() {
  const { setMode, signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "google">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={status !== "idle"} className="w-full">
        {status === "submitting" ? "Signing in…" : "Sign In"}
      </Button>

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">OR</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={status !== "idle"}
      >
        {status === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className="text-foreground underline underline-offset-4"
        >
          Sign Up
        </button>
      </p>
    </form>
  );
}
