import type { ReactNode } from "react";
import {
  BellSimpleRinging,
  CaretRight,
  ChartPieSlice,
  ListPlus,
  PencilSimpleLine,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { Reveal } from "@/components/motion/PremiumMotion";
import { DataStamp, LogoTile, PageHeader, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { formatIsoMonth } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { BellReport as BellReportData } from "@/lib/report-data";
import { todayEt } from "@/lib/market-hours";
import {
  memberMonths,
  planColumns,
  positionExtremes,
  reportMood,
  spyGap,
  type Extreme,
  type MemberMonth,
  type SessionWeek,
} from "@/lib/report-summary";
import { directionOf, directionText, formatPercent, MONEY_GAP } from "@/lib/utils";
import styles from "./BellReport.module.css";

/**
 * ZİL RAPORU — karne (25 Ekim; ilk sürüm 15 Ekim).
 *
 * Sayılar beyan değil kayıt (lib/report-data.ts); burası onları ekranın
 * düzenine (CLAUDE.md "Ekran düzeni") yerleştiriyor:
 *   1. Başlık — `PageHeader`, tek cümle, üst künye yok.
 *   2. Kapak şeridi — küçük zil + ad + üyelik cümlesi + durum cümlesi.
 *   4. Ölçü ızgarası — en önemli dört sayı aynı hatta.
 *   5–6. Konular panel panel; her panelin h2'si, künyesi panelin içinde.
 *
 * Neden karne: eski sürüm her konuyu ekran boyunda bir bölüme koyuyordu
 * ("kaydırmayla ilerleyen anlatı") ve okur 390'da 3993 piksel kaydırıp ilk
 * ekranda tek sayı görüyordu. Karnede ilk ekran kapak + dört ölçü, ikinci
 * ekranda iki-üç konu birden — gerekçe ve ölçü BellReport.module.css'te.
 *
 * PAYLAŞIM YOK (bilinçli). Rapor kişisel kayıt: alarm sayısı, takip
 * listesi, portföyün SPY'a göre farkı. Bir paylaşım bağlantısı ya da
 * kartı, okurun profilde AÇMADIĞI blokları dolaylı yoldan yayımlardı
 * (profil her bloğu ayrı anahtarla açar — /ayarlar). Başkalarına görünmesini
 * istediği kısım için yol zaten var: herkese açık profil. Ekran bunu
 * "Sıradaki" panelinin künyesinde söylüyor. Tutar yok kuralı da yerinde:
 * hiçbir sayı para değil.
 */

type Labels = Dictionary["bellReport"];

/** "{n} Gün" kalıbını sayı + birim olarak böler; birim sayıdan kopmaz. */
function FigureWithUnit({ template, value, roll }: { template: string; value: string; roll?: boolean }) {
  const [before, after = ""] = template.split("{n}");
  const unit = (text: string) =>
    text.trim() ? <span className={styles.figureUnit}>{text.trim()}</span> : null;
  return (
    <>
      {unit(before)}
      {before.trim() && MONEY_GAP}
      {roll ? <RollingFigure value={value} /> : value}
      {after.trim() && MONEY_GAP}
      {unit(after)}
    </>
  );
}

function Figure({
  label,
  value,
  visual,
  sub,
  direction,
}: {
  label: string;
  value: ReactNode;
  /** Sayının çizimi — her hücrede aynı yükseklikte kutu (`.figureVisual`),
      böylece alt künyeler de aynı hatta biter. */
  visual?: ReactNode;
  sub?: string;
  /** Yön: renk yalnız işaretten (artı yeşil, eksi kırmızı). */
  direction?: string;
}) {
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className="contents">
        {/* Modül sınıfı katmansız, utility'yi ezer: renk `data-dir` ile. */}
        <span className={`numeral ${styles.figureValue}`} data-dir={direction}>
          {value}
        </span>
        <span className={styles.figureVisual} aria-hidden>
          {visual}
        </span>
        {sub && <span className={styles.figureSub}>{sub}</span>}
      </dd>
    </div>
  );
}

/* ---- Sayıların çizimleri. Hepsi `aria-hidden`: sayı metinde zaten var,
   çizim onun kopyası (CompareScale ile aynı ilke). Dil sitenin: ince
   kulvar (`--line-soft`) üstünde dolgu, renk yalnız yönden. ---- */

/** Takip çiplerinin 1440'ta yarım kolona sığan sayısı (ölçüldü: yedi). */
const CHIPS_PER_ROW = 7;

/** Raporun tarihleri tek dilimde: okurun saati (CLAUDE.md "Saat: TR önce"). */
const REPORT_TZ = "Europe/Istanbul";

/** Üyelik ayları: ay başına bir kulvar, dolgu o ayda üye olunan pay. */
function MonthLanes({ months, locale }: { months: MemberMonth[]; locale: Locale }) {
  /* Ay adı İstanbul saatiyle, raporun öteki tarihleriyle aynı dilimde;
     öğlen damgası hiçbir dilimde ayı kaydırmaz. */
  const initial = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "short", timeZone: REPORT_TZ });
  return (
    <span className={styles.months}>
      {months.map(({ month, share }) => (
        <span key={month} className={styles.month}>
          <span className={styles.lane}>
            <span className={styles.laneFill} style={{ width: `${Math.round(share * 100)}%` }} data-motion-draw="line" />
          </span>
          {months.length <= 4 && (
            <span className={styles.monthName}>{initial.format(new Date(`${month}-15T12:00:00Z`))}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Seans şeridi: hafta başına sütun; kulvar üyelik içindeki hafta içi
    günler, dolgu açılıp kapanan seanslar (lib/report-summary.ts). */
const WEEK_DAYS = 5;
const WEEK_SLOT_PX = 14;
function WeekStrip({ weeks }: { weeks: SessionWeek[] }) {
  const slot = 6;
  const bar = 4;
  const height = 22;
  return (
    <svg
      className={styles.weeks}
      /* Az haftada sütunlar kutuya yayılıp tek bir uzun çubuk gibi
         okunmasın: hafta başına en çok `WEEK_SLOT_PX`. */
      style={{ maxWidth: `${Math.max(1, weeks.length) * WEEK_SLOT_PX}px` }}
      viewBox={`0 0 ${Math.max(1, weeks.length) * slot} ${height}`}
      preserveAspectRatio="none"
    >
      {weeks.map((week, index) => {
        const lane = (week.span / WEEK_DAYS) * height;
        const fill = (week.sessions / WEEK_DAYS) * height;
        return (
          <g key={index}>
            <rect x={index * slot} y={height - lane} width={bar} height={lane} className={styles.weekLane} />
            <rect x={index * slot} y={height - fill} width={bar} height={fill} className={styles.weekFill} />
          </g>
        );
      })}
    </svg>
  );
}

/** Oran noktaları: kurulan kadar nokta, çalan/yayında olan dolu. Tavan
    `DOTS_MAX`; fazlası oranı koruyarak ölçeklenir. */
const DOTS_MAX = 12;
function Dots({ filled, total }: { filled: number; total: number }) {
  const count = Math.min(total, DOTS_MAX);
  const on = total > DOTS_MAX ? Math.round((filled / total) * DOTS_MAX) : filled;
  return (
    <span className={styles.dots}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={index < on ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}

/** Portföy hücresi: senin getirin ve SPY iki ince çizgi, aynı ölçek. */
function MiniCompare({ rows }: { rows: { label: string; value: number | null }[] }) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value ?? 0)), 0.01);
  const signed = rows.some((row) => (row.value ?? 0) < 0);
  return (
    <span className={styles.mini}>
      {rows.map((row) => (
        <span key={row.label} className={styles.miniRow}>
          <span className={styles.miniLabel}>{row.label}</span>
          <ScaleBar
            ratio={row.value === null ? 0 : Math.max(-1, Math.min(1, row.value / maxAbs))}
            signed={signed}
            tone="signal"
            className="mt-0 ml-0 max-w-none"
          />
        </span>
      ))}
    </span>
  );
}

/** Takip hücresi: ilk dört logo üst üste. */
function LogoStack({ symbols }: { symbols: string[] }) {
  return (
    <span className={styles.stack}>
      {symbols.slice(0, 4).map((symbol) => (
        <LogoTile key={symbol} symbol={symbol} size="sm" className={styles.stackTile} />
      ))}
    </span>
  );
}

export function BellReport({
  report,
  locale,
  t,
}: {
  report: BellReportData;
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.bellReport;
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  const number = (n: number) => n.toLocaleString(tag);
  /* Dilim açık: sunucu UTC'de çalışıyor ve gece yarısına yakın bir kayıt
     İstanbul'daki gününden bir gün önce yazılıyordu. */
  const longDate = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: REPORT_TZ });
  const shortDate = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: REPORT_TZ });
  const showcase = report.showcase;
  const mood = reportMood({
    listSymbols: report.listSymbols,
    alertsTotal: report.alertsTotal,
    posts: report.posts,
    hasShowcase: showcase !== null,
  });
  const moodLine = mood === "heroRing" ? L.moodRing : mood === "heroWait" ? L.moodWait : L.moodSleep;

  /* ---- Ölçü ızgarası: üyelik ve seans her hesapta; kalan iki yuva veri
     olan konulardan, önem sırasıyla. Boş konu "0" diye yuva işgal etmez. */
  const figures: ReactNode[] = [
    <Figure
      key="member"
      label={L.memberLabel}
      value={<FigureWithUnit
          template={report.memberDays === 1 ? L.memberValueOne : L.memberValue}
          value={number(report.memberDays)}
          roll
        />}
      visual={<MonthLanes months={memberMonths(todayEt(report.joinedAt), todayEt())} locale={locale} />}
      sub={L.memberSub.replace("{date}", shortDate.format(report.joinedAt))}
    />,
    <Figure
      key="sessions"
      label={L.sessionsLabel}
      value={<RollingFigure value={number(report.tradingDays)} delayMs={120} />}
      visual={<WeekStrip weeks={report.weeks} />}
      sub={L.sessionsSub}
    />,
  ];
  const optional: ReactNode[] = [];
  if (showcase) {
    optional.push(
      <Figure
        key="return"
        label={L.returnLabel}
        value={formatPercent(showcase.returnPct, locale, 1)}
        direction={directionOf(showcase.returnPct)}
        visual={
          <MiniCompare
            rows={[
              { label: L.youShort, value: showcase.returnPct },
              ...(showcase.spyReturnPct !== null ? [{ label: "SPY", value: showcase.spyReturnPct }] : []),
            ]}
          />
        }
        sub={
          showcase.spyReturnPct !== null
            ? L.returnSubSpy.replace("{spy}", formatPercent(showcase.spyReturnPct, locale, 1))
            : L.returnSub
        }
      />,
    );
  }
  if (report.listSymbols > 0) {
    optional.push(
      <Figure
        key="watch"
        label={L.watchLabel}
        value={<FigureWithUnit
            template={report.listSymbols === 1 ? L.watchValueOne : L.watchValue}
            value={number(report.listSymbols)}
          />}
        visual={<LogoStack symbols={report.watchSymbols} />}
        sub={report.lists === 1 ? L.watchSubOne : L.watchSub.replace("{n}", number(report.lists))}
      />,
    );
  }
  if (report.alertsTotal > 0) {
    optional.push(
      <Figure
        key="alerts"
        label={L.alertsLabel}
        value={L.alertsValue.replace("{hit}", number(report.alertsHit)).replace("{total}", number(report.alertsTotal))}
        visual={<Dots filled={report.alertsHit} total={report.alertsTotal} />}
        sub={L.alertsSub}
      />,
    );
  }
  if (report.posts > 0) {
    optional.push(
      <Figure
        key="posts"
        label={L.postsLabel}
        value={number(report.posts)}
        visual={<Dots filled={report.posts} total={report.posts} />}
        sub={L.postsSub}
      />,
    );
  }
  figures.push(...optional.slice(0, 2));

  /* ---- Paneller: mantıksal sıra + tahmini boy (kolon planı için).
     Birim ≈ 62 piksel; 1440'ta ölçüldü (25 Ekim): portföy 375, dokuz
     çipli takip 205 (yedi çip bir satır), üç adımlı Sıradaki 340 piksel.
     `wide`: tam genişlikte de okunan panel (planColumns). ---- */
  const panels: { key: string; weight: number; wide?: boolean; render: (full: boolean) => ReactNode }[] = [];
  if (showcase) {
    panels.push({
      key: "p",
      weight: 6,
      render: () => <PortfolioPanel showcase={showcase} L={L} t={t} locale={locale} />,
    });
  }
  if (report.listSymbols > 0) {
    const chips = report.watchSymbols.length + (report.listSymbols > report.watchSymbols.length ? 1 : 0);
    panels.push({
      key: "w",
      weight: 1.9 + Math.ceil(chips / CHIPS_PER_ROW) * 0.75,
      wide: true,
      render: () => <WatchPanel report={report} L={L} number={number} />,
    });
  }
  if (report.alertsTotal > 0) {
    panels.push({ key: "a", weight: 2.4, render: () => <AlertsPanel report={report} L={L} number={number} /> });
  }
  if (report.posts > 0) {
    panels.push({
      key: "y",
      weight: 1.4 + report.recentPosts.length * 0.7,
      render: () => <PostsPanel report={report} L={L} number={number} date={longDate} />,
    });
  }
  const steps = nextSteps(report, L);
  const alone = panels.length === 0;
  panels.push({
    key: "n",
    weight: 2.3 + steps.length * 1.07,
    wide: true,
    render: (full) => <NextPanel L={L} steps={steps} wide={alone || full} />,
  });

  /* Telefonda tek akış: her panelin mantıksal sırası `order` olarak
     taşınıyor; kolon kutuları orada `display: contents`. Tam genişlikteki
     panel genişte kolonların altında (ızgarada iki sütunu kaplar). */
  const plan = planColumns(panels.map((panel, index) => ({ item: { panel, index }, weight: panel.weight, wide: panel.wide })));
  const place = ({ panel, index }: { panel: (typeof panels)[number]; index: number }, full: boolean) => (
    <div key={panel.key} style={{ order: index }} className={full ? styles.full : "min-w-0"}>
      <Reveal>{panel.render(full)}</Reveal>
    </div>
  );
  const left = plan.left.map((entry) => place(entry, false));
  const right = plan.right.map((entry) => place(entry, false));
  const full = plan.full.map((entry) => place(entry, true));

  return (
    <>
      <PageHeader title={L.title} subtitle={L.subtitle} />

      <section className={styles.cover} aria-label={report.username}>
        {/* Zilin yüzü hesabın durumu (lib/report-summary.ts → reportMood);
            sahne bir kez oynar, hareketi azaltana son kare. */}
        <InkCanvas scene={mood} className={styles.mascot} />
        <div className={styles.coverText}>
          <p className={styles.name}>{report.username}</p>
          <p className={styles.coverLine}>
            {L.memberLine
              .replace("{date}", longDate.format(report.joinedAt))
              .replace("{sessions}", number(report.tradingDays))}{" "}
            {moodLine}
          </p>
        </div>
      </section>

      <dl className={styles.figures} data-count={figures.length} aria-label={L.figuresLabel}>
        {figures}
      </dl>

      <div className={styles.panels} data-cols={right.length > 0 ? 2 : 1}>
        <div className={styles.column}>{left}</div>
        {right.length > 0 && <div className={styles.column}>{right}</div>}
        {full}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function PortfolioPanel({
  showcase,
  L,
  t,
  locale,
}: {
  showcase: NonNullable<BellReportData["showcase"]>;
  L: Labels;
  t: Dictionary;
  locale: Locale;
}) {
  const gap = spyGap(showcase.returnPct, showcase.spyReturnPct);
  const { top, bottom } = positionExtremes(showcase.moves);
  /* Ray iki getirinin BÜYÜĞÜNE göre: sıfır ortada, eksi sola (ScaleBar). */
  const maxAbs = Math.max(Math.abs(showcase.returnPct), Math.abs(showcase.spyReturnPct ?? 0), 0.01);
  const signed = showcase.returnPct < 0 || (showcase.spyReturnPct ?? 0) < 0;
  const month = formatIsoMonth(showcase.sinceDay.slice(0, 7), locale);
  const pair = (label: string, value: number | null) => (
    <div className={styles.pairCell}>
      <span className={styles.pairLabel}>{label}</span>
      <span className={`numeral ${styles.pairValue} ${directionText(directionOf(value))}`}>
        {formatPercent(value, locale, 1)}
      </span>
      <ScaleBar
        ratio={value === null ? 0 : Math.max(-1, Math.min(1, value / maxAbs))}
        signed={signed}
        tone="signal"
        className="ml-0 max-w-none"
      />
    </div>
  );
  const gapLine = gap
    ? (gap.side === "ahead" ? L.gapAhead : gap.side === "behind" ? L.gapBehind : L.gapLevel).replace(
        "{gap}",
        gap.points.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      )
    : L.noSpy;

  return (
    <Panel>
      <PanelHeader
        title={L.portfolioTitle}
        meta={(showcase.symbolCount === 1 ? L.portfolioMetaOne : L.portfolioMeta)
          .replace("{n}", String(showcase.symbolCount))
          .replace("{month}", month)}
        action={<PanelLink href="/portfoy">{L.toPortfolio}</PanelLink>}
      />
      <div className={styles.body}>
        <div className={styles.pair}>
          {pair(L.yoursLabel, showcase.returnPct)}
          {pair(L.spyLabel, showcase.spyReturnPct)}
        </div>
        <p className={styles.lead}>{gapLine}</p>

        {top && (
          <div>
            <h3 className={styles.subhead}>{L.extremesTitle}</h3>
            <div className={styles.extremes}>
              <ExtremeCell extreme={top} L={L} locale={locale} />
              {bottom && <ExtremeCell extreme={bottom} L={L} locale={locale} />}
            </div>
          </div>
        )}

        <div className={styles.note}>
          <p>
            {L.portfolioNote}
            {showcase.excludedCount > 0 && ` ${L.excluded.replace("{n}", String(showcase.excludedCount))}`}
            {showcase.spyReturnPct !== null &&
              showcase.spyCoverage < 0.995 &&
              ` ${L.spyPartial.replace("{pct}", String(Math.round(showcase.spyCoverage * 100)))}`}
          </p>
          <DataStamp source={showcase.source} at={showcase.asOf} stale={showcase.stale} locale={locale} labels={t.data} />
        </div>
      </div>
    </Panel>
  );
}

function ExtremeCell({ extreme, L, locale }: { extreme: Extreme; L: Labels; locale: Locale }) {
  return (
    <Link href={`/hisse/${extreme.symbol}`} className={styles.extreme}>
      <LogoTile symbol={extreme.symbol} size="sm" className={styles.extremeLogo} />
      <span className={styles.extremeLabel}>{L[extreme.kind]}</span>
      <span className={styles.extremeFigures}>
        <span className={styles.extremeSymbol}>{extreme.symbol}</span>
        <span className={`numeral ${directionText(directionOf(extreme.returnPct))}`}>
          {formatPercent(extreme.returnPct, locale, 1)}
        </span>
      </span>
    </Link>
  );
}

function WatchPanel({ report, L, number }: { report: BellReportData; L: Labels; number: (n: number) => string }) {
  const more = report.listSymbols - report.watchSymbols.length;
  return (
    <Panel>
      <PanelHeader
        title={L.watchTitle}
        meta={(report.lists === 1 ? L.watchMetaOneList : L.watchMeta)
          .replace("{n}", number(report.listSymbols))
          .replace("{lists}", number(report.lists))}
        action={<PanelLink href="/favoriler">{L.toWatchlists}</PanelLink>}
      />
      <div className={styles.body}>
        <ul className={styles.chips}>
          {report.watchSymbols.map((symbol) => (
            <li key={symbol}>
              <Link href={`/hisse/${symbol}`} className={styles.chip}>
                <LogoTile symbol={symbol} size="xs" />
                {symbol}
              </Link>
            </li>
          ))}
          {more > 0 && (
            <li>
              <Link href="/favoriler" className={`${styles.chip} ${styles.chipMore}`}>
                {L.watchMore.replace("{n}", number(more))}
              </Link>
            </li>
          )}
        </ul>
        <p className={styles.note}>{L.watchHint}</p>
      </div>
    </Panel>
  );
}

function AlertsPanel({ report, L, number }: { report: BellReportData; L: Labels; number: (n: number) => string }) {
  const { alertsHit: hit, alertsTotal: total } = report;
  const line =
    total === 1
      ? hit === 1
        ? L.alertsLineOneRang
        : L.alertsLineOneWaiting
      : hit === 0
        ? L.alertsLineNone
        : hit === total
          ? L.alertsLineAll
          : L.alertsLine.replace("{waiting}", number(total - hit));
  return (
    <Panel>
      <PanelHeader title={L.alertsTitle} action={<PanelLink href="/favoriler#alarmlar">{L.toAlerts}</PanelLink>} />
      <div className={styles.body}>
        {/* Oran bir büyüklük: kurulan kadar nokta, çalanlar dolu. */}
        <div className={styles.ratio}>
          <span className={`numeral ${styles.ratioValue}`}>
            {L.alertsValue.replace("{hit}", number(hit)).replace("{total}", number(total))}
          </span>
          <Dots filled={hit} total={total} />
        </div>
        <p className={styles.lead}>
          {line.replace("{total}", number(total)).replace("{hit}", number(hit))}
        </p>
        <p className={styles.note}>{L.alertsNote}</p>
      </div>
    </Panel>
  );
}

function PostsPanel({
  report,
  L,
  number,
  date,
}: {
  report: BellReportData;
  L: Labels;
  number: (n: number) => string;
  date: Intl.DateTimeFormat;
}) {
  return (
    <Panel>
      <PanelHeader
        title={L.postsTitle}
        meta={report.posts === 1 ? L.postsMetaOne : L.postsMeta.replace("{n}", number(report.posts))}
        action={<PanelLink href={`/u/${report.username}`}>{L.toPosts}</PanelLink>}
      />
      <div className={styles.body}>
        <ul className={styles.posts}>
          {report.recentPosts.map((post) => (
            <li key={post.slug}>
              <Link href={`/topluluk/${post.slug}`} className={styles.postLink}>
                <span className={styles.postTitle}>{post.title}</span>
                {post.publishedAt && (
                  <time dateTime={post.publishedAt.toISOString().slice(0, 10)} className={styles.postDate}>
                    {date.format(post.publishedAt)}
                  </time>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

type Step = { href: string; icon: Icon; title: string; hint: string };

/** Profil her hesapta; kalan adımlar yalnız EKSİK konular için. */
function nextSteps(report: BellReportData, L: Labels): Step[] {
  const steps: Step[] = [
    {
      href: `/u/${report.username}`,
      icon: UserCircle,
      title: L.toProfile,
      hint: report.profilePublic ? L.nextPublic : L.nextPrivate,
    },
  ];
  if (report.listSymbols === 0) steps.push({ href: "/favoriler", icon: ListPlus, title: L.stepWatch, hint: L.stepWatchHint });
  if (report.alertsTotal === 0)
    steps.push({ href: "/favoriler#alarmlar", icon: BellSimpleRinging, title: L.stepAlert, hint: L.stepAlertHint });
  if (!report.showcase) steps.push({ href: "/portfoy", icon: ChartPieSlice, title: L.stepPortfolio, hint: L.stepPortfolioHint });
  if (report.posts === 0) steps.push({ href: "/yazilarim/yeni", icon: PencilSimpleLine, title: L.stepWrite, hint: L.stepWriteHint });
  return steps;
}

function NextPanel({ L, steps, wide }: { L: Labels; steps: Step[]; wide: boolean }) {
  return (
    <Panel>
      <PanelHeader title={L.nextTitle} />
      <div className={styles.body}>
        <ul className={styles.steps} data-wide={wide || undefined}>
          {steps.map(({ href, icon: StepIcon, title, hint }) => (
            <li key={href}>
              <Link href={href} className={styles.step}>
                <StepIcon size={22} weight="duotone" aria-hidden className={styles.stepIcon} />
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{title}</span>
                  <span className={styles.stepHint}>{hint}</span>
                </span>
                <CaretRight size={14} aria-hidden className={styles.stepCaret} />
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          {L.sessionsNote} {L.privateNote}
        </p>
      </div>
    </Panel>
  );
}

