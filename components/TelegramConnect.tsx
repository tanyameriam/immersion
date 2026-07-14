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
 * modal with a QR code pointing at /telegram/open, which opens the bot in
 * the Telegram app (or, without Telegram installed, forwards the phone to
 * its app store to get it). Deliberately does NOT auto-open
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
  const [appUrl, setAppUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [openUrl, setOpenUrl] = useState("");
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
      // Desktop links skip the t.me preview page: it only tries to launch
      // the desktop app via tg:// and never falls back to Telegram Web, so
      // without the app the tab just strands. Offer the tg:// deep link and
      // a real Telegram Web link (tgaddr is Web's own deep-link format).
      const parsed = new URL(url);
      const bot = parsed.pathname.replaceAll("/", "");
      const start = parsed.searchParams.get("start") ?? "";
      const resolve = `tg://resolve?domain=${bot}&start=${start}`;
      setAppUrl(resolve);
      setWebUrl(
        `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(resolve)}`,
      );
      // Phones scan/tap this wrapper: it opens the Telegram app when
      // installed and forwards to the phone's app store when it isn't.
      setOpenUrl(
        `${window.location.origin}/telegram/open?u=${encodeURIComponent(url)}`,
      );
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
              <span className="sm:hidden">Tap the button below. </span>
              The bot opens in Telegram, tap <strong>Start</strong>, and this
              page connects by itself.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-sm:hidden">
            <p className="text-center text-base font-bold text-foreground">
              Scan this with your phone&apos;s camera app
              <span className="mt-0.5 block text-sm font-medium text-muted-foreground">
                (not the QR scanner inside Telegram, it can&apos;t read this
                code)
              </span>
            </p>
            <div className="flex justify-center">
              <div className="rounded-md border bg-white p-4">
                <QRCode
                  value={openUrl}
                  size={208}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
            </div>
          </div>

          <div className="sm:hidden">
            <a
              className={cn(buttonVariants(), "w-full")}
              href={openUrl}
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
              That&apos;s fine: scanning the code takes you straight to Google
              Play or the App Store to install it. Sign up with your phone
              number, then scan the code again and tap <strong>Start</strong>.
            </p>
          </div>

          <div className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
            <p className="max-sm:hidden">
              On this computer instead of scanning:{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={appUrl}
              >
                open the Telegram app
              </a>{" "}
              or{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={webUrl}
                target="_blank"
                rel="noreferrer"
              >
                use Telegram Web
              </a>
              , then tap <strong>Start</strong>.
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
