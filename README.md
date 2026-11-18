# Money

A personal Rocket Money-style app: connect Wells Fargo (or any bank) through Plaid, pull transactions with
`/transactions/sync`, and categorize your spending.

## What it does

- **Plaid Link** to connect checking and credit card accounts.
- **Webhook receiver** at `/api/plaid/webhook`. Signatures are verified with Plaid's `Plaid-Verification` JWT,
  and `SYNC_UPDATES_AVAILABLE` triggers a sync in the background.
- **`/transactions/sync`** with the cursor stored per bank connection, so nothing is processed twice.
  Pending transactions that post keep your manual category.
- **Categorization**, in this order:
  1. Your choice on a single transaction.
  2. Your merchant rules ("merchant contains *costco* → Groceries"), newest first.
  3. Plaid's `personal_finance_category`, mapped to friendly categories (see `src/lib/categories.ts`).
- Income, transfers, and credit card payments are marked "not spending" so paying the card from checking
  doesn't double count.
- **Notification delay** stats on the Accounts page, to measure how long Plaid takes to report purchases.
- **Sample data** so the app is usable before Plaid keys are added.

## Running locally

```sh
cp .env.example .env.local   # fill in what you have; everything is optional locally
npm install
npm run dev                  # http://localhost:3000
npm test
```

Without `APP_PASSWORD` the app is open locally. In production it refuses to serve until a password is set.

In Plaid sandbox, connect "First Platypus Bank" (or any bank) with `user_good` / `pass_good`.
`user_transactions_dynamic` gives transactions that change over time and fire webhooks.

## Environment

| Variable | Purpose |
| --- | --- |
| `APP_PASSWORD` | Password for the web UI. Required in production. |
| `SESSION_SECRET` | Signs the login cookie. Any long random string. |
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | From the Plaid dashboard. |
| `PLAID_ENV` | `sandbox` or `production`. |
| `PUBLIC_URL` | e.g. `https://money.kriogenx.com`; the webhook URL is built from it. |
| `DATA_DIR` | Folder for the SQLite database. `/data` in Docker. |

## Deploying

The `Dockerfile` builds a standalone Next.js server on port 3000 and keeps the SQLite database in `/data`.
Mount a persistent volume there. It is deployed with Coolify at https://money.kriogenx.com.

Changing a webhook URL only affects banks connected afterwards; existing connections keep the URL they were
created with.
