/**
 * Billing configuration - the single source of truth for plans and limits.
 *
 * Pricing, billing type, and free-tier limits are still being finalized;
 * when they are, edit THIS FILE ONLY and redeploy. Nothing else in the
 * codebase hardcodes a price or a limit - every gate calls limitsFor().
 *
 * Client-safe: imported by browser components for price display, so it must
 * never contain secrets.
 */

export type Plan = "free" | "pro";

/** One-time for now; adding "subscription" later only touches lib/billing/*
 * and the payment routes - gates and limitsFor() stay unchanged. */
export type BillingMode = "one_time";

/** The single paid plan. PLACEHOLDER PRICE - finalize before going live. */
export const PRO_PLAN = {
  mode: "one_time" as BillingMode,
  name: "Layrrrd Pro",
  amountPaise: 49900, // ₹499 - placeholder, NOT final
  currency: "INR",
};

export interface PlanLimits {
  /** Max saved items; null = unlimited. */
  maxItems: number | null;
  /** Can this plan chat with Rudolf (Telegram/WhatsApp)? */
  rudolfChat: boolean;
  /** Does this plan receive the weekly digest? */
  digests: boolean;
}

// SAFE DEFAULTS: the free tier is currently unlimited/enabled, so deploying
// this code changes nothing for existing users. Flip these values when the
// free-tier shape is finalized (e.g. maxItems: 50, rudolfChat: false).
const FREE_LIMITS: PlanLimits = {
  maxItems: null,
  rudolfChat: true,
  digests: true,
};

const PRO_LIMITS: PlanLimits = {
  maxItems: null,
  rudolfChat: true,
  digests: true,
};

/** Entitlements lookup - every feature gate calls this and nothing else.
 * Unknown/missing plan values are treated as "free". */
export function limitsFor(plan: string | undefined | null): PlanLimits {
  return plan === "pro" ? PRO_LIMITS : FREE_LIMITS;
}
