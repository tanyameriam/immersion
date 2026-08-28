import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  getAuthedUserAllowUnverified,
  UnauthorizedError,
} from "@/lib/firebase/verify-auth";
import { CODE_LENGTH, checkCode } from "@/lib/auth/email-verification";

export const runtime = "nodejs";

/**
 * Redeem a code. On success we flip Firebase's native `emailVerified`, which
 * is what every other gate reads - the Firestore rules via
 * `request.auth.token.email_verified` and the server via
 * lib/firebase/verify-auth.ts. The client must then force-refresh its ID token
 * to pick the new claim up.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUserAllowUnverified(req);
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "").trim();
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const result = await checkCode(user.uid, code);
    if (!result.ok) {
      // 400 rather than 401: the session is fine, the code isn't.
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    await adminAuth().updateUser(user.uid, { emailVerified: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/auth/verify-email failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
