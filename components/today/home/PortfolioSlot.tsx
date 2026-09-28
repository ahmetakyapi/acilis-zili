import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { SentimentPulse } from "@/components/markets/SentimentPulse";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DataStamp, LogoTile, Panel, PanelLink } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";
import { loadPortfolioSnapshot, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, NO_VALUE, plural } from "@/lib/utils";
import styles from "./PortfolioSlot.module.css";

/** Dağılım şeridinde adıyla duran pozisyon sayısı; kalanı "Diğer". */
const WEIGHT_SLICES = 4;
/** Şeridin altında satır olarak açılan en büyük pozisyonlar. */
const TOP_ROWS = 3;
/** Dilim tonları: aynı ailenin koyudan açığa beş kademesi (yüzde). */
const SLICE_TONES = [100, 72, 50, 34, 20] as const;

/**
 * Ana sayfanın Mercek seçkisinin altındaki yuva (28 Eylül).
 *
 * PORTFÖYÜ OLANA PORTFÖYÜ, OLMAYANA NABIZ. Sahibinin isteği iki şeyi birden
 * çözüyordu: portföy tutan okuyucu ana sayfada kendi sayısını görsün, ve
 * sağ kolon sol kolondan uzun kalmasın (ölçüldü, misafir: 1024'te 45,
 * 1280'de 100, 1440'ta 117 piksel; oturumlu okuyucuda favoriler paneli
 * uzadıkça fark büyüyor). Yuva BOŞ kalsaydı denge yalnızca portföy
 * tutanlar için kurulurdu; misafire ve portföysüz hesaba aynı yerde
 * kompakt Piyasa Nabzı basılıyor — /piyasalar için yazılmış ve ana sayfaya
 * konmak üzere bekleyen parça.
 *
 * Sayılar /portfoy ile AYNI zincirden (`loadPortfolioSnapshot`).
 */
