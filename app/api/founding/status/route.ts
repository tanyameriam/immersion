import { getFoundingStatus } from "@/lib/billing/founding";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** Public founding-membership availability: live claimed spots and the
 * price the next spot sells at. Read per request; a stale "spots left"
 * number is worse than the read cost at this scale. */
export async function GET(req: Request) {
  try {
    return jsonWithCors(req, await getFoundingStatus());
  } catch (err) {
    console.error("GET /api/founding/status failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
