"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openFeedback } from "@/components/FeedbackWidget";
import { INTEREST_GROUPS, isTopicAvailable } from "@/lib/constants";

/** How many topic picks we nudge for (soft minimum, never blocks). */
const TOPICS_SOFT_MIN = 3;

/**
 * Inline interests picker shown in the Recommended tab when the user hasn't
 * picked any topics yet (new users land here straight from the one-screen
 * onboarding). Saving builds their feed in place, no detour to the profile.
 */
export function InterestsPicker({
  onSave,
}: {
  onSave: (topics: string[]) => Promise<void> | void;
}) {
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleTopic(topic: string) {
    setTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  async function handleSave() {
    if (topics.size === 0 || saving) return;
    setSaving(true);
    try {
      await onSave([...topics]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-dashed border-border px-6 py-10 sm:px-10">
      <h2 className="text-2xl font-bold tracking-[-0.02em] text-foreground">
        Tell us what you&apos;re into
      </h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Pick a few topics and we&apos;ll build your feed from them. You can
        change these anytime in your profile.
      </p>

      <div className="mt-8 space-y-4">
        {INTEREST_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
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

      <p className="mt-6 text-sm text-muted-foreground">
        More topics are added as Layrrrd grows. Missing one you care about?{" "}
        <button
          type="button"
          onClick={openFeedback}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Tell us in the feedback form
        </button>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={handleSave} disabled={topics.size === 0 || saving}>
          {saving ? "Building your feed…" : "Build my feed"}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {topics.size === 0
            ? `Pick at least ${TOPICS_SOFT_MIN} for a better feed.`
            : topics.size < TOPICS_SOFT_MIN
              ? `${topics.size} picked. A few more makes your feed sharper.`
              : `${topics.size} picked. Nice taste.`}
        </p>
      </div>
    </div>
  );
}
