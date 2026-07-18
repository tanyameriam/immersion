import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { AuthedUser } from "@/lib/firebase/verify-auth";
import {
  notifyReferralSignup,
  notifyReferrerSignup,
} from "@/lib/notifications/admin";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

export type ReferralStats = {
  signupCount: number;
  paidCount: number;
};

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://layrrrd.com").replace(
    /\/$/,
    "",
  );
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

export async function ensureReferralCode(uid: string): Promise<string> {
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const existing = userSnap.data()?.referralCode;
  if (typeof existing === "string" && existing) {
    await db.collection("referralCodes").doc(existing).set(
      {
        uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return existing;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    const codeRef = db.collection("referralCodes").doc(code);
    const claimed = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (codeSnap.exists) return false;

      tx.set(codeRef, {
        uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        userRef,
        {
          referralCode: code,
          referralCodeCreatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });
    if (claimed) return code;
  }

  throw new Error("Could not generate a unique referral code.");
}

export async function referralLinkFor(uid: string): Promise<string> {
  const code = await ensureReferralCode(uid);
  return `${appUrl()}/?ref=${encodeURIComponent(code)}`;
}

export async function getReferralStats(uid: string): Promise<ReferralStats> {
  const snap = await adminDb()
    .collection("referrals")
    .where("referrerUid", "==", uid)
    .get();

  let paidCount = 0;
  snap.docs.forEach((doc) => {
    if (doc.data().paidAt) paidCount += 1;
  });

  return {
    signupCount: snap.size,
    paidCount,
  };
}

export async function claimReferralForUser(
  user: AuthedUser,
  rawCode: string,
): Promise<{ claimed: boolean; reason?: string }> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return { claimed: false, reason: "missing_code" };

  const db = adminDb();
  const userRef = db.collection("users").doc(user.uid);
  const codeRef = db.collection("referralCodes").doc(code);

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, codeSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(codeRef),
    ]);
    const profile = userSnap.data() ?? {};
    if (profile.referredByUid) {
      return { claimed: false, reason: "already_attributed" };
    }
    if (!codeSnap.exists) {
      return { claimed: false, reason: "invalid_code" };
    }

    const referrerUid = codeSnap.data()?.uid;
    if (typeof referrerUid !== "string" || !referrerUid) {
      return { claimed: false, reason: "invalid_code" };
    }
    if (referrerUid === user.uid) {
      return { claimed: false, reason: "self_referral" };
    }

    const referralRef = db.collection("referrals").doc(`${referrerUid}_${user.uid}`);
    tx.set(
      userRef,
      {
        referredByUid: referrerUid,
        referredByCode: code,
        referredAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(
      referralRef,
      {
        referrerUid,
        referredUid: user.uid,
        referredEmail: user.email ?? "",
        referredName: user.name ?? "",
        referralCode: code,
        status: "signed_up",
        signedUpAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { claimed: true, referrerUid };
  });

  if (result.claimed && result.referrerUid) {
    await notifyReferralSignup({
      referrerUid: result.referrerUid,
      referredUid: user.uid,
      referralCode: code,
    });
    await notifyReferrerSignup({
      referrerUid: result.referrerUid,
      referredUid: user.uid,
    });
  }

  return result.claimed
    ? { claimed: true }
    : { claimed: false, reason: result.reason };
}
