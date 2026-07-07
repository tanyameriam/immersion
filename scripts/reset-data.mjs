#!/usr/bin/env node
/**
 * Delete Layrrrd data — either ONE specific user (+ all their content) or
 * EVERYTHING (clean slate before onboarding real users).
 *
 * Runs locally with your Firebase service-account credentials (never exposed on
 * the live site). Dry-run by default; pass --confirm to actually delete.
 *
 * Usage:
 *   # Wipe everything:
 *   node --env-file=.env.local scripts/reset-data.mjs                       # dry run
 *   node --env-file=.env.local scripts/reset-data.mjs --confirm             # wipe all
 *
 *   # Remove one user (by email or UID) and all their saved content:
 *   node --env-file=.env.local scripts/reset-data.mjs --user someone@x.com  # dry run
 *   node --env-file=.env.local scripts/reset-data.mjs --user someone@x.com --confirm
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const CONFIRM = process.argv.includes("--confirm");

function getFlag(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}
const TARGET_USER = getFlag("--user");

// Collections keyed by the user's UID as the document id.
const DOC_ID_COLLECTIONS = ["users", "preferences"];
// Collections with a `userId` field.
const USER_FIELD_COLLECTIONS = [
  "knowledgeItems",
  "recommendations",
  "weeklyDigests",
  "notifications",
  "analytics",
];
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

async function resolveUid(auth, target) {
  // Accept either an email or a raw UID.
  if (target.includes("@")) {
    try {
      const rec = await auth.getUserByEmail(target);
      return rec.uid;
    } catch {
      return null;
    }
  }
  try {
    const rec = await auth.getUser(target);
    return rec.uid;
  } catch {
    return null;
  }
}

async function deleteOneUser(db, auth, target) {
  const label = CONFIRM ? "deleted" : "would delete";
  const uid = await resolveUid(auth, target);
  if (!uid) {
    console.log(`No account found for "${target}".`);
    process.exit(1);
  }
  console.log(`Target user: ${target}  (uid: ${uid})\n`);

  const verb = CONFIRM ? "DELETING" : "DRY RUN — would delete";
  console.log(`${verb} this user's data…\n`);

  // Docs keyed by uid.
  for (const name of DOC_ID_COLLECTIONS) {
    const ref = db.collection(name).doc(uid);
    const doc = await ref.get();
    const n = doc.exists ? 1 : 0;
    if (n && CONFIRM) await ref.delete();
    console.log(`  ${label} ${n} doc in ${name}`);
  }

  // Docs with a userId field.
  for (const name of USER_FIELD_COLLECTIONS) {
    const snap = await db.collection(name).where("userId", "==", uid).get();
    const n = snap.size;
    if (n && CONFIRM) {
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch();
        for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }
    console.log(`  ${label} ${n} docs in ${name}`);
  }

  if (CONFIRM) await auth.deleteUser(uid);
  console.log(`  ${label} 1 sign-in account\n`);

  console.log(CONFIRM ? "✅ User removed." : "Nothing deleted.");
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const auth = getAuth();

  if (TARGET_USER) {
    await deleteOneUser(db, auth, TARGET_USER);
    process.exit(0);
  }

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
