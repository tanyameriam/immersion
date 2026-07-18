import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { FOUNDING, type Plan } from "@/lib/billing/config";
import { FOUNDING_COUNTER_PATH } from "@/lib/billing/founding";

/** Read a user's plan from their profile doc. Missing doc/field = "free". */
export async function getUserPlan(uid: string): Promise<Plan> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.data()?.plan === "pro" ? "pro" : "free";
}

export type PaidProduct = "founding" | "biscuits";

export interface FulfillInput {
  paymentId: string;
  orderId: string;
  uid: string;
  product: PaidProduct;
  /** Biscuit count for "biscuits"; ignored for "founding". */
  quantity: number;
  amountPaise: number;
}

export interface FulfillResult {
  /** False when this paymentId was already fulfilled (retry/race no-op). */
  fulfilled: boolean;
  product: PaidProduct;
}

/**
 * Grant whatever a captured payment bought. Exactly-once no matter how many
 * times or in what order the checkout verify callback and the Razorpay
 * webhook land: a payments/{paymentId} ledger doc is created in the same
 * transaction as the grant, and an existing ledger doc means done.
 */
export async function fulfillPayment(input: FulfillInput): Promise<FulfillResult> {
  const db = adminDb();
  const ledgerRef = db.collection("payments").doc(input.paymentId);
  const userRef = db.collection("users").doc(input.uid);
  const counterRef = db
    .collection(FOUNDING_COUNTER_PATH.collection)
    .doc(FOUNDING_COUNTER_PATH.doc);

  return db.runTransaction(async (tx) => {
    if ((await tx.get(ledgerRef)).exists) {
      return { fulfilled: false, product: input.product };
    }

    const ledger: Record<string, unknown> = {
      uid: input.uid,
      orderId: input.orderId,
      product: input.product,
      quantity: input.quantity,
      amountPaise: input.amountPaise,
      createdAt: new Date().toISOString(),
    };

    if (input.product === "founding") {
      const [userSnap, counterSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(counterRef),
      ]);
      if (userSnap.data()?.plan === "pro") {
        // Paid twice somehow (order route blocks this): record for a manual
        // refund, grant nothing new.
        ledger.duplicate = true;
        tx.create(ledgerRef, ledger);
        console.error("Founding payment for already-pro user", input);
        return { fulfilled: true, product: input.product };
      }
      const claimed = counterSnap.data()?.claimedSpots;
      const spot = (typeof claimed === "number" ? claimed : 0) + 1;
      if (spot > FOUNDING.totalSpots) {
        // Two captures raced past the cap: still grant (they paid), flag for
        // a manual refund decision.
        ledger.oversold = true;
        console.error("Founding membership oversold", { ...input, spot });
      }
      tx.set(counterRef, { claimedSpots: spot }, { merge: true });
      tx.set(
        userRef,
        {
          plan: "pro",
          foundingMember: true,
          foundingSpot: spot,
          paidAt: new Date().toISOString(),
          razorpayPaymentId: input.paymentId,
          razorpayOrderId: input.orderId,
        },
        { merge: true },
      );
    } else {
      tx.set(
        userRef,
        { biscuits: { balance: FieldValue.increment(input.quantity) } },
        { merge: true },
      );
    }

    tx.create(ledgerRef, ledger);
    return { fulfilled: true, product: input.product };
  });
}
