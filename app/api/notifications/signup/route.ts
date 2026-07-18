import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { notifyNewSignup } from "@/lib/notifications/admin";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    await notifyNewSignup(user);
    return jsonWithCors(req, { ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/notifications/signup failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
