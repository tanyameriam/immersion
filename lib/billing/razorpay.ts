import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay REST + signature helpers. No SDK dependency: the Orders API is a
 * single authenticated fetch, and both signature schemes are plain HMACs.
 */

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency: string;
  /** Max 40 chars (we pass the Firebase uid). */
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured");
  }

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Razorpay order creation failed", res.status, body);
    throw new Error(`Razorpay order creation failed (${res.status})`);
  }
  return (await res.json()) as RazorpayOrder;
}

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout callback signature: HMAC-SHA256(`${orderId}|${paymentId}`) with
 * the key secret. */
export function verifyPaymentSignature(p: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${p.orderId}|${p.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, p.signature);
}

/** Webhook signature: HMAC-SHA256 over the raw request body with the
 * webhook secret. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
