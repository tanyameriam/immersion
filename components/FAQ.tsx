"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { FadeUp } from "@/components/FadeUp";

const faqs = [
  {
    question: "Who is Layrrrd for?",
    answer:
      "Designers who save more design content than they ever get around to revisiting: Dribbble shots, case studies, articles, and more.",
  },
  {
    question: "How do I save links?",
    answer:
      "Forward anything to Layrrrd (no dedicated app required). It lands in your queue for that week's digest.",
  },
  {
    question: "What happens if I haven't saved anything?",
    answer:
      "Your first digest is filled with curated resources from the Layrrrd team, so you never receive an empty issue.",
  },
  {
    question: "How often do I receive the digest?",
    answer:
      "Once a week, by default. You can adjust delivery from your account settings.",
  },
  {
    question: "Does AI summarize my links?",
    answer:
      "Layrrrd prioritizes and organizes what you save; it doesn't rewrite or summarize the original content.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel anytime from your account; you'll keep access through the end of the period you've already paid for.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border py-6">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-lg font-medium tracking-[-0.01em] text-foreground md:text-xl">
          {question}
        </span>
        <span className="ml-6 shrink-0 text-muted-foreground">
          {isOpen ? <X className="size-5" /> : <Plus className="size-5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="pt-4 max-w-2xl text-[17px] leading-[1.65] text-muted-foreground">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(2);

  return (
    <section
      id="faq"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <div className="md:grid md:grid-cols-[320px_1fr] md:gap-16">
          <FadeUp>
            <h2 className="text-5xl font-bold tracking-[-0.03em] text-foreground">
              Questions.
            </h2>
          </FadeUp>

          <FadeUp delay={0.06}>
            <div className="mt-16 border-t border-border md:mt-0">
              {faqs.map((faq, i) => (
                <FAQItem
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
