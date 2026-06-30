import { prisma } from "./prisma";
import {
  CATEGORY_KIND,
  DEFAULT_USER_CATEGORIES,
  DEFAULT_SINKING_FUNDS,
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_NAME,
  SYSTEM_CATEGORIES,
} from "./constants";

declare global {
  var budgetWorkspacePromise: Promise<Awaited<ReturnType<typeof ensureDefaultUser>>> | undefined;
}

export async function ensureDefaultUser() {
  return prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: { name: DEFAULT_USER_NAME },
    create: { email: DEFAULT_USER_EMAIL, name: DEFAULT_USER_NAME },
  });
}

export async function ensureBaseCategories(userId: string) {
  await prisma.$transaction([
    ...SYSTEM_CATEGORIES.map((category) =>
      prisma.category.upsert({
        where: { userId_systemKey: { userId, systemKey: category.key } },
        update: {
          name: category.name,
          icon: category.icon,
          color: category.color,
          sortOrder: category.sortOrder,
          monthlyBudgetCents: 0,
          kind: CATEGORY_KIND.SYSTEM,
          isArchived: false,
        },
        create: {
          userId,
          name: category.name,
          icon: category.icon,
          color: category.color,
          monthlyBudgetCents: 0,
          kind: CATEGORY_KIND.SYSTEM,
          systemKey: category.key,
          sortOrder: category.sortOrder,
        },
      })
    ),
    ...DEFAULT_USER_CATEGORIES.map((category) =>
      prisma.category.upsert({
        where: { userId_name: { userId, name: category.name } },
        update: {
          icon: category.icon,
          color: category.color,
          sortOrder: category.sortOrder,
          kind: CATEGORY_KIND.USER,
          isArchived: false,
        },
        create: {
          userId,
          name: category.name,
          icon: category.icon,
          color: category.color,
          monthlyBudgetCents: category.monthlyBudgetCents,
          sortOrder: category.sortOrder,
          kind: CATEGORY_KIND.USER,
        },
      })
    ),
  ]);
}

export async function ensureBudgetWorkspace() {
  if (global.budgetWorkspacePromise) return global.budgetWorkspacePromise;

  global.budgetWorkspacePromise = ensureBudgetWorkspaceUncached().catch((error) => {
    global.budgetWorkspacePromise = undefined;
    throw error;
  });

  return global.budgetWorkspacePromise;
}

async function ensureBudgetWorkspaceUncached() {
  const user = await ensureDefaultUser();
  await ensureBaseCategories(user.id);
  await prisma.$transaction(
    DEFAULT_SINKING_FUNDS.map((fund) =>
      prisma.sinkingFund.upsert({
        where: { userId_name: { userId: user.id, name: fund.name } },
        update: {
          monthlyContributionCents: fund.monthlyContributionCents,
          icon: fund.icon,
          color: fund.color,
          sortOrder: fund.sortOrder,
          isActive: true,
        },
        create: { userId: user.id, ...fund },
      })
    )
  );
  return user;
}
