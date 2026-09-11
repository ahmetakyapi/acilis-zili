import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, rsiZone, type TechnicalSnapshot } from "@/lib/technical";
import {
  cn,
  directionOf,
  directionText,
  formatCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";
import styles from "./Technical.module.css";

/**
 * Gösterge panelleri — fotoğraftaki sayılar, analiz anındaki hâliyle.
 *
 * Fiyata uzaklıklar CANLI fiyatla ölçülüyor (`price`), ortalamaların
 * kendisi fotoğraftan: ortalama son kapanmış seansta sabit, fiyat değil.
 * Gerekçe `TechnicalSnapshot` yorumunda.
 */
export function IndicatorPanels({
  snapshot,
  price,
  locale,
  t,
}: {
  snapshot: TechnicalSnapshot;
  price: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <div className={styles.indicators} data-motion-stagger>
      <MovingAveragesPanel snapshot={snapshot} price={price} locale={locale} t={t} />
      <RsiPanel snapshot={snapshot} locale={locale} t={t} />
      <MacdPanel snapshot={snapshot} locale={locale} t={t} />
      <VolumePanel snapshot={snapshot} locale={locale} t={t} />
      <RangePanel snapshot={snapshot} price={price} locale={locale} t={t} />
      <PivotPanel snapshot={snapshot} price={price} locale={locale} t={t} />
    </div>
  );
}

function Head({ title, tag, tagClass }: { title: string; tag?: string | null; tagClass?: string }) {
  return (
    <div className={styles.indicatorHead}>
      <h3 className={styles.indicatorTitle}>{title}</h3>
      {tag && <span className={cn(styles.indicatorTag, tagClass)}>{tag}</span>}
    </div>
  );
}

function crossText(sessions: number, t: Dictionary): string {
  return sessions === 0 ? t.technical.lastSession : t.technical.sessionsAgo.replace("{n}", String(sessions));
}

function MovingAveragesPanel({
  snapshot,
  price,
  locale,
  t,
}: {
  snapshot: TechnicalSnapshot;
  price: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const rows = (
    [
      [20, snapshot.sma20],
      [50, snapshot.sma50],
      [100, snapshot.sma100],
      [200, snapshot.sma200],
    ] as const
  ).map(([window, value]) => ({ window, value, distance: distancePct(price, value) }));
  /* Ortak eksen: dört çubuk aynı ölçekte, en uzak ortalama kenara değiyor.
     Hisse sayfasındaki ortalama panelinin çizimi. */
  const extent = Math.max(
    1,
    ...rows.map((row) => row.distance).filter((v): v is number => v !== null).map(Math.abs),
  );
  const cross = snapshot.cross;

  return (
    <section className={styles.indicator}>
      <Head
        title={t.technical.movingAverages}
        tag={cross ? `${cross.kind === "golden" ? t.technical.goldenCross : t.technical.deathCross} · ${crossText(cross.sessions, t)}` : null}
        tagClass={cross?.kind === "golden" ? "text-up" : "text-down"}
      />
      <dl className={styles.rows}>
        {rows.map(({ window, value, distance }) => (
          <div key={window} className={styles.row}>
            <dt>{t.stock.movingAverageRow.replace("{n}", String(window))}</dt>
            <dd>
              {value !== null ? (
                <>
                  <span>{formatPrice(value, locale, { currency: true })}</span>
                  {distance !== null && (
                    <span className={cn("text-tiny", directionText(directionOf(distance)))}>
                      {formatPercent(distance, locale, 1)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-tiny font-medium text-muted">{t.technical.notEnoughHistory}</span>
              )}
            </dd>
            {distance !== null && (
              <div className={styles.deviation} aria-hidden>
                <span
                  data-motion-draw="line"
                  style={{
                    left: `${distance < 0 ? 50 - (Math.abs(distance) / extent) * 50 : 50}%`,
                    width: `${(Math.abs(distance) / extent) * 50}%`,
                    background: distance >= 0 ? "var(--up)" : "var(--down)",
                    transformOrigin: distance < 0 ? "right" : "left",
                  }}
                />
                <i />
              </div>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

function RsiPanel({ snapshot, locale, t }: { snapshot: TechnicalSnapshot; locale: Locale; t: Dictionary }) {
  const rsi = snapshot.rsi14;
  const zone = rsiZone(rsi);
  const zoneLabel =
    zone === "overbought" ? t.technical.rsiOverbought : zone === "oversold" ? t.technical.rsiOversold : zone ? t.technical.rsiNeutral : null;
  return (
    <section className={styles.indicator}>
      <Head
        title={t.technical.rsi}
        tag={zoneLabel}
        tagClass={zone === "overbought" ? "text-down" : zone === "oversold" ? "text-up" : "text-muted"}
      />
      <p className={styles.bigFigure}>{rsi !== null ? formatPrice(rsi, locale, { digits: 1 }) : "—"}</p>
      {rsi !== null && (
        <>
          <div className={styles.gauge} aria-hidden>
            <span style={{ left: `${Math.min(100, Math.max(0, rsi))}%` }} />
          </div>
          <div className={styles.gaugeScale} aria-hidden>
            <span>0</span>
            <span style={{ left: "30%" }}>30</span>
            <span style={{ left: "70%" }}>70</span>
            <span>100</span>
          </div>
        </>
      )}
    </section>
  );
}

function MacdPanel({ snapshot, locale, t }: { snapshot: TechnicalSnapshot; locale: Locale; t: Dictionary }) {
  const macd = snapshot.macd;
  const above = macd ? macd.histogram >= 0 : null;
  return (
    <section className={styles.indicator}>
      <Head
        title={t.technical.macd}
        tag={above === null ? null : above ? t.technical.macdAbove : t.technical.macdBelow}
        tagClass={above ? "text-up" : "text-down"}
      />
      {macd ? (
        <>
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt>{t.technical.macdLine}</dt>
              <dd>{formatPrice(macd.macd, locale, { digits: 2 })}</dd>
            </div>
            <div className={styles.row}>
              <dt>{t.technical.macdSignal}</dt>
              <dd>{formatPrice(macd.signal, locale, { digits: 2 })}</dd>
            </div>
            <div className={styles.row}>
              <dt>{t.technical.macdHistogram}</dt>
              <dd className={directionText(directionOf(macd.histogram))}>
                {formatPrice(macd.histogram, locale, { digits: 2 })}
              </dd>
            </div>
          </dl>
          {/* Yirmi seanstan eski kesişme "yeni bir sinyal" değil. */}
          {macd.crossSessions !== null && macd.crossSessions <= 20 && (
            <p className={styles.indicatorNote}>
              {macd.crossSessions === 0
                ? t.technical.crossedLastSession
                : t.technical.crossedSessionsAgo.replace("{n}", String(macd.crossSessions))}
            </p>
          )}
        </>
      ) : (
        <p className="text-tiny text-muted">{t.technical.notEnoughHistory}</p>
      )}
    </section>
  );
}

function VolumePanel({ snapshot, locale, t }: { snapshot: TechnicalSnapshot; locale: Locale; t: Dictionary }) {
  const ratio =
    snapshot.lastVolume !== null && snapshot.avgVolume20 ? snapshot.lastVolume / snapshot.avgVolume20 : null;
  /* Ölçek üç kat: ortalamanın üç katı hacim zaten olağanüstü, fazlası
     çubuğu doldurur. Ortalama çizgisi ölçeğin üçte birinde. */
  const scale = 3;
  return (
    <section className={styles.indicator}>
      <Head
        title={t.technical.volume}
        tag={ratio !== null ? `${formatPrice(ratio, locale, { digits: 1 })}×` : null}
        tagClass={ratio !== null && ratio >= 1 ? "text-primary-ink" : "text-muted"}
      />
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>{t.technical.volumeLast}</dt>
          <dd>{formatCompact(snapshot.lastVolume, locale)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t.technical.volumeAverage}</dt>
          <dd>{formatCompact(snapshot.avgVolume20, locale)}</dd>
        </div>
        {snapshot.todayVolume !== null && (
          <div className={styles.row}>
            <dt>{t.technical.volumeToday}</dt>
            <dd>{formatCompact(snapshot.todayVolume, locale)}</dd>
          </div>
        )}
      </dl>
      {ratio !== null && (
        <>
          <div className={styles.ratioTrack} aria-hidden>
            <span data-motion-draw="bar" style={{ width: `${Math.min(100, (ratio / scale) * 100)}%` }} />
            <i style={{ left: `${100 / scale}%` }} />
          </div>
          <p className={styles.indicatorNote}>{t.technical.volumeRatio}</p>
        </>
      )}
    </section>
  );
}

function RangePanel({
  snapshot,
  price,
  locale,
  t,
}: {
  snapshot: TechnicalSnapshot;
  price: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const { high52, low52, atr14 } = snapshot;
  const span = high52 !== null && low52 !== null ? high52 - low52 : null;
  const position =
    span && price !== null && low52 !== null ? Math.min(100, Math.max(0, ((price - low52) / span) * 100)) : null;
  const fromHigh = distancePct(price, high52);
  const atrShare = atr14 !== null && price ? (atr14 / price) * 100 : null;
  return (
    <section className={styles.indicator}>
      <Head title={t.technical.atr} />
      <p className={styles.bigFigure}>
        {formatPrice(atr14, locale, { currency: true })}
        {atrShare !== null && (
          <span className="ml-2 text-small font-semibold text-muted">
            {t.technical.atrShare} {formatPercentPlain(atrShare, locale, 1)}
          </span>
        )}
      </p>
      <div className="flex flex-col gap-2 border-t border-line-soft pt-2.5">
        <div className={styles.indicatorHead}>
          <h3 className={styles.indicatorTitle}>{t.technical.range52}</h3>
          {fromHigh !== null && (
            <span className={cn(styles.indicatorTag, "text-muted")}>
              {t.technical.range52Distance} {formatPercent(fromHigh, locale, 1)}
            </span>
          )}
        </div>
        {position !== null && (
          <div className={styles.band} aria-hidden>
            <span style={{ left: `${position}%` }} />
          </div>
        )}
        <div className="flex justify-between text-tiny text-muted">
          <span>
            {t.technical.range52Low} <b className="numeral text-body">{formatPrice(low52, locale, { currency: true })}</b>
          </span>
          <span>
            {t.technical.range52High} <b className="numeral text-body">{formatPrice(high52, locale, { currency: true })}</b>
          </span>
        </div>
      </div>
    </section>
  );
}

function PivotPanel({
  snapshot,
  price,
  locale,
  t,
}: {
  snapshot: TechnicalSnapshot;
  price: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const pivots = snapshot.pivots;
  if (!pivots) return null;
  const rows = [
    ["R2", pivots.r2],
    ["R1", pivots.r1],
    ["P", pivots.p],
    ["S1", pivots.s1],
    ["S2", pivots.s2],
  ] as const;
  return (
    <section className={styles.indicator}>
      <Head title={t.technical.pivots} />
      <dl className={styles.rows}>
        {rows.map(([label, value]) => {
          const distance = distancePct(value, price);
          return (
            <div key={label} className={styles.row}>
              <dt className="font-semibold">{label}</dt>
              <dd>
                <span>{formatPrice(value, locale, { currency: true })}</span>
                {distance !== null && (
                  <span className={cn("text-tiny", directionText(directionOf(distance)))}>
                    {formatPercent(distance, locale, 1)}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className={styles.indicatorNote}>{t.technical.pivotsNote}</p>
    </section>
  );
}
