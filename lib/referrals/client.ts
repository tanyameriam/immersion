const STORAGE_KEY = "layrrrd-referral";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredReferral = {
  code: string;
  expiresAt: number;
};

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

export function storeReferralCode(code: string): StoredReferral | null {
  if (typeof window === "undefined") return null;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const stored = {
    code: normalized,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function getStoredReferral(): StoredReferral | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredReferral>;
    if (
      typeof parsed.code !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      clearStoredReferral();
      return null;
    }
    const code = normalizeReferralCode(parsed.code);
    if (!code) {
      clearStoredReferral();
      return null;
    }
    return { code, expiresAt: parsed.expiresAt };
  } catch {
    clearStoredReferral();
    return null;
  }
}

export function clearStoredReferral(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
