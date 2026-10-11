"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { formatSpan, type NextReport } from "@/lib/ai-analysis-core";
import { initialsOf } from "@/lib/avatars";
import type { ReportAuthor } from "@/lib/ai-analysis-reports";
import { useNow } from "./useNow";
import styles from "./Claude.module.css";

export type TimelineItem = {
  id: string; href: string; verdict: "buy" | "hold" | "sell" | "insufficient"; score: number | null;
  at: string; time: string; day: string | null; author: ReportAuthor | null; mine: boolean; current: boolean;
};


/**
 * Bu hissenin bu odaktaki raporları soldan sağa (eskiden yeniye), sonra
 * "Şimdi" ve önerilen sonraki rapor. Düğümler eşit aralıklı: gerçek süre
 * orantılı çizilseydi bir günlük boşluk bir saatlik boşluğu ekrandan
 * silerdi; süre aradaki künyede yazılı.
 *
 * Öneri yumuşaktır (`nextReportAt`, lib/ai-analysis-core.ts): düğme her
 * zaman çalışır, burası yalnız ne zaman anlamlı olduğunu söyler. Geri sayım
 * istemcide 30 sn'de bir tazelenir, ilk çizim sunucunun saatiyle.
 */
export function ReportTimeline({ items, next, nextLabel, now: serverNow, locale, t, focus, more }: {
  items: TimelineItem[]; next: NextReport | null; nextLabel: string | null; now: string; locale: string;
  t: Dictionary["aiAnalysis"]; focus: "technical" | "selection"; more: string | null;
}) {
  const T = t.claude.timeline;
  const now = useNow(serverNow);
  const track = useRef<HTMLOListElement>(null);
  // En yeni sağda. Sığmazsa iz açık rapordan (yoksa en yenisinden) başlar: sona kaydırmak
  // telefonda yalnız "Şimdi" ile öneriyi bırakıyordu, raporun kendisi ekrandan çıkıyordu (ölçüldü, 390 px).
  useEffect(() => {
    const el = track.current, anchor = el?.querySelector<HTMLElement>("[data-anchor]");
    if (el && anchor) el.scrollLeft = anchor.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft);
  }, []);
  const anchorId = (items.find(r => r.current) ?? items.at(-1))?.id;

  const span = (ms: number) => formatSpan(ms, T.units);
  const waiting = next ? new Date(next.at).getTime() > now : false;
  const last = items.at(-1);

  return <Panel className={styles.timeline}>
    <PanelHeader title={T.title} meta={T.hours} />
    {items.length ? <ol ref={track} className={styles.track} tabIndex={0} aria-label={T.title}>
      {more && <li className={styles.tlMore}><Link href={more} scroll={false}>{T.more}</Link></li>}
      {items.map((r, i) => <li key={r.id} className={styles.tlStep} style={{ "--i": i } as CSSProperties}>
        {i > 0 && <span className={styles.tlGap} aria-hidden>{span(new Date(r.at).getTime() - new Date(items[i - 1].at).getTime())}</span>}
        <Link href={r.href} scroll={false} className={styles.tlNode} data-verdict={r.verdict} data-anchor={r.id === anchorId ? "" : undefined} aria-current={r.current ? "true" : undefined}>
          <span className={styles.tlWhen}><b className="figure">{r.time}</b>{r.day && <small>{r.day}</small>}</span>
          <span className={styles.tlVerdict}>
            {r.score !== null && <ScoreRing score={r.score} verdict={r.verdict === "insufficient" ? "hold" : r.verdict} size={26} />}
            <b>{t.verdicts[r.verdict]}</b>
          </span>
          {r.author && <span className={styles.tlAuthor}>
            <AvatarTile icon={r.author.icon} color={r.author.color} initials={initialsOf(r.author.name, locale)} className={styles.tlAvatar} />
            <span><span className="sr-only">{T.author}: </span>{r.author.name}</span>
            {r.mine && <i>{T.mine}</i>}
          </span>}
        </Link>
      </li>)}
      <li className={styles.tlStep} style={{ "--i": items.length } as CSSProperties}>
        {last && <span className={styles.tlGap} aria-hidden>{T.ago.replace("{t}", span(now - new Date(last.at).getTime()))}</span>}
        <span className={styles.tlNow} data-ready={waiting ? undefined : ""}>
          <span className={styles.tlDot} aria-hidden />
          <b>{T.now}</b>
          {!waiting && next && <small>{T.ready}</small>}
        </span>
      </li>
      {next && waiting && <li className={styles.tlStep} style={{ "--i": items.length + 1 } as CSSProperties}>
        <span className={styles.tlGap} aria-hidden>{T.after.replace("{t}", span(new Date(next.at).getTime() - now))}</span>
        <span className={styles.tlNext}>
          <small>{T.next}</small>
          <b className="figure">{next.reason === "market-closed" ? `${T.atOpen} · ${nextLabel}` : nextLabel}</b>
          <span className="sr-only">{T.after.replace("{t}", span(new Date(next.at).getTime() - now))}</span>
        </span>
      </li>}
    </ol> : <p className={styles.tlEmpty}>{T.empty}</p>}
    {next && <p className={styles.tlNote}>
      {next.reason === "market-closed"
        ? T.closedNote.replace("{time}", nextLabel ?? "")
        : T.gapNote.replace("{gap}", span(next.gapMinutes * 60_000)).replace("{why}", T.why[focus])}
    </p>}
  </Panel>;
}
