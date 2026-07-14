import type { Candidate, SourceFetcher } from "./types";
import { FETCH_TIMEOUT_MS } from "./types";

/**
 * Podcast episodes via the official Spotify Web API (client-credentials flow).
 * Episode search results expose no popularity score, so the documented
 * heuristic is release recency as `engagement` — Spotify's own search ranking
 * (relevance) decides which ten we consider in the first place.
 */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request responded ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    // Renew a few minutes early; a cold lambda just re-fetches.
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return cachedToken.value;
}

type Episode = {
  name?: string;
  description?: string;
  html_description?: string;
  release_date?: string;
  duration_ms?: number;
  images?: { url?: string }[];
  external_urls?: { spotify?: string };
};

export type SpotifyEpisodeDetail = {
  name: string;
  /** Full episode description, HTML stripped. */
  description: string;
  durationMs: number;
  image?: string;
};

/**
 * Full metadata for one episode (the search payload truncates descriptions).
 * Null when Spotify keys aren't configured or the lookup fails — callers
 * degrade to whatever the recommendation card already carried.
 */
export async function fetchSpotifyEpisode(
  id: string,
): Promise<SpotifyEpisodeDetail | null> {
  if (!spotifySource.enabled()) return null;
  try {
    const token = await getToken();
    const res = await fetch(
      `https://api.spotify.com/v1/episodes/${id}?market=US`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) return null;
    const e = (await res.json()) as Episode;
    const description = (e.html_description ?? e.description ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      name: e.name ?? "",
      description,
      durationMs: e.duration_ms ?? 0,
      image: e.images?.[0]?.url,
    };
  } catch (err) {
    console.error(`Spotify episode lookup failed for ${id}`, err);
    return null;
  }
}

export const spotifySource: SourceFetcher = {
  id: "spotify",
  medium: "podcast",
  enabled: () =>
    Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
  async fetchTopic(topic) {
    const token = await getToken();
    const search = new URL("https://api.spotify.com/v1/search");
    search.search = new URLSearchParams({
      q: topic.label,
      type: "episode",
      market: "US",
      limit: "10",
    }).toString();
    const res = await fetch(search.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify search responded ${res.status}`);
    const data = (await res.json()) as { episodes?: { items?: (Episode | null)[] } };

    return (data.episodes?.items ?? [])
      .filter((e): e is Episode => Boolean(e?.external_urls?.spotify && e?.name))
      .map((e): Candidate => {
        const publishedAt = e.release_date
          ? new Date(e.release_date).getTime()
          : 0;
        const url = e.external_urls!.spotify!;
        const description = (e.description ?? "").trim();
        return {
          medium: "podcast",
          topic: topic.label,
          engagement: publishedAt,
          publishedAt,
          resource: {
            id: `web-${url}`,
            title: e.name!,
            description:
              description.length > 200
                ? `${description.slice(0, 200).trimEnd()}…`
                : description,
            category: [topic.label],
            contentType: "Podcast",
            medium: "podcast",
            source: "Spotify",
            readingTime: e.duration_ms
              ? Math.max(1, Math.round(e.duration_ms / 60000))
              : 0,
            publishedDate: publishedAt
              ? new Date(publishedAt).toISOString()
              : new Date().toISOString(),
            url,
            image: e.images?.[0]?.url,
            reason: `A podcast pick for your interest in ${topic.label}`,
            reasonTopic: topic.label,
            kind: "web" as const,
          },
        };
      });
  },
};
