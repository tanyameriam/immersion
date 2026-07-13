"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

/**
 * Connect a Telegram account for digest delivery. Opens a one-time deep link
 * to the bot and shows a guided panel: users who already have Telegram just
 * tap Start, users who don't get install steps and a QR code to hand the
 * link to their phone. While waiting, nudges the server to process pending
 * updates (needed in local dev, harmless in production) and re-reads the
 * profile until the chat id appears.
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
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const linked = Boolean(chatId);

  useEffect(() => {
    if (!connecting || linked) return;
    const poll = setInterval(() => {
      void apiFetch("/api/telegram/poll", { method: "POST" }).catch(() => {});
      void refresh();
    }, 3000);
    // Stop waiting after 10 minutes (installing Telegram takes a while); the
    // link code itself is valid for 15, and the user can tap Connect again.
    const giveUp = setTimeout(() => setConnecting(false), 600_000);
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
      setLinkUrl(url);
      window.open(url, "_blank", "noopener");
      setConnecting(true);
    } catch (err) {
      console.error("Telegram connect failed", err);
      setError("Couldn't start Telegram linking, try again in a moment.");
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
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={connect}>
        <Send data-icon="inline-start" />
        {connecting ? "Waiting for Telegram…" : "Connect Telegram"}
      </Button>

      {connecting && linkUrl && (
        <div className="max-w-md space-y-4 rounded-lg border p-4 text-sm">
          <p className="text-foreground">
            <strong>Already have Telegram?</strong> Tap <strong>Start</strong>{" "}
            in the chat that just opened. This page updates by itself once
            you&apos;re connected.
          </p>

          <div className="space-y-3 border-t pt-4">
            <p className="text-foreground">
              <strong>New to Telegram?</strong> It&apos;s a free messaging
              app, and setup takes about two minutes:
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>
                Install Telegram on your phone: get it from the{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://apps.apple.com/app/telegram-messenger/id686449807"
                  target="_blank"
                  rel="noreferrer"
                >
                  App Store
                </a>{" "}
                (iPhone) or{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://play.google.com/store/apps/details?id=org.telegram.messenger"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Play
                </a>{" "}
                (Android).
              </li>
              <li>Open the app and sign up with your phone number.</li>
              <li className="max-sm:hidden">
                Scan the code below with your phone&apos;s camera, then tap{" "}
                <strong>Start</strong> in the chat that opens.
              </li>
              <li className="sm:hidden">
                Come back here and tap{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href={linkUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  open the bot
                </a>
                , then tap <strong>Start</strong> in the chat.
              </li>
            </ol>
            <div className="w-fit rounded-md border bg-white p-3 max-sm:hidden">
              <QRCode value={linkUrl} size={128} />
            </div>
            <p className="text-muted-foreground">
              Prefer your laptop? Install{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://telegram.org/apps"
                target="_blank"
                rel="noreferrer"
              >
                Telegram for desktop
              </a>
              , sign in, then tap Connect Telegram again.
            </p>
            <p className="text-xs text-muted-foreground">
              This connect link works for 15 minutes. If it expires, just tap
              Connect Telegram again for a fresh one.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
