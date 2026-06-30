export const DEFAULT_USER_EMAIL = "owner@expense-tracker.local";
export const DEFAULT_USER_NAME = "Personal Budget";

export const CATEGORY_KIND = {
  USER: "USER",
  SYSTEM: "SYSTEM",
} as const;

export const SYSTEM_CATEGORY_KEY = {
  UNCATEGORIZED: "UNCATEGORIZED",
  TRANSFERS: "TRANSFERS",
  INCOME: "INCOME",
} as const;

export const TRANSACTION_SOURCE = {
  ALLY: "ALLY",
  DISCOVER: "DISCOVER",
} as const;

export const DEFAULT_USER_CATEGORIES = [
  { name: "Cannabis", icon: "Leaf", color: "#9b87f5", monthlyBudgetCents: 40000, sortOrder: 1 },
  { name: "Fun & Going Out", icon: "PartyPopper", color: "#f472b6", monthlyBudgetCents: 30000, sortOrder: 2 },
  { name: "Eating Out", icon: "UtensilsCrossed", color: "#f59e0b", monthlyBudgetCents: 17500, sortOrder: 3 },
  { name: "Gas", icon: "Fuel", color: "#38bdf8", monthlyBudgetCents: 18000, sortOrder: 4 },
  { name: "Groceries", icon: "WalletCards", color: "#34d399", monthlyBudgetCents: 7500, sortOrder: 5 },
  { name: "Shopping", icon: "Shirt", color: "#60a5fa", monthlyBudgetCents: 7500, sortOrder: 6 },
  { name: "Cash & Miscellaneous", icon: "WalletCards", color: "#a3a3a3", monthlyBudgetCents: 5000, sortOrder: 7 },
  { name: "Car Upkeep", icon: "Car", color: "#fb7185", monthlyBudgetCents: 5000, sortOrder: 8 },
  { name: "Subscriptions", icon: "TvMinimalPlay", color: "#818cf8", monthlyBudgetCents: 0, sortOrder: 9 },
  { name: "Required Bills", icon: "House", color: "#2dd4bf", monthlyBudgetCents: 120900, sortOrder: 10 },
] as const;

export const SYSTEM_CATEGORIES = [
  {
    key: SYSTEM_CATEGORY_KEY.UNCATEGORIZED,
    name: "Uncategorized",
    icon: "WalletCards",
    color: "#6b7280",
    sortOrder: 900,
  },
  {
    key: SYSTEM_CATEGORY_KEY.TRANSFERS,
    name: "Transfers",
    icon: "WalletCards",
    color: "#64748b",
    sortOrder: 901,
  },
  {
    key: SYSTEM_CATEGORY_KEY.INCOME,
    name: "Income",
    icon: "WalletCards",
    color: "#2563eb",
    sortOrder: 902,
  },
] as const;

export const SOURCE_LABELS: Record<string, string> = {
  [TRANSACTION_SOURCE.ALLY]: "Ally",
  [TRANSACTION_SOURCE.DISCOVER]: "Discover",
};

export const CATEGORY_COLOR_SWATCHES = [
  "#1f7a64",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#4b5563",
  "#b45309",
  "#0f766e",
];

export const CATEGORY_ICON_OPTIONS = [
  "UtensilsCrossed",
  "Fuel",
  "House",
  "PartyPopper",
  "TvMinimalPlay",
  "WalletCards",
  "Car",
  "Plane",
  "Shirt",
  "HeartPulse",
  "Leaf",
];

export const WARNING_THRESHOLD = 0.8;

export const REGULAR_MONTHLY_BUDGETS = [
  { name: "Cannabis", budgetCents: 40000 },
  { name: "Eating Out", budgetCents: 10000 },
  { name: "Gas", budgetCents: 15000 },
  { name: "Groceries", budgetCents: 20000 },
  { name: "Fun & Social", aliases: ["Fun & Going Out"], budgetCents: 7500 },
  { name: "Shopping", budgetCents: 2500 },
  { name: "Subscriptions", budgetCents: 3500 },
] as const;

export const PAYCHECK_TARGETS = [
  { name: "Cannabis", targetCents: 20000 },
  { name: "Gas", targetCents: 7500 },
  { name: "Groceries", targetCents: 10000 },
  { name: "Eating Out", targetCents: 5000 },
  { name: "Fun & Social", aliases: ["Fun & Going Out"], targetCents: 3750 },
  { name: "Shopping", targetCents: 1250 },
  { name: "Savings", targetCents: 5000 },
] as const;

export const SAVINGS_FLOOR_CENTS = 10000;
export const DISCOVER_CREDIT_LIMIT_CENTS = 20000;

export const DEFAULT_SINKING_FUNDS = [
  { name: "Car Upkeep", monthlyContributionCents: 7500, icon: "Car", color: "#fb7185", sortOrder: 1 },
  { name: "Annual / Unexpected", monthlyContributionCents: 3500, icon: "Shield", color: "#f59e0b", sortOrder: 2 },
] as const;
