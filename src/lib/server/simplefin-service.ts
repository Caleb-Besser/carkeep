import "server-only";

import type { FinancialAccountType, Prisma } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ensureBudgetWorkspace } from "@/lib/default-user";
import { assertSecretEncryptionConfigured, decryptSecret, encryptSecret } from "./secret-crypto";
import { claimSetupToken, fetchAccountSet, type SimpleFinAccount } from "./simplefin-adapter";
import { classifyTransaction } from "./transaction-classifier";

function inferAccountType(account: SimpleFinAccount): FinancialAccountType {
  const text = `${account.name} ${account.institutionName ?? ""}`.toUpperCase();
  if (/CREDIT|CARD|DISCOVER|VISA|MASTERCARD/.test(text)) return "CREDIT_CARD";
  if (/SAVING|MONEY MARKET/.test(text)) return "SAVINGS";
  if (/CHECKING|SPENDING|DEBIT/.test(text)) return "CHECKING";
  if (/CASH/.test(text)) return "CASH";
  return "OTHER";
}

function safeSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "SimpleFIN sync failed.";
  return message.replace(/https?:\/\/\S+/gi, "[credential hidden]").slice(0, 300);
}

async function importAccounts(userId: string, accounts: SimpleFinAccount[]) {
  const [rules, categories] = await Promise.all([
    prisma.transactionRule.findMany({ where: { userId, isActive: true }, orderBy: { priority: "desc" } }),
    prisma.category.findMany({ where: { userId, isArchived: false }, select: { id: true, name: true } }),
  ]);
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  let added = 0;
  let updated = 0;
  let review = 0;
  const now = new Date();

  for (const sourceAccount of accounts) {
    const accountType = inferAccountType(sourceAccount);
    const account = await prisma.financialAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: "SIMPLEFIN", providerAccountId: sourceAccount.id } },
      update: { institutionName: sourceAccount.institutionName, name: sourceAccount.name, currentBalanceCents: sourceAccount.balanceCents, availableBalanceCents: sourceAccount.availableBalanceCents, currency: sourceAccount.currency, lastSyncedAt: now },
      create: { userId, providerAccountId: sourceAccount.id, provider: "SIMPLEFIN", institutionName: sourceAccount.institutionName, name: sourceAccount.name, displayName: sourceAccount.name, accountType, currentBalanceCents: sourceAccount.balanceCents, availableBalanceCents: sourceAccount.availableBalanceCents, currency: sourceAccount.currency, lastSyncedAt: now },
    });
    const providerTransactionIds = sourceAccount.transactions.map((transaction) => transaction.id);
    const existingTransactions = providerTransactionIds.length
      ? await prisma.transaction.findMany({
          where: { accountId: account.id, providerTransactionId: { in: providerTransactionIds } },
          select: { id: true, providerTransactionId: true },
        })
      : [];
    const existingTransactionByProviderId = new Map(
      existingTransactions
        .filter((transaction) => transaction.providerTransactionId)
        .map((transaction) => [transaction.providerTransactionId as string, transaction.id])
    );

    for (const sourceTransaction of sourceAccount.transactions) {
      const classification = classifyTransaction({ description: sourceTransaction.description, amountCents: sourceTransaction.amountCents, accountType: account.accountType, providerCategory: sourceTransaction.category, rules, categoryIdByName });
      const data = {
        postedAt: sourceTransaction.postedAt,
        transactedAt: sourceTransaction.transactedAt,
        amountCents: sourceTransaction.amountCents,
        description: sourceTransaction.description,
        merchantName: classification.merchantName,
        normalizedDescription: classification.normalized,
        rawCategory: sourceTransaction.category,
        transactionKind: classification.kind,
        categoryId: classification.categoryId,
        isPending: sourceTransaction.pending,
        reviewStatus: classification.reviewStatus,
        rawData: sourceTransaction.extra as Prisma.InputJsonValue | undefined,
      };
      const existingId = existingTransactionByProviderId.get(sourceTransaction.id);
      if (existingId) {
        await prisma.transaction.update({ where: { id: existingId }, data });
        updated++;
      } else {
        const csvMatch = await prisma.transaction.findFirst({
          where: { userId, importSource: "CSV", amountCents: sourceTransaction.amountCents, normalizedDescription: classification.normalized, postedAt: { gte: subDays(sourceTransaction.postedAt, 2), lte: addDays(sourceTransaction.postedAt, 2) } },
          select: { id: true },
        });
        if (csvMatch) await prisma.transaction.delete({ where: { id: csvMatch.id } });
        const possiblePending = sourceTransaction.pending ? null : await prisma.transaction.findFirst({
          where: { accountId: account.id, isPending: true, amountCents: sourceTransaction.amountCents, normalizedDescription: classification.normalized, postedAt: { gte: subDays(sourceTransaction.postedAt, 5), lte: sourceTransaction.postedAt } },
          orderBy: { postedAt: "desc" },
        });
        if (possiblePending) {
          await prisma.transaction.update({ where: { id: possiblePending.id }, data: { ...data, providerTransactionId: sourceTransaction.id } });
          updated++;
        } else {
          await prisma.transaction.create({ data: { userId, accountId: account.id, providerTransactionId: sourceTransaction.id, importSource: "SIMPLEFIN", ...data } });
          added++;
        }
      }
      if (classification.reviewStatus === "NEEDS_REVIEW") review++;
    }
  }
  return { added, updated, review, accounts: accounts.length };
}

