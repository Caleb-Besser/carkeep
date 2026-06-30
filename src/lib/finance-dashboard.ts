import "server-only";

import { addDays, addMonths, differenceInCalendarDays, endOfMonth, isBefore, isSameMonth, setDate, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ensureBudgetWorkspace } from "@/lib/default-user";
import { getMonthBounds, getMonthKey, getMonthLabel, parseMonthKey } from "@/lib/finance";
import {
  DISCOVER_CREDIT_LIMIT_CENTS,
  PAYCHECK_TARGETS,
  REGULAR_MONTHLY_BUDGETS,
  SAVINGS_FLOOR_CENTS,
  SYSTEM_CATEGORY_KEY,
} from "@/lib/constants";

function configuredPaycheckDates(items: { transactionKind: string; nextDueDate: Date | null; dayOfMonth: number | null }[], reference: Date) {
  return items
    .filter((item) => item.transactionKind === "INCOME")
    .flatMap((item) => {
      if (item.nextDueDate && item.nextDueDate >= startOfDay(reference)) return [startOfDay(item.nextDueDate)];
      if (!item.dayOfMonth) return [];
      const thisMonth = setDate(startOfDay(reference), Math.min(item.dayOfMonth, endOfMonth(reference).getDate()));
      return [thisMonth >= startOfDay(reference) ? thisMonth : setDate(startOfDay(addMonths(reference, 1)), item.dayOfMonth)];
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

function inferredPaycheckSchedule(incomeHistory: { postedAt: Date; normalizedDescription: string; amountCents: number }[], reference: Date) {
  const groups = new Map<string, typeof incomeHistory>();
  for (const transaction of incomeHistory) {
    const group = groups.get(transaction.normalizedDescription) ?? [];
    group.push(transaction);
    groups.set(transaction.normalizedDescription, group);
  }
  const recurringSeries = [...groups.values()]
    .filter((series) => series.length >= 2)
    .sort((a, b) => b.length - a.length || b.reduce((sum, item) => sum + item.amountCents, 0) - a.reduce((sum, item) => sum + item.amountCents, 0))[0];
  if (!recurringSeries) return null;

  const dates = recurringSeries.map((item) => startOfDay(item.postedAt)).sort((a, b) => a.getTime() - b.getTime());
  const intervals = dates.slice(1).map((date, index) => differenceInCalendarDays(date, dates[index])).filter((days) => days >= 7 && days <= 35).sort((a, b) => a - b);
  if (!intervals.length) return null;
  const cadenceDays = intervals[Math.floor(intervals.length / 2)];
  let previous = dates.filter((date) => date <= reference).at(-1);
  if (!previous) return null;
  let next = addDays(previous, cadenceDays);
  while (next <= reference) { previous = next; next = addDays(next, cadenceDays); }
  return { previous, next, cadenceDays };
}

function matchesPlanName(categoryName: string, plan: { name: string; aliases?: readonly string[] }) {
  return categoryName === plan.name || plan.aliases?.includes(categoryName) === true;
}

function categoryForPlan<C extends { name: string }, T extends { name: string; aliases?: readonly string[] }>(categories: C[], plan: T) {
  return categories.find((candidate) => matchesPlanName(candidate.name, plan));
}

function spentForCategory(
  categoryId: string | undefined,
  expenseTransactions: readonly { categoryId: string | null; postedAt: Date; amountCents: number }[],
  refundTransactions: readonly { categoryId: string | null; postedAt: Date; amountCents: number }[],
  start?: Date,
  end?: Date
) {
  if (!categoryId) return 0;
  const isInPeriod = (transaction: { postedAt: Date }) =>
    (!start || transaction.postedAt >= start) && (!end || transaction.postedAt < end);
  const expenses = expenseTransactions
    .filter((transaction) => transaction.categoryId === categoryId && isInPeriod(transaction))
    .reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amountCents, 0)), 0);
  const refunds = refundTransactions
    .filter((transaction) => transaction.categoryId === categoryId && isInPeriod(transaction))
    .reduce((sum, transaction) => sum + Math.max(transaction.amountCents, 0), 0);
  return expenses - refunds;
}

