import type { TransactionRule } from "@prisma/client";
import { addDays, addMonths, setDate, startOfDay, subDays } from "date-fns";
import { DEFAULT_USER_CATEGORIES } from "@/lib/constants";
import { ensureDefaultUser } from "@/lib/default-user";
import { prisma } from "@/lib/prisma";
import { classifyTransaction } from "./transaction-classifier";

const MOM_PAYMENT_GROUP = "MOM_HOUSEHOLD";

const RULES = [
  { matchText: "DISCOVER E-PAYMENT", category: null, kind: "CREDIT_CARD_PAYMENT", priority: 200 },
  { matchText: "INTERNET PAYMENT - THANK YOU", category: null, kind: "CREDIT_CARD_PAYMENT", priority: 200 },
  { matchText: "ROUND UPS", category: null, kind: "SAVINGS_TRANSFER", priority: 190 },
  { matchText: "INTERNET TRANSFER TO SAVINGS", category: null, kind: "SAVINGS_TRANSFER", priority: 188 },
  { matchText: "INTERNET TRANSFER FROM SAVINGS", category: null, kind: "SAVINGS_TRANSFER", priority: 188 },
  { matchText: "INTERNET TRANSFER", category: null, kind: "TRANSFER", priority: 180 },
  { matchText: "CASH APP CALEB BESSER", category: null, kind: "TRANSFER", priority: 180 },
  { matchText: "ED WITTMEIER FOR PAYROLL", category: null, kind: "INCOME", priority: 200 },
  { matchText: "ACI WESTLAKE PAYMENT", category: "Required Bills", kind: "EXPENSE", priority: 180 },
  { matchText: "OREGROWN", category: "Cannabis", kind: "EXPENSE", priority: 150 },
  { matchText: "LOST IN CHICO", category: "Cannabis", kind: "EXPENSE", priority: 150 },
  { matchText: "SMOKERS CHOICE", category: "Cannabis", kind: "EXPENSE", priority: 150 },
  { matchText: "CLOUD 530", category: "Cannabis", kind: "EXPENSE", priority: 150 },
  { matchText: "YOCAN", category: "Cannabis", kind: "EXPENSE", priority: 150 },
  { matchText: "ROBLOX", category: "Fun & Going Out", kind: "EXPENSE", priority: 140 },
  { matchText: "BOWLERO", category: "Fun & Going Out", kind: "EXPENSE", priority: 140 },
  { matchText: "CINEMARK", category: "Fun & Going Out", kind: "EXPENSE", priority: 140 },
  { matchText: "HARD ROCK", category: "Fun & Going Out", kind: "EXPENSE", priority: 140 },
  { matchText: "NINTENDO", category: "Fun & Going Out", kind: "EXPENSE", priority: 140 },
  { matchText: "VALVE", category: "Fun & Going Out", kind: "EXPENSE", priority: 140 },
  { matchText: "MADISON BEAR", category: "Fun & Going Out", kind: "EXPENSE", priority: 130 },
  { matchText: "BUTLER AMUSEMENTS", category: "Fun & Going Out", kind: "EXPENSE", priority: 130 },
  { matchText: "AMI MUSICBOX", category: "Fun & Going Out", kind: "EXPENSE", priority: 130 },
  { matchText: "MCDONALD", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "EGG ROLL KING", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "QUACKERS", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "PANDA EXPRESS", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "DUTCH BROS", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "LA FLOR DE MICHOACAN", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "ROUND TABLE PIZZA", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "LEFT COAST VENDIN", category: "Eating Out", kind: "EXPENSE", priority: 120 },
  { matchText: "ARCO", category: "Gas", kind: "EXPENSE", priority: 120 },
  { matchText: "UNION 76", category: "Gas", kind: "EXPENSE", priority: 120 },
  { matchText: "VALERO", category: "Gas", kind: "EXPENSE", priority: 120 },
  { matchText: "DINO MART", category: "Gas", kind: "EXPENSE", priority: 120 },
  { matchText: "SAFEWAY FUEL", category: "Gas", kind: "EXPENSE", priority: 125 },
  { matchText: "CRUZTHRU", category: "Gas", kind: "EXPENSE", priority: 120 },
  { matchText: "SAFEWAY", category: "Groceries", kind: "EXPENSE", priority: 110 },
  { matchText: "WINCO", category: "Groceries", kind: "EXPENSE", priority: 110 },
  { matchText: "TARGET", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "WALMART", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "WAL MART", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "AMAZON", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "GOODWILL", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "BURLINGTON", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "DOLLAR TREE", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "NAME CHEAP", category: "Shopping", kind: "EXPENSE", priority: 100 },
  { matchText: "PAI ATM", category: "Cash & Miscellaneous", kind: "EXPENSE", priority: 120 },
  { matchText: "WELLS FARGO BANK", category: "Cash & Miscellaneous", kind: "EXPENSE", priority: 120 },
  { matchText: "CHICO TOP IMPORTS", category: "Car Upkeep", kind: "EXPENSE", priority: 160 },
  { matchText: "WITTMEIER CHEVROLET", category: "Car Upkeep", kind: "EXPENSE", priority: 160 },
] as const;

