import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { AuthedUser } from "@/lib/firebase/verify-auth";
import { sendEmail } from "@/lib/email/resend";

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "layrrrd@gmail.com";

type ProfileData = Record<string, unknown> & { uid: string };

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function table(rows: Record<string, unknown>): string {
  const trs = Object.entries(rows)
    .map(
      ([key, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666">${esc(
          key,
        )}</td><td style="padding:6px 0"><strong>${esc(value)}</strong></td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${trs}</table>`;
}

function paragraph(text: string): string {
  return `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${esc(
    text,
  )}</p>`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function profile(uid: string): Promise<ProfileData> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return { uid, ...(snap.data() ?? {}) };
}

async function setOnce(
  uid: string,
  field: string,
): Promise<ProfileData | null> {
  const ref = adminDb().collection("users").doc(uid);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    if (data[field]) return null;
    tx.set(ref, { [field]: FieldValue.serverTimestamp() }, { merge: true });
    return { uid, ...data };
  });
}

async function sendAdmin(subject: string, rows: Record<string, unknown>) {
  const sent = await sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html: `${paragraph(subject)}${table(rows)}`,
  });
  if (!sent) console.info("Admin email skipped", subject, rows);
}

async function sendUser(to: string, subject: string, html: string) {
  const sent = await sendEmail({ to, subject, html });
  if (!sent) console.info("User email skipped", subject, to);
}

export async function notifyNewSignup(user: AuthedUser): Promise<void> {
  const data = await setOnce(user.uid, "signupAdminNotifiedAt");
  if (!data) return;

  await sendAdmin("New Layrrrd signup", {
    uid: user.uid,
    email: user.email ?? data.email ?? "",
    name: user.name ?? data.name ?? "",
    provider: data.provider ?? "",
    referredByCode: data.referredByCode ?? "",
    referredByUid: data.referredByUid ?? "",
  });
}

export async function notifyReferralSignup(input: {
  referrerUid: string;
  referredUid: string;
  referralCode: string;
}): Promise<void> {
  const data = await setOnce(input.referredUid, "referralAdminNotifiedAt");
  if (!data) return;

  const referrer = await profile(input.referrerUid);
  await sendAdmin("New referred Layrrrd signup", {
    referralCode: input.referralCode,
    referrerUid: input.referrerUid,
    referrerEmail: referrer.email ?? "",
    referrerName: referrer.name ?? "",
    referredUid: input.referredUid,
    referredEmail: data.email ?? "",
    referredName: data.name ?? "",
  });
}

export async function notifyReferrerSignup(input: {
  referrerUid: string;
  referredUid: string;
}): Promise<void> {
  const data = await setOnce(input.referredUid, "referrerSignupThankYouSentAt");
  if (!data) return;

  const referrer = await profile(input.referrerUid);
  const referrerEmail = asString(referrer.email);
  if (!referrerEmail) return;

  await sendUser(
    referrerEmail,
    "Someone joined Layrrrd from your referral",
    [
      paragraph("Thank you for sharing Layrrrd."),
      paragraph(
        "Someone just created an account from your referral link. We are keeping track of your referrals in your profile.",
      ),
      table({
        "New user": data.email ?? data.name ?? input.referredUid,
        "Your referral code": referrer.referralCode ?? "",
      }),
    ].join(""),
  );
}

export async function notifyFeedback(input: {
  rating: number;
  comment: string;
  page: string;
  email: string;
  userId: string | null;
}): Promise<void> {
  await sendAdmin("New Layrrrd feedback", {
    rating: `${input.rating}/5`,
    comment: input.comment,
    page: input.page,
    email: input.email,
    userId: input.userId ?? "",
  });
}

export async function notifyPaidUpgrade(
  uid: string,
  payment: { paymentId: string; orderId?: string },
): Promise<void> {
  const data = await setOnce(uid, "paidAdminNotifiedAt");
  if (!data) return;

  await sendAdmin("New paid Layrrrd Founding Member", {
    uid,
    email: data.email ?? "",
    name: data.name ?? "",
    paymentId: payment.paymentId,
    orderId: payment.orderId ?? "",
    referredByUid: data.referredByUid ?? "",
    referredByCode: data.referredByCode ?? "",
  });

  const userEmail = asString(data.email);
  if (userEmail) {
    await sendUser(
      userEmail,
      "Welcome to Layrrrd Founding Membership",
      [
        paragraph("Thank you for becoming a Layrrrd Founding Member."),
        paragraph(
          "Your account now has full Layrrrd access: unlimited saves and bookmarks, AI summaries, weekly digests, Rudolf retrieval access according to the active plan, and early founding-member access as Layrrrd grows.",
        ),
        table({
          Plan: "Layrrrd Founding Member",
          Email: userEmail,
          "Payment ID": payment.paymentId,
        }),
      ].join(""),
    );
  }

  const referrerUid = asString(data.referredByUid);
  if (referrerUid) {
    await notifyPaidReferral({
      referrerUid,
      referredUid: uid,
      payment,
    });
  }
}

async function notifyPaidReferral(input: {
  referrerUid: string;
  referredUid: string;
  payment: { paymentId: string; orderId?: string };
}) {
  const db = adminDb();
  const referralSnap = await db
    .collection("referrals")
    .where("referrerUid", "==", input.referrerUid)
    .where("referredUid", "==", input.referredUid)
    .limit(1)
    .get();

  const referralRef = referralSnap.docs[0]?.ref;
  if (referralRef) {
    await referralRef.set(
      {
        status: "paid",
        paidAt: FieldValue.serverTimestamp(),
        paymentId: input.payment.paymentId,
        orderId: input.payment.orderId ?? null,
      },
      { merge: true },
    );
  }

  const referrer = await profile(input.referrerUid);
  const referred = await profile(input.referredUid);

  await sendAdmin("Referred user became paid", {
    referrerUid: input.referrerUid,
    referrerEmail: referrer.email ?? "",
    referredUid: input.referredUid,
    referredEmail: referred.email ?? "",
    paymentId: input.payment.paymentId,
    orderId: input.payment.orderId ?? "",
  });

  const referrerEmail = asString(referrer.email);
  if (referrerEmail) {
    await sendUser(
      referrerEmail,
      "Your Layrrrd referral became a Founding Member",
      [
        paragraph(
          "A person who joined from your referral link just became a Layrrrd Founding Member. Thank you for helping Layrrrd grow.",
        ),
        table({
          "Referred user": referred.email ?? input.referredUid,
          "Your referral code": referrer.referralCode ?? "",
        }),
      ].join(""),
    );
  }
}
