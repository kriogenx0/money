import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recategorizeAll } from "@/lib/categories";

/**
 * Creates a merchant rule. With apply_to_existing, also clears manual choices on matching
 * transactions so the rule takes effect everywhere.
 */
export async function POST(req: Request) {
  const { pattern, category_id, apply_to_existing } = (await req.json()) as {
    pattern: string;
    category_id: number;
    apply_to_existing?: boolean;
  };
  const p = pattern?.trim();
  if (!p || !category_id) return NextResponse.json({ error: "pattern and category_id required" }, { status: 400 });
  const db = getDb();
  db.prepare("INSERT INTO rules (pattern, category_id) VALUES (?, ?)").run(p, category_id);
  if (apply_to_existing) {
    db.prepare(
      "UPDATE transactions SET user_category_id = NULL WHERE instr(lower(coalesce(merchant_name,'') || ' ' || name), lower(?)) > 0",
    ).run(p);
  }
  recategorizeAll(db);
  return NextResponse.json({ ok: true });
}
