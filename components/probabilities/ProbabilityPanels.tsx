import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight, Bank, CaretDown, Palette, Prohibit } from "@phosphor-icons/react/dist/ssr";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import type { NextFomc } from "@/lib/macro-data";
import { etDateTimeToUtc } from "@/lib/market-hours";
import {
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
  type FedSide,
  type ProbabilitySnapshot,
  type ProbEvent,
} from "@/lib/probabilities";
import { readerDayOffset, TR_ZONE, formatInZone, zoneDateKey } from "@/lib/session-clock";
import { formatEtDateCompact, formatPercentPlain, formatPrice, relativeDayLabel } from "@/lib/utils";
import { ProbabilityLine, type LineRow, type LineSeries } from "./ProbabilityLine";
import { ProbabilityStack, RatePath, RecessionHistory, etOf, pct, shareMap, shareText } from "./ProbabilityParts";
import styles from "./Probabilities.module.css";

/**
 * Olasılıklar sayfasının panelleri (25 Ekim). Her panel kendi `h2`siyle;
 * sıra CLAUDE.md "Ekran düzeni": başlık → ana görsel (çubuk) → çizgi →
 * künye. Sayılar `lib/probabilities.ts`ten; burada yalnız biçim.
 *
 * GÖRSEL TUR (25 Ekim): büyük sayı kartlardan tepe şeridine çıktı
 * (`OddsStrip`); kartlar artık ölçü ızgarasının üç sütunu (Fed, ara seçim,
 * resesyon) ve her biri çubuk + 30 günlük çizgi + tek satır künye. Aynı
 * sayı iki yerde: şeritteki ile kartın ölçeğindeki aynı `percentShares`.
 */

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

/* Kartların çizgi yükseklikleri (piksel). Kartlar ilk ekrana sığsın diye
   112'den indi; Fed ve resesyon tek ana çizgi (kartın kalanını doldurur),
   meclisler iki küçük çizgi. Meclis çizgisi 44'ün altına inmez: kutunun
   tamamı dokunma hedefi. Ölçüm (TR, açık): üç kartın dibi 1280×800'de
   759, 1440×900'de 766; görünür alan 763 / 863'te bitiyor. 25 Ekim:
   1280'de 777'ye çıkmıştı, boşluklar sıkılaştı → 725 (Probabilities.module.css
   sonu). İkinci tur (25 Ekim): resesyon çizgisi 64; kartın kalanını artık
   1980'den bu yana resesyonların zaman şeridi dolduruyor (sahibinin notu:
   "tek düz çizgi + büyük boş alan"). */
const LINE_H = { main: 76, chamber: 44, recession: 64 } as const;

