import { ArrowRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictTextClass } from "@/lib/analysis";
import { formatGuidanceRange } from "@/lib/earnings-report";
import {
  railPositions,
  rangePositions,
  reactionScale,
  storyCardTitle,
  surpriseText,
  type StoryCard,
  type StoryFigure,
} from "@/lib/earnings-story";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  cn,
  formatEtDateCompact,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";
import styles from "./Story.module.css";

/**
 * Hikâye kartının sayfadaki hâli — paylaşım görseli (`lib/earnings-story-og.tsx`)
 * aynı `StoryCard` verisinden çiziliyor; iki çizim aynı sayıları yazar.
 *
 * Kart bir KUTU DEĞİL, bir ton: `--premium-surface` zemin, iç parçalar
 * `--surface-sunken` ile ayrışıyor (CLAUDE.md "Derinlik tonla"). Gölge,
 * cam, ışıma ve degrade yok; skor halkası görüşün renginde düz çizgi
 * (sitenin `ScoreRing`i).
 */

type Ident = { symbol: string; periodLabel: string; logoUrl: string | null | undefined };

export function StoryCardView({
  card,
  index,
  total,
  ident,
  images,
  analysisPath,
  currency,
  locale,
  t,
}: {
  card: StoryCard;
  index: number;
  total: number;
  ident: Ident;
  /** Paylaşım görsellerinin adresleri (dil önekli) ve indirme adları. */
  images: { portrait: string; landscape: string; portraitName: string; landscapeName: string };
  /** Analiz sayfasının yolu (dil öneksiz) — özet kartının dibindeki bağlantı. */
  analysisPath: string;
  currency: string | true;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  const title = storyCardTitle(card, s);
  return (
    <article className={styles.card} data-kind={card.kind} aria-roledescription="slide" aria-label={`${title} · ${s.position.replace("{n}", String(index + 1)).replace("{total}", String(total))}`}>
      <header className={styles.cardHead}>
        <span className={styles.ident}>
          <LogoTile symbol={ident.symbol} logoUrl={ident.logoUrl} size="xs" />
          <span>{ident.symbol}</span>
          <span className={styles.identPeriod}>{ident.periodLabel}</span>
        </span>
        <span className={cn("figure", styles.position)}>
          {s.position.replace("{n}", String(index + 1)).replace("{total}", String(total))}
        </span>
      </header>
      <h2 className={styles.cardTitle}>{title}</h2>
      <div className={styles.cardBody}>
        {card.kind === "beklenti" && <ExpectBody card={card} currency={currency} locale={locale} t={t} />}
        {card.kind === "rehberlik" && <GuidanceBody card={card} locale={locale} t={t} />}
        {card.kind === "tepki" && <ReactionBody card={card} locale={locale} t={t} />}
        {card.kind === "ozet" && <SummaryBody card={card} analysisPath={analysisPath} t={t} />}
        {card.kind === "skor" && <ScoreBody card={card} t={t} />}
      </div>
      <footer className={styles.cardFoot}>
        <a href={images.portrait} download={images.portraitName} className={styles.download}>
          <DownloadSimple size={14} weight="bold" aria-hidden />
          {s.downloadPortrait}
        </a>
        <a href={images.landscape} download={images.landscapeName} className={styles.download}>
          <DownloadSimple size={14} weight="bold" aria-hidden />
          {s.downloadLandscape}
        </a>
      </footer>
    </article>
  );
}

function toneOf(direction: StoryFigure["surprise"]["direction"]): string | undefined {
  return direction === "beat" ? styles.up : direction === "miss" ? styles.down : undefined;
}

function ExpectBody({
  card,
  currency,
  locale,
  t,
}: {
  card: Extract<StoryCard, { kind: "beklenti" }>;
  currency: string | true;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  const rows = [
    card.eps && {
      key: "eps",
      label: s.expectEps,
      figure: card.eps,
      fmt: (value: number) => formatPrice(value, locale, { currency }),
    },
    card.revenue && {
      key: "revenue",
      label: s.expectRevenue,
      figure: card.revenue,
      fmt: (value: number) => formatMoneyCompact(value, locale, typeof currency === "string" ? currency : null),
    },
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  return (
    <>
      {rows.map((row) => {
        const pos = railPositions(row.figure.estimate, row.figure.actual);
        const from = Math.min(pos.estimate, pos.actual) * 100;
        const width = Math.abs(pos.actual - pos.estimate) * 100;
        return (
          <section key={row.key} className={styles.metric}>
            <p className={styles.metricLabel}>{row.label}</p>
            <dl className={styles.pair}>
              <div>
                <dt>{s.expectEstimate}</dt>
                <dd className="figure">{row.fmt(row.figure.estimate)}</dd>
              </div>
              <div>
                <dt>{s.expectActual}</dt>
                <dd className="figure">{row.fmt(row.figure.actual)}</dd>
              </div>
            </dl>
            {/* TEK ÇİZGİ — iki sayı aynı rayda (gerekçe `railPositions`). */}
            <span aria-hidden className={styles.rail}>
              <span
                className={cn(styles.band, toneOf(row.figure.surprise.direction))}
                style={{ left: `${from}%`, width: `${width}%` }}
              />
              <span className={styles.markGhost} style={{ left: `${pos.estimate * 100}%` }} />
              <span className={styles.markSolid} style={{ left: `${pos.actual * 100}%` }} />
            </span>
            <p className={cn(styles.surprise, toneOf(row.figure.surprise.direction))}>
              {surpriseText(row.figure, locale, t.earningsSeason)}
            </p>
          </section>
        );
      })}
      {card.recorded && (
        <section className={styles.metric}>
          <p className={styles.metricLabel}>{s.expectEps}</p>
          <p className={cn("figure", styles.big)}>{formatPrice(card.recorded.eps, locale, { currency })}</p>
          <p className={cn(styles.surprise, card.recorded.surprisePct >= 0 ? styles.up : styles.down)}>
            {s.expectSurprise.replace("{pct}", formatPercent(card.recorded.surprisePct, locale, 1))}
          </p>
          <p className={styles.note}>{s.expectRecorded}</p>
        </section>
      )}
    </>
  );
}

function GuidanceBody({
  card,
  locale,
  t,
}: {
  card: Extract<StoryCard, { kind: "rehberlik" }>;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  return (
    <>
      {card.rows.map((row) => {
        const pos = rangePositions(row.low, row.high, row.consensus);
        return (
          <section key={row.label} className={styles.metric}>
            <p className={styles.metricLabel}>{row.label}</p>
            <dl className={styles.pair}>
              <div>
                <dt>{s.guidanceRange}</dt>
                <dd className="figure">{formatGuidanceRange(row.low, row.high, row.unit ?? undefined, locale)}</dd>
              </div>
              {row.consensus !== null && (
                <div>
                  <dt>{s.guidanceConsensus}</dt>
                  <dd className="figure">
                    {formatGuidanceRange(row.consensus, row.consensus, row.unit ?? undefined, locale)}
                  </dd>
                </div>
              )}
            </dl>
            <span aria-hidden className={styles.rail}>
              <span
                className={cn(styles.band, styles.neutral)}
                style={{ left: `${pos.low * 100}%`, width: `${Math.max(1, (pos.high - pos.low) * 100)}%` }}
              />
              {pos.consensus !== null && (
                <span className={styles.markSolid} style={{ left: `${pos.consensus * 100}%` }} />
              )}
            </span>
            {row.evaluation && <p className={styles.note}>{row.evaluation}</p>}
          </section>
        );
      })}
    </>
  );
}

function ReactionBody({
  card,
  locale,
  t,
}: {
  card: Extract<StoryCard, { kind: "tepki" }>;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  const { movePct, average, timing, history } = card.reaction;
  const up = movePct >= 0;
  /* ÇUBUK YALNIZ KARŞILAŞTIRMA VARKEN. Önceki sürüm hareketin altına
     tek başına bir çubuk basıyordu ve ortalama yokken çubuk her zaman tam
     uzunluktu (%100) — hiçbir şeyle karşılaştırılmayan bir uzunluk
     (CLAUDE.md: "karşılaştırılamayan ölçüde çubuk HİÇ basılmaz").
     Karşılaştırma artık önceki raporların tek tek tepkileri: hepsi aynı
     işaretli ölçekte (`reactionScale`, sıfır ortada, büyük olan yarım
     ray), bu rapor en üstte. Ortalama varsa her kulvarda ±ortalama
     kesik çentikle (CompareScale'in işaretli rayı + bir ölçek çizgisi). */
  const rows = history.length > 0 ? [{ date: null, movePct }, ...history] : [];
  const scale = reactionScale(movePct, history, average?.avg ?? null);
  return (
    <>
      <section className={styles.metric}>
        <p className={styles.metricLabel}>{s.reactionMove}</p>
        <p className={cn("figure", styles.big, up ? styles.up : styles.down)}>{formatPercent(movePct, locale, 1)}</p>
        <p className={styles.note}>{timing === "bmo" ? s.reactionBmo : s.reactionAmc}</p>
      </section>
      {average && (
        <section className={styles.metric}>
          <p className={styles.metricLabel}>{s.reactionAverage}</p>
          <p className={cn("figure", styles.mid)}>±{formatPercentPlain(average.avg, locale, 1)}</p>
          <p className={styles.note}>
            {s.reactionAverageNote.replace("{count}", String(average.count))} ·{" "}
            {Math.abs(movePct) > average.avg ? s.reactionWider : s.reactionNarrower}
          </p>
        </section>
      )}
      {rows.length > 0 && (
        <section className={styles.metric}>
          <p className={styles.metricLabel}>{s.reactionHistory}</p>
          <ul className={styles.moves}>
            {rows.map((row) => {
              const ratio = row.movePct / scale.peak;
              const own = row.date === null;
              return (
                <li key={row.date ?? "own"} className={styles.move} data-own={own || undefined}>
                  <span className={styles.moveDate}>
                    {row.date === null ? s.reactionThis : formatEtDateCompact(row.date, locale)}
                  </span>
                  <span aria-hidden className={styles.moveLane} data-motion-track>
                    {scale.guide !== null && (
                      <>
                        <span className={styles.guide} style={{ left: `${50 - scale.guide * 50}%` }} />
                        <span className={styles.guide} style={{ left: `${50 + scale.guide * 50}%` }} />
                      </>
                    )}
                    <span
                      className={cn(styles.moveBar, row.movePct >= 0 ? styles.barUp : styles.barDown)}
                      data-motion-draw="line"
                      style={
                        row.movePct >= 0
                          ? { left: "50%", width: `${ratio * 50}%`, transformOrigin: "left center" }
                          : { right: "50%", width: `${-ratio * 50}%`, transformOrigin: "right center" }
                      }
                    />
                    <span className={styles.zero} />
                  </span>
                  <span className={cn("figure", styles.moveValue, row.movePct >= 0 ? styles.up : styles.down)}>
                    {formatPercent(row.movePct, locale, 1)}
                  </span>
                </li>
              );
            })}
          </ul>
          {scale.guide !== null && <p className={styles.note}>{s.reactionGuide}</p>}
        </section>
      )}
    </>
  );
}

/**
 * Özet kartı — cümle BAŞLIĞIN ALTINA yaslı, kaynağı ve analizin tamamına
 * giden bağlantı kartın dibinde. Önceki sürüm cümleyi dikeyde ortalıyordu
 * (`margin:auto`): kart destenin en uzun kardeşine gerildiğinde başlıkla
 * cümle arasında ~200 piksel boşluk açılıyordu (1280, ölçüldü). Boşluk
 * esnetilmez; künye dibe iner, metin yerinde durur.
 */
function SummaryBody({
  card,
  analysisPath,
  t,
}: {
  card: Extract<StoryCard, { kind: "ozet" }>;
  analysisPath: string;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  return (
    <>
      <p className={styles.quote}>{card.text}</p>
      {card.more.length > 0 && (
        <ul className={styles.more}>
          {card.more.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className={styles.bottom}>
        <p className={styles.note}>{card.source === "headline" ? s.summarySourceHeadline : s.summarySourceTakeaway}</p>
        <Link href={analysisPath} className={styles.inline}>
          {s.readAnalysis}
          <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </div>
    </>
  );
}

function ScoreBody({ card, t }: { card: Extract<StoryCard, { kind: "skor" }>; t: Dictionary }) {
  const verdict = verdictOf(card.verdict);
  return (
    <div className={styles.score}>
      <ScoreRing score={card.score} verdict={verdict} size={120} />
      <p className={styles.verdict}>
        <span className={styles.metricLabel}>{t.earningsSeason.story.verdict}</span>
        <span className={cn(styles.verdictValue, verdictTextClass(verdict))}>{verdictLabel(verdict, t)}</span>
      </p>
      {/* Manşet burada YOK: özet kartı manşete düşebiliyor (ekler yoksa)
          ve aynı cümle iki kartta tekrar ederdi. Künye kartın dibinde. */}
      <p className={cn(styles.note, styles.bottom)}>{t.earningsSeason.story.footer}</p>
    </div>
  );
}
