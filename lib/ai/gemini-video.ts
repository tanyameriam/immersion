/**
 * Genuine content-based YouTube summaries via the Gemini API, which
 * officially accepts public YouTube URLs as input and processes the actual
 * video/audio. Used when the caption transcript isn't fetchable (YouTube
 * gates it for non-browser clients). Gemini does the watching and returns
 * detailed timestamped notes; the existing Claude pipeline structures them
 * into the chaptered summary, so the data model and validation are shared.
 *
 * Free-tier friendly: needs GEMINI_API_KEY (aistudio.google.com/apikey);
 * without it this module is a silent no-op and callers fall back.
 */

const MODEL = "gemini-2.5-flash";
/** Watching a long talk takes a while; the web-summary route allows 60s. */
const TIMEOUT_MS = 45_000;
const MAX_NOTES_CHARS = 14_000;

export async function watchYouTubeVideo(url: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { file_data: { file_uri: url } },
                {
                  text:
                    "Watch this video and write detailed notes that could " +
                    "replace watching it. Work through it in order, marking " +
                    "each major segment with its starting timestamp like " +
                    "[04:30]. Capture the key arguments, examples, numbers, " +
                    "steps, and conclusions actually said in the video, not " +
                    "just what it is about. Plain text only, no markdown.",
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
        }),
      },
    );
    if (!res.ok) {
      console.error(`Gemini video watch failed: ${res.status} ${await res.text().catch(() => "")}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const notes = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("\n")
      .trim()
      .slice(0, MAX_NOTES_CHARS);
    // Too short means Gemini couldn't actually process the video.
    return notes.length > 300 ? notes : null;
  } catch (err) {
    console.error(`Gemini video watch failed for ${url}`, err);
    return null;
  }
}
