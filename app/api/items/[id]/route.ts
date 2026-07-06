import { NextResponse } from "next/server";
import { getAuthedUser, UnauthorizedError } from "@/lib/firebase/verify-auth";
import { deleteItem, getItem } from "@/lib/firestore/items";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Get a single item (used to poll processing status). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await getAuthedUser(req);
    const { id } = await params;
    const item = await getItem(user.uid, id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/items/[id] failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await getAuthedUser(req);
    const { id } = await params;
    const ok = await deleteItem(user.uid, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/items/[id] failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
