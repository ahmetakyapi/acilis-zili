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

  /**
   * Ok tuşlarıyla sekme gezinmesi (ARIA "tabs" kalıbı).
   *
   * Yeni sekme seçildiğinde odak da ona taşınıyor: gezici sekme sırasında
   * eski sekme `tabIndex={-1}` oluyor ve odak hiçbir yere tutunmadan
   * gövdeye düşerdi.
   */
  function sekmeTusu(olay: React.KeyboardEvent<HTMLButtonElement>) {
    const sira = ["daily", "weekly"] as const;
    const simdi = sira.indexOf(period);
    let hedef = simdi;
    if (olay.key === "ArrowRight" || olay.key === "ArrowDown") {
      hedef = (simdi + 1) % sira.length;
    } else if (olay.key === "ArrowLeft" || olay.key === "ArrowUp") {
      hedef = (simdi - 1 + sira.length) % sira.length;
    } else if (olay.key === "Home") {
      hedef = 0;
    } else if (olay.key === "End") {
      hedef = sira.length - 1;
    } else {
      return;
    }
    olay.preventDefault();
    setPeriod(sira[hedef]);
    olay.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#brief-tab-${sira[hedef]}`)
      ?.focus();
  }
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
      {/* ÜST SATIR TEK SIRA. Künye, sekmeler ve arşiv bağlantısı üç ayrı
          satırdaydı (sekmeler ortada, arşiv bağlantısı metnin en dibinde) ve
          manşete gelene kadar üç kademe iniliyordu — bültenin başyazı olduğu
          hissi orada kayboluyordu. Üçü de birer DENETİM ya da künye, yani
          aynı satırın işi; manşet doğrudan onların altında başlıyor. Sarma
          `flex-wrap` ile: dar ekranda denetim grubu kendi satırına iner. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Kicker tone="primary">{labels.titles[period]}</Kicker>
          {brief && (
            <span className="numeral text-tiny text-muted">{brief.stamp}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">

      {/* Sekmeler metnin hemen üstünde: hangi dönemi okuduğun, okumaya
          başlamadan önce görünür. Dokunma hedefi 34px — 12.5px'lik iki
          kelimeyi parmakla ıskalanmayacak bir hapa oturtuyor.

          SEKME SÖZLEŞMESİ EKSİKTİ. `role="tablist"` ve `role="tab"` yazılıydı
          ama davranışı yoktu: ekran okuyucu "Günlük, sekme, 2 sekmeden 1'i,
          seçili" diye duyuruyor, kullanıcı kalıbın gereği sağ oka basıyor ve
          hiçbir şey olmuyordu. Rolü ilan edip davranışını vermemek, hiç
          ilan etmemekten kötü — kullanıcıya çalışmayan bir söz veriyor.
          Şimdi ok tuşları, Home ve End sekmeler arasında geziyor; sekme
          sırası GEZİCİ (yalnızca seçili sekme Tab sırasında, ötekine ok
          tuşuyla ulaşılıyor) — ARIA kalıbının istediği tam olarak bu. */}
      <div
        role="tablist"
        aria-label={labels.periodLabel}
        /* Sekmeler de aralık anahtarıyla aynı dilde: ray + hap
           (`components/ui/primitives.tsx` → Segment). Kenarlıklı kutuydu ve
           sayfadaki öteki iki denetimden (Günlük/Haftalık anahtarı, tema
           anahtarı) farklı görünüyordu. */
        className="inline-flex gap-0.5 rounded-full bg-surface-elevated p-[3px] text-small"
      >
        {(["daily", "weekly"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`brief-tab-${key}`}
            aria-controls="brief-panel"
            aria-selected={period === key}
            tabIndex={period === key ? 0 : -1}
            onKeyDown={sekmeTusu}
            onClick={() => setPeriod(key)}
            className={cn(
              /* Telefonda 44px: 34px'lik sekmeler dokunma eşiğinin altındaydı
                 ve bunlar bültenin tek denetimi. Masaüstünde imleç hassas,
                 orada 34px yeterli. */
              "min-h-10 rounded-full px-4 transition-colors sm:min-h-8",
              period === key
                ? "bg-primary font-semibold text-on-primary"
                : "text-body hover:text-strong",
            )}
          >
            {labels.tabs[key]}
          </button>
        ))}
          </div>
          {brief && (
            <Link
              href={brief.archiveHref}
              /* Dokunma hedefi 40px: negatif margin dolguyu emiyor, yani
                 hedef büyürken üst satırın yüksekliği değişmiyor. */
              className="-my-2 inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap py-2 text-small font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-8"
            >
              {labels.archive}
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      <div
        id="brief-panel"
        role="tabpanel"
        aria-labelledby={`brief-tab-${period}`}
      >
        {brief ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="numeral text-tiny text-body">
              {brief.dateLabel}
            </span>
              {brief.current && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-nano font-bold tracking-[0.05em] text-on-primary">
                  {labels.currentBadge[period]}
                </span>
              )}
            </div>

            {/* Uyarı metnin ÜSTÜNDE: aşağıdaki cümleleri hangi günün gözüyle
                okuyacağını önce söylemek gerekiyor. */}
            {brief.staleNote && (
              <p className="mt-2.5 rounded-md border border-line bg-surface-elevated px-3 py-2 text-small leading-[18px] text-body">
                {brief.staleNote}
              </p>
            )}

            {/* Dil notu da metnin üstünde, aynı gerekçeyle: okur hangi dilde
                bir metne baktığını okumaya başlamadan bilmeli. */}
            {brief.langNote && (
              <p className="mt-2.5 w-fit rounded-full border border-line bg-surface-elevated px-3 py-1.5 text-tiny text-muted">
                {brief.langNote}
              </p>
            )}

            {/* MANŞET GERÇEKTEN MANŞET. Cümle 13 puntoda, gövde metniyle
                neredeyse aynı ağırlıkta duruyordu: bültenin en önemli satırı
                bir giriş paragrafı gibi okunuyor, blok da günün başyazısı
                değil bir bilgi kutusu gibi görünüyordu. Ölçek zaten var —
                mercek manşetiyle (`LeadStory`) aynı basamak ve aynı üç kural:
                `max-w-[34ch]` satırı iki-üç satıra indiriyor (manşetler
                ortalama 55 karakter ve tek satırda 900 piksele uzuyordu),
                `text-balance` o satırları eşitleyip yetim kelime bırakmıyor,
                `w-fit` de `.display-ink` maskesi için ŞART — blok genişliğinde
                bırakılırsa degrade harflerin bittiği yerde değil kabın
                bittiği yerde biter.

                Okunur bant gövdede kalıyor: gövde ölçü sınırını kendi
                taşıyor, manşetin sınırı ondan dar. */}
            <h2 className="display-ink mt-3.5 w-fit max-w-[34ch] text-balance text-heading font-bold leading-[1.16] tracking-[-0.03em] sm:text-subdisplay">
              {brief.headline}
            </h2>
            {body}
          </>
        ) : (
          <EmptyState title={labels.empty[period]} />
        )}
      </div>
    </section>
  );
}
