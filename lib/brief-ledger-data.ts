import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { INDEX_STRIP } from "@/db/seed/symbols";
import {
  findStockMentions,
  ledgerComplete,
  ledgerMove,
  ledgerWindow,
  metricFromObservations,
  type LedgerMetric,
  type LedgerMove,
  type LedgerPeriod,
  type LedgerWindow,
  type Observation,
} from "@/lib/brief-ledger";
import { getHolidays, getSymbolNames } from "@/lib/data";
import { posterReadyAt, posterRetryable } from "@/lib/day-poster";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { alpaca } from "@/lib/providers";
import { getDailyMarketSeries } from "@/lib/providers/daily-markets";
import { DAILY_MARKET_SERIES } from "@/lib/providers/fred";
import { istanbulToday } from "@/lib/providers/fx-history";
import { getUsdTryOn } from "@/lib/providers/tcmb";

/**
 * Kayıt Defteri'nin veri tarafı — kurallar `lib/brief-ledger.ts`te.
 *
 * ÜÇ KAYNAK, HER BİRİ SEANSINA BAĞLI:
 *   - Endeks ve hisse yüzdeleri Alpaca'nın gün barlarından, Günün
 *     Posteri'yle aynı istek biçimi ve aynı `dayChange` (lib/day-poster-data.ts).
 *   - 10 yıllık faiz ve VIX, ana sayfanın ve alt şeridin günlük kapanış
 *     kaynağından (`getDailyMarketSeries`: Treasury/Cboe, FRED yedeği).
 *   - Dolar/TL TCMB bülteninden (`getUsdTryOn`, vergi ve TL görünümüyle
 *     aynı arşiv); bülten o güne ait değilse ölçü kalkar.
 *
 * Bir parça düşerse yalnız o parça kalkar; endeksler yoksa bant hiç
 * basılmaz (null). Hata hiçbir zaman sayfayı düşürmez — bant metnin
 * yanındaki bir görsel, metnin kendisi değil.
 */

/** Önceki seanstan bu kadar takvim günü geri başlanıyor (posterle aynı pay). */
const START_PAD_DAYS = 3;
/** Tamamlanmış dönemin barları değişmiyor. */
const LEDGER_REVALIDATE_SECONDS = 86_400;
/** Yeni seansın ham isteği kısa tutuluyor — gerekçe `POSTER_RETRY_SECONDS`. */
const LEDGER_RETRY_SECONDS = 900;
/** Günlük kapanış serisinden istenen gözlem: ~3 ay, arşivin yakın sayıları. */
const SERIES_LIMIT = 60;

const LEDGER_PENDING = "LedgerPending";

const SERIES = {
  us10y: DAILY_MARKET_SERIES.find((series) => series.seriesId === "DGS10"),
  vix: DAILY_MARKET_SERIES.find((series) => series.seriesId === "VIXCLS"),
} as const;

/**
 * Bant için sembollerin dönem hareketi. Önbelleğe yalnız SONUÇ girer;
 * sağlayıcı hatası ve yeni seansın eksiği fırlatılıyor (posterin kuralı,
 * CLAUDE.md "İstekler arası önbellek"). Anahtar sürümlü.
 */
const loadMoves = unstable_cache(
  async function loadMoves(symbolsKey: string, windowJson: string, retryable: boolean) {
    const window = JSON.parse(windowJson) as LedgerWindow;
    const holidays = await getHolidays();
    const symbols = symbolsKey.split(",");
    const result = await alpaca.getDailyBarsBetween(
      symbols,
      addEtDays(window.prevSession, -START_PAD_DAYS),
      posterReadyAt(window.session, holidays),
      retryable ? LEDGER_RETRY_SECONDS : LEDGER_REVALIDATE_SECONDS,
    );
    if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
    const moves: Record<string, LedgerMove | null> = {};
    for (const symbol of symbols) moves[symbol] = ledgerMove(symbol, result.data[symbol], window, holidays);
    if (retryable && !moves.SPY) {
      const pending = new Error(`${window.session} henüz eksik`);
      pending.name = LEDGER_PENDING;
      throw pending;
    }
    return { moves, fetchedAt: result.fetchedAt.toISOString() };
  },
  ["brief-ledger-moves-v1"],
  { revalidate: LEDGER_REVALIDATE_SECONDS },
);

export type LedgerStock = LedgerMove & {
  name: string;
  logoUrl: string | null;
  /** Metindeki biçimi — geçişi bantla bağlamak için. */
  alias: string;
};

