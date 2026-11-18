import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recategorizeAll } from "@/lib/categories";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM rules WHERE id = ?").run(Number(id));
  recategorizeAll(db);
  return NextResponse.json({ ok: true });
}
