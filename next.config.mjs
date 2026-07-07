/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't bundle these server-only packages into the serverless functions —
  // they use dynamic requires / native-ish deps that break when bundled on
  // Vercel (works with `next start` locally, 500s on Vercel without this).
  serverExternalPackages: [
    "firebase-admin",
    "@mozilla/readability",
    "linkedom",
  ],
};

export default nextConfig;
