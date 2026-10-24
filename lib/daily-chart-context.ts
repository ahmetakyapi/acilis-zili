import "server-only";

import { unstable_cache } from "next/cache";
import { INDEX_STRIP, SECTOR_FUNDS } from "@/db/seed/symbols";
import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { getEventsBetween, getMacroRows, getStatus, getSymbolNames } from "@/lib/data";
import { getChartBarsMulti } from "@/lib/providers";
import { COMMODITY_ETFS, CRYPTO_ETFS } from "@/lib/market-boards";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import { getEarningsWithOverrides } from "@/lib/earnings-overrides";
import { getRecentDailyCharts } from "@/lib/daily-chart-data";
import {
  breadthOf,
  formatted,
  moveFields,
  moveOver,
  pickMovers,
  signedPct,
  universeCovered,
} from "@/lib/daily-chart";
import type { Bar } from "@/lib/providers/types";

/* ==========================================================================
   Günün Grafiği — rutinin bağlam paketi (24 Ekim)

   `/api/grafik/context` bunu döndürüyor, `/api/grafik` POST'u aynı paketi
   yeniden kurup metindeki her sayıyı onun içinde arıyor
   (`lib/ai-grounding.ts`). İki tarafın AYNI paketi görmesi şart; bu yüzden:

   1. HER SAYI TAMAMLANMIŞ GÜNLÜK BARDAN. Canlı kotasyon yok: açılış öncesi
      ve akşam seansında kotasyonun yüzdesi hangi seansı anlattığını
      kanıtlamıyor (CLAUDE.md "Veri dürüstlüğü" 4) ve her dakika değişiyor.
      Kapanmış bir günün barı değişmez; GET ile POST arasında da değişmez.
      Barlar `allowCache: false` ile isteniyor — sağlayıcı düşerse Neon
      önbelleğindeki ESKİ seri bugünün diye gelmesin; o sembol pakette
      `null` olur ve `missing` listesinde adıyla yazar.
   2. SAYILAR BİÇİMLENMİŞ OLARAK DA VERİLİYOR (`tr` / `en`). Model metne
      onları kopyalıyor; ham `1.2345`ten "%1,2" türetmesi sayı denetimini
      düşürürdü (gerekçe `lib/daily-chart.ts` → `formatted`).
   3. ÖNBELLEK GÜN BAŞINA, YALNIZ TAM PAKET. Kapanmış günün paketi değişmiyor
      ve evren (S&P 500 + Nasdaq 100 + Dow) barları POST'ta yeniden
      çekilmesin. Eksik paket (sağlayıcı düşmüş) önbelleğe GİRMEZ: hata
      önbelleğin dışında yakalanıyor (`loadSymbolTable` kalıbı) — eksik
      paket bir sonraki istekte yeniden denenir.

   Takvimin `actual` alanı DOLDURULMUYOR: bültenin bağlamı boş `actual`ı
   FRED'den çekip YAZIYOR (`fillEventActuals`); bu uç salt okur. Rutin
   bültenden sonra koştuğu için açıklanmış veri o saatte zaten yazılmış
   oluyor; yazılmamışsa `actual: null` ve rutin o sayıyı kullanmıyor.
   ========================================================================== */

/** Hareket ufukları — seans sayısı. 21 seans ≈ bir takvim ayı. */
const HORIZONS = { d1: 1, d5: 5, d21: 21 } as const;
/** Öne çıkan hareketlerde kaç isim — her yönde. */
const MOVER_COUNT = 8;
/** Bilanço açıklayanlardan kaçı (piyasa değerine göre). */
const EARNINGS_COUNT = 10;
/** Son kaç grafik listelenir — aynı konuyu üst üste seçmemek için. */
const RECENT_CHARTS = 10;
/** Önbellek: kapanmış günün paketi değişmez; altı saat yeter ve gün dönünce düşer. */
const CONTEXT_TTL_SECONDS = 6 * 60 * 60;

type Entry = { symbol: string; nameTr: string; nameEn: string };

const INDEX_ENTRIES: Entry[] = INDEX_STRIP.map((symbol) => ({
  symbol,
  nameTr: CARD_INDEX_NAMES[symbol] ?? symbol,
  nameEn: CARD_INDEX_NAMES[symbol] ?? symbol,
}));

