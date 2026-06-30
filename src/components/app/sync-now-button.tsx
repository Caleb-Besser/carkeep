"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { syncSimpleFinAction, type FinanceActionState } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";

export function SyncNowButton({ connected }: { connected: boolean }) {
  const [state, action, pending] = useActionState(syncSimpleFinAction, { status: "idle" } as FinanceActionState);
  if (!connected) return null;
  return <form action={action} className="relative"><Button variant="secondary" disabled={pending} title={state.message}><RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />{pending ? "Syncing…" : "Sync now"}</Button>{state.status === "error" ? <span className="absolute right-0 top-12 z-20 w-64 rounded-xl border bg-[color:var(--card)] p-2 text-xs text-[color:var(--danger)] shadow-lg">{state.message}</span> : null}</form>;
}

