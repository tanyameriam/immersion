"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { ProfilePreview } from "@/components/onboarding/ProfilePreview";
import { StarterPicksStep } from "@/components/onboarding/StarterPicksStep";
import { TelegramConnect } from "@/components/TelegramConnect";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingDog } from "@/components/LoadingDog";
import { INTEREST_GROUPS, isTopicAvailable, slugify } from "@/lib/constants";
import { apiFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import type { StarterPick } from "@/lib/types/starter-list";
import type { StarterListResponseItem } from "@/app/api/starter-lists/route";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STEPS = [
  "Name",
  "Email",
  "Photo",
  "Interests",
  "Starter picks",
  "Delivery",
] as const;

/** How many starter picks we nudge for (soft minimum, never blocks). */
const PICKS_SOFT_MIN = 3;

/** Center-crop an uploaded image to a small square JPEG data URL, so the
 * avatar can live directly on the profile document (no file storage needed). */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const { prefs, loaded, onboarded, save, markOnboarded, reload } =
    usePreferences();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  // The avatar to save: the Google account photo by default, an uploaded
  // image (as a data URL), or null to fall back to the name's initials.
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<"email" | "telegram">("telegram");
  const [day, setDay] = useState("Monday");
  const [submitting, setSubmitting] = useState(false);
  const prefilled = useRef(false);

  // Starter picks (taste calibration). The fetched union is keyed by the
  // sorted topic slugs, so going back and changing topics refetches and prunes
  // picks, while an unchanged back/forward pass reuses everything.
  const [starterItems, setStarterItems] = useState<StarterListResponseItem[]>([]);
  const [starterKey, setStarterKey] = useState("");
  const [starterLoading, setStarterLoading] = useState(false);
  const [starterError, setStarterError] = useState(false);
  const [picks, setPicks] = useState<Map<string, StarterPick>>(new Map());
  const starterFetchSeq = useRef(0);

  const topicsKey = useMemo(
    () =>
      [...topics]
        .map((t) => slugify(t))
        .sort()
        .join(","),
    [topics],
  );

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
    setPhoto(prefs.profilePhoto || user.photoURL || null);
    if (prefs.preferredTopics.length) {
      // Drop topics that are no longer selectable (design-first for now).
      setTopics(new Set(prefs.preferredTopics.filter(isTopicAvailable)));
    }
    setChannel(prefs.notificationPreference);
    setDay(prefs.notificationDay);
  }, [loaded, user, prefs]);

  // Load the starter lists for the selected topics. Called when the user
  // leaves the Interests step (prefetch) and when landing on the picks step
  // with a stale key (back-navigation after changing topics).
  async function loadStarterItems(key: string) {
    const seq = ++starterFetchSeq.current;
    setStarterKey(key);
    setStarterError(false);
    if (!key) {
      setStarterItems([]);
      setPicks(new Map());
      return;
    }
    setStarterLoading(true);
    try {
      const res = await apiFetch(`/api/starter-lists?topics=${key}`);
      if (!res.ok) throw new Error(`starter-lists ${res.status}`);
      const data = (await res.json()) as { items: StarterListResponseItem[] };
      if (seq !== starterFetchSeq.current) return; // superseded by a newer fetch
      const items = data.items ?? [];
      setStarterItems(items);
      // Keep only picks still present in the new union (topic was deselected).
      setPicks((prev) => {
        const urls = new Set(items.map((i) => i.url));
        const next = new Map<string, StarterPick>();
        for (const [url, pick] of prev) if (urls.has(url)) next.set(url, pick);
        return next;
      });
    } catch (err) {
      console.error("Failed to load starter lists", err);
      if (seq === starterFetchSeq.current) setStarterError(true);
    } finally {
      if (seq === starterFetchSeq.current) setStarterLoading(false);
    }
  }

  const starterStep = STEPS.indexOf("Starter picks");
  useEffect(() => {
    if (step === starterStep && topicsKey !== starterKey && !starterLoading) {
      void loadStarterItems(topicsKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, topicsKey, starterKey, starterLoading]);

  const previewState = useMemo(
    () => ({
      name,
      email: user?.email ?? "",
      photo,
      topics: [...topics],
      channel,
      telegramLinked: Boolean(prefs.telegramChatId),
      day,
    }),
    [name, user?.email, photo, topics, channel, prefs.telegramChatId, day],
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setPhoto(await fileToAvatarDataUrl(file));
    } catch (err) {
      console.error("Failed to read uploaded photo", err);
    }
  }

  function togglePick(item: StarterListResponseItem) {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.has(item.url)) {
        next.delete(item.url);
      } else {
        next.set(item.url, {
          id: item.id,
          topicSlug: item.topicSlug,
          title: item.title,
          url: item.url,
          medium: item.medium,
          source: item.source,
        });
      }
      return next;
    });
  }

  async function handleFinish() {
    if (!user) return;
    setSubmitting(true);
    try {
      track("starter_picks_selected", { count: picks.size });
      await save({
        name: name.trim() || user.name,
        profilePhoto: photo ?? "",
        preferredTopics: [...topics],
        starterPicks: [...picks.values()],
        notificationPreference: channel,
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
                title="Your profile photo"
                subtitle={
                  user.photoURL
                    ? "We start with your Google photo — keep it, upload your own, or remove it to use your initials."
                    : "Optional — upload a photo, or we'll use your initials."
                }
              >
                <div className="flex items-center gap-6">
                  <Avatar size="lg" className="size-20">
                    {photo ? <AvatarImage src={photo} alt={name} /> : null}
                    <AvatarFallback className="text-lg">
                      {(name || user.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {photo === null
                        ? "No photo — we'll show your initials."
                        : photo === user.photoURL
                          ? "From your Google account."
                          : "Your uploaded photo."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload data-icon="inline-start" />
                        Upload photo
                      </Button>
                      {user.photoURL && photo !== user.photoURL && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPhoto(user.photoURL)}
                        >
                          Use Google photo
                        </Button>
                      )}
                      {photo && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPhoto(null)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                title="What are you into?"
                subtitle="Pick a few topics — we'll use these to recommend things worth your time."
              >
                <div className="space-y-6">
                  {INTEREST_GROUPS.map((group) => (
                    <div key={group.label} className="space-y-2.5">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.topics.map((topic) => {
                          const active = topics.has(topic);
                          const available = isTopicAvailable(topic);
                          if (!available) {
                            return (
                              <Tooltip key={topic}>
                                <TooltipTrigger
                                  type="button"
                                  aria-disabled
                                  className="inline-flex cursor-not-allowed items-center gap-1.5 border border-border px-3 py-1.5 text-sm text-muted-foreground/50"
                                >
                                  {topic}
                                </TooltipTrigger>
                                <TooltipContent>Coming soon</TooltipContent>
                              </Tooltip>
                            );
                          }
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
                    </div>
                  ))}
                </div>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell
                title="Pick what looks good"
                subtitle="Tap the ones you would read, watch or listen to. We use them to build your feed."
              >
                <div className="space-y-4">
                  <StarterPicksStep
                    items={starterItems}
                    picked={new Set(picks.keys())}
                    onToggle={togglePick}
                    loading={starterLoading}
                    error={starterError}
                    onRetry={() => void loadStarterItems(topicsKey)}
                  />
                  {!starterLoading && !starterError && starterItems.length > 0 && (
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      {picks.size === 0
                        ? `Pick at least ${PICKS_SOFT_MIN} for a better feed.`
                        : picks.size < PICKS_SOFT_MIN
                          ? `${picks.size} picked. A few more makes your feed sharper.`
                          : `${picks.size} picked. Nice taste.`}
                    </p>
                  )}
                </div>
              </StepShell>
            )}

            {step === 5 && (
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
                    <TelegramConnect
                      chatId={prefs.telegramChatId}
                      refresh={reload}
                      onDisconnect={() => void save({ telegramChatId: "" })}
                    />
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
                onClick={() => {
                  // Leaving Interests: prefetch the starter lists so the next
                  // step usually renders instantly.
                  if (STEPS[step] === "Interests" && topicsKey !== starterKey) {
                    void loadStarterItems(topicsKey);
                  }
                  setStep((s) => Math.min(STEPS.length - 1, s + 1));
                }}
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