/** Kartların ızgara içindeki çapası (tepe şeridindeki kadranlar buraya iner). */
export const CARD_ANCHORS = { fed: "fed-karari", election: "ara-secim", recession: "resesyon" } as const;

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
      <Panel id={CARD_ANCHORS.fed} className={styles.card}>
        <PanelHeader title={p.fedTitle} />
        <p className={`${styles.note} px-4 pb-5 sm:px-5`}>{p.panelEmpty}</p>
      </Panel>
    );
  }
  const top = topOutcome(probs)!;
  const at = meeting.strikeAt ? etOf(meeting.strikeAt) : null;
  const clocks = at ? clockPair(at.date, at.time, locale) : null;
  const days = at ? readerDayOffset(at.date, at.time, locale) : null;
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
  /* Çip kısa adla (−25), imleçte ve çubuğun aria'sında tam adla. */
  const segments = FED_MOVES.map((move) => ({ key: move, label: p.fedChip[move], title: p.fedOutcomes[move], p: probs[move] ?? 0 }));
  const shares = shareMap(segments);
  const fullList = FED_MOVES.map((move) => `${p.fedOutcomes[move]} ${shareText(shares[move], locale, probs[move] ?? 0)}`).join(", ");

  return (
    <Panel id={CARD_ANCHORS.fed} className={styles.card}>
      <PanelHeader
        title={p.fedTitle}
        meta={at && clocks ? p.fedMeta.replace("{date}", dayMonth(at.date, locale)).replace("{time}", clocks.primary) : undefined}
      />
      <div className={styles.body}>
        <ProbabilityStack
          segments={segments}
          lead={top.key}
          locale={locale}
          legend="scale"
          ariaLabel={p.fedBarLabel.replace("{list}", fullList)}
        />

        {rows.length >= 2 && (
          <ProbabilityLine
            series={series}
            rows={rows}
            endText={endTexts(rows, FED_SIDES, locale)}
            percent={locale}
            midLabel={p.mid}
            hint={p.lineHint}
            height={LINE_H.main}
            grow
            ariaLabel={`${p.fedLineLabel}: ${FED_SIDES.map((side) => `${p.fedSides[side]} ${pct(sides[side], locale)}`).join(", ")}`}
          />
        )}

        <div className={styles.cardFoot}>
          <dl className={styles.facts}>
            {target && (
              <div>
                <dt>{p.fedTarget}</dt>
                <dd className="numeral">{`${formatPercentPlain(target.lower, locale, 2)} - ${formatPercentPlain(target.upper, locale, 2)}`}</dd>
              </div>
            )}
            {days !== null && days >= 0 && (
              <div>
                <dt>{p.fedCountdown}</dt>
                <dd className="numeral">{relativeDayLabel(days, t.calendar)}</dd>
              </div>
            )}
          </dl>
          {liquidity === "thin" && <span className={styles.thin}>{p.thin}</span>}
          {sameMeeting && (
            <Link href="/takvim" prefetch={false} className={`${styles.calLink} tap-44`}>
              {p.fedLinkCalendar}
              <ArrowRight size={13} weight="bold" aria-hidden />
            </Link>
          )}
        </div>
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
  /* Bandın künyesi başlığın sağında (bant çizimde, adı ve sayısı burada). */
  const range = target ? (
    <span className={styles.pathKey}>
      <i aria-hidden />
      {p.pathRange} <b className="numeral">{`${formatPercentPlain(target.lower, locale, 2)} - ${formatPercentPlain(target.upper, locale, 2)}`}</b>
    </span>
  ) : undefined;
  const foldId = "olasilik-patika";
  return (
    <Panel>
      <input type="checkbox" id={foldId} className={`sr-only ${styles.foldInput}`} />
      <PanelHeader
        title={p.pathTitle}
        meta={range}
        action={<FoldLabel id={foldId} more={p.pathHow} less={p.pathHow} />}
      />
      <div className={styles.body}>
        <RatePath
          steps={steps}
          current={target}
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
            step: p.pathStepAria,
            sides: p.fedSides,
          }}
        />
        <div className={styles.foldBody}>
          <p className={styles.note}>
            {p.pathNote}
            {!target && ` ${p.pathNoTarget}`}
            {anyThin && ` ${p.pathThinNote}`}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Başlıktaki katlama düğmesi (ikinci tur). Gizli onay kutusu panelin ilk
 * çocuğu, içerik (`foldBody`) ondan sonra; düğme bir `label`, JS'siz
 * çalışıyor (`FoldToggle` kalıbı) ve `ExpandInPlace`in denetimleri arasında.
 */
function FoldLabel({ id, more, less }: { id: string; more: string; less: string }) {
  return (
    <label htmlFor={id} className={`${styles.foldToggle} tap-44`}>
      <span className={styles.foldMore}>{more}</span>
      <span className={styles.foldLess}>{less}</span>
      <CaretDown size={12} weight="bold" aria-hidden />
    </label>
  );
}

/* ----------------------------------------------------------------- SEÇİM */

const PARTIES = ["dem", "rep"] as const;

