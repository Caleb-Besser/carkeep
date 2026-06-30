import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getBudgetStatus,
  getBudgetPacing,
  getMonthBounds,
  getMonthKey,
  getMonthLabel,
  parseMonthKey,
} from "./finance";
import { ensureBudgetWorkspace } from "./default-user";
import { SYSTEM_CATEGORY_KEY } from "./constants";

export type TransactionCategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: "USER" | "SYSTEM";
  systemKey: string | null;
};

export type BillOption = {
  id: string;
  name: string;
};

export type ExpenseHistoryItem = {
  id: string;
  amountCents: number;
  expenseDate: Date;
  note: string | null;
  createdAt: Date;
  source: string;
  merchantKey: string | null;
  bill: BillOption | null;
  category: TransactionCategoryOption | null;
};

export type CategoryBudgetView = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  displayMode: "budget" | "savings";
  monthlyBudgetCents: number;
  spentCents: number;
  remainingCents: number;
  inflowCents: number;
  outflowCents: number;
  progressPercent: number;
  budgetWeekCount: number;
  currentBudgetWeek: number;
  weeklyBudgetCents: number;
  pacedBudgetCents: number;
  pacedRemainingCents: number;
  pacedProgressPercent: number;
  status: "healthy" | "warning" | "over";
  totalExpenseCount: number;
  transactions: ExpenseHistoryItem[];
};

export type BillProgressView = {
  id: string;
  name: string;
  monthlyAmountCents: number;
  dueDay: number | null;
  merchantKey: string | null;
  notes: string | null;
  paidCents: number;
  remainingCents: number;
  status: "paid" | "partial" | "unpaid";
};

export type DashboardDataResult =
  | {
      status: "missing-env";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      month: Date;
      monthKey: string;
      monthLabel: string;
      categories: CategoryBudgetView[];
      transactionCategories: TransactionCategoryOption[];
      billOptions: BillOption[];
      reviewTransactions: ExpenseHistoryItem[];
      obligations: {
        rentCategoryId: string | null;
        rentTargetCents: number;
        rentPaidCents: number;
        rentRemainingCents: number;
        billsExpectedCents: number;
        billsPaidCents: number;
        billsRemainingCents: number;
        items: BillProgressView[];
      };
      summary: {
        plannedIncomeCents: number;
        actualIncomeCents: number;
        incomeBasisCents: number;
        paycheckCount: number;
        remainingFromIncomeCents: number;
        incomeAvailableAfterFixedCents: number;
        budgetWeekCount: number;
        currentBudgetWeek: number;
        weeklyDiscretionaryBudgetCents: number;
        pacedDiscretionaryBudgetCents: number;
        pacedDiscretionaryRemainingCents: number;
        spendableNowCents: number;
        totalBudgetCents: number;
        totalSpentCents: number;
        totalRemainingCents: number;
        discretionaryBudgetCents: number;
        discretionarySpentCents: number;
        discretionaryRemainingCents: number;
        onTrackCount: number;
        overBudgetCount: number;
        reviewCount: number;
      };
    };

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

function getDatabaseErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return "Database connection failed. Double-check DATABASE_URL and run Prisma against your Postgres database.";
  }

  return "Something went wrong while loading your budget data.";
}

function toExpenseHistoryItem(
  expense: {
    id: string;
    amountCents: number;
    expenseDate: Date;
    note: string | null;
    createdAt: Date;
    source: string;
    merchantKey: string | null;
    bill: { id: string; name: string } | null;
    category: {
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      kind: "USER" | "SYSTEM";
      systemKey: string | null;
    } | null;
  }
): ExpenseHistoryItem {
  return {
    id: expense.id,
    amountCents: expense.amountCents,
    expenseDate: expense.expenseDate,
    note: expense.note,
    createdAt: expense.createdAt,
    source: expense.source,
    merchantKey: expense.merchantKey,
    bill: expense.bill,
    category: expense.category,
  };
}

