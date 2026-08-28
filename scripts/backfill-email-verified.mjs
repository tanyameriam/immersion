#!/usr/bin/env node
/**
 * Grandfather existing password accounts into the email-verification check.
 *
 * New password signups must now confirm their address with an emailed code
 * before they can use Layrrrd (lib/auth/email-verification.ts). The gate reads
 * Firebase's native `emailVerified` flag, which every account created before
 * the check was shipped has sitting at false - so without this backfill, every
 * existing user would be locked out of their own account on deploy.
 *
 * Only accounts created BEFORE the cutoff are touched, so running this later
 * can never wave through someone who signed up after the check went live.
 * Google accounts are skipped: they already arrive verified.
 *
 * Dry-run by default: reports what it would change and writes nothing.
 *
 *   node --env-file=.env.local scripts/backfill-email-verified.mjs
 *   node --env-file=.env.local scripts/backfill-email-verified.mjs --confirm
 *   node --env-file=.env.local scripts/backfill-email-verified.mjs --before 2026-08-28T12:00:00Z --confirm
 *
 * Run it BEFORE deploying the gate, so there is never a window where an
 * existing user is shut out.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const confirm = process.argv.includes("--confirm");
const beforeArg = process.argv.indexOf("--before");
const cutoff =
  beforeArg !== -1 && process.argv[beforeArg + 1]
    ? new Date(process.argv[beforeArg + 1])
    : new Date();

if (Number.isNaN(cutoff.getTime())) {
  console.error("Invalid --before value. Use an ISO timestamp.");
  process.exit(1);
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/backfill-email-verified.mjs",
    );
    process.exit(1);
  }
  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return { projectId };
}

const { projectId } = initAdmin();
const auth = getAuth();

console.log(`Project: ${projectId}`);
console.log(`Cutoff:  accounts created before ${cutoff.toISOString()}`);
console.log(confirm ? "Mode:    WRITE\n" : "Mode:    dry run (pass --confirm to write)\n");

const targets = [];
let scanned = 0;
let alreadyVerified = 0;
let googleOnly = 0;
let afterCutoff = 0;

let page = await auth.listUsers(1000);
for (;;) {
  for (const u of page.users) {
    scanned++;
    if (u.emailVerified) {
      alreadyVerified++;
      continue;
    }
    const providers = u.providerData.map((p) => p.providerId);
    if (!providers.includes("password")) {
      googleOnly++;
      continue;
    }
    if (new Date(u.metadata.creationTime) >= cutoff) {
      // Signed up after the gate existed - they must verify like everyone new.
      afterCutoff++;
      continue;
    }
    if (!u.email) continue;
    targets.push({ uid: u.uid, email: u.email, created: u.metadata.creationTime });
  }
  if (!page.pageToken) break;
  page = await auth.listUsers(1000, page.pageToken);
}

console.log(`Scanned:            ${scanned}`);
console.log(`Already verified:   ${alreadyVerified}`);
console.log(`No password login:  ${googleOnly}`);
console.log(`Created after cutoff (must verify): ${afterCutoff}`);
console.log(`To grandfather:     ${targets.length}\n`);

if (!targets.length) {
  console.log("Nothing to do.");
  process.exit(0);
}

for (const t of targets) {
  if (!confirm) {
    console.log(`  would verify  ${t.email}  (created ${t.created})`);
    continue;
  }
  try {
    await auth.updateUser(t.uid, { emailVerified: true });
    console.log(`  verified      ${t.email}`);
  } catch (err) {
    console.error(`  FAILED        ${t.email}: ${err.message}`);
  }
}

console.log(
  confirm
    ? `\nDone. Grandfathered ${targets.length} account(s).`
    : `\nDry run only. Re-run with --confirm to apply.`,
);
