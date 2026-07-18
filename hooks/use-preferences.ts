"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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

/** How often the digest goes out. Weekly is the maximum; there is
 * deliberately no daily option (testers were clear: low volume or uninstall). */
export type NotificationFrequency = "weekly" | "biweekly" | "off";

export interface Preferences {
  name: string;
  /** What the user does, free text (asked during onboarding). */
  profession: string;
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
  notificationFrequency: NotificationFrequency;
  /** Whether Rudolf may send fresh picks between digests on Telegram. */
  botNudges: "on" | "off";
  /** Billing plan. Read-only on the client; upgrades happen server-side. */
  plan: "free" | "pro";
}

const DEFAULTS: Preferences = {
  name: "",
  profession: "",
  profilePhoto: "",
  preferredTopics: [],
  dismissedUrls: [],
  mutedTopics: [],
  starterPicks: [],
  notificationPreference: "email",
  telegramChatId: "",
  whatsappWaId: "",
  notificationDay: "Monday",
  notificationFrequency: "weekly",
  botNudges: "on",
  plan: "free",
};

type PreferencesValue = {
  prefs: Preferences;
  loaded: boolean;
  onboarded: boolean;
  save: (partial: Partial<Preferences>) => Promise<void>;
  markOnboarded: () => Promise<void>;
  reload: () => Promise<void>;
};

/**
 * One profile read shared by every consumer. Preferences used to be fetched
 * per-component (dashboard, connect card, profile cards, auth gate), which
 * cost a full Firestore round trip each; the provider fetches once per
 * sign-in and everyone reads the same state.
 */
function usePreferencesState(): PreferencesValue {
  const { user, hydrated } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  /** (Re-)read the profile from Firestore — also used to notice server-side
   * writes like Telegram linking, which happen outside this hook. */
  const reload = useCallback(async () => {
    if (!user) return;
    try {
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
        profession: data.profession ?? "",
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
        // Docs written before this field existed default to weekly.
        notificationFrequency:
          data.notificationFrequency === "biweekly" ||
          data.notificationFrequency === "off"
            ? data.notificationFrequency
            : "weekly",
        botNudges: data.botNudges === "off" ? "off" : "on",
        plan: data.plan === "pro" ? "pro" : "free",
      });
      setOnboarded(Boolean(data.onboardedAt));
    } catch (err) {
      // If the profile can't be read (e.g. the client-only test session has
      // no Firestore access), don't trap the user behind loading screens or
      // onboarding — fall back to defaults and let them through.
      console.error("Failed to load preferences", err);
      setOnboarded(true);
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!hydrated || !user) return;
    void reload();
  }, [hydrated, user, reload]);

  const save = useCallback(
    async (partial: Partial<Preferences>) => {
      if (!user) return;
      // plan is server-managed; Firestore rules reject any client write that
      // touches it, so strip it before persisting.
      const { plan: _plan, ...toWrite } = partial;
      void _plan;
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
            ...toWrite,
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

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePreferencesState();
  return createElement(PreferencesContext.Provider, { value }, children);
}

/** Read/write the current user's profile preferences on `users/{uid}`. */
export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
