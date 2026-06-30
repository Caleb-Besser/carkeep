import type { FinancialAccountType, TransactionKind, TransactionRule, TransactionRuleMatchType } from "@prisma/client";

export function normalizeTransactionText(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[#*]\d{3,}\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[^A-Z0-9&' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(text: string, matchText: string, type: TransactionRuleMatchType) {
  const needle = normalizeTransactionText(matchText);
  if (type === "EXACT") return text === needle;
  if (type === "STARTS_WITH") return text.startsWith(needle);
  if (type === "REGEX") {
    try { return new RegExp(matchText, "i").test(text); } catch { return false; }
  }
  return text.includes(needle);
}

const KIND_PATTERNS: Array<[TransactionKind, RegExp]> = [
  ["CREDIT_CARD_PAYMENT", /DISCOVER E-?PAYMENT|INTERNET PAYMENT.*THANK YOU|CREDIT CARD PAYMENT|AUTOPAY PAYMENT/],
  ["SAVINGS_TRANSFER", /ROUND ?UPS|TRANSFER TO SAVINGS|SAVINGS TRANSFER/],
  ["TRANSFER", /INTERNET TRANSFER|ACCOUNT TO ACCOUNT|INTERNAL TRANSFER|ZELLE PAYMENT|PAYPAL TRANSFER|VENMO PAYMENT/],
  ["INCOME", /PAYROLL|PAYCHECK|DIRECT DEP(OSIT)?|SALARY|WAGES|PAYCHEX|\bADP\b|GUSTO|WORKDAY/],
  ["CASH_WITHDRAWAL", /ATM WITHDRAWAL|CASH WITHDRAWAL/],
  ["REIMBURSEMENT", /REIMBURSEMENT/],
  ["REFUND", /REFUND|RETURN|REVERSAL/],
];

const PROVIDER_CATEGORY_MAP: Record<string, string> = {
  restaurants: "Eating Out", dining: "Eating Out", groceries: "Groceries", supermarkets: "Groceries",
  gasoline: "Gas", fuel: "Gas", merchandise: "Shopping", shopping: "Shopping",
  entertainment: "Fun & Going Out",
};

export function classifyTransaction(input: {
  description: string;
  amountCents: number;
  accountType: FinancialAccountType;
  providerCategory: string | null;
  rules: TransactionRule[];
  categoryIdByName: Map<string, string>;
}) {
  const normalized = normalizeTransactionText(input.description);
  if (
    /ZELLE PAYMENT FROM CALEB.*TO NICOLE FANNING/.test(normalized) &&
    Math.abs(input.amountCents) >= 60300 &&
    Math.abs(input.amountCents) <= 60600
  ) {
    return {
      normalized,
      merchantName: "Mom household payment",
      kind: "EXPENSE" as const,
      categoryId: input.categoryIdByName.get("Required Bills") ?? null,
      reviewStatus: "AUTO_CATEGORIZED" as const,
    };
  }

  let kind: TransactionKind = "UNCATEGORIZED";
  for (const [candidate, pattern] of KIND_PATTERNS) {
    if (pattern.test(normalized)) { kind = candidate; break; }
  }

  if (kind === "UNCATEGORIZED") {
    if (input.amountCents < 0) kind = "EXPENSE";
    else if (input.accountType === "CREDIT_CARD") kind = "REFUND";
    else kind = "INCOME";
  }

  const rule = input.rules.find((candidate) => candidate.isActive && matches(normalized, candidate.matchText, candidate.matchType));
  if (rule) {
    return { normalized, merchantName: rule.normalizedMerchant ?? normalized, kind: rule.transactionKind, categoryId: rule.categoryId, reviewStatus: "AUTO_CATEGORIZED" as const };
  }

  if (/OPENAI|GOOGLE YOUTUBE|GOOGLE CRUNCHYROLL|GOOGLE ONE/.test(normalized)) {
    return {
      normalized,
      merchantName: normalized,
      kind: "EXPENSE" as const,
      categoryId: input.categoryIdByName.get("Subscriptions") ?? null,
      reviewStatus: "NEEDS_REVIEW" as const,
    };
  }

  if (kind !== "EXPENSE" && kind !== "REFUND") {
    return { normalized, merchantName: normalized, kind, categoryId: null, reviewStatus: "AUTO_CATEGORIZED" as const };
  }

  const mappedName = input.providerCategory ? PROVIDER_CATEGORY_MAP[input.providerCategory.trim().toLowerCase()] : undefined;
  const categoryId = mappedName ? input.categoryIdByName.get(mappedName) ?? null : null;
  return { normalized, merchantName: normalized, kind, categoryId, reviewStatus: categoryId ? "AUTO_CATEGORIZED" as const : "NEEDS_REVIEW" as const };
}
