import { indexMemberOf, isSecondaryShareClass } from "@/db/seed/indices";
import { getEarningsBetween, getHolidays, getSymbolNames } from "@/lib/data";
import type { Locale } from "@/lib/i18n/config";
import { addEtDays } from "@/lib/market-hours";
import { isSpotlight } from "@/lib/spotlight";
import {
  buildWeek,
  pickNotable,
  WEEK_DAYS,
  type WeekCandidate,
  type WeekDay,
} from "@/lib/earnings-week";

export type EarningsWeek = {
  monday: string;
  friday: string;
  days: WeekDay[];
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
 * Hata değer olarak dönüyor: okunamayan takvim boş bir haftadır, sayfa
 * "bu hafta kayda değer bilanço yok" der ve çökmez.
 */
export async function getEarningsWeek(monday: string, locale: Locale): Promise<EarningsWeek> {
  const friday = addEtDays(monday, WEEK_DAYS - 1);
  const [rows, holidays] = await Promise.all([
    getEarningsBetween(monday, friday),
    getHolidays(),
  ]);
  /* İkinci hisse sınıfı (GOOG, BRK.A…) aynı şirketin ikinci satırı; görselde
     aynı logo iki kez durmasın. */
  const primary = rows.filter((row) => !isSecondaryShareClass(row.symbol));
  const meta = await getSymbolNames([...new Set(primary.map((row) => row.symbol))]);

  const candidates: WeekCandidate[] = primary.map((row) => ({
    symbol: row.symbol,
    reportDate: row.reportDate,
    hour: row.hour?.trim() || null,
    name: meta[row.symbol]?.name ?? null,
    logoUrl: meta[row.symbol]?.logoUrl ?? null,
    marketCap: meta[row.symbol]?.marketCap ?? null,
    indexMember: indexMemberOf(row.symbol) !== null,
    spotlight: isSpotlight(row.symbol),
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
    picked: picked.length,
    total: new Set(primary.map((row) => row.symbol)).size,
    updatedAt,
  };
}