function nextMonthlyDate(day: number, now = new Date()) {
  const candidate = setDate(startOfDay(now), day);
  return candidate >= startOfDay(now) ? candidate : setDate(addMonths(candidate, 1), day);
}

export async function reclassifyPersonalTransactions(userId: string) {
  const [categories, rules, transactions] = await Promise.all([
    prisma.category.findMany({ where: { userId, isArchived: false }, select: { id: true, name: true } }),
    prisma.transactionRule.findMany({ where: { userId, isActive: true }, orderBy: { priority: "desc" } }),
    prisma.transaction.findMany({ where: { userId }, include: { account: { select: { accountType: true } } } }),
  ]);
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  let reviewed = 0;
  for (const transaction of transactions) {
    const result = classifyTransaction({
      description: transaction.description,
      amountCents: transaction.amountCents,
      accountType: transaction.account.accountType,
      providerCategory: transaction.rawCategory,
      rules: rules as TransactionRule[],
      categoryIdByName,
    });
    if (result.reviewStatus === "NEEDS_REVIEW") reviewed++;
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        normalizedDescription: result.normalized,
        merchantName: result.merchantName,
        transactionKind: result.kind,
        categoryId: result.categoryId,
        reviewStatus: result.reviewStatus,
      },
    });
  }
  return { transactionCount: transactions.length, reviewCount: reviewed };
}

export async function removeCrossSourceDuplicates(userId: string) {
  const simpleFinTransactions = await prisma.transaction.findMany({
    where: { userId, importSource: "SIMPLEFIN" },
    include: { account: { select: { accountType: true } } },
    orderBy: { postedAt: "asc" },
  });
  let removed = 0;
  for (const transaction of simpleFinTransactions) {
    const duplicate = await prisma.transaction.findFirst({
      where: {
        userId,
        importSource: "CSV",
        amountCents: transaction.amountCents,
        merchantName: transaction.merchantName,
        account: { accountType: transaction.account.accountType },
        postedAt: { gte: subDays(transaction.postedAt, 5), lte: addDays(transaction.postedAt, 5) },
      },
      orderBy: { postedAt: "asc" },
      select: { id: true },
    });
    if (duplicate) {
      await prisma.transaction.delete({ where: { id: duplicate.id } });
      removed++;
    }
  }
  return removed;
}

