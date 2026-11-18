import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPlaid, plaidConfigured } from "@/lib/plaid";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const item = db.prepare("SELECT access_token, is_demo FROM items WHERE item_id = ?").get(id) as
    | { access_token: string; is_demo: number }
    | undefined;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!item.is_demo && plaidConfigured()) {
    // Stop Plaid billing and access for this connection.
    await getPlaid().itemRemove({ access_token: item.access_token }).catch(() => {});
  }
  db.prepare("DELETE FROM items WHERE item_id = ?").run(id);
  return NextResponse.json({ ok: true });
}
