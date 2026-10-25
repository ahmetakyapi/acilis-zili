"use client";

import { useActionState } from "react";
import { grantRiskAccess, type RiskAccessState } from "@/app/admin/uyeler/risk-actions";
import { adminInput } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** Risk Masası erişimini kullanıcı adıyla açar (25 Ekim). Kapatma listedeki düz formda. */
export function RiskAccessForm() {
  const [state, action, pending] = useActionState<RiskAccessState, FormData>(grantRiskAccess, { ok: false, message: "" });
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 max-w-md flex-1 flex-col gap-1 text-small font-semibold text-muted">
          Kullanıcı Adı
          <input name="username" required minLength={2} maxLength={40} autoComplete="off" className={cn(adminInput, "h-11 w-full")} />
        </label>
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Erişimi Aç"}
        </Button>
      </div>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className="text-sm text-body">
          {state.message}
        </p>
      )}
    </form>
  );
}
