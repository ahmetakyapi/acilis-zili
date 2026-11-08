"use client";

import { useLinkStatus } from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { HORIZON_NAV_WEEKS } from "@/lib/earnings-horizon";
import { addEtDays } from "@/lib/market-hours";
import styles from "./EarningsHorizon.module.css";

/**
 * UFKUN HAFTA ADIMI (8 Kasım, sahibinin isteği: "hafta hafta gezebilelim").
 *
 * Başlığın sağındaki tek denetim: rayın içinde önceki ok, hafta aralığı,
 * sonraki ok. Aralık eskiden başlığın künyesiydi; künye ile denetim aynı
 * bilgiyi iki kez yazmasın diye aralık rayın ortasına girdi. Bugünün
 * haftasından uzaklaşınca rayın solunda "Bu Hafta" dönüş bağlantısı açılır.
 *
 * Bağlantılar `scroll={false}` (sayfa içi süzgeç kuralı) ve adres
 * `?hafta=` — Haftalık sekmeyle aynı parametre. Sunucu turu sürerken
 * tıklanan ok `useLinkStatus` ile nabız atar; sayfanın geri kalanı yerinde
 * kalır. Sınır `HORIZON_NAV_WEEKS`: uçta ok devre dışı (aria-disabled span),
 * bağlantı basılmaz.
 */
export function HorizonWeekNav({
  monday,
  thisMonday,
  range,
  extraQuery,
  labels,
}: {
  monday: string;
  thisMonday: string;
  range: string;
  /** Hafta dışındaki parametreler ("aralik=ay"), korunur. */
  extraQuery: string;
  labels: { prev: string; next: string; thisWeek: string; nav: string };
}) {
  const href = (target: string) => {
    const params = new URLSearchParams(extraQuery);
    if (target === thisMonday) params.delete("hafta");
    else params.set("hafta", target);
    const query = params.toString();
    return query ? `/bilancolar?${query}` : "/bilancolar";
  };
  const offset = Math.round((Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${thisMonday}T00:00:00Z`)) / (7 * 86_400_000));
  const prev = addEtDays(monday, -7);
  const next = addEtDays(monday, 7);

  return (
    <nav aria-label={labels.nav} className={styles.weekNav}>
      {monday !== thisMonday && (
        <Link href={href(thisMonday)} scroll={false} className={`tap-44 ${styles.weekHome}`}>
          {labels.thisWeek}
        </Link>
      )}
      <span className={styles.weekRail}>
        {offset > -HORIZON_NAV_WEEKS ? (
          <Link href={href(prev)} scroll={false} className={`tap-44 ${styles.weekStep}`} aria-label={labels.prev}>
            <StepIcon dir="prev" />
          </Link>
        ) : (
          <span className={styles.weekStep} aria-disabled="true" aria-label={labels.prev}>
            <CaretLeft size={14} weight="bold" aria-hidden />
          </span>
        )}
        {/* Aralık canlı bölge: ok ile değişen hafta ekran okuyucuya söylenir. */}
        <span className={`figure ${styles.weekRange}`} aria-live="polite">
          {range}
        </span>
        {offset < HORIZON_NAV_WEEKS ? (
          <Link href={href(next)} scroll={false} className={`tap-44 ${styles.weekStep}`} aria-label={labels.next}>
            <StepIcon dir="next" />
          </Link>
        ) : (
          <span className={styles.weekStep} aria-disabled="true" aria-label={labels.next}>
            <CaretRight size={14} weight="bold" aria-hidden />
          </span>
        )}
      </span>
    </nav>
  );
}

/** `useLinkStatus` yalnız bir `Link`in İÇİNDE çalışır: ikon kendi
    bağlantısının bekleme durumunu okur. */
function StepIcon({ dir }: { dir: "prev" | "next" }) {
  const { pending } = useLinkStatus();
  const Icon = dir === "prev" ? CaretLeft : CaretRight;
  return (
    <span className={styles.weekIcon} data-pending={pending || undefined}>
      <Icon size={14} weight="bold" aria-hidden />
    </span>
  );
}
