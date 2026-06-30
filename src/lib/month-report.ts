import { format } from "date-fns";
import { SYSTEM_CATEGORY_KEY } from "./constants";
import {
  getDashboardData,
  type DashboardDataResult,
  type ExpenseHistoryItem,
} from "./dashboard";
import { ensureBudgetWorkspace } from "./default-user";
import { formatCurrency, getMonthKey } from "./finance";
import { prisma } from "./prisma";

type ReadyDashboardData = Extract<DashboardDataResult, { status: "ready" }>;

export type MonthlyReportInsight = {
  title: string;
  detail: string;
  tone: "default" | "success" | "warning";
};

export type MonthlyReportMerchant = {
  label: string;
  amountCents: number;
  transactionCount: number;
  categoryNames: string[];
};

export type MonthlyReportTransaction = ExpenseHistoryItem & {
  categoryName: string;
  categoryKind: "USER" | "SYSTEM" | "NONE";
  categorySystemKey: string | null;
};

export type MonthlyReportDataResult =
  | Exclude<DashboardDataResult, { status: "ready" }>
  | {
      status: "ready";
      dashboard: ReadyDashboardData;
      history: {
        monthsTrackedCount: number;
        allTimeTransactionCount: number;
        firstTrackedMonthKey: string | null;
      };
      insights: MonthlyReportInsight[];
      topMerchants: MonthlyReportMerchant[];
      largestTransactions: MonthlyReportTransaction[];
      monthlyTransactions: MonthlyReportTransaction[];
      dailyAverageSpendCents: number;
      busiestSpendDay:
        | {
            dateLabel: string;
            amountCents: number;
            transactionCount: number;
          }
        | null;
    };

function getTransactionLabel(transaction: ExpenseHistoryItem) {
  return transaction.note?.trim() || transaction.merchantKey || "Unknown transaction";
}

function flattenMonthlyTransactions(
  dashboard: ReadyDashboardData
): MonthlyReportTransaction[] {
  const categoryTransactions = dashboard.categories.flatMap((category) =>
    category.transactions.map((transaction) => ({
      ...transaction,
      categoryName: category.name,
      categoryKind: "USER" as const,
      categorySystemKey: transaction.category?.systemKey ?? null,
    }))
  );

  const systemTransactions = dashboard.reviewTransactions.map((transaction) => ({
    ...transaction,
    categoryName: transaction.category?.name ?? "Uncategorized",
    categoryKind: (transaction.category?.kind ?? "NONE") as "USER" | "SYSTEM" | "NONE",
    categorySystemKey: transaction.category?.systemKey ?? null,
  }));

  return [...categoryTransactions, ...systemTransactions].sort(
    (left, right) => right.expenseDate.getTime() - left.expenseDate.getTime()
  );
}

function getSpendingTransactions(transactions: MonthlyReportTransaction[]) {
  return transactions.filter(
    (transaction) =>
      transaction.amountCents > 0 &&
      transaction.categoryName !== "Savings" &&
      transaction.categorySystemKey !== SYSTEM_CATEGORY_KEY.TRANSFERS
  );
}

function buildMerchantSummary(
  transactions: MonthlyReportTransaction[]
): MonthlyReportMerchant[] {
  const merchants = new Map<
    string,
    {
      label: string;
      amountCents: number;
      transactionCount: number;
      categoryNames: Set<string>;
    }
  >();

  for (const transaction of transactions) {
    const label = transaction.merchantKey || getTransactionLabel(transaction);
    const existing = merchants.get(label) ?? {
      label,
      amountCents: 0,
      transactionCount: 0,
      categoryNames: new Set<string>(),
    };

    existing.amountCents += transaction.amountCents;
    existing.transactionCount += 1;
    existing.categoryNames.add(transaction.categoryName);
    merchants.set(label, existing);
  }

  return Array.from(merchants.values())
    .map((merchant) => ({
      label: merchant.label,
      amountCents: merchant.amountCents,
      transactionCount: merchant.transactionCount,
      categoryNames: Array.from(merchant.categoryNames).sort(),
    }))
    .sort((left, right) => right.amountCents - left.amountCents)
    .slice(0, 6);
}

function buildBusiestSpendDay(transactions: MonthlyReportTransaction[]) {
  const totalsByDay = new Map<
    string,
    {
      date: Date;
      amountCents: number;
      transactionCount: number;
    }
  >();

  for (const transaction of transactions) {
    const dayKey = format(transaction.expenseDate, "yyyy-MM-dd");
    const existing = totalsByDay.get(dayKey) ?? {
      date: transaction.expenseDate,
      amountCents: 0,
      transactionCount: 0,
    };

    existing.amountCents += transaction.amountCents;
    existing.transactionCount += 1;
    totalsByDay.set(dayKey, existing);
  }

  const busiestDay = Array.from(totalsByDay.values()).sort((left, right) => {
    if (right.amountCents !== left.amountCents) {
      return right.amountCents - left.amountCents;
    }

    return right.transactionCount - left.transactionCount;
  })[0];

  if (!busiestDay) {
    return null;
  }

  return {
    dateLabel: format(busiestDay.date, "MMMM d"),
    amountCents: busiestDay.amountCents,
    transactionCount: busiestDay.transactionCount,
  };
}

