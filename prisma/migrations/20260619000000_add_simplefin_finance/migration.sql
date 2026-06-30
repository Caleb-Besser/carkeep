CREATE TYPE "FinancialProvider" AS ENUM ('SIMPLEFIN', 'CSV');
CREATE TYPE "FinancialAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'OTHER');
CREATE TYPE "ImportSource" AS ENUM ('SIMPLEFIN', 'CSV');
CREATE TYPE "TransactionKind" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER', 'CREDIT_CARD_PAYMENT', 'SAVINGS_TRANSFER', 'REFUND', 'REIMBURSEMENT', 'CASH_WITHDRAWAL', 'UNCATEGORIZED');
CREATE TYPE "TransactionReviewStatus" AS ENUM ('AUTO_CATEGORIZED', 'NEEDS_REVIEW', 'USER_CONFIRMED');
CREATE TYPE "TransactionRuleMatchType" AS ENUM ('EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX');
CREATE TYPE "SimpleFinSyncStatus" AS ENUM ('IDLE', 'SYNCING', 'SUCCESS', 'FAILED');

ALTER TABLE "RecurringExpense"
  ADD COLUMN "transactionKind" "TransactionKind" NOT NULL DEFAULT 'EXPENSE',
  ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "merchantMatch" TEXT;

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "providerAccountId" TEXT NOT NULL,
  "provider" "FinancialProvider" NOT NULL DEFAULT 'SIMPLEFIN', "institutionName" TEXT,
  "name" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "accountType" "FinancialAccountType" NOT NULL DEFAULT 'OTHER',
  "currentBalanceCents" INTEGER NOT NULL DEFAULT 0, "availableBalanceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD', "includeInDashboard" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
  "providerTransactionId" TEXT, "importSource" "ImportSource" NOT NULL, "importFingerprint" TEXT,
  "postedAt" TIMESTAMP(3) NOT NULL, "transactedAt" TIMESTAMP(3), "amountCents" INTEGER NOT NULL,
  "description" TEXT NOT NULL, "merchantName" TEXT, "normalizedDescription" TEXT NOT NULL,
  "rawCategory" TEXT, "transactionKind" "TransactionKind" NOT NULL DEFAULT 'UNCATEGORIZED',
  "categoryId" TEXT, "isPending" BOOLEAN NOT NULL DEFAULT false,
  "reviewStatus" "TransactionReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW', "rawData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionRule" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "matchText" TEXT NOT NULL,
  "matchType" "TransactionRuleMatchType" NOT NULL DEFAULT 'CONTAINS', "normalizedMerchant" TEXT,
  "categoryId" TEXT, "transactionKind" "TransactionKind" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SimpleFinConnection" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "encryptedAccessUrl" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "syncStatus" "SimpleFinSyncStatus" NOT NULL DEFAULT 'IDLE',
  "lastSuccessfulSyncAt" TIMESTAMP(3), "lastSyncAttemptAt" TIMESTAMP(3), "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SimpleFinConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAccount_userId_provider_providerAccountId_key" ON "FinancialAccount"("userId", "provider", "providerAccountId");
CREATE INDEX "FinancialAccount_userId_includeInDashboard_idx" ON "FinancialAccount"("userId", "includeInDashboard");
CREATE UNIQUE INDEX "Transaction_accountId_providerTransactionId_key" ON "Transaction"("accountId", "providerTransactionId");
CREATE UNIQUE INDEX "Transaction_userId_importSource_importFingerprint_key" ON "Transaction"("userId", "importSource", "importFingerprint");
CREATE INDEX "Transaction_userId_postedAt_idx" ON "Transaction"("userId", "postedAt");
CREATE INDEX "Transaction_userId_transactionKind_postedAt_idx" ON "Transaction"("userId", "transactionKind", "postedAt");
CREATE INDEX "Transaction_categoryId_postedAt_idx" ON "Transaction"("categoryId", "postedAt");
CREATE INDEX "Transaction_reviewStatus_postedAt_idx" ON "Transaction"("reviewStatus", "postedAt");
CREATE INDEX "TransactionRule_userId_isActive_priority_idx" ON "TransactionRule"("userId", "isActive", "priority");
CREATE UNIQUE INDEX "SimpleFinConnection_userId_key" ON "SimpleFinConnection"("userId");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionRule" ADD CONSTRAINT "TransactionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionRule" ADD CONSTRAINT "TransactionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimpleFinConnection" ADD CONSTRAINT "SimpleFinConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

