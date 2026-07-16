import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { searchItems } from "@/lib/firestore/items";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

/** Words too generic to be worth an indexed lookup. */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "about",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

export function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * Search the current user's whole library by keyword/topic tokens (the
 * denormalized fields written at processing time). This is exact-token
 * matching, not substring search - it exists so items older than the
 * dashboard's loaded window are still findable.
 */
export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const tokens = q
      .toLowerCase()
      .split(/[^\p{L}\p{N}-]+/u)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
    const items = await searchItems(user.uid, tokens);
    return jsonWithCors(req, { items });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("GET /api/items/search failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
