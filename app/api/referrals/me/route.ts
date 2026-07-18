import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import {
  ensureReferralCode,
  getReferralStats,
  appUrl,
} from "@/lib/referrals/server";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const code = await ensureReferralCode(user.uid);
    const stats = await getReferralStats(user.uid);

    return jsonWithCors(req, {
      code,
      link: `${appUrl()}/?ref=${encodeURIComponent(code)}`,
      stats,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("GET /api/referrals/me failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
