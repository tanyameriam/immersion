/**
 * Founding Membership marketing config - copy/numbers for the
 * /founding-membership page only. Not wired to real billing yet: the CTAs on
 * that page currently route into the normal sign-up flow, and the spot count
 * below is a PLACEHOLDER (no backend counter exists). Once a real founding-
 * member counter and checkout tier exist, wire this file up to that source
 * of truth instead of editing the numbers here directly.
 */

export const FOUNDING_TOTAL_SPOTS = 100;

// PLACEHOLDER - not backed by a real counter yet.
export const FOUNDING_CLAIMED_SPOTS = 1;

export const FOUNDING_REMAINING_SPOTS =
  FOUNDING_TOTAL_SPOTS - FOUNDING_CLAIMED_SPOTS;

// Founding pricing rolls out in two tiers as spots fill: tier 1 covers the
// first FOUNDING_TIER1_CAP members, tier 2 (not yet open) covers the rest up
// to FOUNDING_TOTAL_SPOTS. PLACEHOLDER pricing - not final, mirrors the
// "finalize before going live" note on PRO_PLAN in lib/billing/config.ts.
export const FOUNDING_TIER1_CAP = 20;
export const FOUNDING_TIER1_PRICE = "₹799";
export const FOUNDING_TIER2_PRICE = "₹1,199";

export const FOUNDING_TIER1_REMAINING =
  FOUNDING_TIER1_CAP - FOUNDING_CLAIMED_SPOTS;

// Free-plan Rudolf usage allowance, shown as "biscuits" on the Free Plan
// panel. Illustrative only - not enforced anywhere in the API yet.
export const FREE_MONTHLY_BISCUITS = 30;
export const FREE_BISCUITS_USED_SAMPLE = 12;
