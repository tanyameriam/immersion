import { Resend } from "resend";

let client: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Send a digest email via Resend (free tier). No-ops gracefully if RESEND_*
 * env vars are missing so the digest job never hard-fails on config.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const r = resend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!r || !from || !opts.to) return false;

  try {
    const { error } = await r.emails.send({
      from: `Layrrrd <${from}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("Resend error", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send failed", err);
    return false;
  }
}