export async function rebuildPersonalFinanceSetup() {
  const user = await ensureDefaultUser();
  const beforeCount = await prisma.transaction.count({ where: { userId: user.id } });

  await prisma.$transaction(async (tx) => {
    for (const category of DEFAULT_USER_CATEGORIES) {
      await tx.category.upsert({
        where: { userId_name: { userId: user.id, name: category.name } },
        update: { icon: category.icon, color: category.color, monthlyBudgetCents: category.monthlyBudgetCents, sortOrder: category.sortOrder, kind: "USER", isArchived: false },
        create: { userId: user.id, ...category, kind: "USER" },
      });
    }
    const activeNames = DEFAULT_USER_CATEGORIES.map((category) => category.name);
    await tx.category.updateMany({ where: { userId: user.id, kind: "USER", name: { notIn: activeNames } }, data: { isArchived: true } });
    const categories = await tx.category.findMany({ where: { userId: user.id, isArchived: false }, select: { id: true, name: true } });
    const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));

    await tx.transactionRule.deleteMany({ where: { userId: user.id } });
    await tx.transactionRule.createMany({
      data: RULES.map((rule) => ({
        userId: user.id,
        matchText: rule.matchText,
        matchType: "CONTAINS" as const,
        normalizedMerchant: rule.matchText,
        categoryId: rule.category ? categoryIdByName.get(rule.category) ?? null : null,
        transactionKind: rule.kind,
        priority: rule.priority,
      })),
    });

    await tx.bill.updateMany({ where: { userId: user.id }, data: { isActive: false } });
    const bills = [
      { name: "Rent", amount: 35000, dueDay: 9, notes: "Included in the grouped payment to Mom." },
      { name: "Gym", amount: 6000, dueDay: 9, notes: "Included in the grouped payment to Mom." },
      { name: "Car insurance", amount: 15000, dueDay: 9, notes: "Included in the grouped payment to Mom." },
      { name: "Phone", amount: 4400, dueDay: 9, notes: "Included in the grouped payment to Mom." },
      { name: "Westlake car loan", amount: 60500, dueDay: 10, notes: "Separate monthly car payment." },
    ];
    for (const [sortOrder, bill] of bills.entries()) {
      await tx.bill.upsert({
        where: { userId_name: { userId: user.id, name: bill.name } },
        update: { monthlyAmountCents: bill.amount, dueDay: bill.dueDay, notes: bill.notes, sortOrder, isActive: true },
        create: { userId: user.id, name: bill.name, monthlyAmountCents: bill.amount, dueDay: bill.dueDay, notes: bill.notes, sortOrder },
      });
    }

    await tx.recurringExpense.deleteMany({ where: { userId: user.id } });
    const requiredCategoryId = categoryIdByName.get("Required Bills") ?? null;
    await tx.recurringExpense.createMany({ data: [
      { userId: user.id, categoryId: requiredCategoryId, name: "Rent", amountCents: 35000, startDate: nextMonthlyDate(9), nextDueDate: nextMonthlyDate(9), dayOfMonth: 9, transactionKind: "EXPENSE", isRequired: true, merchantMatch: "ZELLE PAYMENT FROM CALEB TO NICOLE FANNING", paymentGroupKey: MOM_PAYMENT_GROUP },
      { userId: user.id, categoryId: requiredCategoryId, name: "Gym", amountCents: 6000, startDate: nextMonthlyDate(9), nextDueDate: nextMonthlyDate(9), dayOfMonth: 9, transactionKind: "EXPENSE", isRequired: true, merchantMatch: "ZELLE PAYMENT FROM CALEB TO NICOLE FANNING", paymentGroupKey: MOM_PAYMENT_GROUP },
      { userId: user.id, categoryId: requiredCategoryId, name: "Car insurance", amountCents: 15000, startDate: nextMonthlyDate(9), nextDueDate: nextMonthlyDate(9), dayOfMonth: 9, transactionKind: "EXPENSE", isRequired: true, merchantMatch: "ZELLE PAYMENT FROM CALEB TO NICOLE FANNING", paymentGroupKey: MOM_PAYMENT_GROUP },
      { userId: user.id, categoryId: requiredCategoryId, name: "Phone", amountCents: 4400, startDate: nextMonthlyDate(9), nextDueDate: nextMonthlyDate(9), dayOfMonth: 9, transactionKind: "EXPENSE", isRequired: true, merchantMatch: "ZELLE PAYMENT FROM CALEB TO NICOLE FANNING", paymentGroupKey: MOM_PAYMENT_GROUP },
      { userId: user.id, categoryId: requiredCategoryId, name: "Westlake car loan", amountCents: 60500, startDate: nextMonthlyDate(10), nextDueDate: nextMonthlyDate(10), dayOfMonth: 10, transactionKind: "EXPENSE", isRequired: true, merchantMatch: "ACI WESTLAKE PAYMENT" },
    ] });
  });

  const classified = await reclassifyPersonalTransactions(user.id);
  const afterCount = await prisma.transaction.count({ where: { userId: user.id } });
  if (afterCount < beforeCount) throw new Error("Transaction history verification failed.");
  return { beforeCount, afterCount, ...classified };
}
