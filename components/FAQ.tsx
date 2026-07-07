"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { FadeUp } from "@/components/FadeUp";

const faqs = [
  {
    question: "What exactly is Layrrrd?",
    answer:
      "Layrrrd is your AI knowledge layer for the web. Save any page — articles, videos, threads, docs — in one click, and the AI reads it for you, turning it into a summary, key topics, and a reading time, all organized in your dashboard. A weekly digest then brings the best of what you saved back to you, so the things you found actually get read.",
  },
  {
    question: "How do I save things?",
    answer:
      "Two ways: the one-click browser extension (click the Layrrrd button on any page), or paste a link straight into your dashboard. Sign in with Google or email — and support for more browsers and sources is on the way.",
  },
  {
    question: "Does the AI actually summarize what I save?",
    answer:
      "Yes. Every save gets a concise AI summary, a one-line TL;DR, topics, keywords, and an estimated reading time — so in a few seconds you can tell what's worth your time and what isn't.",
  },
  {
    question: "How does the weekly digest work?",
    answer:
      "Once a week, on the day you choose, you get a digest by email and/or Telegram. It groups everything you saved by topic and highlights what you haven't read yet — so nothing slips through the cracks.",
  },
  {
    question: "Where do recommendations come from?",
    answer:
      "From the community — people who save about the same topics as you. When several readers with similar interests save something, it surfaces in your Recommended tab with social proof (\"saved by N people interested in …\"), so you discover the good stuff without the noise.",
  },
  {
    question: "Is my data private?",
    answer:
      "Your library is yours — only you can see what you've saved. Recommendations are aggregated: we surface links, not who saved them. You can delete any item, or your entire account, at any time.",
  },
  {
    question: "What does it cost, and can I cancel?",
    answer:
      "Layrrrd is free to get started. Founding members can unlock more for ₹99/month. Cancel anytime from your account — you keep access through the end of the period you've already paid for.",
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
