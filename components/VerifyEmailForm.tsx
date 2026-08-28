"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthContext";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

/** Friendly copy for the reasons the two verification endpoints return. */
function messageFor(reason: string): string {
  switch (reason) {
    case "invalid":
      return "That code isn't right. Check the email and try again.";
    case "expired":
      return "That code has expired. Send yourself a fresh one.";
    case "locked":
      return "Too many wrong tries. Send a new code to start over.";
    case "no_code":
      return "We don't have a code for you right now. Send a new one.";
    case "cooldown":
    case "rate_limited":
      return "Hold on a moment before asking for another code.";
    case "send_failed":
      return "We couldn't send that email. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * The confirm-your-email step. Shown straight after a password signup and as
 * the gate on protected pages, so someone who closes the modal still lands
 * back here rather than getting into a half-usable dashboard.
 */
export function VerifyEmailForm({ onVerified }: { onVerified?: () => void }) {
  const { user, verifyEmailCode, sendVerificationCode, logout } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // A code was just mailed on signup, so start the resend timer already running.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await verifyEmailCode(code);
      onVerified?.();
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : ""));
      setCode("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendVerificationCode();
      setNotice("New code sent. Check your inbox.");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(messageFor(err instanceof Error ? err.message : ""));
      setCooldown(RESEND_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        We sent a {CODE_LENGTH}-digit code to{" "}
        <span className="font-medium text-foreground">{user?.email}</span>.
        Enter it below to finish setting up your account.
      </p>

      <div className="space-y-2">
        <Label htmlFor="verify-code">Verification code</Label>
        <Input
          id="verify-code"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
            setError(null);
          }}
          placeholder="123456"
          className="text-center text-xl tracking-[0.5em]"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Button
        type="submit"
        disabled={busy || code.length !== CODE_LENGTH}
        className="w-full"
      >
        {busy ? "Checking…" : "Verify email"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || busy}
          className="text-foreground underline underline-offset-4 disabled:no-underline disabled:opacity-60"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
        </button>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Wrong address?{" "}
        <button
          type="button"
          onClick={logout}
          className="underline underline-offset-4"
        >
          Sign out and start again
        </button>
      </p>
    </form>
  );
}
