"use client";
import { useActionState, useState } from "react";
import { setAnalysisAccess } from "@/app/admin/ai/actions";
import { Button } from "@/components/ui/primitives";
import styles from "./Analysis.module.css";

export function AnalysisAccessForm({ userId, username, enabled, dailyLimit, remaining, owner }: {
  userId: string; username: string; enabled: boolean; dailyLimit: number | null;
  remaining: number | null; owner: boolean;
}) {
  const [state, action, pending] = useActionState(setAnalysisAccess, { ok: false, message: "" });
  const [active, setActive] = useState(enabled);
  const [unlimited, setUnlimited] = useState(owner || dailyLimit === null);
  const [limit, setLimit] = useState(dailyLimit ?? 5);
  return <form action={action} className="flex flex-col gap-3 border-t border-[var(--line)] py-5">
    <input type="hidden" name="userId" value={userId} />
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="min-w-40"><strong className="text-strong">{username}</strong><p className="mt-1 text-xs text-muted">{owner ? "Sahip · Sınırsız" : enabled ? `Kalan: ${remaining ?? "Sınırsız"}` : "Erişim Kapalı"}</p></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="enabled" checked={active} onChange={e => setActive(e.target.checked)} disabled={pending} /> Erişim Açık</label>
      <label className="flex items-center gap-3 text-sm">Günlük Kota<input aria-label={`${username} günlük kota`} type="number" name="dailyLimit" min={1} max={1000} value={limit} onChange={e => setLimit(Number(e.target.value))} disabled={pending || unlimited} className={`${styles.input} w-24`} /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="unlimited" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} disabled={pending || owner} /> Sınırsız</label>
      {unlimited && <input type="hidden" name="unlimited" value="on" />}
      <Button size="sm" type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</Button>
    </div>
    {state.message && <p role={state.ok ? "status" : "alert"} className="text-sm text-body">{state.message}</p>}
  </form>;
}
