import {
  fiscalLabel,
  fiscalOf,
  fiscalOfSlug,
  isCalendarAligned,
  matchReports,
  type FiscalQuarter,
} from "@/lib/fiscal";
import type { Locale } from "@/lib/i18n";
import { directionOf, formatPercent, formatPrice, SIGN_GAP, type Direction } from "@/lib/utils";

/**
 * GEÇMİŞ ÇEYREKLER — hisse sayfasının tablosu ve EPS izi aynı satırları
 * okuyor (23 Eylül).
 *
 * Tablo sağlayıcının sürpriz kaydını takvim satırına "rapor, dönemden 0-100
 * gün sonra gelir" penceresiyle bağlıyordu ve NVDA'da 26 Ağustos raporunun
 * tarihi ile 96,2 Mr $ geliri bir ÖNCEKİ çeyreğin EPS satırına düşüyordu;
 * eşleşme bulunamayınca dönem sonu "rapor tarihi" diye basılıyordu (AAPL'ın
 * dört tarihinin dördü çeyrek sonuydu). Eşleştirme artık `matchReports`
 * (lib/fiscal.ts, gerekçe orada); burada yalnızca satırın ekrana hazırlanışı
 * var. İz de tablo da bu dosyadan beslendiği için aynı çeyrek iki çizimde
 * iki farklı sayı taşıyamıyor (CLAUDE.md "Veri dürüstlüğü" 3).
 */

export type SurpriseRow = {
  period: string;
  epsEstimate: number | null;
  epsActual: number | null;
  quarter: number | null;
  year: number | null;
};

export type CalendarRow = {
  reportDate: string;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
};

/** Yayımlanmış analiz — adresin dönem parçası ve ham sayılar. */
export type AnalysisRowLike = {
  period: string;
  reportDate: string;
  revenue: number | null;
};

export type PastQuarter = {
  key: string;
  fiscal: FiscalQuarter | null;
  /** "2Ç FY2027" — üstteki Bilanço Analizleri paneliyle aynı ad. */
  label: string | null;
  /** İz ekseni için kısa ad: "2Ç FY27". */
  shortLabel: string | null;
  /** Sağlayıcının dönem tarihi, YALNIZCA çeyrek sonu olabileceği yerde. */
  quarterEnd: string | null;
  /** Açıklama günü (ET); bilinmiyorsa `null` — uydurulmaz. */
  reportDate: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
};

const fiscalKey = (fiscal: FiscalQuarter) => `${fiscal.year}:${fiscal.quarter}`;

/**
 * Sürpriz kayıtlarını takvim ve analiz satırlarıyla birleştirir; en yeni
 * çeyrek başta.
 *
 * GELİR ANALİZDEN DE DOLUYOR. Yerel takvim tablosu geçmiş tarafında sembol
 * başına TEK satır tutuyor (UpcomingEarnings künyesinde ölçüldü), yani
 * gelir sütunları dört satırın üçünde tireydi — SNDK'da analizi yayımlanmış
 * çeyreğin geliri bile. Analiz kaydı ham sayıyı zaten taşıyor ve mali
 * çeyreği adresinde yazılı ("2c-fy2027"); eşleşme o anahtarla. Takvimin
 * kendi değeri varsa o önce gelir: iki kaynak aynı açıklamanın sayısı.
 *
 * DÖNEM TARİHİ HER ZAMAN ÇEYREK SONU DEĞİL. NVDA'nın 26 Temmuz'da biten
 * çeyreği "2026-09-30" ile geliyor; ay satırı "Eyl 2026" yazsaydı rapordan
 * sonraki bir ayı çeyreğin sonu diye gösterirdi. Ay yalnızca rapor günü
 * biliniyor ve dönem ondan ÖNCEYSE basılıyor; rapordan sonraki bir tarih
 * çeyrek sonu olamaz, rapor bilinmiyorsa da sınanamaz.
 */
