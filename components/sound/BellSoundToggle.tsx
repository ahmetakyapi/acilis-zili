"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { playBellSound, readBellSound, subscribeBellSound, writeBellSound } from "./bell-sound";

/**
 * Zil Sesi anahtarı (24 Ekim) — Ayarlar'da ve hesap menüsünün tercihler
 * bölgesinde (misafir de görüyor; Ayarlar sayfası oturum istiyor).
 * Gerekçe ve kurallar `bell-sound.ts` başında.
 *
 * Görünüm Ayarlar'daki e-posta anahtarlarıyla aynı kalıp (onay kutusu +
 * başlık + ipucu); `compact` hesap menüsünün tercih satırı, ipucusuz.
 * Sunucu çiziminde hep KAPALI: tercih tarayıcıda, sunucu bilmiyor; ilk
 * istemci çiziminde gerçek değere geçiyor (`useSyncExternalStore`).
 */
export function BellSoundToggle({
  labels,
  compact = false,
  className,
}: {
  labels: { title: string; hint?: string };
  compact?: boolean;
  className?: string;
}) {
  const on = useSyncExternalStore(subscribeBellSound, readBellSound, () => false);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    writeBellSound(next);
    /* Açılış bir tıklama: bağlam burada kurulur ve örnek tını çalar. */
    if (next) playBellSound({ gesture: true, offset: false });
  };

  /* Hesap menüsünde satır öteki tercihlerin düzeninde: solda plaka
     etiket, sağda denetim (Tema, Dil). */
  if (compact) {
    return (
      <label className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 sm:min-h-8", className)}>
        <span className="plate text-nano">{labels.title}</span>
        <input type="checkbox" checked={on} onChange={onChange} className="size-4 shrink-0 accent-primary" />
      </label>
    );
  }

  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 sm:min-h-0", className)}>
      <input type="checkbox" checked={on} onChange={onChange} className="mt-0.5 size-4 shrink-0 accent-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-strong">{labels.title}</span>
        {labels.hint && <span className="text-small leading-relaxed text-muted">{labels.hint}</span>}
      </span>
    </label>
  );
}
