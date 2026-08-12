import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Browser-side Firebase. These NEXT_PUBLIC_* values are public by design -
 * access is enforced by Firestore security rules, not by hiding this config.
 */
// Fallbacks let `next build` (the CI gate) run without secrets - `getAuth`
// throws on an empty apiKey during prerender. Vercel injects the real
// NEXT_PUBLIC_* values at build time, so production always uses real config.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "build-placeholder-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "placeholder",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "placeholder.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "placeholder",
};

// Reuse the app across hot reloads / re-renders.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Local dev against the Firebase Emulator Suite (`npm run emulators`) instead
// of any real project. Opt-in via NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1 in
// .env.local. The globalThis flag survives Fast Refresh re-evaluation of this
// module - connecting the same instance twice throws.
declare global {
  // eslint-disable-next-line no-var
  var __layrrrdEmulatorsConnected: boolean | undefined;
}
if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "1" &&
  !globalThis.__layrrrdEmulatorsConnected
) {
  globalThis.__layrrrdEmulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
