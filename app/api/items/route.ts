import { after } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { createPendingItem, listItems } from "@/lib/firestore/items";
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

    const { item, created } = await createPendingItem({
      userId: user.uid,
      url: parsed.data.url,
      title: parsed.data.title,
      favicon: parsed.data.favicon,
      note: parsed.data.note,
    });

    // Process in the background after the response is sent (best-effort; the
    // process-on-open sweep is the guaranteed fallback).
    if (created) {
      after(async () => {
        try {
          await processItem(item.id);
        } catch (err) {
          console.error("Background processItem failed", err);
        }
      });
    }

    return jsonWithCors(req, { item, created }, created ? 201 : 200);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/items failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}

/** List the current user's saved items (web app + extension popup). */
export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const items = await listItems(user.uid);
    return jsonWithCors(req, { items });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("GET /api/items failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
