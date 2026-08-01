"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { bookmarkletHref } from "@/lib/bookmarklet";

// Same origin convention as the referral links, digest emails, and the bot's
// upgrade links (lib/referrals/server.ts, lib/digest/build.ts,
// lib/rudolf/chat.ts) - the canonical app URL, not window.location, so the
// bookmarklet always points at production regardless of where it was grabbed.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.layrrrd.com";

/**
 * Install card for the "Save to Layrrrd" bookmarklet: a drag-to-bookmarks-bar
 * link that captures the current page from the user's own browser (past
 * whatever login, paywall, or bot check it required) and saves it, the same
 * way the Chrome extension does. Covers browsers/devices the extension
 * doesn't reach.
 */
export function BookmarkletCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Save from any browser</CardTitle>
        <CardDescription>
          A one-click bookmark that saves the page you&apos;re on, wherever
          you&apos;re signed in - Safari, Firefox, or anywhere the extension
          isn&apos;t installed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={bookmarkletHref(APP_URL)}
            draggable
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground select-none"
          >
            📎 Save to Layrrrd
          </a>
          <p className="text-sm text-muted-foreground">
            Drag this to your bookmarks bar.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Then, on any article, click it in your bookmarks bar to save the
          page you&apos;re looking at - including pages behind a login,
          paywall, or bot check, since it reads the page you&apos;ve already
          got open instead of fetching it fresh.
        </p>
      </CardContent>
    </Card>
  );
}
