"use client";

import { useEffect, useState } from "react";
import { formatInr } from "@/lib/billing/config";
import type { FoundingStatus } from "@/lib/billing/founding";

/**
 * Live founding-membership availability from GET /api/founding/status.
 * `status` is null until the fetch lands (render the static tier prices from
 * lib/founding-membership.ts as the fallback) and stays null if it fails.
 */
export function useFoundingStatus() {
  const [status, setStatus] = useState<FoundingStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/founding/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.claimedSpots === "number") {
          setStatus(data as FoundingStatus);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    status,
    soldOut: status?.soldOut ?? false,
    remainingSpots: status ? status.totalSpots - status.claimedSpots : null,
    currentPriceLabel: status ? formatInr(status.currentPricePaise) : null,
  };
}
