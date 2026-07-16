"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { apiFetch } from "@/lib/api-client";
import type { Resource } from "@/lib/dashboard-data";

type FeedSnapshot = {
  recommendations: Resource[];
  discover: Resource[];
  web: Resource[];
  webHasMore: boolean;
};

const cacheKey = (uid: string) => `layrrrd-recs-${uid}`;

/** Last feed this browser session saw, for instant paint while refreshing. */
function readCachedFeed(uid: string): FeedSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as FeedSnapshot) : null;
  } catch {
    return null;
  }
}

/** Loads community recommendations (topic overlap with other users), a small
 * "discover" set nudging the user toward new topics, and the mixed-medium
 * web feed matched to their taste. The web feed pages for infinite scroll.
 * The last response is kept in sessionStorage so returning to the dashboard
 * paints instantly while a fresh feed loads behind it. */
export function useRecommendations() {
  const { user, hydrated } = useAuth();
  const [recommendations, setRecommendations] = useState<Resource[]>([]);
  const [discover, setDiscover] = useState<Resource[]>([]);
  const [web, setWeb] = useState<Resource[]>([]);
  const [webHasMore, setWebHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const uid = user?.uid ?? "";

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
    const snapshot: FeedSnapshot = {
      recommendations: data.recommendations ?? [],
      discover: data.discover ?? [],
      web: data.web ?? [],
      webHasMore: data.webHasMore ?? false,
    };
    setRecommendations(snapshot.recommendations);
    setDiscover(snapshot.discover);
    setWeb(snapshot.web);
    setWebHasMore(snapshot.webHasMore);
    if (uid) {
      try {
        window.sessionStorage.setItem(cacheKey(uid), JSON.stringify(snapshot));
      } catch {
        // storage full/unavailable - the feed still works, just no fast paint
      }
    }
  }, [uid]);

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
    // Paint the session's last feed immediately; refresh quietly behind it.
    const cached = readCachedFeed(user.uid);
    if (cached) {
      setRecommendations(cached.recommendations);
      setDiscover(cached.discover);
      setWeb(cached.web);
      setWebHasMore(cached.webHasMore);
      setLoading(false);
    }
    (async () => {
      if (!cached) setLoading(true);
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
