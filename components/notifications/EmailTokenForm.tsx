"use client";

import { useActionState } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { buttonClass } from "@/components/ui/primitives";
import type { TokenState } from "@/app/actions/email-prefs";

/**
 * Onay ve çıkış sayfalarının tek düğmesi (16 Ekim). Bağlantıyı AÇMAK bir
 * şey değiştirmez, düğmeye BASMAK değiştirir: postadaki bağlantıları
 * önceden açan güvenlik tarayıcıları kimsenin adına onay vermesin ya da
 * aboneliğini kapatmasın. Sonuç aynı panelde, sayfa yenilenmeden basılır.
 */
export function EmailTokenForm({
  action,
  hidden,
  labels,
}: {
  action: (prev: TokenState, formData: FormData) => Promise<TokenState>;
  hidden: Record<string, string>;
  labels: { lead: string; button: string; doneTitle: string; done: string; invalid: string; toSettings: string };
}) {
  const [state, submit, pending] = useActionState(action, { done: false, ok: false });

  if (state.done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        {state.ok ? (
          <>
            <p className="text-base font-semibold text-strong">{labels.doneTitle}</p>
            <p className="text-base leading-relaxed text-body">{labels.done}</p>
          </>
        ) : (
          <p className="text-base leading-relaxed text-body">{labels.invalid}</p>
        )}
        <Link href="/ayarlar#e-posta" className={buttonClass({ variant: "ghost", className: "w-fit" })}>
          {labels.toSettings}
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="text-base leading-relaxed text-body">{labels.lead}</p>
      <button type="submit" disabled={pending} className={buttonClass({ className: "w-fit" })}>
        {labels.button}
      </button>
    </form>
  );
}
