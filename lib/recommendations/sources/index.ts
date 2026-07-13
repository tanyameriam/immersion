import type { SourceFetcher } from "./types";
import { mediumSource } from "./medium";
import { youtubeSource } from "./youtube";
import { spotifySource } from "./spotify";
import { googleSearchSource } from "./google-search";

/** Every source the feed can draw from, keyed sources first is irrelevant —
 * interleaving is by score, not registry order. */
export const SOURCES: SourceFetcher[] = [
  mediumSource,
  youtubeSource,
  spotifySource,
  googleSearchSource,
];

/** Sources whose API keys are configured (keyless ones are always on). */
export function enabledSources(): SourceFetcher[] {
  return SOURCES.filter((s) => s.enabled());
}
