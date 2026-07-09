"use client";

import { useEffect, useState } from "react";
import { Check, MousePointerClick, Puzzle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Once dismissed, the "installed ✓" note stays gone on this browser.
const DISMISS_KEY = "layrrrd-extension-callout-dismissed";

// Chrome Web Store listing (works once the extension is approved & published).
const STORE_URL =
  "https://chromewebstore.google.com/detail/epeimbocifhhjhiaonnjbjaobjklplgd";

/** True if the Layrrrd extension's content script has tagged the page. */
function detectExtension(): boolean {
  return (
    document.documentElement.getAttribute("data-layrrrd-extension") === "1"
  );
}

/**
 * Tells the user Layrrrd works via the web app AND a 1-click browser extension.
 * Shows an install prompt, or (once the extension announces itself) an
 * "installed ✓" confirmation with a reminder to click it when they find
 * something interesting.
 */
export function ExtensionCallout() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true); // avoid a flash before mount

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setInstalled(detectExtension());
    // Content script runs at document_start, but re-check once in case of races.
    const t = setTimeout(() => setInstalled(detectExtension()), 800);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (installed === null) return null;

  if (installed) {
    if (dismissed) return null;
    return (
      <div className="flex items-center gap-3 border border-border bg-muted px-4 py-3 text-sm">
        <Check className="size-4 shrink-0 text-green-700" />
        <span className="flex-1">
          <span className="font-bold text-foreground">Extension installed.</span>{" "}
          When you find something interesting on any page, click the{" "}
          <span className="font-bold text-foreground">Layrrrd</span> button in
          your toolbar to save it here.
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border border-border bg-muted px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3 text-sm">
        <MousePointerClick className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-bold text-foreground">
            Save from anywhere in one click
          </p>
          <p className="text-muted-foreground">
            Layrrrd works as a web app and a browser extension. Add the
            extension, then click it whenever you spot something worth reading
            later, it lands right here.
          </p>
        </div>
      </div>
      <Button
        className="shrink-0"
        nativeButton={false}
        render={<a href={STORE_URL} target="_blank" rel="noreferrer" />}
      >
        <Puzzle className="mr-1 size-4" />
        Install extension
      </Button>
    </div>
  );
}
