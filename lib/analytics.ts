"use client";

import posthog from "posthog-js";

/**
 * Thin wrapper around PostHog so components never import it directly. Without
 * NEXT_PUBLIC_POSTHOG_KEY every function is a silent no-op, so local dev and
 * preview deploys send nothing.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

const enabled = () => Boolean(KEY) && typeof window !== "undefined";

export function initAnalytics() {
  if (!enabled() || posthog.__loaded) return;
  posthog.init(KEY!, {
    api_host: HOST,
    // Route changes are client-side in the App Router; the <Analytics />
    // component captures pageviews itself on every navigation.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
  });
}

export function trackPageview(url: string) {
  if (!enabled()) return;
  posthog.capture("$pageview", { $current_url: url });
}

/** Tie events to the signed-in account, same id as Firestore's users/{uid}. */
export function identifyUser(uid: string, props: { email?: string; name?: string }) {
  if (!enabled()) return;
  posthog.identify(uid, props);
}

export function resetAnalytics() {
  if (!enabled()) return;
  posthog.reset();
}

/** Product events. Keep names snake_case and stable; dashboards break on renames. */
export function track(
  event:
    | "link_saved"
    | "recommendation_bookmarked"
    | "recommendation_liked"
    | "recommendation_dismissed"
    | "topic_muted"
    | "interests_updated"
    | "starter_picks_selected"
    | "onboarding_skipped"
    | "tab_viewed"
    | "feedback_submitted",
  props?: Record<string, unknown>,
) {
  if (!enabled()) return;
  posthog.capture(event, props);
}
