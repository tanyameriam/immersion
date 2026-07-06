"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthContext";

export type NotificationPreference = "email" | "telegram";

export interface Preferences {
  name: string;
  preferredTopics: string[];
  notificationPreference: NotificationPreference;
  telegramChatId: string;
}

const DEFAULTS: Preferences = {
  name: "",
  preferredTopics: [],
  notificationPreference: "email",
  telegramChatId: "",
};

/**
 * Read/write the current user's profile preferences on `users/{uid}`. Security
 * rules allow a user to write their own profile, so this persists directly from
 * the client — the same fields the weekly-digest job reads server-side.
 */
export function usePreferences() {
  const { user, hydrated } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    (async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() ?? {};
      if (cancelled) return;
      setPrefs({
        name: data.name ?? user.name ?? "",
        preferredTopics: data.preferredTopics ?? [],
        notificationPreference:
          (data.notificationPreference as NotificationPreference) ?? "email",
        telegramChatId: data.telegramChatId ?? "",
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  const save = useCallback(
    async (partial: Partial<Preferences>) => {
      if (!user) return;
      setPrefs((prev) => ({ ...prev, ...partial }));
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

  return { prefs, loaded, save };
}
