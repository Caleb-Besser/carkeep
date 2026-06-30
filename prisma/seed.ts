import { addDays, addMonths, startOfMonth } from "date-fns";
import { CategoryKind, PrismaClient, TransactionSource } from "@prisma/client";
import {
  DEFAULT_USER_CATEGORIES,
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_NAME,
  SYSTEM_CATEGORIES,
} from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: { name: DEFAULT_USER_NAME },
    create: {
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
    },
  });

  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.bill.deleteMany({ where: { userId: user.id } });
  await prisma.merchantRule.deleteMany({ where: { userId: user.id } });
  await prisma.recurringExpense.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });

  const categories = await Promise.all(
    [
      ...DEFAULT_USER_CATEGORIES.map((category) => ({
        ...category,
        kind: CategoryKind.USER,
        systemKey: null,
      })),
      ...SYSTEM_CATEGORIES.map((category) => ({
        name: category.name,
        icon: category.icon,
        color: category.color,
        monthlyBudgetCents: 0,
        sortOrder: category.sortOrder,
        kind: CategoryKind.SYSTEM,
        systemKey: category.key,
      })),
    ].map((category) =>
      prisma.category.create({
        data: {
          userId: user.id,
          ...category,
        },
      })
    )
  );

  const categoryByName = Object.fromEntries(categories.map((category) => [category.name, category]));
  const currentMonth = startOfMonth(new Date());
  const previousMonth = addMonths(currentMonth, -1);
  const bills = await Promise.all([
    prisma.bill.create({
      data: {
        userId: user.id,
        name: "Internet",
        monthlyAmountCents: 9500,
        dueDay: 15,
        merchantKey: "XFINITY",
        sortOrder: 1,
      },
    }),
    prisma.bill.create({
      data: {
        userId: user.id,
        name: "Phone",
        monthlyAmountCents: 6500,
        dueDay: 18,
        merchantKey: "VERIZON",
        sortOrder: 2,
      },
    }),
  ]);
  const billByName = Object.fromEntries(bills.map((bill) => [bill.name, bill]));

  await prisma.expense.createMany({
    data: [
      {
        userId: user.id,
        categoryId: categoryByName["Rent"].id,
        amountCents: 120000,
        expenseDate: addDays(currentMonth, 1),
        note: "Zelle payment to landlord",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:rent",
        merchantKey: "LANDLORD RENT",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Bills"].id,
        billId: billByName.Internet.id,
        amountCents: 9500,
        expenseDate: addDays(currentMonth, 14),
        note: "XFINITY BILL PAY",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:xfinity",
        merchantKey: "XFINITY",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Eating Out"].id,
        amountCents: 2530,
        expenseDate: addDays(currentMonth, 2),
        note: "QUACKERS FIRE GRILL & 968 EAST AVE CHICO, CA, US",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:quackers",
        merchantKey: "QUACKERS",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Gas"].id,
        amountCents: 4919,
        expenseDate: addDays(currentMonth, 3),
        note: "ARCO#82657CHICO PETQPS 2000 BUSINESS LANE CHICO, CA, US",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:arco",
        merchantKey: "ARCO",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Fun"].id,
        amountCents: 3560,
        expenseDate: addDays(currentMonth, 6),
        note: "OREGROWN - CHICO PURCHASE",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:oregrown",
        merchantKey: "OREGROWN",
      },
      {
        userId: user.id,
        categoryId: categoryByName["General"].id,
        amountCents: 1965,
        expenseDate: addDays(currentMonth, 10),
        note: "BURLINGTON STORES 1292 CHICO CA",
        source: TransactionSource.DISCOVER,
        sourceId: "seed:discover:burlington",
        merchantKey: "BURLINGTON",
        rawCategory: "Merchandise",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Groceries"].id,
        amountCents: 699,
        expenseDate: addDays(currentMonth, 11),
        note: "SAFEWAY #1651 CHICO CA",
        source: TransactionSource.DISCOVER,
        sourceId: "seed:discover:safeway",
        merchantKey: "SAFEWAY",
        rawCategory: "Supermarkets",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Transfers"].id,
        amountCents: 500,
        expenseDate: addDays(currentMonth, 12),
        note: "Zelle payment from Caleb E Besser to Nicole Fanning",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:transfer",
        merchantKey: "ZELLE NICOLE FANNING",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Uncategorized"].id,
        amountCents: 1350,
        expenseDate: addDays(currentMonth, 13),
        note: "PAI ATM 1998 ALCOTT AVE CHICO, CA, US",
        source: TransactionSource.ALLY,
        sourceId: "seed:ally:pai",
        merchantKey: "PAI ATM",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Eating Out"].id,
        amountCents: 944,
        expenseDate: addDays(previousMonth, 22),
        note: "LOST IN CHICO CHICO CA",
        source: TransactionSource.DISCOVER,
        sourceId: "seed:discover:lost",
        merchantKey: "LOST IN CHICO",
        rawCategory: "Restaurants",
      },
    ],
  });

  await prisma.merchantRule.createMany({
    data: [
      {
        userId: user.id,
        categoryId: categoryByName["Gas"].id,
        merchantKey: "ARCO",
      },
      {
        userId: user.id,
        categoryId: categoryByName["Groceries"].id,
        merchantKey: "SAFEWAY",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
