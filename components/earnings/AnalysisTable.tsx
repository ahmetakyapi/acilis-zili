import Link from "next/link";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
  verdictTextClass,
} from "@/lib/analysis";
import type { AnalysisIndexRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  cn,
  formatCompact,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";

/**
 * Son Analizler tablosu.
 *
 * Gerçek bir `<table>` değil: satırın tamamı tıklanabilir olmalı ve
 * `<tr>` üzerine yayılan bağlantı hiçbir tarayıcıda güvenilir çalışmıyor.
 * Izgara rollerle duyuruluyor, hücre genişlikleri sabit — sayı sütunları
 * satırdan satıra aynı hizada kalsın diye.
 *
 * Dar ekranda tablo YATAY kayar. Dokuz sütunu kırıp üst üste yığmak
 * denendiğinde satır bir kartın kötü taklidine dönüşüyordu; kaydırma en
 * azından sütun hizasını koruyor.
 */

const COLS = {
  symbol: "w-16 shrink-0",
  company: "min-w-[190px] flex-1",
  reported: "w-[124px] shrink-0",
  revenue: "w-28 shrink-0 text-right",
  eps: "w-[124px] shrink-0 text-right",
  reaction: "w-[86px] shrink-0 text-right",
  score: "w-[78px] shrink-0 text-center",
  verdict: "w-14 shrink-0 text-center",
  card: "w-[70px] shrink-0 text-right",
} as const;

/** Yön oku + renk — renk tek başına anlam taşımasın diye ok her zaman var. */
function toneOf(value: number | null): {
  className: string;
  arrow: string | null;
} {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { className: "text-muted", arrow: null };
  }
  if (value > 0) return { className: "text-up", arrow: "▲" };
  if (value < 0) return { className: "text-down", arrow: "▼" };
  return { className: "text-body", arrow: null };
}

function timingShort(timing: string | null, t: Dictionary): string {
  if (timing === "bmo") return t.earnings.beforeOpenShort;
  if (timing === "amc") return t.earnings.afterCloseShort;
  if (timing === "dmh") return t.earnings.duringMarket;
  return t.earnings.timeUnknown;
}

export function AnalysisTable({
  rows,
  locale,
  t,
  highlightFirst = false,
}: {
  rows: AnalysisIndexRow[];
  locale: Locale;
  t: Dictionary;
  /** İlk satır "Günün Analizi" olarak ayrıca gösteriliyorsa hafifçe işaretlenir. */
  highlightFirst?: boolean;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1060px]" role="table">
          <div
            role="row"
            className="flex items-center gap-4 border-b border-line px-4 py-3 text-[10.5px] font-bold text-muted sm:px-[22px]"
          >
            <span role="columnheader" className={COLS.symbol}>
              {t.analysis.colSymbol}
            </span>
            <span role="columnheader" className={COLS.company}>
              {t.analysis.colCompany}
            </span>
            <span role="columnheader" className={cn(COLS.reported, "whitespace-nowrap")}>
              {t.analysis.colReported}
            </span>
            <span role="columnheader" className={cn(COLS.revenue, "whitespace-nowrap")}>
              {t.analysis.colRevenue}
            </span>
            <span role="columnheader" className={cn(COLS.eps, "whitespace-nowrap")}>
              {t.analysis.colEps}
            </span>
            <span role="columnheader" className={cn(COLS.reaction, "whitespace-nowrap")}>
              {t.analysis.colReaction}
            </span>
            <span role="columnheader" className={COLS.score}>
              {t.analysis.colScore}
            </span>
            <span role="columnheader" className={COLS.verdict}>
              {t.analysis.colVerdict}
            </span>
            <span role="columnheader" className={COLS.card}>
              {t.analysis.colCard}
            </span>
          </div>

          {rows.map((row, index) => {
            const verdict = verdictOf(row.verdict);
            const revenueTone = toneOf(row.revenueYoyPct);
            const epsTone = toneOf(row.epsSurprisePct);
            const reactionTone = toneOf(row.reactionPct);
            return (
              <Link
                key={`${row.symbol}-${row.period}`}
                role="row"
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                className={cn(
                  "flex items-center gap-4 border-b border-line-soft px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-elevated sm:px-[22px]",
                  highlightFirst && index === 0 && "bg-primary-tint",
                )}
              >
                <span
                  role="cell"
                  className={cn(
                    COLS.symbol,
                    "text-[13.5px] font-bold",
                    highlightFirst && index === 0 ? "text-primary" : "text-strong",
                  )}
                >
                  {row.symbol}
                </span>
                <span role="cell" className={cn(COLS.company, "truncate text-[13px] text-body")}>
                  <b className="font-bold text-strong">{row.company}</b>
                  {" · "}
                  {row.periodLabel}
                </span>
                <span
                  role="cell"
                  className={cn(COLS.reported, "whitespace-nowrap text-xs text-muted")}
                >
                  {formatEtDateCompact(row.reportDate, locale)}
                  {" · "}
                  {timingShort(row.timing, t)}
                </span>
                <span
                  role="cell"
                  className={cn(
                    COLS.revenue,
                    "figure whitespace-nowrap text-[12.5px] font-bold",
                    revenueTone.className,
                  )}
                >
                  {row.revenue !== null ? `${formatCompact(row.revenue, locale)} $` : "—"}
                  {row.revenueYoyPct !== null && (
                    <>
                      {" "}
                      {revenueTone.arrow}{" "}
                      {formatPercentPlain(row.revenueYoyPct, locale, 0)}
                    </>
                  )}
                </span>
                <span
                  role="cell"
                  className={cn(
                    COLS.eps,
                    "figure whitespace-nowrap text-[12.5px] font-bold",
                    epsTone.className,
                  )}
                >
                  {row.eps !== null ? formatPrice(row.eps, locale, { currency: true }) : "—"}
                  {row.epsSurprisePct !== null && (
                    <> · {formatPercent(row.epsSurprisePct, locale, 0)}</>
                  )}
                </span>
                <span
                  role="cell"
                  className={cn(
                    COLS.reaction,
                    "figure whitespace-nowrap text-[12.5px] font-bold",
                    reactionTone.className,
                  )}
                >
                  {row.reactionPct !== null ? (
                    <>
                      {reactionTone.arrow}{" "}
                      {formatPercentPlain(row.reactionPct, locale, 1)}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span role="cell" className={cn(COLS.score, "flex justify-center")}>
                  <span
                    className={cn(
                      "figure rounded-full px-2.5 py-[3px] text-[11.5px] font-bold",
                      verdictPillClass(verdict),
                    )}
                  >
                    {row.score}
                  </span>
                </span>
                <span
                  role="cell"
                  className={cn(
                    COLS.verdict,
                    "text-[12.5px] font-bold",
                    verdictTextClass(verdict),
                  )}
                >
                  {verdictLabel(verdict, t)}
                </span>
                <span
                  role="cell"
                  className={cn(COLS.card, "text-[11.5px] font-semibold text-primary")}
                >
                  {t.analysis.reportCardLink}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
