import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { digestConsentPrompt, type UserDigest } from "@/lib/digest/build";
import { htmlToWhatsAppText } from "@/lib/whatsapp/chat";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp/send";

/**
 * The weekly "want your digest?" ask on WhatsApp. Same consent model as
 * Telegram (the content itself only goes out once the user replies yes, see
 * lib/rudolf/chat.ts), but WhatsApp's 24-hour rule decides how the ask goes:
 *
 * - The user messaged Rudolf recently: the window is open, so the ask is a
 *   normal free-form message, free of charge.
 * - Otherwise: only a pre-approved template is allowed, billed per delivery.
 *   Its Yes / No thanks quick-reply buttons come back as an inbound message,
 *   which reopens the window, so the digest that follows is free again.
 *
 * Templates are capped per calendar month (WHATSAPP_TEMPLATE_MONTHLY_CAP) so
 * a growing user base can't quietly run up the Meta bill; over the cap, or
 * with no template configured, the ask fails and the cron falls back to
 * email.
 */

/** Meta's window is 24h from the user's last message; leave slack for the
 * cron run itself and clock skew. */
const FREE_WINDOW_MS = 23 * 60 * 60 * 1000;
const DEFAULT_MONTHLY_CAP = 500;
const USAGE_COLLECTION = "whatsappUsage";

export type WhatsAppDigestAsk = "free" | "template";

function monthlyCap(): number {
  const raw = Number(process.env.WHATSAPP_TEMPLATE_MONTHLY_CAP);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MONTHLY_CAP;
}

function usageRef() {
  const month = new Date().toISOString().slice(0, 7); // "2026-10"
  return adminDb().collection(USAGE_COLLECTION).doc(month);
}

/** Ask whether the user wants this week's digest. Returns how the ask went
 * out, or null if it couldn't be sent (caller falls back to email). */
export async function askForDigestOnWhatsApp(
  digest: UserDigest,
): Promise<WhatsAppDigestAsk | null> {
  const waId = digest.whatsappWaId;
  if (!waId) return null;

  const lastInbound = Date.parse(digest.whatsappLastInboundAt);
  if (Number.isFinite(lastInbound) && Date.now() - lastInbound < FREE_WINDOW_MS) {
    const ok = await sendWhatsAppMessage(
      waId,
      htmlToWhatsAppText(digestConsentPrompt(digest)),
    );
    return ok ? "free" : null;
  }

  const template = process.env.WHATSAPP_DIGEST_TEMPLATE;
  if (!template) return null;

  // The cron sends sequentially, so a read-then-increment is race-free here.
  const ref = usageRef();
  const sent = Number((await ref.get()).data()?.templatesSent) || 0;
  if (sent >= monthlyCap()) {
    console.warn(
      `WhatsApp template cap reached (${sent}) - falling back to email`,
    );
    return null;
  }

  const firstName = digest.name?.split(" ")[0]?.trim() || "there";
  const ok = await sendWhatsAppTemplate(
    waId,
    template,
    process.env.WHATSAPP_DIGEST_TEMPLATE_LANG || "en",
    [firstName],
  );
  if (!ok) return null;
  await ref.set(
    {
      templatesSent: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return "template";
}
