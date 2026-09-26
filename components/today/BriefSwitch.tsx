"use client";

import { useState, type ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, Kicker } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { BriefPeriod } from "@/lib/brief";
import styles from "./BriefSwitch.module.css";

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
  /* GEÇİŞİN YÖNÜ — yalnızca okuyucu sekme değiştirdiğinde dolu. Kart ana
     sayfanın ilk ekranında; ilk çizimde animasyon oynasaydı sunucunun tam
     boyadığı metin yüklenirken kayıp soluklaşırdı (23 Eylül kuralı:
     ilk ekran hidrasyonda kımıldamaz). Haftalık sağdaki sekme, içerik
     oradan geliyor; Günlük'e dönüşte soldan. */
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const choose = (next: BriefPeriod) => {
    if (next === period) return;
    setDirection(next === "weekly" ? "next" : "prev");
    setPeriod(next);
  };

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
    choose(sira[hedef]);
    olay.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#brief-tab-${sira[hedef]}`)
      ?.focus();
  }
  const brief = period === "daily" ? daily : weekly;
  const body = period === "daily" ? dailyBody : weeklyBody;

  const tabs = (
    <div
      role="tablist"
      aria-label={labels.periodLabel}
      /* Sekmeler de aralık anahtarıyla aynı dilde: ray + hap
         (`components/ui/primitives.tsx` → Segment). Kenarlıklı kutuydu ve
         sayfadaki öteki iki denetimden (Günlük/Haftalık anahtarı, tema
         anahtarı) farklı görünüyordu.

         SEKME SÖZLEŞMESİ: ok tuşları, Home ve End sekmeler arasında
         geziyor; sekme sırası GEZİCİ (yalnızca seçili sekme Tab sırasında).
         Rolü ilan edip davranışını vermemek, hiç ilan etmemekten kötü. */
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
          onClick={() => choose(key)}
          className={cn(
            /* Telefonda 44px: 34px'lik sekmeler dokunma eşiğinin altındaydı
               ve bunlar bültenin tek denetimi. Masaüstünde imleç hassas,
               orada 34px yeterli. */
            "min-h-11 rounded-full px-4 transition-colors sm:min-h-8",
            period === key
              ? "bg-primary font-semibold text-on-primary"
              : "text-body hover:text-strong",
          )}
        >
          {labels.tabs[key]}
        </button>
      ))}
    </div>
  );

  return (
    /* Zemin BEYAZ BELGE, tint değil.
       Panel bir süre mavi degrade taşıdı ve sayfadaki en uzun metin onun
       üstünde duruyordu: tint, gövde metninin kontrastını düşürüyor ve
       "okunacak yer" yerine "vurgulanmış kutu" gibi okunuyordu. Accent
       kenarlık kalıyor — bültenin günün başyazısı olduğu oradan belli.

       DENETİMLER METNİN ÜSTÜNDE, HER GENİŞLİKTE (24 Eylül). ≥1200'de
       künye, sekmeler ve arşiv sağda yapışkan bir raydaydı; bülten
       kaydırıldıkça ray kayıyor ve metnin sağında hep bir sütunluk boşluk
       varmış gibi duruyordu. Gerekçe BriefSwitch.module.css'te. */
    <section className={cn("rounded-xl border border-primary-faint bg-surface-solid p-5", styles.card)}>
      <div className={styles.rail}>
        <div className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1", styles.railKicker)}>
          <Kicker tone="primary">{labels.titles[period]}</Kicker>
          {brief && (
            <span className="numeral text-tiny text-muted">{brief.stamp}</span>
          )}
        </div>
        {/* ARŞİV BAĞLANTISI DAR EKRANDA SAĞ UÇTA. Denetim grubu kendi
            satırına indiğinde sekmeler ve bağlantı sola toplanıyor, sağında
            yarım satır boşluk kalıyordu; grup o satırın tamamını alıyor ve
            iki uç birbirinden ayrılıyor. */}
        <div className={cn("flex w-full shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:w-auto sm:justify-start", styles.railControls)}>
          {tabs}
          {brief && (
            <Link
              href={brief.archiveHref}
              /* Dokunma hedefi telefonda 44px (40'tı, ölçüldü): negatif
                 margin dolguyu emiyor, yani hedef büyürken üst satırın
                 yüksekliği değişmiyor. */
              className="-my-2 inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap py-2 text-small font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-8"
            >
              {labels.archive}
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
        {brief && (
          <div className={styles.railMeta}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="numeral text-tiny text-body">{brief.dateLabel}</span>
              {brief.current && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-tiny font-bold tracking-[0.05em] text-on-primary">
                  {labels.currentBadge[period]}
                </span>
              )}
            </div>
            {/* Uyarı metnin ÜSTÜNDE (geniş ekranda yanında): aşağıdaki
                cümleleri hangi günün gözüyle okuyacağını önce söylemek
                gerekiyor. */}
            {brief.staleNote && (
              <p className="mt-2.5 rounded-md border border-line bg-surface-elevated px-3 py-2 text-small leading-[18px] text-body">
                {brief.staleNote}
              </p>
            )}
            {/* Dil notu da aynı gerekçeyle metnin önünde. */}
            {brief.langNote && (
              <p className="mt-2.5 w-fit rounded-full border border-line bg-surface-elevated px-3 py-1.5 text-tiny text-muted">
                {brief.langNote}
              </p>
            )}
          </div>
        )}
      </div>

      <div
        /* Anahtar dönem: yeni sekmede panel yeniden kuruluyor ve giriş
           animasyonu baştan oynuyor. Sekmeler panelin DIŞINDA, odak
           kaybolmuyor. */
        key={period}
        id="brief-panel"
        role="tabpanel"
        aria-labelledby={`brief-tab-${period}`}
        data-enter={direction ?? undefined}
        className={cn(styles.main, styles.panelEnter)}
      >
        {brief ? (
          <>
            {/* MANŞET GERÇEKTEN MANŞET — mercek manşetiyle aynı basamak;
                `max-w-[34ch]` satırı iki-üç satıra indiriyor, `text-balance`
                yetim kelime bırakmıyor.
                MAVİ DEGRADE, SATIR SATIR (24 Eylül). Düz mürekkepteydi:
                iki-üç satırlık metinde degrade kutu boyunca yayılıyor ve
                ikinci satır başka bir tonda başlıyordu. `data-ink="lines"`
                degradeyi başlığın içindeki satır içi kutuya taşıyor ve
                `box-decoration-break: clone` her satıra kendi degradesini
                veriyor (globals.css). */}
            <h2 data-ink="lines" className="max-w-[34ch] text-balance text-heading font-bold leading-[1.16] tracking-[-0.03em] text-strong sm:text-subdisplay">
              <span className="ink-line">{brief.headline}</span>
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
