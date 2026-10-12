import { Plate } from "@/components/iso/react/draw";
import type { Dictionary, Locale } from "@/lib/i18n";
import { AFTER_HOURS_MINUTES, SESSION_BOUNDS, etParts, type MarketStatus } from "@/lib/market-hours";
import { TR_ZONE, displayZone, formatInZone } from "@/lib/session-clock";
import { SessionBellArt } from "./art";
import { readoutOf, type BellDay, type BellText } from "./model";
import "./bell.css";

const hhmm = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * SEANS ZİLİ — ana sayfanın açıklayıcı figürü (12 Ekim; anatomy skill'i,
 * kit components/iso). Kahramandaki mürekkep zili seansın RUH HÂLİNİ
 * anlatıyor (uyuyor, bekliyor, çalıyor); bu figür zilin NE ZAMAN ve NEDEN
 * çaldığını bir makineyle gösteriyor. İkisi aynı kaynaktan:
 * `getMarketStatus` (yarım gün, tatil, hafta sonu dahil). Sabit saat yok.
 *
 * Kart anatomy'nin düzeni: şekil numarası, başlık, ipucu, canlı künye
 * ("16:46 TR · 09:46 NY · Asıl Seans"). Lejant ve altyazı kartın altında;
 * çizimde tek yazı kadrana kazınmış "NY".
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
  const text: BellText = { sessions: B.sessions, openBell: B.openBell, closeBell: B.closeBell, closedDay: B.weekend, clock: B.clock };
  const holiday = status.holiday && !status.holiday.earlyCloseEt ? (locale === "tr" ? status.holiday.nameTr : status.holiday.nameEn) : null;
  const closedName = status.tradingToday ? null : holiday ? B.holiday.replace("{name}", holiday) : B.weekend;

  const zone = displayZone(locale);
  const nextOpen = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { timeZone: zone, weekday: "long" }).format(status.nextOpen);
  const caption = status.tradingToday
    ? B.caption
        .replace("{pre}", hhmm(day.preOpen))
        .replace("{open}", hhmm(day.open))
        .replace("{close}", hhmm(day.close))
        .replace("{after}", hhmm(day.afterClose))
        .replace("{trOpen}", hhmm(day.open + trOffset))
        .replace("{trClose}", hhmm(day.close + trOffset))
    : B.captionClosed.replace("{name}", holiday ?? B.weekend.split(" · ")[0]).replace("{next}", `${nextOpen} ${formatInZone(status.nextOpen, zone)}`);

  return (
    <div className="sb-wrap">
      <Plate fig={B.fig} title={B.plateTitle} hint={B.hint} readout={readoutOf(nowMinutes, day, text, closedName)}>
        <SessionBellArt day={day} text={text} closedName={closedName} label={B.label} nowMinutes={nowMinutes} nowMs={nowMs} stamp={B.stamp} />
      </Plate>
      <ul className="sb-keys" aria-hidden="true">
        {(["regular", "extended", "contact"] as const).map((key) => (
          <li key={key} data-key={key}>
            <i />
            {B.keys[key]}
          </li>
        ))}
      </ul>
      <p className="sb-caption">{caption}</p>
    </div>
  );
}
