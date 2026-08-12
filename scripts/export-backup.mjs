#!/usr/bin/env node
/**
 * Export every Firestore collection (including subcollections) to local JSON,
 * as a manual backup for the production project. Run this before risky
 * migrations or destructive scripts. Spark-plan substitute for Firestore's
 * scheduled backups (which need Blaze).
 *
 * Reads credentials from the env file you pass, so the SAME script backs up
 * whichever project those credentials belong to:
 *   node --env-file=.env.local scripts/export-backup.mjs
 *
 * Output: backups/<project-id>-<timestamp>/<collection-path>.json (gitignored).
 * Timestamps serialize as {_seconds,_nanoseconds}; auth users are exported to
 * auth-users.json (uid, email, provider - no passwords, Firebase never
 * exposes password hashes here).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/export-backup.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return projectId;
}

async function exportCollection(outDir, collectionRef) {
  const snap = await collectionRef.get();
  const docs = {};
  const subcollectionRefs = [];
  for (const doc of snap.docs) {
    docs[doc.id] = doc.data();
    subcollectionRefs.push(...(await doc.ref.listCollections()));
  }
  // Collection path like "users/abc/notes" → file "users.abc.notes.json".
  const fileName = collectionRef.path.replaceAll("/", ".") + ".json";
  await writeFile(path.join(outDir, fileName), JSON.stringify(docs, null, 2));
  console.log(`  ${collectionRef.path}: ${snap.size} docs`);
  for (const sub of subcollectionRefs) await exportCollection(outDir, sub);
  return snap.size;
}

async function exportAuthUsers(outDir, auth) {
  const users = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    users.push(
      ...res.users.map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        providers: u.providerData.map((p) => p.providerId),
        createdAt: u.metadata.creationTime,
      })),
    );
    pageToken = res.pageToken;
  } while (pageToken);
  await writeFile(
    path.join(outDir, "auth-users.json"),
    JSON.stringify(users, null, 2),
  );
  console.log(`  auth users: ${users.length}`);
}

async function main() {
  const projectId = initAdmin();
  const db = getFirestore();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join("backups", `${projectId}-${stamp}`);
  await mkdir(outDir, { recursive: true });
  console.log(`Backing up ${projectId} → ${outDir}\n`);

  let total = 0;
  for (const col of await db.listCollections()) {
    total += await exportCollection(outDir, col);
  }
  await exportAuthUsers(outDir, getAuth());

  console.log(`\n✅ Backup complete (${total} Firestore docs).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
