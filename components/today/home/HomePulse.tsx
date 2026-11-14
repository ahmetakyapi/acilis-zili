import type { CSSProperties } from "react";
import { EmptyState, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  MOMENTUM_MA_DAYS,
  SAFE_HAVEN_DAYS,
  SENTIMENT_BANDS,
  sentimentBand,
  type SentimentKey,
} from "@/lib/sentiment";
import { getSentiment } from "@/lib/sentiment-data";
import { NO_VALUE } from "@/lib/utils";
import styles from "./HomePulse.module.css";

/* ==========================================================================
   Piyasa Nabzı — ANA SAYFA RAYININ KENDİ PANELİ (14 Kasım, görsel tur)
   ========================================================================== */

/**
 * Ana sayfanın sağ rayındaki kompakt Piyasa Nabzı.
 *
 * NEDEN AYRI BİLEŞEN. Ray, /piyasalar panelinin `compact` hâlini
 * (`components/markets/SentimentPulse.tsx`) basıyordu. O kalıp 350 piksellik
 * rayda yay + puan + okumayı 160 piksellik sola yaslı bir sütuna diziyor,
 * sağında 150 piksel ölü alan bırakıyordu (canlı, 1440: yay 1062–1220, panel
 * içeriği 1051–1359); gösterge satırlarında açıklama 130 piksellik sütunda
 * üç-dört satıra kırılıyor, puan 120 piksellik noktalı bir rayla okunuyordu
 * (panel 690 piksel). Piyasalar ekranının dosyasını bu turda başka bir ajan
 * taşıyor; ray kendi görünümünü burada kuruyor, VERİ AYNI: `getSentiment`
 * (istek içinde `cache()`li — /piyasalar ile aynı anahtar, yeni sağlayıcı
 * turu yok) ve bant kuralı `lib/sentiment.ts`.
 *
 * DÜZEN:
 *   1. OKUMA TEK HİZALI BLOK: yay solda (puan yayın içinde, panelin en büyük
 *      puntosu), sağında bandın adı ve tek cümlelik anlamı. Blok içerik
 *      genişliğinin tamamını kullanır; ölü alan yok.
 *   2. GÖSTERGELER KALIN ŞERİTLE: ad ve puan aynı satırda, altında panelin
 *      eninde değer çubuğu (`value-lane` / `value-bar`): 50 çentiğinden puana
 *      doğru açılır, korku sola kırmızı, iştah sağa yeşil (ölçeğin anlamı iki
 *      yönlü — gerekçe SentimentPulse → ScoreTrack). Nokta yok ("nokta nokta
 *      ne anlatıyor" — `.claude/rules/arayuz.md`). Açıklama çubuğun altında
 *      tam satır.
 * Ölçüm HomePulse.module.css başında.
 */
export async function HomePulse({ locale, t }: { locale: Locale; t: Dictionary }) {
  const snapshot = await getSentiment();
  return <HomePulseView locale={locale} t={t} snapshot={snapshot} />;
}

const SCORE_MAX = 100;
/* Yay: 200 × 108 görüş kutusu, yarıçap 88, kalınlık 8 (132 piksellik
   çizimde ~5 piksel: ortak şerit ölçüsü). */
const ARC = { cx: 100, cy: 100, r: 88, stroke: 8 } as const;
const ARC_GAP = 4;

