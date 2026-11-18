import { getDb } from "./db";

export type Category = { id: number; name: string; color: string; excluded: number };

export type TxRow = {
  transaction_id: string;
  date: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  pending: number;
  account_name: string | null;
  account_mask: string | null;
  plaid_detailed: string | null;
  category_id: number | null;
  category_source: "manual" | "rule" | "plaid" | "default";
};

// A transaction's effective category: your manual choice, else the automatic one.
const EFFECTIVE = "coalesce(t.user_category_id, t.auto_category_id)";

export function listCategories(): Category[] {
  return getDb().prepare("SELECT id, name, color, excluded FROM categories ORDER BY excluded, name").all() as Category[];
}

export function listMonths(): string[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT substr(date, 1, 7) AS m FROM transactions ORDER BY m DESC")
    .all() as { m: string }[];
  return rows.map((r) => r.m);
}

export function listTransactions(month: string, categoryId?: number): TxRow[] {
  const params: (string | number)[] = [month];
  let where = "substr(t.date, 1, 7) = ?";
  if (categoryId) {
    where += ` AND ${EFFECTIVE} = ?`;
    params.push(categoryId);
  }
  return getDb()
    .prepare(
      `SELECT t.transaction_id, t.date, t.name, t.merchant_name, t.amount, t.pending, t.plaid_detailed,
              a.name AS account_name, a.mask AS account_mask,
              ${EFFECTIVE} AS category_id,
              CASE WHEN t.user_category_id IS NOT NULL THEN 'manual' ELSE coalesce(t.auto_source, 'default') END AS category_source
       FROM transactions t LEFT JOIN accounts a ON a.account_id = t.account_id
       WHERE ${where}
       ORDER BY t.date DESC, t.rowid DESC`,
    )
    .all(...params) as TxRow[];
}

export type CategoryTotal = { id: number; name: string; color: string; excluded: number; total: number; count: number };

/** Positive amounts are money out in Plaid's convention; refunds reduce a category's total. */
export function categoryTotals(month: string): CategoryTotal[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.color, c.excluded, sum(t.amount) AS total, count(*) AS count
       FROM transactions t JOIN categories c ON c.id = ${EFFECTIVE}
       WHERE substr(t.date, 1, 7) = ?
       GROUP BY c.id ORDER BY c.excluded, total DESC`,
    )
    .all(month) as CategoryTotal[];
}

export type Item = {
  item_id: string;
  institution_name: string | null;
  is_demo: number;
  last_synced_at: string | null;
  last_error: string | null;
  accounts: { account_id: string; name: string; mask: string | null; subtype: string | null }[];
  transaction_count: number;
};

export function listItems(): Item[] {
  const db = getDb();
  const items = db
    .prepare(
      `SELECT i.item_id, i.institution_name, i.is_demo, i.last_synced_at, i.last_error,
              (SELECT count(*) FROM transactions t WHERE t.item_id = i.item_id) AS transaction_count
       FROM items i ORDER BY i.created_at`,
    )
    .all() as Omit<Item, "accounts">[];
  const accounts = db.prepare("SELECT account_id, name, mask, subtype FROM accounts WHERE item_id = ? ORDER BY name");
  return items.map((i) => ({ ...i, accounts: accounts.all(i.item_id) as Item["accounts"] }));
}

export function recentWebhooks(limit = 20) {
  return getDb()
    .prepare(
      "SELECT id, received_at, webhook_type, webhook_code, item_id, verified FROM webhook_events ORDER BY id DESC LIMIT ?",
    )
    .all(limit) as {
    id: number;
    received_at: string;
    webhook_type: string | null;
    webhook_code: string | null;
    item_id: string | null;
    verified: number;
  }[];
}

/**
 * How long after a purchase the app first saw it. Uses Plaid's authorized time when present,
 * otherwise the end of the transaction date (so this undercounts delay for date-only rows).
 * Skips the initial history import, which would look like huge delays.
 */
export function latencyStats() {
  return getDb()
    .prepare(
      `WITH firsts AS (SELECT item_id, min(started_at) AS first_sync FROM sync_runs GROUP BY item_id),
       d AS (
         SELECT (julianday(t.first_seen_at) - julianday(coalesce(t.authorized_datetime, t.date || ' 23:59:59'))) * 24 AS hours
         FROM transactions t JOIN items i ON i.item_id = t.item_id AND i.is_demo = 0
         JOIN firsts f ON f.item_id = t.item_id
         WHERE t.first_seen_at > datetime(f.first_sync, '+1 hour')
       )
       SELECT count(*) AS n, avg(hours) AS avg_hours, max(hours) AS max_hours FROM d`,
    )
    .get() as { n: number; avg_hours: number | null; max_hours: number | null };
}

export function listRules() {
  return getDb()
    .prepare(
      `SELECT r.id, r.pattern, r.category_id, c.name AS category_name, c.color,
              (SELECT count(*) FROM transactions t
               WHERE instr(lower(coalesce(t.merchant_name,'') || ' ' || t.name), lower(r.pattern)) > 0) AS matches
       FROM rules r JOIN categories c ON c.id = r.category_id ORDER BY r.id DESC`,
    )
    .all() as { id: number; pattern: string; category_id: number; category_name: string; color: string; matches: number }[];
}
