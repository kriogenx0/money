"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/queries";
import { api } from "./api";

type Props = {
  transactionId: string;
  merchant: string;
  categoryId: number | null;
  source: string;
  categories: Category[];
};

/** Category picker for one transaction, with a one-click "always use this for the merchant" rule. */
export default function TransactionCategory({ transactionId, merchant, categoryId, source, categories }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pendingRule, setPendingRule] = useState<number | null>(null);

  async function change(value: string) {
    const id = Number(value);
    setBusy(true);
    try {
      await api(`/api/transactions/${encodeURIComponent(transactionId)}`, "PATCH", { category_id: id });
      setPendingRule(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function makeRule() {
    if (pendingRule === null) return;
    setBusy(true);
    try {
      await api("/api/rules", "POST", { pattern: merchant, category_id: pendingRule, apply_to_existing: true });
      setPendingRule(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <select value={categoryId ?? ""} disabled={busy} onChange={(e) => change(e.target.value)} aria-label="Category">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {source !== "plaid" && source !== "default" && <span className="pill">{source}</span>}
      {pendingRule !== null && (
        <button className="link small" disabled={busy} onClick={makeRule}>
          Always for &ldquo;{merchant}&rdquo;
        </button>
      )}
    </div>
  );
}
