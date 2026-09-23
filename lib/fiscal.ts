import { daysBetweenEt } from "./market-hours";
import type { Locale } from "./i18n/config";

/**
 * MALİ ÇEYREĞİN KİMLİĞİ — tek yerde.
 *
 * NEDEN VAR: iki ekran aynı soruyu ayrı ayrı cevaplıyordu ve ikisi de
 * yanılıyordu. Hisse sayfasının geçmiş bilançolar tablosu sağlayıcının
 * sürpriz kaydını (EPS beklenti/gerçekleşen, çeyrek BAŞINA bir satır) takvim
 * satırına "rapor, çeyrek sonundan 0-100 gün SONRA gelir" penceresiyle
 * bağlıyordu. Finnhub'ın `period` alanı ise her şirkette çeyreğin gerçek
 * bitişi değil: NVDA'da 26 Temmuz'da biten 2Ç FY2027'nin kaydı
 * "2026-09-30" dönemiyle geliyor. Sonuç 23 Eylül'de ölçüldü: 26 Ağustos
 * raporunun tarihi ve 96,2 Mr $ geliri bir ÖNCEKİ çeyreğin EPS satırına
 * yapışmıştı, bu çeyreğin EPS'i de bugünden bir hafta SONRAYA
 * ("30 Eyl 2026") tarihlenmiş bir satırda duruyordu. Eşleşme bulunamayınca
 * dönem sonu "rapor tarihi" diye basılıyordu: AAPL'ın dört rapor tarihinin
 * dördü de çeyrek sonuydu (30 Haz, 31 Mar…) — uydurma bir kesinlik
 * (CLAUDE.md "Veri dürüstlüğü" 1).
 *
 * Eşleştirme artık üç adımlı ve her adım bir öncekinden ZAYIF:
 *   1. Açıklanan EPS aynı (yarım sentten az fark) ve rapor pencerede.
 *   2. Mali yıl ve çeyrek aynı (iki besleme de taşıyor).
 *   3. Pencere içindeki EN YAKIN rapor.
 * Pencere dönemden 45 gün önce ile 100 gün sonrası: NVDA'nın kaydırılmış
 * dönemi raporu ÖNCEYE (−35 gün) düşürüyor, yavaş raporlayan şirketler
 * 90 günü buluyor. Bir takvim satırı İKİ çeyreğe verilmez; hiçbir adım
 * tutmazsa sonuç `null` ve ekran tarih UYDURMAZ, `NO_VALUE` basar.
 *
 * Adımlar TÜM çeyrekler için sırayla koşuyor (`matchReports`): önce bütün
 * EPS eşleşmeleri, sonra mali anahtarlar, en son yakınlık. Çeyrek çeyrek
 * açgözlü gitmek, bir çeyreğin "en yakın" diye aldığı satırı EPS'i birebir
 * tutan öteki çeyrekten çalabiliyordu.
 */

export type FiscalQuarter = { year: number; quarter: number };

/** Sağlayıcının sürpriz kaydı — `EarningsSurprise` ile aynı alanlar. */
export type SurpriseLike = {
  /** Sağlayıcının dönem tarihi, "YYYY-MM-DD" (çeyrek sonu OLMAYABİLİR). */
  period: string;
  epsActual: number | null;
  quarter: number | null;
  year: number | null;
};

/** Takvim satırı — `earnings_calendar` ya da sağlayıcı takvimi. */
export type ReportRowLike = {
  /** Açıklama günü, ET "YYYY-MM-DD". */
  reportDate: string;
  epsActual: number | null;
  quarter: number | null;
  year: number | null;
};

/** Rapor, dönem tarihinden en çok bu kadar gün ÖNCE olabilir. */
const REPORT_WINDOW_BEFORE_DAYS = 45;
/** …ve en çok bu kadar gün SONRA. */
const REPORT_WINDOW_AFTER_DAYS = 100;
/** "Aynı EPS" eşiği: yarım sent. Sağlayıcılar kuruşa yuvarlıyor. */
const EPS_MATCH_TOLERANCE = 0.005;

function inWindow(period: string, reportDate: string): boolean {
  const diff = daysBetweenEt(period, reportDate);
  return diff >= -REPORT_WINDOW_BEFORE_DAYS && diff <= REPORT_WINDOW_AFTER_DAYS;
}

function sameEps(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < EPS_MATCH_TOLERANCE;
}

function sameFiscal(a: { year: number | null; quarter: number | null }, b: { year: number | null; quarter: number | null }): boolean {
  return a.year !== null && a.quarter !== null && a.year === b.year && a.quarter === b.quarter;
}

/**
 * Her sürpriz kaydına kendi takvim satırını bulur; bulamadığına `null`.
 * Dönen dizi girişle AYNI SIRADA. `today` verilirse bugünden sonraki bir
 * rapor günü hiçbir zaman eşleşmez: açıklanmış bir çeyreğin raporu
 * gelecekte olamaz.
 */
