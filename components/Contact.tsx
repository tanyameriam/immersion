"use client";

import { FadeUp } from "@/components/FadeUp";

export default function Contact() {
  return (
    <section
      id="contact"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2
            className="font-bold tracking-[-0.04em] text-foreground"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 5rem)",
              lineHeight: 1.05,
            }}
          >
            Questions?
            <br />
            Let&apos;s talk.
          </h2>
        </FadeUp>

        <FadeUp delay={0.1}>
          <a
            href="mailto:layrrrd@gmail.com"
            className="mt-6 inline-block text-[17px] text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
          >
            layrrrd@gmail.com
          </a>
        </FadeUp>
      </div>
    </section>
  );
}
