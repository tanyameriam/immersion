import { NextResponse } from "next/server";
import { markUserPro } from "@/lib/billing/plan";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { notifyPaidUpgrade } from "@/lib/notifications/admin";

export const runtime = "nodejs";

/**
 * Razorpay webhook - the payment backstop. Upgrades the user on
 * payment.captured even if they closed the tab before the browser-side
 * verify call. Authenticated by the webhook signature, not Firebase.
 */
export async function POST(req: Request) {
  // Raw body first: the signature covers the exact bytes, so parsing before
  // verifying (and re-serializing) would break it.
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(raw);
    if (event?.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const uid = payment?.notes?.uid;
      if (typeof uid === "string" && uid && typeof payment?.id === "string") {
        const paid = {
          paymentId: payment.id,
          orderId: payment.order_id,
        };
        await markUserPro(uid, paid);
        await notifyPaidUpgrade(uid, paid);
      } else {
        console.error("payment.captured without notes.uid", payment?.id);
      }
    }
    // 200 for every valid-signature event (including ones we don't handle) -
    // Razorpay retries non-2xx responses.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Razorpay webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
