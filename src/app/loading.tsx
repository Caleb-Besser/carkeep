import Image from "next/image";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-8">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex size-34 items-center justify-center rounded-[32px] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
          <Image
            src="/finance_logo.png"
            alt="Finance Tracker logo"
            width={120}
            height={120}
            className="h-26 w-26 animate-pulse object-contain"
            preload
          />
        </div>
        <div className="space-y-2 text-center">
          <p className="text-4xl font-semibold tracking-tight sm:text-5xl">Finance Tracker</p>
          <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
            Opening dashboard
          </p>
        </div>
      </div>
    </main>
  );
}
