"use client";

import { Check, FileText, Play, Podcast, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingDog } from "@/components/LoadingDog";
import type { ItemMedium } from "@/lib/types/knowledge-item";
import type { StarterListResponseItem } from "@/app/api/starter-lists/route";

const MEDIUM_ICONS: Record<ItemMedium, LucideIcon> = {
  article: FileText,
  video: Play,
  podcast: Podcast,
};

const MEDIUM_LABELS: Record<ItemMedium, string> = {
  article: "Read",
  video: "Watch",
  podcast: "Listen",
};

/**
 * Onboarding taste calibration: a dead-simple grid of curated content. Each
 * card is just an image and a title; tapping toggles selection. Selections
 * seed the recommendation engine.
 */
export function StarterPicksStep({
  items,
  picked,
  onToggle,
  loading,
  error,
  onRetry,
}: {
  items: StarterListResponseItem[];
  /** URLs of currently selected items. */
  picked: Set<string>;
  onToggle: (item: StarterListResponseItem) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="py-12">
        <LoadingDog label="Fetching good stuff…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the starter picks. You can retry, or just continue.
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No starter picks for these topics yet. You can continue, your feed
          will build up from your interests instead.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const active = picked.has(item.url);
        const Icon = MEDIUM_ICONS[item.medium] ?? FileText;
        return (
          <button
            key={item.url}
            type="button"
            onClick={() => onToggle(item)}
            aria-pressed={active}
            className={
              "group relative flex flex-col overflow-hidden border text-left transition-colors " +
              (active
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-foreground/30")
            }
          >
            <div className="relative aspect-[16/10] w-full bg-muted">
              {item.image ? (
                // Arbitrary external hosts, so a plain img beats next/image here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="size-8 text-muted-foreground/50" />
                </div>
              )}
              {active && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/50">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-5" />
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                {item.title}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon className="size-3" />
                {MEDIUM_LABELS[item.medium] ?? "Read"}
                {item.source ? <> · {item.source}</> : null}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
