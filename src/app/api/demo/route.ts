import { NextResponse } from "next/server";
import { loadDemoData, removeDemoData } from "@/lib/demo";

export function POST() {
  return NextResponse.json({ loaded: loadDemoData() });
}

export function DELETE() {
  removeDemoData();
  return NextResponse.json({ ok: true });
}
