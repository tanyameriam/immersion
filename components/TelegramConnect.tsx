"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import QRCode from "react-qr-code";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Connect a Telegram account for digest delivery. Clicking Connect opens a
 * modal with a QR code for the one-time deep link: scanning it on a phone
 * opens the bot in Telegram (or, without Telegram installed, lands on the
 * t.me page that offers the app stores). Deliberately does NOT auto-open
 * the t.me tab: that steals focus and strands users without Telegram on a
 * "download Telegram" page instead of this guidance. While waiting, nudges
 * the server to process pending updates (needed in local dev, harmless in
 * production) and re-reads the profile until the chat id appears.
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
  const [open, setOpen] = useState(false);
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
    if (linked) {
      setConnecting(false);
      setOpen(false);
    }
  }, [linked]);

  async function connect() {
    setError("");
    try {
      const res = await apiFetch("/api/telegram/link", { method: "POST" });
      if (!res.ok) throw new Error(`link failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      setLinkUrl(url);
      setOpen(true);
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
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={connect}>
        <Send data-icon="inline-start" />
        {connecting ? "Waiting for Telegram…" : "Connect Telegram"}
      </Button>
      {connecting && !open && (
        <p className="text-sm text-muted-foreground">
          Waiting for you to tap Start in Telegram. Tap the button to show
          the QR code again.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
            <DialogDescription>
              <span className="max-sm:hidden">
                Scan the code with your phone&apos;s camera.
              </span>
              <span className="sm:hidden">Tap the button below.</span>{" "}
              The bot opens in Telegram, tap <strong>Start</strong>, and this
              page connects by itself.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center max-sm:hidden">
            <div className="rounded-md border bg-white p-3">
              <QRCode value={linkUrl} size={176} />
            </div>
          </div>

          <div className="sm:hidden">
            <a
              className={cn(buttonVariants(), "w-full")}
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open the bot in Telegram
            </a>
          </div>

          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-foreground">
              No Telegram on your phone?
            </p>
            <p className="text-muted-foreground">
              That&apos;s fine: the page that opens will point you to{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://play.google.com/store/apps/details?id=org.telegram.messenger"
                target="_blank"
                rel="noreferrer"
              >
                Google Play
              </a>{" "}
              or the{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://apps.apple.com/app/telegram-messenger/id686449807"
                target="_blank"
                rel="noreferrer"
              >
                App Store
              </a>{" "}
              to install it. Sign up with your phone number, come back to
              that page, open the bot, and tap <strong>Start</strong>.
            </p>
          </div>

          <div className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
            <p className="max-sm:hidden">
              Telegram installed on this computer?{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open the bot here
              </a>{" "}
              instead of scanning.
            </p>
            <p>
              This code works for 15 minutes. If it expires, tap Connect
              Telegram again for a fresh one.
            </p>
            <p className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
              Waiting for you to tap Start…
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
