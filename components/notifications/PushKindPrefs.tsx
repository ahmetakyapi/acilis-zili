"use client";

import { useState, useTransition } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { setPushPrefAction } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import type { PushKind, PushPrefs } from "@/lib/push-prefs-model";

/**
 * Ayarlar → Bildirimler → "Ne İçin Bildirim Gelsin" (11 Kasım). Gerekçe
 * lib/push-prefs-model.ts; yerleşimi PushSettings çağırır.
 *
 * HESAP genelinde (cihaz başına değil). Hesapta hiç abone cihaz yokken
 * anahtarlar KİLİTLİ basılır ve neden kilitli olduğu bir satırda yazar:
 * gizlemek "bu tercih var mı" sorusunu cevapsız bırakırdı, açık bırakmak
 * ise hiçbir yere gitmeyecek bir seçimi kaydettirirdi.
 *
 * Görsel dil: e-posta paneliyle (components/notifications/EmailSettings.tsx)
 * AYNI satır — onay kutusu, 14/600 başlık, altında açıklama, satırlar
 * arasında ince çizgi; panelde iki farklı anahtar dili olmasın.
 */
export function PushKindPrefs({
  prefs: initial,
  locked,
  labels,
  onError,
}: {
  prefs: PushPrefs;
  /** Hesapta abone cihaz yok — anahtarlar basılı ama kilitli. */
  locked: boolean;
  labels: Dictionary["pushPrefs"];
  /** Yazma düşünce panelin ortak canlı bölgesine mesaj. */
  onError: (text: string) => void;
}) {
  /* İyimser anahtar: tık anında döner, yazma düşerse geri sarar. */
  const [prefs, setPrefs] = useState(initial);
  const [saving, startSave] = useTransition();

  function toggle(kind: PushKind, next: boolean) {
    setPrefs((current) => ({ ...current, [kind]: next }));
    /* Fırlayan eylem de "düştü" sayılır — gerekçe PushSettings → toggleEarnings. */
    startSave(async () => {
      const result = await setPushPrefAction(kind, next).catch(() => ({ ok: false }));
      if (!result.ok) {
        setPrefs((current) => ({ ...current, [kind]: !next }));
        onError(labels.failed);
      }
    });
  }

  const rows: [PushKind, string, string][] = [
    ["price", labels.price, labels.priceHint],
    ["weekly", labels.weekly, labels.weeklyHint],
  ];

  return (
    <fieldset className="flex flex-col gap-3 border-t border-line-soft pt-3" disabled={locked || undefined}>
      <legend className="float-left mb-0.5 w-full text-sm font-bold text-strong">{labels.title}</legend>
      {locked && (
        <p className="flex items-start gap-2 text-small leading-relaxed text-body">
          <WarningCircle weight="duotone" size={16} className="mt-0.5 shrink-0 text-muted" />
          {labels.needsDevice}
        </p>
      )}
      {rows.map(([kind, title, hint], i) => (
        <label
          key={kind}
          className={cn(
            "flex min-h-11 items-start gap-3 sm:min-h-0",
            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            i > 0 && "border-t border-line-soft pt-3",
          )}
        >
          <input
            type="checkbox"
            checked={prefs[kind]}
            disabled={locked || saving}
            onChange={(event) => toggle(kind, event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-strong">{title}</span>
            <span className="text-small leading-relaxed text-muted">{hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