export async function getDashboardData(input?: {
  month?: string;
}): Promise<DashboardDataResult> {
  if (!hasDatabaseUrl()) {
    return { status: "missing-env" };
  }

  const month = parseMonthKey(input?.month);
  const { monthStart, monthEnd } = getMonthBounds(month);
  const monthKey = getMonthKey(month);
  const monthLabel = getMonthLabel(month);
  const pacing = getBudgetPacing(month);

  try {
    const user = await ensureBudgetWorkspace();

    const [categories, expenses, bills] = await Promise.all([
      prisma.category.findMany({
        where: {
          userId: user.id,
          isArchived: false,
        },
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          kind: true,
          systemKey: true,
          monthlyBudgetCents: true,
        },
      }),
      prisma.expense.findMany({
        where: {
          userId: user.id,
          expenseDate: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        include: {
          bill: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              kind: true,
              systemKey: true,
            },
          },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.bill.findMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          monthlyAmountCents: true,
          dueDay: true,
          merchantKey: true,
          notes: true,
        },
      }),
    ]);

    const visibleCategories = categories.filter(
      (category) => !(category.kind === "USER" && category.name === "Rent")
    );

    const transactionCategories = visibleCategories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      kind: category.kind,
      systemKey: category.systemKey,
    })) satisfies TransactionCategoryOption[];

    const billOptions = bills.map((bill) => ({
      id: bill.id,
      name: bill.name,
    })) satisfies BillOption[];

    const expenseItems = expenses.map(toExpenseHistoryItem);
    const userCategories = categories.filter((category) => category.kind === "USER");
    const rentCategory = userCategories.find((category) => category.name === "Rent") ?? null;
    const savingsCategory = userCategories.find((category) => category.name === "Savings") ?? null;
    const visibleUserCategories = userCategories.filter((category) => category.name !== "Rent");
    const totalBillsExpectedCents = bills.reduce(
      (sum, bill) => sum + bill.monthlyAmountCents,
      0
    );
    const incomeTransactions = expenseItems.filter(
      (expense) => expense.category?.systemKey === SYSTEM_CATEGORY_KEY.INCOME
    );
    const actualIncomeCents = incomeTransactions.reduce(
      (sum, expense) => sum + Math.max(expense.amountCents, 0),
      0
    );
    const paycheckCount = incomeTransactions.length;

    const categoryViews = visibleUserCategories.map((category) => {
      const categoryTransactions = expenseItems.filter((expense) => expense.category?.id === category.id);
      const isSavingsCategory = category.name === "Savings";
      const inflowCents = isSavingsCategory
        ? categoryTransactions
            .filter((expense) => expense.amountCents > 0)
            .reduce((sum, expense) => sum + expense.amountCents, 0)
        : 0;
      const outflowCents = isSavingsCategory
        ? categoryTransactions
            .filter((expense) => expense.amountCents < 0)
            .reduce((sum, expense) => sum + Math.abs(expense.amountCents), 0)
        : 0;
      const spentCents = categoryTransactions.reduce((sum, expense) => sum + expense.amountCents, 0);

      if (isSavingsCategory) {
        return {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          displayMode: "savings",
          monthlyBudgetCents: 0,
          spentCents,
          remainingCents: 0,
          inflowCents,
          outflowCents,
          progressPercent: 0,
          budgetWeekCount: pacing.budgetWeekCount,
          currentBudgetWeek: pacing.currentBudgetWeek,
          weeklyBudgetCents: 0,
          pacedBudgetCents: 0,
          pacedRemainingCents: 0,
          pacedProgressPercent: 0,
          status: spentCents > 0 ? "healthy" : spentCents < 0 ? "over" : "warning",
          totalExpenseCount: categoryTransactions.length,
          transactions: categoryTransactions,
        } satisfies CategoryBudgetView;
      }

      const effectiveBudgetCents =
        category.name === "Bills" ? totalBillsExpectedCents : category.monthlyBudgetCents;
      const remainingCents = effectiveBudgetCents - spentCents;
      const weeklyBudgetCents =
        pacing.budgetWeekCount > 0
          ? Math.round(effectiveBudgetCents / pacing.budgetWeekCount)
          : effectiveBudgetCents;
      const pacedBudgetCents = Math.min(
        effectiveBudgetCents,
        Math.round((effectiveBudgetCents / pacing.budgetWeekCount) * pacing.currentBudgetWeek)
      );
      const pacedRemainingCents = pacedBudgetCents - spentCents;
      const progressPercent =
        effectiveBudgetCents > 0
          ? Math.min((spentCents / effectiveBudgetCents) * 100, 100)
          : spentCents > 0
            ? 100
            : 0;

      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        displayMode: "budget",
        monthlyBudgetCents: effectiveBudgetCents,
        spentCents,
        remainingCents,
        inflowCents: 0,
        outflowCents: 0,
        progressPercent,
        budgetWeekCount: pacing.budgetWeekCount,
        currentBudgetWeek: pacing.currentBudgetWeek,
        weeklyBudgetCents,
        pacedBudgetCents,
        pacedRemainingCents,
        pacedProgressPercent:
          pacedBudgetCents > 0
            ? Math.min((spentCents / pacedBudgetCents) * 100, 100)
            : spentCents > 0
              ? 100
              : 0,
        status: getBudgetStatus(spentCents, effectiveBudgetCents),
        totalExpenseCount: categoryTransactions.length,
        transactions: categoryTransactions,
      } satisfies CategoryBudgetView;
    });

    const billProgressItems = bills.map((bill) => {
      const paidCents = expenseItems
        .filter((expense) => expense.bill?.id === bill.id)
        .reduce((sum, expense) => sum + expense.amountCents, 0);
      const remainingCents = Math.max(bill.monthlyAmountCents - paidCents, 0);

      return {
        id: bill.id,
        name: bill.name,
        monthlyAmountCents: bill.monthlyAmountCents,
        dueDay: bill.dueDay,
        merchantKey: bill.merchantKey,
        notes: bill.notes,
        paidCents,
        remainingCents,
        status:
          paidCents >= bill.monthlyAmountCents
            ? "paid"
            : paidCents > 0
              ? "partial"
              : "unpaid",
      } satisfies BillProgressView;
    });

    const rentPaidCents =
      rentCategory === null
        ? 0
        : expenseItems
            .filter((expense) => expense.category?.id === rentCategory.id)
            .reduce((sum, expense) => sum + expense.amountCents, 0);
    const rentTargetCents = rentCategory?.monthlyBudgetCents ?? 0;
    const totalBudgetCents =
      categoryViews.reduce((sum, category) => sum + category.monthlyBudgetCents, 0) +
      rentTargetCents;
    const incomeBasisCents = actualIncomeCents > 0 ? actualIncomeCents : totalBudgetCents;
    const budgetTrackedCategories = categoryViews.filter(
      (category) => category.displayMode === "budget"
    );
    const discretionaryBudgetTrackedCategories = budgetTrackedCategories.filter(
      (category) => category.name !== "Bills"
    );
    const totalSpentCents = expenseItems
      .filter(
        (expense) =>
          expense.category?.id !== savingsCategory?.id &&
          expense.category?.systemKey !== SYSTEM_CATEGORY_KEY.INCOME
      )
      .reduce((sum, expense) => sum + expense.amountCents, 0);
    const totalRemainingCents = totalBudgetCents - totalSpentCents;
    const discretionarySpentCents = expenseItems
      .filter(
        (expense) =>
          expense.category?.id !== savingsCategory?.id &&
          expense.category?.id !== rentCategory?.id &&
          expense.category?.name !== "Bills" &&
          expense.category?.systemKey !== SYSTEM_CATEGORY_KEY.INCOME
      )
      .reduce((sum, expense) => sum + expense.amountCents, 0);
    const discretionaryBudgetCents = discretionaryBudgetTrackedCategories.reduce(
      (sum, category) => sum + category.monthlyBudgetCents,
      0
    );
    const discretionaryRemainingCents = discretionaryBudgetCents - discretionarySpentCents;
    const weeklyDiscretionaryBudgetCents =
      pacing.budgetWeekCount > 0
        ? Math.round(discretionaryBudgetCents / pacing.budgetWeekCount)
        : discretionaryBudgetCents;
    const pacedDiscretionaryBudgetCents = Math.min(
      discretionaryBudgetCents,
      Math.round((discretionaryBudgetCents / pacing.budgetWeekCount) * pacing.currentBudgetWeek)
    );
    const pacedDiscretionaryRemainingCents =
      pacedDiscretionaryBudgetCents - discretionarySpentCents;
    const billsPaidCents = billProgressItems.reduce((sum, bill) => sum + bill.paidCents, 0);
    const incomeAvailableAfterFixedCents =
      incomeBasisCents - (totalBillsExpectedCents + rentTargetCents);
    const spendableNowCents =
      Math.min(pacedDiscretionaryBudgetCents, incomeAvailableAfterFixedCents) -
      discretionarySpentCents;
    const reviewTransactions = expenseItems.filter(
      (expense) =>
        expense.category?.systemKey === "UNCATEGORIZED" ||
        expense.category?.systemKey === "TRANSFERS"
    );

    return {
      status: "ready",
      month,
      monthKey,
      monthLabel,
      categories: categoryViews,
      transactionCategories,
      billOptions,
      reviewTransactions,
      obligations: {
        rentCategoryId: rentCategory?.id ?? null,
        rentTargetCents,
        rentPaidCents,
        rentRemainingCents: Math.max(rentTargetCents - rentPaidCents, 0),
        billsExpectedCents: totalBillsExpectedCents + rentTargetCents,
        billsPaidCents: billsPaidCents + rentPaidCents,
        billsRemainingCents: Math.max(
          totalBillsExpectedCents + rentTargetCents - (billsPaidCents + rentPaidCents),
          0
        ),
        items: billProgressItems,
      },
      summary: {
        plannedIncomeCents: totalBudgetCents,
        actualIncomeCents,
        incomeBasisCents,
        paycheckCount,
        remainingFromIncomeCents: incomeBasisCents - totalSpentCents,
        incomeAvailableAfterFixedCents,
        budgetWeekCount: pacing.budgetWeekCount,
        currentBudgetWeek: pacing.currentBudgetWeek,
        weeklyDiscretionaryBudgetCents,
        pacedDiscretionaryBudgetCents,
        pacedDiscretionaryRemainingCents,
        spendableNowCents,
        totalBudgetCents,
        totalSpentCents,
        totalRemainingCents,
        discretionaryBudgetCents,
        discretionarySpentCents,
        discretionaryRemainingCents,
        onTrackCount: budgetTrackedCategories.filter((category) => category.status !== "over").length,
        overBudgetCount: budgetTrackedCategories.filter((category) => category.status === "over").length,
        reviewCount: reviewTransactions.length,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: getDatabaseErrorMessage(error),
    };
  }
}
