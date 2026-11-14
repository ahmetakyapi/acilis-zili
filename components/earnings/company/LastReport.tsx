import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { TimingChip, type TimingTone } from "@/components/ui/primitives";
import type { VoteOutcome } from "@/lib/earnings-vote";
import { cn, etDateParts, formatPercent } from "@/lib/utils";
import { CycleLine, ExpectCell } from "./NextReport";
import css from "./CompanyEarnings.module.css";

/**
 * AÇIKLANMIŞ RAPOR VE TARİHSİZ DURUM — `/bilancolar/[symbol]` kahraman
 * yüzeyinin öteki iki hâli (14 Kasım 2026, görsel tur).
 *
 * NEDEN: sayfa yalnız "sıradaki rapor" durumunu çiziyordu. Rapor DÜN
 * açıklanmış şirkette (sıradaki tarih henüz takvimde yok ya da üç ay ötede)
 * panel "Takvimde Tarih Yok" başlığı altında tek paragraftan ibaretti: okur
 * o gün en çok merak ettiği şeyi (ne açıkladı, beklentiyi geçti mi) bu
 * sayfada göremiyordu, oysa sayı takvim satırında duruyordu. `LastReport`
 * aynı kompozisyonu sonuçla kurar: yaprak (rapor günü) · ne zaman ("Dün") ·
 * sonuç hapı; sağda gerçekleşen ile beklenti yan yana iki şerit (EPS ve
 * gelir; `ExpectCell`in ikinci kullanımı). Bütün sayılar takvim satırının
 * kendisinden (`epsActual` / `epsEstimate` / `revenueActual` /
 * `revenueEstimate`); rapor sonrası tepki varsa defterin okuduğu aynı
 * ölçümden. Olmayan hücre basılmaz.
 *
 * `NoReportDate`: takvimde ne sıradaki ne yakın geçmiş rapor var. Tek
 * paragraflık panel "kırık" görünüyordu; aynı yaprak kesik kenarla (yer
 * tutucu dili: kenarlık yalnız yer tutucuda) ve açıklamayla, tek satırlık
 * sakin bir durum. Uydurma tarih yok.
 */

type Money = { text: string; value: number };

