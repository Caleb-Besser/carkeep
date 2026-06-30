import "server-only";

export type SimpleFinTransaction = {
  id: string;
  postedAt: Date;
  transactedAt: Date | null;
  amountCents: number;
  description: string;
  pending: boolean;
  category: string | null;
  extra: Record<string, unknown> | null;
};

export type SimpleFinAccount = {
  id: string;
  name: string;
  institutionName: string | null;
  currency: string;
  balanceCents: number;
  availableBalanceCents: number | null;
  transactions: SimpleFinTransaction[];
};

export type SimpleFinAccountSet = {
  accounts: SimpleFinAccount[];
  warnings: string[];
};

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const stringField = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`SimpleFIN returned an invalid ${field}.`);
  return value;
};
const optionalString = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const cents = (value: unknown, field: string) => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`SimpleFIN returned an invalid ${field}.`);
  return Math.round(parsed * 100);
};
const epochDate = (value: unknown, fallback?: Date) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback ?? new Date(0);
  return new Date(parsed * 1000);
};

function safeHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("SimpleFIN URLs must use HTTPS.");
  return url;
}

function simpleFinRequest(url: URL) {
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  url.username = "";
  url.password = "";
  return {
    url,
    headers: username || password
      ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}` }
      : undefined,
  };
}

export async function claimSetupToken(setupToken: string) {
  let claimUrl: URL;
  try {
    claimUrl = safeHttpsUrl(Buffer.from(setupToken.trim(), "base64").toString("utf8"));
  } catch {
    throw new Error("That SimpleFIN setup token is not valid.");
  }

  const response = await fetch(claimUrl, { method: "POST", cache: "no-store", redirect: "error" });
  if (response.status === 403) throw new Error("SimpleFIN rejected this one-time token. Revoke it if you did not already claim it, then create a new token.");
  if (!response.ok) throw new Error(`SimpleFIN connection failed (${response.status}).`);
  const accessUrl = (await response.text()).trim();
  safeHttpsUrl(accessUrl);
  return accessUrl;
}

export async function fetchAccountSet(accessUrl: string, startDate: Date) {
  const url = safeHttpsUrl(accessUrl.replace(/\/$/, "") + "/accounts");
  url.searchParams.set("start-date", String(Math.floor(startDate.getTime() / 1000)));
  url.searchParams.set("pending", "1");
  url.searchParams.set("version", "2");

  const request = simpleFinRequest(url);
  const response = await fetch(request.url, { headers: request.headers, cache: "no-store", redirect: "error" });
  if (response.status === 403) throw new Error("SimpleFIN access was revoked or expired. Reconnect from Settings.");
  if (response.status === 402) throw new Error("SimpleFIN Bridge reports that the subscription needs attention.");
  if (!response.ok) throw new Error(`SimpleFIN sync failed (${response.status}).`);

  const payload: unknown = await response.json();
  if (!isObject(payload) || !Array.isArray(payload.accounts)) throw new Error("SimpleFIN returned an unexpected account-set payload.");
  const errors = Array.isArray(payload.errlist) ? payload.errlist : Array.isArray(payload.errors) ? payload.errors : [];
  const warnings = errors.flatMap((item) => {
    if (!isObject(item)) return [];
    const message = optionalString(item.msg) ?? optionalString(item.message);
    const code = optionalString(item.code);
    if (!message) return [];
    return [`${code ? `${code}: ` : ""}${message}`.replace(/https?:\/\/\S+/gi, "[link hidden]").slice(0, 240)];
  });
  const connections = Array.isArray(payload.connections) ? payload.connections.filter(isObject) : [];
  const connectionNames = new Map(connections.map((item) => [optionalString(item.conn_id), optionalString(item.org_name) ?? optionalString(item.name)]));

  const accounts = payload.accounts.map((raw): SimpleFinAccount => {
    if (!isObject(raw)) throw new Error("SimpleFIN returned an invalid account.");
    const transactions = Array.isArray(raw.transactions) ? raw.transactions : [];
    return {
      id: stringField(raw.id, "account id"),
      name: stringField(raw.name, "account name"),
      institutionName: optionalString(raw["org-name"]) ?? connectionNames.get(optionalString(raw.conn_id)) ?? null,
      currency: optionalString(raw.currency) ?? "USD",
      balanceCents: cents(raw.balance, "account balance"),
      availableBalanceCents: raw["available-balance"] == null ? null : cents(raw["available-balance"], "available balance"),
      transactions: transactions.map((item): SimpleFinTransaction => {
        if (!isObject(item)) throw new Error("SimpleFIN returned an invalid transaction.");
        const extra = isObject(item.extra) ? item.extra : null;
        const pending = item.pending === true || Number(item.posted) === 0;
        const transactedAt = item.transacted_at == null ? null : epochDate(item.transacted_at);
        return {
          id: stringField(item.id, "transaction id"),
          postedAt: epochDate(item.posted, transactedAt ?? new Date()),
          transactedAt,
          amountCents: cents(item.amount, "transaction amount"),
          description: stringField(item.description, "transaction description"),
          pending,
          category: optionalString(extra?.category),
          extra,
        };
      }),
    };
  });
  if (accounts.length === 0 && warnings.length > 0) throw new Error(`SimpleFIN: ${warnings[0]}`);
  return { accounts, warnings } satisfies SimpleFinAccountSet;
}
