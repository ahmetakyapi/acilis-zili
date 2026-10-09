"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle, Key } from "@phosphor-icons/react";
import { changePasswordAction, type ChangePasswordState } from "@/app/actions/auth";
import { Button } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";

const FIELD =
  "h-10 rounded-(--radius-md) border border-line bg-page px-3 text-sm text-strong outline-none focus:border-line-focus aria-invalid:border-down";

/**
 * Şifre değiştirme — Ayarlar → Hesap. Hesap silmeyle aynı kalıp: ilk tık
 * formu açar, odak ilk alana gider, vazgeçince odak düğmeye döner;
 * gönder düğmesi `disabled` değil `aria-disabled` (odak kaybolmasın).
 * Başarıda form kapanıyor ve sonuç `role="status"` ile okunuyor.
 */
export function ChangePassword({ labels }: { labels: Dictionary["passwordChange"] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, { status: "idle" });
  /* Kaç kez kaydedildi — sıfırdan büyükse başarı mesajı görünüyor. */
  const [savedAt, setSavedAt] = useState(0);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") {
      setOpen(false);
      setSavedAt((n) => n + 1);
    }
  }
  useEffect(() => {
    if (savedAt) triggerRef.current?.focus();
  }, [savedAt]);

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() => {
            setSavedAt(0);
            setOpen(true);
          }}
        >
          <Key weight="duotone" size={15} />
          {labels.open}
        </Button>
        {savedAt > 0 && (
          <p role="status" className="flex items-start gap-2 text-small leading-relaxed text-body">
            <CheckCircle weight="fill" size={16} className="mt-0.5 shrink-0 text-up" />
            {labels.saved}
          </p>
        )}
      </div>
    );
  }

  const invalid = (field: ChangePasswordState["field"]) => (state.status === "error" && state.field === field) || undefined;

  return (
    <form action={action} className="step-in flex flex-col gap-3 rounded-(--radius-lg) border border-line bg-surface-sunken p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">{labels.current}</span>
        <input name="current" type="password" autoComplete="current-password" autoFocus required aria-invalid={invalid("current")} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">{labels.next}</span>
        <input name="next" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-invalid={invalid("next")} aria-describedby="password-hint" className={FIELD} />
        <span id="password-hint" className="text-tiny text-muted">{labels.hint}</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">{labels.confirm}</span>
        <input name="confirm" type="password" autoComplete="new-password" required aria-invalid={invalid("confirm")} className={FIELD} />
      </label>
      {state.status === "error" && state.error && (
        <p role="alert" className="text-small font-medium text-down">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          aria-disabled={pending}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className="aria-disabled:opacity-45"
        >
          {pending ? labels.saving : labels.submit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
