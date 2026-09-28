import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { median, type MoveSet } from "@/lib/theme-stats";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";
import { RollingFigure } from "./RollingFigure";
import styles from "./Themes.module.css";

/**
 * Temanın ölçü ızgarası: günün medyanı, yükselen/düşen, en güçlü ve en
 * zayıf üye.
 *
 * MEDYAN, ORTALAMA DEĞİL. Sepette tek bir şirketin %20'lik bilanço günü
 * ortalamayı sürükleyip "tema bugün %2 yükseldi" dedirtir; medyan tipik
 * üyenin gününü söylüyor. Yükselen/düşen ve en iyi/en kötü de AYNI kümeden
 * (aynı seansı anlatan yüzdeler — `sameSessionMoves`): dört hücre birbirini
 * tutuyor. Son kapanışa ait kümede sayılar yön rengi almıyor.
 *
 * KAÇ ÜYE MEDYANDA, KÜNYEDE (28 Eylül denetimi). Bu seansta işlem
 * görmeyen ya da kotasyonu gelmeyen üye medyana girmiyor; künye bunu
 * söylemiyordu ve Siber Güvenlik'te "0 / 10" yükselen/düşen, kapaktaki
 * "11 Şirket"in yanında bir üyeyi sessizce kaybediyordu. Eksik varsa
 * künye "10/11 Üye" diyor.
 *
 * Üye sayısı buradan çıktı: kapakta duruyor ve ızgarada ikinci kez yer
 * tutuyordu.
 */
export function ThemeStats({
  rows,
  moves,
  locale,
  labels,
}: {
  rows: ThemeRow[];
  moves: MoveSet | null;
  locale: string;
  labels: {
    title: string;
    median: string;
    medianSession: string;
    medianLastClose: string;
    medianMissing: string;
    coverage: string;
    breadth: string;
    best: string;
    worst: string;
  };
}) {
  const mid = moves ? median(moves.values) : null;
  const neutral = moves?.basis !== "session";
  const tone = (value: number | null) =>
    value === null ? "text-muted" : neutral ? "text-body" : directionText(directionOf(value));

  const included = moves ? rows.filter((_, i) => moves.included[i]) : [];
  const ranked = [...included].sort((a, b) => b.changePct! - a.changePct!);
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const up = moves ? moves.values.filter((value) => value > 0).length : null;
  const down = moves ? moves.values.filter((value) => value < 0).length : null;
  const total = moves?.values.length ?? 0;
  const flat = total - (up ?? 0) - (down ?? 0);

  const member = (row: ThemeRow | null) =>
    row === null ? (
      <p className={cn("numeral", styles.metricValue, "text-muted")}>{NO_VALUE}</p>
    ) : (
      <>
        <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.member} data-cc={row.symbol}>
          <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" />
          <span className={styles.memberText}>
            <b className="numeral">{row.symbol}</b>
            <small>{row.name ?? NO_VALUE}</small>
          </span>
        </Link>
        <p className={cn("numeral", styles.metricValue, tone(row.changePct))}>
          <RollingFigure value={formatPercent(row.changePct, locale)} />
        </p>
      </>
    );

  return (
    <Panel>
      <PanelHeader
        title={labels.title}
        meta={
          moves === null
            ? undefined
            : [
                moves.basis === "session" ? labels.medianSession : labels.medianLastClose,
                ...(total < rows.length
                  ? [labels.coverage.replace("{count}", String(total)).replace("{total}", String(rows.length))]
                  : []),
              ].join(" · ")
        }
      />
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.median}</p>
          <p className={cn("numeral", styles.metricValue, tone(mid))}>
            {mid === null ? NO_VALUE : <RollingFigure value={formatPercent(mid, locale)} />}
          </p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.breadth}</p>
          <p className={cn("numeral", styles.metricValue)}>
            {up === null ? (
              <span className="text-muted">{NO_VALUE}</span>
            ) : (
              <>
                <span className={neutral ? "text-body" : "text-up"}>
                  <RollingFigure value={String(up)} />
                </span>
                <span className="px-1.5 text-muted">/</span>
                <span className={neutral ? "text-body" : "text-down"}>
                  <RollingFigure value={String(down)} />
                </span>
              </>
            )}
          </p>
          {total > 0 && (
            /* Oranın çizgisi: yükselen, yatay ve düşen aynı çubukta. Nötr
               kümede yön rengi yok, yalnızca ray. */
            <span className={styles.split} aria-hidden>
              {!neutral && up! > 0 && (
                <i data-tone="up" data-motion-draw="line" style={{ width: `${(up! / total) * 100}%`, transformOrigin: "left center" }} />
              )}
              {(neutral || flat > 0) && (
                <i data-tone="flat" style={{ width: `${((neutral ? total : flat) / total) * 100}%` }} />
              )}
              {!neutral && down! > 0 && (
                <i data-tone="down" data-motion-draw="line" style={{ width: `${(down! / total) * 100}%`, transformOrigin: "right center" }} />
              )}
            </span>
          )}
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.best}</p>
          {member(best)}
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.worst}</p>
          {member(worst)}
        </div>
      </div>
      {moves === null && (
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
          {labels.medianMissing}
        </p>
      )}
    </Panel>
  );
}
