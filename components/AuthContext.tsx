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
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
import { resetAnalytics } from "@/lib/analytics";
import { AuthModal } from "@/components/AuthModal";

export type AuthMode = "sign-in" | "sign-up";

export type AuthUser = {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
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
  };
}

/** Create/refresh the user's `users/{uid}` profile on sign-in. */
async function upsertUserProfile(u: User): Promise<void> {
  await setDoc(
    doc(db, "users", u.uid),
    {
      name: u.displayName ?? "",
      email: u.email ?? "",
      profilePhoto: u.photoURL ?? "",
      provider: u.providerData[0]?.providerId ?? "password",
      lastLogin: serverTimestamp(),
      createdAt: serverTimestamp(), // merge keeps the first-write value
    },
    { merge: true },
  );
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
        openAuth: (nextMode) => {
          if (nextMode) setMode(nextMode);
          setIsOpen(true);
        },
        closeAuth: () => setIsOpen(false),
        setMode,
        signInWithGoogle: async () => {
          await signInWithPopup(auth, googleProvider);
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
            return;
          }
          await signInWithEmailAndPassword(auth, email, password);
          setIsOpen(false);
        },
        signUpWithEmail: async (name, email, password) => {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          if (name) await updateProfile(cred.user, { displayName: name });
          await upsertUserProfile(cred.user);
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
