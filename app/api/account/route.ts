import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Delete every doc in `collection` where `field` == `value`, in pages. */
async function deleteWhere(
  collection: string,
  field: string,
  value: string,
): Promise<void> {
  const db = adminDb();
  for (;;) {
    const snap = await db
      .collection(collection)
      .where(field, "==", value)
      .limit(300)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 300) break;
  }
}

/**
 * Permanently delete the signed-in user: all their bookmarks, digest history,
 * pending Telegram/WhatsApp link codes, their profile doc, and finally the auth user
 * itself. Irreversible — the client gates this behind an explicit confirmation.
 */
export async function DELETE(req: Request) {
  try {
    const user = await getAuthedUser(req);
    await deleteWhere("knowledgeItems", "userId", user.uid);
    await deleteWhere("weeklyDigests", "userId", user.uid);
    await deleteWhere("telegramLinkCodes", "userId", user.uid);
    await deleteWhere("whatsappLinkCodes", "userId", user.uid);
    await adminDb().collection("users").doc(user.uid).delete();
    await adminAuth().deleteUser(user.uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/account failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
