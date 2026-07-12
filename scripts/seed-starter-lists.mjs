#!/usr/bin/env node
/**
 * Seed the onboarding starter lists into Firestore from the editorial JSON in
 * scripts/data/starter-lists/. One JSON file per topic; the filename (minus
 * .json) is the topic slug and the Firestore doc id at starterLists/{slug}.
 *
 * Editorial workflow, no code changes needed: edit the JSON (or add a file
 * for a new topic), rerun this script. Docs are fully replaced, so items
 * removed from the JSON disappear from the app.
 *
 * Runs locally with your Firebase service-account credentials. Dry-run by
 * default; pass --confirm to actually write.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-starter-lists.mjs               # dry run
 *   node --env-file=.env.local scripts/seed-starter-lists.mjs --confirm     # write all
 *   node --env-file=.env.local scripts/seed-starter-lists.mjs --topic ux-design --confirm
 *   node --env-file=.env.local scripts/seed-starter-lists.mjs --skip-images --confirm
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const CONFIRM = process.argv.includes("--confirm");
const SKIP_IMAGES = process.argv.includes("--skip-images");

function getFlag(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}
const ONLY_TOPIC = getFlag("--topic");

const DATA_DIR = join(import.meta.dirname, "data", "starter-lists");
const MEDIUMS = new Set(["article", "video", "podcast"]);

// Keep in sync with INTEREST_GROUPS in lib/constants.ts (slugified). Used only
// to warn about topics with no starter list; missing docs are fine at runtime.
const KNOWN_TOPIC_SLUGS = [
  "product-design", "ux-design", "ui-design", "graphic-design", "branding",
  "motion-design", "design-systems", "typography", "illustration", "web-design",
];

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/seed-starter-lists.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

function stableId(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 12);
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Best-effort og:image lookup so article cards get a real thumbnail. */
async function fetchOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; LayrrrdSeeder/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const src = m?.[1]?.trim();
    return src && isHttpUrl(src) ? src : null;
  } catch {
    return null;
  }
}

function loadFile(file) {
  const slug = file.replace(/\.json$/, "");
  const raw = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  const problems = [];
  if (!raw.topic || typeof raw.topic !== "string") problems.push("missing topic");
  const seen = new Set();
  const items = [];
  for (const item of raw.items ?? []) {
    if (!item.title || !isHttpUrl(item.url ?? "")) {
      problems.push(`bad item: ${JSON.stringify(item.title ?? item.url)}`);
      continue;
    }
    if (!MEDIUMS.has(item.medium)) {
      problems.push(`bad medium "${item.medium}" on: ${item.title}`);
      continue;
    }
    if (seen.has(item.url)) continue; // dedupe within a file
    seen.add(item.url);
    items.push({
      id: stableId(item.url),
      title: item.title,
      url: item.url,
      source: item.source ?? "",
      medium: item.medium,
      ...(item.image && isHttpUrl(item.image) ? { image: item.image } : {}),
      ...(Number.isFinite(item.readingTime) ? { readingTime: item.readingTime } : {}),
    });
  }
  if (items.length < 10 || items.length > 15) {
    console.warn(`  ⚠ ${slug}: ${items.length} items (editorial target is 10-15)`);
  }
  return { slug, topic: raw.topic, items, problems };
}

async function main() {
  let files;
  try {
    files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`No data directory at ${DATA_DIR}`);
    process.exit(1);
  }
  if (ONLY_TOPIC) files = files.filter((f) => f === `${ONLY_TOPIC}.json`);
  if (!files.length) {
    console.error("No starter-list JSON files matched.");
    process.exit(1);
  }

  const lists = files.map(loadFile);
  const failed = lists.filter((l) => l.problems.length);
  for (const l of failed) {
    console.error(`✗ ${l.slug}: ${l.problems.join("; ")}`);
  }
  if (failed.length) process.exit(1);

  // Cross-file dedupe check (same url in two topics is allowed at runtime,
  // the API dedupes, but it usually signals an editorial mistake).
  const urlToSlug = new Map();
  for (const l of lists) {
    for (const item of l.items) {
      const other = urlToSlug.get(item.url);
      if (other) console.warn(`  ⚠ duplicate across topics (${other}, ${l.slug}): ${item.url}`);
      urlToSlug.set(item.url, l.slug);
    }
  }

  if (!SKIP_IMAGES) {
    console.log("Filling missing images from og:image (best effort)…");
    for (const l of lists) {
      for (const item of l.items) {
        if (item.image) continue;
        const img = await fetchOgImage(item.url);
        if (img) item.image = img;
      }
    }
  }

  console.log(`\n${CONFIRM ? "Writing" : "DRY RUN (pass --confirm to write)"}:`);
  for (const l of lists) {
    const withImages = l.items.filter((i) => i.image).length;
    console.log(`  ${l.slug}: "${l.topic}", ${l.items.length} items, ${withImages} with images`);
  }

  const missing = KNOWN_TOPIC_SLUGS.filter(
    (slug) => !lists.some((l) => l.slug === slug) && !ONLY_TOPIC,
  );
  if (missing.length) console.warn(`  ⚠ known topics with no JSON: ${missing.join(", ")}`);

  if (!CONFIRM) return;

  initAdmin();
  const db = getFirestore();
  for (const l of lists) {
    await db.collection("starterLists").doc(l.slug).set({
      topic: l.topic,
      items: l.items,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ starterLists/${l.slug}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
