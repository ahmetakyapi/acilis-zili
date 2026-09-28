import { indexMemberOf, isSecondaryShareClass } from "@/db/seed/indices";
import {
  getEarningsBetweenResult,
  getHolidays,
  getSymbolNames,
  type SymbolMeta,
} from "@/lib/data";
import type { Locale } from "@/lib/i18n/config";
import { addEtDays } from "@/lib/market-hours";
import { isSpotlight } from "@/lib/spotlight";
import {
  buildSchedule,
  buildWeek,
  pickNotable,
  WEEK_DAYS,
  type ScheduleDay,
  type ScheduleRow,
  type WeekDay,
} from "@/lib/earnings-week";

export type EarningsWeek = {
  monday: string;
  friday: string;
  days: WeekDay<ScheduleRow>[];
  /** Haftanın tam takvimi, gün gün (haftalık sekmenin alt paneli). */
  schedule: ScheduleDay[];
  /** Sembol tablosunun o haftaki kesiti — şirket kartı kaydı aynı veriyi
      okusun, ikinci bir tur açılmasın. */
  meta: Record<string, SymbolMeta>;
  /** Takvim OKUNAMADI — boş hafta değil. Sayfa boşluk iddiası basmaz. */
  failed: boolean;
  /** Seçilenlerin sayısı ve takvimde o hafta açıklayanların tamamı. */
  picked: number;
  total: number;
  /** Takvim satırlarının en yenisinin güncellenme anı — veri damgası. */
  updatedAt: Date | null;
};

/**
 * Bir haftanın kayda değer bilançoları — sayfa ve iki görsel AYNI çağrıyı
 * yapıyor (CLAUDE.md "Veri dürüstlüğü" 3: aynı liste iki yerde duruyorsa
 * aynı kaynaktan). `getEarningsBetween` ve `getSymbolNames` istek içinde
 * önbellekli; takvim zaten `guncelBilanco` süzgecinden geçiyor (aynı
 * çeyreğin eski tarihli satırı düşüyor).
 *
 * Hata değer olarak dönüyor ve ADIYLA: okunamayan takvim boş bir hafta
 * DEĞİL (`failed`). Görsel onu yine boş hafta olarak çiziyor (bir PNG'nin
 * hata diyecek yeri yok), sayfa ise "takvim alınamadı" der — bir dönem
 * ikisi de "bu hafta kayda değer bilanço yok" diyordu.
 */
export async function getEarningsWeek(monday: string, locale: Locale): Promise<EarningsWeek> {
  const friday = addEtDays(monday, WEEK_DAYS - 1);
  const [result, holidays] = await Promise.all([
    getEarningsBetweenResult(monday, friday),
    getHolidays(),
  ]);
  const rows = result.ok ? result.rows : [];
  /* İkinci hisse sınıfı (GOOG, BRK.A…) aynı şirketin ikinci satırı; görselde
     aynı logo iki kez durmasın. */
  const primary = rows.filter((row) => !isSecondaryShareClass(row.symbol));
  const meta = await getSymbolNames([...new Set(primary.map((row) => row.symbol))]);

  const candidates: ScheduleRow[] = primary.map((row) => ({
    symbol: row.symbol,
    reportDate: row.reportDate,
    hour: row.hour?.trim() || null,
    name: meta[row.symbol]?.name ?? null,
    logoUrl: meta[row.symbol]?.logoUrl ?? null,
    marketCap: meta[row.symbol]?.marketCap ?? null,
    indexMember: indexMemberOf(row.symbol) !== null,
    spotlight: isSpotlight(row.symbol),
    epsEstimate: row.epsEstimate ?? null,
    epsActual: row.epsActual ?? null,
    revenueEstimate: row.revenueEstimate ?? null,
    revenueActual: row.revenueActual ?? null,
    currency: meta[row.symbol]?.currency || null,
  }));
  const picked = pickNotable(candidates);

  const updatedAt = rows.reduce<Date | null>(
    (latest, row) => (latest === null || row.updatedAt > latest ? row.updatedAt : latest),
    null,
  );

  return {
    monday,
    friday,
    days: buildWeek(monday, picked, holidays, locale),
    schedule: buildSchedule(monday, candidates, holidays, locale),
    meta,
    failed: !result.ok,
    picked: picked.length,
    total: new Set(primary.map((row) => row.symbol)).size,
    updatedAt,
  };
}
