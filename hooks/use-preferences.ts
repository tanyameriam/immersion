"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/AuthContext";

export type NotificationPreference = "email" | "telegram";

export interface Preferences {
  name: string;
  profilePhoto: string;
  preferredTopics: string[];
  /** Recommendation feedback: links marked "Not interested" (never suggested
   * again) and topics the user hid from recommendations entirely. */
  dismissedUrls: string[];
  mutedTopics: string[];
  notificationPreference: NotificationPreference;
  telegramChatId: string;
  notificationDay: string; // "Monday" … "Sunday"
}

const DEFAULTS: Preferences = {
  name: "",
  profilePhoto: "",
  preferredTopics: [],
  dismissedUrls: [],
  mutedTopics: [],
  notificationPreference: "email",
  telegramChatId: "",
  notificationDay: "Monday",
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
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data() ?? {};
    setPrefs({
      name: data.name ?? user.name ?? "",
      profilePhoto: data.profilePhoto ?? user.photoURL ?? "",
      preferredTopics: data.preferredTopics ?? [],
      dismissedUrls: data.dismissedUrls ?? [],
      mutedTopics: data.mutedTopics ?? [],
      notificationPreference:
        (data.notificationPreference as NotificationPreference) ?? "email",
      telegramChatId: data.telegramChatId ?? "",
      notificationDay: data.notificationDay ?? "Monday",
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
          { ...partial, updatedAt: serverTimestamp() },
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
