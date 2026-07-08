import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { createLinkCode, getBotUsername } from "@/lib/telegram/linking";

export const runtime = "nodejs";

/** Start Telegram linking: returns a one-time deep link to the bot. */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const botUsername = await getBotUsername();
    if (!botUsername) {
      return NextResponse.json(
        { error: "Telegram bot is not configured" },
        { status: 503 },
      );
    }
    const code = await createLinkCode(user.uid);
    return NextResponse.json({
      url: `https://t.me/${botUsername}?start=${code}`,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/telegram/link failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
