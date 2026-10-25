import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { BreadthStrip } from "@/components/day-poster/PosterMarks";
import { PosterLanes } from "@/components/day-poster/PosterLanes";
import { posterName } from "@/components/day-poster/story";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import type { ChartDayContext, ContextMover } from "@/lib/daily-chart-day";
import { posterScale } from "@/lib/day-poster";
import type { Locale } from "@/lib/i18n/config";
import type { DailyChartLabels } from "@/lib/i18n/dictionaries/daily-chart";
import { timePair } from "@/lib/session-clock";
import { cn, directionOf, directionText, formatEtDateCompact, formatPercent, formatPercentPlain } from "@/lib/utils";
import styles from "./DayContext.module.css";

/** Yüzde basamağı — posterin kulvarları ve endeks kartlarıyla aynı (iki). */
const PERCENT_DIGITS = 2;
/** Eksen künyesi tek ondalık (poster kalıbı). */
const SCALE_DIGITS = 1;
/** İki sayaç sırayla dönsün (poster kalıbı). */
const FIGURE_STAGGER_MS = 120;

/**
 * GÜNÜN BAĞLAMI — grafiğin altında ölçü ızgarası (25 Ekim, görsel tur).
 *
 * CLAUDE.md ekran sırası: ana görsel (grafik) → ÖLÇÜ IZGARASI (bu panel)
 * → metin. Grafik tek bir şeyi anlatıyor; panel o günün geri kalanını dört
 * kartta veriyor: endeksler, genişlik, öne çıkanlar, takvim. Her kart bir
 * görsel ve etiket taşıyor (sahibinin ilkesi: "sayıyı yalnız yazma, çiz"):
 * endeks kulvarları, genişlik şeridi, logolu öne çıkanlar, bilanço logoları.
 *
 * Çizimler poster sayfasının kendi parçaları (`PosterLanes`,
 * `BreadthStrip`, `RollingFigure`), yeni bir dil açılmadı; sayılar da
 * aynı çağrıdan (`getChartDayContext` → `getDayPoster`).
 *
 * SEKTÖR KARTI YOK: grafik çoğu gün sektörleri zaten çiziyor; aynı on bir
 * sayıyı ikinci kez basmak ekranı uzatırdı. Okumak isteyen için posterin
 * bağlantısı panelin başında.
 */