export type BriefLedgerData = {
  window: LedgerWindow;
  /** `INDEX_STRIP` sırasında; değişimi olmayan düşer. */
  indices: LedgerMove[];
  metrics: LedgerMetric[];
  stocks: LedgerStock[];
  fetchedAt: string;
};

const MEMBERS = primaryOnly(ALL_MEMBERS).map((member) => ({ symbol: member.symbol, name: member.name }));
const INDEX_SET: ReadonlySet<string> = new Set(INDEX_STRIP);

/** Markdown işaretleri ayıklanmış düz metin — ad aramasına. */
function plainText(markdown: string): string {
  return markdown.replace(/\*\*?/g, "").replace(/^#+\s*/gm, "").replace(/^- /gm, "");
}

async function seriesMetric(key: "us10y" | "vix", window: LedgerWindow): Promise<LedgerMetric | null> {
  const definition = SERIES[key];
  if (!definition) return null;
  try {
    const result = await getDailyMarketSeries(definition, SERIES_LIMIT);
    if (!result.ok) return null;
    return metricFromObservations(key, result.data.observations, window);
  } catch {
    return null;
  }
}

/** Dolar/TL: dönemin son bülteni ve dönemden önceki son bülten (satış). */
async function usdTryMetric(window: LedgerWindow): Promise<LedgerMetric | null> {
  try {
    const today = istanbulToday();
    const [current, prev] = await Promise.all([
      getUsdTryOn(window.to, today),
      getUsdTryOn(addEtDays(window.from, -1), today),
    ]);
    if (!current.ok || !prev.ok) return null;
    const points: Observation[] = [
      { date: prev.data.bulletinDate, value: prev.data.selling },
      { date: current.data.bulletinDate, value: current.data.selling },
    ];
    return metricFromObservations("usdtry", points, window);
  } catch {
    return null;
  }
}

/**
 * Bir bülten sayısının bandı. `detail: false` (ana sayfa kartı) yalnız
 * endeksleri çeker: kart bandın küçük hâlini taşıyor, ölçü ve hisse yok.
 */
export const getBriefLedger = cache(async function getBriefLedger(
  briefDate: string,
  period: LedgerPeriod,
  bodyMd: string,
  detail: boolean,
): Promise<BriefLedgerData | null> {
  try {
    const holidays = await getHolidays();
    const window = ledgerWindow(briefDate, period, holidays);
    if (!window || !ledgerComplete(window, holidays, new Date())) return null;

    const mentions = detail ? findStockMentions(plainText(bodyMd), MEMBERS, INDEX_SET) : [];
    const symbols = [...new Set([...INDEX_STRIP, ...mentions.map((mention) => mention.symbol)])].sort();
    const retryable = posterRetryable(window.session, todayEt());

    const [loaded, metrics, names] = await Promise.all([
      loadMoves(symbols.join(","), JSON.stringify(window), retryable).catch((error: unknown) => {
        if (!(error instanceof Error && error.name === LEDGER_PENDING)) {
          console.error(`[ledger] ${briefDate} okunamadı: ${error instanceof Error ? error.message : String(error)}`);
        }
        return null;
      }),
      detail
        ? Promise.all([seriesMetric("us10y", window), seriesMetric("vix", window), usdTryMetric(window)])
        : Promise.resolve([] as (LedgerMetric | null)[]),
      mentions.length > 0 ? getSymbolNames(mentions.map((mention) => mention.symbol)) : Promise.resolve({}),
    ]);
    if (!loaded) return null;

    const indices = INDEX_STRIP.flatMap((symbol) => {
      const move = loaded.moves[symbol];
      return move ? [move] : [];
    });
    if (indices.length === 0) return null;

    const stocks = mentions.flatMap((mention): LedgerStock[] => {
      const move = loaded.moves[mention.symbol];
      if (!move) return [];
      const meta = (names as Record<string, { name: string; logoUrl: string | null }>)[mention.symbol];
      const member = MEMBERS.find((entry) => entry.symbol === mention.symbol);
      return [
        {
          ...move,
          name: member?.name ?? meta?.name ?? mention.symbol,
          logoUrl: meta?.logoUrl ?? null,
          alias: mention.alias,
        },
      ];
    });

    return {
      window,
      indices,
      metrics: metrics.filter((metric): metric is LedgerMetric => metric !== null),
      stocks,
      fetchedAt: loaded.fetchedAt,
    };
  } catch (error) {
    console.error(`[ledger] ${briefDate}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
});
