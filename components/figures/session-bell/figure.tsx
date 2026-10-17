import type { Dictionary, Locale } from "@/lib/i18n";
import { AFTER_HOURS_MINUTES, SESSION_BOUNDS, etParts, type MarketStatus } from "@/lib/market-hours";
import { TR_ZONE, displayZone, formatInZone } from "@/lib/session-clock";
import { SessionBellArt } from "./art";
import type { BellChip } from "./live";
import { hhmm, segments, type BellDay, type BellText } from "./model";
import "./bell.css";

/**
 * SEANS ZİLİ — ana sayfanın açıklayıcı figürü (anatomy skill'i, kit
 * components/iso). Kahramandaki mürekkep zili seansın RUH HÂLİNİ
 * anlatıyor; bu bölüm zilin NE ZAMAN çaldığını ve şimdi ne olduğunu
 * gösteriyor. Saatler `getMarketStatus`tan (yarım gün, tatil, hafta sonu).
 *
 * İKİNCİ SÜRÜM (12 Ekim, sahibinin itirazı: "yazılar okunmuyor, dil kötü,
 * renk yok, nasıl kullanılacağı belli değil"): figür kartının monospace köşe
 * yazıları ve uzun altyazı kalktı. Üstte büyük renkli seans rozeti, iki
 * saat ve geri sayım; kadranda renkli seans dilimleri (asıl seans mavi:
 * sitenin seans şeridiyle aynı, uzatılmış seanslar pirinç); altta TR saatiyle
 * üç seans düğmesi ve "Zili Çal". Metin tek satır.
 */
export function SessionBellFigure({ status, nowMs, locale, t }: { status: MarketStatus; nowMs: number; locale: Locale; t: Dictionary }) {
  const B = t.sessionBell;
  const now = new Date(nowMs);
  const nowMinutes = etParts(now).minutes;
  // TR'nin ET'den farkı bu an için (yaz saati geçişleri iki ülkede farklı haftada).
  const [trH, trM] = formatInZone(now, TR_ZONE).split(":").map(Number);
  let trOffset = ((trH * 60 + trM - nowMinutes) % 1440 + 1440) % 1440;
  if (trOffset > 720) trOffset -= 1440;

  /* KAPALI GÜN (hafta sonu, tatil) → ÖNİZLEME (17 Ekim): kadran sıradaki
     işlem gününün seanslarını taşır; kapanışı o günün kapanışı
     (`nextClose`, yarım gün dahil). Gerekçe model.ts → `BellDay.preview`. */
  const preview = !status.tradingToday;
  const close = preview ? etParts(status.nextClose).minutes : status.closeMinutes;
  const day: BellDay = {
    tradingToday: status.tradingToday,
    preview,
    preOpen: SESSION_BOUNDS.preMarketOpen,
    open: SESSION_BOUNDS.regularOpen,
    close,
    afterClose: close + AFTER_HOURS_MINUTES,
    trOffset,
  };
  /* Kartlardaki TR saati sıradaki işlem gününün farkıyla: ABD yaz saati
     pazar günü değişiyor ve hafta sonu önizlemesi bugünün farkıyla bir saat
     kayık basardı. */
  let chipOffset = trOffset;
  if (!status.tradingToday) {
    const [oh, om] = formatInZone(status.nextOpen, TR_ZONE).split(":").map(Number);
    chipOffset = ((oh * 60 + om - etParts(status.nextOpen).minutes) % 1440 + 1440) % 1440;
    if (chipOffset > 720) chipOffset -= 1440;
  }
  const text: BellText = { sessions: B.sessions, clock: B.clock, toOpen: B.toOpen, toClose: B.toClose, units: B.units };
  const range = (from: number, to: number, offset: number) => `${hhmm(from + offset)}–${hhmm(to + offset)}`;
  const chips: BellChip[] = segments(day).map((segment) => ({
    kind: segment.kind,
    name: B.sessions[segment.kind],
    // Saat sırası sitenin kuralı: TR'de büyük satır İstanbul, EN'de New York.
    tr: locale === "tr" ? range(segment.from, segment.to, chipOffset) : `${range(segment.from, segment.to, 0)} NY`,
    ny: locale === "tr" ? `${range(segment.from, segment.to, 0)} NY` : `${range(segment.from, segment.to, chipOffset)} TR`,
    from: segment.from,
    to: segment.to,
  }));

  const holiday = status.holiday && !status.holiday.earlyCloseEt ? (locale === "tr" ? status.holiday.nameTr : status.holiday.nameEn) : null;
  const zone = displayZone(locale);
  const nextOpen = `${new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { timeZone: zone, weekday: "long" }).format(status.nextOpen)} ${formatInZone(status.nextOpen, zone)}`;
  const closedNote = status.tradingToday ? null : B.closedNote.replace("{name}", holiday ?? B.weekend).replace("{next}", nextOpen);
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { timeZone: zone, ...options }).format(status.nextOpen);
  const nextDayName = fmt({ weekday: "long" });
  const previewHeading = preview ? B.previewHeading.replace("{date}", `${nextDayName} ${fmt({ day: "numeric", month: "long" })}`) : null;
  // Notta zil saatleri okuyucunun birincil saatiyle (TR'de İstanbul, EN'de New York).
  const primary = (minutes: number) => hhmm(minutes + (locale === "tr" ? chipOffset : 0));
  const note = B.note.replace("{open}", primary(day.open)).replace("{close}", primary(day.close));

  return (
    <SessionBellArt
      day={day}
      text={text}
      labels={{
        previewing: B.previewing,
        playingDay: preview ? B.previewDay.replace("{day}", nextDayName) : B.playingDay,
        back: B.back,
        play: B.play,
        playing: B.playing,
        openBell: B.openBell,
        closeBell: B.closeBell,
        note,
        closedNote,
        chipsLabel: B.chipsLabel,
        previewHeading,
      }}
      chips={chips}
      label={B.label}
      nowMinutes={nowMinutes}
      nowMs={nowMs}
      nextOpenMs={status.nextOpen.getTime()}
      nextCloseMs={status.nextClose.getTime()}
      stamp={B.stamp}
    />
  );
}
