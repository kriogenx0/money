import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const { name, color, excluded } = (await req.json()) as { name: string; color?: string; excluded?: boolean };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    const res = getDb()
      .prepare("INSERT INTO categories (name, color, excluded) VALUES (?, ?, ?)")
      .run(name.trim(), color || "#8a8f98", excluded ? 1 : 0);
    return NextResponse.json({ id: res.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "A category with that name exists" }, { status: 409 });
  }
}
