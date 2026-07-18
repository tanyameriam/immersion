import { adminDb } from "@/lib/firebase/admin";
import { PLAYTIME } from "@/lib/billing/config";
import {
  BISCUIT_MS,
  FREE_DAILY_MS,
  dayKeyFor,
  remainingMs,
  type PlaytimeState,
} from "@/lib/billing/playtime-math";

export interface MeterResult {
  /** May Rudolf answer this question? */
  allowed: boolean;
  /** Send the once-a-day "getting sleepy" warning after answering. */
  shouldWarn: boolean;
  /** Send the once-a-day "gone to sleep" message (only when blocked). */
  shouldSendSleepMessage: boolean;
  remainingMs: number;
  biscuitBalance: number;
}

/**
 * Meter one free-plan question against the daily play-time budget.
 *
 * Play time is accrued from message timestamps: a gap of up to
 * PLAYTIME.idleGraceMs since the previous message counts as continuous play,
 * longer silences count as Rudolf resting. When the daily free allowance is
 * spent, purchased biscuits are consumed automatically (1 biscuit =
 * BISCUIT.minutes more play). All in one transaction on users/{uid}, so
 * concurrent messages can't double-spend a biscuit.
 */
export async function meterQuestion(
  uid: string,
  nowMs = Date.now(),
): Promise<MeterResult> {
  const ref = adminDb().collection("users").doc(uid);

  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const stored = (data.rudolf ?? null) as PlaytimeState | null;
    let biscuitBalance: number =
      typeof data.biscuits?.balance === "number" ? data.biscuits.balance : 0;

    const dayKey = dayKeyFor(new Date(nowMs));
    const sameDay = stored?.dayKey === dayKey;

    // Day rollover (or first ever message): fresh free allowance. Any unused
    // biscuit bonus from yesterday is forfeited - a fresh 120 minutes just
    // arrived, and purchased-but-unconsumed biscuits are untouched.
    const state: PlaytimeState = sameDay
      ? { ...stored! }
      : {
          dayKey,
          playMs: 0,
          bonusMs: 0,
          lastActiveAt: nowMs,
          warnedOnDayKey: stored?.warnedOnDayKey,
          sleptOnDayKey: stored?.sleptOnDayKey,
        };

    // Idle-grace accrual: only gaps within the grace window count as play,
    // and only while there was budget left - messages sent to a sleeping
    // Rudolf are not play, so a biscuit bought later grants its full time.
    if (sameDay) {
      const gap = nowMs - state.lastActiveAt;
      const hadBudget = state.playMs < FREE_DAILY_MS + state.bonusMs;
      if (hadBudget && gap > 0 && gap <= PLAYTIME.idleGraceMs) {
        state.playMs += gap;
      }
      state.lastActiveAt = nowMs;
    }

    // Out of budget: eat purchased biscuits until covered or the jar is empty.
    let consumed = 0;
    while (
      state.playMs >= FREE_DAILY_MS + state.bonusMs &&
      biscuitBalance > 0
    ) {
      biscuitBalance -= 1;
      consumed += 1;
      state.bonusMs += BISCUIT_MS;
    }

    const allowed = state.playMs < FREE_DAILY_MS + state.bonusMs;
    const remaining = remainingMs(state, nowMs);

    let shouldWarn = false;
    let shouldSendSleepMessage = false;
    if (allowed) {
      if (
        remaining <= PLAYTIME.warnThresholdMs &&
        state.warnedOnDayKey !== dayKey
      ) {
        shouldWarn = true;
        state.warnedOnDayKey = dayKey;
      }
    } else if (state.sleptOnDayKey !== dayKey) {
      shouldSendSleepMessage = true;
      state.sleptOnDayKey = dayKey;
    }

    const update: Record<string, unknown> = { rudolf: state };
    if (consumed > 0) update.biscuits = { balance: biscuitBalance };
    tx.set(ref, update, { merge: true });

    return {
      allowed,
      shouldWarn,
      shouldSendSleepMessage,
      remainingMs: remaining,
      biscuitBalance,
    };
  });
}
