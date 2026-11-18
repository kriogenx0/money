import { describe, expect, it } from "vitest";
import { categorize, type CategoryLookup } from "../categories";

const lookup = (rules: CategoryLookup["rules"] = []): CategoryLookup => ({
  rules,
  idByName: new Map([
    ["Groceries", 1],
    ["Dining & Drinks", 2],
    ["Credit Card Payments", 3],
    ["Uncategorized", 4],
    ["Subscriptions", 5],
  ]),
});

const tx = (o: Partial<Parameters<typeof categorize>[0]>) => ({
  name: "X",
  merchant_name: null,
  plaid_primary: null,
  plaid_detailed: null,
  ...o,
});

describe("categorize", () => {
  it("prefers Plaid's detailed category when mapped", () => {
    expect(categorize(tx({ plaid_primary: "FOOD_AND_DRINK", plaid_detailed: "FOOD_AND_DRINK_GROCERIES" }), lookup()))
      .toEqual({ categoryId: 1, source: "plaid" });
  });

  it("falls back to Plaid's primary category", () => {
    expect(categorize(tx({ plaid_primary: "FOOD_AND_DRINK", plaid_detailed: "FOOD_AND_DRINK_COFFEE" }), lookup()))
      .toEqual({ categoryId: 2, source: "plaid" });
  });

  it("treats credit card payments as not spending", () => {
    expect(categorize(tx({ plaid_primary: "LOAN_PAYMENTS", plaid_detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" }), lookup()).categoryId)
      .toBe(3);
  });

  it("applies merchant rules case-insensitively, newest first", () => {
    const rules = [
      { id: 2, pattern: "NETFLIX", category_id: 5 },
      { id: 1, pattern: "net", category_id: 2 },
    ];
    expect(categorize(tx({ merchant_name: "Netflix", plaid_primary: "ENTERTAINMENT" }), lookup(rules)))
      .toEqual({ categoryId: 5, source: "rule" });
  });

  it("matches rules against the raw name too", () => {
    expect(categorize(tx({ name: "SQ *BLUE BOTTLE" }), lookup([{ id: 1, pattern: "blue bottle", category_id: 2 }])).categoryId)
      .toBe(2);
  });

  it("uses Uncategorized when nothing matches", () => {
    expect(categorize(tx({ plaid_primary: "SOMETHING_NEW" }), lookup())).toEqual({ categoryId: 4, source: "default" });
  });
});