function groupRows(entries: readonly Entry[], bars: Record<string, Bar[]>, day: string) {
  return entries.map((entry) => {
    const series = bars[entry.symbol] ?? [];
    return {
      symbol: entry.symbol,
      name_tr: entry.nameTr,
      name_en: entry.nameEn,
      d1: moveFields(moveOver(series, day, HORIZONS.d1)),
      d5: moveFields(moveOver(series, day, HORIZONS.d5)),
      d21: moveFields(moveOver(series, day, HORIZONS.d21)),
    };
  });
}

/** Grupta artıda / ekside kapanan sayısı — "11 sektörün 9'u" cümlesi buradan. */
function tally(rows: { d1: { pct: { value: number } } | null }[]) {
  const known = rows.filter((row) => row.d1 !== null) as { d1: { pct: { value: number } } }[];
  return {
    total: rows.length,
    known: known.length,
    up: known.filter((row) => row.d1.pct.value > 0).length,
    down: known.filter((row) => row.d1.pct.value < 0).length,
  };
}

async function build(day: string) {
  const status = await getStatus();
  const groupSymbols = [
    ...INDEX_ENTRIES,
    ...SECTOR_FUNDS,
    ...COMMODITY_ETFS,
    ...CRYPTO_ETFS,
  ].map((entry) => entry.symbol);
  const universe = primaryOnly(ALL_MEMBERS);

  const [groupBars, universeBars, events, earnings, macro, recent] = await Promise.all([
    getChartBarsMulti(groupSymbols, "3M", status, { allowCache: false }),
    getChartBarsMulti(universe.map((member) => member.symbol), "1M", status, { allowCache: false }),
    getEventsBetween(day, day),
    getEarningsWithOverrides(day, day).catch(() => []),
    getMacroRows(),
    getRecentDailyCharts(RECENT_CHARTS),
  ]);

  const indices = groupRows(INDEX_ENTRIES, groupBars, day);
  const sectors = groupRows(SECTOR_FUNDS, groupBars, day);
  const commodities = groupRows(COMMODITY_ETFS, groupBars, day);
  const crypto = groupRows(CRYPTO_ETFS, groupBars, day);

  const universeMoves = universe.map((member) => {
    const move = moveOver(universeBars[member.symbol] ?? [], day, HORIZONS.d1);
    return { symbol: member.symbol, name: member.name, sector: member.sector ?? null, pct: move?.pct ?? null, move };
  });
  const universeKnown = universeMoves.filter((row) => row.pct !== null).length;
  const covered = universeCovered(universeKnown, universe.length);
  const { gainers, losers } = pickMovers(universeMoves, MOVER_COUNT);
  const moverRow = (row: (typeof universeMoves)[number]) => ({
    symbol: row.symbol,
    name: row.name,
    sector: row.sector,
    ...moveFields(row.move),
  });

  const reporters = await getSymbolNames([...new Set(earnings.map((row) => row.symbol))]);
  const notableEarnings = earnings
    .filter((row) => reporters[row.symbol]?.marketCap)
    .sort((a, b) => (reporters[b.symbol]?.marketCap ?? 0) - (reporters[a.symbol]?.marketCap ?? 0))
    .slice(0, EARNINGS_COUNT)
    .map((row) => {
      const move = moveOver(universeBars[row.symbol] ?? groupBars[row.symbol] ?? [], day, HORIZONS.d1);
      return {
        symbol: row.symbol,
        name: reporters[row.symbol]?.name ?? null,
        timing: row.hour,
        eps_estimate: row.epsEstimate === null ? null : formatted(row.epsEstimate),
        eps_actual: row.epsActual === null ? null : formatted(row.epsActual),
        /* Gelir milyar dolar: ham 8.97e9'dan "8,97 milyar" türetmek sayı
           denetimini düşürürdü. */
        revenue_estimate_bn: row.revenueEstimate === null ? null : formatted(row.revenueEstimate / 1e9),
        revenue_actual_bn: row.revenueActual === null ? null : formatted(row.revenueActual / 1e9),
        /* O günün kapanış hareketi — AMC bilançosunun tepkisi ertesi gün. */
        session_move: moveFields(move),
      };
    });

  const missing = [...groupSymbols].filter((symbol) => !moveOver(groupBars[symbol] ?? [], day, HORIZONS.d1));

  const context = {
    session: {
      date_et: day,
      /* Bu paketin bütün yüzdeleri kapanıştan kapanışa; `d1` bu günün,
         `d5` / `d21` beş ve yirmi bir seanslık. Taban günü her satırda. */
      basis: "close-to-close daily bars (Alpaca SIP, split-adjusted)",
    },
    indices,
    indices_tally: tally(indices),
    sectors,
    sectors_tally: tally(sectors),
    commodities,
    crypto,
    breadth: breadthOf(
      universeMoves.map((row) => ({ symbol: row.symbol, pct: row.pct })),
      universe.length,
    ),
    /* Evrenin %80'inden azı okunduysa null — yarım evrenden "en çok
       yükselenler" denmez (`universeCovered`). */
    movers: covered ? { gainers: gainers.map(moverRow), losers: losers.map(moverRow) } : null,
    economic_events: events.map((event) => ({
      slug: event.slug,
      time_et: event.eventTimeEt,
      title_tr: event.titleTr,
      title_en: event.titleEn,
      importance: event.importance,
      actual: event.actual,
      forecast: event.forecast,
      previous: event.previous,
      unit: event.unit,
    })),
    earnings: { total_count: earnings.length, notable: notableEarnings },
    /* Makro serilerin SON değeri — dönemiyle. Günlük değil; "bu ay
       açıklanan enflasyon" gibi bir arka plan için. Dönemi metinde yaz. */
    macro_latest: macro
      .filter((row) => row.latestValue !== null)
      .map((row) => ({
        slug: row.slug,
        title_tr: row.titleTr,
        title_en: row.titleEn,
        latest: formatted(row.latestValue as number),
        previous: row.prevValue === null ? null : formatted(row.prevValue),
        change: row.prevValue === null ? null : signedPct(((row.latestValue as number) - row.prevValue)),
        unit: row.unit,
        period: row.periodLabel,
      })),
    /* Son grafikler — aynı konuyu (aynı sektör panosu, aynı çift) üst üste
       seçme. `available: false` tablo henüz yok demek. */
    recent_charts: {
      available: recent.available,
      items: recent.rows.map((row) => ({ date: row.chartDate, locale: row.locale, title: row.title })),
    },
    /* Barı gelmeyen semboller — pakette `null`. Sayıyı tahmin etme. */
    missing,
  };

  /* PAKET TAM MI: endekslerin dördü de VE evrenin %80'i okunmuş olmalı.
     Yalnız endekslere bakılıyordu (25 Ekim düzeltmesi); evren yarım
     okunduğunda genişlik `null` ve öne çıkanlar yarım listeyken paket "tam"
     sayılıp altı saat önbellekte kalıyordu: rutin o gün genişliksiz yazıyor,
     sağlayıcı toparlansa da paket tazelenmiyordu. Şimdi eksik paket
     önbelleğe girmez ve POST 503 döner; rutin tekrar dener. */
  const complete = indices.every((row) => row.d1 !== null) && covered;
  return { context, complete, coverage: { members: universe.length, known: universeKnown } };
}

