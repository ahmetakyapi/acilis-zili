import { getSeries } from "./fred";
import { getEvdsMonthly, isEvdsConfigured } from "./evds";
import { getUsdTryOn, type UsdTryOnDate } from "./tcmb";
import { fail, ok, type ProviderResult } from "./types";
import { TR_ZONE, zoneDateKey } from "@/lib/session-clock";
import {
  monthDiff,
  monthOf,
  previousMonth,
  type FxPath,
  type IsoDate,
  type IsoMonth,
  type MonthlyValue,
} from "@/lib/fx";

/**
 * USD/TRY GEÇMİŞİ — TL perspektifinin ağ katmanı.
 *
 * Üç kaynak, üç iş (gerekçeler `lib/fx.ts` başında):
 *   · TCMB arşivi — uçların günlük kesin kuru (döviz alış).
 *   · FRED `CCUSMA02TRM618N` — aradaki ayların ortalaması (anahtar
 *     `FRED_API_KEY`, makro ekranıyla aynı).
 *   · EVDS — TÜFE, yalnızca Reel TL istendiğinde ve anahtar varsa.
 *
 * Uçlar ZORUNLU, aylar ve TÜFE değil: TCMB düşerse yol kurulamaz ve TL
 * görünümü "kur alınamadı" der; FRED düşerse yol iki uç arasında düz kalır
 * ve künye bunu söyler; EVDS düşerse Reel görünüm kapanır.
 */

/** OECD'nin FRED'deki aylık ortalama USD/TRY serisi. */
export const FRED_MONTHLY_USDTRY = {
  seriesId: "CCUSMA02TRM618N",
  slug: "usdtry-monthly",
  units: "lin",
} as const;

/** FRED'den istenen ay sayısına pay: seri bir-iki ay geriden geliyor. */
const MONTHLY_LIMIT_SLACK = 3;
/** 5Y aralığı ve portföyün eski alışları için üst sınır — yirmi yıl. */
const MONTHLY_LIMIT_MAX = 240;

export function istanbulToday(now: Date = new Date()): IsoDate {
  return zoneDateKey(now, TR_ZONE);
}

/** Tek bir günün kuru — vergi hesaplayıcısı ve portföy bunu soruyor. */
export function getUsdTryAt(date: IsoDate): Promise<ProviderResult<UsdTryOnDate>> {
  return getUsdTryOn(date, istanbulToday());
}

export async function getFxPath(
  start: IsoDate,
  end: IsoDate,
  options: { real?: boolean } = {},
): Promise<ProviderResult<FxPath> & { monthlyAvailable?: boolean }> {
  const today = istanbulToday();
  const wantReal = Boolean(options.real) && isEvdsConfigured();
  const months = monthDiff(monthOf(start), monthOf(today)) + MONTHLY_LIMIT_SLACK;
  /* TÜFE başlangıç ayından ÖNCEKİ aydan isteniyor: ayın ilk günlerinde
     başlayan bir aralıkta o ayın endeksi henüz yok olabilir ama bir önceki
     ay vardır — basamak (`cpiAt`) onu kullanır. */
  const cpiFrom: IsoMonth = previousMonth(monthOf(start));

  const [startRate, endRate, monthly, cpi] = await Promise.all([
    getUsdTryOn(start, today),
    getUsdTryOn(end, today),
    getSeries(FRED_MONTHLY_USDTRY, Math.min(MONTHLY_LIMIT_MAX, Math.max(1, months))),
    wantReal
      ? getEvdsMonthly("cpi", cpiFrom, monthOf(end))
      : Promise.resolve(null),
  ]);

  if (!startRate.ok) return startRate;
  if (!endRate.ok) return endRate;
  if (!(startRate.data.buying > 0) || !(endRate.data.buying > 0)) {
    return fail("tcmb", "empty", "Kur sıfır ya da boş geldi");
  }

  /* Yalnızca aralığın ayları gidiyor: FRED'den pay bırakılarak fazla ay
     isteniyor (seri geriden geliyor) ve fazlası yanıtı boşuna şişiriyordu. */
  const fromMonth = monthOf(start);
  const toMonth = monthOf(end);
  const monthlyValues: MonthlyValue[] = monthly.ok
    ? monthly.data.observations
        .map((o) => ({ month: o.date.slice(0, 7), value: o.value }))
        .filter((entry) => entry.month >= fromMonth && entry.month <= toMonth)
    : [];

  const path: FxPath = {
    start: {
      requested: start,
      date: startRate.data.bulletinDate,
      rate: startRate.data.buying,
    },
    end: {
      requested: end,
      date: endRate.data.bulletinDate,
      rate: endRate.data.buying,
    },
    monthly: monthlyValues,
    cpi: cpi && cpi.ok ? cpi.data : null,
  };
  return {
    ...ok(path, "tcmb", { fetchedAt: endRate.fetchedAt }),
    monthlyAvailable: monthly.ok,
  };
}
