import type { Icon } from "@phosphor-icons/react";
import { ChartBar, Compass, Crosshair, Pulse, Stack, Waveform } from "@phosphor-icons/react/dist/ssr";
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
  plural,
} from "@/lib/utils";
import { displayZone, formatInZone, zoneTag } from "@/lib/session-clock";
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

function Head({ title, tag, tagClass, icon: Mark }: { title: string; tag?: string | null; tagClass?: string; icon?: Icon }) {
  return (
    <div className={styles.indicatorHead}>
      <h3 className={styles.indicatorTitle}>{Mark && <Mark size={16} weight="duotone" aria-hidden />}<span>{title}</span></h3>
      {tag && <span className={cn(styles.indicatorTag, tagClass)}>{tag}</span>}
    </div>
  );
}

function crossText(sessions: number, t: Dictionary): string {
  if (sessions === 0) return t.technical.lastSession;
  /* "1 Sessions Ago" — İngilizcede sayı 1 iken çoğul kalıyordu. */
  return plural(sessions, t.technical.sessionsAgoOne, t.technical.sessionsAgo).replace("{n}", String(sessions));
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
        icon={Stack}
        title={t.technical.movingAverages}
        tag={cross ? `${cross.kind === "golden" ? t.technical.goldenCross : t.technical.deathCross} · ${crossText(cross.sessions, t)}` : null}
        tagClass={cross?.kind === "golden" ? "text-up" : "text-down"}
      />
      {/* İKİ YÖN, TEK SAYFA. Bu panel "fiyat ortalamanın ne kadar üstünde"
          diyor (hisse sayfasındaki ortalama paneliyle aynı okuma); merdiven
          ve pivotlar ise "seviyeye ne kadar var". Aynı 50 günlük burada yeşil
          +, merdivende destek olarak kırmızı − duruyordu ve açıklamasızdı. */}
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
      <p className={styles.indicatorNote}>{t.technical.maNote}</p>
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
        icon={Compass}
        title={t.technical.rsi}
        tag={zoneLabel}
        tagClass={zone === "overbought" ? "text-down" : zone === "oversold" ? "text-up" : "text-muted"}
      />
      {rsi !== null ? (
        <div className={styles.rsiReading}>
          {/* A bounded 0–100 reading, not an invented time series. Thresholds
              and marker use the same semicircle; missing RSI draws no dial. */}
          <div className={styles.rsiDial}>
            <svg viewBox="0 0 200 112" aria-hidden="true">
              <path className={styles.dialBase} d="M20 98 A80 80 0 0 1 180 98" pathLength="100" />
              <path className={styles.dialLow} d="M20 98 A80 80 0 0 1 180 98" pathLength="100" strokeDasharray="30 70" />
              <path className={styles.dialHigh} d="M20 98 A80 80 0 0 1 180 98" pathLength="100" strokeDasharray="30 70" strokeDashoffset="-70" />
              {[0, 30, 70, 100].map((value) => {
                const angle = Math.PI * (1 - value / 100);
                return <line key={value} className={styles.dialTick}
                  x1={100 + 72 * Math.cos(angle)} y1={98 - 72 * Math.sin(angle)}
                  x2={100 + 88 * Math.cos(angle)} y2={98 - 88 * Math.sin(angle)} />;
              })}
              <circle className={styles.dialMarker} r="5"
                cx={100 + 80 * Math.cos(Math.PI * (1 - Math.min(100, Math.max(0, rsi)) / 100))}
                cy={98 - 80 * Math.sin(Math.PI * (1 - Math.min(100, Math.max(0, rsi)) / 100))} />
              <text x="5" y="110">0</text><text x="35" y="24">30</text>
              <text x="157" y="24">70</text><text x="180" y="110">100</text>
            </svg>
            <p className={styles.rsiValue}>{formatPrice(rsi, locale, { digits: 1 })}<span>/ 100</span></p>
          </div>
          <div className={styles.rsiZones}>
            <span><i data-zone="low" />{t.technical.rsiOversold}<b>0–30</b></span>
            <span><i data-zone="mid" />{t.technical.rsiNeutral}<b>30–70</b></span>
            <span><i data-zone="high" />{t.technical.rsiOverbought}<b>70–100</b></span>
          </div>
        </div>
      ) : <p className={styles.indicatorNote}>{t.technical.notEnoughHistory}</p>}

    </section>
  );
}

