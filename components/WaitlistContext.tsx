"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { WaitlistModal } from "@/components/WaitlistModal";

type WaitlistContextValue = {
  isOpen: boolean;
  openWaitlist: () => void;
  closeWaitlist: () => void;
};

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function useWaitlist() {
  const ctx = useContext(WaitlistContext);
  if (!ctx) {
    throw new Error("useWaitlist must be used within a WaitlistProvider");
  }
  return ctx;
}

export default function WaitlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <WaitlistContext.Provider
      value={{
        isOpen,
        openWaitlist: () => setIsOpen(true),
        closeWaitlist: () => setIsOpen(false),
      }}
    >
      {children}
      <WaitlistModal />
    </WaitlistContext.Provider>
  );
}
