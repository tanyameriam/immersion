"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingDog } from "@/components/LoadingDog";
import { DESIGN_ROLES } from "@/lib/constants";

/**
 * One-screen onboarding: name and role, then straight to the dashboard. The
 * dashboard takes over from there: the Recommended tab opens with the inline
 * interests picker, and the channel connect card offers Telegram and WhatsApp.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, hydrated, needsVerification } = useAuth();
  const { prefs, loaded, onboarded, save, markOnboarded } = usePreferences();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const prefilled = useRef(false);

  // Not signed in → back to the landing page. Already onboarded → straight to
  // the dashboard (no reason to re-run the one-time flow).
  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);
  // Onboarding writes to Firestore, which the rules now refuse for an
  // unconfirmed address. /dashboard owns the code step, so bounce there.
  useEffect(() => {
    if (needsVerification) router.replace("/dashboard");
  }, [needsVerification, router]);
  useEffect(() => {
    if (loaded && onboarded) router.replace("/dashboard");
  }, [loaded, onboarded, router]);

  // Prefill from the account and any values already on the profile, once.
  // Accounts without a display name fall back to the email in AuthContext;
  // never prefill the name field with an email address. A stored profession
  // outside the standard list means "Other" with a custom value.
  useEffect(() => {
    if (prefilled.current || !loaded || !user) return;
    prefilled.current = true;
    const candidate = prefs.name || user.name || "";
    setName(candidate.includes("@") ? "" : candidate);
    if (prefs.profession) {
      if (DESIGN_ROLES.includes(prefs.profession)) {
        setRole(prefs.profession);
      } else {
        setRole("Other");
        setCustomRole(prefs.profession);
      }
    }
  }, [loaded, user, prefs]);

  if (!hydrated || !user || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingDog label="Loading Layrrrd…" />
      </div>
    );
  }

  async function handleContinue() {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const profession =
        role === "Other" ? customRole.trim() || "Other" : role;
      await save({ name: name.trim(), profession });
      await markOnboarded();
      router.replace("/dashboard");
    } catch (err) {
      console.error("Failed to complete onboarding", err);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground">
          Welcome to Layrrrd
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Two quick things and you&apos;re in. Both are optional, and you can
          change them anytime in your profile.
        </p>

        <div className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="onb-name">What should we call you?</Label>
            <Input
              id="onb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleContinue();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onb-role">What do you do?</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v)}>
              <SelectTrigger id="onb-role" className="w-full">
                <SelectValue placeholder="Pick your role" />
              </SelectTrigger>
              <SelectContent>
                {DESIGN_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role === "Other" && (
              <Input
                aria-label="Tell us what you do"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Tell us what you do"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleContinue();
                }}
              />
            )}
          </div>
        </div>

        <Button
          className="mt-8 w-full"
          onClick={handleContinue}
          disabled={submitting}
        >
          {submitting ? "Setting up…" : "Continue to your dashboard"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </main>
  );
}
