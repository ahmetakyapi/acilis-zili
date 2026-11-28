import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, Skeleton } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ThemePhase } from "@/lib/theme-stats";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain } from "@/lib/utils";
import { indexPagePath } from "@/lib/index-pages";
import { INDEX_TABS, type TabKey } from "./index-shared";
import styles from "./MarketsOverview.module.css";

/* ---- Endeks seçici + piyasa genişliği: TEK PANEL, TEK ÖLÇER ----

   28 Kasım 2026 (görsel tur 3; sahibinin sözü: "bazı ekranlarda çok bilgi
   yoğunluğu var… sadece sayılardansa görsel geçişlere odaklanalım, tekrar
   eden şeylerden uzaklaşalım"). Önce: sayfa genişliğinde üç bölmeli şerit —
   çipler + medyan (display sayı) · günlük değişim DAĞILIMI (on dört kutu,
   her kutunun üstünde sayı, eksen etiketleri) · yükselenlerin payı (display
   sayı, üç renkli ray, üç sayaç). Aynı soruya ("bugün endeksin içi nasıl?")
   üç ayrı çizimle üç okuma; 1440'ta 1320 × 202 piksel ve sekiz ayrı sayı.
   Sonra: dar bir panel, tek yarım daire ölçer. Yayın üç dilimi artıda /
   yatay / ekside olanların payı (aynı sayılar, aynı küme), ortasında tek
   display sayı (yükselenlerin payı), altında üç sayaç ve medyan satırı.
   Dağılım çizimi kalktı: ayrıntısı hemen alttaki ısı haritasında ve
   bileşen tablosunda. Seçici panelin başlığında segment.

   Eski kararlar yerinde: medyan yalnız aynı seansı anlatan yüzdelerden
   (`sameSessionMoves`, MarketsScreen → "MEDYAN HİSSE"), künyesi pencereye
   göre (`themePhase`); sayaçlar yalnız değişimi bilinen satırlardan
   (MarketsScreen → "GENİŞLİK YALNIZCA DEĞİŞİMİ BİLİNEN…"); pay sekme
   değişince yuvarlanır (`RollingFigure`, 10 Kasım). Seçici çipler endeksin
   KENDİ adresine gider (14 Kasım; eski `?endeks=` 308). */

/** Yay geometrisi — viewBox 220 × 120, merkez tabanın ortası. */
const ARC = { cx: 110, cy: 110, r: 92, stroke: 16 } as const;
/** Dilimler arası boşluk, yayın kesri olarak (≈ 3 piksel). */
const ARC_GAP = 0.012;

function arcPoint(share: number) {
  const angle = Math.PI * (1 - share);
  return { x: ARC.cx + ARC.r * Math.cos(angle), y: ARC.cy - ARC.r * Math.sin(angle) };
}

