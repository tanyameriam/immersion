"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

/**
 * Connect a Telegram account for digest delivery. Opens a one-time deep link
 * to the bot; while waiting for the user to tap Start, nudges the server to
 * process pending updates (needed in local dev, harmless in production) and
 * re-reads the profile until the chat id appears.
 */
export function TelegramConnect({
  chatId,
  refresh,
  onDisconnect,
}: {
  /** Current linked chat id ("" when not linked). */
  chatId: string;
  /** Re-read the profile from Firestore to notice a completed link. */
  refresh: () => void | Promise<void>;
  onDisconnect: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const linked = Boolean(chatId);

  useEffect(() => {
    if (!connecting || linked) return;
    const poll = setInterval(() => {
      void apiFetch("/api/telegram/poll", { method: "POST" }).catch(() => {});
      void refresh();
    }, 3000);
    // Stop waiting after 2 minutes; the user can tap Connect again.
    const giveUp = setTimeout(() => setConnecting(false), 120_000);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [connecting, linked, refresh]);

  useEffect(() => {
    if (linked) setConnecting(false);
  }, [linked]);

  async function connect() {
    setError("");
    try {
      const res = await apiFetch("/api/telegram/link", { method: "POST" });
      if (!res.ok) throw new Error(`link failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener");
      setConnecting(true);
    } catch (err) {
      console.error("Telegram connect failed", err);
      setError("Couldn't start Telegram linking — try again in a moment.");
    }
  }

  if (linked) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <CheckCircle2 className="size-4" />
          Telegram connected
        </p>
        <Button size="sm" variant="ghost" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={connect}>
        <Send data-icon="inline-start" />
        {connecting ? "Waiting for Telegram…" : "Connect Telegram"}
      </Button>
      {connecting && (
        <p className="text-sm text-muted-foreground">
          Tap <strong>Start</strong> in the Telegram chat that just opened —
          this page updates automatically once you&apos;re connected.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
