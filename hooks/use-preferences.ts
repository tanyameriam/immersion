"use client";

import { useCallback, useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  waitForPendingWrites,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/AuthContext";
import type { StarterPick } from "@/lib/types/starter-list";

export type NotificationPreference = "email" | "telegram";

export interface Preferences {
  name: string;
  profilePhoto: string;
  preferredTopics: string[];
  /** Recommendation feedback: links marked "Not interested" (never suggested
   * again) and topics the user hid from recommendations entirely. */
  dismissedUrls: string[];
  mutedTopics: string[];
  /** Curated items picked during onboarding; seeds the recommendation engine. */
  starterPicks: StarterPick[];
  notificationPreference: NotificationPreference;
  telegramChatId: string;
  /** WhatsApp sender id (phone-shaped) captured when the user links Rudolf. */
  whatsappWaId: string;
  notificationDay: string; // "Monday" … "Sunday"
  /** Whether Rudolf may send fresh picks between digests on Telegram. */
  botNudges: "on" | "off";
}

const DEFAULTS: Preferences = {
  name: "",
  profilePhoto: "",
  preferredTopics: [],
  dismissedUrls: [],
  mutedTopics: [],
  starterPicks: [],
  notificationPreference: "email",
  telegramChatId: "",
  whatsappWaId: "",
  notificationDay: "Monday",
  botNudges: "on",
};

/**
 * Read/write the current user's profile preferences on `users/{uid}`. Security
 * rules allow a user to write their own profile, so this persists directly from
 * the client - the same fields the weekly-digest job reads server-side.
 */
export function usePreferences() {
  const { user, hydrated } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  /** (Re-)read the profile from Firestore — also used to notice server-side
   * writes like Telegram linking, which happen outside this hook. */
  const reload = useCallback(async () => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    let snap = await getDoc(ref);
    // While a write is pending (e.g. the sign-in profile upsert), the SDK's
    // local view of the doc can hide server-only fields like onboardedAt.
    // Wait for writes to settle so we read the full profile.
    if (snap.metadata.hasPendingWrites) {
      await waitForPendingWrites(db);
      snap = await getDoc(ref);
    }
    const data = snap.data() ?? {};
    setPrefs({
      name: data.name ?? user.name ?? "",
      profilePhoto: data.profilePhoto ?? user.photoURL ?? "",
      preferredTopics: data.preferredTopics ?? [],
      dismissedUrls: data.dismissedUrls ?? [],
      mutedTopics: data.mutedTopics ?? [],
      starterPicks: data.starterPicks ?? [],
      notificationPreference:
        (data.notificationPreference as NotificationPreference) ?? "email",
      telegramChatId: data.telegramChatId ?? "",
      whatsappWaId: data.whatsappWaId ?? "",
      notificationDay: data.notificationDay ?? "Monday",
      botNudges: data.botNudges === "off" ? "off" : "on",
    });
    setOnboarded(Boolean(data.onboardedAt));
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!hydrated || !user) return;
    void reload();
  }, [hydrated, user, reload]);

  const save = useCallback(
    async (partial: Partial<Preferences>) => {
      if (!user) return;
      setPrefs((prev) => ({ ...prev, ...partial }));
      // Every interests change funnels through here (onboarding, profile,
      // like/mute on recommendation cards), so this one event tracks how
      // stated interests evolve.
      if (partial.preferredTopics) {
        track("interests_updated", {
          topics: partial.preferredTopics,
          count: partial.preferredTopics.length,
        });
      }
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            ...partial,
            ...(partial.starterPicks ? { starterPicksAt: serverTimestamp() } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to save preferences", err);
      }
    },
    [user],
  );

  /** Mark onboarding complete, so first-run gating doesn't fire again. */
  const markOnboarded = useCallback(async () => {
    if (!user) return;
    setOnboarded(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { onboardedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (err) {
      console.error("Failed to mark onboarded", err);
    }
  }, [user]);

  return { prefs, loaded, onboarded, save, markOnboarded, reload };
}
