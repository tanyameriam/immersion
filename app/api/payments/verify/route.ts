import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { adminDb } from "@/lib/firebase/admin";
import { markUserPro } from "@/lib/billing/plan";
import { verifyPaymentSignature } from "@/lib/billing/razorpay";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** Confirm a checkout payment: validate Razorpay's signature, then upgrade
 * the user. The webhook is the backstop if this call never happens. */
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
    const profile = await adminDb().collection("users").doc(user.uid).get();
    if (profile.data()?.razorpayOrderId !== orderId) {
      return jsonWithCors(req, { error: "Order mismatch" }, 400);
    }

    await markUserPro(user.uid, { paymentId, orderId });
    return jsonWithCors(req, { ok: true, plan: "pro" });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/payments/verify failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
