import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { adminDb } from "@/lib/firebase/admin";
import { PRO_PLAN } from "@/lib/billing/config";
import { getUserPlan } from "@/lib/billing/plan";
import { createRazorpayOrder } from "@/lib/billing/razorpay";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/** Create a Razorpay order for the signed-in user to pay for Pro. */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);

    if ((await getUserPlan(user.uid)) === "pro") {
      return jsonWithCors(
        req,
        { error: "You already have Layrrrd Pro.", code: "already_pro" },
        409,
      );
    }

    // notes.uid is how the webhook maps a captured payment back to the user
    // when the browser never reaches the verify step.
    const order = await createRazorpayOrder({
      amountPaise: PRO_PLAN.amountPaise,
      currency: PRO_PLAN.currency,
      receipt: user.uid,
      notes: { uid: user.uid },
    });

    // Remember the pending order so verify can check the paid order really
    // belongs to this user.
    await adminDb()
      .collection("users")
      .doc(user.uid)
      .set({ razorpayOrderId: order.id }, { merge: true });

    return jsonWithCors(
      req,
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
      },
      201,
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }
    console.error("POST /api/payments/order failed", err);
    return jsonWithCors(req, { error: "Internal error" }, 500);
  }
}
