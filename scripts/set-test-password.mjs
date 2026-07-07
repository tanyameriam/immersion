#!/usr/bin/env node
/**
 * Set (or reset) a password on a Firebase user so teammates can sign in with
 * email + password. Runs locally with the service-account credentials.
 *
 * Usage:
 *   node --env-file=.env.local scripts/set-test-password.mjs [email] [password]
 * Defaults: tanyameriamsunny@gmail.com / test123
 *
 * NOTE: Email/Password sign-in must be enabled in Firebase Console →
 * Authentication → Sign-in method for the password to actually work.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2] || "tanyameriamsunny@gmail.com";
const password = process.argv[3] || "test123";

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin env vars (run with --env-file=.env.local).");
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();

try {
  let uid;
  try {
    const rec = await auth.getUserByEmail(email);
    uid = rec.uid;
    await auth.updateUser(uid, { password });
    console.log(`Updated password for existing user ${email}`);
  } catch {
    const rec = await auth.createUser({ email, password, emailVerified: true });
    uid = rec.uid;
    console.log(`Created new user ${email}`);
  }
  console.log(`✅ ${email} can now sign in with the password "${password}" (uid: ${uid})`);
  console.log("   Make sure Email/Password is enabled in Firebase → Authentication → Sign-in method.");
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
