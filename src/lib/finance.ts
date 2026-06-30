import { addMonths, format, isValid, parse, startOfMonth } from "date-fns";
import { WARNING_THRESHOLD } from "./constants";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseCurrencyToCents(value: string) {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export function parseMonthKey(rawMonth?: string) {
  if (!rawMonth) {
    return startOfMonth(new Date());
  }

  const parsed = parse(rawMonth, "yyyy-MM", new Date());
  return isValid(parsed) ? startOfMonth(parsed) : startOfMonth(new Date());
}

export function getMonthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function getMonthLabel(date: Date) {
  return format(date, "MMMM yyyy");
}

export function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getMonthBounds(month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = addMonths(monthStart, 1);

  return {
    monthStart,
    monthEnd,
  };
}

export function getBudgetPacing(month: Date, today = new Date()) {
  const monthStart = startOfMonth(month);
  const monthEnd = addMonths(monthStart, 1);
  const daysInMonth = Math.round(
    (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const budgetWeekCount = Math.ceil(daysInMonth / 7);
  const isBeforeMonth = today < monthStart;
  const isAfterMonth = today >= monthEnd;
  const dayOfMonth = isBeforeMonth
    ? 1
    : isAfterMonth
      ? daysInMonth
      : today.getDate();
  const currentBudgetWeek = Math.min(Math.ceil(dayOfMonth / 7), budgetWeekCount);

  return {
    budgetWeekCount,
    currentBudgetWeek,
  };
}

export type BudgetStatus = "healthy" | "warning" | "over";

export function getBudgetStatus(spentCents: number, budgetCents: number): BudgetStatus {
  if (budgetCents <= 0 && spentCents > 0) {
    return "over";
  }

  if (spentCents > budgetCents) {
    return "over";
  }

  if (budgetCents > 0 && spentCents / budgetCents >= WARNING_THRESHOLD) {
    return "warning";
  }

  return "healthy";
}
