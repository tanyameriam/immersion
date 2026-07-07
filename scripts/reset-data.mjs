#!/usr/bin/env node
/**
 * Wipe ALL Layrrrd data — every saved item, profile, digest, and sign-in
 * account — to get a clean slate before onboarding real users.
 *
 * Runs locally with your Firebase service-account credentials (never exposed on
 * the live site). Dry-run by default; pass --confirm to actually delete.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reset-data.mjs            # dry run (counts only)
 *   node --env-file=.env.local scripts/reset-data.mjs --confirm  # actually wipe
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const CONFIRM = process.argv.includes("--confirm");

const COLLECTIONS = [
  "knowledgeItems",
  "users",
  "preferences",
  "recommendations",
  "weeklyDigests",
  "notifications",
  "analytics",
  "systemJobs",
];

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/reset-data.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function deleteCollection(db, name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return 0;
  if (!CONFIRM) return snap.size;

  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 400)) batch.delete(doc.ref);
    await batch.commit();
    deleted += Math.min(400, docs.length - i);
  }
  return deleted;
}

async function deleteAllAuthUsers(auth) {
  let count = 0;
  let pageToken;
  const uids = [];
  do {
    const res = await auth.listUsers(1000, pageToken);
    uids.push(...res.users.map((u) => u.uid));
    pageToken = res.pageToken;
  } while (pageToken);

  count = uids.length;
  if (!CONFIRM) return count;

  for (let i = 0; i < uids.length; i += 1000) {
    await auth.deleteUsers(uids.slice(i, i + 1000));
  }
  return count;
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const auth = getAuth();

  console.log(
    CONFIRM
      ? "⚠️  DELETING all data (this cannot be undone)…\n"
      : "DRY RUN — counts only. Re-run with --confirm to actually delete.\n",
  );

  for (const name of COLLECTIONS) {
    const n = await deleteCollection(db, name);
    console.log(`  ${CONFIRM ? "deleted" : "would delete"} ${n} docs in ${name}`);
  }

  const users = await deleteAllAuthUsers(auth);
  console.log(
    `  ${CONFIRM ? "deleted" : "would delete"} ${users} sign-in accounts\n`,
  );

  console.log(CONFIRM ? "✅ Clean slate. Ready for real users." : "Nothing deleted.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
