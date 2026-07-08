"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { ProfilePreview } from "@/components/onboarding/ProfilePreview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingDog } from "@/components/LoadingDog";
import { RECOMMENDATION_INTERESTS } from "@/lib/constants";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STEPS = ["Name", "Email", "Photo", "Interests", "Delivery"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const { prefs, loaded, onboarded, save, markOnboarded } = usePreferences();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<"email" | "telegram">("telegram");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [day, setDay] = useState("Monday");
  const [submitting, setSubmitting] = useState(false);
  const prefilled = useRef(false);

  // Not signed in → back to the landing page. Already onboarded → straight to
  // the dashboard (no reason to re-run the one-time flow).
  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);
  useEffect(() => {
    if (loaded && onboarded) router.replace("/dashboard");
  }, [loaded, onboarded, router]);

  // Prefill from the account + any values already on the profile, once.
  useEffect(() => {
    if (prefilled.current || !loaded || !user) return;
    prefilled.current = true;
    setName(prefs.name || user.name || "");
    setKeepPhoto(Boolean(user.photoURL));
    if (prefs.preferredTopics.length) setTopics(new Set(prefs.preferredTopics));
    setChannel(prefs.notificationPreference);
    setTelegramHandle(prefs.telegramChatId);
    setDay(prefs.notificationDay);
  }, [loaded, user, prefs]);

  const photo = keepPhoto ? user?.photoURL ?? null : null;
  const previewState = useMemo(
    () => ({
      name,
      email: user?.email ?? "",
      photo,
      topics: [...topics],
      channel,
      telegramHandle,
      day,
    }),
    [name, user?.email, photo, topics, channel, telegramHandle, day],
  );

  if (!hydrated || !user || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingDog label="Loading Layrrrd…" />
      </div>
    );
  }

  function toggleTopic(topic: string) {
    setTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  async function handleFinish() {
    if (!user) return;
    setSubmitting(true);
    try {
      await save({
        name: name.trim() || user.name,
        profilePhoto: keepPhoto ? user.photoURL ?? "" : "",
        preferredTopics: [...topics],
        notificationPreference: channel,
        telegramChatId: telegramHandle.trim(),
        notificationDay: day,
      });
      await markOnboarded();
      router.replace("/dashboard");
    } catch (err) {
      console.error("Failed to complete onboarding", err);
      setSubmitting(false);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-16 px-6 py-16 md:px-10 lg:grid-cols-[1fr_auto] lg:items-center">
        {/* Steps */}
        <div className="w-full max-w-lg">
          <p className="text-[13px] uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>

          <div className="mt-8 min-h-[280px]">
            {step === 0 && (
              <StepShell
                title="What should we call you?"
                subtitle="This is the name we'll greet you with across Layrrrd."
              >
                <div className="space-y-2">
                  <Label htmlFor="onb-name">Name</Label>
                  <Input
                    id="onb-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                  />
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell
                title="Confirm your email"
                subtitle="This is the account you signed up with — where account updates go."
              >
                <div className="space-y-2">
                  <Label htmlFor="onb-email">Email</Label>
                  <Input id="onb-email" value={user.email} readOnly disabled />
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                title="Add a profile photo"
                subtitle="Optional — you can always change this later in settings."
              >
                <div className="flex items-center gap-6">
                  <Avatar size="lg" className="size-16">
                    {photo ? <AvatarImage src={photo} alt={name} /> : null}
                    <AvatarFallback>
                      {(name || user.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.photoURL ? (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        size="sm"
                        variant={keepPhoto ? "default" : "outline"}
                        onClick={() => setKeepPhoto(true)}
                      >
                        Use this photo
                      </Button>
                      <Button
                        size="sm"
                        variant={keepPhoto ? "outline" : "default"}
                        onClick={() => setKeepPhoto(false)}
                      >
                        Skip for now
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No photo from your account — you can add one later in
                      settings.
                    </p>
                  )}
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                title="What are you into?"
                subtitle="Pick a few topics — we'll use these to recommend things worth your time."
              >
                <div className="flex flex-wrap gap-2">
                  {RECOMMENDATION_INTERESTS.map((topic) => {
                    const active = topics.has(topic);
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        aria-pressed={active}
                        className={
                          "inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors " +
                          (active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:bg-muted")
                        }
                      >
                        {active && <Check className="size-3.5" />}
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell
                title="When do you usually read?"
                subtitle="Pick the day you want your weekly digest. We send it that morning at 8:00 AM UTC."
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Where should we send it?</Label>
                    <RadioGroup
                      value={channel}
                      onValueChange={(v) => setChannel(v as "email" | "telegram")}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="telegram" id="onb-telegram" />
                        <Label htmlFor="onb-telegram">Telegram</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="email" id="onb-email-channel" />
                        <Label htmlFor="onb-email-channel">Email</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {channel === "telegram" && (
                    <div className="space-y-2">
                      <Label htmlFor="onb-telegram-handle">Telegram username</Label>
                      <Input
                        id="onb-telegram-handle"
                        value={telegramHandle}
                        onChange={(e) => setTelegramHandle(e.target.value)}
                        placeholder="@username"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="onb-day">Delivery day</Label>
                    <Select value={day} onValueChange={(v) => v && setDay(v)}>
                      <SelectTrigger id="onb-day" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll send your digest every {day} at 8:00 AM UTC.
                    </p>
                  </div>
                </div>
              </StepShell>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>

            {isLast ? (
              <Button size="sm" onClick={handleFinish} disabled={submitting}>
                {submitting ? "Finishing…" : "Finish"}
                <Check className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="hidden lg:block">
          <ProfilePreview state={previewState} />
        </div>
      </div>
    </main>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
