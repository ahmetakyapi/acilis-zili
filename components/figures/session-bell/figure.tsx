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

  const day: BellDay = {
    tradingToday: status.tradingToday,
    preOpen: SESSION_BOUNDS.preMarketOpen,
    open: SESSION_BOUNDS.regularOpen,
    close: status.closeMinutes,
    afterClose: status.closeMinutes + AFTER_HOURS_MINUTES,
    trOffset,
  };
  const text: BellText = { sessions: B.sessions, clock: B.clock, toOpen: B.toOpen, toClose: B.toClose, units: B.units };
  const range = (from: number, to: number, offset: number) => `${hhmm(from + offset)}–${hhmm(to + offset)}`;
  const chips: BellChip[] = segments(day).map((segment) => ({
    kind: segment.kind,
    name: B.sessions[segment.kind],
    // Saat sırası sitenin kuralı: TR'de büyük satır İstanbul, EN'de New York.
    tr: locale === "tr" ? range(segment.from, segment.to, trOffset) : `${range(segment.from, segment.to, 0)} NY`,
    ny: locale === "tr" ? `${range(segment.from, segment.to, 0)} NY` : `${range(segment.from, segment.to, trOffset)} TR`,
    from: segment.from,
    to: segment.to,
  }));

  const holiday = status.holiday && !status.holiday.earlyCloseEt ? (locale === "tr" ? status.holiday.nameTr : status.holiday.nameEn) : null;
  const zone = displayZone(locale);
  const nextOpen = `${new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { timeZone: zone, weekday: "long" }).format(status.nextOpen)} ${formatInZone(status.nextOpen, zone)}`;
  const closedNote = status.tradingToday ? null : B.closedNote.replace("{name}", holiday ?? B.weekend).replace("{next}", nextOpen);
  // Notta zil saatleri okuyucunun birincil saatiyle (TR'de İstanbul, EN'de New York).
  const primary = (minutes: number) => hhmm(minutes + (locale === "tr" ? trOffset : 0));
  const note = B.note.replace("{open}", primary(day.open)).replace("{close}", primary(day.close));

  return (
    <SessionBellArt
      day={day}
      text={text}
      labels={{
        previewing: B.previewing,
        playingDay: B.playingDay,
        back: B.back,
        play: B.play,
        playing: B.playing,
        openBell: B.openBell,
        closeBell: B.closeBell,
        note,
        closedNote,
        chipsLabel: B.chipsLabel,
        dialHint: B.dialHint,
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
