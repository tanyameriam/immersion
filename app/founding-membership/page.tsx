import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { FoundingHero } from "@/components/founding/Hero";
import { FoundingBenefits } from "@/components/founding/Benefits";
import { FoundingFreePlan } from "@/components/founding/FreePlan";
import { FoundingComparison } from "@/components/founding/Comparison";
import { FoundingWhyLimited } from "@/components/founding/WhyLimited";
import { FoundingFAQ } from "@/components/founding/FoundingFAQ";
import { FoundingFinalCta } from "@/components/founding/FinalCta";
import { FoundingStickyMobileCta } from "@/components/founding/StickyMobileCta";

export const metadata: Metadata = {
  title: "Founding Membership - Layrrrd.",
  description:
    "Join the first 100 founding members of Layrrrd for lifetime access and a direct hand in shaping the product.",
};

export default function FoundingMembershipPage() {
  return (
    <>
      <Navigation />
      <main className="pt-[72px] pb-20 md:pb-0">
        <FoundingHero />
        <FoundingBenefits />
        <FoundingFreePlan />
        <FoundingComparison />
        <FoundingWhyLimited />
        <FoundingFAQ />
        <FoundingFinalCta />
      </main>
      <Footer />
      <FoundingStickyMobileCta />
    </>
  );
}
