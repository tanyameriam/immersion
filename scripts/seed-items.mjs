#!/usr/bin/env node
/**
 * Seed synthetic completed knowledgeItems for one user, to exercise the
 * dashboard's bounded live window, Load more paging, and keyword search at
 * scale. Dev/testing only.
 *
 * Dry-run by default; pass --confirm to actually write.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-items.mjs --user someone@x.com [--count 2000]
 *   node --env-file=.env.local scripts/seed-items.mjs --user someone@x.com --confirm
 */
import { createHash } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const CONFIRM = process.argv.includes("--confirm");

function getFlag(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}
const TARGET_USER = getFlag("--user");
const COUNT = Number(getFlag("--count")) || 2000;

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/seed-items.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const TOPICS = [
  ["ux design", "usability"],
  ["design systems", "tokens"],
  ["typography", "fonts"],
  ["accessibility", "a11y"],
  ["product design", "strategy"],
  ["motion design", "animation"],
  ["color theory", "palettes"],
  ["user research", "interviews"],
];
const KEYWORDS = [
  "figma",
  "contrast",
  "grids",
  "onboarding",
  "wireframes",
  "prototyping",
  "heuristics",
  "navigation",
  "microcopy",
  "spacing",
];
const TYPES = ["article", "article", "article", "video", "podcast"];

const hashId = (userId, url) =>
  createHash("sha256").update(`${userId}::${url}`).digest("hex").slice(0, 24);

async function main() {
  if (!TARGET_USER) {
    console.error("Pass --user <email-or-uid>.");
    process.exit(1);
  }
  initAdmin();
  const db = getFirestore();

  let uid = TARGET_USER;
  if (TARGET_USER.includes("@")) {
    uid = (await getAuth().getUserByEmail(TARGET_USER)).uid;
  }
  console.log(
    `${CONFIRM ? "Seeding" : "Dry run:"} ${COUNT} synthetic items for uid ${uid}.`,
  );
  if (!CONFIRM) {
    console.log("Re-run with --confirm to write.");
    return;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let written = 0;
  for (let start = 0; start < COUNT; start += 400) {
    const batch = db.batch();
    for (let i = start; i < Math.min(start + 400, COUNT); i++) {
      const topicPair = TOPICS[i % TOPICS.length];
      const keyword = KEYWORDS[i % KEYWORDS.length];
      const url = `https://example.com/seeded/${i}`;
      // Spread saves across ~2 years so paging and date filters have depth.
      const createdAt = Timestamp.fromMillis(now - i * ((2 * 365 * dayMs) / COUNT));
      const topics = topicPair.map((t) => t.toLowerCase());
      const keywords = [keyword, `${keyword}-${i % 7}`];
      batch.set(db.collection("knowledgeItems").doc(hashId(uid, url)), {
        userId: uid,
        url,
        title: `Seeded: ${topicPair[0]} and ${keyword} #${i}`,
        description: `Synthetic test item about ${topicPair.join(" and ")}.`,
        image: "",
        favicon: "",
        domain: "example.com",
        type: TYPES[i % TYPES.length],
        status: "completed",
        isFavorite: false,
        isArchived: false,
        read: i % 3 === 0,
        readAt: i % 3 === 0 ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
        processingStartedAt: null,
        retryCount: 0,
        topics,
        keywords,
        ai: {
          summary: `A synthetic summary about ${topicPair[0]}.`,
          tldr: `Seeded item ${i} about ${topicPair[0]} and ${keyword}.`,
          topics: topicPair,
          keywords,
          readingTime: (i % 20) + 2,
          wordCount: 500 + (i % 900),
          degraded: false,
          aiModel: "seed-script",
        },
        error: null,
        note: null,
      });
    }
    await batch.commit();
    written = Math.min(start + 400, COUNT);
    console.log(`  …${written} written`);
  }
  console.log(`Done. ${written} synthetic items seeded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
