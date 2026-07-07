"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { Resource } from "@/lib/dashboard-data";

/** Loads community recommendations (topic overlap with other users). */
export function useRecommendations() {
  const { user, hydrated } = useAuth();
  const [recommendations, setRecommendations] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await apiFetch("/api/recommendations");
    if (!res.ok) {
      setRecommendations([]);
      return;
    }
    const data = (await res.json()) as { recommendations: Resource[] };
    setRecommendations(data.recommendations ?? []);
  }, []);

  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refetch();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user, refetch]);

  return { recommendations, loading, refetch };
}
