import { PLAYTIME, BISCUIT } from "@/lib/billing/config";

/**
 * Pure play-time math shared by the server metering engine and the dashboard
 * meter UI, so "remaining minutes" can never drift between the two.
 * Client-safe: no Firebase, no secrets.
 */

/** The persisted per-user play-time state (users/{uid}.rudolf). */
export interface PlaytimeState {
  /** Calendar date (in PLAYTIME.timeZone) the counters below belong to. */
  dayKey: string;
  /** Play time accrued on dayKey, in ms. */
  playMs: number;
  /** Extra budget on dayKey from biscuits consumed that day, in ms. */
  bonusMs: number;
  /** Epoch ms of the last metered message (accrual anchor). */
  lastActiveAt: number;
  /** dayKey on which the "Rudolf is sleepy" warning was sent. */
  warnedOnDayKey?: string;
  /** dayKey on which the "Rudolf went to sleep" message was sent. */
  sleptOnDayKey?: string;
}

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLAYTIME.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in the billing time zone (en-CA formats exactly that way). */
export function dayKeyFor(date: Date): string {
  return dayKeyFormat.format(date);
}

export const FREE_DAILY_MS = PLAYTIME.freeDailyMinutes * 60 * 1000;
export const BISCUIT_MS = BISCUIT.minutes * 60 * 1000;

/**
 * Remaining play time in ms for `nowMs`, from free budget plus any biscuit
 * bonus already applied today. A state from a previous day (or none at all)
 * means an untouched fresh daily allowance.
 */
export function remainingMs(
  state: Pick<PlaytimeState, "dayKey" | "playMs" | "bonusMs"> | null | undefined,
  nowMs: number,
): number {
  if (!state || state.dayKey !== dayKeyFor(new Date(nowMs))) {
    return FREE_DAILY_MS;
  }
  return Math.max(0, FREE_DAILY_MS + state.bonusMs - state.playMs);
}
