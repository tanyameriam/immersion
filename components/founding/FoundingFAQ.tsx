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
      "On the free plan, Rudolf plays with you for 2 hours every day. When his daily play time runs out, a biscuit keeps him going: each one is ₹50 and buys 15 more minutes. Biscuits never expire, they sit in the jar until Rudolf needs them. Founding members skip this entirely with unlimited play time.",
  },
  {
    question: "What happens when Rudolf runs out of play time?",
    answer:
      "He gets sleepy and curls up for a nap until the next day, or until you give him a biscuit. Saving links and browsing your library keep working as normal, only chatting with Rudolf pauses.",
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