export async function connectSimpleFin(setupToken: string) {
  assertSecretEncryptionConfigured();
  const user = await ensureBudgetWorkspace();
  const accessUrl = await claimSetupToken(setupToken);
  const encryptedAccessUrl = encryptSecret(accessUrl);
  const connection = await prisma.simpleFinConnection.upsert({
    where: { userId: user.id },
    update: { encryptedAccessUrl, isActive: true, syncStatus: "SYNCING", lastSyncAttemptAt: new Date(), lastSyncError: null },
    create: { userId: user.id, encryptedAccessUrl },
  });
  try {
    const result = await fetchAccountSet(accessUrl, subDays(new Date(), 90));
    await importAccounts(user.id, result.accounts);
    const warning = result.warnings.join(" · ").slice(0, 300) || null;
    await prisma.simpleFinConnection.update({ where: { id: connection.id }, data: { syncStatus: "SUCCESS", lastSuccessfulSyncAt: new Date(), lastSyncError: warning } });
    return { accountCount: result.accounts.length, warning };
  } catch (error) {
    const message = safeSyncError(error);
    await prisma.simpleFinConnection.update({ where: { id: connection.id }, data: { syncStatus: "FAILED", lastSyncError: message } });
    throw new Error(message);
  }
}

export async function syncSimpleFin() {
  const user = await ensureBudgetWorkspace();
  const connection = await prisma.simpleFinConnection.findUnique({ where: { userId: user.id } });
  if (!connection?.isActive) throw new Error("Connect SimpleFIN before syncing.");
  await prisma.simpleFinConnection.update({ where: { id: connection.id }, data: { syncStatus: "SYNCING", lastSyncAttemptAt: new Date(), lastSyncError: null } });
  try {
    const result = await fetchAccountSet(decryptSecret(connection.encryptedAccessUrl), subDays(new Date(), 45));
    const summary = await importAccounts(user.id, result.accounts);
    const warning = result.warnings.join(" · ").slice(0, 300) || null;
    await prisma.simpleFinConnection.update({ where: { id: connection.id }, data: { syncStatus: "SUCCESS", lastSuccessfulSyncAt: new Date(), lastSyncError: warning } });
    return { ...summary, warning };
  } catch (error) {
    const message = safeSyncError(error);
    await prisma.simpleFinConnection.update({ where: { id: connection.id }, data: { syncStatus: "FAILED", lastSyncError: message } });
    throw new Error(message);
  }
}

export async function getConnectionSettings() {
  const user = await ensureBudgetWorkspace();
  const [connection, accounts, recurringItems, rules] = await Promise.all([
    prisma.simpleFinConnection.findUnique({ where: { userId: user.id }, select: { isActive: true, syncStatus: true, lastSuccessfulSyncAt: true, lastSyncError: true } }),
    prisma.financialAccount.findMany({ where: { userId: user.id }, orderBy: [{ institutionName: "asc" }, { displayName: "asc" }], select: { id: true, institutionName: true, name: true, displayName: true, accountType: true, includeInDashboard: true, currentBalanceCents: true, currency: true } }),
    prisma.recurringExpense.findMany({ where: { userId: user.id, isActive: true }, orderBy: { nextDueDate: "asc" }, select: { id: true, name: true, amountCents: true, nextDueDate: true, transactionKind: true, isRequired: true } }),
    prisma.transactionRule.findMany({ where: { userId: user.id, isActive: true }, orderBy: { priority: "desc" }, select: { id: true, matchText: true, matchType: true, normalizedMerchant: true, transactionKind: true, priority: true, category: { select: { name: true } } } }),
  ]);
  return { connection, accounts, recurringItems, rules };
}
