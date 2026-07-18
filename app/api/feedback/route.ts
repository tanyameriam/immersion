import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { notifyFeedback } from "@/lib/notifications/admin";

export const runtime = "nodejs";

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(""),
  page: z.string().trim().max(2048).optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")),
});

async function getOptionalAuthedUser(req: Request) {
  if (!req.headers.get("authorization")) return null;

  return getAuthedUser(req);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = FeedbackSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const authedUser = await getOptionalAuthedUser(req);
    const email = authedUser?.email ?? parsed.data.email ?? "";

    await adminDb().collection("feedback").add({
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      page: parsed.data.page,
      email,
      userId: authedUser?.uid ?? null,
      authSource: authedUser ? "firebase" : "client",
      createdAt: FieldValue.serverTimestamp(),
    });

    await notifyFeedback({
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      page: parsed.data.page,
      email,
      userId: authedUser?.uid ?? null,
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/feedback failed", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