export function matchReports<S extends SurpriseLike, R extends ReportRowLike>(
  surprises: readonly S[],
  calRows: readonly R[],
  today?: string,
): (R | null)[] {
  const candidates = calRows.filter((row) => !today || row.reportDate <= today);
  const used = new Set<R>();
  const result: (R | null)[] = surprises.map(() => null);
  const pass = (pick: (surprise: S, pool: R[]) => R | undefined) => {
    surprises.forEach((surprise, index) => {
      if (result[index]) return;
      const pool = candidates.filter((row) => !used.has(row));
      const hit = pick(surprise, pool);
      if (hit) {
        used.add(hit);
        result[index] = hit;
      }
    });
  };
  pass((s, pool) => pool.find((row) => sameEps(row.epsActual, s.epsActual) && inWindow(s.period, row.reportDate)));
  pass((s, pool) => pool.find((row) => sameFiscal(s, row) && inWindow(s.period, row.reportDate)));
  pass((s, pool) => {
    let best: R | undefined;
    let bestGap = Infinity;
    for (const row of pool) {
      if (!inWindow(s.period, row.reportDate)) continue;
      const gap = Math.abs(daysBetweenEt(s.period, row.reportDate));
      if (gap < bestGap) {
        best = row;
        bestGap = gap;
      }
    }
    return best;
  });
  return result;
}

/**
 * Tek bir kayıt için aynı üç adım — `used` çağıranın kümesi, eşleşen satır
 * ona eklenir. Birden çok çeyrek eşleştiriliyorsa `matchReports` kullanın:
 * adımları bütün çeyreklere sırayla uygular.
 */
export function matchReport<R extends ReportRowLike>(
  surprise: SurpriseLike,
  calRows: readonly R[],
  used: Set<R>,
  today?: string,
): R | null {
  const [hit] = matchReports([surprise], calRows.filter((row) => !used.has(row)), today);
  if (hit) used.add(hit);
  return hit;
}

/* --------------------------------------------------------------------------
   Etiket ve adres

   Bilanço analizlerinin dönem adı "2Ç FY2027" / "Q2 FY2027", adres parçası
   "2c-fy2027". Mali yılı takvim yılıyla örtüşen şirketlerde kayıtların
   çoğu FY yazmıyor ("2c-2026") ama kural kayıtta tutarlı değil (ABBV
   "2c-fy2026"). O yüzden bir ekranda aynı şirketin analizi varsa biçim
   ONDAN okunur (`fiscalOfSlug(...).fy`); yoksa `isCalendarAligned` karar
   verir: takvimle örtüşmeyen mali yılda FY yazılır, çünkü "2Ç 2027"
   2027'nin ikinci çeyreği gibi okunur.
   -------------------------------------------------------------------------- */

/** "2Ç FY2027" · "Q2 FY2027" · FY'siz: "2Ç 2026" · "Q2 2026". */
export function fiscalLabel(
  fiscal: FiscalQuarter,
  locale: Locale,
  { fy = true }: { fy?: boolean } = {},
): string {
  const year = `${fy ? "FY" : ""}${fiscal.year}`;
  return locale === "tr" ? `${fiscal.quarter}Ç ${year}` : `Q${fiscal.quarter} ${year}`;
}

/** Analiz adresinin dönem parçası: "2c-fy2027" · "2c-2026". */
export function fiscalSlug(fiscal: FiscalQuarter, { fy = true }: { fy?: boolean } = {}): string {
  return `${fiscal.quarter}c-${fy ? "fy" : ""}${fiscal.year}`;
}

/** "2c-fy2027" → { year: 2027, quarter: 2, fy: true }; tanınmazsa `null`. */
export function fiscalOfSlug(slug: string): (FiscalQuarter & { fy: boolean }) | null {
  const match = /^([1-4])c-(fy)?(\d{4})$/.exec(slug.trim().toLowerCase());
  if (!match) return null;
  return { quarter: Number(match[1]), year: Number(match[3]), fy: Boolean(match[2]) };
}

/**
 * Sürpriz kaydının mali çeyreği; sağlayıcı yıl ya da çeyrek vermediyse
 * `null` — tahmin edilmez.
 */
export function fiscalOf(row: { year: number | null; quarter: number | null }): FiscalQuarter | null {
  if (row.year === null || row.quarter === null) return null;
  if (row.quarter < 1 || row.quarter > 4) return null;
  return { year: row.year, quarter: row.quarter };
}

/**
 * Mali çeyrek, dönem tarihinin TAKVİM çeyreğiyle aynı mı?
 * Aynıysa şirketin mali yılı takvim yılı: etikette FY gerekmez.
 */
export function isCalendarAligned(fiscal: FiscalQuarter, period: string): boolean {
  const [year, month] = period.split("-").map(Number);
  return year === fiscal.year && Math.ceil(month / 3) === fiscal.quarter;
}
