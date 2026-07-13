"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=org.telegram.messenger";
const APP_STORE_URL =
  "https://apps.apple.com/app/telegram-messenger/id686449807";

/**
 * Landing target for the Telegram-connect QR code (?u=<t.me link>).
 * Opens the bot in the Telegram app when it's installed; otherwise forwards
 * phones to their app store automatically. Desktop browsers just go to t.me.
 * Only t.me URLs are accepted so this can't be used as an open redirect.
 */
export default function OpenTelegramPage() {
  const [links, setLinks] = useState<{
    tme: string;
    tg: string;
    store: string;
  } | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("u") ?? "";
    let url: URL | null = null;
    try {
      url = new URL(raw);
    } catch {
      url = null;
    }
    const bot = url?.pathname.replaceAll("/", "") ?? "";
    if (!url || url.hostname !== "t.me" || !bot) {
      setInvalid(true);
      return;
    }
    const start = url.searchParams.get("start");
    const query = `domain=${bot}${start ? `&start=${start}` : ""}`;

    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const store = isAndroid ? PLAY_STORE_URL : APP_STORE_URL;
    setLinks({ tme: url.href, tg: `tg://resolve?${query}`, store });

    if (!isAndroid && !isIOS) {
      // Desktop: t.me handles both installed and not-installed cases fine.
      window.location.replace(url.href);
      return;
    }

    // If the app didn't take over the screen shortly, it isn't installed:
    // send the phone to its app store.
    const fallback = setTimeout(() => {
      if (!document.hidden) window.location.href = store;
    }, 2000);
    const cancel = () => clearTimeout(fallback);
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);

    if (isAndroid) {
      // Android intent URL: opens Telegram, or falls back to Play Store
      // natively in Chrome. The timer above covers other browsers.
      window.location.href = `intent://resolve?${query}#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${encodeURIComponent(store)};end`;
    } else {
      window.location.href = `tg://resolve?${query}`;
    }

    return () => {
      clearTimeout(fallback);
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
    };
  }, []);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Send className="size-8" />
      {invalid ? (
        <p className="text-sm text-muted-foreground">
          This link is missing or malformed. Open Layrrrd and tap Connect
          Telegram again for a fresh one.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Opening Telegram…</h1>
            <p className="text-sm text-muted-foreground">
              If nothing happens, use the buttons below.
            </p>
          </div>
          {links && (
            <div className="flex w-full max-w-xs flex-col gap-2">
              <a className={cn(buttonVariants())} href={links.tg}>
                I have Telegram, open the bot
              </a>
              <a
                className={cn(buttonVariants({ variant: "outline" }))}
                href={links.store}
              >
                Get Telegram
              </a>
            </div>
          )}
        </>
      )}
    </main>
  );
}
