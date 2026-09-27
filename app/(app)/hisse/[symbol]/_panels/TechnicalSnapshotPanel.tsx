import { DataError, DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getChartBars, getQuote } from "@/lib/providers";
import { computeSnapshot } from "@/lib/technical";
import {
  cn,
  hareketliOrtalama,
  directionOf,
  directionText,
  formatEtDateMedium,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  formatVolume,
  NO_VALUE,
} from "@/lib/utils";
import styles from "./depth.module.css";

/** RSI cetvelindeki iki referans çizgisi — yorum değil, ölçeğin işaretleri. */
const RSI_MARKS = [30, 70] as const;
/** Ortalama penceresi — 50/100/200 Değerleme bölümündeki panelde. */
const SHORT_MA = 20;

/**
 * Teknik fotoğraf — teknik analiz listesinde OLMAYAN her hisse için.
 *
 * Göstergeler `/api/teknik/context`in kullandığı hesabın kendisi
 * (`computeSnapshot`, lib/technical.ts): ortalama, RSI, MACD, ATR, hacim ve
 * pivotlar son TAMAMLANMIŞ seanstan. Listedeki on beş hisse zaten günlük
 * yazılı analizini (`StockTechnicalCard`) taşıyor; burası YORUMSUZ: ne
 * "aşırı alım" ne "al" — yalnızca sayılar ve ölçeğin işaretleri. Barlar
 * Hareketli Ortalamalar paneliyle aynı istek (`getChartBars` "1Y"), yeni
 * sağlayıcı turu yok.
 *
 * BAYAT KOTASYON: fiyat yalnızca taze kotasyondan; önbellekten gelmişse
 * fiyata uzaklıklar yazılmıyor, göstergeler (kapanıştan) yine duruyor.
 */
export async function TechnicalSnapshotPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const d = t.stockDepth;
  const tt = t.technical;
  const status = await getStatus();
  const [bars, quote] = await Promise.all([getChartBars(symbol, "1Y", status), getQuote(symbol, status)]);
  if (!bars.ok || bars.data.length === 0) {
    return (
      <Panel className={styles.panel}>
        <PanelHeader title={d.tsTitle} />
        <DataError message={t.data.failed} />
      </Panel>
    );
  }
  const live = quote.ok && !quote.stale ? quote.data : null;
  const snap = computeSnapshot(bars.data, live, status);
  const price = snap.price;
  const closes = bars.data.map((bar) => bar.close);
  /* 20 günlük ortalama fotoğrafta var; fark canlı fiyata göre. */
  const ma20 = snap.sma20 ?? hareketliOrtalama(closes, SHORT_MA);
  const gap = (level: number | null) =>
    level !== null && price !== null && level > 0 ? ((price - level) / level) * 100 : null;
  const volumeRatio =
    snap.lastVolume !== null && snap.avgVolume20 !== null && snap.avgVolume20 > 0
      ? snap.lastVolume / snap.avgVolume20
      : null;
  const ratioFormat = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const row = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className={styles.techRow}>
      <dt>{label}</dt>
      <dd className="numeral">
        {value}
        {sub && <span className={styles.techSub}>{sub}</span>}
      </dd>
    </div>
  );
  const ma20Gap = gap(ma20);

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={d.tsTitle}
        meta={snap.lastSession ? d.tsAsOf.replace("{date}", formatEtDateMedium(snap.lastSession, locale)) : undefined}
      />
      <div className={styles.body}>
        <dl className={styles.techGrid}>
          {row(
            d.tsMa20,
            ma20 !== null ? formatPrice(ma20, locale, { currency: true }) : NO_VALUE,
            ma20Gap !== null ? (
              <span className={directionText(directionOf(ma20Gap))}>{formatPercent(ma20Gap, locale)}</span>
            ) : undefined,
          )}
          <div className={styles.techRow}>
            <dt>{tt.rsi}</dt>
            <dd className="numeral">{snap.rsi14 !== null ? snap.rsi14.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : NO_VALUE}</dd>
            {snap.rsi14 !== null && (
              /* 0–100 cetveli; 30 ve 70 yalnızca ölçeğin işaretleri. */
              <dd aria-hidden className={styles.rsiRail}>
                {RSI_MARKS.map((mark) => (
                  <span key={mark} style={{ left: `${mark}%` }} />
                ))}
                <i style={{ left: `${Math.max(0, Math.min(100, snap.rsi14))}%` }} />
              </dd>
            )}
          </div>
          {row(tt.macdLine, snap.macd ? formatSigned(snap.macd.macd, locale) : NO_VALUE)}
          {row(tt.macdSignal, snap.macd ? formatSigned(snap.macd.signal, locale) : NO_VALUE)}
          {row(
            tt.macdHistogram,
            snap.macd ? (
              <span className={directionText(directionOf(snap.macd.histogram))}>{formatSigned(snap.macd.histogram, locale)}</span>
            ) : (
              NO_VALUE
            ),
            snap.macd && snap.macd.crossSessions !== null
              ? snap.macd.crossSessions === 0
                ? tt.crossedLastSession
                : snap.macd.crossSessions === 1
                  ? tt.crossedSessionsAgoOne
                  : tt.crossedSessionsAgo.replace("{n}", String(snap.macd.crossSessions))
              : undefined,
          )}
          {row(
            tt.atr,
            snap.atr14 !== null ? formatPrice(snap.atr14, locale, { currency: true }) : NO_VALUE,
            snap.atr14 !== null && price !== null && price > 0
              ? `${tt.atrShare} ${formatPercentPlain((snap.atr14 / price) * 100, locale, 1)}`
              : undefined,
          )}
          {row(
            `${tt.volume} · ${tt.volumeLast}`,
            snap.lastVolume !== null ? formatVolume(snap.lastVolume, locale) : NO_VALUE,
            volumeRatio !== null ? `${tt.volumeRatio} ${ratioFormat.format(volumeRatio)}x` : undefined,
          )}
          {row(`${tt.volume} · ${tt.volumeAverage}`, snap.avgVolume20 !== null ? formatVolume(snap.avgVolume20, locale) : NO_VALUE)}
        </dl>

        {snap.cross && (
          <p className="mt-1 border-t border-line-soft pt-2.5 text-small text-body">
            <span className="font-semibold text-strong">
              {snap.cross.kind === "golden" ? d.tsCrossGolden : d.tsCrossDeath}
            </span>
            {" · "}
            <span className="numeral text-muted">
              {snap.cross.sessions === 0
                ? tt.lastSession
                : snap.cross.sessions === 1
                  ? tt.sessionsAgoOne
                  : tt.sessionsAgo.replace("{n}", String(snap.cross.sessions))}
            </span>
          </p>
        )}

        {snap.pivots && (
          <>
            <p className={styles.pivotLabel}>{tt.pivots}</p>
            <dl className={styles.pivots}>
              {(
                [
                  [tt.pivotS2, snap.pivots.s2],
                  [tt.pivotS1, snap.pivots.s1],
                  [tt.pivotP, snap.pivots.p],
                  [tt.pivotR1, snap.pivots.r1],
                  [tt.pivotR2, snap.pivots.r2],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="numeral">{formatPrice(value, locale)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        <p className={styles.note}>{d.tsNote}</p>
        <DataStamp
          labels={t.data}
          source={bars.source}
          at={bars.fetchedAt}
          stale={bars.stale}
          locale={locale}
          className={cn(styles.stamp)}
        />
      </div>
    </Panel>
  );
}

/** İşaretli küçük sayı — MACD: "+1,234" / "−0,512". */
function formatSigned(value: number, locale: Locale): string {
  const text = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${text}`;
}
