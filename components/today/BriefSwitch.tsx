"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { EmptyState, Kicker } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { BriefPeriod } from "@/lib/brief";

/**
 * Ana sayfadaki özet kartı — günlük ve haftalık aynı kartın iki sekmesi.
 *
 * NEDEN SEKME: haftalık bülten yazılıyordu ama ana sayfadan görünmüyordu;
 * ona ulaşmanın tek yolu kartın altındaki arşiv bağlantısını takip edip
 * /bulten'de ikinci bir sekmeye basmaktı. Yani haftada bir yazılan metni
 * bulmak için iki tıklama ve bir sayfa geçişi gerekiyordu. Sekme, iki metni
 * de aynı yüzeyde ve tek dokunuşta okunur kılıyor.
 *
 * Durum istemcide tutuluyor, sorgu parametresiyle değil: sekme değişimi bir
 * gezinme değil, aynı kartın diğer yüzü. İki metin de sunucudan birlikte
 * geliyor, geçişte ağ isteği yok.
 *
 * ESKİ KAYIT GÖSTERİLİR. Günlük özet 16:00'da, haftalık pazartesi 09:30'da
 * yazılıyor. Kart eskiden yalnızca BUGÜNÜN kaydını arıyordu; o saate kadar
 * sayfanın en önemli kutusu boş duruyordu. Artık en son yazılan metin
 * gösteriliyor ve tarihi bugünden eskiyse üstünde bunu söyleyen bir uyarı
 * duruyor — okur, hangi güne baktığını ve yenisinin ne zaman geleceğini
 * bilerek okuyor.
 */

export type BriefView = {
  headline: string;
  /** "Claude · 16:12" — sağ üstteki künye. */
  stamp: string;
  /** Kaydın kendi tarihi: "1 Ağustos Cumartesi" ya da "28.07 – 01.08". */
  dateLabel: string;
  /** Kayıt güncel değilse uyarı cümlesi; günceldeyse null. */
  staleNote: string | null;
  /** Kayıt okunan dilde değilse dil notu; çeviri varsa null. */
  langNote: string | null;
  /** Kayıt bu döneme mi ait — rozet bunun için. */
  current: boolean;
  archiveHref: string;
};

export type BriefSwitchLabels = {
  tabs: Record<BriefPeriod, string>;
  titles: Record<BriefPeriod, string>;
  empty: Record<BriefPeriod, string>;
  currentBadge: Record<BriefPeriod, string>;
  periodLabel: string;
  more: string;
  archive: string;
};

export function BriefSwitch({
  daily,
  weekly,
  dailyBody,
  weeklyBody,
  labels,
}: {
  daily: BriefView | null;
  weekly: BriefView | null;
  /**
   * Gövdeler SUNUCUDA çizilip buraya slot olarak geliyor.
   *
   * Eskiden ham markdown metinleri prop olarak geçiyor ve `BriefBody`
   * (191 satırlık mini ayrıştırıcı) bu istemci bileşeninden import edildiği
   * için o da istemci demetine giriyordu. Yani ekranda tek seferde biri
   * görünen iki metnin TAMAMI indiriliyor ve ayrıştırma tarayıcıda
   * yapılıyordu — ana sayfa bu kartı her açılışta basıyor.
   *
   * İkisi de props içinde hazır olduğu için sekme geçişinde yine ağ isteği
   * yok; değişen tek şey hangi ağacın çizildiği.
   */
  dailyBody?: ReactNode;
  weeklyBody?: ReactNode;
  labels: BriefSwitchLabels;
}) {
  const [period, setPeriod] = useState<BriefPeriod>("daily");
  const brief = period === "daily" ? daily : weekly;
  const body = period === "daily" ? dailyBody : weeklyBody;

  return (
    /* Zemin BEYAZ BELGE, tint değil.
       Panel bir süre mavi degrade taşıdı ve sayfadaki en uzun metin onun
       üstünde duruyordu: tint, gövde metninin kontrastını düşürüyor ve
       "okunacak yer" yerine "vurgulanmış kutu" gibi okunuyordu. Projede bu
       karar bir kez veri yüzeyleri için verildi (bkz. `--surface-solid`,
       karne dokusu); uzun metin için daha da geçerli. Accent kenarlık
       kalıyor — bültenin günün başyazısı olduğu oradan belli. */
    <section className="rounded-xl border border-primary-faint bg-surface-solid p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Kicker tone="primary">{labels.titles[period]}</Kicker>
        {brief && (
          <span className="numeral ml-auto text-[11px] text-muted">
            {brief.stamp}
          </span>
        )}
      </div>

      {/* Sekmeler metnin hemen üstünde: hangi dönemi okuduğun, okumaya
          başlamadan önce görünür. Dokunma hedefi 34px — 12.5px'lik iki
          kelimeyi parmakla ıskalanmayacak bir hapa oturtuyor. */}
      <div
        role="tablist"
        aria-label={labels.periodLabel}
        className="mt-3 inline-flex overflow-hidden rounded-md border border-primary-faint text-[12.5px]"
      >
        {(["daily", "weekly"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`brief-tab-${key}`}
            aria-controls="brief-panel"
            aria-selected={period === key}
            onClick={() => setPeriod(key)}
            className={cn(
              /* Telefonda 44px: 34px'lik sekmeler dokunma eşiğinin altındaydı
                 ve bunlar bültenin tek denetimi. Masaüstünde imleç hassas,
                 orada 34px yeterli. */
              "min-h-11 px-3.5 transition-colors sm:min-h-[34px]",
              period === key
                ? "bg-primary font-semibold text-on-primary"
                : "text-body hover:text-strong",
            )}
          >
            {labels.tabs[key]}
          </button>
        ))}
      </div>

      <div
        id="brief-panel"
        role="tabpanel"
        aria-labelledby={`brief-tab-${period}`}
      >
        {brief ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="numeral text-[11.5px] text-body">
              {brief.dateLabel}
            </span>
              {brief.current && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-on-primary">
                  {labels.currentBadge[period]}
                </span>
              )}
            </div>

            {/* Uyarı metnin ÜSTÜNDE: aşağıdaki cümleleri hangi günün gözüyle
                okuyacağını önce söylemek gerekiyor. */}
            {brief.staleNote && (
              <p className="mt-2.5 rounded-md border border-line bg-surface-elevated px-3 py-2 text-[12px] leading-[18px] text-body">
                {brief.staleNote}
              </p>
            )}

            {/* Dil notu da metnin üstünde, aynı gerekçeyle: okur hangi dilde
                bir metne baktığını okumaya başlamadan bilmeli. */}
            {brief.langNote && (
              <p className="mt-2.5 w-fit rounded-full border border-line bg-surface-elevated px-3 py-1.5 text-[11.5px] text-muted">
                {brief.langNote}
              </p>
            )}

            {/* Okunur bant: başlık ve gövde panelin tam genişliğine
                yayılıyordu ve geniş ekranda satır boyu 110 karakteri
                aşıyordu. Aynı sorun analiz sayfasında çok sütunla çözülmüştü;
                bültende listeler ve ara başlıklar olduğu için sütun değil
                ÖLÇÜ sınırı doğru araç. */}
            <p className="mt-3 max-w-[74ch] text-base font-medium leading-[25px] text-strong">
              {brief.headline}
            </p>
            {body}
            <Link
              href={brief.archiveHref}
              className="mt-4 inline-flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              {labels.archive}
              <span aria-hidden>→</span>
            </Link>
          </>
        ) : (
          <EmptyState title={labels.empty[period]} />
        )}
      </div>
    </section>
  );
}
