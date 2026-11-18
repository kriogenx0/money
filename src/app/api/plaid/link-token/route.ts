import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid/legacy";
import { getPlaid, plaidErrorMessage, webhookUrl } from "@/lib/plaid";

export async function POST() {
  try {
    const res = await getPlaid().linkTokenCreate({
      user: { client_user_id: "owner" },
      client_name: "Money",
      products: [Products.Transactions],
      transactions: { days_requested: 730 },
      country_codes: [CountryCode.Us],
      language: "en",
      webhook: webhookUrl(),
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 500 });
  }
}
