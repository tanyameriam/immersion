import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { fulfillPayment, type PaidProduct } from "@/lib/billing/plan";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { notifyPaidUpgrade } from "@/lib/notifications/admin";

export const runtime = "nodejs";

/**
 * Razorpay webhook - the payment backstop. Grants the purchase on
 * payment.captured even if the buyer closed the tab before the browser-side
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
      const orderId = payment?.order_id;
      if (
        typeof uid === "string" &&
        uid &&
        typeof payment?.id === "string" &&
        typeof orderId === "string"
      ) {
        // paymentOrders/{orderId} is authoritative; the order notes are the
        // fallback if the doc write somehow never happened.
        const orderSnap = await adminDb()
          .collection("paymentOrders")
          .doc(orderId)
          .get();
        const order = orderSnap.data();
        const product = (order?.product ?? payment?.notes?.product) as
          | PaidProduct
          | undefined;
        if (product !== "founding" && product !== "biscuits") {
          console.error("payment.captured with unknown product", payment?.id);
          return NextResponse.json({ ok: true });
        }
        const quantity =
          typeof order?.quantity === "number"
            ? order.quantity
            : Number(payment?.notes?.quantity) || 1;
        const amountPaise =
          typeof order?.amountPaise === "number"
            ? order.amountPaise
            : typeof payment?.amount === "number"
              ? payment.amount
              : 0;

        const result = await fulfillPayment({
          paymentId: payment.id,
          orderId,
          uid,
          product,
          quantity,
          amountPaise,
        });
        if (result.fulfilled && result.product === "founding") {
          await notifyPaidUpgrade(uid, { paymentId: payment.id, orderId });
        }
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