export function LastReport({
  date,
  daysAgo,
  timing,
  outcome,
  eps,
  revenue,
  reactionPct,
  next,
  today,
  locale,
  labels,
  children,
}: {
  /** Sıradaki rapor biliniyorsa çeyrek çizgisi çizilir (nokta başta). */
  next: { date: string; estimated: boolean } | null;
  today: string;
  date: string;
  /** Rapordan bugüne geçen gün (ET). */
  daysAgo: number;
  timing: { label: string; tone: TimingTone } | null;
  outcome: VoteOutcome | null;
  eps: { actual: Money; estimate: Money | null } | null;
  revenue: { actual: Money; estimate: Money | null } | null;
  /** Raporun ertesindeki ilk seansın değişimi; ölçülmediyse null. */
  reactionPct: number | null;
  locale: string;
  labels: {
    reported: string;
    today: string;
    yesterday: string;
    daysAgo: string;
    beat: string;
    miss: string;
    inline: string;
    eps: string;
    revenue: string;
    actual: string;
    estimate: string;
    vsEstimate: string;
    reaction: string;
    lastReport: string;
    reportDay: string;
    cycleAria: string;
  };
  /** Sol sütunun dibi: açıklama paragrafı (sayfa verir). */
  children?: ReactNode;
}) {
  const leaf = leafParts(date, locale);
  const agoText = daysAgo <= 0 ? labels.today : daysAgo === 1 ? labels.yesterday : labels.daysAgo.replace("{n}", String(daysAgo));
  const OutcomeIcon = outcome === "beat" ? ArrowUpRight : outcome === "miss" ? ArrowDownRight : ArrowRight;
  const cells = [
    eps ? { key: "eps", title: labels.eps, figure: eps, tone: "signal" as const } : null,
    revenue ? { key: "revenue", title: labels.revenue, figure: revenue, tone: "neutral" as const } : null,
  ].filter((cell): cell is NonNullable<typeof cell> => cell !== null);

  return (
    <div
      className={css.next}
      data-plain={!cells.some((cell) => cell.figure.estimate) || undefined}
      /* Sıradaki tarih yoksa çeyrek çizgisi de yok ve sol sütun sağdakinden
         ~110 piksel kısa kalıyordu (ölçüldü, 1440). O durumda yatay düzen:
         üstte yaprak + açıklama, altında iki ölçü yan yana. */
      data-wide={!next || undefined}
    >
      <div className={css.when}>
        <div className={css.whenTop}>
          <div className={css.leafCol}>
            <div className={css.leaf} data-past>
              <span className={css.leafBand}>
                {leaf.month} {leaf.year}
              </span>
              <b className={cn("numeral", css.leafDay)}>{leaf.day}</b>
              <span className={css.leafWeekday}>{leaf.weekday}</span>
            </div>
          </div>
          <div className={css.countHead}>
            <p className={css.countLabel}>{labels.reported}</p>
            <p className={cn("figure", css.countValue)}>{agoText}</p>
            <div className={css.windowRow}>
              {outcome && (
                <span className={css.outcomePill} data-outcome={outcome}>
                  <OutcomeIcon aria-hidden weight="bold" size={14} />
                  {outcome === "beat" ? labels.beat : outcome === "miss" ? labels.miss : labels.inline}
                </span>
              )}
              {timing && <TimingChip tone={timing.tone}>{timing.label}</TimingChip>}
              {reactionPct !== null && (
                <span className={css.reactionNote}>
                  {labels.reaction}{" "}
                  <b className="figure" data-tone={reactionPct > 0 ? "up" : reactionPct < 0 ? "down" : undefined}>
                    {formatPercent(reactionPct, locale as "tr" | "en", 1)}
                  </b>
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Sol sütun sağ sütunla aynı boyda dursun diye DEĞİL, bilgi olduğu
            için: rapor yeni açıklandı, çeyrek saati başa döndü. Sıradaki
            tarih yoksa çizgi de yok (çeyreğin uzunluğu uydurulmaz). */}
        {next && (
          <CycleLine
            previousDate={date}
            date={next.date}
            today={today}
            estimated={next.estimated}
            locale={locale}
            labels={labels}
          />
        )}
        {children}
      </div>

      {cells.length > 0 && (
        <dl className={css.expect}>
          {cells.map((cell) => (
            <ExpectCell
              key={cell.key}
              title={cell.title}
              primary={cell.figure.actual}
              compare={cell.figure.estimate}
              rowLabels={{ primary: labels.actual, compare: labels.estimate }}
              changeLabel={labels.vsEstimate}
              tone={cell.tone}
              locale={locale}
            />
          ))}
        </dl>
      )}
    </div>
  );
}

export function NoReportDate({
  leafLabel,
  last,
  children,
}: {
  /** Yaprağın şeridi: "Tarih Yok". */
  leafLabel: string;
  /** Bilinen son rapor: etiket + biçimlenmiş tarih; yoksa null. */
  last: { label: string; date: string } | null;
  children?: ReactNode;
}) {
  return (
    <div className={css.none}>
      <div className={css.leaf} data-estimated data-empty>
        <span className={css.leafBand}>{leafLabel}</span>
        <span className={css.leafEmpty} aria-hidden>
          <CalendarBlank weight="duotone" size={34} />
        </span>
      </div>
      <div className={css.noneText}>
        {children}
        {last && (
          <p className={css.noneLast}>
            <span>{last.label}</span>
            <b className="figure">{last.date}</b>
          </p>
        )}
      </div>
    </div>
  );
}

function leafParts(date: string, locale: string) {
  const parts = etDateParts(date, locale);
  const anchor = new Date(`${date}T12:00:00Z`);
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  return {
    ...parts,
    weekday: new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(anchor),
    year: new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "UTC" }).format(anchor),
  };
}
