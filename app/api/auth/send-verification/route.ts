import { NextResponse } from "next/server";
import {
  getAuthedUserAllowUnverified,
  UnauthorizedError,
} from "@/lib/firebase/verify-auth";
import { issueCode } from "@/lib/auth/email-verification";
import { sendEmail } from "@/lib/email/resend";
import {
  VERIFICATION_SUBJECT,
  verificationEmailHtml,
} from "@/lib/email/verification-email";

export const runtime = "nodejs";

/**
 * Mail a fresh verification code to the signed-in user's own address. The
 * address comes from the verified ID token, never from the request body, so
 * this can't be pointed at someone else's inbox.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUserAllowUnverified(req);

    // Already done (or a Google account): nothing to send, and saying so lets
    // the client skip straight past the gate.
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    if (!user.email) {
      return NextResponse.json({ error: "no_email" }, { status: 400 });
    }

    const issued = await issueCode(user.uid, user.email);
    if (!issued.ok) {
      return NextResponse.json(
        { error: issued.reason, retryAfterMs: issued.retryAfterMs },
        { status: 429 },
      );
    }

    const sent = await sendEmail({
      to: user.email,
      subject: VERIFICATION_SUBJECT,
      html: verificationEmailHtml({
        name: user.name ?? "",
        code: issued.code,
      }),
    });
    if (!sent) {
      // The code is live but undeliverable; let the client offer a retry.
      return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/auth/send-verification failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
