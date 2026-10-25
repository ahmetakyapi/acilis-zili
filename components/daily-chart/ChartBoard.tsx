import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChartLineUp, Scales, TrendDown, TrendUp, ChartPieSlice } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody } from "@/components/article/ArticleBody";
import { BreadthStrip } from "@/components/day-poster/PosterMarks";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { checkChartBlock } from "@/lib/daily-chart";
import { boardKeys, type BoardKey } from "@/lib/daily-chart-board";
import type { ChartDayContext } from "@/lib/daily-chart-day";
import { POSTER_ANCHOR } from "@/lib/day-poster";
import type { Locale } from "@/lib/i18n/config";
import type { DailyChartLabels } from "@/lib/i18n/dictionaries/daily-chart";
import { cn, formatPercent } from "@/lib/utils";
import { ChartTiles } from "./ChartTiles";
import { SECTOR_ICONS } from "./sector-icons";
import styles from "./ChartBoard.module.css";

/** Endeks yüzdesi iki basamak — posterin ve bağlam kartlarının basamağı. */
const PERCENT_DIGITS = 2;

type BoardRow = { title: string; chartMd: string; bodyMd: string; locale: string; chartDate: string };

/**
 * GÜNÜN GRAFİĞİ PANOSU (25 Ekim, kart turu).
 *
 * Sahibinin sözü: "İlk açılırken sadece yatay çubuk açılmasın, KARTLAR
 * olsun ... kaydırmadan adam bütün verileri görmez." Önceki sayfada ilk
 * ekran dev bir başlık ve iki çubuktu (1440×900'de 11 çubuğun 6'sı,
 * telefonda 2'si; metin ve bağlam üç ekran aşağıda). Şimdi ilk ekran bir
 * pano, üç bölge:
 *
 *   künye  — en güçlü, en zayıf, kaç kalem artıda ve Nasdaq 100 (genişlik
 *            şeridiyle): günün cevabı dört kartta, okumadan önce.
 *   grafik — rutinin başlığı kartın h2'si (sayfa başlığı değil: sayfanın
 *            kimliği "Günün Grafiği"), altında bloğun her satırı bir kart
 *            (`ChartTiles`).
 *   metin  — rutinin ~100 kelimesi grafiğin YANINDA (≥1200), dar ekranda
 *            altında. Künyeler (kaynak, uyarı) metin kartının içinde,
 *            hairline'la (CLAUDE.md ekran düzeni 6) — `footer`.
 *
 * Geniş ekranda ızgara iki kolon: solda künye + grafik, sağda metin iki
 * satırı birden kaplar; ölçüldü (bkz. ChartBoard.module.css).
 *
 * Sayılar: künye kartları YALNIZ bloktan (`boardKeys`, testli), piyasa
 * kartı günün posterinden (`getChartDayContext` → aynı çağrı, "33
 * Yükseldi" her yerde aynı sayı). Bozuk blokta grafik makale çizimiyle
 * düşer, künye basılmaz.
 */
