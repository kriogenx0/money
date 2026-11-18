import Link from "next/link";
import TransactionCategory from "@/components/TransactionCategory";
import { categoryTotals, listCategories, listMonths, listTransactions } from "@/lib/queries";
import { currentMonth, money, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = { month?: string; category?: string };

export default async function SpendingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const months = listMonths();
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0] ?? currentMonth();
  const categoryId = sp.category ? Number(sp.category) : undefined;

  const categories = listCategories();
  const totals = categoryTotals(month);
  const transactions = listTransactions(month, categoryId);
  const spendingRows = totals.filter((t) => !t.excluded && t.total > 0);
  const spent = spendingRows.reduce((s, t) => s + t.total, 0);
  const income = -(totals.find((t) => t.name === "Income")?.total ?? 0);
  const max = Math.max(1, ...spendingRows.map((t) => t.total));
  const selected = categories.find((c) => c.id === categoryId);

  if (months.length === 0) {
    return (
      <>
        <h1>Spending</h1>
        <div className="card">
          <p>No transactions yet.</p>
          <p>
            <Link href="/accounts">Connect a bank or load sample data</Link> to get started.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{monthLabel(month)}</h1>
        <form className="row">
          <select name="month" defaultValue={month} aria-label="Month">
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button type="submit">Show</button>
        </form>
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="label">Spent</div>
          <div className="value">{money(spent)}</div>
        </div>
        <div className="card stat">
          <div className="label">Income</div>
          <div className="value positive">{money(income)}</div>
        </div>
        <div className="card stat">
          <div className="label">Transactions</div>
          <div className="value">{totals.reduce((s, t) => s + t.count, 0)}</div>
        </div>
      </div>

      <div className="card">
        {spendingRows.map((t) => (
          <div className="bar-row" key={t.id}>
            <Link href={`/?month=${month}&category=${t.id}`} className="small">
              <span className="dot" style={{ background: t.color }} />
              {t.name}
            </Link>
            <div className="bar-track">
              <div className="bar" style={{ width: `${(t.total / max) * 100}%`, background: t.color }} />
            </div>
            <div className="num small">{money(t.total)}</div>
          </div>
        ))}
        {spendingRows.length === 0 && <p className="muted">No spending this month.</p>}
      </div>

      <h2>
        {selected ? (
          <>
            {selected.name} transactions <Link href={`/?month=${month}`} className="small">Show all</Link>
          </>
        ) : (
          "Transactions"
        )}
      </h2>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th className="hide-sm">Account</th>
              <th className="num">Amount</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.transaction_id}>
                <td className="small muted" style={{ whiteSpace: "nowrap" }}>{t.date.slice(5)}</td>
                <td>
                  {t.merchant_name ?? t.name}
                  {t.pending ? <span className="pill" style={{ marginLeft: 6 }}>pending</span> : null}
                  {t.merchant_name && t.merchant_name !== t.name && (
                    <div className="small muted">{t.name}</div>
                  )}
                </td>
                <td className="small muted hide-sm">
                  {t.account_name}
                  {t.account_mask ? ` ··${t.account_mask}` : ""}
                </td>
                <td className={`num ${t.amount < 0 ? "positive" : ""}`}>{t.amount < 0 ? `+${money(-t.amount)}` : money(t.amount)}</td>
                <td>
                  <TransactionCategory
                    transactionId={t.transaction_id}
                    merchant={t.merchant_name ?? t.name}
                    categoryId={t.category_id}
                    source={t.category_source}
                    categories={categories}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