function buildInsights(input: {
  dashboard: ReadyDashboardData;
  history: {
    monthsTrackedCount: number;
  };
  topMerchants: MonthlyReportMerchant[];
  dailyAverageSpendCents: number;
  busiestSpendDay:
    | {
        dateLabel: string;
        amountCents: number;
        transactionCount: number;
      }
    | null;
}) {
  const { dashboard, history, topMerchants, dailyAverageSpendCents, busiestSpendDay } = input;
  const insights: MonthlyReportInsight[] = [];

  if (dashboard.summary.totalRemainingCents >= 0) {
    insights.push({
      title: "Finished with room left",
      detail: `Current spending is ${formatCurrency(
        Math.abs(dashboard.summary.totalRemainingCents)
      )} under budget.`,
      tone: "success",
    });
  } else {
    insights.push({
      title: "Spent past the plan",
      detail: `Current spending is ${formatCurrency(
        Math.abs(dashboard.summary.totalRemainingCents)
      )} over the planned budget.`,
      tone: "warning",
    });
  }

  if (dashboard.obligations.billsRemainingCents > 0) {
    insights.push({
      title: "Bills still need attention",
      detail: `${dashboard.obligations.items.filter((item) => item.remainingCents > 0).length} bills still have money left to cover this month.`,
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Bills look covered",
      detail: "Tracked bills are fully covered for the selected month.",
      tone: "success",
    });
  }

  if (topMerchants[0]) {
    insights.push({
      title: "Biggest merchant",
      detail: `${topMerchants[0].label} accounted for ${topMerchants[0].transactionCount} purchase${topMerchants[0].transactionCount === 1 ? "" : "s"} this month.`,
      tone: "default",
    });
  }

  if (busiestSpendDay) {
    insights.push({
      title: "Heaviest spending day",
      detail: `${busiestSpendDay.dateLabel} carried ${busiestSpendDay.transactionCount} purchase${busiestSpendDay.transactionCount === 1 ? "" : "s"} and the highest spend total.`,
      tone: "default",
    });
  } else if (dailyAverageSpendCents > 0) {
    insights.push({
      title: "Average active spend day",
      detail: `Active spending days averaged ${formatCurrency(
        dailyAverageSpendCents
      )} so far this month.`,
      tone: "default",
    });
  }

  if (history.monthsTrackedCount < 3) {
    insights.push({
      title: "Still building history",
      detail: `You have ${history.monthsTrackedCount} month${history.monthsTrackedCount === 1 ? "" : "s"} of saved data so far, so future trend and median comparisons will get more useful as you keep importing.`,
      tone: "default",
    });
  }

  if (dashboard.summary.reviewCount > 0) {
    insights.push({
      title: "A few items still need review",
      detail: `${dashboard.summary.reviewCount} transaction${dashboard.summary.reviewCount === 1 ? "" : "s"} are still uncategorized or marked as transfers.`,
      tone: "warning",
    });
  }

  return insights.slice(0, 4);
}

export async function getMonthlyReportData(input?: {
  month?: string;
}): Promise<MonthlyReportDataResult> {
  const dashboard = await getDashboardData(input);

  if (dashboard.status !== "ready") {
    return dashboard;
  }

  const user = await ensureBudgetWorkspace();
  const allTimeExpenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
    },
    select: {
      expenseDate: true,
    },
  });

  const trackedMonthKeys = Array.from(
    new Set(allTimeExpenses.map((expense) => getMonthKey(expense.expenseDate)))
  ).sort();
  const monthlyTransactions = flattenMonthlyTransactions(dashboard);
  const spendingTransactions = getSpendingTransactions(monthlyTransactions);
  const daysWithSpend = new Set(
    spendingTransactions.map((transaction) => format(transaction.expenseDate, "yyyy-MM-dd"))
  ).size;
  const topMerchants = buildMerchantSummary(spendingTransactions);
  const busiestSpendDay = buildBusiestSpendDay(spendingTransactions);
  const dailyAverageSpendCents =
    daysWithSpend > 0
      ? Math.round(dashboard.summary.totalSpentCents / daysWithSpend)
      : 0;

  const history = {
    monthsTrackedCount: trackedMonthKeys.length,
    allTimeTransactionCount: allTimeExpenses.length,
    firstTrackedMonthKey: trackedMonthKeys[0] ?? null,
  };

  return {
    status: "ready",
    dashboard,
    history,
    insights: buildInsights({
      dashboard,
      history,
      topMerchants,
      dailyAverageSpendCents,
      busiestSpendDay,
    }),
    topMerchants,
    largestTransactions: [...spendingTransactions]
      .sort((left, right) => right.amountCents - left.amountCents)
      .slice(0, 8),
    monthlyTransactions,
    dailyAverageSpendCents,
    busiestSpendDay,
  };
}