function arcPath(from: number, to: number) {
  const a = arcPoint(from);
  const b = arcPoint(to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${ARC.r} ${ARC.r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export type Breadth = { advancing: number; flat: number; declining: number };

export function BreadthPanel({
  tab,
  breadth,
  median,
  phase,
  memberCount,
  loading = false,
  locale,
  t,
}: {
  tab: TabKey;
  /** Değişimi bilinen satırların sayaçları; hiç yoksa `null`. */
  breadth: Breadth | null;
  /** Üyelerin medyan değişimi (aynı seans kümesi) — yoksa `null`. */
  median: number | null;
  phase: ThemePhase | null;
  /** Medyanın kurulduğu küme büyüklüğü (künye cümlesi). */
  memberCount: number;
  loading?: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const total = breadth ? breadth.advancing + breadth.flat + breadth.declining : 0;
  const share = breadth && total > 0 ? (breadth.advancing / total) * 100 : null;
  /* Dilimler soldan sağa: artıda (yeşil) · yatay (nötr) · ekside (kırmızı).
     Sıfır olan dilim çizilmez, boşluğu da yok. */
  const parts = breadth && total > 0
    ? ([
        { key: "up", value: breadth.advancing, stroke: "var(--up)" },
        { key: "flat", value: breadth.flat, stroke: "var(--line-strong)" },
        { key: "down", value: breadth.declining, stroke: "var(--down)" },
      ] as const).filter((part) => part.value > 0)
    : [];
  let cursor = 0;
  const arcs = parts.map((part, index) => {
    const from = cursor;
    const to = cursor + part.value / total;
    cursor = to;
    return {
      key: part.key,
      stroke: part.stroke,
      d: arcPath(from + (index === 0 ? 0 : ARC_GAP / 2), to - (index === parts.length - 1 ? 0 : ARC_GAP / 2)),
    };
  });
  const medianLabel =
    phase === "pre-market" ? t.markets.medianPreMarket : phase === "lastClose" ? t.markets.medianLastClose : t.markets.medianStock;
  const counts = breadth
    ? [
        { key: "up", value: breadth.advancing, label: t.markets.advancing },
        { key: "flat", value: breadth.flat, label: t.markets.unchanged },
        { key: "down", value: breadth.declining, label: t.markets.declining },
      ]
    : [];

  return (
    <Panel className={styles.breadthPanel} aria-label={t.markets.breadth}>
      <div className={styles.breadthHead}>
        <h2 className="text-lead font-bold">{t.markets.breadth}</h2>
        {/* SEÇİCİ BAŞLIKTA, SEGMENT (28 Kasım). Üç çip şeridin solunda ayrı
            bir bölmeydi; artık panelin başlığında tek ray. Basış evin tek
            lehçesinde (0,97), dokunma hedefi telefonda 44. Üye sayısı
            seçili endeksin kartında ve tablonun künyesinde yazılı. */}
        <nav className={styles.segment} aria-label={t.markets.breadth}>
          {INDEX_TABS.map((entry) => (
            <Link
              key={entry.key}
              href={indexPagePath(entry.key)}
              aria-current={entry.key === tab ? "page" : undefined}
              scroll={false}
              className={styles.segmentItem}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.gaugeWrap}>
        {loading ? (
          <Skeleton className={styles.gaugeSkeleton} />
        ) : share === null ? (
          <p className={styles.gaugeEmpty}>{t.common.noData}</p>
        ) : (
          <figure
            className={styles.gauge}
            role="img"
            aria-label={`${t.markets.advancingShare}: ${formatPercentPlain(share, locale, 0)} · ${breadth!.advancing} ${t.markets.advancing} · ${breadth!.flat} ${t.markets.unchanged} · ${breadth!.declining} ${t.markets.declining}`}
          >
            <svg viewBox="0 0 220 120" aria-hidden>
              <path d={arcPath(0, 1)} fill="none" strokeWidth={ARC.stroke} strokeLinecap="round" className={styles.gaugeTrack} />
              {arcs.map((arc) => (
                <path
                  key={arc.key}
                  d={arc.d}
                  fill="none"
                  strokeWidth={ARC.stroke}
                  strokeLinecap="round"
                  /* Yay görünüme girince uçtan uca çizilir (MotionExperience
                     `arc`, SentimentPulse ile aynı yol); JS yoksa tam çizili. */
                  pathLength={1}
                  data-motion-draw="arc"
                  style={{ stroke: arc.stroke, strokeDasharray: 1 }}
                />
              ))}
            </svg>
            <figcaption className={styles.gaugeRead}>
              <strong className="numeral"><RollingFigure value={formatPercentPlain(share, locale, 0)} /></strong>
              <span>{t.markets.advancingShare}</span>
            </figcaption>
          </figure>
        )}
      </div>

      {counts.length > 0 && (
        <dl className={styles.gaugeCounts}>
          {counts.map((count) => (
            <div key={count.key} data-tone={count.key}>
              <dd className="numeral">{count.value}</dd>
              <dt>{count.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* MEDYAN SATIRI (18 Ekim'den beri şeridin okuması; 28 Kasım'da
          ölçerin altına indi). Endeksin kendi yüzdesi kahraman kartta; bu
          satır kartta OLMAYAN okumayı taşır: tipik hisse ne yaptı. */}
      <div className={styles.medianRow}>
        {loading ? (
          <Skeleton className="h-5 w-full" />
        ) : median !== null ? (
          <>
            <p className={styles.medianLine}>
              <span>{medianLabel}</span>
              <strong className={cn("numeral", directionText(directionOf(median)))}>{formatPercent(median, locale)}</strong>
            </p>
            <p className={styles.medianNote}>
              {t.markets.medianOf.replace("{n}", String(memberCount))} {t.markets.medianHint}
            </p>
          </>
        ) : (
          <p className={styles.medianNote}>{t.markets.medianMissing}</p>
        )}
      </div>
    </Panel>
  );
}
