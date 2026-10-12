"use client";
import type { CSSProperties, ReactNode } from "react";
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
  const tag = locale === "tr" ? "tr-TR" : "en-GB";
  const clockOf = (at: number) => new Date(at).toLocaleTimeString(tag, { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
  const dayOf = (at: number) => new Date(at).toLocaleDateString(tag, { timeZone: "Europe/Istanbul", day: "numeric", month: "short" });
  const clock = clockOf(now);
  /* Önerilen adımın başlığı da rapor kartları gibi: büyük satırda yalnız
     saat, gün ve tür ("Önerilen" / "Açılışta") küçük künyede (12 Ekim).
     "13 Eki 03:04" telefonda 4,8em'lik sütuna sığmayıp sağdaki "1 gün
     Sonra"nın üstüne biniyordu; "Açılışta" da "Açılış…" diye kesiliyordu. */
  const nextAt = next ? new Date(next.at).getTime() : 0;
  const nextDay = next && dayOf(nextAt) !== dayOf(now) ? dayOf(nextAt) : null;

  /* Her adım aynı üç satırı taşır (saat · durum · alt künye), boşken bile;
     kartlar bu yüzden aynı boyda ve satırları aynı hizada. Hattaki süre
     künyesi bir SONRAKİ adıma kadar olan süredir. */
  type Step = { key: string; kind: "report" | "now" | "next"; link: string | null; current?: boolean; body: ReactNode };
  const steps: Step[] = items.map((r, i) => ({
    key: r.id, kind: "report", current: r.current,
    link: span((i + 1 < items.length ? new Date(items[i + 1].at).getTime() : now) - new Date(r.at).getTime()),
    body: <Link href={r.href} scroll={false} className={styles.tlCard} data-verdict={r.verdict} aria-current={r.current ? "true" : undefined}>
      <span className={styles.tlHead}><b className="figure">{r.time}</b><small>{r.day ?? T.today}</small></span>
      <span className={styles.tlMid}>
        {r.score !== null ? <ScoreRing score={r.score} verdict={r.verdict === "insufficient" ? "hold" : r.verdict} size={30} /> : <span className={styles.tlRingEmpty} aria-hidden />}
        <b>{t.verdicts[r.verdict]}</b>
      </span>
      <span className={styles.tlFoot}>
        {r.author ? <>
          <AvatarTile icon={r.author.icon} color={r.author.color} initials={initialsOf(r.author.name, locale)} className={styles.tlAvatar} />
          <span className={styles.tlName}><span className="sr-only">{T.author}: </span>{r.author.name}</span>
          {r.mine && <i>{T.mine}</i>}
        </> : <span className={styles.tlName}>{T.noAuthor}</span>}
      </span>
    </Link>,
  }));
  steps.push({
    key: "now", kind: "now", link: next && waiting ? span(new Date(next.at).getTime() - now) : null,
    body: <div className={styles.tlCard} data-ready={waiting ? undefined : ""}>
      <span className={styles.tlHead}><b className="figure">{clock}</b><small>{T.now}</small></span>
      <span className={styles.tlMid}><span className={styles.tlPulse} aria-hidden /><b>{next && waiting ? T.left.replace("{t}", span(new Date(next.at).getTime() - now)) : T.ready}</b></span>
      <span className={styles.tlFoot}><span className={styles.tlName}>{last ? T.sinceLast.replace("{t}", span(now - new Date(last.at).getTime())) : T.empty}</span></span>
    </div>,
  });
  if (next && waiting) steps.push({
    key: "next", kind: "next", link: null,
    body: <div className={styles.tlCard}>
      <span className={styles.tlHead}><b className="figure">{clockOf(nextAt)}</b><small>{[nextDay, next.reason === "market-closed" ? T.atOpen : T.suggested].filter(Boolean).join(" · ")}</small></span>
      <span className={styles.tlMid}><b>{T.after.replace("{t}", span(nextAt - now))}</b></span>
      <span className={styles.tlFoot}><span className={styles.tlName}>{T.wait.replace("{t}", span(next.gapMinutes * 60_000))}</span></span>
    </div>,
  });

  return <Panel className={styles.timeline}>
    <PanelHeader title={T.title} meta={T.hours} action={more ? <Link href={more} scroll={false} className={styles.tlMore}>{T.more}</Link> : undefined} />
    <ol className={styles.track} aria-label={T.title} style={{ "--steps": steps.length } as CSSProperties}>
      {steps.map((st, i) => <li key={st.key} className={styles.tlStep} data-kind={st.kind} data-current={st.current ? "" : undefined} data-link={st.link ? "" : undefined} style={{ "--i": i } as CSSProperties}>
        <span className={styles.tlDot} aria-hidden />
        {st.body}
        {st.link && <span className={styles.tlLink}>{st.link}</span>}
      </li>)}
    </ol>
    {next && <p className={styles.tlNote}>
      {next.reason === "market-closed"
        ? T.closedNote.replace("{time}", nextLabel ?? "")
        : T.gapNote.replace("{gap}", span(next.gapMinutes * 60_000)).replace("{why}", T.why[focus])}
    </p>}
  </Panel>;
}
