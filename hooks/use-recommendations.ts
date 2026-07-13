"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { Resource } from "@/lib/dashboard-data";

/** Loads community recommendations (topic overlap with other users), a small
 * "discover" set nudging the user toward new topics, and the mixed-medium
 * web feed matched to their taste. The web feed pages for infinite scroll. */
export function useRecommendations() {
  const { user, hydrated } = useAuth();
  const [recommendations, setRecommendations] = useState<Resource[]>([]);
  const [discover, setDiscover] = useState<Resource[]>([]);
  const [web, setWeb] = useState<Resource[]>([]);
  const [webHasMore, setWebHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const refetch = useCallback(async () => {
    const res = await apiFetch("/api/recommendations");
    if (!res.ok) {
      setRecommendations([]);
      setDiscover([]);
      setWeb([]);
      setWebHasMore(false);
      return;
    }
    const data = (await res.json()) as {
      recommendations: Resource[];
      discover?: Resource[];
      web?: Resource[];
      webHasMore?: boolean;
    };
    setRecommendations(data.recommendations ?? []);
    setDiscover(data.discover ?? []);
    setWeb(data.web ?? []);
    setWebHasMore(data.webHasMore ?? false);
  }, []);

  // Offset for the next page = how many web items we already show.
  const webRef = useRef<Resource[]>([]);
  useEffect(() => {
    webRef.current = web;
  }, [web]);

  /** Next page of the web feed, appended (infinite scroll). */
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await apiFetch(`/api/recommendations?webOffset=${webRef.current.length}`);
      if (!res.ok) throw new Error(`recommendations page ${res.status}`);
      const data = (await res.json()) as { web?: Resource[]; webHasMore?: boolean };
      const fresh = data.web ?? [];
      setWeb((prev) => {
        const seen = new Set(prev.map((r) => r.url));
        return [...prev, ...fresh.filter((r) => !seen.has(r.url))];
      });
      setWebHasMore(data.webHasMore ?? false);
    } catch (err) {
      console.error("load more recommendations failed", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
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

  return {
    recommendations,
    discover,
    web,
    webHasMore,
    loading,
    loadingMore,
    refetch,
    loadMore,
  };
}