export function ChartBoard({
  row,
  context,
  locale,
  labels,
  headingId,
  action,
  footer,
}: {
  row: BoardRow;
  context: ChartDayContext | null;
  /** Arayüzün dili (künye etiketleri); grafik ve metin kaydın dilinde. */
  locale: Locale;
  labels: DailyChartLabels;
  headingId: string;
  /** Ana kartın başlık satırının sağı (dizinde "Grafiğe Git"). */
  action?: ReactNode;
  /** Metin kartının sonu: künyeler ya da bağlantı. */
  footer?: ReactNode;
}) {
  const check = checkChartBlock(row.chartMd, row.locale);
  const label = check.ok && check.block.label ? check.block.label : labels.chartHeading;
  const keys = check.ok ? boardKeys(check.block) : [];
  const neutral = check.ok && check.block.kind === "bars" && Boolean(check.block.neutral);
  const poster = context?.poster ?? null;
  const anchor = poster?.indices.find((move) => move.symbol === POSTER_ANCHOR) ?? null;
  const breadth = poster?.breadth ?? null;
  const showMarket = anchor !== null || breadth !== null;
  const keyCount = keys.length + (showMarket ? 1 : 0);

  return (
    <div className={styles.board} data-keys={keyCount > 0 ? "" : undefined}>
      {keyCount > 0 && (
        <ul className={styles.keys} aria-label={labels.board.keysLabel} data-m="keys" style={{ "--keys": keyCount } as CSSProperties}>
          {keys.map((key, index) => (
            <li key={index} className="min-w-0">
              <KeyCard boardKey={key} labels={labels} neutral={neutral} lang={row.locale} />
            </li>
          ))}
          {showMarket && (
            <li className="min-w-0">
              <div className={cn("panel", styles.key)}>
                <span className={styles.keyHead}>
                  <ChartLineUp size={16} weight="bold" aria-hidden />
                  {labels.board.market}
                </span>
                {anchor && (
                  <span className={cn(styles.keyValue, anchor.change > 0 ? "text-up" : anchor.change < 0 ? "text-down" : "text-strong")}>
                    {formatPercent(anchor.change, locale, PERCENT_DIGITS)}
                  </span>
                )}
                {breadth && (
                  <span className={styles.keyFoot}>
                    <BreadthStrip
                      breadth={breadth}
                      label={labels.context.breadthLabel
                        .replace("{adv}", String(breadth.advancing))
                        .replace("{dec}", String(breadth.declining))
                        .replace("{flat}", String(breadth.unchanged))}
                      animate
                      className={styles.keyStrip}
                    />
                    <span className={styles.keyNote}>
                      {labels.board.marketNote
                        .replace("{adv}", String(breadth.advancing))
                        .replace("{dec}", String(breadth.declining))}
                    </span>
                  </span>
                )}
              </div>
            </li>
          )}
        </ul>
      )}

      <section className={cn("panel", styles.main)} aria-labelledby={headingId} data-m="main">
        <div className={styles.mainHead}>
          <div className="min-w-0">
            <h2 id={headingId} className={styles.mainTitle} lang={row.locale}>
              {row.title}
            </h2>
            <p className={styles.caption} lang={row.locale}>{label}</p>
          </div>
          {action}
        </div>
        <div className={styles.mainBody} lang={row.locale}>
          {check.ok ? (
            <ChartTiles block={check.block} locale={row.locale} label={label} labels={labels} />
          ) : (
            <ArticleBody markdown={row.chartMd} locale={row.locale} />
          )}
        </div>
      </section>

      <section className={cn("panel", styles.text)} aria-labelledby={`${headingId}-about`} data-m="text">
        <h2 id={`${headingId}-about`} className={styles.textTitle}>{labels.aboutHeading}</h2>
        <div className={styles.textBody} lang={row.locale}>
          <ArticleBody markdown={row.bodyMd} locale={row.locale} className={styles.body} />
        </div>
        {footer}
      </section>
    </div>
  );
}

function KeyCard({
  boardKey,
  labels,
  neutral,
  lang,
}: {
  boardKey: BoardKey;
  labels: DailyChartLabels;
  neutral: boolean;
  lang: string;
}) {
  const L = labels.board;
  if (boardKey.kind === "count") {
    return (
      <div className={cn("panel", styles.key)}>
        <span className={styles.keyHead}>
          <Scales size={16} weight="bold" aria-hidden />
          {L.keyCount}
        </span>
        {/* Ekran okuyucu cümleyi şeritten alır (`BreadthStrip` → `label`). */}
        <span className={styles.keyValue} aria-hidden>
          <span className="text-up">{boardKey.up}</span>
          <span className={styles.keySlash}>/</span>
          <span className="text-down">{boardKey.down}</span>
        </span>
        <span className={styles.keyFoot}>
          <BreadthStrip
            breadth={{ advancing: boardKey.up, unchanged: boardKey.flat, declining: boardKey.down }}
            label={labels.summary.signed
              .replace("{total}", String(boardKey.total))
              .replace("{up}", String(boardKey.up))
              .replace("{down}", String(boardKey.down))}
            animate
            className={styles.keyStrip}
          />
          <span className={styles.keyNote}>{L.countNote.replace("{total}", String(boardKey.total))}</span>
        </span>
      </div>
    );
  }
  const Icon = boardKey.fund ? SECTOR_ICONS[boardKey.fund] : undefined;
  const HeadIcon = boardKey.role === "share" ? ChartPieSlice : boardKey.role === "top" ? TrendUp : TrendDown;
  const title =
    boardKey.role === "share"
      ? L.keyShare
      : boardKey.role === "top"
        ? neutral ? L.keyTopNeutral : L.keyTop
        : neutral ? L.keyBottomNeutral : L.keyBottom;
  const body = (
    <>
      <span className={styles.keyHead}>
        <HeadIcon size={16} weight="bold" aria-hidden />
        {title}
      </span>
      <span
        className={cn(styles.keyValue, boardKey.dir === "up" ? "text-up" : boardKey.dir === "down" ? "text-down" : "text-strong")}
        lang={lang}
      >
        {boardKey.display}
      </span>
      <span className={styles.keyNote} lang={lang}>
        {Icon && <Icon size={14} weight="duotone" aria-hidden className={styles.keyIcon} />}
        <span className={styles.keyName}>{boardKey.name}</span>
        {boardKey.fund && <span className={styles.keySymbol}>{boardKey.fund}</span>}
      </span>
    </>
  );
  return boardKey.fund ? (
    <Link href={`/hisse/${boardKey.fund}`} prefetch={false} className={cn("panel", styles.key)} data-link="">
      {body}
      <ArrowRight size={14} weight="bold" aria-hidden className={styles.keyGo} />
    </Link>
  ) : (
    <div className={cn("panel", styles.key)}>{body}</div>
  );
}