function at(score: number) {
  const angle = Math.PI * (1 - score / SCORE_MAX);
  return { x: ARC.cx + ARC.r * Math.cos(angle), y: ARC.cy - ARC.r * Math.sin(angle) };
}
function arc(from: number, to: number) {
  const start = at(from);
  const end = at(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${ARC.r} ${ARC.r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}
const BANDS = SENTIMENT_BANDS.map((band, index) => {
  const from = index === 0 ? 0 : SENTIMENT_BANDS[index - 1].max;
  const to = Math.min(SCORE_MAX, band.max);
  return { key: band.key, tone: band.tone, path: arc(from + (from === 0 ? 0 : ARC_GAP / 2), to - (to === SCORE_MAX ? 0 : ARC_GAP / 2)) };
});

type BandKey = (typeof SENTIMENT_BANDS)[number]["key"];

/** Saf görünüm — veri `HomePulse`ta (`olcum` skill'i). */
export function HomePulseView({
  t,
  snapshot,
}: {
  locale: Locale;
  t: Dictionary;
  snapshot: Awaited<ReturnType<typeof getSentiment>>;
}) {
  const x = t.marketExtras;
  const header = <PanelHeader title={x.pulseTitle} action={<PanelLink href="/piyasalar#piyasa-nabzi">{x.pulseDetails}</PanelLink>} />;
  if (snapshot.readings.length === 0) {
    return (
      <Panel className="min-w-0">
        {header}
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      </Panel>
    );
  }
  const overall = snapshot.overall;
  const rounded = overall !== null ? Math.round(overall) : null;
  const band = overall !== null ? sentimentBand(overall) : null;
  const bandNames: Record<BandKey, string> = {
    extremeFear: x.bandExtremeFear, fear: x.bandFear, neutral: x.bandNeutral, greed: x.bandGreed, extremeGreed: x.bandExtremeGreed,
  };
  const bandNotes: Record<BandKey, string> = {
    extremeFear: x.bandNoteExtremeFear, fear: x.bandNoteFear, neutral: x.bandNoteNeutral, greed: x.bandNoteGreed, extremeGreed: x.bandNoteExtremeGreed,
  };
  const names: Record<SentimentKey, string> = {
    vix: x.pulseVix, momentum: x.pulseMomentum, breadth: x.pulseBreadth, credit: x.pulseCredit, safeHaven: x.pulseSafeHaven,
  };
  const hints: Record<SentimentKey, string> = {
    vix: x.hintVix,
    momentum: x.hintMomentum.replace("{days}", String(MOMENTUM_MA_DAYS)),
    breadth: x.hintBreadth,
    credit: x.hintCredit,
    safeHaven: x.hintSafeHaven.replace("{days}", String(SAFE_HAVEN_DAYS)),
  };
  const marker = overall !== null ? at(overall) : null;
  const gaugeLabel =
    rounded !== null && band
      ? x.gaugeAria.replace("{score}", String(rounded)).replace("{band}", bandNames[band.key])
      : x.pulseInsufficient;
  return (
    /* Panel bir KAP: tablette (768–1279, tam genişlik) okuma solda,
       göstergeler sağda iki sütun (HomePulse.module.css → "GENİŞ KAP"). */
    <Panel className={styles.panel}>
      {header}
      <div className={styles.body}>
        <div className={styles.reading}>
          <div className={styles.gauge}>
            <svg viewBox="0 0 200 108" role="img" aria-label={gaugeLabel}>
              {BANDS.map((item) => (
                <path
                  key={item.key}
                  d={item.path}
                  fill="none"
                  strokeWidth={ARC.stroke}
                  strokeLinecap="round"
                  data-tone={item.tone}
                  data-band={item.key}
                  data-active={band === null || band.key === item.key || undefined}
                  /* Bantlar görünüme girince uçtan uca çizilir
                     (MotionExperience `arc`); JS yoksa tam çizili. */
                  pathLength={1}
                  data-motion-draw="arc"
                  style={{ strokeDasharray: 1 }}
                />
              ))}
              {marker && <circle cx={marker.x} cy={marker.y} r={ARC.stroke / 2 + 3} className={`spark-dot ${styles.marker}`} />}
            </svg>
            <strong className="numeral" aria-hidden="true">{rounded ?? NO_VALUE}</strong>
          </div>
          <div className={styles.verdict}>
            <b data-tone={band?.tone ?? "flat"}>{band ? bandNames[band.key] : x.pulseInsufficientShort}</b>
            {band && <p>{bandNotes[band.key]}</p>}
            <small>{x.pulseScale}</small>
          </div>
        </div>
        <ul className={styles.list} data-draw>
          {snapshot.readings.map((reading, index) => {
            const score = Math.min(SCORE_MAX, Math.max(0, reading.score));
            const up = score >= SCORE_MAX / 2;
            const span = Math.abs(score - SCORE_MAX / 2);
            return (
              <li key={reading.key}>
                <span className={styles.name}>{names[reading.key]}</span>
                <b className="numeral" data-tone={up ? "up" : "down"}>{Math.round(reading.score)}</b>
                <span className={`value-lane ${styles.lane}`} aria-hidden="true">
                  <i
                    className="value-bar bar-fill"
                    data-tone={up ? "up" : "down"}
                    data-end={up ? "end" : "start"}
                    style={{ [up ? "left" : "right"]: "50%", width: `${Math.max(span, 1.5)}%`, "--i": index } as CSSProperties}
                  />
                  <i className="value-notch" data-quiet style={{ left: "50%" }} />
                </span>
                <small>{hints[reading.key]}</small>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
