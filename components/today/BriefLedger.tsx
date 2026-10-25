import type { CSSProperties } from "react";
import { ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { posterName } from "@/components/day-poster/story";
import { MiniLane } from "@/components/day-poster/PosterLanes";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  INDEX_ALIASES,
  LEDGER_ANCHOR,
  METRIC_ALIASES,
  ledgerScale,
  ledgerStory,
  ledgerStoryText,
  type LedgerMetric,
  type LedgerMove,
  type LedgerRef,
} from "@/lib/brief-ledger";
import type { BriefLedgerData } from "@/lib/brief-ledger-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import {
  cn,
  directionOf,
  directionText,
  directionWash,
  formatChange,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPercentPlain,
} from "@/lib/utils";
import styles from "./BriefLedger.module.css";

/**
 * KAYIT DEFTERİ — bülten sayısının görsel özeti (25 Ekim görsel zirve).
 *
 * İki boy, aynı veri (`getBriefLedger`, aynı yüzde her yerde):
 *   `page` — bülten sayfasında başlığın altında kompakt bant (25 Ekim):
 *     başlık, seans ve günün cümlesi tek satır; altında tek sıra kart —
 *     S&P 500'ün ölçekli rakamı, dört endeks ortak sıfır çizgili
 *     kulvarlarda (haftalıkta beş günlük kesintisiz şerit), üç ölçü tek
 *     satırlık önce → sonra karosunda; bültende adı geçen hisseler logolu
 *     çip satırında, künye tek satır + katlı ayrıntı.
 *   `card` — ana sayfanın bülten kartında yalnız dört endeks; kart bir
 *     giriş, bandın tamamı bülten sayfasında.
 *
 * Kurallar ve gerekçeler `lib/brief-ledger.ts`te. Görsel dil sitenin grafik
 * dili: `--line-soft` kulvar, `--line-strong` sıfır çizgisi, renk yalnız
 * işaretten (CLAUDE.md "Grafik dili ince"). Şeritler posterin `MiniLane`i —
 * aynı ölçek mantığı, aynı büyüme hareketi.
 *
 * Bağ: her öğe `data-ledger-key` ve `data-ledger-summary` taşıyor; metindeki
 * geçişler (`BriefBody` → `refs`) üstüne gelince ya da dokununca bu özeti
 * gösteriyor (`LedgerLinker`).
 */

/** Yüzde basamağı — posterin ve endeks kartlarının basamağı. */
const PERCENT_DIGITS = 2;
/** Eksen künyesi tek ondalık: "±%1,2". */
const SCALE_DIGITS = 1;
/** Dolar/TL TCMB bülteninin hassasiyeti. */
const FX_DIGITS = 4;
/** Faiz ve VIX iki ondalık. */
const LEVEL_DIGITS = 2;
/** Faiz farkı baz puan (yüzde puan × 100), tam sayı. */
const BP_PER_POINT = 100;

type Labels = Dictionary["briefLedger"];

export function ledgerRefs(data: BriefLedgerData): LedgerRef[] {
  return [
    ...data.indices.map((move) => ({ key: move.symbol, aliases: INDEX_ALIASES[move.symbol] ?? [move.symbol] })),
    ...data.metrics.map((metric) => ({ key: metric.key, aliases: METRIC_ALIASES[metric.key] })),
    ...data.stocks.map((stock) => ({
      key: stock.symbol,
      aliases: [...new Set([stock.alias, ...(stock.symbol.length >= 3 ? [stock.symbol] : [])])],
    })),
  ];
}

