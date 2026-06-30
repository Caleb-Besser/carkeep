"use client";

import Link from "next/link";
import { endOfMonth, format, setDate } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CalendarDays, Check, CircleDollarSign, CreditCard, Landmark, PiggyBank, Settings2, WalletCards } from "lucide-react";
import { useState } from "react";
import { categorizeTransactionAction } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/finance";
import type { getFinanceDashboard } from "@/lib/finance-dashboard";
import type { AwaitedReturn } from "@/lib/types";
import { CategoryIcon } from "./category-icon";
import { MonthSwitcher } from "./month-switcher";
import { SyncNowButton } from "./sync-now-button";

type Dashboard = AwaitedReturn<typeof getFinanceDashboard>;
type Category = Dashboard["categories"][number];
type RecurringCadence = "MONTHLY" | "WEEKLY" | "YEARLY";

const chartColors = ["#7c3aed", "#f59e0b", "#3b82f6", "#34d399", "#f472b6", "#2dd4bf", "#8b5cf6"];

export function FinanceDashboard({ data }: { data: Dashboard }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const unpaidTotal = data.recurringPayments.filter((item) => !item.paid).reduce((sum, item) => sum + item.amountCents, 0);
  const categoryMonthSpent = data.categories.reduce((sum, category) => sum + category.spentCents, 0);
  const totalBudget = data.categories.reduce((sum, category) => sum + category.budgetCents, 0);
  const totalPaycheckBudget = data.categories.reduce((sum, category) => sum + category.paycheckBudgetCents, 0);
  const totalPaycheckSpent = data.categories.reduce((sum, category) => sum + category.paycheckSpentCents, 0);
  const totalPaycheckLeft = totalPaycheckBudget - totalPaycheckSpent;
  const savings = accountTotal(data.accounts, ["SAVINGS"]);
  const checking = accountTotal(data.accounts, ["CHECKING", "CASH"], true);
  const creditCard = accountTotal(data.accounts, ["CREDIT_CARD"]);
  const selectedCategory = data.categories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedCategoryIndex = selectedCategory
    ? data.categories.findIndex((category) => category.id === selectedCategory.id)
    : -1;
  const selectedCategoryColor =
    selectedCategory?.color ?? chartColors[Math.max(selectedCategoryIndex, 0) % chartColors.length];
  const selectedCategoryTotal = selectedCategory
    ? selectedCategory.transactions.reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0)
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-[1880px] flex-col gap-2.5 px-4 py-3 sm:px-5 lg:px-7">
      <header className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[clamp(1.9rem,2.5vw,2.45rem)] font-semibold leading-none tracking-normal">{data.monthLabel}</h1>
          <MonthSwitcher month={data.month} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="hidden text-xs text-[color:var(--muted-foreground)] md:inline">{data.connection?.lastSuccessfulSyncAt ? `Synced ${data.connection.lastSuccessfulSyncAt.toLocaleString()}` : "SimpleFIN not synced"}</span>
          <SyncNowButton connected={Boolean(data.connection)} />
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/finance/settings"><Settings2 className="size-4" />Settings</Link>
          </Button>
        </div>
      </header>

      <section className="dashboard-panel overflow-hidden">
        <PanelTitle icon={CircleDollarSign} title="Categories" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed text-sm">
            <thead className="border-y bg-[color:var(--card-muted)]/55 text-left text-xs text-[color:var(--muted-foreground)]">
              <tr>
                <th className="w-[21%] px-6 py-3 font-medium text-[color:var(--foreground)]">Category</th>
                <th className="w-[12%] px-2 py-3 font-medium">Spent</th>
                <th className="w-[11%] px-2 py-3 font-medium">Budget</th>
                {selectedCategory ? (
                  <th className="w-[56%] border-l border-dashed px-5 py-2 font-medium" colSpan={4}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[color:var(--foreground)]">
                        <CategoryIcon icon={selectedCategory.icon} color={selectedCategoryColor} className="size-7 shrink-0 rounded-md [&_svg]:size-3.5" />
                        <span className="truncate">{selectedCategory.isUncategorized ? "Choose categories" : `${displayCategory(selectedCategory.name)} transactions`}</span>
                        <span className="shrink-0 font-mono text-sm">{formatCurrency(selectedCategoryTotal)}</span>
                      </span>
                      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setSelectedCategoryId(null)}>
                        <ArrowLeft className="size-4" />
                        Back
                      </Button>
                    </div>
                  </th>
                ) : (
                  <>
                    <th className="w-[15%] border-l border-dashed px-5 py-3 font-medium">Spent</th>
                    <th className="w-[14%] px-2 py-3 font-medium">Paycheck Budget</th>
                    <th className="w-[10%] px-2 py-3 font-medium">Remaining</th>
                    <th className="w-[17%] px-2 py-3 font-medium">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.categories.map((category, index) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  color={chartColors[index % chartColors.length]}
                  onSelect={() => setSelectedCategoryId(category.id)}
                  transactionPane={index === 0 && selectedCategory ? (
                    <CategoryTransactionPane
                      category={selectedCategory}
                      categoryOptions={data.categoryOptions}
                      rowSpan={data.categories.length + 1}
                    />
                  ) : null}
                  showPaycheckColumns={!selectedCategory}
                />
              ))}
              <tr className="bg-[color:var(--card-muted)]/35 text-sm font-semibold">
                <td className="px-6 py-3 uppercase">Total</td>
                <td className="px-2 py-3 font-mono">{formatCurrency(categoryMonthSpent)} <span className={percentTone(categoryMonthSpent, totalBudget)}>{percent(categoryMonthSpent, totalBudget)}%</span></td>
                <td className="px-2 py-3 font-mono">{formatCurrency(totalBudget)}</td>
                {!selectedCategory ? (
                  <>
                    <td className="border-l border-dashed px-5 py-3 font-mono">{formatCurrency(totalPaycheckSpent)} <span className={percentTone(totalPaycheckSpent, totalPaycheckBudget)}>{percent(totalPaycheckSpent, totalPaycheckBudget)}%</span></td>
                    <td className="px-2 py-3 font-mono">{formatCurrency(totalPaycheckBudget)}</td>
                    <td className={totalPaycheckLeft < 0 ? "px-2 py-3 font-mono text-[color:var(--danger)]" : "px-2 py-3 font-mono text-[color:var(--success)]"}>{formatCurrency(totalPaycheckLeft)}</td>
                    <td className="px-2 py-3" />
                  </>
                ) : null}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel overflow-hidden">
        <PanelTitle icon={WalletCards} title="Account Balances" />
        <div className="grid gap-3 p-3 lg:grid-cols-3">
          <BalanceCard icon={PiggyBank} label="Savings" amount={savings} detail="Available" tone="success" trend="savings" />
          <BalanceCard icon={Landmark} label="Checking" amount={checking} detail="Available" tone="cyan" trend="checking" />
          <BalanceCard icon={CreditCard} label="Credit Card" amount={-Math.abs(creditCard)} detail="Balance" secondary={`${formatCurrency(data.discoverAvailableCreditCents)} available credit`} tone="violet" trend="flat" />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <section className="dashboard-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <PanelTitleBare icon={CalendarDays} title="Recurring Payments" />
            <div className="text-right text-sm"><span className="text-[color:var(--muted-foreground)]">Unpaid</span><span className="ml-3 font-mono font-semibold text-[color:var(--danger)]">{formatCurrency(unpaidTotal)}</span></div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-full table-fixed text-sm">
              <thead className="border-b bg-[color:var(--card-muted)]/45 text-left text-xs text-[color:var(--muted-foreground)]">
                <tr><th className="w-[34%] px-5 py-2 font-medium">Item</th><th className="w-[18%] px-2 py-2 font-medium">Type</th><th className="w-[16%] px-2 py-2 font-medium">Amount</th><th className="w-[17%] px-2 py-2 font-medium">Due</th><th className="w-[15%] px-2 py-2 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {data.recurringPayments.map((item) => <RecurringRow key={item.key} item={item} month={data.month} />)}
                {!data.recurringPayments.length ? <tr><td className="px-5 py-8 text-center text-[color:var(--muted-foreground)]" colSpan={5}>No recurring payments configured.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <PanelTitleBare icon={CircleDollarSign} title="Spending Breakdown" />
            <span className="text-xs text-[color:var(--muted-foreground)]">Month</span>
          </div>
          <div className="grid items-center gap-6 p-6 md:grid-cols-[330px_minmax(0,1fr)]">
            <DonutChart categories={data.categories} total={categoryMonthSpent} />
            <BreakdownLegend categories={data.categories} total={categoryMonthSpent} />
          </div>
        </section>
      </section>
    </main>
  );
}

