import ActionButton from "@/components/ActionButton";
import ConnectBank from "@/components/ConnectBank";
import { latencyStats, listItems, recentWebhooks } from "@/lib/queries";
import { plaidConfigured, plaidEnv, webhookUrl } from "@/lib/plaid";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  const items = listItems();
  const configured = plaidConfigured();
  const hasDemo = items.some((i) => i.is_demo);
  const webhooks = recentWebhooks();
  const latency = latencyStats();

  return (
    <>
      <h1>Accounts</h1>

      <div className="card">
        {configured ? (
          <>
            <ConnectBank />
            <p className="small muted">
              Plaid environment: <strong>{plaidEnv()}</strong>. Webhook URL:{" "}
              <code>{webhookUrl() ?? "not set (set PUBLIC_URL)"}</code>
              {plaidEnv() === "sandbox" && " In sandbox, sign in with user_good / pass_good."}
            </p>
          </>
        ) : (
          <p>
            Plaid isn&rsquo;t set up yet. Add <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> to the
            app&rsquo;s environment to connect a bank. Until then you can explore with sample data.
          </p>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          {configured && items.some((i) => !i.is_demo) && <ActionButton url="/api/sync" label="Sync now" />}
          {hasDemo ? (
            <ActionButton url="/api/demo" method="DELETE" label="Remove sample data" className="danger" />
          ) : (
            <ActionButton url="/api/demo" label="Load sample data" />
          )}
        </div>
      </div>

      {items.map((item) => (
        <div className="card" key={item.item_id} style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>
              {item.institution_name ?? "Bank"} {item.is_demo ? <span className="pill">sample</span> : null}
            </strong>
            {!item.is_demo && (
              <ActionButton
                url={`/api/items/${encodeURIComponent(item.item_id)}`}
                method="DELETE"
                label="Disconnect"
                className="link small"
                confirm="Disconnect this bank and delete its transactions?"
              />
            )}
          </div>
          <ul className="small">
            {item.accounts.map((a) => (
              <li key={a.account_id}>
                {a.name} {a.mask && <span className="muted">··{a.mask}</span>}{" "}
                {a.subtype && <span className="muted">({a.subtype})</span>}
              </li>
            ))}
          </ul>
          <div className="small muted">
            {item.transaction_count} transactions
            {item.last_synced_at && ` · last synced ${item.last_synced_at} UTC`}
          </div>
          {item.last_error && <div className="small error">{item.last_error}</div>}
        </div>
      ))}

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <strong>Notification delay</strong>
          {latency.n > 0 ? (
            <p>
              Across {latency.n} new transactions, the app saw a purchase on average{" "}
              <strong>{latency.avg_hours!.toFixed(1)} hours</strong> after it happened (longest{" "}
              {latency.max_hours!.toFixed(1)} hours).
            </p>
          ) : (
            <p className="small muted">
              Shows up once new purchases arrive after the first import. Dates without a time count from the end of
              that day, so real delays may be longer.
            </p>
          )}
        </div>
        <div className="card">
          <strong>Recent webhooks</strong>
          {webhooks.length === 0 ? (
            <p className="small muted">None received yet.</p>
          ) : (
            <table className="small">
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id}>
                    <td className="muted">{w.received_at}</td>
                    <td>
                      {w.webhook_type} {w.webhook_code}
                    </td>
                    <td>{w.verified ? "verified" : <span className="error">unverified</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
