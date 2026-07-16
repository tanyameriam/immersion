#!/usr/bin/env node
/**
 * Backfill denormalized search fields on knowledgeItems: copy ai.topics and
 * ai.keywords (lowercased) to top-level `topics` / `keywords`, which is what
 * the composite indexes in firestore.indexes.json cover. New items get these
 * at processing time; this catches everything saved before that change.
 *
 * Dry-run by default; pass --confirm to actually write.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-search-fields.mjs            # dry run
 *   node --env-file=.env.local scripts/backfill-search-fields.mjs --confirm  # write
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const CONFIRM = process.argv.includes("--confirm");

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/backfill-search-fields.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const lower = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((s) => String(s).toLowerCase().trim())
    .filter(Boolean);

const sameList = (a, b) =>
  Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection("knowledgeItems").get();
  console.log(`${snap.size} knowledgeItems docs total.`);

  let toUpdate = 0;
  let written = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const topics = lower(data.ai?.topics);
    const keywords = lower(data.ai?.keywords);
    if (sameList(data.topics, topics) && sameList(data.keywords, keywords)) {
      continue; // already backfilled (or nothing to write)
    }
    toUpdate++;
    if (!CONFIRM) continue;

    batch.update(doc.ref, { topics, keywords });
    inBatch++;
    if (inBatch === 400) {
      await batch.commit();
      written += inBatch;
      batch = db.batch();
      inBatch = 0;
      console.log(`  …${written} written`);
    }
  }
  if (CONFIRM && inBatch > 0) {
    await batch.commit();
    written += inBatch;
  }

  if (CONFIRM) {
    console.log(`Done. Updated ${written} docs.`);
  } else {
    console.log(
      `Dry run: ${toUpdate} docs would be updated. Re-run with --confirm to write.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
