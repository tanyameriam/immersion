"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Manual "save a link" control for the dashboard. The Chrome extension is the
 * primary one-click path, but this lets users (and testing) add a URL directly
 * from the web app. Wires to the real POST /api/items pipeline via the hook.
 */
export function SaveLinkBar({
  onSave,
}: {
  onSave: (
    url: string,
  ) => Promise<{ ok: boolean; created?: boolean; error?: string }>;
}) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("saving");
    setError(null);
    setNotice(null);
    const res = await onSave(trimmed);
    setStatus("idle");
    if (res.ok) {
      setUrl("");
      if (res.created === false) {
        setNotice("Already in your library, no duplicate created.");
      }
    } else {
      setError(res.error ?? "Couldn't save the link.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Paste a link to save…"
          type="url"
          className="flex-1"
        />
        <Button onClick={handleSave} disabled={status === "saving"}>
          <Plus className="mr-1 size-4" />
          {status === "saving" ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
    </div>
  );
}
