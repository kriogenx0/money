import type Database from "better-sqlite3";
import type { Transaction, RemovedTransaction } from "plaid/legacy";
import { getDb } from "./db";
import { categorize, loadLookup } from "./categories";
import { getPlaid, plaidErrorMessage } from "./plaid";

type Item = { item_id: string; access_token: string; cursor: string | null; is_demo: number };

export type SyncResult = { added: number; modified: number; removed: number };

/** Inserts or updates Plaid transactions and drops removed ones, in one DB transaction. */
export function applyChanges(
  db: Database.Database,
  itemId: string,
  added: Transaction[],
  modified: Transaction[],
  removed: RemovedTransaction[],
) {
  const lookup = loadLookup(db);
  const upsert = db.prepare(`
    INSERT INTO transactions (
      transaction_id, account_id, item_id, amount, iso_currency_code, date, authorized_datetime,
      name, merchant_name, pending, pending_transaction_id, plaid_primary, plaid_detailed,
      auto_category_id, auto_source
    ) VALUES (
      @transaction_id, @account_id, @item_id, @amount, @iso_currency_code, @date, @authorized_datetime,
      @name, @merchant_name, @pending, @pending_transaction_id, @plaid_primary, @plaid_detailed,
      @auto_category_id, @auto_source
    )
    ON CONFLICT(transaction_id) DO UPDATE SET
      account_id = excluded.account_id,
      amount = excluded.amount,
      iso_currency_code = excluded.iso_currency_code,
      date = excluded.date,
      authorized_datetime = excluded.authorized_datetime,
      name = excluded.name,
      merchant_name = excluded.merchant_name,
      pending = excluded.pending,
      pending_transaction_id = excluded.pending_transaction_id,
      plaid_primary = excluded.plaid_primary,
      plaid_detailed = excluded.plaid_detailed,
      auto_category_id = excluded.auto_category_id,
      auto_source = excluded.auto_source,
      updated_at = datetime('now')
  `);
  // When a pending transaction posts, Plaid removes the pending one and adds a new one.
  // Carry over your manual category and the first-seen time so neither is lost.
  const inheritFromPending = db.prepare(`
    UPDATE transactions SET
      user_category_id = COALESCE(user_category_id,
        (SELECT user_category_id FROM transactions WHERE transaction_id = @pending_id)),
      first_seen_at = MIN(first_seen_at,
        COALESCE((SELECT first_seen_at FROM transactions WHERE transaction_id = @pending_id), first_seen_at))
    WHERE transaction_id = @id
  `);
  const remove = db.prepare("DELETE FROM transactions WHERE transaction_id = ?");

  const toRow = (t: Transaction) => {
    const pfc = t.personal_finance_category;
    const { categoryId, source } = categorize(
      {
        name: t.name,
        merchant_name: t.merchant_name ?? null,
        plaid_primary: pfc?.primary ?? null,
        plaid_detailed: pfc?.detailed ?? null,
      },
      lookup,
    );
    return {
      transaction_id: t.transaction_id,
      account_id: t.account_id,
      item_id: itemId,
      amount: t.amount,
      iso_currency_code: t.iso_currency_code ?? null,
      date: t.date,
      authorized_datetime: t.authorized_datetime ?? null,
      name: t.name,
      merchant_name: t.merchant_name ?? null,
      pending: t.pending ? 1 : 0,
      pending_transaction_id: t.pending_transaction_id ?? null,
      plaid_primary: pfc?.primary ?? null,
      plaid_detailed: pfc?.detailed ?? null,
      auto_category_id: categoryId,
      auto_source: source,
    };
  };

  db.transaction(() => {
    for (const t of [...added, ...modified]) {
      upsert.run(toRow(t));
      if (t.pending_transaction_id) {
        inheritFromPending.run({ id: t.transaction_id, pending_id: t.pending_transaction_id });
      }
    }
    for (const r of removed) {
      if (r.transaction_id) remove.run(r.transaction_id);
    }
  })();
}

/** Pulls every page of /transactions/sync for one item and saves the new cursor. */
export async function syncItem(itemId: string, trigger: string): Promise<SyncResult> {
  const db = getDb();
  const item = db.prepare("SELECT * FROM items WHERE item_id = ?").get(itemId) as Item | undefined;
  if (!item) throw new Error(`Unknown item ${itemId}`);
  if (item.is_demo) return { added: 0, modified: 0, removed: 0 };

  const plaid = getPlaid();
  const run = db
    .prepare("INSERT INTO sync_runs (item_id, trigger) VALUES (?, ?)")
    .run(itemId, trigger);
  const totals: SyncResult = { added: 0, modified: 0, removed: 0 };

  try {
    // Accounts can be added or renamed; refresh them on each sync.
    const accounts = await plaid.accountsGet({ access_token: item.access_token });
    const upsertAccount = db.prepare(`
      INSERT INTO accounts (account_id, item_id, name, official_name, mask, type, subtype)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET name = excluded.name, official_name = excluded.official_name,
        mask = excluded.mask, type = excluded.type, subtype = excluded.subtype
    `);
    for (const a of accounts.data.accounts) {
      upsertAccount.run(a.account_id, itemId, a.name, a.official_name ?? null, a.mask ?? null, a.type, a.subtype ?? null);
    }

    let cursor = item.cursor ?? undefined;
    const startCursor = cursor;
    let added: Transaction[] = [];
    let modified: Transaction[] = [];
    let removed: RemovedTransaction[] = [];
    let hasMore = true;
    while (hasMore) {
      try {
        const res = await plaid.transactionsSync({ access_token: item.access_token, cursor, count: 500 });
        added = added.concat(res.data.added);
        modified = modified.concat(res.data.modified);
        removed = removed.concat(res.data.removed);
        hasMore = res.data.has_more;
        cursor = res.data.next_cursor;
      } catch (err) {
        // Plaid asks clients to restart pagination from the original cursor on this error.
        if (plaidErrorMessage(err).startsWith("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION")) {
          cursor = startCursor;
          added = [];
          modified = [];
          removed = [];
          hasMore = true;
          continue;
        }
        throw err;
      }
    }

    applyChanges(db, itemId, added, modified, removed);
    db.prepare(
      "UPDATE items SET cursor = ?, last_synced_at = datetime('now'), last_error = NULL WHERE item_id = ?",
    ).run(cursor ?? null, itemId);
    totals.added = added.length;
    totals.modified = modified.length;
    totals.removed = removed.length;
    db.prepare("UPDATE sync_runs SET added = ?, modified = ?, removed = ? WHERE id = ?").run(
      totals.added,
      totals.modified,
      totals.removed,
      run.lastInsertRowid,
    );
    return totals;
  } catch (err) {
    const message = plaidErrorMessage(err);
    db.prepare("UPDATE sync_runs SET error = ? WHERE id = ?").run(message, run.lastInsertRowid);
    db.prepare("UPDATE items SET last_error = ? WHERE item_id = ?").run(message, itemId);
    throw new Error(message);
  }
}

export async function syncAll(trigger: string) {
  const db = getDb();
  const items = db.prepare("SELECT item_id FROM items WHERE is_demo = 0").all() as { item_id: string }[];
  const results: Record<string, SyncResult | { error: string }> = {};
  for (const { item_id } of items) {
    try {
      results[item_id] = await syncItem(item_id, trigger);
    } catch (err) {
      results[item_id] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return results;
}
