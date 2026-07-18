import { adminDb } from "@/lib/firebase/admin";
import type { Plan } from "@/lib/billing/config";

/** Read a user's plan from their profile doc. Missing doc/field = "free". */
export async function getUserPlan(uid: string): Promise<Plan> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.data()?.plan === "pro" ? "pro" : "free";
}

/**
 * Upgrade a user to Pro. Idempotent via a transaction: the checkout verify
 * callback and the Razorpay webhook both call this and can race - the first
 * write wins and keeps its payment record, later calls no-op.
 */
export async function markUserPro(
  uid: string,
  payment: { paymentId: string; orderId?: string },
): Promise<void> {
  const ref = adminDb().collection("users").doc(uid);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.plan === "pro") return;
    tx.set(
      ref,
      {
        plan: "pro",
        paidAt: new Date().toISOString(),
        razorpayPaymentId: payment.paymentId,
        razorpayOrderId: payment.orderId ?? null,
      },
      { merge: true },
    );
  });
}
