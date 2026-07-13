"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { FadeUp } from "@/components/FadeUp";

const faqs = [
  {
    question: "What exactly is Layrrrd?",
    answer:
      "Layrrrd is an AI-powered personal knowledge companion. It helps you discover relevant content, organize everything you save into a personal knowledge library, and retrieve information simply by asking questions in natural language.",
  },
  {
    question: "How do I save things?",
    answer:
      "Save articles, videos, newsletters, podcasts, research papers, or any webpage. Everything is automatically added to your personal knowledge library and organized for you.",
  },
  {
    question: "Does the AI actually summarize what I save?",
    answer:
      "Yes. Every piece of content is automatically summarized and enriched with key topics, source information, and contextual metadata to make it easier to revisit and retrieve later.",
  },
  {
    question: "How does the weekly digest work?",
    answer:
      "Your personalized dashboard updates continuously as you save and discover content. Optional digests are available, but the primary experience is retrieving knowledge on demand whenever you need it.",
  },
  {
    question: "Where do recommendations come from?",
    answer:
      "Recommendations are personalized around your interests and curated from trusted, relevant sources. As your library grows, Layrrrd continuously improves what it recommends.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. Your library belongs to you. Only you can access your saved content, and every answer links back to your own sources.",
  },
  {
    question: "How do I get in, and what does it cost?",
    answer:
      "Layrrrd is currently invite-only while we're onboarding founding members. Join the waitlist for early access and help shape the product before launch.",
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
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
