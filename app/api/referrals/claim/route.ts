import { z } from "zod";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { claimReferralForUser } from "@/lib/referrals/server";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

const ClaimSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const parsed = ClaimSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithCors(req, { error: "Invalid input" }, 400);
    }

    const result = await claimReferralForUser(user, parsed.data.code);
    return jsonWithCors(req, result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/referrals/claim failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
