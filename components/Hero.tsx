"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/FadeUp";
import { useWaitlist } from "@/components/WaitlistContext";

export default function Hero() {
  const { openWaitlist } = useWaitlist();
  const reduceMotion = useReducedMotion();

  // Normalized cursor position relative to the viewport center (-0.5 .. 0.5).
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.6 });

  // The dog leans and drifts toward the cursor for a subtle "it noticed you" feel.
  const dogX = useTransform(sx, [-0.5, 0.5], [-26, 26]);
  const dogY = useTransform(sy, [-0.5, 0.5], [-16, 16]);
  const dogRotate = useTransform(sx, [-0.5, 0.5], [-7, 7]);

  useEffect(() => {
    if (reduceMotion) return;
    function onMove(e: MouseEvent) {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [px, py, reduceMotion]);

  return (
    <section className="flex h-screen flex-col pt-[72px]">
      <div className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 items-stretch overflow-hidden">
        <div className="flex flex-1 flex-col justify-center px-6 md:px-10 xl:px-20">
          <FadeUp>
            <p
              className="font-bold leading-none tracking-[-0.05em] text-foreground"
              style={{ fontSize: "clamp(4.5rem, 14vw, 13rem)" }}
            >
              Layrrrd.
            </p>
          </FadeUp>

          <FadeUp delay={0.08}>
            <h1
              className="mt-4 font-bold tracking-[-0.04em] text-foreground md:mt-6"
              style={{
                fontSize: "clamp(2.25rem, 5.5vw, 4.75rem)",
                lineHeight: 0.98,
              }}
            >
              Never lose
              <br />
              a good read
              <br />
              again.
            </h1>
          </FadeUp>
        </div>

        <FadeUp
          delay={0.1}
          className="hidden shrink-0 items-center justify-center pr-6 lg:flex xl:pr-20"
        >
          <motion.video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-dog-poster.jpg"
            className="h-full w-auto max-w-[280px] object-contain xl:max-w-[340px]"
            aria-label="Illustrated dog mascot that follows your cursor"
            style={
              reduceMotion
                ? undefined
                : { x: dogX, y: dogY, rotate: dogRotate }
            }
          >
            <source src="/hero-dog.webm" type="video/webm" />
            <source src="/hero-dog.mp4" type="video/mp4" />
          </motion.video>
        </FadeUp>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10 xl:px-20">
          <FadeUp delay={0.06}>
            <div className="max-w-xl">
              <p className="text-lg font-bold text-foreground">
                You save great things. Then you never see them again.
              </p>
              <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground md:text-base">
                Tweets. LinkedIn posts. Articles. Dribbble shots. Case
                studies. <span className="text-foreground">Layrrrd</span>{" "}
                remembers what you save, reminds you to read it, and mixes in
                fresh picks worth your time, all in one weekly digest.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Button size="lg" onClick={openWaitlist}>
                Join Waitlist
              </Button>
              <span className="text-xs text-muted-foreground">
                Founding members · ₹99/month
              </span>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
