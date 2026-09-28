import { DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
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
  axisDistribution,
  medianOf,
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
  /* HAZIRLANIYORKEN PANEL YOK (28 Eylül). Boş bir "Hazırlanıyor" paneli
     derinlik ızgarasında analist tablosunun yanında 220 piksellik bir kutu
     olarak duruyor ve satırın geri kalanını boş bırakıyordu (NVDA, ölçüldü).
     Ölçüler toplanınca panel kendiliğinden geliyor; o zamana kadar ızgara
     kalan panellerle kuruluyor. */
  const preparing = null;
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
  const spread = axisDistribution(subject, peers);

  const oldest = peerRows.reduce((min, row) => (row.updatedAt < min ? row.updatedAt : min), peerRows[0]!.updatedAt);
  const oldestDay = etParts(oldest).dateStr;
  const companies = Math.max(...card.map((axis) => axis.peers)) + 1;

  return (
    <Panel className={cn(styles.panel, styles.scorePanel)}>
      <PanelHeader
        title={d.scTitle}
        meta={`${sectorLabel(sector, locale) ?? sector} · ${d.scPeers.replace("{n}", String(companies))}`}
      />
      <div className={styles.body}>
        {/* SIKI SATIR (28 Eylül, sahibinin isteği: "çok büyük"). Her eksen
            üç satır ve 72 piksel taşıyordu (ad, cümle, ölçü künyesi; 390'da
            91) ve panel 1280'de 529, 390'da 637 pikseldi. Artık ad, şerit
            ve yüzde TEK hatta; cümle ile ölçü adları altında tek künye. */}
        <ul className={styles.axisList} data-motion-stagger>
          {card.map((axis) => {
            const values = spread[axis.axis] ?? [];
            const median = medianOf(values);
            const pct = formatPercentPlain(axis.percentile, locale, 0);
            return (
              <li key={axis.axis} className={styles.axisRow}>
                <span className={styles.axisName}>{d.scAxes[axis.axis]}</span>
                <ScoreStrip
                  percentile={axis.percentile}
                  values={values}
                  median={median}
                  label={d.scStrip
                    .replace("{n}", String(values.length))
                    .replace("{m}", median === null ? "–" : formatPercentPlain(median, locale, 0))
                    .replace("{p}", pct)}
                />
                <span className={cn("numeral", styles.axisPct)}>{pct}</span>
                <span className={styles.axisMeta}>
                  <span className={styles.axisSentence}>
                    {d.scSentence[axis.axis]
                      .replace("{p}", String(axis.percentile))
                      .replace("{ek}", locale === "tr" ? trAblative(axis.percentile) : "")}
                  </span>
                  {" · "}
                  {axis.metrics.map((key) => d.scMetrics[key]).join(", ")}
                </span>
              </li>
            );
          })}
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

/**
 * Dağılım şeridi — eksenin sektördeki yayılımı ve konunun yeri (28 Eylül).
 *
 * Eski çubuk yalnızca yüzdeyi uzunluk olarak tekrar ediyordu; yanında
 * yazan sayıdan başka bir şey söylemiyordu. Şerit o sayıya iki bilgi
 * ekliyor: sektördeki öteki şirketler nerede duruyor (ince çentikler,
 * `axisDistribution` — aynı yöntem, kendisi hariç herkese karşı) ve
 * sektörün ortası nerede (uzun çizgi, medyan). Dolu ray konunun yüzdeliği,
 * yuvarlak işaret konunun kendisi.
 *
 * TEK TON, YARGI YOK. Yüksek yüzdelik "iyi" demek değil (lib/scorecard.ts
 * başlığı), o yüzden yön rengi yok: ray ve işaret marka tonunda, çentikler
 * nötr. İşaret medyandan kalkıp kendi yerine kayıyor (`travel`): hareketin
 * kendisi "sektörün ortasına göre nerede" sorusunun cevabı.
 */
function ScoreStrip({
  percentile,
  values,
  median,
  label,
}: {
  percentile: number;
  values: readonly number[];
  median: number | null;
  label: string;
}) {
  return (
    <span className={styles.strip} role="img" aria-label={label}>
      <span className={styles.stripRail} aria-hidden>
        <i data-motion-draw="line" style={{ width: `${percentile}%` }} />
      </span>
      {values.map((value, index) => (
        <i key={index} aria-hidden className={styles.stripTick} style={{ left: `${value}%` }} />
      ))}
      {median !== null && <i aria-hidden className={styles.stripMedian} style={{ left: `${median}%` }} />}
      <i
        aria-hidden
        className={styles.stripDot}
        data-motion-draw="travel"
        data-delta={((median ?? percentile) - percentile).toFixed(2)}
        style={{ left: `${percentile}%` }}
      />
    </span>
  );
}
