"use client";

import { useActionState, useState } from "react";
import { Trash, Warning } from "@phosphor-icons/react/dist/ssr";
import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/primitives";

/**
 * Hesap silme — iki aşamalı.
 *
 * İlk tık formu açar, silmez. Silmek için kullanıcı adının yazılması ve
 * şifrenin girilmesi gerekiyor: geri alınamayan bir işlemin tek dokunuşluk
 * olması kabul edilebilir değil. Sunucu tarafı da aynı iki koşulu bağımsız
 * olarak doğruluyor; buradaki kontrol yalnızca kullanıcıya erken geri
 * bildirim veriyor.
 */

export type DeleteAccountLabels = {
  hint: string;
  open: string;
  confirmLabel: string;
  confirmHint: string;
  passwordLabel: string;
  submit: string;
  cancel: string;
  warning: string;
};

export function DeleteAccount({
  username,
  labels,
}: {
  username: string;
  labels: DeleteAccountLabels;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccountAction, {});

  if (!open) {
    return (
      /* BAŞLIK VE AYRAÇ ARTIK BURADA DEĞİL. Bileşen bir dönem hesap
         panelinin içinde, "Çıkış Yap"ın altında duruyordu ve kendi
         başlığını, kendi üst ayracını basıyordu. Şimdi kendi panelinde ve
         panelin başlığı zaten adını söylüyor — ikinci bir başlık aynı şeyi
         iki kez yazmak olurdu.
         Düğme de `sm` değil: geri alınamayan eylem, geri alınabilir olandan
         daha küçük bir hedef taşımamalı. */
      <div className="flex flex-col gap-2">
        <p className="text-small leading-relaxed text-muted">{labels.hint}</p>
        <Button
          type="button"
          variant="danger"
          className="mt-1 w-fit"
          onClick={() => setOpen(true)}
        >
          <Trash weight="duotone" size={15} />
          {labels.open}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-(--radius-lg) border border-down/40 bg-down-wash p-4"
    >
      <p className="flex items-start gap-2 text-small leading-relaxed text-strong">
        <Warning weight="fill" size={16} className="mt-px shrink-0 text-down" />
        {labels.warning}
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">
          {labels.confirmLabel}
        </span>
        <span className="text-tiny text-muted">
          {labels.confirmHint}{" "}
          <code className="numeral rounded-xs bg-surface-elevated px-1 py-0.5 font-bold text-strong">
            {username}
          </code>
        </span>
        <input
          name="confirm"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-10 rounded-(--radius-md) border border-line bg-page px-3 text-sm text-strong outline-none focus:border-line-focus"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-body">
          {labels.passwordLabel}
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 rounded-(--radius-md) border border-line bg-page px-3 text-sm text-strong outline-none focus:border-line-focus"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-small font-medium text-down">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          /* text-page: sayfa zemini iki temada da --down'un zıddı — açıkta
             beyaza, koyuda lacivere düşüyor ve ikisinde de okunuyor.
             Sabit beyaz, koyu temanın açık kırmızısında AA'nın altına
             iniyordu. */
          className="bg-down text-page hover:bg-down/85"
        >
          <Trash weight="duotone" size={15} />
          {labels.submit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
