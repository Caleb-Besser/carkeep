"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { unlockFinanceSettingsAction, type FinanceActionState } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SettingsUnlockForm() {
  const [state, action, pending] = useActionState(unlockFinanceSettingsAction, { status: "idle" } as FinanceActionState);
  return <form action={action} className="grid gap-4"><Input name="password" type="password" autoComplete="current-password" placeholder="Settings password" required />{state.message ? <p className="text-sm text-[color:var(--danger)]">{state.message}</p> : null}<Button disabled={pending}><LockKeyhole className="size-4" />{pending ? "Unlocking…" : "Unlock settings"}</Button></form>;
}