export async function getFinanceDashboard(monthInput?: string) {
  const user = await ensureBudgetWorkspace();
  const month = parseMonthKey(monthInput);
  const { monthStart, monthEnd } = getMonthBounds(month);
  const [accounts, transactions, incomeHistory, categories, recurringItems, sinkingFunds, connection] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId: user.id, includeInDashboard: true }, orderBy: { displayName: "asc" } }),
    prisma.transaction.findMany({ where: { userId: user.id, postedAt: { gte: monthStart, lt: monthEnd } }, include: { account: { select: { displayName: true, accountType: true } }, category: { select: { id: true, name: true, icon: true, color: true, systemKey: true } } }, orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.transaction.findMany({ where: { userId: user.id, transactionKind: "INCOME", isPending: false, postedAt: { gte: addMonths(monthStart, -12), lt: monthEnd } }, select: { postedAt: true, normalizedDescription: true, amountCents: true }, orderBy: { postedAt: "asc" } }),
    prisma.category.findMany({ where: { userId: user.id, kind: "USER", isArchived: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.recurringExpense.findMany({ where: { userId: user.id, isActive: true }, include: { category: { select: { name: true } } }, orderBy: [{ paymentGroupKey: "asc" }, { name: "asc" }] }),
    prisma.sinkingFund.findMany({ where: { userId: user.id, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.simpleFinConnection.findUnique({ where: { userId: user.id }, select: { syncStatus: true, lastSuccessfulSyncAt: true, lastSyncError: true } }),
  ]);

  const includedIds = new Set(accounts.map((account) => account.id));
  const includedTransactions = transactions.filter((transaction) => includedIds.has(transaction.accountId) || transaction.importSource === "CSV");
  const posted = includedTransactions.filter((transaction) => !transaction.isPending);
  const pendingExpensesCents = includedTransactions.filter((transaction) => transaction.isPending && transaction.transactionKind === "EXPENSE").reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amountCents, 0)), 0);
  const expenseTransactions = posted.filter((transaction) => transaction.transactionKind === "EXPENSE");
  const refundTransactions = posted.filter((transaction) => transaction.transactionKind === "REFUND" && transaction.categoryId);
  const recurringFrequencyByMerchant = new Map(
    recurringItems
      .filter((item) => item.merchantMatch)
      .map((item) => [item.merchantMatch as string, item.frequency])
  );
  const transactionRow = (transaction: typeof posted[number]) => ({
    id: transaction.id,
    postedAt: transaction.postedAt.toISOString(),
    description: transaction.description,
    merchantName: transaction.merchantName,
    amountCents: transaction.amountCents,
    transactionKind: transaction.transactionKind,
    categoryId: transaction.categoryId,
    accountName: transaction.account.displayName,
    recurringFrequency: recurringFrequencyByMerchant.get(transaction.normalizedDescription) ?? null,
  });
  const expenseTotal = (items: typeof expenseTransactions) => items.reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amountCents, 0)), 0);
  const refundTotal = (items: typeof refundTransactions) => items.reduce((sum, transaction) => sum + Math.max(transaction.amountCents, 0), 0);
  const monthlySpendingCents = expenseTotal(expenseTransactions) - refundTotal(refundTransactions);
  const actualIncomeCents = posted.filter((transaction) => transaction.transactionKind === "INCOME").reduce((sum, transaction) => sum + Math.max(transaction.amountCents, 0), 0);
  const cashAvailableCents = accounts.filter((account) => account.accountType === "CHECKING" || account.accountType === "CASH").reduce((sum, account) => sum + (account.availableBalanceCents ?? account.currentBalanceCents), 0);
  const savingsBalanceCents = accounts.filter((account) => account.accountType === "SAVINGS").reduce((sum, account) => sum + account.currentBalanceCents, 0);
  const creditCardOwedCents = accounts.filter((account) => account.accountType === "CREDIT_CARD").reduce((sum, account) => sum + Math.abs(account.currentBalanceCents), 0);
  const savingsAddedCents = posted.filter((transaction) => transaction.transactionKind === "SAVINGS_TRANSFER" && transaction.amountCents > 0 && transaction.account.accountType === "SAVINGS").reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const savingsRemainingCents = Math.max(0, SAVINGS_FLOOR_CENTS - savingsAddedCents);

  const paycheckReference = isSameMonth(month, new Date()) ? new Date() : monthStart;
  const paycheckDates = configuredPaycheckDates(recurringItems, paycheckReference);
  const inferredSchedule = inferredPaycheckSchedule(incomeHistory, paycheckReference);
  const nextPaycheck = paycheckDates[0] ?? inferredSchedule?.next ?? null;
  const latestActualPaycheck = posted
    .filter((transaction) => transaction.transactionKind === "INCOME" && transaction.postedAt <= paycheckReference)
    .map((transaction) => startOfDay(transaction.postedAt))
    .sort((a, b) => a.getTime() - b.getTime())
    .at(-1);
  const paycheckStart = latestActualPaycheck ?? inferredSchedule?.previous ?? monthStart;
  const paycheckEnd = nextPaycheck ?? monthEnd;
  const categoryBudgets = REGULAR_MONTHLY_BUDGETS.filter((plan) => plan.name !== "Subscriptions").map((plan) => {
    const category = categoryForPlan(categories, plan);
    const spent = spentForCategory(category?.id, expenseTransactions, refundTransactions);
    const paycheckTarget = PAYCHECK_TARGETS.find((target) => target.name === plan.name || ("aliases" in target && (target.aliases as readonly string[]).includes(plan.name)));
    const paycheckBaseBudgetCents = paycheckTarget?.targetCents ?? Math.round(plan.budgetCents / 2);
    const previousPaycheckSpentCents =
      paycheckStart > monthStart
        ? spentForCategory(category?.id, expenseTransactions, refundTransactions, monthStart, paycheckStart)
        : 0;
    const paycheckCarryoverCents =
      paycheckStart > monthStart ? paycheckBaseBudgetCents - previousPaycheckSpentCents : 0;
    const paycheckBudgetCents = Math.max(0, paycheckBaseBudgetCents + paycheckCarryoverCents);
    const paycheckSpentCents = spentForCategory(category?.id, expenseTransactions, refundTransactions, paycheckStart, paycheckEnd);
    const ratio = plan.budgetCents > 0 ? spent / plan.budgetCents : 0;
    const paycheckRatio = paycheckBudgetCents > 0 ? paycheckSpentCents / paycheckBudgetCents : paycheckSpentCents > 0 ? 1 : 0;
    const status = ratio > 1 || paycheckRatio > 1 ? "Over budget" : ratio >= 0.9 || paycheckRatio >= 0.9 ? "Near limit" : ratio >= 0.75 || paycheckRatio >= 0.75 ? "Watch it" : "On track";
    const categoryTransactions = category ? posted
      .filter((transaction) => transaction.categoryId === category.id && (transaction.transactionKind === "EXPENSE" || transaction.transactionKind === "REFUND"))
      .map(transactionRow) : [];
    return { id: category?.id ?? plan.name, name: plan.name, icon: category?.icon ?? null, color: category?.color ?? null, spentCents: spent, budgetCents: plan.budgetCents, leftCents: plan.budgetCents - spent, percent: Math.round(ratio * 100), paycheckSpentCents, paycheckBudgetCents, paycheckBaseBudgetCents, paycheckCarryoverCents, paycheckLeftCents: paycheckBudgetCents - paycheckSpentCents, paycheckPercent: Math.round(paycheckRatio * 100), status, transactions: categoryTransactions, isUncategorized: false };
  });
  const uncategorizedTransactions = posted
    .filter((transaction) =>
      (transaction.transactionKind === "EXPENSE" || transaction.transactionKind === "UNCATEGORIZED" || transaction.transactionKind === "REFUND") &&
      (transaction.transactionKind === "UNCATEGORIZED" || !transaction.categoryId || transaction.category?.systemKey === SYSTEM_CATEGORY_KEY.UNCATEGORIZED)
    )
    .map(transactionRow);
  const uncategorizedSpentCents = uncategorizedTransactions.reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amountCents, 0)), 0);
  const uncategorizedCategory = {
    id: "uncategorized-review",
    name: "Uncategorized",
    icon: "WalletCards",
    color: "#6b7280",
    spentCents: uncategorizedSpentCents,
    budgetCents: 0,
    leftCents: -uncategorizedSpentCents,
    percent: uncategorizedSpentCents > 0 ? 100 : 0,
    paycheckSpentCents: 0,
    paycheckBudgetCents: 0,
    paycheckBaseBudgetCents: 0,
    paycheckCarryoverCents: 0,
    paycheckLeftCents: 0,
    paycheckPercent: 0,
    status: uncategorizedSpentCents > 0 ? "Needs review" : "On track",
    transactions: uncategorizedTransactions,
    isUncategorized: true,
  };
  const categoryRows = [...categoryBudgets, uncategorizedCategory];
  const paycheckCategories = PAYCHECK_TARGETS.map((target) => {
    if (target.name === "Savings") {
      const spentCents = Math.min(target.targetCents, savingsAddedCents);
      return { name: target.name, targetCents: target.targetCents, spentCents, leftCents: Math.max(0, target.targetCents - spentCents), percent: Math.round((spentCents / target.targetCents) * 100) };
    }
    const category = categoryForPlan(categories, target);
    const periodExpenses = expenseTransactions.filter((transaction) => transaction.categoryId === category?.id && transaction.postedAt >= paycheckStart && transaction.postedAt < paycheckEnd);
    const periodRefunds = refundTransactions.filter((transaction) => transaction.categoryId === category?.id && transaction.postedAt >= paycheckStart && transaction.postedAt < paycheckEnd);
    const spentCents = expenseTotal(periodExpenses) - refundTotal(periodRefunds);
    return { name: target.name, targetCents: target.targetCents, spentCents, leftCents: target.targetCents - spentCents, percent: Math.round((spentCents / target.targetCents) * 100) };
  });

  const momPaid = posted.some((transaction) => /ZELLE PAYMENT FROM CALEB.*TO NICOLE FANNING/.test(transaction.normalizedDescription) && Math.abs(transaction.amountCents) >= 60300 && Math.abs(transaction.amountCents) <= 60600);
  const westlakePaid = posted.some((transaction) => /ACI WESTLAKE PAYMENT/.test(transaction.normalizedDescription));
  const normalizedName = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");
  const hasMatchingPayment = (input: { name: string; amountCents: number; merchantMatch?: string | null; merchantKey?: string | null; transactionKind?: string }) => {
    const merchantNeedle = input.merchantMatch?.trim().toUpperCase() || input.merchantKey?.trim().toUpperCase() || null;
    const nameNeedle = normalizedName(input.name);
    return posted.some((transaction) => {
      const kindMatches = input.transactionKind ? transaction.transactionKind === input.transactionKind : transaction.transactionKind === "EXPENSE";
      if (!kindMatches) return false;
      const amountMatches = Math.abs(Math.abs(transaction.amountCents) - input.amountCents) <= Math.max(100, Math.round(input.amountCents * 0.1));
      if (!amountMatches) return false;
      if (merchantNeedle) return transaction.normalizedDescription.includes(merchantNeedle);
      return nameNeedle.length >= 4 && transaction.normalizedDescription.includes(nameNeedle);
    });
  };
  const obligations = recurringItems.filter((item) => item.isRequired && item.transactionKind === "EXPENSE").map((item) => ({ id: item.id, name: item.name, amountCents: item.amountCents, dueDay: item.dayOfMonth, paymentGroupKey: item.paymentGroupKey, paid: item.paymentGroupKey === "MOM_HOUSEHOLD" ? momPaid : item.merchantMatch?.includes("WESTLAKE") ? westlakePaid : false }));
  const householdItems = obligations.filter((item) => item.paymentGroupKey === "MOM_HOUSEHOLD");
  const standaloneItems = obligations.filter((item) => item.paymentGroupKey !== "MOM_HOUSEHOLD");
  const obligationGroups = [
    ...(householdItems.length ? [{ key: "MOM_HOUSEHOLD", name: "Mom household payment", amountCents: householdItems.reduce((sum, item) => sum + item.amountCents, 0), dueDay: 9, paid: momPaid, components: householdItems }] : []),
    ...standaloneItems.map((item) => ({ key: item.id, name: item.name, amountCents: item.amountCents, dueDay: item.dueDay, paid: item.paid, components: [item] })),
  ];
  const recurringPaymentRows = recurringItems
    .filter((item) => item.transactionKind !== "INCOME")
    .map((item) => ({
      key: `recurring-${item.id}`,
      name: item.paymentGroupKey === "MOM_HOUSEHOLD" ? `${item.name} (Mom household)` : item.name,
      amountCents: item.amountCents,
      frequency: item.frequency,
      interval: item.interval,
      dueDay: item.dayOfMonth,
      nextDueDate: item.nextDueDate,
      paymentType: item.category?.name === "Subscriptions" ? "Recurring expense" : item.category?.name ?? (item.transactionKind === "SAVINGS_TRANSFER" ? "Planned savings" : "Recurring expense"),
      paid: item.paymentGroupKey === "MOM_HOUSEHOLD" ? momPaid : item.merchantMatch?.includes("WESTLAKE") ? westlakePaid : hasMatchingPayment({ name: item.name, amountCents: item.amountCents, merchantMatch: item.merchantMatch, transactionKind: item.transactionKind }),
    }))
    .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99) || a.name.localeCompare(b.name));

  const paycheckDate = nextPaycheck;
  const upcomingBills = paycheckDate ? obligationGroups.filter((group) => !group.paid && group.dueDay !== null && setDate(startOfDay(month), Math.min(group.dueDay, endOfMonth(month).getDate())) <= paycheckDate) : [];
  const upcomingRequiredCents = upcomingBills.reduce((sum, group) => sum + group.amountCents, 0);
  // Checking remains spendable only after reserving card debt, imminent required bills, and the unfunded savings floor.
  const safeToSpendCents = Math.max(0, cashAvailableCents - upcomingRequiredCents - creditCardOwedCents - savingsRemainingCents);
  const regularBudgetRemainingCents = categoryBudgets.reduce((sum, category) => sum + Math.max(0, category.leftCents), 0);
  const unpaidMonthlyBillsCents = obligationGroups.filter((group) => !group.paid).reduce((sum, group) => sum + group.amountCents, 0);
  const sinkingContributionsCents = sinkingFunds.reduce((sum, fund) => sum + fund.monthlyContributionCents, 0);
  const hasProjectionData = accounts.length > 0 && posted.length > 0 && actualIncomeCents > 0;
  // A sweep is surplus only after pending charges, all remaining monthly plans, debt reserve, required bills, and planned savings.
  const projectedSurplusCents = hasProjectionData ? Math.max(0, cashAvailableCents - creditCardOwedCents - pendingExpensesCents - unpaidMonthlyBillsCents - regularBudgetRemainingCents - savingsRemainingCents - sinkingContributionsCents) : 0;
  const movementKinds = new Set(["TRANSFER", "SAVINGS_TRANSFER", "CREDIT_CARD_PAYMENT", "REFUND", "REIMBURSEMENT"]);
  const sinkingFundBreakdown = sinkingFunds.map((fund) => {
    const matchingCategory = categories.find((category) => category.name === fund.name || (fund.name === "Car Upkeep" && category.name === "Car Maintenance"));
    const spentThisMonthCents = matchingCategory ? expenseTotal(expenseTransactions.filter((transaction) => transaction.categoryId === matchingCategory.id)) - refundTotal(refundTransactions.filter((transaction) => transaction.categoryId === matchingCategory.id)) : 0;
    const addedThisMonthCents = fund.monthlyContributionCents;
    return { ...fund, displayName: fund.name === "Car Upkeep" ? "Car Maintenance" : fund.name === "Annual / Unexpected" ? "Annual & Unexpected" : fund.name, startingBalanceCents: fund.currentBalanceCents - addedThisMonthCents + spentThisMonthCents, addedThisMonthCents, spentThisMonthCents };
  });

  return {
    month, monthKey: getMonthKey(month), monthLabel: getMonthLabel(month), connection,
    cashAvailableCents, savingsBalanceCents, creditCardOwedCents, monthlySpendingCents, savingsAddedCents,
    savingsFloorCents: SAVINGS_FLOOR_CENTS, savingsRemainingCents, actualIncomeCents,
    nextPaycheckDate: paycheckDate, hasPaycheckSchedule: Boolean(paycheckDate), paycheckScheduleSource: paycheckDates[0] ? "configured" as const : inferredSchedule ? "history" as const : "missing" as const, upcomingRequiredCents, safeToSpendCents,
    projectedSurplusCents, hasProjectionData, projectionIsEstimate: isBefore(new Date(), monthEnd),
    discoverCreditLimitCents: DISCOVER_CREDIT_LIMIT_CENTS,
    discoverAvailableCreditCents: Math.max(0, DISCOVER_CREDIT_LIMIT_CENTS - creditCardOwedCents),
    obligations: obligationGroups, recurringPayments: recurringPaymentRows, upcomingBills, categories: categoryRows, paycheckCategories,
    paycheckPeriod: { start: paycheckStart, end: paycheckEnd },
    sinkingFunds: sinkingFundBreakdown, accounts,
    moneyMovement: includedTransactions.filter((transaction) => movementKinds.has(transaction.transactionKind)).slice(0, 8),
    recent: includedTransactions.slice(0, 12), review: includedTransactions.filter((transaction) => transaction.reviewStatus === "NEEDS_REVIEW").slice(0, 12),
    categoryOptions: categories.map(({ id, name }) => ({ id, name, isRecurring: name === "Subscriptions" })),
    netPositionCents: cashAvailableCents + savingsBalanceCents - creditCardOwedCents,
    sweepCompleted: savingsAddedCents > 0,
  };
}
