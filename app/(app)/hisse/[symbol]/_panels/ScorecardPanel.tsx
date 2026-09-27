import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScaleBar } from "@/components/markets/CompareScale";
import { indexMemberOf } from "@/db/seed/indices";
import { getStatus, getSymbolNames } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { boundedTtl, candleTtlSeconds, etParts } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { getPeriodChanges } from "@/lib/providers/alpaca";
import { getRawMetrics } from "@/lib/providers/finnhub-depth";
import {
  MOMENTUM_SESSIONS,
  SCORECARD_MIN_PEERS,
  scoreCard,
  storedMetricsFrom,
  trAblative,
  type ScoreSubject,
} from "@/lib/scorecard";
import { getSectorMetrics, rememberOwnMetrics } from "@/lib/symbol-metrics";
import { sectorLabel } from "@/lib/sectors";
import { cn, formatEtDateMedium, formatPercentPlain } from "@/lib/utils";
import styles from "./depth.module.css";

/**
 * Momentumun barları en az bir saat önbellekte. Altı aylık getiri seans
 * içinde anlamlı ölçüde oynamıyor ve istek sektörün tamamını (~70 sembol,
 * ~9.000 bar) taşıyor; grafiklerin 15 dakikalık ömrü burada israf olurdu.
 * Seans sınırına yine kırpılıyor (`boundedTtl`).
 */
const MOMENTUM_MIN_TTL_S = 60 * 60;

/**
 * Hisse skor kartı — beş eksenin sektör yüzdeliği. Yöntem ve seçilen
 * ölçüler lib/scorecard.ts; tablo ve tazeleme lib/symbol-metrics.ts.
 *
 * YALNIZCA ENDEKS ÜYELERİNDE (GICS sektörü bilinen). Tablo yoksa panel hiç
 * basılmıyor; tablo var ama sektör henüz yeterince dolmadıysa "Hazırlanıyor"
 * diyor ve kaç şirket gerektiğini söylüyor. Sayfa bu şirketin metriğini
 * zaten çekiyor; satırını buradan yazıyor (ek istek yok).
 */
export async function ScorecardPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const d = t.stockDepth;
  const sector = indexMemberOf(symbol)?.sector;
  if (!sector) return null;

  const [rows, raw, meta, status] = await Promise.all([
    getSectorMetrics(sector),
    getRawMetrics(symbol),
    getSymbolNames([symbol]),
    getStatus(),
  ]);
  if (rows === null) return null;

  const currency = meta[symbol]?.currency ?? null;
  const own = rows.find((row) => row.symbol === symbol);
  if (raw.ok) await rememberOwnMetrics(symbol, raw.data, currency, own);
  const ownMetrics = raw.ok ? storedMetricsFrom(raw.data) : own?.metrics ?? null;

  const peerRows = rows.filter((row) => row.symbol !== symbol);
  const header = (
    <PanelHeader
      title={d.scTitle}
      meta={sectorLabel(sector, locale) ?? undefined}
    />
  );
  const preparing = (
    <Panel className={styles.panel}>
      {header}
      <EmptyState
        compact
        title={d.scPreparing}
        hint={d.scPreparingHint.replace("{n}", String(SCORECARD_MIN_PEERS))}
      />
    </Panel>
  );
  if (!ownMetrics || peerRows.length < SCORECARD_MIN_PEERS) return preparing;

  const universe = [symbol, ...peerRows.map((row) => row.symbol)];
  const [quotes, momentum] = await Promise.all([
    getQuotes(universe, status),
    getPeriodChanges(
      universe,
      MOMENTUM_SESSIONS,
      boundedTtl(Math.max(candleTtlSeconds("6M", status), MOMENTUM_MIN_TTL_S), status),
    ),
  ]);
  /* Bayat kotasyon değerlemeye girmez — fiyat "canlı" diye kurulan bir oranın
     paydası; önbellekten gelen dünkü fiyat sıralamayı sessizce kaydırırdı. */
  const priceOf = (s: string) => (quotes.ok && !quotes.stale ? (quotes.data[s]?.price ?? null) : null);
  const momentumOf = (s: string) => (momentum.ok ? (momentum.data[s] ?? null) : null);

  const subject: ScoreSubject = {
    symbol,
    currency,
    metrics: ownMetrics,
    price: priceOf(symbol),
    momentum: momentumOf(symbol),
  };
  const peers: ScoreSubject[] = peerRows.map((row) => ({
    symbol: row.symbol,
    currency: row.currency,
    metrics: row.metrics,
    price: priceOf(row.symbol),
    momentum: momentumOf(row.symbol),
  }));
  const card = scoreCard(subject, peers);
  if (card.length === 0) return preparing;

  const oldest = peerRows.reduce((min, row) => (row.updatedAt < min ? row.updatedAt : min), peerRows[0]!.updatedAt);
  const oldestDay = etParts(oldest).dateStr;
  const companies = Math.max(...card.map((axis) => axis.peers)) + 1;

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={d.scTitle}
        meta={`${sectorLabel(sector, locale) ?? sector} · ${d.scPeers.replace("{n}", String(companies))}`}
      />
      <div className={styles.body}>
        <ul className={styles.axisList}>
          {card.map((axis) => (
            <li key={axis.axis} className={styles.axisRow}>
              <span className="min-w-0">
                <span className={cn("block", styles.axisName)}>{d.scAxes[axis.axis]}</span>
                <span className={cn("block", styles.axisSentence)}>
                  {d.scSentence[axis.axis]
                    .replace("{p}", String(axis.percentile))
                    .replace("{ek}", locale === "tr" ? trAblative(axis.percentile) : "")}
                </span>
                <span className={cn("block", styles.axisMetrics)}>
                  {axis.metrics.map((key) => d.scMetrics[key]).join(" · ")}
                </span>
              </span>
              <span className={styles.axisFigure}>
                <span className={cn("numeral", styles.axisPct)}>{formatPercentPlain(axis.percentile, locale, 0)}</span>
                {/* Büyüklük, yargı değil: tek ton, yön rengi yok. */}
                <ScaleBar ratio={axis.percentile / 100} signed={false} />
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>{d.scNote}</p>
        <DataStamp
          labels={t.data}
          source="finnhub"
          locale={locale}
          note={d.scOldest.replace("{date}", formatEtDateMedium(oldestDay, locale))}
          className={styles.stamp}
        />
      </div>
    </Panel>
  );
}
