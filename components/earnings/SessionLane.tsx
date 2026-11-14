import type { CSSProperties } from "react";
import { SESSION_BOUNDS, AFTER_HOURS_MINUTES } from "@/lib/market-hours";
import { cn } from "@/lib/utils";
import css from "./SessionLane.module.css";

/**
 * SEANS ŞERİDİ — bilançonun günün NERESİNE düştüğünü çizer (10 Kasım,
 * görsel kalite turu).
 *
 * NEDEN: günün baş kartı (`EarningsCalendar` → hero) 1440'ta 1320 piksel
 * genişti; solda kimlik, sağda üç sayı, ortada ~700 piksel ölü boşluk
 * (ölçüldü: kimlik bloğunun sağ kenarı x=517, ölçü sütununun solu x=1224).
 * Kartın söylediği tek zaman bilgisi "Kapanış Sonrası" hapıydı; sitenin
 * varlık sebebi olan Türkiye saati ise kartta hiç yoktu.
 *
 * Şerit günün üç penceresini (açılış öncesi · seans · kapanış sonrası)
 * süreleriyle orantılı çizer; bilançonun penceresi dolu, ötekiler kulvar.
 * Altında iki zil: açılış ve kapanış, okurun birincil saatiyle. Yeni veri
 * YOK: pencere takvim satırının `hour` alanı, saatler o günün seans
 * sınırları (`lib/session-clock.ts`, yarım günde kapanış kayar).
 *
 * UYDURMA KESİNLİK YOK (`.claude/rules/veri-ve-onbellek.md` → 1): dakika
 * bilinmiyor, o yüzden pencerenin TAMAMI dolu ve şeritte nokta yok — nokta
 * bir an söylerdi. Saati duyurulmamış bilançoda hiçbir pencere dolmaz,
 * kulvar kesik çizgidir ve üstünde "Saat Belirsiz" yazar.
 *
 * Renk: dolgu `--bar-soft` (büyüklük/konum dolgusu; etkileşim mavisi
 * değil, yön rengi de değil — pencerenin iyi ya da kötü bir anlamı yok).
 * Çizim görünüme girince bir kez açılır (`data-motion-draw="line"`,
 * `MotionExperience`); sunucu son kareyi basar.
 *
 * 14 KASIM 2026 (görsel tur): takvimin baş satırı bu şeridi bıraktı. Aynı
 * iki zil saati alt alta beş satırda tekrar ediyordu; pencere küçük bir gün
 * imine indi (`EarningsCalendar.tsx` → "ÜÇ BÖLGE", `.windowMark`). Bileşeni
 * şu an çizen ekran yok; pencere tipi (`SessionLaneWindow`) takvimde
 * kullanılıyor. Silme ya da başka ekrana taşıma kararı ana oturumun.
 */

export type SessionLaneWindow = "bmo" | "dmh" | "amc" | null;

type Labels = {
  /** Pencere adları — Title Case. */
  pre: string;
  regular: string;
  after: string;
  unknown: string;
  /** Zil adları: "Açılış", "Kapanış". */
  open: string;
  close: string;
  /** Ekran okuyucu cümlesi; `{window}`, `{open}`, `{close}`, `{zone}`. */
  aria: string;
};

const SEGMENTS = ["bmo", "dmh", "amc"] as const;

export function SessionLane({
  window,
  openClock,
  closeClock,
  closeMinutes = SESSION_BOUNDS.regularClose,
  zone,
  labels,
  className,
}: {
  window: SessionLaneWindow;
  /** Okurun birincil saatiyle açılış ve kapanış zili ("17:30", "00:00"). */
  openClock: string;
  closeClock: string;
  /** O günün kapanışı (ET dakikası): yarım günde 13:00. */
  closeMinutes?: number;
  /** "TR" | "NY" — yalnız ekran okuyucu cümlesinde ve etikette. */
  zone: string;
  labels: Labels;
  className?: string;
}) {
  /* Üç pencerenin süresi (dakika): 04:00–09:30, 09:30–kapanış, kapanış + 4 sa. */
  const spans = {
    bmo: SESSION_BOUNDS.regularOpen - SESSION_BOUNDS.preMarketOpen,
    dmh: closeMinutes - SESSION_BOUNDS.regularOpen,
    amc: AFTER_HOURS_MINUTES,
  };
  const name = { bmo: labels.pre, dmh: labels.regular, amc: labels.after };
  const active = window ? name[window] : labels.unknown;
  /* Pencerenin kendi saati: açılış öncesi "17:30 Öncesi" demek yerine zilin
     saatini, kapanış sonrası kapanış zilini `~` ile verir (rapor zilin
     ardından gelir, dakika bilinmez). Seans içi ve belirsizde saat yok. */
  const clock = window === "amc" ? `~${closeClock}` : window === "bmo" ? `${openClock}` : null;

  return (
    <div
      className={cn(css.lane, className)}
      data-window={window ?? "unknown"}
      role="img"
      aria-label={labels.aria
        .replace("{window}", active)
        .replace("{open}", openClock)
        .replace("{close}", closeClock)
        .replace("{zone}", zone)}
    >
      <p className={css.head} aria-hidden>
        <span className={css.headName}>{active}</span>
        {clock && (
          <span className={cn("figure", css.headClock)}>
            {window === "bmo" ? `${labels.open} ${clock}` : clock} {zone}
          </span>
        )}
      </p>
      <div
        className={css.track}
        aria-hidden
        data-motion-track
        style={{ "--pre": spans.bmo, "--regular": spans.dmh, "--after": spans.amc } as CSSProperties}
      >
        {SEGMENTS.map((key) => (
          <span key={key} className={css.segment} data-key={key} data-active={window === key || undefined}>
            {window === key && (
              <span
                className={css.fill}
                data-motion-draw="line"
                /* Kapanış sonrası zilden SAĞA, açılış öncesi zile DOĞRU açılır:
                   çizimin yönü raporun zile göre yerini söyler. */
                style={{ transformOrigin: key === "bmo" ? "right center" : "left center" }}
              />
            )}
          </span>
        ))}
      </div>
      <div
        className={css.ticks}
        aria-hidden
        style={{ "--pre": spans.bmo, "--regular": spans.dmh, "--after": spans.amc } as CSSProperties}
      >
        <span className={css.tick} data-at="open">
          <span className={cn("figure", css.tickClock)}>{openClock}</span>
          <span className={css.tickName}>{labels.open}</span>
        </span>
        <span className={css.tick} data-at="close">
          <span className={cn("figure", css.tickClock)}>{closeClock}</span>
          <span className={css.tickName}>{labels.close}</span>
        </span>
      </div>
    </div>
  );
}
