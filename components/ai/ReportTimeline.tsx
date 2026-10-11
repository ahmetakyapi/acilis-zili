"use client";
import { Fragment, type CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { formatSpan, type NextReport } from "@/lib/ai-analysis-core";
import type { ReportAuthor } from "@/lib/ai-analysis-reports";
import { useNow } from "./useNow";
import styles from "./Claude.module.css";

export type TimelineItem = {
  id: string; href: string; verdict: "buy" | "hold" | "sell" | "insufficient"; score: number | null;
  at: string; time: string; day: string | null; author: ReportAuthor | null; mine: boolean; current: boolean;
};

/** Baş harfler kodda ve dile göre büyütülür (CSS `uppercase` Türkçe `i`yi `I` yapar). */
export const initialsOf = (name: string, locale: string) => name.slice(0, 2).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");

/**
 * Bu hissenin bu odaktaki raporları soldan sağa (eskiden yeniye), sonra
 * "Şimdi" ve önerilen sonraki rapor. Düğümler eşit aralıklı: gerçek süre
 * orantılı çizilseydi bir günlük boşluk bir saatlik boşluğu ekrandan
 * silerdi; süre aradaki künyede yazılı.
 *
 * KAYDIRMA YOK (11 Ekim, sahibinin isteği). İlk sürüm sekiz raporu yatay
 * kaydırılan bir izde gösteriyordu; telefonda ekranda bir rapor ya da yalnız
 * "Şimdi" kalıyordu. Şimdi son üç rapor; panel dar olunca (kap sorgusu,
 * Claude.module.css → .timeline) iz dikey ray olur, genişse tek satıra sığar.
 * Daha eskisi Geçmiş sekmesinde ("Tüm Raporlar").
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

  const span = (ms: number) => formatSpan(ms, T.units);
  const waiting = next ? new Date(next.at).getTime() > now : false;
  const last = items.at(-1);

  return <Panel className={styles.timeline}>
    <PanelHeader title={T.title} meta={T.hours} action={more ? <Link href={more} scroll={false} className={styles.tlMore}>{T.more}</Link> : undefined} />
    {items.length ? <ol className={styles.track} aria-label={T.title}>
      {items.map((r, i) => <Fragment key={r.id}>
        {i > 0 && <li className={styles.tlGap} aria-hidden>{span(new Date(r.at).getTime() - new Date(items[i - 1].at).getTime())}</li>}
        <li className={styles.tlStep} style={{ "--i": i } as CSSProperties}>
        <span className={styles.tlRow} data-current={r.current ? "" : undefined}>
        <Link href={r.href} scroll={false} className={styles.tlNode} data-verdict={r.verdict} aria-current={r.current ? "true" : undefined}>
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
        </span>
        </li>
      </Fragment>)}
      {last && <li className={styles.tlGap} aria-hidden>{T.ago.replace("{t}", span(now - new Date(last.at).getTime()))}</li>}
      <li className={styles.tlStep} data-kind="now" style={{ "--i": items.length } as CSSProperties}>
        <span className={styles.tlNow} data-ready={waiting ? undefined : ""}>
          <span className={styles.tlDot} aria-hidden />
          <b>{T.now}</b>
          {!waiting && next && <small>{T.ready}</small>}
        </span>
      </li>
      {next && waiting && <li className={styles.tlGap} aria-hidden>{T.after.replace("{t}", span(new Date(next.at).getTime() - now))}</li>}
      {next && waiting && <li className={styles.tlStep} data-kind="next" style={{ "--i": items.length + 1 } as CSSProperties}>
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
