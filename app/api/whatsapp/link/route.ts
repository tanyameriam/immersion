import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { createLinkCode, getBusinessNumber } from "@/lib/whatsapp/linking";

export const runtime = "nodejs";

/** Start WhatsApp linking: returns a one-time wa.me link with a prefilled
 * "connect <code>" message for Rudolf's business number. */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const number = getBusinessNumber();
    if (!number) {
      return NextResponse.json(
        { error: "WhatsApp is not configured" },
        { status: 503 },
      );
    }
    const code = await createLinkCode(user.uid);
    return NextResponse.json({
      url: `https://wa.me/${number}?text=${encodeURIComponent(`connect ${code}`)}`,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/whatsapp/link failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
