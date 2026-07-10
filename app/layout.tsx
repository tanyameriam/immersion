import type { Metadata } from "next";
import "./globals.css";
import { Inter_Tight } from "next/font/google";
import { cn } from "@/lib/utils";
import { satoshi, sardin } from "@/design-system/fonts";
import WaitlistProvider from "@/components/WaitlistContext";
import AuthProvider from "@/components/AuthContext";
import { Analytics } from "@/components/Analytics";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Layrrrd. Save once. Revisit intentionally.",
  description:
    "Layrrrd turns everything you save into a curated weekly reading list, so the best things you found actually get read.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "font-sans",
        interTight.variable,
        satoshi.variable,
        sardin.variable
      )}
    >
      <body
        className="bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <WaitlistProvider>
          <AuthProvider>
            <Analytics />
            {children}
          </AuthProvider>
        </WaitlistProvider>
      </body>
    </html>
  );
}
