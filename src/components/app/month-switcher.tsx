import Link from "next/link";
import { addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonthKey } from "@/lib/finance";

type MonthSwitcherProps = {
  month: Date;
  categoryId?: string | null;
  budgetHalf?: "1" | "2";
};

function buildMonthHref(monthKey: string, categoryId?: string | null, budgetHalf?: "1" | "2") {
  const params = new URLSearchParams({ month: monthKey });
  if (categoryId) {
    params.set("categoryId", categoryId);
  }
  if (budgetHalf) {
    params.set("half", budgetHalf);
  }

  return `/finance?${params.toString()}`;
}

export function MonthSwitcher({ month, categoryId, budgetHalf }: MonthSwitcherProps) {
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="icon" variant="outline">
        <Link href={buildMonthHref(getMonthKey(previousMonth), categoryId, budgetHalf)}>
          <ChevronLeft className="size-5" />
          <span className="sr-only">Previous month</span>
        </Link>
      </Button>
      <Button asChild size="icon" variant="outline">
        <Link href={buildMonthHref(getMonthKey(nextMonth), categoryId, budgetHalf)}>
          <ChevronRight className="size-5" />
          <span className="sr-only">Next month</span>
        </Link>
      </Button>
    </div>
  );
}
