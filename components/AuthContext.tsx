"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AuthModal } from "@/components/AuthModal";

export type AuthMode = "sign-in" | "sign-up";

export type AuthUser = {
  name: string;
  email: string;
};

const STORAGE_KEY = "layrrrd:user";

type AuthContextValue = {
  isOpen: boolean;
  mode: AuthMode;
  user: AuthUser | null;
  hydrated: boolean;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  setMode: (mode: AuthMode) => void;
  login: (user: AuthUser, options?: { remember?: boolean }) => void;
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

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored =
      localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // Ignore malformed session data.
      }
    }
    setHydrated(true);
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
        login: (nextUser, options) => {
          setUser(nextUser);
          const payload = JSON.stringify(nextUser);
          if (options?.remember) {
            localStorage.setItem(STORAGE_KEY, payload);
          } else {
            sessionStorage.setItem(STORAGE_KEY, payload);
          }
        },
        logout: () => {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
        },
      }}
    >
      {children}
      <AuthModal />
    </AuthContext.Provider>
  );
}
