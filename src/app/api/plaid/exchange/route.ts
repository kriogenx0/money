import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPlaid, plaidErrorMessage } from "@/lib/plaid";
import { syncItem } from "@/lib/sync";

export async function POST(req: Request) {
  const { public_token, institution_name } = (await req.json()) as {
    public_token: string;
    institution_name?: string;
  };
  try {
    const res = await getPlaid().itemPublicTokenExchange({ public_token });
    const { item_id, access_token } = res.data;
    getDb()
      .prepare(
        `INSERT INTO items (item_id, access_token, institution_name) VALUES (?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET access_token = excluded.access_token`,
      )
      .run(item_id, access_token, institution_name ?? null);
    // The first sync may return nothing until Plaid finishes pulling history;
    // the SYNC_UPDATES_AVAILABLE webhook will trigger another one.
    const result = await syncItem(item_id, "link").catch((e: Error) => ({ error: e.message }));
    return NextResponse.json({ item_id, result });
  } catch (err) {
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 500 });
  }
}
