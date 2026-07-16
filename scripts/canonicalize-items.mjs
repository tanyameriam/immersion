#!/usr/bin/env node
/**
 * One-off migration: re-key knowledgeItems docs under their canonical-URL
 * hash and merge historical duplicates (same page saved under utm/share-link
 * variants before URL canonicalization shipped).
 *
 * For each doc whose canonical id differs from its current id:
 *   - copy it to the canonical id (keeping the oldest createdAt, merging the
 *     note, and keeping read=true if either copy was read)
 *   - delete the old doc
 * When two variants collide on the same canonical id, the older doc wins and
 * flags are merged.
 *
 * Mirrors canonicalizeUrl in lib/items/canonical-url.ts - keep in sync if the
 * canonicalization rules change (this script is a one-off, so drift is
 * unlikely to matter after it has run).
 *
 * Dry-run by default; pass --confirm to actually write.
 *
 * Usage:
 *   node --env-file=.env.local scripts/canonicalize-items.mjs            # dry run
 *   node --env-file=.env.local scripts/canonicalize-items.mjs --confirm  # migrate
 */
import { createHash } from "node:crypto";
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
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/canonicalize-items.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

/* ---- canonicalizeUrl mirror (lib/items/canonical-url.ts) ---- */

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);
const SI_TRACKING_HOSTS = ["youtube.com", "youtu.be", "spotify.com"];

const hostMatches = (host, suffixes) =>
  suffixes.some((s) => host === s || host.endsWith(`.${s}`));

function youTubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const short = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      if (short) return short[1];
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalizeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return raw;

  const videoId = youTubeVideoId(raw);
  if (videoId && hostMatches(u.hostname.toLowerCase(), ["youtube.com", "youtu.be"])) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  u.hostname = u.hostname.replace(/^www\./, "");
  u.hash = "";

  const stripSi = hostMatches(u.hostname, SI_TRACKING_HOSTS);
  const kept = [];
  for (const [key, value] of u.searchParams.entries()) {
    const k = key.toLowerCase();
    if (k.startsWith("utm_")) continue;
    if (TRACKING_PARAMS.has(k)) continue;
    if (k === "si" && stripSi) continue;
    kept.push([key, value]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = "";
  for (const [key, value] of kept) u.searchParams.append(key, value);

  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

const hashId = (userId, url) =>
  createHash("sha256").update(`${userId}::${url}`).digest("hex").slice(0, 24);

/* ---- migration ---- */

const createdMs = (data) => data.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;

/** Merge two docs for the same canonical URL: older doc wins, flags merge. */
function mergeDocs(a, b) {
  const [older, newer] = createdMs(a) <= createdMs(b) ? [a, b] : [b, a];
  return {
    ...older,
    read: Boolean(older.read || newer.read),
    readAt: older.readAt ?? newer.readAt ?? null,
    isFavorite: Boolean(older.isFavorite || newer.isFavorite),
    note: older.note || newer.note || null,
  };
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection("knowledgeItems").get();
  console.log(`${snap.size} knowledgeItems docs total.`);

  // canonical id -> merged doc data; plus the set of old ids to delete.
  // Only ids in `dirty` (targets that absorbed a variant) get written.
  const targets = new Map();
  const dirty = new Set();
  const deletions = [];
  let untouched = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const canonicalUrl = canonicalizeUrl(data.url ?? "");
    const canonicalId = hashId(data.userId, canonicalUrl);
    if (canonicalId === doc.id) {
      // Already canonical, but it may absorb variants below.
      if (targets.has(canonicalId)) {
        targets.set(canonicalId, mergeDocs(targets.get(canonicalId), data));
      } else {
        targets.set(canonicalId, data);
      }
      untouched++;
      continue;
    }
    console.log(`  ${doc.id} -> ${canonicalId}  (${data.url} -> ${canonicalUrl})`);
    deletions.push(doc.ref);
    const migrated = { ...data, url: canonicalUrl };
    targets.set(
      canonicalId,
      targets.has(canonicalId) ? mergeDocs(targets.get(canonicalId), migrated) : migrated,
    );
    dirty.add(canonicalId);
  }

  const rewrites = deletions.length;
  console.log(
    `${untouched} already canonical, ${rewrites} docs to re-key/merge.`,
  );
  if (!CONFIRM) {
    console.log("Dry run: nothing written. Re-run with --confirm to migrate.");
    return;
  }
  if (rewrites === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Write merged targets first, then delete old ids (crash-safe ordering).
  const targetEntries = [...targets.entries()].filter(([id]) => dirty.has(id));
  for (let i = 0; i < targetEntries.length; i += 400) {
    const batch = db.batch();
    for (const [id, data] of targetEntries.slice(i, i + 400)) {
      batch.set(db.collection("knowledgeItems").doc(id), data, { merge: true });
    }
    await batch.commit();
  }
  for (let i = 0; i < deletions.length; i += 400) {
    const batch = db.batch();
    for (const ref of deletions.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
  console.log(`Done. ${rewrites} docs migrated to canonical ids.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
