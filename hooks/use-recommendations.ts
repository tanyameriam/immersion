"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { Resource } from "@/lib/dashboard-data";

/** Loads community recommendations (topic overlap with other users), a small
 * "discover" set nudging the user toward new topics, and a few public
 * articles from external feeds matched to their interests. */
export function useRecommendations() {
  const { user, hydrated } = useAuth();
  const [recommendations, setRecommendations] = useState<Resource[]>([]);
  const [discover, setDiscover] = useState<Resource[]>([]);
  const [web, setWeb] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await apiFetch("/api/recommendations");
    if (!res.ok) {
      setRecommendations([]);
      setDiscover([]);
      setWeb([]);
      return;
    }
    const data = (await res.json()) as {
      recommendations: Resource[];
      discover?: Resource[];
      web?: Resource[];
    };
    setRecommendations(data.recommendations ?? []);
    setDiscover(data.discover ?? []);
    setWeb(data.web ?? []);
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

  return { recommendations, discover, web, loading, refetch };
}
