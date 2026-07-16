"use client";

import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useAuth } from "@/components/AuthContext";

export default function TalkToRudolf() {
  const { user, openAuth } = useAuth();
  const router = useRouter();

  return (
    <section
      id="talk-to-rudolf"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 px-6 md:grid-cols-2 md:gap-12 md:px-10 xl:px-20">
        <FadeUp>
          <div>
            <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              Talk to Rudolf.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-[1.65] text-muted-foreground">
              Ask, and Rudolf fetches exactly what you saved. No searching,
              no folders.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() =>
                  user ? router.push("/dashboard") : openAuth("sign-up")
                }
              >
                <Send data-icon="inline-start" />
                Telegram
              </Button>
              <Button size="lg" variant="outline" disabled>
                <MessageCircle data-icon="inline-start" />
                WhatsApp
              </Button>
              <Button size="lg" variant="outline" disabled>
                <Mail data-icon="inline-start" />
                Email
              </Button>
            </div>

            <p className="mt-3 text-base text-muted-foreground">
              WhatsApp and Email, coming soon.
            </p>

            <a
              href="#how-it-works"
              className="mt-8 inline-block text-sm font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              See how it works →
            </a>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <span className="flex size-8 items-center justify-center bg-primary text-primary-foreground">
                <Send className="size-4" />
              </span>
              <span className="font-semibold text-foreground">Telegram</span>
            </div>
            <div className="space-y-3 p-5">
              <div className="ml-auto max-w-[85%] rounded-[18px] rounded-br-[4px] bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                find that grid systems article i saved
              </div>
              <div className="mr-auto max-w-[85%] rounded-[18px] rounded-bl-[4px] border border-border bg-muted px-4 py-2.5 text-sm text-foreground">
                Got it — &quot;Grid Systems in UI Design&quot;, saved 3 weeks
                ago. Here&apos;s the link.
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
