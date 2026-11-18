import { Configuration, PlaidApi, PlaidEnvironments } from "plaid/legacy";

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidEnv(): string {
  return process.env.PLAID_ENV || "sandbox";
}

let client: PlaidApi | null = null;

export function getPlaid(): PlaidApi {
  if (!plaidConfigured()) {
    throw new Error("Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.");
  }
  if (!client) {
    const env = plaidEnv();
    const basePath = PlaidEnvironments[env];
    if (!basePath) throw new Error(`Unknown PLAID_ENV "${env}"`);
    client = new PlaidApi(
      new Configuration({
        basePath,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
            "PLAID-SECRET": process.env.PLAID_SECRET!,
          },
        },
      }),
    );
  }
  return client;
}

/** Public URL Plaid should call for webhooks, e.g. https://money.kriogenx.com/api/plaid/webhook */
export function webhookUrl(): string | undefined {
  const base = process.env.PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/api/plaid/webhook` : undefined;
}

export function plaidErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error_code?: string; error_message?: string } } })
    ?.response?.data;
  if (data?.error_code) return `${data.error_code}: ${data.error_message}`;
  return err instanceof Error ? err.message : String(err);
}
