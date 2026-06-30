import { Database, Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DatabaseStateCardProps = {
  title: string;
  description: string;
};

export function DatabaseStateCard({ title, description }: DatabaseStateCardProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader className="gap-4">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)]">
            <Database className="size-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <CardDescription className="max-w-2xl text-base">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] bg-[color:var(--muted)] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              Local setup
            </p>
            <ol className="mt-3 space-y-2 text-sm text-[color:var(--foreground)]">
              <li>1. Copy `.env.example` to `.env`.</li>
              <li>2. Point `DATABASE_URL` at Postgres.</li>
              <li>3. Run `npm run db:push` and `npm run db:seed`.</li>
              <li>4. Start the app with `npm run dev`.</li>
            </ol>
          </div>
          <div className="rounded-[28px] bg-[color:var(--card-muted)] p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-[color:var(--primary-foreground)]">
                <Rocket className="size-5" />
              </div>
              <p className="font-semibold">Vercel ready</p>
            </div>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              Add the same `DATABASE_URL` in Vercel project settings. The app uses server actions,
              Prisma, and a dynamic dashboard route so it deploys cleanly without build-time database queries.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
