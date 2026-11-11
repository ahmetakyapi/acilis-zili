import { CaretDown, Info } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  FEAR_MA_DAYS,
  MIN_COMPONENTS,
  MOMENTUM_MA_DAYS,
  SAFE_HAVEN_DAYS,
  SENTIMENT_BANDS,
  sentimentBand,
  type SentimentKey,
  type SentimentReading,
} from "@/lib/sentiment";
import { getSentiment } from "@/lib/sentiment-data";
import {
  cn,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import styles from "./MarketBoards.module.css";
import compact from "./SentimentCompact.module.css";

/**
 * Piyasa Nabzı — bileşik duyarlılık kadranı.
 *
 * Kuralların tamamı `lib/sentiment.ts`te; burası yalnızca çiziyor. İki
 * biçim var: `full` /piyasalar'da kadran + her bileşenin ham değeri ve
 * tarihi + yöntem; `compact` ana sayfaya konabilecek kadar küçük bir özet
 * (kadran, bant adı, bileşen puanları) ve ayrıntıya bağlantı.
 *
 * "Faiz ve Oynaklık" şeridiyle (components/macro/MarketPulse.tsx) AYRI:
 * o şerit ölçülerin kendisini yazıyor (vade faizleri, VIX seviyesi), bu
 * panel onları bir yargıya çeviriyor. VIX tanımı ikisinde de aynı
 * sözleşmeden (`VIX_SERIES`, lib/vix.ts) okunuyor.
 */

/* KADRAN İNCELDİ (10 Kasım 2026). Yay 14 birim kalınlığında dolu bir
   banttı ve işaretçi onu saran 20 birimlik içi boş bir halkaydı: sitenin
   "ince grafik" dilinde (kulvar üstünde 5 piksellik şerit) ekranın en ağır
   çizimi buydu, halka da okumayı değil kendini gösteriyordu. Şimdi yay 6
   birim (260 piksellik kadranda ~8 piksel), uçları yuvarlak; puanın
   düştüğü bant tam tonda, ötekiler yarı tonda — "neredeyiz" yayın
   kendisinden okunuyor. İşaretçi yayın üstünde dolu küçük bir nokta,
   çevresinde yüzey renginde kesik (halka değil); iki uçta 0 ve 100. */
const GAUGE = { cx: 100, cy: 100, r: 84, stroke: 6 } as const;
/** Bant yayları arasındaki boşluk, puan cinsinden (yuvarlak uçlar dahil). */
const GAUGE_GAP = 3.4;
const SCORE_MAX = 100;

function point(score: number, radius: number = GAUGE.r) {
  const angle = Math.PI * (1 - score / SCORE_MAX);
  return {
    x: GAUGE.cx + radius * Math.cos(angle),
    y: GAUGE.cy - radius * Math.sin(angle),
  };
}

function arc(from: number, to: number) {
  const start = point(from);
  const end = point(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/* Bant renkleri TOKEN'dan: korku `--down`, iştah `--up`, ortası nötr.
   Yoğunluk karışımla — ayrı bir renk ailesi tanımlamadan. */
const BAND_STROKE: Record<(typeof SENTIMENT_BANDS)[number]["key"], string> = {
  extremeFear: "var(--down)",
  fear: "color-mix(in srgb, var(--down) 45%, var(--line-soft))",
  neutral: "var(--line-strong)",
  greed: "color-mix(in srgb, var(--up) 45%, var(--line-soft))",
  extremeGreed: "var(--up)",
};

/** Bant yaylarının uçları — her bant bir öncekinin bittiği yerden başlar. */
const BAND_ARCS = SENTIMENT_BANDS.map((band, index) => {
  const from = index === 0 ? 0 : SENTIMENT_BANDS[index - 1].max;
  const to = Math.min(SCORE_MAX, band.max);
  return {
    key: band.key,
    path: arc(from + (from === 0 ? 0 : GAUGE_GAP / 2), to - (to === SCORE_MAX ? 0 : GAUGE_GAP / 2)),
  };
});

function Gauge({ score, label, size }: { score: number | null; label: string; size: "full" | "compact" }) {
  const marker = score !== null ? point(score) : null;
  const active = score !== null ? sentimentBand(score).key : null;
  return (
    <svg
      viewBox="0 0 200 112"
      className={cn(styles.gauge, size === "compact" && styles.gaugeCompact)}
      role="img"
      aria-label={label}
    >
      {BAND_ARCS.map((band) => (
        <path
          key={band.key}
          d={band.path}
          fill="none"
          strokeWidth={GAUGE.stroke}
          strokeLinecap="round"
          opacity={active === null || active === band.key ? 1 : 0.42}
          /* Kadran görünüme girince bantlar uçtan uca çiziliyor
             (MotionExperience `arc`); JS yoksa tam çizili. */
          pathLength={1}
          data-motion-draw="arc"
          style={{ stroke: BAND_STROKE[band.key], strokeDasharray: 1 }}
        />
      ))}
      {marker && (
        /* İşaretçi `spark-dot` ile OTURUYOR (14 Ekim): bantlar 1 sn kendini
           çizerken okumanın kendisi (nokta) kare 0'dan tam opak duruyordu —
           fon animasyonlu, kahraman donuk. Sparkline'ın son noktasıyla aynı
           dil; transform-box/origin ve reduced-motion muafiyeti sınıftan. */
        <circle
          cx={marker.x}
          cy={marker.y}
          r={GAUGE.stroke / 2 + 2.5}
          className={cn("spark-dot", styles.gaugeMarker)}
        />
      )}
      {size === "full" && (
        <>
          <text x={GAUGE.cx - GAUGE.r} y={111} textAnchor="middle" className={styles.gaugeEnd}>0</text>
          <text x={GAUGE.cx + GAUGE.r} y={111} textAnchor="middle" className={styles.gaugeEnd}>{SCORE_MAX}</text>
        </>
      )}
    </svg>
  );
}

function bandLabel(score: number, t: Dictionary) {
  const x = t.marketExtras;
  const labels: Record<(typeof SENTIMENT_BANDS)[number]["key"], string> = {
    extremeFear: x.bandExtremeFear,
    fear: x.bandFear,
    neutral: x.bandNeutral,
    greed: x.bandGreed,
    extremeGreed: x.bandExtremeGreed,
  };
  return labels[sentimentBand(score).key];
}

/** Bandın bir cümlelik anlamı. "Korku" tek başına bir şey söylemiyordu
    (28 Eylül, sahibinin sorusu: "korku ne demek?"). */
function bandNote(score: number, t: Dictionary) {
  const x = t.marketExtras;
  const notes: Record<(typeof SENTIMENT_BANDS)[number]["key"], string> = {
    extremeFear: x.bandNoteExtremeFear,
    fear: x.bandNoteFear,
    neutral: x.bandNoteNeutral,
    greed: x.bandNoteGreed,
    extremeGreed: x.bandNoteExtremeGreed,
  };
  return notes[sentimentBand(score).key];
}

/** Göstergenin ne ölçtüğü, kısa. Ad ("Piyasa Genişliği") okuyucuya
    neyin sayıldığını söylemiyordu. */
function componentHint(key: SentimentKey, t: Dictionary) {
  const x = t.marketExtras;
  const hints: Record<SentimentKey, string> = {
    vix: x.hintVix,
    momentum: x.hintMomentum.replace("{days}", String(MOMENTUM_MA_DAYS)),
    breadth: x.hintBreadth,
    credit: x.hintCredit,
    safeHaven: x.hintSafeHaven.replace("{days}", String(SAFE_HAVEN_DAYS)),
  };
  return hints[key];
}

function componentName(key: SentimentKey, t: Dictionary) {
  const x = t.marketExtras;
  const names: Record<SentimentKey, string> = {
    vix: x.pulseVix,
    momentum: x.pulseMomentum,
    breadth: x.pulseBreadth,
    credit: x.pulseCredit,
    safeHaven: x.pulseSafeHaven,
  };
  return names[key];
}

/** Bileşenin ham okuması — ekranda puanın yanında, sayı olarak. */
function rawReading(reading: SentimentReading, locale: Locale, t: Dictionary) {
  const x = t.marketExtras;
  const two = (value: number) => formatPrice(value, locale, { digits: 2 });
  switch (reading.key) {
    case "vix":
      return x.rawVix
        .replace("{value}", two(reading.value))
        .replace("{average}", reading.reference !== null ? two(reading.reference) : "")
        .replace("{days}", String(FEAR_MA_DAYS));
    case "credit":
      return x.rawCredit
        .replace("{value}", two(reading.value))
        .replace("{average}", reading.reference !== null ? two(reading.reference) : "")
        .replace("{days}", String(FEAR_MA_DAYS));
    case "momentum": {
      const distance = reading.reference ? (reading.value / reading.reference - 1) * SCORE_MAX : null;
      return x.rawMomentum
        .replace("{distance}", formatPercent(distance, locale, 1))
        .replace("{days}", String(MOMENTUM_MA_DAYS));
    }
    case "safeHaven":
      return x.rawSafeHaven
        .replace("{stocks}", formatPercent(reading.value, locale, 1))
        .replace("{bonds}", formatPercent(reading.reference, locale, 1))
        .replace("{days}", String(SAFE_HAVEN_DAYS));
    default:
      return x.rawBreadth.replace("{share}", formatPercentPlain(reading.value, locale, 0));
  }
}

/**
 * PUAN RAYI ORTADAN AÇILIR (10 Kasım 2026). Dolgu 0'dan puana uzanıyordu:
 * 50 çizgisi çizili olduğu hâlde dolgu onu baştan sona kesip geçiyor, "9"
 * ile "55" arasındaki fark yalnız uzunluk ve renk olarak okunuyordu —
 * çizginin neye yaradığı anlaşılmıyordu. Ölçeğin anlamı iki yönlü (0 korku,
 * 100 iştah, 50 nötr): dolgu artık 50'den puana doğru açılıyor, korku sola
 * kırmızı, iştah sağa yeşil; ucunda puanın tam yerini gösteren nokta.
 * Tam ve kompakt sürüm aynı bileşeni çiziyor (iki ekran, tek dil).
 */
function ScoreTrack({ score, className }: { score: number; className?: string }) {
  const half = SCORE_MAX / 2;
  const up = score >= half;
  const clamped = Math.min(SCORE_MAX, Math.max(0, score));
  return (
    <span className={cn(styles.scoreTrack, className)} data-motion-track aria-hidden>
      <i
        data-motion-draw="line"
        data-side={up ? "up" : "down"}
        style={{
          [up ? "left" : "right"]: "50%",
          width: `${Math.abs(clamped - half)}%`,
          transformOrigin: up ? "left center" : "right center",
        }}
      />
      <span className={styles.scoreDot} data-side={up ? "up" : "down"} style={{ left: `${clamped}%` }} />
    </span>
  );
}

export async function SentimentPulse({
  locale,
  t,
  variant = "full",
}: {
  locale: Locale;
  t: Dictionary;
  variant?: "full" | "compact";
}) {
  const snapshot = await getSentiment();
  return <SentimentPulseView locale={locale} t={t} variant={variant} snapshot={snapshot} />;
}

/** Saf görünüm — yükleyiciden ayrı, sahte veriyle ölçülebilsin (`olcum`). */
export function SentimentPulseView({
  locale,
  t,
  variant = "full",
  snapshot,
}: {
  locale: Locale;
  t: Dictionary;
  variant?: "full" | "compact";
  snapshot: Awaited<ReturnType<typeof getSentiment>>;
}) {
  const x = t.marketExtras;
  const overall = snapshot.overall;
  const rounded = overall !== null ? Math.round(overall) : null;
  const band = overall !== null ? bandLabel(overall, t) : null;
  const note = overall !== null ? bandNote(overall, t) : null;
  const gaugeLabel =
    rounded !== null && band
      ? x.gaugeAria.replace("{score}", String(rounded)).replace("{band}", band)
      : x.pulseInsufficient;

  if (snapshot.readings.length === 0) {
    return (
      <Panel id={variant === "full" ? "piyasa-nabzi" : undefined} className={styles.pulsePanel}>
        <PanelHeader title={x.pulseTitle} />
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      </Panel>
    );
  }

  if (variant === "compact") {
    return (
      /* Panel bir KAP (11 Kasım): tablette tam genişlikte kadran solda,
         göstergeler iki sütunlu ızgara; rayda eski kalıp (gerekçe
         SentimentCompact.module.css). */
      <Panel className={cn(styles.pulsePanel, compact.scope)}>
        <PanelHeader title={x.pulseTitle} action={<PanelLink href="/piyasalar#piyasa-nabzi">{x.pulseDetails}</PanelLink>} />
        <p className={cn(styles.pulseLead, compact.lead)}>{x.pulseLead}</p>
        <div className={cn(styles.pulseCompact, compact.body)}>
          <div className={styles.gaugeWrap}>
            <Gauge score={overall} label={gaugeLabel} size="compact" />
            <p className={styles.gaugeReading}>
              <strong className="numeral">{rounded ?? NO_VALUE}</strong>
              <span>{band ?? x.pulseInsufficientShort}</span>
            </p>
            {note && <p className={styles.gaugeNote}>{note}</p>}
          </div>
          <ul className={cn(styles.pulseChips, compact.chips)} data-motion-stagger>
            {snapshot.readings.map((reading) => (
              <li key={reading.key}>
                <span className={cn(styles.pulseChipName, compact.name)}>
                  {componentName(reading.key, t)}
                  <small>{componentHint(reading.key, t)}</small>
                </span>
                {/* PUAN BİR ÇİZGİ DE (28 Eylül). Sağdaki küçük sayı tek
                    başına okunmuyordu ("sayılar çok ufak"); ray aynı puanı
                    uzunluk olarak veriyor: 0 solda (korku), 100 sağda
                    (iştah), orta çizgi 50. Renk yalnızca yarının hangi
                    tarafında olduğu — tam sürümdeki rayın aynısı. */}
                <span className={cn(styles.pulseChipScore, compact.score)}>
                  <ScoreTrack score={reading.score} className={cn(styles.chipTrack, compact.track)} />
                  <b className="numeral" data-side={reading.score >= SCORE_MAX / 2 ? "up" : "down"}>
                    {Math.round(reading.score)}
                  </b>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    );
  }

  return (
    <Panel id="piyasa-nabzi" className={styles.pulsePanel}>
      <PanelHeader title={x.pulseTitle} meta={x.pulseScale} />
      <p className={styles.pulseLead}>{x.pulseLead}</p>
      <div className={styles.pulseBody}>
        <div className={styles.gaugeWrap}>
          <Gauge score={overall} label={gaugeLabel} size="full" />
          <p className={styles.gaugeReading}>
            <strong className="numeral">{rounded ?? NO_VALUE}</strong>
            <span>{band ?? x.pulseInsufficientShort}</span>
          </p>
          {note && <p className={styles.gaugeNote}>{note}</p>}
          <p className={styles.gaugeCaption}>
            {x.pulseAverageOf.replace("{n}", String(snapshot.readings.length))}
          </p>
        </div>
        <ul className={styles.pulseList} data-motion-stagger>
          {snapshot.readings.map((reading) => {
            const score = Math.round(reading.score);
            return (
              <li key={reading.key}>
                <div className={styles.pulseRowHead}>
                  <span className={styles.pulseName}>
                    {componentName(reading.key, t)}
                    <small>{componentHint(reading.key, t)}</small>
                  </span>
                  <b className="numeral" data-side={reading.score >= SCORE_MAX / 2 ? "up" : "down"}>{score}</b>
                </div>
                {/* Puan rayı: 0 solda (korku), 100 sağda (iştah). Çubuk bir
                    büyüklük, renk yalnızca yarının hangi tarafında olduğu. */}
                <ScoreTrack score={reading.score} />
                <p className={styles.pulseRaw}>
                  <span className="numeral">{rawReading(reading, locale, t)}</span>
                  <span aria-hidden> · </span>
                  <span className="numeral">{formatEtDateCompact(reading.date, locale)}</span>
                  {reading.key === "breadth" && snapshot.breadthSession === "extended" && (
                    <>
                      <span aria-hidden> · </span>
                      <span>{x.pulseExtended}</span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      {/* DURUM GÖRÜNÜR, YÖNTEM KATLI (10 Kasım). Dört açıklama paragrafı
          ve kaynak satırı panelin dibinde açık duruyordu: 1440'ta panelin
          520 pikselinin ~180'i (üçte biri) yöntem metniydi ve kadranla
          bileşenleri bastırıyordu. Bugüne ait olan tek cümle — hangi
          bileşenin hesaplanamadığı — görünür kalıyor; yöntem, görelilik
          notu, kullanılmayan gösterge ve kaynaklar "Nasıl Okunur"
          katlamasında (yerli `<details>`, JS'siz; yerinde açılır —
          `ExpandInPlace` `summary`yi tanıyor). Metinlerin hiçbiri silinmedi. */}
      {snapshot.missing.length > 0 && (
        <p className={styles.pulseMissing}>
          {x.pulseMissing.replace(
            "{names}",
            snapshot.missing.map((key) => componentName(key, t)).join(", "),
          )}
          {overall === null && ` ${x.pulseMinimum.replace("{n}", String(MIN_COMPONENTS))}`}
        </p>
      )}
      <details className={styles.howTo}>
        <summary>
          <Info size={15} weight="bold" aria-hidden />
          {x.pulseHowTo}
          <CaretDown size={13} weight="bold" aria-hidden className={styles.howToCaret} />
        </summary>
        <div className={styles.howToBody}>
          <p>{x.pulseMethod}</p>
          <p>{x.pulseRelative}</p>
          <p>{x.pulseNoHighsLows}</p>
          <p>{x.pulseSources}</p>
        </div>
      </details>
    </Panel>
  );
}
