import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { adminDb } from "@/lib/firebase/admin";
import { fulfillPayment, type PaidProduct } from "@/lib/billing/plan";
import { verifyPaymentSignature } from "@/lib/billing/razorpay";
import { notifyPaidUpgrade } from "@/lib/notifications/admin";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** Confirm a checkout payment: validate Razorpay's signature, then grant
 * the purchase. The webhook is the backstop if this call never happens. */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const orderId = body?.razorpay_order_id;
    const paymentId = body?.razorpay_payment_id;
    const signature = body?.razorpay_signature;
    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string"
    ) {
      return jsonWithCors(req, { error: "Invalid input" }, 400);
    }

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return jsonWithCors(req, { error: "Invalid signature" }, 400);
    }

    // The paid order must be the one we created for this user - blocks
    // replaying another user's payment response.
    const orderSnap = await adminDb()
      .collection("paymentOrders")
      .doc(orderId)
      .get();
    const order = orderSnap.data();
    if (!order || order.uid !== user.uid) {
      return jsonWithCors(req, { error: "Order mismatch" }, 400);
    }

    const result = await fulfillPayment({
      paymentId,
      orderId,
      uid: user.uid,
      product: order.product as PaidProduct,
      quantity: typeof order.quantity === "number" ? order.quantity : 1,
      amountPaise: typeof order.amountPaise === "number" ? order.amountPaise : 0,
    });

    // Admin + welcome email, only on a fresh founding fulfillment (the
    // webhook may have beaten us here; notifyPaidUpgrade also self-dedupes).
    if (result.fulfilled && result.product === "founding") {
      await notifyPaidUpgrade(user.uid, { paymentId, orderId });
    }

    return jsonWithCors(req, { ok: true, product: result.product });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/payments/verify failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
