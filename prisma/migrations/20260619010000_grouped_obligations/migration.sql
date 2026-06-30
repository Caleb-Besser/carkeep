ALTER TABLE "RecurringExpense" ADD COLUMN "paymentGroupKey" TEXT;
CREATE INDEX "RecurringExpense_userId_paymentGroupKey_idx" ON "RecurringExpense"("userId", "paymentGroupKey");
