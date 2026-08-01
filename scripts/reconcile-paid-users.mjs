#!/usr/bin/env node
/**
 * Cross-check Razorpay's own captured-payment records against Firestore to
 * find founding-membership purchases where fulfillment never actually
 * granted the user `plan: "pro"` (e.g. the browser closed before the verify
 * callback fired AND the webhook delivery also failed - the one gap the
 * normal exactly-once fulfillment in lib/billing/plan.ts can't self-heal,
 * since it only runs in response to a verify call or a webhook event).
 *
 * Razorpay is the source of truth here, not Firestore: every order is
 * created with notes: { uid, product, quantity } (app/api/payments/order/
 * route.ts), so a captured payment identifies its buyer even if nothing
 * in Firestore ever recorded it.
 *
 * Dry-run by default: reports mismatches only, writes nothing. Pass
 * --confirm to grant `plan: "pro"` to affected users and write a
 * `payments/{paymentId}` ledger doc so they aren't flagged again. Does NOT
 * touch the founding spot counter or assign a foundingSpot number - that's
 * left for manual review since blindly incrementing it here could race
 * against real-time buyers; PlanCard shows generic pro copy when
 * foundingSpot is absent, so access still works correctly without it.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reconcile-paid-users.mjs            # dry run
 *   node --env-file=.env.local scripts/reconcile-paid-users.mjs --confirm  # write
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const CONFIRM = process.argv.includes("--confirm");

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/reconcile-paid-users.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function fetchAllCapturedPayments() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.");
    process.exit(1);
  }
  const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const all = [];
  let skip = 0;
  const count = 100;
  for (;;) {
    const res = await fetch(
      `https://api.razorpay.com/v1/payments?count=${count}&skip=${skip}`,
      { headers: { Authorization: auth } },
    );
    if (!res.ok) {
      throw new Error(`Razorpay payments API responded ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    all.push(...data.items);
    if (data.items.length < count) break;
    skip += count;
  }
  return all;
}

async function main() {
  initAdmin();
  const db = getFirestore();

  console.log("Fetching all payments from Razorpay...");
  const payments = await fetchAllCapturedPayments();
  const founding = payments.filter(
    (p) => p.status === "captured" && p.notes?.product === "founding",
  );
  console.log(
    `${payments.length} total payments, ${founding.length} captured founding-membership payments.\n`,
  );

  const mismatches = [];
  for (const p of founding) {
    const uid = p.notes?.uid;
    if (!uid) {
      mismatches.push({ payment: p, uid: null, reason: "no uid in notes" });
      continue;
    }
    const [userSnap, ledgerSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("payments").doc(p.id).get(),
    ]);
    const plan = userSnap.data()?.plan;
    if (plan !== "pro") {
      mismatches.push({
        payment: p,
        uid,
        reason: ledgerSnap.exists
          ? "ledger exists but user.plan is not pro"
          : "no ledger doc - fulfillment never ran",
      });
    }
  }

  if (mismatches.length === 0) {
    console.log("No mismatches found - every captured founding payment has a pro user.");
    return;
  }

  console.log(`Found ${mismatches.length} mismatch(es):\n`);
  const emails = new Map();
  const uids = mismatches.map((m) => m.uid).filter(Boolean);
  if (uids.length) {
    const res = await getAuth().getUsers(uids.map((uid) => ({ uid })));
    for (const u of res.users) if (u.email) emails.set(u.uid, u.email);
  }

  for (const m of mismatches) {
    const amount = (m.payment.amount / 100).toFixed(2);
    const date = new Date(m.payment.created_at * 1000).toISOString();
    console.log(
      `- ${m.uid ?? "(unknown uid)"} ${m.uid ? `<${emails.get(m.uid) ?? "no email found"}>` : ""}\n` +
        `  payment ${m.payment.id} | ₹${amount} | ${date} | ${m.reason}`,
    );
  }

  if (!CONFIRM) {
    console.log("\nDry run - no writes made. Re-run with --confirm to grant `plan: \"pro\"` to these users.");
    return;
  }

  console.log("\n--confirm passed - granting plan: \"pro\" to affected users...");
  for (const m of mismatches) {
    if (!m.uid) {
      console.error(`  skipping payment ${m.payment.id} - no uid, needs manual review`);
      continue;
    }
    await db.runTransaction(async (tx) => {
      const ledgerRef = db.collection("payments").doc(m.payment.id);
      if ((await tx.get(ledgerRef)).exists) return; // already handled since the dry-run scan
      tx.set(
        db.collection("users").doc(m.uid),
        {
          plan: "pro",
          foundingMember: true,
          paidAt: new Date(m.payment.created_at * 1000).toISOString(),
          razorpayPaymentId: m.payment.id,
          razorpayOrderId: m.payment.order_id,
        },
        { merge: true },
      );
      tx.create(ledgerRef, {
        uid: m.uid,
        orderId: m.payment.order_id,
        product: "founding",
        quantity: 1,
        amountPaise: m.payment.amount,
        createdAt: new Date().toISOString(),
        reconciledAt: new Date().toISOString(),
        reconciledBy: "scripts/reconcile-paid-users.mjs",
      });
    });
    console.log(`  fixed ${m.uid}`);
  }
  console.log(
    "\nDone. foundingSpot was intentionally not assigned - review the founding spot counter manually if these users should have a spot number.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
