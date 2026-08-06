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

/** Delete specific docs by id, ignoring any that don't exist. */
async function deleteDocs(collection: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = adminDb();
  const batch = db.batch();
  ids.forEach((id) => batch.delete(db.collection(collection).doc(id)));
  await batch.commit();
}

/**
 * Permanently delete the signed-in user: all their bookmarks, digest history,
 * pending Telegram/WhatsApp link codes, Rudolf's chat memory and support
 * receipts, their cached feed, their profile doc, and finally the auth user
 * itself. Irreversible — the client gates this behind an explicit confirmation.
 *
 * Rudolf's per-chat memory is keyed by chat id ("wa:<waId>" or the Telegram
 * chat id), not by uid, so it can't be found by a `userId` query — read the
 * profile for those keys BEFORE deleting it, or the memory is orphaned and
 * survives the erasure request.
 */
export async function DELETE(req: Request) {
  try {
    const user = await getAuthedUser(req);

    const profile =
      (await adminDb().collection("users").doc(user.uid).get()).data() ?? {};
    const chatKeys = [
      typeof profile.telegramChatId === "string" ? profile.telegramChatId : null,
      typeof profile.whatsappWaId === "string"
        ? `wa:${profile.whatsappWaId}`
        : null,
    ].filter((key): key is string => Boolean(key));

    await deleteWhere("knowledgeItems", "userId", user.uid);
    await deleteWhere("weeklyDigests", "userId", user.uid);
    await deleteWhere("telegramLinkCodes", "userId", user.uid);
    await deleteWhere("whatsappLinkCodes", "userId", user.uid);
    await deleteWhere("botEvents", "userId", user.uid);
    await deleteDocs("telegramChats", chatKeys);
    await deleteDocs("feedCache", [user.uid]);
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
