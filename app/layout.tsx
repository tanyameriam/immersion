import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
