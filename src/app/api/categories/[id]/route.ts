import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recategorizeAll } from "@/lib/categories";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, color, excluded } = (await req.json()) as { name?: string; color?: string; excluded?: boolean };
  getDb()
    .prepare(
      "UPDATE categories SET name = coalesce(?, name), color = coalesce(?, color), excluded = coalesce(?, excluded) WHERE id = ?",
    )
    .run(name?.trim() || null, color || null, excluded === undefined ? null : excluded ? 1 : 0, Number(id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const cat = db.prepare("SELECT name FROM categories WHERE id = ?").get(Number(id)) as { name: string } | undefined;
  if (cat?.name === "Uncategorized") {
    return NextResponse.json({ error: "Uncategorized can't be deleted" }, { status: 400 });
  }
  db.prepare("DELETE FROM categories WHERE id = ?").run(Number(id));
  recategorizeAll(db);
  return NextResponse.json({ ok: true });
}
