import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only Firebase Admin. Bypasses security rules - used for verifying ID
 * tokens and for all AI / privileged writes. NEVER import this into a file that
 * runs in the browser ("use client").
 */

function initAdmin(): App {
  // Serverless re-invocation would otherwise throw "app already exists".
  if (getApps().length) return getApp();

  // Emulator mode (local dev): the Admin SDK talks to the emulators when
  // FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are set, and no
  // service-account credentials are needed (or wanted - their presence would
  // still be validated). See docs/environments.md.
  if (
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
  ) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "demo-layrrrd",
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores the private key with literal "\n"; convert to real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminAuth(): Auth {
  return getAuth(initAdmin());
}

export function adminDb(): Firestore {
  return getFirestore(initAdmin());
}
