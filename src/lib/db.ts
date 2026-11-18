import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CATEGORIES } from "./categories";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

const MIGRATIONS: string[] = [
  `
  CREATE TABLE items (
    item_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    institution_name TEXT,
    cursor TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE accounts (
    account_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    official_name TEXT,
    mask TEXT,
    type TEXT,
    subtype TEXT
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#8a8f98',
    -- excluded categories (income, transfers, card payments) are not counted as spending
    excluded INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE transactions (
    transaction_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    iso_currency_code TEXT,
    date TEXT NOT NULL,
    authorized_datetime TEXT,
    name TEXT NOT NULL,
    merchant_name TEXT,
    pending INTEGER NOT NULL DEFAULT 0,
    pending_transaction_id TEXT,
    plaid_primary TEXT,
    plaid_detailed TEXT,
    auto_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    auto_source TEXT,
    user_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX transactions_date ON transactions(date);

  CREATE TABLE webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    webhook_type TEXT,
    webhook_code TEXT,
    item_id TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL
  );

  CREATE TABLE sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    added INTEGER NOT NULL DEFAULT 0,
    modified INTEGER NOT NULL DEFAULT 0,
    removed INTEGER NOT NULL DEFAULT 0,
    error TEXT
  );
  `,
];

function migrate(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
  const count = db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare("INSERT INTO categories (name, color, excluded) VALUES (?, ?, ?)");
    db.transaction(() => {
      for (const c of DEFAULT_CATEGORIES) insert.run(c.name, c.color, c.excluded ? 1 : 0);
    })();
  }
}

const globalForDb = globalThis as unknown as { __moneyDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__moneyDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new Database(path.join(DATA_DIR, "money.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.__moneyDb = db;
  }
  return globalForDb.__moneyDb;
}
