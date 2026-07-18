import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { limitsFor } from "@/lib/billing/config";
import {
  buildWeeklyDigests,
  digestHtml,
  digestText,
} from "@/lib/digest/build";
import { sendEmail } from "@/lib/email/resend";
import { sendTelegramMessage } from "@/lib/telegram/send";
import { sendDueNudges } from "@/lib/telegram/nudge";
import { rememberMentions } from "@/lib/rudolf/memory";
import { buildRecommendations } from "@/lib/recommendations/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly digest job (Vercel Cron, daily). Sends each user their digest on the
 * weekday they chose (Profile → Delivery day), via their channel (email or
 * Telegram). Guard with CRON_SECRET. Add ?force=1 to ignore the day gate (for
 * manual testing).
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/cron/weekly-digest?force=1"
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  try {
    const digests = await buildWeeklyDigests();
    let emailed = 0;
    let messaged = 0;
    let considered = 0;

    const BIWEEKLY_MIN_MS = 13 * 24 * 60 * 60 * 1000; // 13 days tolerates cron jitter

    for (const digest of digests) {
      // Billing gate: no-op until free-tier limits flip in lib/billing/config.ts.
      if (!limitsFor(digest.plan).digests) continue;
      // Paused users get nothing, even under force=1, so pause is testable.
      if (digest.notificationFrequency === "off") continue;
      if (!force && digest.notificationDay !== today) continue;
      if (!force && digest.notificationFrequency === "biweekly") {
        const last = Date.parse(digest.lastDigestSentAt);
        // An unparseable/missing timestamp means never sent: send now.
        if (Number.isFinite(last) && Date.now() - last < BIWEEKLY_MIN_MS) {
          continue;
        }
      }
      considered++;

      // A "Picked for you" section: same engine as the Recommended tab. Kept
      // to 3 picks total, the digest leads with them instead of a list dump.
      // Never let it block the digest itself.
      try {
        const recs = await buildRecommendations(digest.userId);
        digest.recommendations = [
          ...recs.matched.slice(0, 1),
          ...recs.discover.slice(0, 1),
          ...recs.web.slice(0, 1),
        ];
      } catch (err) {
        console.error("weekly-digest recommendations failed", digest.userId, err);
      }

      const wantTelegram =
        digest.notificationPreference === "telegram" && !!digest.telegramChatId;

      let emailOk = false;
      let tgOk = false;
      if (wantTelegram) {
        tgOk = await sendTelegramMessage(digest.telegramChatId!, digestText(digest));
        // Remember the digest's picks so "that podcast from the digest" is
        // answerable in chat later.
        if (tgOk && digest.recommendations?.length) {
          await rememberMentions(
            digest.telegramChatId!,
            digest.recommendations.map((r) => ({ url: r.url, title: r.title })),
          );
        }
      }
      // Email if they chose it, or as a fallback when Telegram wasn't sent.
      if ((!wantTelegram || !tgOk) && digest.email) {
        emailOk = await sendEmail({
          to: digest.email,
          subject: "Your Layrrrd week",
          html: digestHtml(digest),
        });
      }

      if (emailOk) emailed++;
      if (tgOk) messaged++;

      // Delivery timestamp drives the biweekly gate; harmless for weekly.
      if (emailOk || tgOk) {
        await adminDb()
          .collection("users")
          .doc(digest.userId)
          .set({ lastDigestSentAt: new Date().toISOString() }, { merge: true });
      }

      await adminDb().collection("weeklyDigests").add({
        userId: digest.userId,
        generatedAt: FieldValue.serverTimestamp(),
        savedThisWeek: digest.savedThisWeek,
        readThisWeek: digest.readThisWeek,
        emailSent: emailOk,
        telegramSent: tgOk,
      });
    }

    // Rudolf's between-digest picks ride the same daily cron (the Hobby plan
    // has no spare cron slot). Never let nudges fail the digest response.
    // ?forceNudge=1 ignores the day gate for manual testing.
    const forceNudge =
      new URL(req.url).searchParams.get("forceNudge") === "1";
    let nudges = { considered: 0, sent: 0 };
    try {
      nudges = await sendDueNudges(today, { force: forceNudge });
    } catch (err) {
      console.error("nudges failed", err);
    }

    return NextResponse.json({ day: today, considered, emailed, messaged, nudges });
  } catch (err) {
    console.error("weekly-digest failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const POST = run;
export const GET = run;
