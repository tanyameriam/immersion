import type { Metadata } from "next";
import "./globals.css";
import { Inter_Tight } from "next/font/google";
import { cn } from "@/lib/utils";
import { satoshi, sardin } from "@/design-system/fonts";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Immersion — Content Curation",
  description: "A content curation app.",
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
        {children}
      </body>
    </html>
  );
}
