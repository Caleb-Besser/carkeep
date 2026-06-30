import { DatabaseStateCard } from "@/components/app/database-state-card";
import { FinanceDashboard } from "@/components/app/finance-dashboard";
import { hasDatabaseUrl } from "@/lib/dashboard";
import { getFinanceDashboard } from "@/lib/finance-dashboard";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ month?: string }> };

export default async function FinancePage({ searchParams }: PageProps) {
  if (!hasDatabaseUrl()) return <DatabaseStateCard title="Connect a Postgres database" description="Add DATABASE_URL, apply the Prisma migration, and reload the dashboard." />;
  let data;
  try {
    const params = await searchParams;
    data = await getFinanceDashboard(params?.month);
  } catch (error) {
    return <DatabaseStateCard title="Finance dashboard unavailable" description={error instanceof Error ? error.message : "The dashboard could not be loaded."} />;
  }
  return <FinanceDashboard data={data} />;
}
