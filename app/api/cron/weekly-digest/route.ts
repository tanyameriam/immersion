import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { limitsFor } from "@/lib/billing/config";
import {
  buildWeeklyDigests,
  digestConsentPrompt,
  digestHtml,
  digestParts,
} from "@/lib/digest/build";
import { sendEmail } from "@/lib/email/resend";
import { sendTelegramMessage } from "@/lib/telegram/send";
import { buildRecommendations } from "@/lib/recommendations/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly digest job (Vercel Cron, daily). Sends each user their digest on the
 * weekday they chose (Profile → Delivery day), via their channel (email or
 * Telegram). Guard with CRON_SECRET. Add ?force=1 to ignore the day gate (for
 * manual testing).
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/cron/weekly-digest?force=1"
 *
 * Email gets the full digest immediately - there's no back-and-forth channel
 * to ask first. Telegram is opt-in per delivery: this only sends a short
 * "want your digest?" prompt and stashes the rendered content on
 * users/{uid}.pendingDigest; the actual content only goes out once the user
 * replies yes, handled by the consent check in lib/rudolf/chat.ts. Rudolf
 * never pushes content the user didn't ask for.
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

      // A "Picked for you" section: same engine as the Recommended tab (now
      // external-source picks only - see lib/recommendations/generate.ts).
      // Kept to 3 picks total, the digest leads with them instead of a list
      // dump. Never let it block the digest itself.
      try {
        const recs = await buildRecommendations(digest.userId);
        digest.recommendations = recs.web.slice(0, 3);
      } catch (err) {
        console.error("weekly-digest recommendations failed", digest.userId, err);
      }

      const wantTelegram =
        digest.notificationPreference === "telegram" && !!digest.telegramChatId;

      let emailOk = false;
      let askOk = false;
      if (wantTelegram) {
        askOk = await sendTelegramMessage(
          digest.telegramChatId!,
          digestConsentPrompt(digest),
        );
        if (askOk) {
          // Content is ready but withheld until they say yes - see the
          // consent check in lib/rudolf/chat.ts, which sends `parts` and
          // records `recs` via rememberMentions once confirmed.
          await adminDb()
            .collection("users")
            .doc(digest.userId)
            .set(
              {
                pendingDigest: {
                  askedAt: new Date().toISOString(),
                  parts: digestParts(digest),
                  recs: (digest.recommendations ?? []).map((r) => ({
                    url: r.url,
                    title: r.title,
                  })),
                },
              },
              { merge: true },
            );
        }
      }
      // Email if they chose it, or as a fallback when the Telegram ask
      // failed to send - email has no consent step, it just arrives.
      if ((!wantTelegram || !askOk) && digest.email) {
        emailOk = await sendEmail({
          to: digest.email,
          subject: "Your Layrrrd week",
          html: digestHtml(digest),
        });
      }

      if (emailOk) emailed++;
      if (askOk) messaged++;

      // Delivery timestamp drives the biweekly gate. Email is immediate
      // delivery, so it counts now; a Telegram ask only counts once the user
      // actually confirms (lib/rudolf/chat.ts) - an unanswered or declined
      // ask means they haven't received anything yet, so they should be
      // asked again next cycle rather than have their slot silently used up.
      if (emailOk) {
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
        telegramAsked: askOk,
      });
    }

    return NextResponse.json({ day: today, considered, emailed, messaged });
  } catch (err) {
    console.error("weekly-digest failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const POST = run;
export const GET = run;
