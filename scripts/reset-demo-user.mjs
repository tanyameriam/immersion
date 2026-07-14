#!/usr/bin/env node
/**
 * Create or reset the local demo account so you can walk the full new-user
 * experience (onboarding → starter picks → personalized dashboard) from
 * scratch. Safe to rerun any time: it wipes the demo user's profile and
 * content, never anyone else's.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reset-demo-user.mjs
 *
 * Then sign in at localhost:3000 with:
 *   email    demo@layrrrd.dev
 *   password layrrrd-demo
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const EMAIL = "demo@layrrrd.dev";
const PASSWORD = "layrrrd-demo";

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin env vars. Run with: node --env-file=.env.local scripts/reset-demo-user.mjs",
    );
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

initAdmin();
const auth = getAuth();
const db = getFirestore();

// Create the auth user, or reset the password if it already exists.
let uid;
try {
  const existing = await auth.getUserByEmail(EMAIL);
  uid = existing.uid;
  await auth.updateUser(uid, { password: PASSWORD });
  console.log(`Auth user exists (${uid}), password reset.`);
} catch {
  const created = await auth.createUser({
    email: EMAIL,
    password: PASSWORD,
    displayName: "Demo User",
  });
  uid = created.uid;
  console.log(`Auth user created (${uid}).`);
}

// Wipe the demo user's data so onboarding runs fresh.
await db.collection("users").doc(uid).delete();
await db.collection("feedCache").doc(uid).delete();
for (const collection of ["knowledgeItems", "weeklyDigests", "botNudges"]) {
  const snap = await db.collection(collection).where("userId", "==", uid).get();
  for (const doc of snap.docs) await doc.ref.delete();
  if (snap.size) console.log(`Deleted ${snap.size} ${collection} docs.`);
}

console.log("\nDemo user is fresh. Sign in at http://localhost:3000 with:");
console.log(`  email    ${EMAIL}`);
console.log(`  password ${PASSWORD}`);
