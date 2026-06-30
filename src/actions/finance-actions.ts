"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureBudgetWorkspace } from "@/lib/default-user";
import { parseCurrencyToCents } from "@/lib/finance";
import { addMonths, addWeeks, addYears } from "date-fns";
import { connectSimpleFin, syncSimpleFin } from "@/lib/server/simplefin-service";
import { requireSettingsAuthorization, unlockSettings } from "@/lib/server/settings-auth";

export type FinanceActionState = { status: "idle" | "success" | "error"; message?: string };
const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return message
    .replace(/https:\/\/[^@\s/]+@/gi, "https://[credential-hidden]@")
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [credential-hidden]")
    .slice(0, 300);
};

export async function unlockFinanceSettingsAction(_state: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const password = formData.get("password");
  if (typeof password !== "string" || !(await unlockSettings(password))) return { status: "error", message: "That settings password is not correct." };
  redirect("/finance/settings");
}

export async function connectSimpleFinAction(_state: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  void _state;
  try {
    await requireSettingsAuthorization();
    const token = formData.get("setupToken");
    if (typeof token !== "string" || token.trim().length < 20 || token.length > 4096) return { status: "error", message: "Paste a valid SimpleFIN setup token." };
    const result = await connectSimpleFin(token);
    revalidatePath("/finance"); revalidatePath("/finance/settings");
    return { status: "success", message: `Connected ${result.accountCount} account${result.accountCount === 1 ? "" : "s"}.${result.warning ? ` Warning: ${result.warning}` : ""}` };
  } catch (error) { return { status: "error", message: errorMessage(error) }; }
}

export async function syncSimpleFinAction(_state: FinanceActionState): Promise<FinanceActionState> {
  void _state;
  try {
    await requireSettingsAuthorization();
    const result = await syncSimpleFin();
    revalidatePath("/finance"); revalidatePath("/finance/settings");
    return { status: "success", message: `${result.added} new, ${result.updated} updated, ${result.review} needing review.` };
  } catch (error) { return { status: "error", message: errorMessage(error) }; }
}

export async function updateFinancialAccountAction(formData: FormData) {
  await requireSettingsAuthorization();
  const user = await ensureBudgetWorkspace();
  const id = formData.get("id");
  const displayName = formData.get("displayName");
  const accountType = formData.get("accountType");
  const allowedTypes = ["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "OTHER"] as const;
  if (typeof id !== "string" || typeof displayName !== "string" || displayName.trim().length < 1 || displayName.length > 80 || typeof accountType !== "string" || !allowedTypes.includes(accountType as typeof allowedTypes[number])) throw new Error("Invalid account settings.");
  await prisma.financialAccount.updateMany({ where: { id, userId: user.id }, data: { displayName: displayName.trim(), accountType: accountType as typeof allowedTypes[number], includeInDashboard: formData.get("includeInDashboard") === "on" } });
  revalidatePath("/finance"); revalidatePath("/finance/settings");
}

export async function categorizeTransactionAction(formData: FormData) {
  const user = await ensureBudgetWorkspace();
  const transactionId = formData.get("transactionId");
  const categoryId = formData.get("categoryId");
  const kind = formData.get("transactionKind");
  const frequency = formData.get("recurringFrequency");
  const allowedKinds = ["EXPENSE", "INCOME", "TRANSFER", "CREDIT_CARD_PAYMENT", "SAVINGS_TRANSFER", "REFUND", "REIMBURSEMENT", "CASH_WITHDRAWAL", "UNCATEGORIZED"] as const;
  const allowedFrequencies = ["WEEKLY", "MONTHLY", "YEARLY"] as const;
  if (typeof transactionId !== "string" || typeof kind !== "string" || !allowedKinds.includes(kind as typeof allowedKinds[number])) throw new Error("Invalid transaction update.");
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId: user.id } });
  if (!transaction) throw new Error("Transaction not found.");
  const safeCategoryId = typeof categoryId === "string" && categoryId ? categoryId : null;
  const category = safeCategoryId
    ? await prisma.category.findFirst({ where: { id: safeCategoryId, userId: user.id, isArchived: false }, select: { id: true, name: true } })
    : null;
  if (safeCategoryId && !category) throw new Error("Invalid category.");
  const markRecurring = formData.get("markRecurring") === "on" || category?.name === "Subscriptions";
  const safeFrequency = typeof frequency === "string" && allowedFrequencies.includes(frequency as typeof allowedFrequencies[number]) ? frequency as typeof allowedFrequencies[number] : "MONTHLY";
  await prisma.transaction.update({ where: { id: transaction.id }, data: { categoryId: safeCategoryId, transactionKind: kind as typeof allowedKinds[number], reviewStatus: "USER_CONFIRMED" } });
  if (formData.get("saveRule") === "on" || markRecurring) await prisma.transactionRule.create({ data: { userId: user.id, matchText: transaction.normalizedDescription, matchType: "EXACT", normalizedMerchant: transaction.merchantName, categoryId: safeCategoryId, transactionKind: kind as typeof allowedKinds[number], priority: 175 } });
  if (markRecurring && kind === "EXPENSE" && transaction.amountCents < 0) {
    const existing = await prisma.recurringExpense.findFirst({ where: { userId: user.id, merchantMatch: transaction.normalizedDescription, isActive: true } });
    const nextDueDate = safeFrequency === "YEARLY" ? addYears(transaction.postedAt, 1) : safeFrequency === "WEEKLY" ? addWeeks(transaction.postedAt, 1) : addMonths(transaction.postedAt, 1);
    const recurringData = {
      categoryId: safeCategoryId,
      name: transaction.merchantName ?? transaction.description,
      amountCents: Math.abs(transaction.amountCents),
      frequency: safeFrequency,
      interval: 1,
      startDate: transaction.postedAt,
      nextDueDate,
      dayOfMonth: transaction.postedAt.getDate(),
      dayOfWeek: transaction.postedAt.getDay(),
      transactionKind: "EXPENSE" as const,
      isRequired: false,
      merchantMatch: transaction.normalizedDescription,
    };
    if (existing) await prisma.recurringExpense.update({ where: { id: existing.id }, data: recurringData });
    else await prisma.recurringExpense.create({ data: { userId: user.id, ...recurringData } });
  }
  revalidatePath("/finance");
}

