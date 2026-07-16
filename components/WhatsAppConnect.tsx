"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
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
 * Connect a WhatsApp account for chatting with Rudolf. Clicking Connect opens
 * a modal with a QR code pointing at a wa.me link that prefills a one-time
 * "connect <code>" message; the user just hits send in WhatsApp. wa.me
 * handles the no-app case itself (it shows install/WhatsApp Web options), so
 * unlike Telegram no wrapper page is needed. Linking completes server-side
 * when the webhook sees the message, so while waiting this just re-reads the
 * profile until the WhatsApp id appears. (In local dev without a public
 * webhook URL, linking can't complete — test against a deployed environment.)
 */
export function WhatsAppConnect({
  waId,
  refresh,
  onDisconnect,
}: {
  /** Current linked WhatsApp id ("" when not linked). */
  waId: string;
  /** Re-read the profile from Firestore to notice a completed link. */
  refresh: () => void | Promise<void>;
  onDisconnect: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const linked = Boolean(waId);

  useEffect(() => {
    if (!connecting || linked) return;
    const poll = setInterval(() => {
      void refresh();
    }, 3000);
    // Stop waiting after 10 minutes (installing WhatsApp takes a while); the
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
      const res = await apiFetch("/api/whatsapp/link", { method: "POST" });
      if (!res.ok) throw new Error(`link failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      setLinkUrl(url);
      setOpen(true);
      setConnecting(true);
    } catch (err) {
      console.error("WhatsApp connect failed", err);
      setError("Couldn't start WhatsApp linking, try again in a moment.");
    }
  }

  if (linked) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <CheckCircle2 className="size-4" />
          WhatsApp connected
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
        <MessageCircle data-icon="inline-start" />
        {connecting ? "Waiting for WhatsApp…" : "Connect WhatsApp"}
      </Button>
      {connecting && !open && (
        <p className="text-sm text-muted-foreground">
          Waiting for your message in WhatsApp. Tap the button to show the QR
          code again.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect WhatsApp</DialogTitle>
            <DialogDescription>
              <span className="sm:hidden">Tap the button below. </span>
              WhatsApp opens with a ready-made message, hit{" "}
              <strong>send</strong>, and this page connects by itself.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-sm:hidden">
            <p className="text-center text-base font-bold text-foreground">
              Scan this with your phone&apos;s camera app
            </p>
            <div className="flex justify-center">
              <div className="rounded-md border bg-white p-4">
                <QRCode
                  value={linkUrl}
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
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Rudolf in WhatsApp
            </a>
          </div>

          <div className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
            <p className="max-sm:hidden">
              WhatsApp installed on this computer?{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open the chat here
              </a>{" "}
              instead of scanning.
            </p>
            <p>
              This code works for 15 minutes. If it expires, tap Connect
              WhatsApp again for a fresh one.
            </p>
            <p className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
              Waiting for you to hit send…
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
