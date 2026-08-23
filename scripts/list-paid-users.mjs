#!/usr/bin/env node
/**
 * List everyone who has paid for Layrrrd through the platform: every captured
 * Razorpay payment, who made it, what it bought, and whether fulfillment
 * actually landed in Firestore.
 *
 * Razorpay is the source of truth for "who paid" - every order is created
 * with notes: { uid, product, quantity } (app/api/payments/order/route.ts),
 * so a captured payment identifies its buyer even when fulfillment never ran
 * (see scripts/reconcile-paid-users.mjs for fixing those). Razorpay also
 * carries the email/contact the payer typed into checkout, which is why this
 * script still works with Razorpay keys alone.
 *
 * Strictly read-only: it never writes to Firestore or Razorpay.
 *
 * Usage:
 *   node --env-file=.env.local scripts/list-paid-users.mjs
 *   node --env-file=.env.local scripts/list-paid-users.mjs --product=founding
 *   node --env-file=.env.local scripts/list-paid-users.mjs --all-statuses
 *   node --env-file=.env.local scripts/list-paid-users.mjs --json
 *
 * Flags:
 *   --product=<founding|biscuits>  Only this product (default: all).
 *   --all-statuses                 Include failed/authorised/refunded
 *                                  payments, not just captured ones.
 *   --json                         Emit JSON instead of the table.
 *
 * Env: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are required. The Firebase
 * Admin vars are optional - with them each buyer's account email and current
 * plan are resolved too; without them the Razorpay checkout email is shown.
 * Note that test-mode keys only ever see test-mode payments: to see real
 * buyers, run with the live keys (and per AGENTS.md, that's an explicit
 * against-prod run - it writes nothing, but keep the credentials out of
 * `.env.local`, e.g. `node --env-file=.env.prod.local ...`).
 */
const JSON_OUT = process.argv.includes("--json");
const ALL_STATUSES = process.argv.includes("--all-statuses");
const PRODUCT = process.argv
  .find((a) => a.startsWith("--product="))
  ?.slice("--product=".length);

/**
 * Firebase Admin is optional here, so it's imported lazily and only when the
 * service-account vars are present. Returns false when it isn't configured.
 */
async function initAdminIfConfigured() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return false;
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return true;
}

async function fetchAllPayments() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error(
      "Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Run with: node --env-file=.env.local scripts/list-paid-users.mjs",
    );
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
      throw new Error(
        `Razorpay payments API responded ${res.status}: ${await res.text()}`,
      );
    }
    const data = await res.json();
    all.push(...data.items);
    if (data.items.length < count) break;
    skip += count;
  }
  return all;
}

/** uid -> { email, plan, foundingSpot } for the uids Razorpay handed us. */
async function lookupBuyers(uids) {
  const out = new Map();
  if (!uids.length) return out;

  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const auth = getAuth();
  const db = getFirestore();
  // getUsers caps at 100 identifiers per call.
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100);
    const res = await auth.getUsers(batch.map((uid) => ({ uid })));
    for (const u of res.users) {
      out.set(u.uid, { email: u.email ?? null, plan: null, foundingSpot: null });
    }
  }
  const snaps = await Promise.all(
    uids.map((uid) => db.collection("users").doc(uid).get()),
  );
  for (const snap of snaps) {
    const entry = out.get(snap.id) ?? { email: null };
    entry.plan = snap.data()?.plan ?? (snap.exists ? "free" : null);
    entry.foundingSpot = snap.data()?.foundingSpot ?? null;
    out.set(snap.id, entry);
  }
  return out;
}

function money(payment) {
  const symbol = payment.currency === "INR" ? "₹" : `${payment.currency} `;
  return `${symbol}${(payment.amount / 100).toFixed(2)}`;
}

async function main() {
  const haveFirebase = await initAdminIfConfigured();

  const payments = await fetchAllPayments();
  const rows = payments
    .filter((p) => ALL_STATUSES || p.status === "captured")
    .filter((p) => !PRODUCT || p.notes?.product === PRODUCT)
    .sort((a, b) => a.created_at - b.created_at);

  const uids = [...new Set(rows.map((p) => p.notes?.uid).filter(Boolean))];
  const buyers = haveFirebase ? await lookupBuyers(uids) : new Map();

  const records = rows.map((p) => {
    const uid = p.notes?.uid ?? null;
    const buyer = uid ? buyers.get(uid) : undefined;
    return {
      paymentId: p.id,
      orderId: p.order_id,
      status: p.status,
      paidAt: new Date(p.created_at * 1000).toISOString(),
      amount: p.amount / 100,
      currency: p.currency,
      method: p.method ?? null,
      product: p.notes?.product ?? null,
      quantity: p.notes?.quantity ? Number(p.notes.quantity) : null,
      uid,
      // Razorpay's own checkout email is the fallback when Firebase Admin
      // isn't configured (or the uid no longer resolves to an account).
      email: buyer?.email ?? p.email ?? null,
      emailSource: buyer?.email ? "firebase-auth" : p.email ? "razorpay" : null,
      contact: p.contact ?? null,
      currentPlan: buyer?.plan ?? null,
      foundingSpot: buyer?.foundingSpot ?? null,
    };
  });

  if (JSON_OUT) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  if (!records.length) {
    console.log(
      "No matching payments. (Test-mode keys only see test-mode payments - use the live keys for real buyers.)",
    );
    return;
  }

  const scope = ALL_STATUSES ? "payment" : "captured payment";
  console.log(
    `${records.length} ${scope}${records.length === 1 ? "" : "s"}${PRODUCT ? ` for product "${PRODUCT}"` : ""}:\n`,
  );
  for (const r of records) {
    const who = r.email ?? "(no email on record)";
    const label =
      r.product === "biscuits" && r.quantity
        ? `biscuits x${r.quantity}`
        : (r.product ?? "unknown product");
    console.log(`- ${who}${r.emailSource === "razorpay" ? " (checkout email)" : ""}`);
    console.log(
      `  ${label} | ${money({ amount: r.amount * 100, currency: r.currency })} | ${r.paidAt} | ${r.status}${r.method ? ` via ${r.method}` : ""}`,
    );
    console.log(
      `  uid ${r.uid ?? "(none in notes)"} | payment ${r.paymentId} | order ${r.orderId}`,
    );
    if (haveFirebase) {
      const spot = r.foundingSpot ? `, founding spot #${r.foundingSpot}` : "";
      console.log(
        `  account: plan ${r.currentPlan ?? "(no user doc)"}${spot}` +
          (r.product === "founding" && r.status === "captured" && r.currentPlan !== "pro"
            ? "  <- paid but not pro; see scripts/reconcile-paid-users.mjs"
            : ""),
      );
    }
    console.log();
  }

  const captured = records.filter((r) => r.status === "captured");
  const byCurrency = new Map();
  for (const r of captured) {
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.amount);
  }
  const totals = [...byCurrency]
    .map(([cur, amt]) => `${cur === "INR" ? "₹" : `${cur} `}${amt.toFixed(2)}`)
    .join(" + ");
  console.log(
    `${new Set(captured.map((r) => r.uid ?? r.email)).size} distinct payer(s), ${totals || "0"} captured in total.`,
  );
  if (!haveFirebase) {
    console.log(
      "\nFirebase Admin env vars not set - showing Razorpay checkout emails only, without account plan status.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
