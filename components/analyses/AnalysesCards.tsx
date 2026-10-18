import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, LogoTile } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { PostStatus } from "@/lib/user-posts";
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

export type ReportCard = { id: string; symbol: string; horizon: string; verdict: string | null; score: number | null; generatedAt: string; since: number | null };

export function ClaudeReports({ rows, names, labels, locale }: { rows: ReportCard[]; names: Names; labels: Dictionary["aiAnalysis"]; locale: Locale }) {
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
                {/* Puan halkası: büyüklük, yön değil — renk mürekkep. */}
                <span className={styles.ring} role="img" aria-label={`${P.score}: ${score ?? "—"}`}>
                  <svg viewBox="0 0 40 40" aria-hidden>
                    <circle cx="20" cy="20" r="17" className={styles.ringLane} />
                    {score !== null && <circle cx="20" cy="20" r="17" pathLength={100} className={styles.ringFill} style={{ "--score": score } as CSSProperties} />}
                  </svg>
                  <span className={styles.ringValue}>{score ?? "—"}</span>
                </span>
              </span>
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
                  {row.since === null ? "—" : <ChangePill changePct={row.since} locale={locale} size="sm" />}
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
