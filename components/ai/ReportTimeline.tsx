"use client";
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
 * SON RAPORLAR (12 Ekim, sahibinin itirazı: "ne anlattığı anlaşılmıyor, çok
 * video gibi duruyor"). Önceki sürüm raporları, "Şimdi"yi ve önerilen
 * sonraki raporu noktalı bir hatta eşit kartlar olarak diziyordu; hat,
 * kesik çizgili gelecek kartı ve aradaki süre künyeleri bir video
 * oynatıcının ilerleme çubuğu gibi okunuyordu, asıl iki bilgi (hangi raporlar
 * var, yenisi ne zaman anlamlı) kayboluyordu.
 *
 * Şimdi iki düz parça: son raporların listesi (yeniden eskiye; saat, karar,
 * puan, oluşturan; satır raporu açar) ve altında hairline ile ayrılmış
 * "Sıradaki Rapor" künyesi: önerilen an, kalan süre, nedeni tek cümle.
 * Hat, nokta, "Şimdi" kartı, giriş kademesi yok. Daha eskisi Geçmiş
 * sekmesinde ("Tüm Raporlar").
 *
 * Öneri yumuşaktır (`nextReportAt`, lib/ai-analysis-core.ts): düğme her
 * zaman çalışır, burası yalnız ne zaman anlamlı olduğunu söyler. Kalan süre
 * istemcide 30 sn'de bir tazelenir, ilk çizim sunucunun saatiyle.
 */
export function ReportTimeline({ items, next, nextLabel, now: serverNow, locale, t, focus, more }: {
  items: TimelineItem[]; next: NextReport | null; nextLabel: string | null; now: string; locale: string;
  t: Dictionary["aiAnalysis"]; focus: "technical" | "selection"; more: string | null;
}) {
  const T = t.claude.timeline;
  const now = useNow(serverNow);
  const span = (ms: number) => formatSpan(ms, T.units);
  const nextAt = next ? new Date(next.at).getTime() : 0;
  const waiting = next !== null && nextAt > now;
  const last = items.at(-1);
  const rows = [...items].reverse();

  return <Panel className={styles.timeline}>
    <PanelHeader title={T.title} meta={T.hours} action={more ? <Link href={more} scroll={false} className={styles.tlMore}>{T.more}</Link> : undefined} />
    <ol className={styles.tlList}>
      {rows.map(r => <li key={r.id}>
        <Link href={r.href} scroll={false} className={styles.tlRow} data-verdict={r.verdict} aria-current={r.current ? "true" : undefined}>
          <span className={styles.tlWhen}><b className="numeral">{r.time}</b><small>{r.day ?? T.today}</small></span>
          <span className={styles.tlVerdict}>
            {r.score !== null ? <ScoreRing score={r.score} verdict={r.verdict === "insufficient" ? "hold" : r.verdict} size={30} /> : <span className={styles.tlRingEmpty} aria-hidden />}
            <b>{t.verdicts[r.verdict]}</b>
          </span>
          <span className={styles.tlBy}>
            {r.author ? <>
              <AvatarTile icon={r.author.icon} color={r.author.color} initials={initialsOf(r.author.name, locale)} className={styles.tlAvatar} />
              <span className={styles.tlName}><span className="sr-only">{T.author}: </span>{r.author.name}</span>
              {r.mine && <i>{T.mine}</i>}
            </> : <span className={styles.tlName}>{T.noAuthor}</span>}
          </span>
        </Link>
      </li>)}
    </ol>
    {next && <div className={styles.tlNext} data-ready={waiting ? undefined : ""}>
      <p className={styles.tlNextHead}>
        <span>{T.next}</span>
        <b className="numeral">{waiting ? nextLabel : T.ready}</b>
        {waiting && <small>{T.after.replace("{t}", span(nextAt - now))}</small>}
      </p>
      <p className={styles.tlNote}>
        {!waiting && last ? T.readyNote.replace("{t}", span(now - new Date(last.at).getTime()))
          : next.reason === "market-closed"
            ? T.closedNote.replace("{time}", nextLabel ?? "")
            : T.gapNote.replace("{gap}", span(next.gapMinutes * 60_000)).replace("{why}", T.why[focus])}
      </p>
    </div>}
  </Panel>;
}
