"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { resetAnalytics } from "@/lib/analytics";
import { AuthModal } from "@/components/AuthModal";
import {
  clearStoredReferral,
  getStoredReferral,
} from "@/lib/referrals/client";

export type AuthMode = "sign-in" | "sign-up";

export type AuthUser = {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  /** Password signups start false and must enter the emailed code. Google
   * accounts arrive true - Google has already proven the address. */
  emailVerified: boolean;
};

type AuthContextValue = {
  isOpen: boolean;
  mode: AuthMode;
  user: AuthUser | null;
  /** True once Firebase has resolved the initial auth state. */
  hydrated: boolean;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  setMode: (mode: AuthMode) => void;
  signInWithGoogle: () => Promise<void>;
  /** Resolves `{ verified: false }` when the account still owes us a code. */
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ verified: boolean }>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ verified: boolean }>;
  /** Signed in, but the address still needs confirming. Drives the gate. */
  needsVerification: boolean;
  /** (Re)send a code to the signed-in user's address. */
  sendVerificationCode: () => Promise<void>;
  /** Redeem a code; resolves once the refreshed token says verified. */
  verifyEmailCode: (code: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Built-in demo login used for testing the gated experience. Firebase rejects
 * passwords under 6 characters, so this account can't exist in Firebase; it's a
 * client-only bypass that lets you into the (empty) dashboard without a real
 * paid account. Remove once real accounts / payments gate access.
 */
const TEST_EMAIL = "tanyameriamsunny@gmail.com";
const TEST_PASSWORD = "test";
const TEST_SESSION_KEY = "layrrrd-test-session";
const TEST_USER: AuthUser = {
  uid: "test-user",
  name: "Tanya",
  email: TEST_EMAIL,
  photoURL: null,
  emailVerified: true, // client-only bypass, never hits the gate
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    name: u.displayName ?? u.email ?? "there",
    email: u.email ?? "",
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
  };
}

/** Create/refresh the user's `users/{uid}` profile on sign-in. Name and photo
 * are seeded only on first creation; after that the profile page owns them, so
 * a re-login must not clobber the user's edits. */
async function upsertUserProfile(u: User): Promise<void> {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  const base = {
    email: u.email ?? "",
    provider: u.providerData[0]?.providerId ?? "password",
    lastLogin: serverTimestamp(),
  };
  await setDoc(
    ref,
    snap.exists()
      ? base
      : {
          ...base,
          name: u.displayName ?? "",
          profilePhoto: u.photoURL ?? "",
          // Billing default; only ever upgraded server-side (Admin SDK).
          plan: "free",
          createdAt: serverTimestamp(),
        },
    { merge: true },
  );
}

async function callAuthedEndpoint(u: User, path: string, body?: unknown) {
  const token = await u.getIdToken(true);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  if (body) headers.set("Content-Type", "application/json");

  const res = await fetch(path, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
}

/** POST to an endpoint that tolerates an unverified session, returning the
 * parsed body so callers can act on the specific failure reason. */
async function callVerificationEndpoint(
  u: User,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const token = await u.getIdToken();
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  if (body) headers.set("Content-Type", "application/json");

  const res = await fetch(path, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

async function finishNewSignup(u: User): Promise<void> {
  const referral = getStoredReferral();
  if (referral) {
    try {
      await callAuthedEndpoint(u, "/api/referrals/claim", {
        code: referral.code,
      });
    } catch (err) {
      console.error("Failed to claim referral", err);
    } finally {
      clearStoredReferral();
    }
  }

  try {
    await callAuthedEndpoint(u, "/api/notifications/signup");
  } catch (err) {
    console.error("Failed to send signup notification", err);
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // True while the client-only test session is active, so the Firebase auth
  // listener doesn't null it out (the test user has no Firebase session).
  const testSession = useRef(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(TEST_SESSION_KEY) === "1"
    ) {
      testSession.current = true;
      setUser(TEST_USER);
      setHydrated(true);
    }

    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        testSession.current = false;
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(TEST_SESSION_KEY);
        }
        setUser(toAuthUser(u));
        setHydrated(true);
        try {
          await upsertUserProfile(u);
        } catch (err) {
          console.error("Failed to upsert user profile", err);
        }
        return;
      }
      // No Firebase user: keep the test session if one is active.
      if (!testSession.current) setUser(null);
      setHydrated(true);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isOpen,
        mode,
        user,
        hydrated,
        // Google accounts and the test session both carry emailVerified: true,
        // so only unconfirmed password signups trip the gate.
        needsVerification: Boolean(user && !user.emailVerified),
        openAuth: (nextMode) => {
          if (nextMode) setMode(nextMode);
          setIsOpen(true);
        },
        closeAuth: () => setIsOpen(false),
        setMode,
        signInWithGoogle: async () => {
          const cred = await signInWithPopup(auth, googleProvider);
          if (getAdditionalUserInfo(cred)?.isNewUser) {
            await upsertUserProfile(cred.user);
            await finishNewSignup(cred.user);
          }
          setIsOpen(false);
        },
        signInWithEmail: async (email, password) => {
          if (
            email.trim().toLowerCase() === TEST_EMAIL &&
            password === TEST_PASSWORD
          ) {
            testSession.current = true;
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(TEST_SESSION_KEY, "1");
            }
            setUser(TEST_USER);
            setHydrated(true);
            setIsOpen(false);
            return { verified: true };
          }
          const cred = await signInWithEmailAndPassword(auth, email, password);
          setUser(toAuthUser(cred.user));
          if (!cred.user.emailVerified) {
            // Signed up but never confirmed: send a fresh code and let the
            // modal drop them on the verification step.
            await callVerificationEndpoint(
              cred.user,
              "/api/auth/send-verification",
            );
            return { verified: false };
          }
          setIsOpen(false);
          return { verified: true };
        },
        signUpWithEmail: async (name, email, password) => {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          if (name) await updateProfile(cred.user, { displayName: name });
          await upsertUserProfile(cred.user);
          // Referral claim and the admin ping deliberately wait for
          // verification - an address that never confirms shouldn't burn a
          // referral or announce a signup that isn't real yet. They run in
          // verifyEmailCode instead.
          setUser(toAuthUser(cred.user));
          const sent = await callVerificationEndpoint(
            cred.user,
            "/api/auth/send-verification",
          );
          if (!sent.ok && sent.status !== 429) {
            console.error("Failed to send verification code", sent.data);
          }
          return { verified: false };
        },
        sendVerificationCode: async () => {
          const u = auth.currentUser;
          if (!u) throw new Error("Not signed in");
          const res = await callVerificationEndpoint(
            u,
            "/api/auth/send-verification",
          );
          if (!res.ok) {
            throw new Error(String(res.data.error ?? "send_failed"));
          }
        },
        verifyEmailCode: async (code) => {
          const u = auth.currentUser;
          if (!u) throw new Error("Not signed in");

          const res = await callVerificationEndpoint(
            u,
            "/api/auth/verify-email",
            { code },
          );
          if (!res.ok) {
            throw new Error(String(res.data.error ?? "invalid"));
          }

          // The server flipped emailVerified; pull a fresh token so the new
          // claim reaches both this client and the Firestore rules.
          await u.reload();
          await u.getIdToken(true);
          setUser(toAuthUser(u));

          await finishNewSignup(u);
          setIsOpen(false);
        },
        logout: () => {
          testSession.current = false;
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(TEST_SESSION_KEY);
          }
          setUser(null);
          resetAnalytics(); // next visitor on this device starts anonymous
          void fbSignOut(auth);
        },
      }}
    >
      {children}
      <AuthModal />
    </AuthContext.Provider>
  );
}