function levelFormat(locale: Locale, digits: number) {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function metricText(metric: LedgerMetric, locale: Locale, L: Labels) {
  const diff = metric.value - metric.prev;
  if (metric.key === "us10y") {
    const bp = Math.round(diff * BP_PER_POINT);
    return {
      value: formatPercentPlain(metric.value, locale, LEVEL_DIGITS),
      prev: formatPercentPlain(metric.prev, locale, LEVEL_DIGITS),
      delta: L.bp.replace("{value}", `${bp > 0 ? "+" : bp < 0 ? "−" : ""}${Math.abs(bp)}`),
      dir: directionOf(bp),
    };
  }
  if (metric.key === "vix") {
    const level = levelFormat(locale, LEVEL_DIGITS);
    return {
      value: level.format(metric.value),
      prev: level.format(metric.prev),
      delta: L.points.replace("{value}", formatChange(diff, locale)),
      dir: directionOf(Math.round(diff * BP_PER_POINT)),
    };
  }
  const level = levelFormat(locale, FX_DIGITS);
  const pct = metric.prev > 0 ? (metric.value / metric.prev - 1) * 100 : 0;
  return {
    value: level.format(metric.value),
    prev: level.format(metric.prev),
    delta: formatPercent(pct, locale, PERCENT_DIGITS),
    dir: directionOf(pct),
  };
}

export function BriefLedger({
  data,
  locale,
  t,
  variant = "page",
}: {
  data: BriefLedgerData;
  locale: Locale;
  t: Dictionary;
  variant?: "page" | "card";
}) {
  const L = t.briefLedger;
  const weekly = data.window.period === "weekly";
  const name = (symbol: string) => posterName(symbol, locale);
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const scale = ledgerScale(data.indices, weekly);
  const scaleText = formatPercentPlain(scale, locale, SCALE_DIGITS);
  const sessionLine = weekly
    ? L.weekLine
        .replace("{start}", formatEtDateCompact(data.window.from, locale))
        .replace("{end}", formatEtDateCompact(data.window.to, locale))
    : L.sessionLine.replace("{date}", formatEtDateLong(data.window.session, locale));
  const shortSession = weekly
    ? L.weekShort
        .replace("{start}", formatEtDateCompact(data.window.from, locale))
        .replace("{end}", formatEtDateCompact(data.window.to, locale))
    : L.sessionShort.replace("{date}", formatEtDateCompact(data.window.session, locale));
  const story = ledgerStory(data.indices, data.window.period);
  const list = new Intl.ListFormat(INTL_LOCALE[locale], { style: "long", type: "conjunction" });
  const storyText = story
    ? ledgerStoryText(story, L.story, {
        name,
        signed: pct,
        plain: (value) => formatPercentPlain(value, locale, PERCENT_DIGITS),
        list: (items) => list.format(items),
        dayName: (index) => L.weekdaysLong[index] ?? "",
      })
    : null;
  const summary = (label: string, value: string) => `${label} ${value} · ${shortSession}`;

  if (variant === "card") {
    return (
      <div className={styles.mini} data-weekly={weekly ? "" : undefined}>
        <p className={styles.miniHead}>
          <span className={styles.miniSession}>{sessionLine}</span>
          {storyText && <span className={styles.miniStory}>{storyText}</span>}
        </p>
        <ol className={styles.miniGrid} aria-label={L.indicesLabel}>
          {data.indices.map((move, index) => (
            <li
              key={move.symbol}
              className={styles.miniItem}
              data-ledger-key={move.symbol}
              data-ledger-summary={summary(name(move.symbol), pct(move.change))}
              style={{ "--i": index } as CSSProperties}
            >
              <span className={styles.miniName}>{name(move.symbol)}</span>
              <span className={cn(styles.miniValue, directionText(directionOf(move.change)))}>{pct(move.change)}</span>
              {weekly ? (
                <WeekCells move={move} scale={scale} L={L} pct={pct} compact />
              ) : (
                <MiniLane change={move.change} scale={scale} className={styles.miniLane} />
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const anchor = data.indices.find((move) => move.symbol === LEDGER_ANCHOR) ?? data.indices[0];
  const anchorDir = directionOf(anchor.change);
  const foldCount = data.metrics.length + data.stocks.length;
  const foldMore =
    data.metrics.length > 0 && data.stocks.length > 0
      ? L.foldBoth
      : data.metrics.length > 0
        ? L.foldMetrics
        : L.foldStocks;

  /* KOMPAKT BANT (25 Ekim, sahibinin sözü: "Burayı da daha kompakt
     yapabiliriz bence"). Önceki düzen 1440'ta 613 piksel ölçüldü (haftalıkta
     675): başlık, künye ve cümle üç satır; üç kolonun en uzunu yüksek ölçü
     kartları; hisse ızgarası ve iki satırlık künye ayrı katlar. Bülten metni
     900'lük ekranın 910. pikselinde, yani ilk ekranın dışındaydı.
     Bugün: baş tek bant, altında TEK SIRA kart (manşet | dört endeks | üç
     ölçü), hisseler tek satır çip, künye tek satır + katlı ayrıntı. Veri
     aynı (aynı `getBriefLedger`, aynı yüzde); değişen yalnız yerleşim.
     Ölçümler BriefLedger.module.css başında. */
  return (
    <section className={cn("panel", styles.band)} aria-labelledby="ledger-title" data-weekly={weekly ? "" : undefined}>
      <header className={styles.head}>
        <h2 id="ledger-title" className={cn("display-ink display-ink-tight", styles.title)}>
          {weekly ? L.weeklyTitle : L.dailyTitle}
        </h2>
        <p className={styles.session}>{sessionLine}</p>
        {storyText && <p className={styles.story}>{storyText}</p>}
      </header>

      {/* TELEFONDA KATLANAN AYRINTI (25 Ekim son düzeltme, kompakt bantta
          da korunuyor): 640 altında ölçüler, hisseler ve künye JS'siz
          katlamanın arkasında; bandın özü (cümle ve dört endeks karosu)
          açık. 640 ve üstünde katlama yok. Katlanan öğeler düz `div`
          sarmalayıcıda: FoldToggle geniş ekranda `display: revert` diyor,
          ızgara/esnek kutunun kendisine konsa düzeni tarayıcı varsayılanına
          döndürürdü. */}
      <FoldToggle id="ledger-detail" hiddenCount={foldCount} more={foldMore} less={L.foldLess} phone>
        <div className={styles.body}>
          <div className={styles.grid}>
            {/* MANŞET SAYISI — S&P 500'ün dönemi. Aynı sayı endeks kartındaki
                satırda da duruyor: ikisi aynı kaynaktan (aynı `move`). */}
            <div
              className={cn(styles.card, styles.hero)}
              data-ledger-key={anchor.symbol}
              data-ledger-summary={summary(name(anchor.symbol), pct(anchor.change))}
            >
              <span className={styles.cardLabel}>{weekly ? L.heroCaptionWeekly : L.heroCaption}</span>
              <RollingFigure value={pct(anchor.change)} className={cn(styles.heroFigure, directionText(anchorDir))} />
              <MiniLane change={anchor.change} scale={scale} className={styles.heroLane} />
            </div>

            {/* ENDEKSLER — ortak sıfır çizgisi, tek ölçek. Eksen künyesi ayrı
                satır değil, etiketin sağında ("±%1,2"): bir satır kazandırıyor. */}
            <div className={cn(styles.card, styles.indices)}>
              <p className={styles.cardHead}>
                <span className={styles.cardLabel}>{L.indicesLabel}</span>
                {!weekly && <span className={styles.scale}>{L.scale.replace("{value}", scaleText)}</span>}
              </p>
              {weekly && (
                <div className={styles.weekHead} aria-hidden>
                  <span />
                  <span className={styles.weekDays}>
                    {data.window.days.map((day, index) => (
                      <span key={day.date} className={styles.weekDay}>
                        {L.weekdays[index]}
                      </span>
                    ))}
                  </span>
                  <span className={cn(styles.weekDay, styles.weekTotal)}>{L.weekTotal}</span>
                </div>
              )}
              <ol className={cn(styles.lanes, weekly && styles.weekLanes)}>
                {data.indices.map((move, index) => (
                  <IndexRow
                    key={move.symbol}
                    move={move}
                    index={index}
                    weekly={weekly}
                    scale={scale}
                    name={name(move.symbol)}
                    pct={pct}
                    L={L}
                    summary={summary(name(move.symbol), pct(move.change))}
                  />
                ))}
              </ol>
            </div>

            {/* ÖLÇÜLER — üç küçük karo, her biri tek satır: ad, önce → sonra,
                rozet. Ayrı başlık yok; liste adı ekran okuyucuya. */}
            {data.metrics.length > 0 && (
              <div className={styles.metricsWrap} data-fold>
                <ul className={styles.metrics} aria-label={L.metricsLabel}>
                  {data.metrics.map((metric) => {
                    const text = metricText(metric, locale, L);
                    return (
                      <li
                        key={metric.key}
                        className={cn(styles.card, styles.metric)}
                        data-ledger-key={metric.key}
                        data-ledger-summary={summary(L.metrics[metric.key], `${text.value} (${text.delta})`)}
                      >
                        <span className={styles.metricName}>
                          {L.metrics[metric.key]}
                          {/* Gün yalnız bandın gününden farklıysa (haftalıkta son
                              gözlem cumadan önceyse) — aynıysa künyede yazıyor. */}
                          {metric.date !== data.window.session && (
                            <span className={styles.metricDate}>{formatEtDateCompact(metric.date, locale)}</span>
                          )}
                        </span>
                        <span className={styles.metricShift}>
                          <span className={styles.metricPrev}>{text.prev}</span>
                          <ArrowRight size={11} weight="bold" aria-hidden className={styles.metricArrow} />
                          <span className={styles.metricValue}>{text.value}</span>
                        </span>
                        <span className={cn(styles.metricDelta, directionWash(text.dir))}>{text.delta}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* HİSSELER — tek satır çip: logo, sembol, yüzde. Şirket adı çipin
              `title`ında ve ekran okuyucu adında; sekiz hisse 1440'ta tek
              satıra sığıyor, sığmayan genişlikte şerit kayıyor (ScrollEdges
              "devamı var" der). */}
          {data.stocks.length > 0 && (
            <div data-fold>
              <div className={styles.stocks}>
                <p className={styles.stocksLabel}>{L.stocksLabel}</p>
                <ScrollEdges as="ul" className={cn("no-scrollbar", styles.stockList)}>
                  {data.stocks.map((stock, index) => {
                    const value = pct(stock.change);
                    return (
                      <li key={stock.symbol} style={{ "--i": index } as CSSProperties}>
                        <Link
                          href={`/hisse/${stock.symbol}`}
                          prefetch={false}
                          className={styles.stock}
                          title={stock.name}
                          data-ledger-key={stock.symbol}
                          data-ledger-summary={summary(stock.name, value)}
                          aria-label={L.stockAria.replace("{name}", stock.name).replace("{symbol}", stock.symbol).replace("{value}", value)}
                        >
                          <LogoTile symbol={stock.symbol} logoUrl={stock.logoUrl} size="xs" />
                          <span className={styles.stockSymbol}>{stock.symbol}</span>
                          <span className={cn(styles.stockValue, directionText(directionOf(stock.change)))}>{value}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ScrollEdges>
              </div>
            </div>
          )}

          {/* KÜNYE — panelin içinde, hairline'la; tek satır kaynak listesi,
              yöntemin tamamı yerli `<details>`te (JS'siz açılıyor; açılış
              geçişi ve kaydırma çapası globals.css + ExpandInPlace'te). */}
          <div data-fold>
            <details className={styles.note}>
              <summary className={styles.noteSummary}>
                <span className={styles.noteShort}>{L.dataNoteShort}</span>
                <span className={styles.noteToggle}>
                  {L.dataNoteMore}
                  <CaretDown size={12} weight="bold" aria-hidden className={styles.noteIcon} />
                </span>
              </summary>
              <p className={styles.noteBody}>{L.dataNote}</p>
            </details>
          </div>
        </div>
      </FoldToggle>
    </section>
  );
}

function IndexRow({
  move,
  index,
  weekly,
  scale,
  name,
  pct,
  L,
  summary,
}: {
  move: LedgerMove;
  index: number;
  weekly: boolean;
  scale: number;
  name: string;
  pct: (value: number) => string;
  L: Labels;
  summary: string;
}) {
  const dir = directionOf(move.change);
  return (
    <li
      className={styles.row}
      data-ledger-key={move.symbol}
      data-ledger-summary={summary}
      style={{ "--i": index } as CSSProperties}
    >
      <span className={styles.rowName}>
        {name}
        <span className={styles.rowSymbol}>{move.symbol}</span>
      </span>
      {weekly ? (
        <WeekCells move={move} scale={scale} L={L} pct={pct} />
      ) : (
        <MiniLane change={move.change} scale={scale} className={styles.rowLane} />
      )}
      <span className={cn(styles.rowValue, directionText(dir))}>{pct(move.change)}</span>
    </li>
  );
}

/**
 * HAFTANIN ŞERİDİ — beş gün yan yana, aralıksız. Her hücrede ortadaki sıfır
 * çizgisinden yukarı (artı) ya da aşağı (eksi) tek bir çubuk; boy bütün
 * endekslerin bütün günlerinde TEK ölçekte. Tatil hücresi boş değil,
 * adıyla duruyor — boş bir hücre "yatay" diye okunurdu.
 */
function WeekCells({
  move,
  scale,
  L,
  pct,
  compact = false,
}: {
  move: LedgerMove;
  scale: number;
  L: Labels;
  pct: (value: number) => string;
  compact?: boolean;
}) {
  return (
    <span className={cn(styles.week, compact && styles.weekCompact)}>
      {move.steps.map((step, index) => {
        const day = L.weekdaysLong[index] ?? "";
        if (step.change === null) {
          return (
            <span key={step.date} className={cn(styles.cell, styles.cellHoliday)}>
              <span className="sr-only">{L.holidayAria.replace("{day}", day)}</span>
              {!compact && (
                <span aria-hidden className={styles.cellHolidayText}>
                  {L.holiday}
                </span>
              )}
            </span>
          );
        }
        const dir = directionOf(step.change);
        const length = (Math.min(Math.abs(step.change), scale) / scale) * 50;
        return (
          <span
            key={step.date}
            className={styles.cell}
            title={L.dayAria.replace("{day}", day).replace("{value}", pct(step.change))}
            style={{ "--len": `${length}%`, "--d": index } as CSSProperties}
          >
            <span className="sr-only">{L.dayAria.replace("{day}", day).replace("{value}", pct(step.change))}</span>
            {dir !== "flat" && <span className={cn(styles.cellBar, dir === "up" ? styles.cellUp : styles.cellDown)} />}
          </span>
        );
      })}
    </span>
  );
}
