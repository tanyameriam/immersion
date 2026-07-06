import type { Metadata } from "next";
import "./globals.css";
import { DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", dmSans.variable)}>
      <body>{children}</body>
    </html>
  );
}
