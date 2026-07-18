import { after } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { limitsFor } from "@/lib/billing/config";
import { getUserPlan } from "@/lib/billing/plan";
import { countItems, createPendingItem, listItems } from "@/lib/firestore/items";
import { processItem } from "@/lib/items/process-item";
import { SaveItemInputSchema } from "@/lib/types/knowledge-item";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60; // room for the after() AI processing

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** Save a page (from the web app or the extension) and kick off AI processing. */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const parsed = SaveItemInputSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithCors(req, { error: "Invalid input" }, 400);
    }

    // Free-plan item cap. With the default config maxItems is null, so no
    // count query runs and this is a no-op until limits are switched on.
    const { maxItems } = limitsFor(await getUserPlan(user.uid));
    if (maxItems !== null && (await countItems(user.uid)) >= maxItems) {
      return jsonWithCors(
        req,
        {
          error: "Free plan save limit reached. Upgrade for unlimited saves.",
          code: "free_limit_items",
          maxItems,
        },
        402,
      );
    }

    const { item, created, reprocess } = await createPendingItem({
      userId: user.uid,
      url: parsed.data.url,
      title: parsed.data.title,
      favicon: parsed.data.favicon,
      note: parsed.data.note,
      clientContent: parsed.data.content,
    });

    // Process in the background after the response is sent (best-effort; the
    // process-on-open sweep is the guaranteed fallback). `reprocess` means an
    // existing unreadable save just received browser-captured content.
    if (created || reprocess) {
      after(async () => {
        try {
          await processItem(item.id);
        } catch (err) {
          console.error("Background processItem failed", err);
        }
      });
    }

    return jsonWithCors(req, { item, created, reprocess }, created ? 201 : 200);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/items failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}

/** List the current user's saved items (extension popup + API consumers),
 * newest first, paginated: ?limit= (default 100, max 200) and ?cursor= (the
 * createdAt ISO of the last item from the previous page). */
export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const params = new URL(req.url).searchParams;
    const limit = Math.min(
      Math.max(Number(params.get("limit")) || 100, 1),
      200,
    );
    const cursor = params.get("cursor") ?? undefined;
    const items = await listItems(user.uid, { limit, cursor });
    const nextCursor =
      items.length === limit ? items[items.length - 1]?.createdAt : undefined;
    return jsonWithCors(req, { items, nextCursor });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("GET /api/items failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