/**
 * Bir meclis tek satır: adı ve iki partinin payı aynı hatta, altında
 * çoğunluk çentikli iki uçlu çubuk, altında 30 günün küçük çizgisi.
 * Eskiden parti adları ve 34 piksellik sayılar çubuğun üstünde ayrı bir
 * blok tutuyordu ve iki meclis kartı 1300 piksele uzatıyordu.
 */
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
  const rows = lineRows(event, PARTIES.map((party) => ({ key: party, keys: [party] })), locale, takenAt);
  const segments = PARTIES.map((party) => ({ key: party, label: p.parties[party], p: probs[party] ?? 0 }));
  const shares = shareMap(segments);
  const list = segments.map((s) => `${s.label} ${shareText(shares[s.key], locale)}`).join(", ");
  return (
    <section className={styles.chamber} aria-label={name}>
      <div className={styles.chamberHead}>
        <h3>{name}</h3>
        <span className={styles.chamberShares} aria-hidden>
          {segments.map((s) => (
            <span key={s.key} data-tone={s.key} data-trail={s.key !== top.key || undefined}>
              <i />
              <b className="numeral">{shareText(shares[s.key], locale)}</b>
            </span>
          ))}
        </span>
      </div>
      <ProbabilityStack
        segments={segments}
        lead={top.key}
        locale={locale}
        midline={p.majority}
        midlineLabel={false}
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
          height={LINE_H.chamber}
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
  /* "9 Gün Kaldı" kutusu künyeye indi (başlığın sağında). Sandık saati
     seçimden bir gün önce karta çıkar; o güne kadar künyeler panelinde
     (kart ilk ekrana sığsın: 1280×800'de bu satır 30 piksel aşıyordu). */
  const pollsSoon = started || days <= 1;
  const meta = started ? p.electionMeta : days > 0 ? p.electionMetaDays.replace("{n}", String(days)) : p.electionMetaToday;
  return (
    <Panel id={CARD_ANCHORS.election} className={styles.card}>
      <PanelHeader title={p.electionTitle} meta={meta} />
      <div className={styles.body}>
        {hasAny ? (
          <>
            <ul className={styles.legend} aria-hidden>
              {PARTIES.map((party) => (
                <li key={party} data-tone={party}>
                  <i />
                  {p.parties[party]}
                </li>
              ))}
              {/* Çubuktaki çentiğin adı: her çubuğun üstüne ayrı ayrı yazılmıyor. */}
              <li className={styles.legendMajority}>
                <i />
                {p.majority}
              </li>
            </ul>
            <Chamber event={house} kind="house" takenAt={snapshot.takenAt} locale={locale} t={t} />
            <Chamber event={senate} kind="senate" takenAt={snapshot.takenAt} locale={locale} t={t} />
          </>
        ) : (
          <p className={styles.note}>{p.panelEmpty}</p>
        )}
        {pollsSoon && (
          <p className={`${styles.note} ${styles.cardFoot}`}>
            {started ? p.electionAfter : p.electionPolls.replace("{primary}", clocks.primary).replace("{secondary}", clocks.secondary)}
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ RESESYON */

export function RecessionPanel({ snapshot, locale, t }: { snapshot: ProbabilitySnapshot; locale: Locale; t: Dictionary }) {
  const p = t.probabilities;
  const recession = snapshot.macro.find((e) => e.kind === "recession");
  const shown = recession && liquidityOf(recession) !== "hidden" ? recession : null;
  const probs = shown ? eventProbabilities(shown) : null;
  if (!shown || !probs) return null;
  const rows = lineRows(shown, [{ key: "yes", keys: ["yes"] }], locale, snapshot.takenAt);
  const segments = [
    { key: "yes", label: p.yes, p: probs.yes },
    { key: "no", label: p.no, p: probs.no },
  ];
  const shares = shareMap(segments);
  return (
    <Panel id={CARD_ANCHORS.recession} className={styles.card}>
      <PanelHeader title={p.recessionTitle} />
      <div className={styles.body}>
        {/* İkinci tur: kartın tepesindeki Evet/Hayır çubuğu kalktı; aynı
            bölünmeyi şeritteki kadran zaten çiziyor (aynı `percentShares`),
            kartta yer çizgiye ve 1980'den bu yana resesyonların şeridine
            kaldı. Pay, şeridin 2027 künyesinde ve çizginin ucunda. */}
        {rows.length >= 2 && (
          <ProbabilityLine
            series={[{ key: "yes", label: p.yes, tone: "yes" }]}
            rows={rows}
            endText={endTexts(rows, ["yes"], locale)}
            percent={locale}
            midLabel={p.mid}
            hint={p.lineHint}
            height={LINE_H.recession}
            grow
            ariaLabel={`${p.recessionLineLabel}: ${pct(probs.yes, locale)}`}
          />
        )}
        <RecessionHistory
          share={shareText(shares.yes, locale)}
          nowMonth={etOf(snapshot.takenAt).date.slice(0, 7)}
          locale={locale}
          labels={{
            title: p.recessionHistoryTitle,
            summary: p.recessionHistorySummary,
            span: p.recessionSpan,
            aria: p.recessionHistoryAria,
            next: p.recessionNext,
          }}
        />
        <div className={styles.cardFoot}>
          {liquidityOf(shown) === "thin" && <span className={styles.thin}>{p.thin}</span>}
          <p className={styles.note}>{p.recessionNote} {p.recessionHistorySource}.</p>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- TÜFE */

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

export function CpiPanel({ snapshot, locale, t }: { snapshot: ProbabilitySnapshot; locale: Locale; t: Dictionary }) {
  const p = t.probabilities;
  const cpi = snapshot.macro.find((e) => e.kind === "cpi");
  const ladder = cpi ? cpiLadder(cpi) : [];
  const median = ladderMedian(ladder);
  const steps = ladder.filter((s) => s.above >= LADDER_SHOW.min && s.above <= LADDER_SHOW.max);
  if (!cpi || steps.length < 2) return null;
  const month = cpiMonth(cpi.eventTicker, locale);
  const cpiAt = cpi.strikeAt ? etOf(cpi.strikeAt).date : null;
  return (
    <Panel>
      <PanelHeader
        title={p.cpiTitle}
        meta={month && cpiAt ? p.cpiMeta.replace("{month}", month).replace("{date}", dayMonth(cpiAt, locale)) : undefined}
      />
      <div className={styles.body}>
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
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- KÜNYE */

/** Renk kartının çipleri: Fed'in üç yanı ve iki parti, sayfadaki tonlarla. */
const COLOR_KEYS = [...FED_SIDES, ...PARTIES] as const;

/**
 * "Bu Sayılar Nedir" (ikinci tur, 25 Ekim). Sahibinin notu: "Alan çok
 * büyük; burayı böyle ele almayalım, daha güzel bir şeye çevirelim." Altı
 * uzun paragraf (427 piksel) dört küçük karta indi: fiyatın olasılığa
 * dönüşü (küçük çizimle), kaynak, bahis değil, renkler. Her kartta başlık
 * ve bir-iki satır; paragrafların tamamı "Ayrıntılar" katlamasında, hiçbiri
 * silinmedi (kaynak ve bahis kuralının tam metni orada).
 *
 * Katlama JS'siz: gizli onay kutusu panelin başında, düğmesi (etiket)
 * başlığın sağında, içerik kartların altında (`FoldToggle` kalıbı; etiket
 * `ExpandInPlace`in denetimleri arasında, açılınca sayfa sıçramaz).
 */
export function NotesPanel({ t, locale }: { t: Dictionary; locale: Locale }) {
  const p = t.probabilities;
  const clocks = clockPair(ELECTION_DAY_ET, FIRST_POLLS_CLOSE_ET, locale);
  const foldId = "olasilik-kunye";
  const colorName = (key: (typeof COLOR_KEYS)[number]) => (key === "dem" || key === "rep" ? p.stripParty[key] : p.fedSides[key]);
  return (
    <Panel className={styles.notesPanel}>
      <input type="checkbox" id={foldId} className={`sr-only ${styles.foldInput}`} />
      <PanelHeader
        title={p.notesTitle}
        action={
          <span className={styles.headActions}>
            <span className={`${styles.note} ${styles.disclaimer}`}>{p.disclaimer}</span>
            <FoldLabel id={foldId} more={p.notesMore} less={p.notesLess} />
          </span>
        }
      />
      <ul className={styles.explain}>
        <li>
          <div className={styles.priceViz} role="img" aria-label={p.notePriceAria}>
            <b className="numeral">{p.notePriceFrom}</b>
            <ArrowRight size={12} weight="bold" aria-hidden />
            <span className={styles.priceLane} aria-hidden>
              <span />
            </span>
            <b className="numeral">{p.notePriceTo}</b>
          </div>
          <h3>{p.notePriceTitle}</h3>
          <p>{p.notePriceBody}</p>
        </li>
        <li>
          <span className={styles.explainIcon} aria-hidden><Bank size={16} weight="bold" /></span>
          <h3>{p.noteSourceTitle}</h3>
          <p>{p.noteSourceBody}</p>
        </li>
        <li>
          <span className={styles.explainIcon} aria-hidden><Prohibit size={16} weight="bold" /></span>
          <h3>{p.noteBetTitle}</h3>
          <p>{p.noteBetBody}</p>
        </li>
        <li>
          <span className={styles.explainIcon} aria-hidden><Palette size={16} weight="bold" /></span>
          <h3>{p.noteColorTitle}</h3>
          <p>{p.noteColorBody}</p>
          <ul className={styles.colorChips} aria-hidden>
            {COLOR_KEYS.map((key) => (
              <li key={key} data-tone={key}>
                <i />
                {colorName(key)}
              </li>
            ))}
          </ul>
        </li>
      </ul>
      <div className={styles.foldBody}>
        <p>{p.noteHow}</p>
        <p>{p.noteSource}</p>
        <p>{p.noteNoBetting}</p>
        <p>{p.noteThin} {p.noteDaily}</p>
        <p>{p.partyNote}</p>
        {!pollsClosed() && <p>{p.electionPolls.replace("{primary}", clocks.primary).replace("{secondary}", clocks.secondary)}</p>}
      </div>
    </Panel>
  );
}
