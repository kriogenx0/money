import type { Transaction } from "plaid/legacy";
import { getDb } from "./db";
import { applyChanges } from "./sync";

const DEMO_ITEM = "demo-item";

type Sample = [merchant: string, primary: string, detailed: string, min: number, max: number, perMonth: number];

const SAMPLES: Sample[] = [
  ["Whole Foods", "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES", 40, 140, 4],
  ["Trader Joe's", "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES", 25, 90, 3],
  ["Starbucks", "FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE", 4, 9, 8],
  ["Chipotle", "FOOD_AND_DRINK", "FOOD_AND_DRINK_FAST_FOOD", 11, 18, 3],
  ["Uber Eats", "FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT", 22, 55, 2],
  ["Shell", "TRANSPORTATION", "TRANSPORTATION_GAS", 35, 65, 3],
  ["Uber", "TRANSPORTATION", "TRANSPORTATION_TAXIS_AND_RIDE_SHARES", 12, 38, 2],
  ["Amazon", "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", 12, 120, 5],
  ["Target", "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_SUPERSTORES", 20, 110, 2],
  ["Netflix", "ENTERTAINMENT", "ENTERTAINMENT_TV_AND_MOVIES", 15.49, 15.49, 1],
  ["Spotify", "ENTERTAINMENT", "ENTERTAINMENT_MUSIC_AND_AUDIO", 11.99, 11.99, 1],
  ["PG&E", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY", 80, 140, 1],
  ["Comcast", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_INTERNET_AND_CABLE", 79.99, 79.99, 1],
  ["CVS", "MEDICAL", "MEDICAL_PHARMACIES_AND_SUPPLEMENTS", 8, 45, 1],
  ["Equinox", "PERSONAL_CARE", "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", 220, 220, 1],
  ["Home Depot", "HOME_IMPROVEMENT", "HOME_IMPROVEMENT_HARDWARE", 15, 180, 1],
];

function rand(seed: { v: number }) {
  seed.v = (seed.v * 1103515245 + 12345) % 2147483648;
  return seed.v / 2147483648;
}

function tx(
  id: string,
  account: string,
  date: string,
  name: string,
  amount: number,
  primary: string,
  detailed: string,
): Transaction {
  return {
    transaction_id: id,
    account_id: account,
    amount: Math.round(amount * 100) / 100,
    iso_currency_code: "USD",
    date,
    authorized_datetime: null,
    name,
    merchant_name: name,
    pending: false,
    pending_transaction_id: null,
    personal_finance_category: { primary, detailed, confidence_level: "VERY_HIGH" },
  } as unknown as Transaction;
}

/** Loads about two months of realistic-looking sample data so the app is usable without Plaid. */
export function loadDemoData() {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO items (item_id, access_token, institution_name, is_demo) VALUES (?, 'demo', 'Sample Bank', 1)",
  ).run(DEMO_ITEM);
  const acct = db.prepare(
    "INSERT OR IGNORE INTO accounts (account_id, item_id, name, mask, type, subtype) VALUES (?, ?, ?, ?, ?, ?)",
  );
  acct.run("demo-checking", DEMO_ITEM, "Everyday Checking", "1234", "depository", "checking");
  acct.run("demo-credit", DEMO_ITEM, "Active Cash Card", "5678", "credit", "credit card");

  const seed = { v: 42 };
  const out: Transaction[] = [];
  const today = new Date();
  for (let m = 1; m >= 0; m--) {
    const month = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const days = m === 0 ? today.getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const day = (d: number) =>
      new Date(month.getFullYear(), month.getMonth(), Math.min(d, days)).toISOString().slice(0, 10);
    const key = `${month.getFullYear()}-${month.getMonth()}`;

    for (const [merchant, primary, detailed, min, max, perMonth] of SAMPLES) {
      for (let i = 0; i < perMonth; i++) {
        const d = 1 + Math.floor(rand(seed) * days);
        const amount = min + rand(seed) * (max - min);
        out.push(tx(`demo-${key}-${merchant}-${i}`, "demo-credit", day(d), merchant, amount, primary, detailed));
      }
    }
    out.push(tx(`demo-${key}-rent`, "demo-checking", day(1), "Rent - Oak St Apartments", 2400, "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT"));
    out.push(tx(`demo-${key}-pay1`, "demo-checking", day(1), "ACME Corp Payroll", -3800, "INCOME", "INCOME_WAGES"));
    out.push(tx(`demo-${key}-pay2`, "demo-checking", day(15), "ACME Corp Payroll", -3800, "INCOME", "INCOME_WAGES"));
    out.push(tx(`demo-${key}-ccpay`, "demo-checking", day(20), "Wells Fargo Card Payment", 1650, "LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"));
    out.push(tx(`demo-${key}-venmo`, "demo-checking", day(12), "Venmo", 60, "TRANSFER_OUT", "TRANSFER_OUT_ACCOUNT_TRANSFER"));
  }
  applyChanges(db, DEMO_ITEM, out, [], []);
  return out.length;
}

export function removeDemoData() {
  getDb().prepare("DELETE FROM items WHERE item_id = ?").run(DEMO_ITEM);
}
