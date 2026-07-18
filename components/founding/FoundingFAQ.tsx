"use client";

import { useState } from "react";
import { FadeUp } from "@/components/FadeUp";
import { AccordionItem } from "@/components/AccordionItem";

const faqs = [
  {
    question: "Why is Founding Membership a one-time payment?",
    answer:
      "Founding members are backing Layrrrd early, not subscribing to it. A single payment gets you lifetime access as a thank-you for joining before public launch, with no renewals to track.",
  },
  {
    question: "What are Rudolf's biscuits?",
    answer:
      "Biscuits are how the free plan measures Rudolf usage - each question you ask costs one, and the jar refills every month. Founding members skip this entirely with unlimited usage.",
  },
  {
    question: "What happens when Rudolf runs out of biscuits?",
    answer:
      "On the free plan, once the month's biscuits are used, Rudolf pauses conversational retrieval until the jar refills - saving and browsing your library keep working as normal.",
  },
  {
    question: "Why only 100 members?",
    answer:
      "A small, fixed group is what lets us collaborate directly with founding members instead of managing an anonymous crowd. It keeps feedback close and the roadmap genuinely shaped by the people using the product.",
  },
  {
    question: "Will I really have lifetime access?",
    answer:
      "Yes. Founding Membership is a one-time payment for permanent access to Layrrrd - no future subscription, no expiration, for as long as the product exists.",
  },
];

export function FoundingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <div className="md:grid md:grid-cols-[320px_1fr] md:gap-16">
          <FadeUp>
            <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
              Questions?
            </h2>
          </FadeUp>

          <FadeUp delay={0.06}>
            <div className="mt-16 border-t border-border md:mt-0">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                />
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
