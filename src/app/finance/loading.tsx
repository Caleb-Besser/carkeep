import Image from "next/image";

export default function FinanceLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6 sm:px-5 lg:px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative flex size-28 items-center justify-center rounded-[30px] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_30px_90px_rgba(0,0,0,0.3)]">
          <Image
            src="/finance_logo.png"
            alt="Finance Tracker logo"
            width={110}
            height={110}
            className="h-22 w-22 animate-pulse object-contain"
            preload
          />
        </div>
        <div className="space-y-2">
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">Finance Tracker</p>
          <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Opening app
          </p>
        </div>
      </div>
    </main>
  );
}