function PanelTitle({ icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="border-b px-5 py-3"><PanelTitleBare icon={icon} title={title} /></div>;
}

function PanelTitleBare({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-normal"><Icon className="size-4 text-[color:var(--success)]" />{title}</h2>;
}

function CategoryRow({ category, color, onSelect, transactionPane, showPaycheckColumns }: { category: Category; color: string; onSelect: () => void; transactionPane: React.ReactNode; showPaycheckColumns: boolean }) {
  const over = category.paycheckLeftCents < 0 || category.leftCents < 0;
  const tone = statusTone(category.status);
  return (
    <tr className="border-b transition-colors hover:bg-[color:var(--card-muted)]/30 last:border-b-0">
      <td className="px-6 py-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 items-center gap-3 text-left hover:text-[color:var(--success)]">
          <CategoryIcon icon={category.icon} color={category.color ?? color} className="size-8 shrink-0 rounded-md [&_svg]:size-4" />
          <strong className="truncate font-medium">{displayCategory(category.name)}</strong>
        </button>
      </td>
      <td className="px-2 py-2 font-mono">{formatCurrency(category.spentCents)} <span className={percentTone(category.spentCents, category.budgetCents)}>{category.percent}%</span></td>
      <td className="px-2 py-2 font-mono">{formatCurrency(category.budgetCents)}</td>
      {showPaycheckColumns && category.isUncategorized ? (
        <td className="border-l border-dashed px-5 py-2 text-sm text-[color:var(--muted-foreground)]" colSpan={4}>
          <button type="button" onClick={onSelect} className="text-left hover:text-[color:var(--success)]">
            {category.transactions.length
              ? `${category.transactions.length} transaction${category.transactions.length === 1 ? "" : "s"} to categorize`
              : "No uncategorized transactions"}
          </button>
        </td>
      ) : showPaycheckColumns ? (
        <>
          <td className="border-l border-dashed px-5 py-2 font-mono">{formatCurrency(category.paycheckSpentCents)} <span className={percentTone(category.paycheckSpentCents, category.paycheckBudgetCents)}>{category.paycheckPercent}%</span></td>
          <td className="px-2 py-2">
            <span className="block font-mono">{formatCurrency(category.paycheckBudgetCents)}</span>
            {category.paycheckCarryoverCents !== 0 ? (
              <span className={`block text-xs ${category.paycheckCarryoverCents > 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>
                {formatSignedCurrency(category.paycheckCarryoverCents)}
              </span>
            ) : null}
          </td>
          <td className={over ? "px-2 py-2 font-mono text-[color:var(--danger)]" : "px-2 py-2 font-mono text-[color:var(--success)]"}>{formatCurrency(category.paycheckLeftCents)}</td>
          <td className="px-2 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`w-10 shrink-0 text-right font-mono ${tone.text}`}>{category.paycheckPercent}%</span>
              <Progress value={Math.min(category.paycheckPercent, 100)} className="h-1.5 min-w-16" indicatorClassName={tone.bar} />
              <span className={`hidden shrink-0 rounded px-2 py-1 text-xs font-medium min-[1400px]:inline ${tone.badge}`}>{category.status}</span>
            </div>
          </td>
        </>
      ) : (
        transactionPane
      )}
    </tr>
  );
}

function CategoryTransactionPane({ category, categoryOptions, rowSpan }: { category: Category; categoryOptions: Dashboard["categoryOptions"]; rowSpan: number }) {
  return (
    <td className="border-l border-dashed p-0 align-top" colSpan={4} rowSpan={rowSpan}>
      <div className="h-[360px] overflow-hidden">
        <div className="h-full overflow-y-auto [scrollbar-color:var(--muted)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--muted)] [&::-webkit-scrollbar-track]:bg-transparent">
          {category.transactions.length ? (
            category.transactions.map((transaction) => (
              <TransactionCategoryForm key={`${transaction.id}-${transaction.categoryId ?? "uncategorized"}-${transaction.recurringFrequency ?? "once"}`} transaction={transaction} categoryOptions={categoryOptions} />
            ))
          ) : (
            <div className="grid min-h-48 place-items-center px-5 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
              <div className="min-w-0">
                <p className="font-medium text-[color:var(--foreground)]">No transactions yet</p>
                <p className="mt-1">Nothing in this category for the selected month.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </td>
  );
}

function TransactionCategoryForm({ transaction, categoryOptions }: { transaction: Category["transactions"][number]; categoryOptions: Dashboard["categoryOptions"] }) {
  const isRefund = transaction.amountCents > 0 || transaction.transactionKind === "REFUND";
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? "");
  const initialRecurringFrequency: RecurringCadence =
    transaction.recurringFrequency === "WEEKLY" || transaction.recurringFrequency === "YEARLY" ? transaction.recurringFrequency : "MONTHLY";
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringCadence>(initialRecurringFrequency);
  const isRecurringCategory = categoryOptions.some((option) => option.id === categoryId && option.isRecurring);
  const initialCategoryId = transaction.categoryId ?? "";
  const isDirty = categoryId !== initialCategoryId || (isRecurringCategory && recurringFrequency !== initialRecurringFrequency);

  return (
    <form action={categorizeTransactionAction} className="grid grid-cols-[minmax(0,1fr)_56px_78px_62px] items-center gap-x-2 gap-y-2 border-b px-5 py-2.5 last:border-b-0">
      <input type="hidden" name="transactionId" value={transaction.id} />
      <input type="hidden" name="transactionKind" value={isRefund ? "REFUND" : "EXPENSE"} />
      {!isRefund && isRecurringCategory ? <input type="hidden" name="markRecurring" value="on" /> : null}
      <div className="min-w-0">
        <p className="truncate font-medium">{transaction.merchantName || transaction.description}</p>
        <p className="truncate text-xs text-[color:var(--muted-foreground)]">{transaction.accountName}</p>
      </div>
      <span className="font-mono text-xs text-[color:var(--muted-foreground)]">{format(new Date(transaction.postedAt), "MMM d")}</span>
      <span className={isRefund ? "text-right font-mono text-[color:var(--success)]" : "text-right font-mono"}>{formatCurrency(Math.abs(transaction.amountCents))}</span>
      {isDirty ? <Button size="sm" className="h-9">Save</Button> : <span aria-hidden="true" />}
      <div className="col-span-3 grid min-w-0 grid-cols-[minmax(150px,220px)_minmax(130px,170px)] gap-2">
      <Select name="categoryId" value={categoryId} onValueChange={setCategoryId} required>
        <SelectTrigger className="h-9 rounded-lg px-3 text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categoryOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>{option.isRecurring ? "Recurring" : displayCategory(option.name)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="min-w-0">
        {!isRefund && isRecurringCategory ? (
          <Select name="recurringFrequency" value={recurringFrequency} onValueChange={(value) => setRecurringFrequency(value as RecurringCadence)}>
            <SelectTrigger className="h-9 rounded-lg px-3 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      </div>
      <span aria-hidden="true" />
    </form>
  );
}

function BalanceCard({ icon: Icon, label, amount, detail, secondary, tone, trend }: { icon: LucideIcon; label: string; amount: number; detail: string; secondary?: string; tone: "success" | "cyan" | "violet"; trend: "savings" | "checking" | "flat" }) {
  const toneClass = tone === "success" ? "text-[color:var(--success)] bg-[color:var(--success-soft)]" : tone === "cyan" ? "text-cyan-400 bg-cyan-400/12" : "text-violet-300 bg-violet-400/16";
  const valueClass = amount < 0 ? "text-[color:var(--danger)]" : tone === "cyan" ? "text-cyan-400" : "text-[color:var(--success)]";
  return (
    <div className="grid min-h-28 grid-cols-[auto_minmax(0,1fr)_120px] items-center gap-4 rounded-xl border bg-[color:var(--card-muted)]/35 px-5 py-4">
      <span className={`grid size-14 place-items-center rounded-xl ${toneClass}`}><Icon className="size-7" /></span>
      <div className="min-w-0">
        <p className={`text-xs font-semibold uppercase ${tone === "violet" ? "text-violet-300" : tone === "cyan" ? "text-cyan-400" : "text-[color:var(--success)]"}`}>{label}</p>
        <p className={`truncate font-mono text-2xl font-semibold ${valueClass}`}>{formatCurrency(amount)}</p>
        <p className="text-xs text-[color:var(--muted-foreground)]">{detail}</p>
      </div>
      {secondary ? <p className="text-right text-xs text-[color:var(--muted-foreground)]"><b className="block font-mono text-sm text-[color:var(--foreground)]">{secondary.split(" ")[0]}</b>{secondary.replace(secondary.split(" ")[0], "").trim()}</p> : <Sparkline tone={tone} trend={trend} />}
    </div>
  );
}

function Sparkline({ tone, trend }: { tone: "success" | "cyan" | "violet"; trend: "savings" | "checking" | "flat" }) {
  const color = tone === "cyan" ? "#22d3ee" : tone === "violet" ? "#a78bfa" : "#55d6a8";
  const points = trend === "checking" ? "2,36 18,32 28,27 43,25 58,18 72,15 84,28 100,10 111,18 124,8" : trend === "savings" ? "2,39 18,31 30,33 43,26 56,29 70,16 82,22 96,12 109,6 124,0" : "0,26 124,26";
  return <svg viewBox="0 0 126 42" className="h-14 w-full" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function RecurringRow({ item, month }: { item: Dashboard["recurringPayments"][number]; month: Date }) {
  const dueDate = item.nextDueDate ? format(item.nextDueDate, "MMM d, yyyy") : item.dueDay ? format(setDate(month, Math.min(item.dueDay, endOfMonth(month).getDate())), "MMM d, yyyy") : "No date";
  const cadence = item.frequency === "YEARLY" ? "Yearly" : item.frequency === "WEEKLY" ? "Weekly" : "Monthly";
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-5 py-2 font-medium">{item.name}</td>
      <td className="px-2 py-2 text-xs text-[color:var(--muted-foreground)]"><span className="block truncate">{item.paymentType}</span><span className="block font-medium text-[color:var(--foreground)]">{cadence}</span></td>
      <td className="px-2 py-2 font-mono">{formatCurrency(item.amountCents)}</td>
      <td className="px-2 py-2 font-mono text-[color:var(--muted-foreground)]">{dueDate}</td>
      <td className="px-2 py-2"><span className={item.paid ? "inline-flex items-center gap-1 rounded-md bg-[color:var(--success-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--success)]" : "inline-flex rounded-md bg-[color:var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)]"}>{item.paid ? <>Paid <Check className="size-3" /></> : "Unpaid"}</span></td>
    </tr>
  );
}

function DonutChart({ categories, total }: { categories: Category[]; total: number }) {
  const segments = categories.filter((category) => category.spentCents > 0);
  let cursor = 0;
  const gradient = segments.length ? segments.map((category, index) => {
    const start = cursor;
    const size = total > 0 ? category.spentCents / total * 100 : 0;
    cursor += size;
    const color = category.color ?? chartColors[index % chartColors.length];
    return `${color} ${start}% ${cursor}%`;
  }).join(", ") : "var(--muted) 0 100%";
  return (
    <div className="mx-auto grid aspect-square w-full max-w-[300px] place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
      <div className="grid size-[54%] place-items-center rounded-full bg-[color:var(--card)] text-center shadow-[inset_0_0_24px_rgba(0,0,0,0.42)]">
        <div><p className="text-xs uppercase text-[color:var(--muted-foreground)]">Spent</p><p className="mt-2 font-mono text-2xl">{formatCurrency(total)}</p><p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Month</p></div>
      </div>
    </div>
  );
}

function BreakdownLegend({ categories, total }: { categories: Category[]; total: number }) {
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_110px_80px] gap-3 pb-2 text-xs text-[color:var(--muted-foreground)]"><span /> <span className="text-right">Spent</span><span className="text-right">% of Total</span></div>
      {categories.map((category, index) => <div key={category.id} className="grid grid-cols-[minmax(0,1fr)_110px_80px] items-center gap-3 py-1 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: category.color ?? chartColors[index % chartColors.length] }} /><span className="truncate">{displayCategory(category.name)}</span></span><span className="text-right font-mono">{formatCurrency(category.spentCents)}</span><span className="text-right font-mono">{percent(category.spentCents, total)}%</span></div>)}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_110px_80px] gap-3 border-t pt-3 text-sm"><strong>Total</strong><span className="text-right font-mono">{formatCurrency(total)}</span><span className="text-right font-mono">100%</span></div>
    </div>
  );
}

function accountTotal(accounts: Dashboard["accounts"], types: string[], available = false) {
  return accounts.filter((account) => types.includes(account.accountType)).reduce((sum, account) => sum + (available ? account.availableBalanceCents ?? account.currentBalanceCents : account.currentBalanceCents), 0);
}

function percent(amount: number, total: number) {
  return total > 0 ? Math.round(amount / total * 100) : 0;
}

function percentTone(amount: number, total: number) {
  return amount > total ? "ml-3 text-[color:var(--danger)]" : amount >= total * 0.9 ? "ml-3 text-[color:var(--warning)]" : "ml-3 text-[color:var(--success)]";
}

function formatSignedCurrency(cents: number) {
  return cents > 0 ? `+${formatCurrency(cents)}` : formatCurrency(cents);
}

function statusTone(status: string) {
  if (status === "Over budget") return { text: "text-[color:var(--danger)]", bar: "bg-[color:var(--danger)]", badge: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]" };
  if (status === "Near limit" || status === "Watch it" || status === "Needs review") return { text: "text-[color:var(--warning)]", bar: "bg-[color:var(--warning)]", badge: "bg-[color:var(--warning-soft)] text-[color:var(--warning)]" };
  return { text: "text-[color:var(--success)]", bar: "bg-[color:var(--success)]", badge: "bg-[color:var(--success-soft)] text-[color:var(--success)]" };
}

function displayCategory(name: string) {
  if (name === "Shopping") return "General Shopping";
  return name;
}
