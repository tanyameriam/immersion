"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase/client";
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
  /** Real Google sign-in (replaces the former mock email/password login). */
  signInWithGoogle: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
      provider: "google",
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

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u ? toAuthUser(u) : null);
      setHydrated(true);
      if (u) {
        try {
          await upsertUserProfile(u);
        } catch (err) {
          console.error("Failed to upsert user profile", err);
        }
      }
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
        logout: () => {
          void fbSignOut(auth);
        },
      }}
    >
      {children}
      <AuthModal />
    </AuthContext.Provider>
  );
}
