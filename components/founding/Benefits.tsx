import {
  Award,
  BookMarked,
  Hammer,
  MessageCircle,
  Rocket,
  Map,
  Infinity as InfinityIcon,
} from "lucide-react";
import { FadeUp } from "@/components/FadeUp";

const benefits = [
  {
    icon: BookMarked,
    title: "Unlimited knowledge capture",
    description:
      "Save every article, video, podcast, and paper without limits, forever.",
  },
  {
    icon: MessageCircle,
    title: "Extended Rudolf usage",
    description:
      "Ask Rudolf as much as you want, with no monthly caps on retrieval.",
  },
  {
    icon: Rocket,
    title: "Early access",
    description: "Try every new feature before it reaches the free plan.",
  },
  {
    icon: Hammer,
    title: "Build Layrrrd with us",
    description:
      "Your feedback goes straight to the team shaping what we build next.",
  },
  {
    icon: Map,
    title: "Product roadmap",
    description: "A direct say in what ships next and in what order.",
  },
  {
    icon: Award,
    title: "Founder badge",
    description:
      "A permanent mark on your profile showing you were here first.",
  },
  {
    icon: InfinityIcon,
    title: "Lifetime membership",
    description: "One payment, no renewals, no subscriptions, ever.",
  },
];

export function FoundingBenefits() {
  return (
    <section
      id="benefits"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 px-6 md:grid-cols-2 md:gap-12 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            What founding members get.
          </h2>
        </FadeUp>

        <div>
          {benefits.map(({ icon: Icon, title, description }, i) => (
            <FadeUp key={title} delay={i * 0.04}>
              <div className="flex items-start gap-5 border-b border-border py-6 first:pt-0 last:border-b-0">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-[1.65] text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
