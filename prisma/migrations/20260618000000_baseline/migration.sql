-- Baseline for the schema that existed before Prisma Migrate was introduced.
-- This migration is marked as applied on the existing Neon database; it is not executed there.
CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "public"."CategoryKind" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "public"."RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "public"."SystemCategoryKey" AS ENUM ('UNCATEGORIZED', 'TRANSFERS', 'INCOME');
CREATE TYPE "public"."TransactionSource" AS ENUM ('ALLY', 'DISCOVER');

CREATE TABLE "public"."User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."Bill" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "monthlyAmountCents" INTEGER NOT NULL, "dueDay" INTEGER, "merchantKey" TEXT, "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."Category" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "icon" TEXT, "color" TEXT,
  "monthlyBudgetCents" INTEGER NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isArchived" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "kind" "public"."CategoryKind" NOT NULL DEFAULT 'USER',
  "systemKey" "public"."SystemCategoryKey", CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."Expense" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "categoryId" TEXT, "amountCents" INTEGER NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "merchantKey" TEXT, "rawCategory" TEXT, "source" "public"."TransactionSource" NOT NULL DEFAULT 'ALLY',
  "sourceId" TEXT, "billId" TEXT, CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."MerchantRule" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "merchantKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."RecurringExpense" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "categoryId" TEXT, "name" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL, "note" TEXT,
  "frequency" "public"."RecurringFrequency" NOT NULL DEFAULT 'MONTHLY', "interval" INTEGER NOT NULL DEFAULT 1,
  "startDate" TIMESTAMP(3) NOT NULL, "dayOfMonth" INTEGER, "dayOfWeek" INTEGER,
  "nextDueDate" TIMESTAMP(3), "endDate" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
CREATE UNIQUE INDEX "Bill_userId_merchantKey_key" ON "public"."Bill"("userId", "merchantKey");
CREATE UNIQUE INDEX "Bill_userId_name_key" ON "public"."Bill"("userId", "name");
CREATE INDEX "Bill_userId_sortOrder_idx" ON "public"."Bill"("userId", "sortOrder");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "public"."Category"("userId", "name");
CREATE INDEX "Category_userId_sortOrder_idx" ON "public"."Category"("userId", "sortOrder");
CREATE UNIQUE INDEX "Category_userId_systemKey_key" ON "public"."Category"("userId", "systemKey");
CREATE INDEX "Expense_billId_expenseDate_idx" ON "public"."Expense"("billId", "expenseDate");
CREATE INDEX "Expense_categoryId_expenseDate_idx" ON "public"."Expense"("categoryId", "expenseDate");
CREATE INDEX "Expense_userId_expenseDate_idx" ON "public"."Expense"("userId", "expenseDate");
CREATE INDEX "Expense_userId_merchantKey_idx" ON "public"."Expense"("userId", "merchantKey");
CREATE UNIQUE INDEX "Expense_userId_source_sourceId_key" ON "public"."Expense"("userId", "source", "sourceId");
CREATE INDEX "MerchantRule_userId_categoryId_idx" ON "public"."MerchantRule"("userId", "categoryId");
CREATE UNIQUE INDEX "MerchantRule_userId_merchantKey_key" ON "public"."MerchantRule"("userId", "merchantKey");
CREATE INDEX "RecurringExpense_userId_isActive_nextDueDate_idx" ON "public"."RecurringExpense"("userId", "isActive", "nextDueDate");

ALTER TABLE "public"."Bill" ADD CONSTRAINT "Bill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_billId_fkey" FOREIGN KEY ("billId") REFERENCES "public"."Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MerchantRule" ADD CONSTRAINT "MerchantRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MerchantRule" ADD CONSTRAINT "MerchantRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