function MacdPanel({ snapshot, locale, t }: { snapshot: TechnicalSnapshot; locale: Locale; t: Dictionary }) {
  const macd = snapshot.macd;
  const above = macd ? macd.histogram >= 0 : null;
  return (
    <section className={styles.indicator}>
      <Head
        icon={Waveform}
        title={t.technical.macd}
        tag={above === null ? null : above ? t.technical.macdAbove : t.technical.macdBelow}
        tagClass={above ? "text-up" : "text-down"}
      />
      {macd ? (
        <>
          <dl className={styles.rows}>
            {([
              [t.technical.macdLine, macd.macd],
              [t.technical.macdSignal, macd.signal],
              [t.technical.macdHistogram, macd.histogram],
            ] as const).map(([label, value]) => {
              const extent = Math.max(Math.abs(macd.macd), Math.abs(macd.signal), Math.abs(macd.histogram), 0.01);
              return <div className={styles.row} key={label}>
                <dt>{label}</dt>
                <dd>{formatPrice(value, locale, { digits: 2 })}</dd>
                {/* All three readings share one symmetric zero axis. */}
                <div className={styles.deviation} aria-hidden="true">
                  <span data-motion-draw="line" style={{
                    left: `${value < 0 ? 50 - Math.abs(value) / extent * 50 : 50}%`,
                    width: `${Math.abs(value) / extent * 50}%`,
                    background: label === t.technical.macdHistogram ? (value >= 0 ? "var(--up)" : "var(--down)") : "var(--primary)",
                    transformOrigin: value < 0 ? "right" : "left",
                  }} /><i />
                </div>
              </div>;
            })}
          </dl>
          <p className={styles.indicatorNote}>{t.technical.macdNote}</p>
          {/* Yirmi seanstan eski kesişme "yeni bir sinyal" değil. */}
          {macd.crossSessions !== null && macd.crossSessions <= 20 && (
            <p className={styles.indicatorNote}>
              {macd.crossSessions === 0
                ? t.technical.crossedLastSession
                : plural(macd.crossSessions, t.technical.crossedSessionsAgoOne, t.technical.crossedSessionsAgo).replace(
                    "{n}",
                    String(macd.crossSessions),
                  )}
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
        icon={ChartBar}
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
        {/* DONMUŞ SAYI, KENDİ SAATİYLE. Değer yazma anındaki kotasyonun hacmi
            ve fotoğrafta sabit; "Bugün (Şu Ana Kadar)" diye basılınca Cuma
            öğlen yazılmış bir sayı hafta sonu boyunca "şu ana kadar" diye
            okunuyordu. Saat fotoğrafın kendi anı (`asOf`), takvim saati değil. */}
        {snapshot.todayVolume !== null && (
          <div className={styles.row}>
            <dt>
              {t.technical.volumeToday.replace(
                "{time}",
                `${formatInZone(new Date(snapshot.asOf), displayZone(locale))} ${zoneTag(locale).primary}`,
              )}
            </dt>
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
          <div className={styles.volumeScale} aria-hidden="true"><span>0</span><span>1×</span><span>3×+</span></div>
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
      <Head title={t.technical.atr} icon={Pulse} />
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
          {/* İşaretsiz ve sözle: "Tepeye Uzaklık −%12" okuyucuya yön mü mesafe
              mi olduğunu söylemiyordu. */}
          {fromHigh !== null && (
            <span className={cn(styles.indicatorTag, "text-muted")}>
              {fromHigh < -0.05
                ? t.technical.range52Below.replace("{n}", formatPercentPlain(Math.abs(fromHigh), locale, 1))
                : t.technical.range52AtHigh}
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
      <Head title={t.technical.pivots} icon={Crosshair} />
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
