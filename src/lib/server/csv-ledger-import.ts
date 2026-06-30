import { createHash } from "node:crypto";
import { addDays, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ParsedLedgerTransaction, SupportedBankSource } from "@/lib/transaction-import";
import { classifyTransaction } from "./transaction-classifier";

export async function importCsvLedger(userId: string, source: SupportedBankSource, transactions: ParsedLedgerTransaction[]) {
  const account = await prisma.financialAccount.upsert({
    where: { userId_provider_providerAccountId: { userId, provider: "CSV", providerAccountId: source } },
    update: {},
    create: { userId, provider: "CSV", providerAccountId: source, name: `${source} CSV`, displayName: `${source === "ALLY" ? "Ally" : "Discover"} CSV fallback`, accountType: source === "DISCOVER" ? "CREDIT_CARD" : "CHECKING", includeInDashboard: false },
  });
  const [rules, categories] = await Promise.all([
    prisma.transactionRule.findMany({ where: { userId, isActive: true }, orderBy: { priority: "desc" } }),
    prisma.category.findMany({ where: { userId, isArchived: false }, select: { id: true, name: true } }),
  ]);
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  let added = 0, duplicates = 0, autoCategorized = 0, review = 0, matchedSimpleFin = 0;
  for (const item of transactions) {
    const fingerprint = createHash("sha256").update(item.sourceId).digest("hex");
    const classification = classifyTransaction({ description: item.description, amountCents: item.amountCents, accountType: account.accountType, providerCategory: item.rawCategory, rules, categoryIdByName });
    const existing = await prisma.transaction.findFirst({ where: { userId, OR: [
      { importSource: "CSV", importFingerprint: fingerprint },
      { importSource: "SIMPLEFIN", amountCents: item.amountCents, OR: [{ normalizedDescription: classification.normalized }, { merchantName: classification.merchantName }], postedAt: { gte: subDays(item.postedAt, 5), lte: addDays(item.postedAt, 5) } },
    ] } });
    if (existing) { duplicates++; if (existing.importSource === "SIMPLEFIN") matchedSimpleFin++; continue; }
    await prisma.transaction.create({ data: { userId, accountId: account.id, importSource: "CSV", importFingerprint: fingerprint, postedAt: item.postedAt, amountCents: item.amountCents, description: item.description, merchantName: classification.merchantName, normalizedDescription: classification.normalized, rawCategory: item.rawCategory, transactionKind: classification.kind, categoryId: classification.categoryId, reviewStatus: classification.reviewStatus } });
    added++; if (classification.reviewStatus === "NEEDS_REVIEW") review++; else autoCategorized++;
  }
  return { added, duplicates, autoCategorized, review, matchedSimpleFin };
}
