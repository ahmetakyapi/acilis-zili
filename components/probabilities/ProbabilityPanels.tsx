import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import type { NextFomc } from "@/lib/macro-data";
import { etDateTimeToUtc } from "@/lib/market-hours";
import {
  change24h,
  cpiLadder,
  ELECTION_DAY_ET,
  eventProbabilities,
  FED_MOVES,
  FIRST_POLLS_CLOSE_ET,
  fedSides,
  historyLine,
  ladderMedian,
  liquidityOf,
  nextMeeting,
  pollsClosed,
  percentShares,
  ratePath,
  resolvedOutcome,
  topOutcome,
  type FedMove,
  type FedSide,
  type ProbabilitySnapshot,
  type ProbEvent,
} from "@/lib/probabilities";
import { readerDayOffset, TR_ZONE, formatInZone, zoneDateKey } from "@/lib/session-clock";
import { formatEtDateCompact, formatPercentPlain, formatPrice, relativeDayLabel } from "@/lib/utils";
import { ProbabilityLine, type LineRow, type LineSeries } from "./ProbabilityLine";
import { ProbabilityStack, RatePath, etOf, pct, shareMap, shareText, signedPoints } from "./ProbabilityParts";
import styles from "./Probabilities.module.css";

/**
 * Olasılıklar sayfasının panelleri (25 Ekim). Her panel kendi `h2`siyle;
 * sıra CLAUDE.md "Ekran düzeni": başlık → ana görsel (büyük sayı + çubuk) →
 * çizgi → künye. Sayılar `lib/probabilities.ts`ten; burada yalnız biçim.
 */

type P = Dictionary["probabilities"];

const NY_ZONE = "America/New_York";
const DAY_MONTH = new Map<string, Intl.DateTimeFormat>();

/** "28 Ekim" / "October 28" — yılsız uzun tarih (ET günü). */
export function dayMonth(dateEt: string, locale: Locale): string {
  const key = locale;
  let format = DAY_MONTH.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long", timeZone: "UTC" });
    DAY_MONTH.set(key, format);
  }
  return format.format(new Date(`${dateEt}T12:00:00Z`));
}

/** Bir ET anının iki saati, okuyucunun saati önce ("21:00 TR · 14:00 NY"); gün değişiyorsa tarihiyle. */
function clockPair(dateEt: string, timeEt: string, locale: Locale): { primary: string; secondary: string } {
  const at = etDateTimeToUtc(dateEt, timeEt);
  const trDate = zoneDateKey(at, TR_ZONE);
  const tr = `${trDate !== dateEt ? `${dayMonth(trDate, locale)} ` : ""}${formatInZone(at, TR_ZONE)} TR`;
  const ny = `${formatInZone(at, NY_ZONE)} NY`;
  return locale === "tr" ? { primary: tr, secondary: ny } : { primary: ny, secondary: tr };
}

/** Günlük mumun etiketi: dönemin BİTTİĞİ an ET gece yarısı, gün bir önceki. */
function candleDay(t: number, locale: Locale): string {
  return formatEtDateCompact(etOf(new Date((t - 60) * 1000).toISOString()).date, locale);
}

/**
 * Çizginin satırları; son satır ŞİMDİKİ okuma. Mumlar dünkü kapanışta
 * bitiyor ve çizginin ucu (künyesiyle) panelin büyük sayısından farklı bir
 * sayı söylüyordu (%92 / %93, ölçüldü). Uç artık büyük sayıyla aynı kayıt.
 */
function lineRows(
  event: ProbEvent,
  groups: { key: string; keys: readonly string[] }[],
  locale: Locale,
  takenAt: string,
): LineRow[] {
  const now = eventProbabilities(event);
  const lines = groups.map((g) => ({ key: g.key, points: historyLine(event, g.keys) }));
  const byTime = new Map<number, Record<string, number>>();
  for (const line of lines) {
    for (const point of line.points) {
      const row = byTime.get(point.t) ?? {};
      row[line.key] = point.p;
      byTime.set(point.t, row);
    }
  }
  const rows = [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([t, values]) => ({ label: candleDay(t, locale), values }));
  if (now && rows.length > 0) {
    rows.push({
      label: formatEtDateCompact(etOf(takenAt).date, locale),
      values: Object.fromEntries(groups.map((g) => [g.key, g.keys.reduce((sum, key) => sum + (now[key] ?? 0), 0)])),
    });
  }
  return rows;
}