export type DailyChartContext = Awaited<ReturnType<typeof build>>["context"];

type Coverage = Awaited<ReturnType<typeof build>>["coverage"];

/** Önbelleğe girmeyecek eksik paketi dışarı taşıyan hata. */
class EksikPaket extends Error {
  constructor(
    readonly context: DailyChartContext,
    readonly coverage: Coverage,
  ) {
    super("daily-chart-context-incomplete");
  }
}

const cachedContext = unstable_cache(
  async function cachedContext(day: string): Promise<DailyChartContext> {
    const { context, complete, coverage } = await build(day);
    if (!complete) throw new EksikPaket(context, coverage);
    return context;
  },
  /* Sürümlü anahtar — paketin ŞEKLİ değişirse sürüm artar (CLAUDE.md
     "İstekler arası önbellek": önbellek dağıtımlar arası ortak). */
  /* v2 (25 Ekim): `movers` artık null olabiliyor. */
  ["daily-chart-context-v2"],
  { revalidate: CONTEXT_TTL_SECONDS },
);

/**
 * Bir işlem gününün bağlam paketi. `complete: false`: endeks barları yok
 * ya da evrenin %80'i okunamadı; rutin YAZMAMALI ve uç POST'ta 503 döner
 * (`coverage` kaçının okunduğunu söyler).
 */
export async function loadDailyChartContext(
  day: string,
): Promise<{ context: DailyChartContext; complete: boolean; coverage?: Coverage }> {
  try {
    return { context: await cachedContext(day), complete: true };
  } catch (error) {
    if (error instanceof EksikPaket) return { context: error.context, complete: false, coverage: error.coverage };
    throw error;
  }
}

