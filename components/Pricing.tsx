"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";

const included = [
  "Lifetime founding membership",
  "Unlimited saves & AI summaries",
  "Unlimited Rudolf play time",
  "Early access to every new feature",
  "Help shape the product roadmap",
];

export default function Pricing() {
  const router = useRouter();

  return (
    <section
      id="pricing"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <div className="grid gap-12 md:grid-cols-2 md:gap-8 md:items-center">
          <FadeUp delay={0.06}>
            <div>
              <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
                Become one of the first 100 to shape Layrrrd.
              </h2>
              <p className="mt-5 text-2xl font-medium tracking-[-0.02em] text-muted-foreground">
                Founding Membership · Lifetime Access
              </p>
              <p className="mt-3 max-w-sm text-[17px] leading-[1.65] text-muted-foreground">
                Join a small community of early believers helping build
                Layrrrd from day one. Get lifetime access, early features,
                and a direct voice in what we build next.
              </p>
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={() => router.push("/founding-membership")}
                >
                  Become a Founding Member
                </Button>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <ul className="space-y-8">
              {included.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-end gap-3 text-[17px] text-foreground"
                >
                  {item}
                  <Check className="size-5 shrink-0" />
                </li>
              ))}
            </ul>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