export async function PortfolioSlot({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();
  const snapshot = session?.user?.id ? await loadPortfolioSnapshot(session.user.id) : null;
  if (!snapshot) return <SentimentPulse locale={locale} t={t} variant="compact" />;
  return <PortfolioSummary snapshot={snapshot} locale={locale} t={t} />;
}

function PortfolioSummary({
  snapshot,
  locale,
  t,
}: {
  snapshot: PortfolioSnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const { views, totals, names, quotes } = snapshot;
  const L = t.today;
  const usd = (value: number, signed = false) =>
    `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true })}`;

  const priced = views
    .filter((view): view is typeof view & { valueUsd: number } => view.valueUsd !== null && view.valueUsd > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd);
  const total = priced.reduce((sum, view) => sum + view.valueUsd, 0);
  const named = priced.slice(0, WEIGHT_SLICES);
  const restValue = priced.slice(WEIGHT_SLICES).reduce((sum, view) => sum + view.valueUsd, 0);
  const slices = [
    ...named.map((view) => ({ key: view.symbol, label: view.symbol, pct: (view.valueUsd / total) * 100 })),
    ...(restValue > 0 ? [{ key: "diger", label: L.portfolioOther, pct: (restValue / total) * 100 }] : []),
  ];

  const pnlUsdPct = totals.costUsd > 0 ? (totals.pnlUsd / totals.costUsd) * 100 : null;
  const pnlTlPct = totals.pnlTl !== null && totals.costTl ? (totals.pnlTl / totals.costTl) * 100 : null;

  return (
    <Panel className={styles.panel}>
      <div className={styles.head}>
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">{L.portfolioSummary}</h2>
        <PanelLink href="/portfoy">{t.common.showAll}</PanelLink>
      </div>

      {/* Ölçüler: solda toplam değer büyük puntoyla, sağda iki K/Z. Lira
          K/Z ayrı bir sayı, dolar K/Z'nin çevirisi değil: maliyet alış
          gününün kuruyla hesaplandığı için kur etkisini de taşıyor. */}
      <div className={styles.figures}>
        <div className={styles.total}>
          <span className={styles.label}>{L.portfolioValue}</span>
          <strong className={cn("numeral", styles.totalValue)}>{usd(totals.valueUsd)}</strong>
          <span className={styles.sub}>
            {totals.valueTl !== null ? formatLira(totals.valueTl, locale, 0) : NO_VALUE}
            {" · "}
            {plural(views.length, L.portfolioPositionsOne, L.portfolioPositions).replace("{n}", String(views.length))}
          </span>
        </div>
        <dl className={styles.pnl}>
          <div>
            <dt className={styles.label}>{L.portfolioPnlUsd}</dt>
            <dd className={cn("numeral", directionText(directionOf(totals.pnlUsd)))}>
              {usd(totals.pnlUsd, true)}
              {pnlUsdPct !== null && <small>{formatPercent(pnlUsdPct, locale)}</small>}
            </dd>
          </div>
          <div>
            <dt className={styles.label}>{L.portfolioPnlTl}</dt>
            <dd className={cn("numeral", totals.pnlTl === null ? "text-muted" : directionText(directionOf(totals.pnlTl)))}>
              {formatLira(totals.pnlTl, locale, 0, true)}
              {pnlTlPct !== null && <small>{formatPercent(pnlTlPct, locale)}</small>}
            </dd>
          </div>
        </dl>
      </div>

      {/* Dağılım şeridi: bir BÜYÜKLÜK, bir yargı değil. Renk bu yüzden
          yön renklerinden değil markanın tek ailesinden; dilimler ağırlık
          sırasıyla koyudan açığa iniyor. Çubuk soldan açılıyor (CSS,
          hareketi azaltan okuyucuda son hâl doğrudan). */}
      {slices.length > 0 && (
        <div className={styles.weights}>
          <span className={styles.label}>{L.portfolioWeights}</span>
          <div className={styles.bar} role="list">
            {slices.map((slice, index) => (
              <span
                key={slice.key}
                role="listitem"
                aria-label={L.portfolioAria
                  .replace("{symbol}", slice.label)
                  .replace("{pct}", String(Math.round(slice.pct)))}
                className={styles.slice}
                style={
                  {
                    "--w": `${slice.pct}%`,
                    "--tone": `${SLICE_TONES[Math.min(index, SLICE_TONES.length - 1)]}%`,
                    "--i": index,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {slices.map((slice, index) => (
              <li
                key={slice.key}
                style={{ "--tone": `${SLICE_TONES[Math.min(index, SLICE_TONES.length - 1)]}%` } as CSSProperties}
              >
                <span className={styles.swatch} aria-hidden />
                {slice.label}
                <b className="numeral">{formatPercentPlain(slice.pct, locale, 0)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className={styles.rows}>
        {priced.slice(0, TOP_ROWS).map((view) => (
          <li key={view.id}>
            <Link href={`/hisse/${view.symbol}`} prefetch={false} className={styles.row}>
              <LogoTile symbol={view.symbol} logoUrl={names[view.symbol]?.logoUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-strong">{view.symbol}</span>
                {names[view.symbol]?.name && (
                  <span className="block truncate text-tiny text-muted">{names[view.symbol]!.name}</span>
                )}
              </span>
              <span className="text-right">
                <span className="numeral block text-small font-semibold text-strong">{usd(view.valueUsd)}</span>
                <span className={cn("numeral block text-tiny font-semibold", directionText(directionOf(view.pnlUsdPct)))}>
                  {view.pnlUsdPct === null ? NO_VALUE : formatPercent(view.pnlUsdPct, locale)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {totals.partial && <p className={styles.note}>{L.portfolioPartial}</p>}
      {quotes && (
        <DataStamp
          labels={t.data}
          source={quotes.source}
          at={quotes.fetchedAt}
          stale={quotes.stale}
          locale={locale}
          className={styles.stamp}
        />
      )}
    </Panel>
  );
}
