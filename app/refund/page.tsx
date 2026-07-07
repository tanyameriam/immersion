import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Refund Policy - Layrrrd.",
  description: "Layrrrd's refund policy.",
};

export default function RefundPage() {
  return (
    <>
      <Navigation />
      <main className="pt-[72px]">
        <div className="mx-auto max-w-[680px] px-6 py-[80px] md:px-10 md:py-[120px]">
          <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
            Legal
          </p>
          <h1 className="mt-6 mb-12 text-[2.5rem] font-bold leading-[1.0] tracking-[-0.03em] text-foreground md:text-[3.25rem]">
            Refund Policy
          </h1>
          <div className="space-y-8 text-[17px] leading-[1.7] text-muted-foreground">
            <p>
              If Layrrrd isn&apos;t working for you, contact us within 7 days
              of your first charge and we&apos;ll issue a full refund for
              that billing period.
            </p>
            <p>
              Subsequent billing periods are non-refundable, but you can
              cancel at any time to prevent future charges. Your access
              continues through the period you&apos;ve already paid for.
            </p>
            <p>
              To request a refund, email{" "}
              <a
                href="mailto:layrrrd@gmail.com"
                className="text-foreground underline underline-offset-4"
              >
                layrrrd@gmail.com
              </a>{" "}
              with the email address you signed up with.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
