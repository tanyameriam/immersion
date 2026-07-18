import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { adminDb } from "@/lib/firebase/admin";
import { BISCUIT, FOUNDING } from "@/lib/billing/config";
import { getFoundingStatus } from "@/lib/billing/founding";
import { getUserPlan, type PaidProduct } from "@/lib/billing/plan";
import { createRazorpayOrder } from "@/lib/billing/razorpay";
import { jsonWithCors, preflight } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * Create a Razorpay order for the signed-in user. Two products:
 * - founding: one Founding Membership spot, price computed server-side from
 *   the live claimed-spots counter (tier 1 until tier1Cap, then tier 2).
 * - biscuits: quantity x BISCUIT.pricePaise Rudolf play-time top-ups.
 * Order metadata is stored in paymentOrders/{orderId} (the verify route's
 * ownership check and the fulfillment source of truth); notes on the
 * Razorpay order carry the same data for the webhook backstop.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const product = body?.product as PaidProduct;

    if (product !== "founding" && product !== "biscuits") {
      return jsonWithCors(req, { error: "Invalid product" }, 400);
    }

    const plan = await getUserPlan(user.uid);
    if (plan === "pro") {
      // Founding members have unlimited play time; nothing here to buy.
      return jsonWithCors(
        req,
        { error: "You already have a Founding Membership.", code: "already_pro" },
        409,
      );
    }

    let amountPaise: number;
    let quantity = 1;
    let description: string;

    if (product === "founding") {
      const status = await getFoundingStatus();
      if (status.soldOut) {
        return jsonWithCors(
          req,
          { error: "All founding memberships are claimed.", code: "sold_out" },
          409,
        );
      }
      amountPaise = status.currentPricePaise;
      description = FOUNDING.name;
    } else {
      quantity = Number(body?.quantity);
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > BISCUIT.maxPerOrder
      ) {
        return jsonWithCors(req, { error: "Invalid quantity" }, 400);
      }
      amountPaise = BISCUIT.pricePaise * quantity;
      description = `${quantity} Rudolf biscuit${quantity === 1 ? "" : "s"}`;
    }

    // notes are how the webhook maps a captured payment back to the purchase
    // when the browser never reaches the verify step.
    const order = await createRazorpayOrder({
      amountPaise,
      currency: FOUNDING.currency,
      receipt: user.uid,
      notes: { uid: user.uid, product, quantity: String(quantity) },
    });

    await adminDb().collection("paymentOrders").doc(order.id).set({
      uid: user.uid,
      product,
      quantity,
      amountPaise,
      createdAt: new Date().toISOString(),
    });

    return jsonWithCors(
      req,
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        description,
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
