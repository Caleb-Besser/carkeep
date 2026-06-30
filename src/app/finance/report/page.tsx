import Link from "next/link";
import { ArrowLeft, FileText, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { CategoryIcon } from "@/components/app/category-icon";
import { DatabaseStateCard } from "@/components/app/database-state-card";
import { PrintReportButton } from "@/components/app/print-report-button";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/finance";
import { getMonthlyReportData } from "@/lib/month-report";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

function getCategoryStatusLabel(input: {
  displayMode: "budget" | "savings";
  status: "healthy" | "warning" | "over";
  spentCents: number;
}) {
  if (input.displayMode === "savings") {
    if (input.spentCents > 0) {
      return "Net up";
    }

    if (input.spentCents < 0) {
      return "Net down";
    }

    return "Flat";
  }

  if (input.status === "over") {
    return "Over";
  }

  if (input.status === "warning") {
    return "Close";
  }

  return "On track";
}

function getCategoryStatusClass(input: {
  displayMode: "budget" | "savings";
  status: "healthy" | "warning" | "over";
  spentCents: number;
}) {
  if (input.displayMode === "savings") {
    return input.spentCents >= 0
      ? "bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : "bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }

  if (input.status === "over") {
    return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }

  if (input.status === "warning") {
    return "bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }

  return "bg-[color:var(--success-soft)] text-[color:var(--success)]";
}

export default async function FinanceReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams;
  const data = await getMonthlyReportData({
    month: params?.month,
  });

  if (data.status === "missing-env") {
    return (
      <DatabaseStateCard
        title="Connect a Postgres database"
        description="This report needs the same DATABASE_URL connection the dashboard uses so it can read your saved history."
      />
    );
  }

  if (data.status === "error") {
    return (
      <DatabaseStateCard
        title="Database not reachable"
        description={data.message}
      />
    );
  }

  const { dashboard, topMerchants, largestTransactions } = data;
  const unpaidBills = dashboard.obligations.items.filter((bill) => bill.remainingCents > 0);
  const topCategoryRows = [...dashboard.categories]
    .sort((left, right) => {
      if (right.spentCents !== left.spentCents) {
        return right.spentCents - left.spentCents;
      }

      return right.monthlyBudgetCents - left.monthlyBudgetCents;
    })
    .slice(0, 8);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-5 lg:px-6">
      <section className="relative z-20 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)]/92 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[auto_minmax(320px,1fr)_auto] xl:items-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Monthly report
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {dashboard.monthLabel}
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card-muted)] px-3 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
                <FileText className="size-3.5" />
                Summary only
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Discretionary left
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCurrency(dashboard.summary.discretionaryRemainingCents)}
              </p>
            </div>
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Discretionary spent
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCurrency(dashboard.summary.discretionarySpentCents)}
              </p>
            </div>
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Bills still unpaid
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCurrency(dashboard.obligations.billsRemainingCents)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-self-end">
            <Button asChild variant="outline">
              <Link href={`/finance?month=${dashboard.monthKey}`}>
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <PrintReportButton />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)]">
              <Wallet className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Category summary</h2>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-[color:var(--border)]">
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(92px,0.75fr)_minmax(92px,0.75fr)_minmax(110px,0.8fr)] items-center gap-3 bg-[color:var(--card-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              <span>Category</span>
              <span className="text-right">Target</span>
              <span className="text-right">Spent</span>
              <span className="text-right">Left</span>
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {topCategoryRows.map((category) => {
                const targetValue =
                  category.displayMode === "savings"
                    ? formatCurrency(category.spentCents)
                    : formatCurrency(category.monthlyBudgetCents);
                const spentValue =
                  category.displayMode === "savings"
                    ? `${formatCurrency(category.inflowCents)} / ${formatCurrency(category.outflowCents)}`
                    : formatCurrency(category.spentCents);
                const leftValue =
                  category.displayMode === "savings"
                    ? formatCurrency(category.spentCents)
                    : formatCurrency(category.remainingCents);

                return (
                  <div
                    key={category.id}
                    className="grid grid-cols-[minmax(0,1.5fr)_minmax(92px,0.75fr)_minmax(92px,0.75fr)_minmax(110px,0.8fr)] items-center gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon
                        icon={category.icon}
                        color={category.color}
                        className="size-9 rounded-xl"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{category.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${getCategoryStatusClass({
                              displayMode: category.displayMode,
                              status: category.status,
                              spentCents: category.spentCents,
                            })}`}
                          >
                            {getCategoryStatusLabel({
                              displayMode: category.displayMode,
                              status: category.status,
                              spentCents: category.spentCents,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {category.totalExpenseCount} transaction
                          {category.totalExpenseCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{targetValue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{spentValue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tracking-tight tabular-nums">
                        {leftValue}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)]">
                <ReceiptText className="size-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Bills</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] bg-[color:var(--card-muted)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                    Paid
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatCurrency(dashboard.obligations.billsPaidCents)}
                  </p>
                </div>
                <div className="rounded-[22px] bg-[color:var(--card-muted)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                    Unpaid
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatCurrency(dashboard.obligations.billsRemainingCents)}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                {(unpaidBills.length > 0 ? unpaidBills : dashboard.obligations.items.slice(0, 4)).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{bill.name}</p>
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {bill.remainingCents > 0 ? "Remaining" : "Paid"}
                      </p>
                    </div>
                    <p className="text-base font-semibold tabular-nums">
                      {formatCurrency(bill.remainingCents > 0 ? bill.remainingCents : bill.paidCents)}
                    </p>
                  </div>
                ))}
                {dashboard.obligations.items.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-5 text-sm text-[color:var(--muted-foreground)]">
                    No bills tracked.
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)]">
              <TrendingUp className="size-5" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Top merchants</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {topMerchants.slice(0, 5).map((merchant, index) => (
              <div
                key={merchant.label}
                className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {index + 1}. {merchant.label}
                  </p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {merchant.transactionCount} transaction
                    {merchant.transactionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-base font-semibold tabular-nums">
                  {formatCurrency(merchant.amountCents)}
                </p>
              </div>
            ))}
            {topMerchants.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-5 text-sm text-[color:var(--muted-foreground)]">
                No merchant activity yet.
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)]">
              <FileText className="size-5" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Largest purchases</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {largestTransactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {transaction.note ?? transaction.merchantKey ?? "Unknown transaction"}
                  </p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {transaction.categoryName}
                  </p>
                </div>
                <p className="text-base font-semibold tabular-nums">
                  {formatCurrency(transaction.amountCents)}
                </p>
              </div>
            ))}
            {largestTransactions.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[color:var(--border)] bg-[color:var(--card-muted)] px-4 py-5 text-sm text-[color:var(--muted-foreground)]">
                No purchases recorded yet.
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
