"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CapturePayload = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  text?: string;
};

type SaveState =
  | { kind: "waiting" }
  | { kind: "signed-out" }
  | { kind: "saving" }
  | { kind: "saved"; title: string; existing: boolean; reprocess: boolean }
  | { kind: "error"; message: string };

/**
 * Receiver for the "Save to Layrrrd" bookmarklet (see lib/bookmarklet.ts).
 * The bookmarklet captures the current page from the user's own browser -
 * already past whatever login, paywall, or bot check it required - and
 * postMessages it here, on our own origin, where the signed-in Firebase
 * session can save it through the normal /api/items pipeline. Same idea as
 * the Chrome extension's capture, just without an install.
 *
 * Visiting this page directly (no opener) instead shows a plain "paste a
 * URL" form, so it's still useful on its own.
 */
export default function CapturePage() {
  const { user, hydrated, openAuth } = useAuth();
  const [state, setState] = useState<SaveState>({ kind: "waiting" });
  const [manualUrl, setManualUrl] = useState("");
  const [hasOpener, setHasOpener] = useState(true);
  const savingRef = useRef(false);

  useEffect(() => {
    setHasOpener(typeof window !== "undefined" && !!window.opener);
  }, []);

  useEffect(() => {
    async function save(payload: CapturePayload) {
      if (savingRef.current) return; // already handled this delivery
      if (!hydrated) return; // opener keeps resending; retry once auth resolves
      if (!user) {
        setState({ kind: "signed-out" });
        return;
      }
      savingRef.current = true;
      setState({ kind: "saving" });
      try {
        const res = await apiFetch("/api/items", {
          method: "POST",
          body: JSON.stringify({
            url: payload.url,
            title: payload.title || undefined,
            content: {
              title: payload.title,
              description: payload.description,
              image: payload.image,
              text: payload.text,
            },
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `Save failed (${res.status})`);
        }
        setState({
          kind: "saved",
          title: data?.item?.title || payload.title || payload.url,
          existing: data?.created === false,
          reprocess: Boolean(data?.reprocess),
        });
        setTimeout(() => window.close(), 1800);
      } catch (err) {
        savingRef.current = false;
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Couldn't save that link.",
        });
      }
    }

    function onMessage(e: MessageEvent) {
      if (e.source !== window.opener) return;
      const data = e.data as
        | { type?: string; payload?: CapturePayload }
        | undefined;
      if (data?.type !== "layrrrd:capture" || !data.payload?.url) return;
      void save(data.payload);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [user, hydrated]);

  async function saveManualUrl() {
    const trimmed = manualUrl.trim();
    if (!trimmed || !user) return;
    setState({ kind: "saving" });
    try {
      const res = await apiFetch("/api/items", {
        method: "POST",
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setState({
        kind: "saved",
        title: data?.item?.title || trimmed,
        existing: data?.created === false,
        reprocess: Boolean(data?.reprocess),
      });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Couldn't save that link.",
      });
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
        Layrrrd
      </p>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : state.kind === "signed-out" ? (
        <div className="space-y-4">
          <p className="max-w-sm text-sm text-muted-foreground">
            Sign in to Layrrrd to save this page. Once you&apos;re signed in
            here, it&apos;ll save automatically.
          </p>
          <Button onClick={() => openAuth("sign-in")}>Sign In</Button>
        </div>
      ) : state.kind === "waiting" && hasOpener ? (
        <p className="text-sm text-muted-foreground">Reading the page…</p>
      ) : state.kind === "waiting" && !hasOpener ? (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste a link to save it to your library.
          </p>
          <div className="flex gap-2">
            <Input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveManualUrl()}
              placeholder="https://…"
              type="url"
              className="flex-1"
            />
            <Button onClick={saveManualUrl} disabled={!manualUrl.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : state.kind === "saving" ? (
        <p className="text-sm text-muted-foreground">Saving…</p>
      ) : state.kind === "saved" ? (
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-medium text-foreground">
            {state.existing ? "Already in your library" : "Saved!"}
          </p>
          <p className="text-sm text-muted-foreground">
            {state.reprocess
              ? "Layrrrd is re-reading it now that it has the real page."
              : state.title}
          </p>
        </div>
      ) : state.kind === "error" ? (
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button
            variant="outline"
            onClick={() => setState({ kind: "waiting" })}
          >
            Try again
          </Button>
        </div>
      ) : null}

      <Link
        href="/dashboard"
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
