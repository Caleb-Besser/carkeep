import { redirect } from "next/navigation";

type ReportRedirectPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function ReportRedirectPage({ searchParams }: ReportRedirectPageProps) {
  const params = await searchParams;
  const nextSearchParams = new URLSearchParams();

  if (params?.month) {
    nextSearchParams.set("month", params.month);
  }

  redirect(`/finance/report${nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : ""}`);
}
