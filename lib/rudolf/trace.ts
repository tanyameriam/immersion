import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Support receipts for Rudolf's chat. Every message from a linked user gets a
 * short reference code and one Firestore doc recording what came in, which
 * path the brain took, anything that quietly degraded on the way, and how it
 * ended. When a user sends a screenshot of the "something hiccuped" reply, the
 * code printed in that reply is the doc id — the whole interaction is one
 * lookup away instead of gone with the runtime logs.
 *
 * The receipt matters most for the failures that aren't crashes. Rudolf falls
 * back silently in several places (feed unavailable, keyword search failed,
 * model call failed), and the resulting answer looks like a clean success from
 * the outside. Those are what users report as "Rudolf forgot my saves", so
 * every fallback calls `degraded()` and lands in the receipt.
 *
 * Two rules this module never breaks:
 * - Recording must never cost the user their reply. Every write is
 *   best-effort and swallowed.
 * - Receipts hold user message content, so they carry `expiresAt` and are
 *   deleted with the account (see `app/api/account/route.ts`).
 *
 * Retention is enforced by `purgeExpiredTraces()` below, called from the daily
 * cron. Firestore's own TTL policies would be the natural home for this, but
 * they require a billed project and this one is on the free Spark plan — so
 * the 30 days promised in the privacy policy is true only because that job
 * runs. Treat it as load-bearing, not housekeeping.
 */

const COLLECTION = "botEvents";
/** Also stated in the privacy policy (`app/privacy`) — keep the two in step. */
export const RETENTION_DAYS = 30;
const MAX_TEXT = 500;
const MAX_ERROR = 2000;
const MAX_DEGRADE_MESSAGE = 300;
const MAX_DEGRADATIONS = 10;

/** Deleting is paged so one run can't blow the cron's time budget. */
const PURGE_PAGE = 300;
const PURGE_MAX_PAGES = 10;

/** Which branch of the brain handled the message. */
export type TracePath =
  | "digest-consent"
  | "ingest"
  | "question"
  | "shelf-full"
  | "asleep";

type Degradation = { stage: string; message: string };

type TraceState = {
  id: string;
  userId: string;
  channel: "Telegram" | "WhatsApp";
  memoryKey: string;
  inboundText: string;
  startedAt: number;
  path?: TracePath;
  degradations: Degradation[];
  facts: Record<string, unknown>;
};

const store = new AsyncLocalStorage<TraceState>();

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    return truncate(
      `${err.name}: ${err.message}\n${err.stack ?? ""}`,
      MAX_ERROR,
    );
  }
  return truncate(String(err), MAX_ERROR);
}

async function write(state: TraceState, error: string | null): Promise<void> {
  const now = Date.now();
  try {
    await adminDb()
      .collection(COLLECTION)
      .doc(state.id)
      .set({
        // Facts first so the fixed fields below always win a name clash.
        ...state.facts,
        userId: state.userId,
        channel: state.channel,
        memoryKey: state.memoryKey,
        inboundText: state.inboundText,
        path: state.path ?? "unknown",
        degradations: state.degradations,
        degraded: state.degradations.length > 0,
        durationMs: now - state.startedAt,
        status: error ? "error" : "ok",
        error,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(
          now + RETENTION_DAYS * 24 * 60 * 60 * 1000,
        ),
      });
  } catch (err) {
    console.error("botEvents write failed", state.id, err);
  }
}

/**
 * Run one chat message through the brain, recording a receipt either way.
 * Errors are captured and reported rather than rethrown: the caller gets back
 * the reference code to show the user, so the screenshot they send in points
 * straight at the record.
 */
export async function traceChat(
  init: {
    userId: string;
    channel: "Telegram" | "WhatsApp";
    memoryKey: string;
    inboundText: string;
  },
  run: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; ref: string }> {
  const state: TraceState = {
    id: randomBytes(4).toString("hex"),
    userId: init.userId,
    channel: init.channel,
    memoryKey: init.memoryKey,
    inboundText: truncate(init.inboundText, MAX_TEXT),
    startedAt: Date.now(),
    degradations: [],
    facts: {},
  };

  try {
    await store.run(state, run);
  } catch (err) {
    console.error(`Rudolf chat failed [${state.id}]`, err);
    await write(state, describe(err));
    return { ok: false, ref: state.id };
  }
  await write(state, null);
  return { ok: true };
}

/**
 * Delete receipts past their expiry — the code-side stand-in for a Firestore
 * TTL policy, which needs a billed project. Called from the daily cron.
 *
 * `capped` means the per-run limit was reached and more remain: the caller
 * logs it rather than letting a backlog build up silently, since "we delete
 * after 30 days" quietly becoming "we delete most of it" is the kind of drift
 * a privacy policy can't absorb.
 */
export async function purgeExpiredTraces(): Promise<{
  deleted: number;
  capped: boolean;
}> {
  const db = adminDb();
  const now = Timestamp.now();
  let deleted = 0;

  for (let page = 0; page < PURGE_MAX_PAGES; page++) {
    const snap = await db
      .collection(COLLECTION)
      .where("expiresAt", "<=", now)
      .limit(PURGE_PAGE)
      .get();
    if (snap.empty) return { deleted, capped: false };

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;

    // A short page means the query is drained, not just this batch.
    if (snap.size < PURGE_PAGE) return { deleted, capped: false };
  }
  return { deleted, capped: true };
}

/** Record which branch handled the message. */
export function setPath(path: TracePath): void {
  const state = store.getStore();
  if (state) state.path = path;
}

/** Attach whatever made this reply what it was (counts, terms, timings). */
export function noteFacts(facts: Record<string, unknown>): void {
  const state = store.getStore();
  if (state) Object.assign(state.facts, facts);
}

/**
 * Record a fallback the user can't see. Call this from every `catch` that
 * returns a default instead of failing — a degraded answer is indistinguishable
 * from a good one in the logs, and that is precisely the anomaly worth finding.
 */
export function degraded(stage: string, err?: unknown): void {
  const state = store.getStore();
  if (!state || state.degradations.length >= MAX_DEGRADATIONS) return;
  state.degradations.push({
    stage,
    message: err === undefined ? "" : describe(err).slice(0, MAX_DEGRADE_MESSAGE),
  });
}
