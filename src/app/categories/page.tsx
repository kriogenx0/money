import ActionButton from "@/components/ActionButton";
import { AddCategory, AddRule, CategoryRow } from "@/components/CategoryEditor";
import { listCategories, listRules } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  const categories = listCategories();
  const rules = listRules();
  return (
    <>
      <h1>Categories &amp; rules</h1>
      <p className="muted small">
        Each transaction gets a category from, in order: your choice on that transaction, your merchant rules
        (newest first), then Plaid&rsquo;s own category.
      </p>

      <h2>Merchant rules</h2>
      <div className="card">
        <AddRule categories={categories} />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>
                    contains <strong>{r.pattern}</strong>
                  </td>
                  <td>
                    <span className="dot" style={{ background: r.color }} />
                    {r.category_name}
                  </td>
                  <td className="small muted">{r.matches} transactions</td>
                  <td className="num">
                    <ActionButton url={`/api/rules/${r.id}`} method="DELETE" label="Delete" className="link small" />
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td className="muted small">
                    No rules yet. Pick a category on any transaction and choose &ldquo;Always for&rdquo; to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2>Categories</h2>
      <div className="card">
        <AddCategory />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <tbody>
              {categories.map((c) => (
                <CategoryRow key={`${c.id}-${c.name}-${c.color}-${c.excluded}`} category={c} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          &ldquo;Not spending&rdquo; categories, like transfers and card payments, are left out of spending totals so
          paying your credit card doesn&rsquo;t count twice.
        </p>
      </div>
    </>
  );
}
