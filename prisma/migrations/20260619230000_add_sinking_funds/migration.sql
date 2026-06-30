CREATE TABLE "SinkingFund" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyContributionCents" INTEGER NOT NULL,
    "currentBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SinkingFund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SinkingFund_userId_name_key" ON "SinkingFund"("userId", "name");
CREATE INDEX "SinkingFund_userId_isActive_sortOrder_idx" ON "SinkingFund"("userId", "isActive", "sortOrder");
ALTER TABLE "SinkingFund" ADD CONSTRAINT "SinkingFund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
