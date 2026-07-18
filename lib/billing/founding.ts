import { adminDb } from "@/lib/firebase/admin";
import { FOUNDING } from "@/lib/billing/config";

/**
 * Founding Membership spot counter. Single doc billing/founding
 * {claimedSpots}; a missing doc means nobody has claimed a spot yet.
 * Spots are claimed transactionally at payment fulfillment (lib/billing/
 * plan.ts); this module is the read side shared by the order route and the
 * public status endpoint, so price and availability have one authority.
 */

export interface FoundingStatus {
  claimedSpots: number;
  totalSpots: number;
  tier1Cap: number;
  soldOut: boolean;
  /** Price the NEXT spot sells at, by tier. */
  currentPricePaise: number;
}

export const FOUNDING_COUNTER_PATH = { collection: "billing", doc: "founding" };

export function statusForCount(claimedSpots: number): FoundingStatus {
  return {
    claimedSpots,
    totalSpots: FOUNDING.totalSpots,
    tier1Cap: FOUNDING.tier1Cap,
    soldOut: claimedSpots >= FOUNDING.totalSpots,
    currentPricePaise:
      claimedSpots < FOUNDING.tier1Cap
        ? FOUNDING.tier1Paise
        : FOUNDING.tier2Paise,
  };
}

export async function getFoundingStatus(): Promise<FoundingStatus> {
  const snap = await adminDb()
    .collection(FOUNDING_COUNTER_PATH.collection)
    .doc(FOUNDING_COUNTER_PATH.doc)
    .get();
  const claimed = snap.data()?.claimedSpots;
  return statusForCount(typeof claimed === "number" ? claimed : 0);
}