/** Çizginin uç künyeleri: son satırın payları (toplamı 100, büyük sayıyla aynı kural). */
function endTexts(rows: LineRow[], keys: readonly string[], locale: Locale): Record<string, string> | undefined {
  const last = rows.at(-1);
  if (!last) return undefined;
  const values = keys.map((key) => last.values[key] ?? 0);
  /* Tek seride tümleyen (Hayır) pay hesabına girer, künyeye girmez. */
  const shares = keys.length === 1 ? percentShares([values[0], 1 - values[0]]) : percentShares(values);
  return Object.fromEntries(keys.map((key, i) => [key, shareText(shares[i], locale, values[i])]));
}

function DeltaFact({ points, p, locale }: { points: number | null; p: P; locale: Locale }) {
  if (points === null) return null;
  return (
    <div>
      <dt>{p.change24h}</dt>
      <dd className={`${styles.delta} numeral`}>
        {points === 0 ? p.noChange : p.points.replace("{n}", signedPoints(points, locale))}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ FED */

const FED_SIDES: readonly FedSide[] = ["cut", "hold", "hike"];

export function FedPanel({
  snapshot,
  fomc,
  locale,
  t,
}: {
  snapshot: ProbabilitySnapshot;
  fomc: NextFomc | null;
  locale: Locale;
  t: Dictionary;
}) {
  const p = t.probabilities;
  const meeting = nextMeeting(snapshot.fed);
  const liquidity = meeting ? liquidityOf(meeting) : "hidden";
  const probs = meeting && liquidity !== "hidden" ? eventProbabilities(meeting) : null;
  if (!meeting || !probs) {
    return (
      <Panel>
        <PanelHeader title={p.fedTitle} />
        <p className={`${styles.note} px-4 pb-5 sm:px-5`}>{p.panelEmpty}</p>
      </Panel>
    );
  }
  const top = topOutcome(probs)!;
  const at = meeting.strikeAt ? etOf(meeting.strikeAt) : null;
  const clocks = at ? clockPair(at.date, at.time, locale) : null;
  const days = at ? readerDayOffset(at.date, at.time, locale) : null;
  const delta = change24h(meeting, top.key);
  /* Takvimle aynı toplantı mı: aynı ET günü. Değilse bağlantı basılmaz;
     kaynağın tarihi yine görünür (karar kaydı: aynı olay iki yerde aynı
     günü söylemeli, söylemiyorsa okuyucuyu çelişkiye götürmeyiz). */
  const sameMeeting = fomc !== null && at !== null && fomc.date === at.date;
  /* Hedef aralık FRED'den (makro kartıyla aynı kaynak, aynı sayı). */
  const target = fomc?.target ?? null;
  const rows = lineRows(
    meeting,
    [
      { key: "cut", keys: ["cut50", "cut25"] },
      { key: "hold", keys: ["hold"] },
      { key: "hike", keys: ["hike25", "hike50"] },
    ],
    locale,
    snapshot.takenAt,
  );
  const sides = fedSides(probs);
  const series: LineSeries[] = FED_SIDES.map((side) => ({ key: side, label: p.fedSides[side], tone: side }));
  const segments = FED_MOVES.map((move) => ({ key: move, label: p.fedOutcomes[move], p: probs[move] ?? 0 }));
  const shares = shareMap(segments);

  return (
    <Panel>
      <PanelHeader
        title={p.fedTitle}
        meta={at && clocks ? p.fedMeta.replace("{date}", dayMonth(at.date, locale)).replace("{time}", clocks.primary) : undefined}
      />
      <div className={styles.body}>
        <div className={styles.hero}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>{p.fedLeadLabel}</span>
            <span className={styles.figureValue}>
              <b>{shareText(shares[top.key], locale)}</b>
              <span>{p.fedOutcomes[top.key as FedMove]}</span>
            </span>
          </div>
          <dl className={styles.facts}>
            <DeltaFact points={delta} p={p} locale={locale} />
            {days !== null && days >= 0 && (
              <div>
                <dt>{p.fedCountdown}</dt>
                <dd className="numeral">{relativeDayLabel(days, t.calendar)}</dd>
              </div>
            )}
            {target && (
              <div>
                <dt>{p.fedTarget}</dt>
                <dd className="numeral">{`${formatPercentPlain(target.lower, locale, 2)} - ${formatPercentPlain(target.upper, locale, 2)}`}</dd>
              </div>
            )}
          </dl>
        </div>

        <ProbabilityStack
          segments={segments}
          lead={top.key}
          locale={locale}
          ariaLabel={p.fedBarLabel.replace("{list}", segments.map((s) => `${s.label} ${shareText(shares[s.key], locale, s.p)}`).join(", "))}
        />

        {rows.length >= 2 && (
          <ProbabilityLine
            series={series}
            rows={rows}
            endText={endTexts(rows, FED_SIDES, locale)}
            percent={locale}
            midLabel={p.mid}
            hint={p.lineHint}
            ariaLabel={`${p.fedLineLabel}: ${FED_SIDES.map((side) => `${p.fedSides[side]} ${pct(sides[side], locale)}`).join(", ")}`}
          />
        )}

        {liquidity === "thin" && <span className={styles.thin}>{p.thin}</span>}
        {sameMeeting && (
          <Link href="/takvim" prefetch={false} className={`${styles.calLink} tap-44`}>
            {p.fedLinkCalendar}
            <ArrowRight size={13} weight="bold" aria-hidden />
          </Link>
        )}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- PATİKA */

export function PathPanel({
  snapshot,
  fomc,
  locale,
  t,
}: {
  snapshot: ProbabilitySnapshot;
  fomc: NextFomc | null;
  locale: Locale;
  t: Dictionary;
}) {
  const p = t.probabilities;
  const target = fomc?.target ?? null;
  const upcoming = snapshot.fed.filter((m) => m === nextMeeting(snapshot.fed) || (m.strikeAt ?? "") > (nextMeeting(snapshot.fed)?.strikeAt ?? ""));
  const steps = ratePath(upcoming, target);
  if (steps.length < 2) return null;
  const anyThin = steps.some((s) => s.liquidity === "thin");
  return (
    <Panel>
      <PanelHeader title={p.pathTitle} />
      <div className={styles.body}>
        <RatePath
          steps={steps}
          current={target ? (target.lower + target.upper) / 2 : null}
          locale={locale}
          dateOf={(iso) => (iso ? formatEtDateCompact(etOf(iso).date, locale) : "")}
          labels={{
            today: p.pathToday,
            expected: p.pathExpected,
            move: p.pathMove,
            cumulative: p.pathCumulative,
            thin: p.pathThin,
            bps: p.bps,
            aria: p.pathAria,
            sides: p.fedSides,
          }}
        />
        <p className={styles.note}>
          {p.pathNote}
          {!target && ` ${p.pathNoTarget}`}
          {anyThin && ` ${p.pathThinNote}`}
        </p>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- SEÇİM */

const PARTIES = ["dem", "rep"] as const;

function Chamber({
  event,
  kind,
  takenAt,
  locale,
  t,
}: {
  event: ProbEvent | undefined;
  kind: "house" | "senate";
  takenAt: string;
  locale: Locale;
  t: Dictionary;
}) {
  const p = t.probabilities;
  const name = p[kind];
  if (!event || liquidityOf(event) === "hidden") return null;
  const winner = resolvedOutcome(event);
  if (winner) {
    return (
      <section className={styles.chamber} aria-label={name}>
        <div className={styles.chamberHead}><h3>{name}</h3></div>
        <div className={styles.result}>
          <b>{p.resolvedWinner.replace("{party}", p.parties[winner as "dem" | "rep"] ?? winner)}</b>
          <span>{p.resolvedNote}</span>
        </div>
      </section>
    );
  }
  const probs = eventProbabilities(event);
  if (!probs) return null;
  const top = topOutcome(probs)!;
  const delta = change24h(event, top.key);
  const rows = lineRows(event, PARTIES.map((party) => ({ key: party, keys: [party] })), locale, takenAt);
  const segments = PARTIES.map((party) => ({ key: party, label: p.parties[party], p: probs[party] ?? 0 }));
  const shares = shareMap(segments);
  const list = segments.map((s) => `${s.label} ${shareText(shares[s.key], locale)}`).join(", ");
  return (
    <section className={styles.chamber} aria-label={name}>
      <div className={styles.chamberHead}>
        <h3>{name}</h3>
        {delta !== null && (
          <span className="text-tiny text-muted numeral">
            {p.change24h} {delta === 0 ? p.noChange : `${p.parties[top.key as "dem" | "rep"]} ${p.points.replace("{n}", signedPoints(delta, locale))}`}
          </span>
        )}
      </div>
      <div className={styles.chamberEnds}>
        {segments.map((s) => (
          <div key={s.key} className={styles.chamberEnd} data-tone={s.key} data-trail={s.key !== top.key || undefined}>
            <span><i aria-hidden />{s.label}</span>
            <b>{shareText(shares[s.key], locale)}</b>
          </div>
        ))}
      </div>
      <ProbabilityStack
        segments={segments}
        lead={top.key}
        locale={locale}
        midline={p.majority}
        legend={false}
        ariaLabel={p.chamberBarLabel.replace("{chamber}", name).replace("{list}", list)}
      />
      {rows.length >= 2 && (
        <ProbabilityLine
          series={PARTIES.map((party) => ({ key: party, label: p.parties[party], tone: party }))}
          rows={rows}
          endText={endTexts(rows, PARTIES, locale)}
          percent={locale}
          midLabel={p.mid}
          hint={p.lineHint}
          ariaLabel={`${p.chamberLineLabel.replace("{chamber}", name)}: ${list}`}
        />
      )}
      {liquidityOf(event) === "thin" && <span className={styles.thin}>{p.thin}</span>}
    </section>
  );
}

export function ElectionPanel({ snapshot, locale, t }: { snapshot: ProbabilitySnapshot; locale: Locale; t: Dictionary }) {
  const p = t.probabilities;
  const house = snapshot.congress.find((e) => e.kind === "house");
  const senate = snapshot.congress.find((e) => e.kind === "senate");
  const days = readerDayOffset(ELECTION_DAY_ET, null, locale);
  const started = pollsClosed();
  const clocks = clockPair(ELECTION_DAY_ET, FIRST_POLLS_CLOSE_ET, locale);
  const hasAny = [house, senate].some((e) => e && liquidityOf(e) !== "hidden");
  return (
    <Panel>
      <PanelHeader title={p.electionTitle} meta={p.electionMeta} />
      <div className={styles.body}>
        {!started ? (
          <div className={styles.countdown}>
            {days > 0 ? (
              <>
                <b>{days}</b>
                <span>{p.electionDaysLeft}</span>
              </>
            ) : (
              <span>{p.electionToday}</span>
            )}
            <small>{p.electionPolls.replace("{primary}", clocks.primary).replace("{secondary}", clocks.secondary)}</small>
          </div>
        ) : (
          <p className={styles.note}>{p.electionAfter}</p>
        )}
        {hasAny ? (
          <>
            <Chamber event={house} kind="house" takenAt={snapshot.takenAt} locale={locale} t={t} />
            <Chamber event={senate} kind="senate" takenAt={snapshot.takenAt} locale={locale} t={t} />
            <p className={styles.note}>{p.partyNote}</p>
          </>
        ) : (
          <p className={styles.note}>{p.panelEmpty}</p>
        )}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- DİĞER */

const MONTHS: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

/** "KXCPI-26OCT" → "Ekim" / "October" (TÜFE'nin ölçtüğü ay). */
function cpiMonth(eventTicker: string, locale: Locale): string | null {
  const match = /-(\d{2})([A-Z]{3})$/.exec(eventTicker);
  if (!match || MONTHS[match[2]] === undefined) return null;
  const date = new Date(Date.UTC(2000 + Number(match[1]), MONTHS[match[2]], 15));
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", timeZone: "UTC" }).format(date);
}

/** Merdivende gösterilen basamaklar: kesinliğe yakın uçlar okunacak bir şey söylemiyor. */
const LADDER_SHOW = { min: 0.03, max: 0.97 } as const;

export function OtherPanel({ snapshot, locale, t }: { snapshot: ProbabilitySnapshot; locale: Locale; t: Dictionary }) {
  const p = t.probabilities;
  const recession = snapshot.macro.find((e) => e.kind === "recession");
  const cpi = snapshot.macro.find((e) => e.kind === "cpi");
  const recessionShown = recession && liquidityOf(recession) !== "hidden" ? recession : null;
  const recessionProbs = recessionShown ? eventProbabilities(recessionShown) : null;
  const ladder = cpi ? cpiLadder(cpi) : [];
  const median = ladderMedian(ladder);
  const steps = ladder.filter((s) => s.above >= LADDER_SHOW.min && s.above <= LADDER_SHOW.max);
  if (!recessionProbs && steps.length < 2) return null;
  const month = cpi ? cpiMonth(cpi.eventTicker, locale) : null;
  const cpiAt = cpi?.strikeAt ? etOf(cpi.strikeAt).date : null;
  const recessionRows = recessionShown ? lineRows(recessionShown, [{ key: "yes", keys: ["yes"] }], locale, snapshot.takenAt) : [];
  const recessionDelta = recessionShown ? change24h(recessionShown, "yes") : null;
  const recessionSegments = recessionProbs
    ? [
        { key: "yes", label: p.yes, p: recessionProbs.yes },
        { key: "no", label: p.no, p: recessionProbs.no },
      ]
    : [];
  const recessionShares = shareMap(recessionSegments);

  return (
    <Panel>
      <PanelHeader title={p.otherTitle} />
      <div className={`${styles.body} ${styles.trio}`}>
        {recessionShown && recessionProbs && (
          <section className={styles.block} aria-label={p.recessionTitle}>
            <div className={styles.blockHead}>
              <h3>{p.recessionTitle}</h3>
              <p>{p.recessionNote}</p>
            </div>
            <div className={styles.hero}>
              <div className={styles.figure}>
                <span className={styles.figureValue}>
                  <b>{shareText(recessionShares.yes, locale)}</b>
                  <span>{p.yes}</span>
                </span>
              </div>
              <dl className={styles.facts}>
                <DeltaFact points={recessionDelta} p={p} locale={locale} />
              </dl>
            </div>
            <ProbabilityStack
              segments={recessionSegments}
              lead="yes"
              locale={locale}
              ariaLabel={`${p.recessionTitle}: ${p.yes} ${shareText(recessionShares.yes, locale)}`}
            />
            {recessionRows.length >= 2 && (
              <ProbabilityLine
                series={[{ key: "yes", label: p.yes, tone: "yes" }]}
                rows={recessionRows}
                endText={endTexts(recessionRows, ["yes"], locale)}
                percent={locale}
                midLabel={p.mid}
                hint={p.lineHint}
                ariaLabel={`${p.recessionLineLabel}: ${pct(recessionProbs.yes, locale)}`}
              />
            )}
            {liquidityOf(recessionShown) === "thin" && <span className={styles.thin}>{p.thin}</span>}
          </section>
        )}
        {cpi && steps.length >= 2 && (
          <section className={styles.block} aria-label={p.cpiTitle}>
            <div className={styles.blockHead}>
              <h3>{p.cpiTitle}</h3>
              {month && cpiAt && <p>{p.cpiMeta.replace("{month}", month).replace("{date}", dayMonth(cpiAt, locale))}</p>}
            </div>
            <ol className={styles.ladder} aria-label={p.cpiAria}>
              {steps.map((step) => (
                <li key={step.threshold}>
                  <span>{p.cpiAbove.replace("{n}", formatPrice(step.threshold, locale, { digits: 1 }))}</span>
                  <span className={styles.lane} aria-hidden>
                    <span data-motion-draw="line" style={{ width: `${step.above * 100}%` }} />
                    <i className={styles.ladderMid} />
                  </span>
                  <b>{pct(step.above, locale)}</b>
                </li>
              ))}
            </ol>
            <p className={styles.note}>
              {median !== null ? p.cpiMedian.replace("{value}", formatPercentPlain(median, locale, 2)) : p.cpiNoMedian} {p.cpiNote}
            </p>
          </section>
        )}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- KÜNYE */

export function NotesPanel({ t }: { t: Dictionary }) {
  const p = t.probabilities;
  return (
    <Panel>
      <PanelHeader title={p.notesTitle} />
      <div className={styles.notes}>
        <p>{p.noteHow}</p>
        <p>{p.noteSource}</p>
        <p>{p.noteNoBetting}</p>
        <p>{p.noteThin} {p.noteDaily}</p>
        <p>{p.disclaimer}</p>
      </div>
    </Panel>
  );
}
