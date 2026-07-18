/**
 * Founding Membership marketing constants for the /founding-membership page,
 * all derived from the billing source of truth in lib/billing/config.ts.
 * LIVE numbers (claimed spots, current price, sold out) come from
 * GET /api/founding/status via hooks/use-founding-status; nothing here is a
 * counter.
 */

import { BISCUIT, FOUNDING, PLAYTIME, formatInr } from "@/lib/billing/config";

export const FOUNDING_TOTAL_SPOTS = FOUNDING.totalSpots;
export const FOUNDING_TIER1_CAP = FOUNDING.tier1Cap;
export const FOUNDING_TIER1_PRICE = formatInr(FOUNDING.tier1Paise);
export const FOUNDING_TIER2_PRICE = formatInr(FOUNDING.tier2Paise);

// Rudolf play time on the free plan: a daily allowance, then biscuits.
export const FREE_DAILY_PLAY_HOURS = PLAYTIME.freeDailyMinutes / 60;
export const FREE_DAILY_PLAY_MINUTES = PLAYTIME.freeDailyMinutes;
export const BISCUIT_MINUTES = BISCUIT.minutes;
export const BISCUIT_PRICE_LABEL = formatInr(BISCUIT.pricePaise);
