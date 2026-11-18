import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncItem } from "@/lib/sync";
import { verifyPlaidWebhook } from "@/lib/webhook-verify";

export async function POST(req: Request) {
  const raw = await req.text();
  const verified = await verifyPlaidWebhook(raw, req.headers.get("plaid-verification"));
  let body: { webhook_type?: string; webhook_code?: string; item_id?: string } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO webhook_events (webhook_type, webhook_code, item_id, verified, payload) VALUES (?, ?, ?, ?, ?)",
  ).run(body.webhook_type ?? null, body.webhook_code ?? null, body.item_id ?? null, verified ? 1 : 0, raw);

  if (!verified) {
    return NextResponse.json({ error: "Signature check failed" }, { status: 401 });
  }

  const known = body.item_id && db.prepare("SELECT 1 FROM items WHERE item_id = ?").get(body.item_id);
  if (known && body.webhook_type === "TRANSACTIONS" && body.webhook_code === "SYNC_UPDATES_AVAILABLE") {
    // Respond quickly; Plaid retries if the webhook is slow. Sync in the background.
    void syncItem(body.item_id!, "webhook").catch((e) => console.error("webhook sync failed", e));
  }
  if (known && body.webhook_type === "ITEM") {
    db.prepare("UPDATE items SET last_error = ? WHERE item_id = ?").run(
      `${body.webhook_code}: reconnect may be needed`,
      body.item_id,
    );
  }
  return NextResponse.json({ ok: true });
}
