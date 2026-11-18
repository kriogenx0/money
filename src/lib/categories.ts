import type Database from "better-sqlite3";

export type DefaultCategory = { name: string; color: string; excluded?: boolean };

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Groceries", color: "#2f9e44" },
  { name: "Dining & Drinks", color: "#e8590c" },
  { name: "Shopping", color: "#ae3ec9" },
  { name: "Transportation", color: "#1c7ed6" },
  { name: "Travel", color: "#0c8599" },
  { name: "Rent & Utilities", color: "#5f3dc4" },
  { name: "Home", color: "#a07a3c" },
  { name: "Health", color: "#e03131" },
  { name: "Personal Care", color: "#d6336c" },
  { name: "Entertainment", color: "#f08c00" },
  { name: "Subscriptions", color: "#7048e8" },
  { name: "Services", color: "#495057" },
  { name: "Fees", color: "#868e96" },
  { name: "Loan Payments", color: "#364fc7" },
  { name: "Taxes & Donations", color: "#5c940d" },
  { name: "Uncategorized", color: "#adb5bd" },
  { name: "Income", color: "#37b24d", excluded: true },
  { name: "Transfers", color: "#ced4da", excluded: true },
  { name: "Credit Card Payments", color: "#ced4da", excluded: true },
];

/** Plaid personal_finance_category.detailed values that get their own category. */
const DETAILED_MAP: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  // Paying the card from checking would otherwise double count every card purchase.
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Credit Card Payments",
  GENERAL_SERVICES_INSURANCE: "Services",
  ENTERTAINMENT_TV_AND_MOVIES: "Subscriptions",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Subscriptions",
};

/** Plaid personal_finance_category.primary values mapped to app categories. */
const PRIMARY_MAP: Record<string, string> = {
  INCOME: "Income",
  TRANSFER_IN: "Transfers",
  TRANSFER_OUT: "Transfers",
  LOAN_PAYMENTS: "Loan Payments",
  BANK_FEES: "Fees",
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Dining & Drinks",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Home",
  MEDICAL: "Health",
  PERSONAL_CARE: "Personal Care",
  GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT: "Taxes & Donations",
  TRANSPORTATION: "Transportation",
  TRAVEL: "Travel",
  RENT_AND_UTILITIES: "Rent & Utilities",
  OTHER: "Uncategorized",
};

export type Rule = { id: number; pattern: string; category_id: number };

export type CategorizeInput = {
  name: string;
  merchant_name: string | null;
  plaid_primary: string | null;
  plaid_detailed: string | null;
};

export type CategoryLookup = {
  rules: Rule[];
  idByName: Map<string, number>;
};

export function loadLookup(db: Database.Database): CategoryLookup {
  const rules = db
    .prepare("SELECT id, pattern, category_id FROM rules ORDER BY id DESC")
    .all() as Rule[];
  const cats = db.prepare("SELECT id, name FROM categories").all() as { id: number; name: string }[];
  return { rules, idByName: new Map(cats.map((c) => [c.name, c.id])) };
}

/**
 * Picks a category for a transaction. Order: your merchant rules (newest first),
 * then Plaid's detailed category, then Plaid's primary category, then Uncategorized.
 * Manual per-transaction choices are stored separately and always win over this.
 */
export function categorize(
  t: CategorizeInput,
  lookup: CategoryLookup,
): { categoryId: number | null; source: "rule" | "plaid" | "default" } {
  const haystack = `${t.merchant_name ?? ""} ${t.name}`.toLowerCase();
  for (const rule of lookup.rules) {
    if (rule.pattern && haystack.includes(rule.pattern.toLowerCase())) {
      return { categoryId: rule.category_id, source: "rule" };
    }
  }
  const byDetailed = t.plaid_detailed ? DETAILED_MAP[t.plaid_detailed] : undefined;
  const byPrimary = t.plaid_primary ? PRIMARY_MAP[t.plaid_primary] : undefined;
  const name = byDetailed ?? byPrimary;
  if (name && lookup.idByName.has(name)) {
    return { categoryId: lookup.idByName.get(name)!, source: "plaid" };
  }
  return { categoryId: lookup.idByName.get("Uncategorized") ?? null, source: "default" };
}

/** Re-applies rules and Plaid mapping to every transaction (manual choices are untouched). */
export function recategorizeAll(db: Database.Database) {
  const lookup = loadLookup(db);
  const rows = db
    .prepare("SELECT transaction_id, name, merchant_name, plaid_primary, plaid_detailed FROM transactions")
    .all() as (CategorizeInput & { transaction_id: string })[];
  const update = db.prepare(
    "UPDATE transactions SET auto_category_id = ?, auto_source = ? WHERE transaction_id = ?",
  );
  db.transaction(() => {
    for (const r of rows) {
      const { categoryId, source } = categorize(r, lookup);
      update.run(categoryId, source, r.transaction_id);
    }
  })();
}
