import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, LogoTile } from "@/components/ui/primitives";
import { SINCE_EDGES, median, sinceBins, sinceSplit, verdictMix, type SinceBin } from "@/lib/feed-visuals";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { PostStatus } from "@/lib/user-posts";
import { NO_VALUE, formatPercent, formatPercentPlain } from "@/lib/utils";
import styles from "./AnalysesCards.module.css";

/**
 * Analizlerim'in iki kart ızgarası (18 Ekim) — gerekçe
 * app/(app)/analizlerim/page.tsx. Saf görünüm: veri sayfadan gelir.
 */

type Names = Record<string, { logoUrl?: string | null; name?: string | null } | undefined>;

export type OwnNote = { id: string; title: string; dek: string; status: PostStatus; updatedAt: Date; symbols: string[] };

export function OwnNotes({ posts, names, statusLabels, locale }: { posts: OwnNote[]; names: Names; statusLabels: Record<PostStatus, string>; locale: Locale }) {
  const day = (value: Date) => value.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", year: "numeric" });
  return (
    <ul className={styles.notes}>
      {posts.map((post, i) => (
        <li key={post.id} className={styles.noteItem} style={{ "--i": i } as CSSProperties}>
          <Link href={`/yazilarim/${post.id}`} className={styles.note} data-status={post.status}>
            <span className={styles.noteTop}>
              <span className={styles.status}>{statusLabels[post.status]}</span>
              <time dateTime={post.updatedAt.toISOString().slice(0, 10)} className={styles.noteDate}>{day(post.updatedAt)}</time>
            </span>
            <span className={styles.noteTitle}>{post.title}</span>
            {post.dek && <span className={styles.noteDek}>{post.dek}</span>}
            {post.symbols.length > 0 && (
              <span className={styles.noteSymbols}>
                {post.symbols.slice(0, 3).map((sym) => (
                  <span key={sym} className={styles.chip}>
                    <LogoTile symbol={sym} logoUrl={names[sym]?.logoUrl} size="xs" />
                    {sym}
                  </span>
                ))}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MoreLink({ href, label }: { href: string; label: React.ReactNode }) {
  return <Link href={href} className={styles.more}>{label}</Link>;
}

const VERDICTS = ["buy", "hold", "sell", "insufficient"] as const;
type Verdict = (typeof VERDICTS)[number];

export type ReportCard = {
  id: string; symbol: string; horizon: string; verdict: string | null; score: number | null; generatedAt: string; since: number | null;
  /** Raporun fiyat haritası için: son 3 ayın kapanışları, tetikler, rapor fiyatı. */
  closes?: number[] | null; bullLevel?: number | null; bearLevel?: number | null; reportPrice?: number | null;
};

/** Minyatürün çizim kutusu (viewBox) — kart genişliğine `preserveAspectRatio="none"` ile yayılır. */
const MAP_W = 240;
const MAP_H = 44;
const MAP_PAD = 4;
/** Fiyattan bu kadar uzak tetik minyatürde çizilmez: çizgi ölçeği ezerdi (PriceMap'teki FAR_LEVEL ile aynı ruh). */
const MAP_FAR = 0.25;

/**
 * FİYAT HARİTASI MİNYATÜRÜ (25 Ekim) — raporun büyük fiyat haritasının
 * (components/ai/PriceMap.tsx) kart boyu: 3 aylık kapanış çizgisi, kesik
 * çizgiyle senaryo tetikleri, noktayla rapor fiyatı. Renk yalnız yönden:
 * çizgi dönemin yönü, tetikler olumlu/olumsuz (raporun kendi diliyle aynı).
 * Kapanışı olmayan eski raporda basılmaz.
 */
function MiniMap({ row, label }: { row: ReportCard; label: string }) {
  const closes = row.closes ?? [];
  if (closes.length < 2) return null;
  const price = row.reportPrice ?? closes.at(-1)!;
  const near = (v: number | null | undefined): v is number => typeof v === "number" && Math.abs(v / price - 1) <= MAP_FAR;
  const levels = ([[row.bullLevel, "up"], [row.bearLevel, "down"]] as const).filter(([v]) => near(v)) as [number, "up" | "down"][];
  const values = [...closes, price, ...levels.map(([v]) => v)];
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || lo * 0.01 || 1;
  const y = (v: number) => MAP_PAD + (1 - (v - lo) / span) * (MAP_H - MAP_PAD * 2);
  const x = (i: number) => (i / (closes.length - 1)) * MAP_W;
  const line = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  const tone = closes.at(-1)! >= closes[0] ? "up" : "down";
  return (
    <span className={styles.map} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="none" aria-hidden>
        {levels.map(([v, t]) => <line key={t} x1={0} x2={MAP_W} y1={y(v)} y2={y(v)} className={styles.mapLevel} data-tone={t} vectorEffect="non-scaling-stroke" />)}
        <polyline points={line} className={styles.mapLine} data-tone={tone} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className={styles.mapDot} data-tone={tone} style={{ top: `${(y(price) / MAP_H) * 100}%` }} aria-hidden />
    </span>
  );
}

type OverviewLabels = Dictionary["feedVisuals"]["analyses"];

/** Kova etiketi — "−%10 altı", "−%10 ile −%5 arası", "+%10 üstü". */
function binRange(bin: SinceBin, L: OverviewLabels, locale: Locale): string {
  const f = (v: number) => (v === 0 ? "0" : formatPercent(v, locale, 0));
  if (bin.from === null) return L.binBelow.replace("{to}", f(bin.to!));
  if (bin.to === null) return L.binAbove.replace("{from}", f(bin.from));
  return L.binBetween.replace("{from}", f(bin.from)).replace("{to}", f(bin.to));
}

/**
 * RAPORLARIN ÖZETİ — panelin tepesinde veriden tek cümle, görüş dağılımı
 * (görüşün sitedeki üçlüsü: AL yumuşak yeşil, TUT pirinç, SAT yumuşak
 * kırmızı — site geneli renk kararı) ve "Rapordan Bugüne" getiri kovaları (yön renkleri: sıfırın solu
 * düşüş, sağı yükseliş). Getiri yalnız TAZE kotasyonla hesaplanır
 * (sayfa: bayat paket `since` vermez); hiç yoksa kovalar basılmaz, cümle
 * bunu söyler.
 */
export function ReportsOverview({ rows, labels, L, locale }: { rows: ReportCard[]; labels: Dictionary["aiAnalysis"]; L: OverviewLabels; locale: Locale }) {
  const mix = verdictMix(rows.map((row) => row.verdict));
  const since = rows.map((row) => row.since).filter((v): v is number => v !== null);
  const bins = sinceBins(since);
  const peak = Math.max(1, ...bins.map((bin) => bin.count));
  const { up, down } = sinceSplit(since);
  const mid = median(since);
  const stocks = new Set(rows.map((row) => row.symbol)).size;
  const sentence = since.length
    ? L.sentence.replace("{n}", String(since.length)).replace("{up}", String(up)).replace("{down}", String(down)).replace("{median}", formatPercent(mid, locale, 1))
    : L.sentenceNoLive.replace("{n}", String(rows.length)).replace("{stocks}", String(stocks));
  return (
    <div className={styles.overview}>
      <p className={styles.overviewSentence}>{sentence}</p>
      <div className={styles.overviewGrid}>
        <figure className={styles.mix}>
          <figcaption className={styles.figTitle}>{L.mixTitle}</figcaption>
          <span className={styles.mixBar} role="img" aria-label={mix.filter((m) => m.count).map((m) => `${labels.verdicts[m.key]} ${m.count}`).join(", ")}>
            {mix.filter((m) => m.count > 0).map((m, i) => (
              <span key={m.key} className={styles.mixSeg} data-verdict={m.key} style={{ "--share": m.share, "--i": i } as CSSProperties} />
            ))}
          </span>
          <ul className={styles.mixLegend}>
            {mix.map((m, i) => (
              <li key={m.key} data-verdict={m.key} data-empty={m.count === 0 || undefined}>
                <span className={styles.mixSwatch} aria-hidden />
                <span className={styles.mixName}>{labels.verdicts[m.key]}</span>
                <span className={styles.mixCount}>{m.count}</span>
                <span className={styles.mixShare}>{formatPercentPlain(m.share * 100, locale, 0)}</span>
                <span className={styles.mixLane} aria-hidden><span style={{ "--share": m.share, "--i": i } as CSSProperties} /></span>
              </li>
            ))}
          </ul>
          <p className={styles.figHint}>{L.mixHint}</p>
        </figure>
        {since.length > 0 && (
          <figure className={styles.since}>
            <figcaption className={styles.figTitle}>{L.sinceTitle}</figcaption>
            <div className={styles.bins}>
              {bins.map((bin, i) => (
                <span
                  key={i}
                  className={styles.bin}
                  data-side={bin.side}
                  title={L.binAria.replace("{range}", binRange(bin, L, locale)).replace("{n}", String(bin.count))}
                >
                  <span className={styles.binCount}>{bin.count || ""}</span>
                  <span className={styles.binBar} style={{ "--h": bin.count / peak, "--i": i } as CSSProperties} />
                  <span className="sr-only">{L.binAria.replace("{range}", binRange(bin, L, locale)).replace("{n}", String(bin.count))}</span>
                </span>
              ))}
            </div>
            <div className={styles.binAxis} aria-hidden>
              {SINCE_EDGES.map((edge, i) => (
                <span key={edge} style={{ left: `${((i + 1) / bins.length) * 100}%` }} data-zero={edge === 0 || undefined}>
                  {edge === 0 ? "0" : formatPercent(edge, locale, 0)}
                </span>
              ))}
            </div>
            <p className={styles.figHint}>{L.sinceHint}</p>
          </figure>
        )}
      </div>
    </div>
  );
}

export function ClaudeReports({ rows, names, labels, mapAria, locale }: { rows: ReportCard[]; names: Names; labels: Dictionary["aiAnalysis"]; mapAria: string; locale: Locale }) {
  const P = labels.page;
  const stamp = (value: string) =>
    new Date(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <ol className={styles.reports}>
      {rows.map((row, i) => {
        const verdict: Verdict = VERDICTS.includes(row.verdict as Verdict) ? (row.verdict as Verdict) : "insufficient";
        const score = row.score === null ? null : Math.max(0, Math.min(100, row.score));
        return (
          <li key={row.id} className={styles.reportItem} style={{ "--i": Math.min(i, 8) } as CSSProperties}>
            <Link href={`/claude/${encodeURIComponent(row.symbol)}?sekme=rapor&rapor=${row.id}`} className={styles.report} data-verdict={verdict}>
              <span className={styles.reportHead}>
                <LogoTile symbol={row.symbol} logoUrl={names[row.symbol]?.logoUrl} size="md" />
                <span className={styles.stock}>
                  <span className={styles.symbol}>{row.symbol}</span>
                  <span className={styles.name}>{names[row.symbol]?.name ?? ""}</span>
                </span>
                {/* Puan halkası: boyu puan, rengi görüş (AL/TUT/SAT üçlüsü, 25 Ekim). */}
                <span className={styles.ring} role="img" aria-label={`${P.score}: ${score ?? NO_VALUE}`}>
                  <svg viewBox="0 0 40 40" aria-hidden>
                    <circle cx="20" cy="20" r="17" className={styles.ringLane} />
                    {score !== null && <circle cx="20" cy="20" r="17" pathLength={100} className={styles.ringFill} style={{ "--score": score } as CSSProperties} />}
                  </svg>
                  <span className={styles.ringValue}>{score ?? NO_VALUE}</span>
                </span>
              </span>
              <MiniMap row={row} label={mapAria.replace("{symbol}", row.symbol)} />
              <span className={styles.reportMid}>
                <span className={styles.verdict}>{labels.verdicts[verdict]}</span>
                <span className={styles.focus}>{row.horizon === "medium" ? labels.focus.selection : labels.focus.technical}</span>
              </span>
              <span className={styles.reportFoot}>
                <span className={styles.footCell}>
                  <small>{P.date} · TR</small>
                  {stamp(row.generatedAt)}
                </span>
                <span className={styles.footCell} data-end>
                  <small>{labels.sinceReport}</small>
                  {row.since === null ? NO_VALUE : <ChangePill changePct={row.since} locale={locale} size="sm" />}
                </span>
              </span>
              <span className="sr-only">{P.open}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
