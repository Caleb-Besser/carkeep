import { parse } from "csv-parse/sync";
import { TRANSACTION_SOURCE } from "./constants";

type AllyRow = {
  Date: string;
  Time: string;
  Amount: string;
  Description: string;
};

type DiscoverRow = {
  "Trans. Date": string;
  Description: string;
  Amount: string;
  Category: string;
};

export type SupportedBankSource = (typeof TRANSACTION_SOURCE)[keyof typeof TRANSACTION_SOURCE];

export type ParsedLedgerTransaction = {
  source: SupportedBankSource;
  sourceId: string;
  postedAt: Date;
  amountCents: number;
  description: string;
  rawCategory: string | null;
};

function parseCsvContents(contents: string) {
  return parse(contents, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

function detectCsvSource(headers: string[]): SupportedBankSource | null {
  if (
    headers.includes("Date") &&
    headers.includes("Time") &&
    headers.includes("Amount") &&
    headers.includes("Description")
  ) {
    return TRANSACTION_SOURCE.ALLY;
  }

  if (
    headers.includes("Trans. Date") &&
    headers.includes("Post Date") &&
    headers.includes("Description") &&
    headers.includes("Amount")
  ) {
    return TRANSACTION_SOURCE.DISCOVER;
  }

  return null;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseAllyDate(row: AllyRow) {
  const isoDate = new Date(`${row.Date}T${row.Time}`);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const [month, day, year] = row.Date.split(/[/-]/);
  return new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${row.Time}`
  );
}

function parseDiscoverDate(value: string) {
  const [month, day, year] = value.split("/");
  return new Date(`${year}-${month}-${day}T12:00:00`);
}

function toAmountCents(amount: string) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

function buildAllySourceId(row: AllyRow) {
  return `ally:${row.Date}T${row.Time}:${row.Amount}:${normalizeText(row.Description)}`;
}

function buildDiscoverSourceId(row: DiscoverRow) {
  return `discover:${row["Trans. Date"]}:${row.Amount}:${normalizeText(row.Description)}`;
}

export function parseLedgerTransactionsCsv(contents: string): {
  source: SupportedBankSource;
  transactions: ParsedLedgerTransaction[];
} {
  const rows = parseCsvContents(contents);
  const source = detectCsvSource(Object.keys(rows[0] ?? {}));

  if (!source) {
    throw new Error("This CSV format is not supported yet. Upload an Ally or Discover export.");
  }

  if (source === TRANSACTION_SOURCE.ALLY) {
    return {
      source,
      transactions: (rows as AllyRow[]).flatMap((row) => {
        const amountCents = toAmountCents(row.Amount);
        if (amountCents === null) return [];
        return [{
          source,
          sourceId: buildAllySourceId(row),
          postedAt: parseAllyDate(row),
          amountCents,
          description: normalizeText(row.Description),
          rawCategory: null,
        }];
      }),
    };
  }

  return {
    source,
    transactions: (rows as DiscoverRow[]).flatMap((row) => {
      const amountCents = toAmountCents(row.Amount);
      if (amountCents === null) return [];
      return [{
        source,
        sourceId: buildDiscoverSourceId(row),
        postedAt: parseDiscoverDate(row["Trans. Date"]),
        amountCents: -amountCents,
        description: normalizeText(row.Description),
        rawCategory: normalizeText(row.Category),
      }];
    }),
  };
}
