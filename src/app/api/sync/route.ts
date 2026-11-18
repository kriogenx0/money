import { NextResponse } from "next/server";
import { plaidConfigured } from "@/lib/plaid";
import { syncAll } from "@/lib/sync";

export async function POST() {
  if (!plaidConfigured()) return NextResponse.json({ error: "Plaid is not configured" }, { status: 400 });
  return NextResponse.json(await syncAll("manual"));
}
