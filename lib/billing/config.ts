/**
 * Billing configuration - the single source of truth for plans and limits.
 *
 * Pricing and allowances live HERE and nowhere else; when they change, edit
 * this file only and redeploy. Nothing else in the codebase hardcodes a
 * price or a limit - every gate calls limitsFor() and every price label is
 * derived from these constants.
 *
 * Client-safe: imported by browser components for price display, so it must
 * never contain secrets.
 */

export type Plan = "free" | "pro";

/**
 * Founding Membership - the only paid plan. One-time payment, lifetime
 * access. Sold in two price tiers as spots fill; hard cap of totalSpots,
 * after which it is never offered again.
 */
export const FOUNDING = {
  name: "Founding Membership",
  totalSpots: 100,
  /** Spots 1..tier1Cap sell at tier1Paise; the rest at tier2Paise. */
  tier1Cap: 20,
  tier1Paise: 79900, // ₹799
  tier2Paise: 119900, // ₹1,199
  currency: "INR",
};

/**
 * Biscuits - Rudolf play-time top-ups for the free plan. Each biscuit buys
 * `minutes` of extra play time and is consumed only after the daily free
 * allowance runs out. Purchased biscuits never expire.
 */
export const BISCUIT = {
  pricePaise: 5000, // ₹50 each
  minutes: 15,
  maxPerOrder: 20,
  currency: "INR",
};

/** Rudolf play-time metering for the free plan. */
export const PLAYTIME = {
  /** Daily free allowance, resets every day at midnight in `timeZone`. */
  freeDailyMinutes: 120,
  /** Gaps between messages up to this count as continuous play time. */
  idleGraceMs: 5 * 60 * 1000,
  /** Send the one daily "Rudolf is sleepy" warning at this remaining time. */
  warnThresholdMs: 15 * 60 * 1000,
  timeZone: "Asia/Kolkata",
};

export interface PlanLimits {
  /** Max saved items; null = unlimited. */
  maxItems: number | null;
  /** Rudolf chat: unlimited for paid, metered play time for free. */
  rudolfPlaytime: "unlimited" | "metered";
  /** Does this plan receive the weekly digest? */
  digests: boolean;
}

// The free tier keeps unlimited saves and digests (the marketing pages
// promise this); the only metered thing is Rudolf play time.
const FREE_LIMITS: PlanLimits = {
  maxItems: null,
  rudolfPlaytime: "metered",
  digests: true,
};

const PRO_LIMITS: PlanLimits = {
  maxItems: null,
  rudolfPlaytime: "unlimited",
  digests: true,
};

/** Entitlements lookup - every feature gate calls this and nothing else.
 * Unknown/missing plan values are treated as "free". */
export function limitsFor(plan: string | undefined | null): PlanLimits {
  return plan === "pro" ? PRO_LIMITS : FREE_LIMITS;
}

/** "₹799" style label from a paise amount (client-safe). */
export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}
