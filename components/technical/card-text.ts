import { verdictTextClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { PlanPosition, PlanReading } from "@/lib/technical";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import { openWatchText, openWhyText } from "./open-plan";

/* KARTIN METİN YARDIMCILARI KENDİ MODÜLÜNDE (14 Kasım 2026, performans
   denetimi). `TechnicalCard.tsx`teydiler; hisse sayfasının teknik kartı,
   portföy ve kapak yalnız bu dört fonksiyon için kartın dosyasını içe
   aktarınca kartın CSS'i (liste ızgarası, plan rayı, açık aralık) da o
   sayfaların stil dosyalarına giriyordu. Düz modül: CSS içe aktarmaz. */

/** Değişim rozetinin rengi — yeni görüşün rengi, tek kaynaktan (25 Ekim:
 *  TUT mavi değil pirinç; gerekçe `verdictTextClass`, lib/analysis.ts). */
export function changeToneClass(verdict: VerdictKey): string {
  return verdictTextClass(verdict);
}

/** Plan konumunun etiketi; uzaklık işaretsiz, yönü cümle söylüyor. */
export function planPositionLabel(position: PlanPosition, locale: Locale, t: Dictionary): string {
  switch (position.kind) {
    case "inZone":
      return t.technical.planInZone;
    case "belowStop":
      return t.technical.planBelowStop;
    case "above":
      return t.technical.planAbove.replace("{n}", formatPercentPlain(position.pct, locale, 1));
    case "below":
      return t.technical.planBelow.replace("{n}", formatPercentPlain(position.pct, locale, 1));
  }
}

/**
 * Planın okuması — tek cümle. Sayılar `planReading`ten, cümleler sözlükten;
 * eksik seviye (stop yok, destek yok) cümlenin daha kısa bir sürümüne düşer,
 * "—" basılmaz.
 */
export function planReadingText(reading: PlanReading, locale: Locale, t: Dictionary): string {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const pct = (value: number) => formatPercentPlain(value, locale, 1);
  switch (reading.kind) {
    case "inZone":
      if (reading.hold) return t.technical.readingHoldInZone;
      return reading.stop === null
        ? t.technical.readingInZoneNoStop
        : t.technical.readingInZone.replace("{stop}", money(reading.stop));
    case "above":
      return t.technical.readingAbove.replace("{n}", pct(reading.pct)).replace("{high}", money(reading.high));
    case "below":
      return reading.stop === null
        ? t.technical.readingBelowNoStop.replace("{n}", pct(reading.pct))
        : t.technical.readingBelow.replace("{n}", pct(reading.pct)).replace("{stop}", money(reading.stop));
    case "belowStop":
      return t.technical.readingBelowStop.replace("{stop}", money(reading.stop));
    case "wait": {
      /* BÖLGESİZ TUT: NEDEN + İKİ CEVAP (31 Ekim). Cümle "Yeni alım bölgesi
         yok; en yakın destek …, en yakın direnç …" idi: neden plan
         olmadığını söylemiyordu ve listenin ilk elemanını "en yakın"
         sayıyordu — fiyat direnci geçmişken de onu izlenecek seviye diye
         yazıyordu. Artık önce neden (`openWhyText`), sonra alım ve satış
         tarafının fiyata göre hâli; geçilmiş seviye geçilmiş diye yazılıyor.
         İKİNCİ CÜMLE KOŞUL, YÖNLENDİRME DEĞİL (31 Ekim, aynı gün). "Alım
         için izlenecek seviye 998,19 $ desteği. Satış için izlenecek seviye
         1.255,35 $." okura alım ve satış yeri gösteriyordu ve sahibi "ne
         anlama geliyor bilmiyorum" dedi. Artık iki seviye ve kırılırlarsa
         ne olacağı — rutinin kendi kuralından (`openWatchText`). */
      return [openWhyText(reading.open, t), openWatchText(reading.open, money, t)].join(" ");
    }
    case "sell":
      if (reading.level !== null && reading.support !== null) {
        return t.technical.readingSell.replace("{level}", money(reading.level)).replace("{support}", money(reading.support));
      }
      if (reading.level !== null) return t.technical.readingSellLevel.replace("{level}", money(reading.level));
      if (reading.support !== null) return t.technical.readingSellSupport.replace("{support}", money(reading.support));
      return t.technical.readingSellPlain;
  }
}

/** Okumanın tonu — bölgede ve stop altı kesin, gerisi nötr. */
export function planReadingTone(reading: PlanReading): "up" | "down" | "flat" {
  if (reading.kind === "inZone" && !reading.hold) return "up";
  if (reading.kind === "belowStop" || reading.kind === "sell") return "down";
  return "flat";
}
