"use client";

import { useState, useTransition } from "react";
import { CheckCircle, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { resendEmailConfirmAction, setEmailPrefAction } from "@/app/actions/email-prefs";
import { Button } from "@/components/ui/primitives";
import type { EmailKind, EmailPrefsView } from "@/lib/email-notify";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Ayarlar → E-posta Bildirimleri (16 Ekim). İki anahtar: alarm postası ve
 * pazartesi özeti; ikisi de varsayılan kapalı. Açılan ilk anahtar adresi
 * onaysız bulursa sunucu onay bağlantısı gönderir ve satır "Onay bekleniyor"
 * der — onaylanmayan adrese hiçbir bildirim postası gitmez (lib/email-notify.ts).
 *
 * Anahtar iyimser döner, sunucu reddederse geri alınır; durum satırı
 * sunucunun döndürdüğü görünümle tazelenir (açmak "bekliyor"a geçirir).
 */
export function EmailSettings({
  email,
  initial,
  labels,
}: {
  email: string;
  initial: EmailPrefsView;
  labels: Dictionary["emailNotify"]["settings"];
}) {
  const [prefs, setPrefs] = useState(initial);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  function toggle(kind: EmailKind, next: boolean) {
    setFlash(null);
    const before = prefs;
    setPrefs({ ...prefs, [kind]: next });
    startSaving(async () => {
      const result = await setEmailPrefAction(kind, next).catch(() => ({ ok: false, prefs: null, error: "failed" as const }));
      if (!result.ok || !result.prefs) {
        setPrefs(before);
        setFlash({ kind: "error", text: result.error === "rate" ? labels.rateLimited : labels.failed });
        return;
      }
      setPrefs(result.prefs);
      setFlash({ kind: "ok", text: labels.saved });
    });
  }

  function resend() {
    setFlash(null);
    startSaving(async () => {
      const result = await resendEmailConfirmAction().catch(() => ({ ok: false, prefs: null, error: "failed" as const }));
      if (result.prefs) setPrefs(result.prefs);
      setFlash(
        result.ok
          ? { kind: "ok", text: labels.resent }
          : { kind: "error", text: result.error === "rate" ? labels.rateLimited : labels.failed },
      );
    });
  }

  const anyOn = prefs.alerts || prefs.weekly;
  const status = prefs.confirmed ? labels.confirmed : prefs.pending ? labels.pending : labels.unconfirmed;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small leading-relaxed text-body">{labels.hint}</p>

      {(
        [
          ["alerts", labels.alerts, labels.alertsHint],
          ["weekly", labels.weekly, labels.weeklyHint],
        ] as const
      ).map(([kind, title, hint], i) => (
        <label
          key={kind}
          className={cn(
            "flex min-h-11 cursor-pointer items-start gap-3 sm:min-h-0",
            i > 0 && "border-t border-line-soft pt-3",
          )}
        >
          <input
            type="checkbox"
            checked={prefs[kind]}
            disabled={saving}
            onChange={(event) => toggle(kind, event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-strong">{title}</span>
            <span className="text-small leading-relaxed text-muted">{hint}</span>
          </span>
        </label>
      ))}

      <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className="text-muted">{labels.address}</span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-body">
            <EnvelopeSimple weight="duotone" size={16} className="shrink-0 text-muted" />
            <span className="truncate">{email}</span>
          </span>
        </div>
        {anyOn && (
          <p className={cn("flex items-start gap-2 text-small leading-relaxed", prefs.confirmed ? "text-body" : "text-muted")}>
            {prefs.confirmed && <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" />}
            {status}
          </p>
        )}
        {anyOn && !prefs.confirmed && (
          <Button variant="ghost" size="sm" className="w-fit" disabled={saving} onClick={resend}>
            {labels.resend}
          </Button>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn("items-start gap-2 text-small leading-relaxed text-body", flash ? "flex" : "sr-only")}
      >
        {flash && (
          <>
            {flash.kind === "ok" ? (
              <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" />
            ) : (
              <WarningCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-down" />
            )}
            {flash.text}
          </>
        )}
      </p>
    </div>
  );
}