export function DayContext({
  context,
  locale,
  labels,
}: {
  context: ChartDayContext;
  locale: Locale;
  labels: DailyChartLabels;
}) {
  const L = labels.context;
  const { poster } = context;
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const dateShort = formatEtDateCompact(context.date, locale);
  const breadth = poster?.breadth ?? null;
  const showCalendar = context.events !== null || context.earnings !== null;
  if (!poster && !showCalendar) return null;

  const scale = poster ? posterScale(poster.indices) : 1;
  const scaleText = formatPercentPlain(scale, locale, SCALE_DIGITS);
  const breadthLabel = breadth
    ? L.breadthLabel
        .replace("{adv}", String(breadth.advancing))
        .replace("{dec}", String(breadth.declining))
        .replace("{flat}", String(breadth.unchanged))
    : "";

  return (
    <Panel>
      <PanelHeader
        title={L.title}
        meta={L.meta.replace("{date}", dateShort)}
        action={
          poster ? (
            <Link href={`/gun/${context.date}`} prefetch={false} className={styles.headLink}>
              {L.posterLink}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      <div className={styles.grid}>
        {poster && poster.indices.length > 0 && (
          <section className={styles.card} aria-labelledby={`${context.date}-indices`}>
            <h3 id={`${context.date}-indices`} className={styles.cardTitle}>{L.indices}</h3>
            <PosterLanes
              moves={poster.indices}
              scale={scale}
              name={(symbol) => posterName(symbol, locale)}
              percent={pct}
              axis={[`−${scaleText}`, "0", `+${scaleText}`]}
              ranked={false}
              label={L.indices}
              className={styles.lanes}
            />
          </section>
        )}

        {breadth && (
          <section className={styles.card} aria-labelledby={`${context.date}-breadth`}>
            <h3 id={`${context.date}-breadth`} className={styles.cardTitle}>{L.breadth}</h3>
            <p className="sr-only">{breadthLabel}</p>
            <div className={styles.breadthFigures} aria-hidden>
              <span className={styles.breadthSide}>
                <span className={cn(styles.breadthNumber, "text-up")}>
                  <RollingFigure value={String(breadth.advancing)} />
                </span>
                <span className={styles.breadthWord}>{L.advancing}</span>
              </span>
              <span className={cn(styles.breadthSide, styles.breadthRight)}>
                <span className={styles.breadthWord}>{L.declining}</span>
                <span className={cn(styles.breadthNumber, "text-down")}>
                  <RollingFigure value={String(breadth.declining)} delayMs={FIGURE_STAGGER_MS} />
                </span>
              </span>
            </div>
            <BreadthStrip breadth={breadth} label={breadthLabel} animate className={styles.strip} />
            {breadth.unchanged > 0 && (
              <span className={styles.flat}>{L.flatCount.replace("{n}", String(breadth.unchanged))}</span>
            )}
          </section>
        )}

        {(context.gainers.length > 0 || context.losers.length > 0) && (
          <section className={styles.card} aria-labelledby={`${context.date}-movers`}>
            <h3 id={`${context.date}-movers`} className={styles.cardTitle}>{L.movers}</h3>
            <div className={styles.movers}>
              <MoverList title={L.gainers} rows={context.gainers} pct={pct} />
              <MoverList title={L.losers} rows={context.losers} pct={pct} />
            </div>
          </section>
        )}

        {showCalendar && (
          <section className={styles.card} aria-labelledby={`${context.date}-calendar`}>
            <h3 id={`${context.date}-calendar`} className={styles.cardTitle}>{L.calendar}</h3>
            {context.events === null ? (
              <p className={styles.empty}>{L.eventsMissing}</p>
            ) : context.events.length === 0 ? (
              <p className={styles.empty}>{L.noEvents}</p>
            ) : (
              <ul className={styles.events}>
                {context.events.map((event) => {
                  const time = event.timeEt ? timePair(context.date, event.timeEt, locale) : null;
                  return (
                    <li key={event.slug} className={styles.event}>
                      <span className={styles.eventTime}>{time ? time.primary : "~"}</span>
                      <span className={styles.eventTitle}>{locale === "tr" ? event.titleTr : event.titleEn}</span>
                    </li>
                  );
                })}
                {context.eventsTotal > context.events.length && (
                  <li className={styles.more}>
                    {L.eventsMore.replace("{n}", String(context.eventsTotal - context.events.length))}
                  </li>
                )}
              </ul>
            )}
            {context.earnings !== null && (
              <div className={styles.earnings}>
                {context.earningsTotal === 0 ? (
                  <p className={styles.empty}>{L.noEarnings}</p>
                ) : (
                  <>
                    <p className={styles.earningsTitle}>{L.earnings.replace("{n}", String(context.earningsTotal))}</p>
                    <ul className={styles.logos}>
                      {context.earnings.map((row) => (
                        <li key={row.symbol}>
                          <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.logo} aria-label={row.name ?? row.symbol}>
                            <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" />
                          </Link>
                        </li>
                      ))}
                      {context.earningsTotal > context.earnings.length && (
                        <li className={styles.more}>
                          {L.earningsMore.replace("{n}", String(context.earningsTotal - context.earnings.length))}
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      {poster && <p className={styles.note}>{L.note}</p>}
    </Panel>
  );
}

function MoverList({ title, rows, pct }: { title: string; rows: ContextMover[]; pct: (value: number) => string }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.moverCol}>
      <h4 className={styles.moverTitle}>{title}</h4>
      <ol className={styles.moverList}>
        {rows.map((row) => (
          <li key={row.symbol}>
            <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.mover}>
              <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
              <span className={styles.moverName}>
                <span className={styles.moverSymbol}>{row.symbol}</span>
                {row.name && <span className={styles.moverCompany}>{row.name}</span>}
              </span>
              <span className={cn(styles.moverValue, directionText(directionOf(row.change)))}>{pct(row.change)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