export async function createRecurringItemAction(formData: FormData) {
  await requireSettingsAuthorization();
  const user = await ensureBudgetWorkspace();
  const name = formData.get("name");
  const amount = formData.get("amount");
  const nextDue = formData.get("nextDueDate");
  const kind = formData.get("transactionKind");
  const allowedKinds = ["EXPENSE", "INCOME", "SAVINGS_TRANSFER"] as const;
  const amountCents = typeof amount === "string" ? parseCurrencyToCents(amount) : null;
  const nextDueDate = typeof nextDue === "string" ? new Date(`${nextDue}T12:00:00`) : null;
  if (typeof name !== "string" || !name.trim() || name.length > 80 || amountCents === null || !nextDueDate || Number.isNaN(nextDueDate.getTime()) || typeof kind !== "string" || !allowedKinds.includes(kind as typeof allowedKinds[number])) throw new Error("Invalid recurring item.");
  await prisma.recurringExpense.create({ data: { userId: user.id, name: name.trim(), amountCents, startDate: nextDueDate, nextDueDate, transactionKind: kind as typeof allowedKinds[number], isRequired: formData.get("isRequired") === "on" } });
  revalidatePath("/finance"); revalidatePath("/finance/settings");
}

export async function deleteRecurringItemAction(formData: FormData) {
  await requireSettingsAuthorization();
  const user = await ensureBudgetWorkspace();
  const id = formData.get("id");
  if (typeof id !== "string") throw new Error("Invalid recurring item.");
  const item = await prisma.recurringExpense.findFirst({ where: { id, userId: user.id }, select: { categoryId: true } });
  await prisma.recurringExpense.deleteMany({ where: { id, userId: user.id } });
  if (item?.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: item.categoryId, userId: user.id }, select: { id: true, name: true } });
    if (category?.name === "Subscriptions") {
      const total = await prisma.recurringExpense.aggregate({ where: { userId: user.id, categoryId: category.id, isActive: true }, _sum: { amountCents: true } });
      await prisma.category.update({ where: { id: category.id }, data: { monthlyBudgetCents: total._sum.amountCents ?? 0 } });
    }
  }
  revalidatePath("/finance"); revalidatePath("/finance/settings");
}

export async function deleteTransactionRuleAction(formData: FormData) {
  await requireSettingsAuthorization();
  const user = await ensureBudgetWorkspace();
  const id = formData.get("id");
  if (typeof id !== "string") throw new Error("Invalid transaction rule.");
  await prisma.transactionRule.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/finance/settings");
}
