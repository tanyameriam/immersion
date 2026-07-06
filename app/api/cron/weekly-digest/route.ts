import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  buildWeeklyDigests,
  digestHtml,
  digestText,
} from "@/lib/digest/build";
import { sendEmail } from "@/lib/email/resend";
import { sendTelegramMessage } from "@/lib/telegram/send";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Weekly digest job. Guard with CRON_SECRET (Authorization: Bearer <secret>).
 * On the free Vercel Hobby plan, wire this to the once-daily cron and it sends
 * to each user (email via Resend and/or Telegram) on their chosen day. Trigger
 * manually to test: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/weekly-digest
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const digests = await buildWeeklyDigests();
    let emailed = 0;
    let messaged = 0;

    for (const digest of digests) {
      const emailOk = digest.email
        ? await sendEmail({
            to: digest.email,
            subject: "Your Layrrrd week",
            html: digestHtml(digest),
          })
        : false;
      const tgOk = digest.telegramChatId
        ? await sendTelegramMessage(digest.telegramChatId, digestText(digest))
        : false;

      if (emailOk) emailed++;
      if (tgOk) messaged++;

      await adminDb().collection("weeklyDigests").add({
        userId: digest.userId,
        generatedAt: FieldValue.serverTimestamp(),
        itemCount: digest.items.length,
        topTopics: digest.topTopics,
        emailSent: emailOk,
        telegramSent: tgOk,
      });
    }

    return NextResponse.json({
      users: digests.length,
      emailed,
      messaged,
    });
  } catch (err) {
    console.error("weekly-digest failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Vercel Cron issues GET requests; support both.
export const GET = POST;
