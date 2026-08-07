import { Puzzle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeUp } from "@/components/FadeUp";
import { CHROME_EXTENSION_URL } from "@/lib/constants";

export default function ChromeExtension() {
  return (
    <section
      id="chrome-extension"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 px-6 md:grid-cols-2 md:gap-12 md:px-10 xl:px-20">
        <FadeUp>
          <div>
            <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              Save it without ever leaving the page.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-[1.65] text-muted-foreground">
              One click from the plugin, and it&apos;s in your Layrrrd. No
              copying links, no switching tabs.
            </p>

            <div className="mt-8">
              <Button
                size="lg"
                variant="outline"
                render={
                  <a
                    href={CHROME_EXTENSION_URL}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <Puzzle data-icon="inline-start" />
                Add to Chrome
              </Button>
            </div>

            <p className="mt-3 text-base text-muted-foreground">
              Free on the Chrome Web Store
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          {/* This mockup is a self-contained illustration of an external
              browser + extension popup, not site UI — rounded corners and
              the pill button are a deliberate, scoped exception to the
              site's own square-corner components. */}
          <div className="relative pt-10 pr-4 md:pr-6">
            {/* Simplified browser window */}
            <div className="rounded-[32px] bg-foreground p-4 shadow-sm">
              <div className="overflow-hidden rounded-[24px] bg-card">
                <div className="flex items-center gap-4 bg-muted px-6 py-5">
                  <div className="flex shrink-0 gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                    <span className="size-2.5 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 truncate rounded-full bg-card px-4 py-2.5 text-sm text-muted-foreground">
                    example.com/article
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-sm font-bold text-background">
                    L
                  </div>
                </div>
                <div className="space-y-5 p-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Design · 5 min read
                  </p>
                  <h3 className="max-w-[65%] text-3xl font-bold leading-tight tracking-[-0.02em] text-foreground md:text-4xl">
                    Why the best interfaces disappear
                  </h3>
                  <div className="max-w-[65%] space-y-3 pt-2">
                    <div className="h-3 w-full rounded-full bg-muted" />
                    <div className="h-3 w-4/5 rounded-full bg-muted" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating extension popup */}
            <div className="absolute right-2 top-36 w-56 rounded-2xl border border-border bg-card shadow-lg sm:w-64">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
                  L
                </div>
                <span className="flex-1 text-sm font-semibold text-foreground">
                  Layrrrd
                </span>
                <X className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
              <div className="space-y-2.5 p-4">
                <Badge variant="secondary">Page detected</Badge>
                <div className="flex items-center gap-2.5 rounded-xl bg-muted p-2.5">
                  <div className="size-8 shrink-0 rounded-lg bg-foreground" />
                  <p className="line-clamp-2 text-xs font-bold leading-snug text-foreground">
                    Why the best interfaces disappear
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Save to: <span className="font-semibold text-foreground">Inbox</span>
                </p>
                <Button
                  size="default"
                  className="w-full rounded-full text-xs normal-case tracking-normal"
                >
                  Save this page
                </Button>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
