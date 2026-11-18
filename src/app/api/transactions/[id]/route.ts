import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** Sets (or clears, with null) your own category for one transaction. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { category_id } = (await req.json()) as { category_id: number | null };
  const res = getDb()
    .prepare("UPDATE transactions SET user_category_id = ? WHERE transaction_id = ?")
    .run(category_id, id);
  if (res.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