export function buildPastQuarters(
  surprises: readonly SurpriseRow[],
  calRows: readonly CalendarRow[],
  analyses: readonly AnalysisRowLike[],
  locale: Locale,
  today: string,
): PastQuarter[] {
  const matched = matchReports(surprises, calRows, today);
  const byFiscal = new Map<string, AnalysisRowLike>();
  for (const row of analyses) {
    const fiscal = fiscalOfSlug(row.period);
    if (fiscal && !byFiscal.has(fiscalKey(fiscal))) byFiscal.set(fiscalKey(fiscal), row);
  }
  /* FY yazılıp yazılmayacağı şirketin KENDİ analiz kaydından okunuyor —
     aynı ekranda "2Ç FY2027" ile "2Ç 2027" yan yana durmasın. Kayıt yoksa
     `isCalendarAligned` (gerekçe lib/fiscal.ts). */
  const analysisFy = analyses.map((row) => fiscalOfSlug(row.period)).find(Boolean)?.fy;

  return surprises
    .map((s, index) => {
      const cal = matched[index];
      const fiscal = fiscalOf(s);
      const analysis = fiscal ? byFiscal.get(fiscalKey(fiscal)) : undefined;
      const reportDate = cal?.reportDate ?? (analysis && analysis.reportDate <= today ? analysis.reportDate : null);
      const fy = fiscal ? (analysisFy ?? !isCalendarAligned(fiscal, s.period)) : false;
      return {
        key: s.period,
        fiscal,
        label: fiscal ? fiscalLabel(fiscal, locale, { fy }) : null,
        shortLabel: fiscal ? shortFiscalLabel(fiscal, locale, fy) : null,
        quarterEnd: reportDate && s.period <= reportDate ? s.period : null,
        reportDate,
        epsEstimate: s.epsEstimate,
        epsActual: s.epsActual,
        revenueEstimate: cal?.revenueEstimate ?? null,
        revenueActual: cal?.revenueActual ?? analysis?.revenue ?? null,
      } satisfies PastQuarter;
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** "2Ç FY27" · "Q2 FY27" · FY'siz "2Ç 26" — eksen etiketi, dar sütun. */
function shortFiscalLabel(fiscal: FiscalQuarter, locale: Locale, fy: boolean): string {
  const year = `${fy ? "FY" : "'"}${String(fiscal.year).slice(-2)}`;
  return locale === "tr" ? `${fiscal.quarter}Ç ${year}` : `Q${fiscal.quarter} ${year}`;
}

/* --------------------------------------------------------------------------
   Sapma

   YÜZDE, TABANI ANLAMLIYSA. Formül farkı beklentinin mutlak değerine
   bölüyor; zarardaki ya da sıfıra yakın bir beklentide bu oran patlıyordu:
   ASTS'de −0,23 $ beklenti, −0,66 $ gerçekleşen "−%188,46" yazıyordu —
   0,43 dolarlık bir ıska, iki ondalıklı ve anlamsız bir yüzde (CLAUDE.md
   "Uydurma kesinlik yok"). Beklenti sıfır ya da eksiyse, ya da mutlak
   değeri 10 sentin altındaysa sapma DOLAR FARKI olarak yazılır ("−0,43 $");
   öteki durumda yüzde, tek ondalıkla. İki sayı da hücrenin `title`ında.
   -------------------------------------------------------------------------- */

/** Bu mutlak değerin altındaki beklenti yüzde için taban olamaz. */
const MIN_PERCENT_BASE = 0.1;

export type EpsSurprise = { kind: "pct" | "abs"; value: number; direction: Direction };

export function epsSurprise(estimate: number | null, actual: number | null): EpsSurprise | null {
  if (estimate === null || actual === null) return null;
  const diff = actual - estimate;
  if (estimate <= 0 || Math.abs(estimate) < MIN_PERCENT_BASE) {
    return { kind: "abs", value: diff, direction: directionOf(diff) };
  }
  const pct = (diff / Math.abs(estimate)) * 100;
  return { kind: "pct", value: pct, direction: directionOf(pct) };
}

/** "+%3,8" · "−0,43 $" — `currency` `formatPrice`in sözleşmesiyle. */
export function formatEpsSurprise(
  surprise: EpsSurprise,
  locale: Locale,
  currency: string | true,
): string {
  if (surprise.kind === "pct") return formatPercent(surprise.value, locale, 1);
  const body = formatPrice(surprise.value, locale, { currency });
  return surprise.value > 0 ? `+${SIGN_GAP}${body}` : body;
}
