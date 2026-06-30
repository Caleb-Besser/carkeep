"use client";

import { useActionState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { connectSimpleFinAction, syncSimpleFinAction, type FinanceActionState } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const initialState: FinanceActionState = { status: "idle" };

export function SimpleFinConnectionForm({ connected }: { connected: boolean }) {
  const [connectState, connectAction, connecting] = useActionState(connectSimpleFinAction, initialState);
  const [syncState, syncAction, syncing] = useActionState(syncSimpleFinAction, initialState);
  return (
    <div className="grid gap-5">
      <form action={connectAction} className="grid gap-3">
        <label className="text-sm font-medium" htmlFor="setupToken">One-time setup token</label>
        <Textarea id="setupToken" name="setupToken" rows={4} autoComplete="off" spellCheck={false} placeholder="Paste the token from SimpleFIN Bridge" required />
        <p className="text-xs text-[color:var(--muted-foreground)]">The token is posted only to the server, claimed once, and replaced by an encrypted access credential.</p>
        {connectState.message ? <p className={connectState.status === "error" ? "text-sm text-[color:var(--danger)]" : "text-sm text-[color:var(--success)]"}>{connectState.message}</p> : null}
        <Button type="submit" disabled={connecting}><ShieldCheck className="size-4" />{connecting ? "Connecting…" : connected ? "Replace connection" : "Connect SimpleFIN"}</Button>
      </form>
      {connected ? (
        <form action={syncAction}>
          <Button type="submit" variant="secondary" disabled={syncing}><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing…" : "Sync now"}</Button>
          {syncState.message ? <p className={syncState.status === "error" ? "mt-2 text-sm text-[color:var(--danger)]" : "mt-2 text-sm text-[color:var(--success)]"}>{syncState.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

