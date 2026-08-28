import { createHash, randomInt, timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Email-ownership check for new password signups: we mail a 6-digit code and
 * only flip Firebase's native `emailVerified` once it comes back. That flag is
 * the enforcement point everywhere else - it rides inside every ID token, so
 * both the Firestore rules (`request.auth.token.email_verified`) and the
 * server (`decoded.email_verified`, see lib/firebase/verify-auth.ts) can gate
 * on it without an extra read.
 *
 * Google accounts never come through here: Google has already proven the
 * address, and their tokens arrive with email_verified already true.
 */

const COLLECTION = "emailVerifications";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Wrong guesses allowed per issued code before it's burned. */
export const MAX_ATTEMPTS = 5;
/** Gap between sends, so "resend" can't be used to mailbomb an address. */
export const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 60 * 60 * 1000;

/** Codes are stored hashed and salted with the uid - a leaked database row
 * must not hand someone a working code, and the uid salt stops one rainbow
 * table covering every user. */
function hashCode(uid: string, code: string): string {
  return createHash("sha256").update(`${uid}:${code}`).digest("hex");
}

function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function newCode(): string {
  // randomInt is CSPRNG-backed; Math.random would be guessable.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: "cooldown" | "rate_limited"; retryAfterMs: number };

/**
 * Mint a code for this user, subject to a per-send cooldown and an hourly cap.
 * Returns the plaintext code for the caller to email - it is never stored and
 * never leaves the server.
 */
export async function issueCode(
  uid: string,
  email: string,
): Promise<IssueResult> {
  const ref = adminDb().collection(COLLECTION).doc(uid);
  const now = Date.now();

  return adminDb().runTransaction<IssueResult>(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    if (data) {
      const sinceLast = now - (data.lastSentAt ?? 0);
      if (sinceLast < RESEND_COOLDOWN_MS) {
        return {
          ok: false,
          reason: "cooldown",
          retryAfterMs: RESEND_COOLDOWN_MS - sinceLast,
        };
      }
      const windowAge = now - (data.windowStartedAt ?? 0);
      if (windowAge < SEND_WINDOW_MS && (data.sendCount ?? 0) >= MAX_SENDS_PER_WINDOW) {
        return {
          ok: false,
          reason: "rate_limited",
          retryAfterMs: SEND_WINDOW_MS - windowAge,
        };
      }
    }

    const freshWindow =
      !data || now - (data.windowStartedAt ?? 0) >= SEND_WINDOW_MS;
    const code = newCode();

    tx.set(ref, {
      email,
      codeHash: hashCode(uid, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      lastSentAt: now,
      windowStartedAt: freshWindow ? now : data!.windowStartedAt,
      sendCount: freshWindow ? 1 : (data!.sendCount ?? 0) + 1,
    });

    return { ok: true, code };
  });
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "locked" | "invalid" };

/**
 * Validate a submitted code. Wrong guesses are counted so a 6-digit code can't
 * be brute-forced; the code is consumed on success.
 */
export async function checkCode(
  uid: string,
  code: string,
): Promise<CheckResult> {
  const ref = adminDb().collection(COLLECTION).doc(uid);
  const now = Date.now();

  return adminDb().runTransaction<CheckResult>(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    if (!data) return { ok: false, reason: "no_code" };
    if ((data.expiresAt ?? 0) < now) return { ok: false, reason: "expired" };
    if ((data.attempts ?? 0) >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

    if (!codesMatch(data.codeHash ?? "", hashCode(uid, code))) {
      tx.update(ref, { attempts: (data.attempts ?? 0) + 1 });
      return { ok: false, reason: "invalid" };
    }

    tx.delete(ref); // single use
    return { ok: true };
  });
}

/** Drop any outstanding code, e.g. once the account is verified another way. */
export async function clearCode(uid: string): Promise<void> {
  await adminDb().collection(COLLECTION).doc(uid).delete();
}
