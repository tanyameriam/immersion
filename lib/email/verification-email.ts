import { CODE_TTL_MS } from "@/lib/auth/email-verification";

/** Minutes, for the copy - keeps the email honest if the TTL ever changes. */
const ttlMinutes = Math.round(CODE_TTL_MS / 60000);

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Verification email, styled to match the weekly digest (lib/digest/build.ts). */
export function verificationEmailHtml(opts: {
  name: string;
  code: string;
}): string {
  const greeting = opts.name.trim() ? `Hi ${esc(opts.name.trim())},` : "Hi there,";

  return `
  <div style="background:#f4f1ea;padding:32px 0;font-family:Inter,system-ui,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;">
      <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0;">Layrrrd.</p>
      <h1 style="font-size:24px;margin:16px 0 6px;">Confirm your email.</h1>
      <p style="color:#6b6b6b;margin:0 0 24px;font-size:14px;">${greeting} enter this code to finish setting up your account.</p>

      <div style="background:#f4f1ea;padding:20px;text-align:center;margin:0 0 24px;">
        <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin:0 0 8px;">Your code</p>
        <p style="font-size:34px;font-weight:800;letter-spacing:0.32em;color:#1a1a1a;margin:0;">${esc(opts.code)}</p>
      </div>

      <p style="color:#6b6b6b;margin:0;font-size:14px;">This code expires in ${ttlMinutes} minutes.</p>
      <p style="color:#9a9a9a;margin:16px 0 0;font-size:13px;">If you didn't create a Layrrrd account, you can ignore this email. Someone probably mistyped their address.</p>
    </div>
  </div>`;
}

export const VERIFICATION_SUBJECT = "Your Layrrrd verification code";
