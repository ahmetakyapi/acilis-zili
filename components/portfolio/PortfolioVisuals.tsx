import type { CSSProperties } from "react";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { LogoTile, Skeleton } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { PortfolioTotals } from "@/lib/portfolio";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./Portfolio.module.css";

/**
 * Portföyün veri görselleri — hepsi sunucuda çiziliyor, hareket CSS'te.
 *
 * RENKLER PAY AİLESİ (`--share-1..4`, `--share-rest`): dağılım bir
 * BÜYÜKLÜK, yön değil. Yeşil/kırmızı yalnızca kâr/zararın işaretinde
 * (CLAUDE.md "Karşılaştırılan her büyüklük…": çubuk bir büyüklük, bir
 * yargı değil).
 */

/** Halkada ayrı dilim alan en büyük pozisyon sayısı; kalanı "Diğer". */
export const RING_SLICES = 4;
const SHARE_TOKENS = ["var(--share-1)", "var(--share-2)", "var(--share-3)", "var(--share-4)"] as const;
const REST_TOKEN = "var(--share-rest)";
/** Dilimler arasındaki boşluk, çevrenin yüzdesi. */
const SLICE_GAP = 0.9;
const RING_RADIUS = 46;

export type AllocationSlice = {
  key: string;
  label: string;
  symbol: string | null;
  logoUrl: string | null;
  pct: number;
};

/** Pozisyonları halkanın dilimlerine indirir: en büyük dört + kalanın toplamı. */
export function allocationSlices(
  items: readonly { symbol: string; logoUrl: string | null; valueUsd: number | null }[],
  otherLabel: string,
): AllocationSlice[] {
  /* Aynı sembol iki kez alınmış olabilir (farklı tarihler): halkada tek
     dilim, çünkü soru "neyim var", "kaç alışım var" değil. */
  const bySymbol = new Map<string, { logoUrl: string | null; value: number }>();
  let total = 0;
  for (const item of items) {
    if (item.valueUsd === null || item.valueUsd <= 0) continue;
    const entry = bySymbol.get(item.symbol) ?? { logoUrl: item.logoUrl, value: 0 };
    entry.value += item.valueUsd;
    bySymbol.set(item.symbol, entry);
    total += item.valueUsd;
  }
  if (total <= 0) return [];
  const sorted = [...bySymbol.entries()].sort((a, b) => b[1].value - a[1].value);
  /* Pay ailesinde dört ton var; beşinci bir sembol gri tonu alsaydı "Diğer"
     dilimiyle karışırdı. Dördün ötesi tek dilim. */
  const head = sorted.slice(0, RING_SLICES);
  const rest = sorted.slice(head.length).reduce((sum, [, entry]) => sum + entry.value, 0);
  const slices: AllocationSlice[] = head.map(([symbol, entry]) => ({
    key: symbol,
    label: symbol,
    symbol,
    logoUrl: entry.logoUrl,
    pct: (entry.value / total) * 100,
  }));
  if (rest > 0) slices.push({ key: "rest", label: otherLabel, symbol: null, logoUrl: null, pct: (rest / total) * 100 });
  return slices;
}

function tokenAt(index: number, slice: AllocationSlice) {
  return slice.symbol === null ? REST_TOKEN : SHARE_TOKENS[index] ?? REST_TOKEN;
}

/**
 * Kahramanın halkası — pozisyon ağırlıkları.
 *
 * `pathLength="100"`: dilimin boyu doğrudan yüzdesi, çevre hesabı yok.
 * Dilimler yüklemede sırayla çiziliyor (kahraman ilk ekranda, CSS);
 * hareketi azaltan okuyucu tam halkayı görüyor.
 *
 * BOŞ PORTFÖYDE KESİKLİ HALKA. Kahramanın sağı boş kalmıyor: çizginin
 * kendisi "burası dolacak" diyor ve altındaki cümle nasıl dolacağını.
 */
export function AllocationRing({
  slices,
  count,
  labels,
  locale,
}: {
  slices: AllocationSlice[];
  count: number;
  labels: { title: string; positions: string; empty: string };
  locale: Locale;
}) {
  const gap = slices.length > 1 ? SLICE_GAP : 0;
  /* Her dilimin başladığı yer: öncekilerin toplamı. */
  const starts = slices.map((_, index) =>
    slices.slice(0, index).reduce((sum, slice) => sum + slice.pct, 0),
  );

  return (
    <div className={styles.allocation}>
      <h2 className={styles.visualTitle}>{labels.title}</h2>
      <div className={styles.allocationBody}>
        <div className={styles.ring}>
          <svg viewBox="0 0 120 120" aria-hidden className={styles.ringSvg}>
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              className={slices.length === 0 ? styles.ringGhost : styles.ringTrack}
            />
            {slices.map((slice, index) => {
              const length = Math.max(0, slice.pct - gap);
              const start = starts[index];
              return (
                <circle
                  key={slice.key}
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  pathLength={100}
                  className={styles.ringSlice}
                  style={
                    {
                      stroke: tokenAt(index, slice),
                      "--len": length,
                      "--gap": 100 - length,
                      strokeDashoffset: -start,
                      "--i": index,
                    } as CSSProperties
                  }
                />
              );
            })}
          </svg>
          <p className={styles.ringCenter}>
            <RollingFigure value={String(count)} className={styles.ringNumber} />
            <span>{labels.positions}</span>
          </p>
        </div>

        {slices.length === 0 ? (
          <p className={styles.allocationEmpty}>{labels.empty}</p>
        ) : (
          <ul className={styles.legend}>
            {slices.map((slice, index) => (
              <li key={slice.key} style={{ "--i": index } as CSSProperties}>
                <span className={styles.swatch} style={{ background: tokenAt(index, slice) }} aria-hidden />
                {slice.symbol ? (
                  <LogoTile symbol={slice.symbol} logoUrl={slice.logoUrl} size="xs" />
                ) : (
                  <span className={styles.legendRestTile} aria-hidden />
                )}
                <span className={styles.legendLabel}>{slice.label}</span>
                <span className={`figure ${styles.legendPct}`}>
                  {formatPercentPlain(slice.pct, locale, 1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AllocationRingSkeleton({ title }: { title: string }) {
  return (
    <div className={styles.allocation} aria-hidden>
      <p className={styles.visualTitle}>{title}</p>
      <div className={styles.allocationBody}>
        <div className={styles.ring}>
          <svg viewBox="0 0 120 120" className={styles.ringSvg}>
            <circle cx="60" cy="60" r={RING_RADIUS} className={styles.ringTrack} />
          </svg>
        </div>
        <div className={styles.legend}>
          {Array.from({ length: RING_SLICES }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Toplam şeridi
   --------------------------------------------------------------------------- */

export type TotalsLabels = Pick<
  Dictionary["lira"]["portfolio"],
  | "totalValue"
  | "usdBasis"
  | "tlBasis"
  | "costShort"
  | "value"
  | "breakdownTitle"
  | "fromStock"
  | "fromFx"
  | "fromStockHint"
  | "fromFxHint"
  | "tlTotal"
  | "fxStoryUp"
  | "fxStoryDown"
  | "fxStoryFlat"
>;

/**
 * GETİRİ BÖLÜMÜ — "ne kadar kazandım, dolarda mı lirada mı, neden farklı".
 *
 * İLK HÂL ÜÇ SATIRDI: "Dolar K/Z", "Lira K/Z", "Kurun Katkısı" alt alta, aynı
 * puntoda (2 Ekim'e kadar). Üç sayı da doğruydu ama okuyucunun asıl sorusu —
 * lira getirisi neden dolardakinden yüksek — cevapsızdı; "Kurun Katkısı"nın
 * ne olduğunu küçük puntolu bir tanım anlatıyordu. Sahibi telefonda "TL ve
 * dolar getirilerini daha iyi anlat" dedi.
 *
 * Şimdi üç kat:
 *  1. Toplam değer, iki para biriminde.
 *  2. İKİ KART YAN YANA: dolar bazında ve lira bazında getiri, her biri kendi
 *     maliyetinden değerine. Yan yana durunca iki yüzde doğrudan kıyaslanıyor.
 *  3. ÇÖZÜMLEME: lira getirisi = hisseden + kurdan. Çubuk iki parçanın
 *     oranını, denklem sayısını, cümle SEBEBİNİ veriyor: alış günlerinin
 *     ortalama kuru (lira maliyet ÷ dolar maliyet, yani adetle ağırlıklı) ile
 *     bugünün kuru. Cümle uydurma değil, aynı iki toplamdan hesaplanıyor.
 *
 * Çubuk yalnızca iki parça aynı işaretteyse basılıyor: işaretler ayrışınca
 * bir parça ötekini yiyor ve "pay" diye bir şey kalmıyor; denklem yine yazıyor.
 */
export function TotalsBand({
  totals,
  todayRate,
  locale,
  labels,
}: {
  totals: PortfolioTotals;
  todayRate: number | null;
  locale: Locale;
  labels: TotalsLabels;
}) {
  const usd = (value: number | null, signed = false) =>
    value === null ? NO_VALUE : `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true })}`;
  const tl = (value: number | null, signed = false) =>
    value === null ? NO_VALUE : formatLira(value, locale, 2, signed);
  const pnlUsdPct = totals.costUsd > 0 ? (totals.pnlUsd / totals.costUsd) * 100 : null;
  const pnlTlPct = totals.pnlTl !== null && totals.costTl ? (totals.pnlTl / totals.costTl) * 100 : null;

  const stockPart = todayRate !== null && totals.pnlTl !== null ? totals.pnlUsd * todayRate : null;
  const fxPart = totals.fxEffectTl;
  const sameSign =
    stockPart !== null && fxPart !== null && stockPart !== 0 && fxPart !== 0 && Math.sign(stockPart) === Math.sign(fxPart);
  const stockShare = sameSign ? (stockPart / (stockPart + fxPart)) * 100 : null;

  /* Alış günlerinin ağırlıklı ortalama kuru ve bugüne değişimi. */
  const buyAvg = totals.costTl !== null && totals.costUsd > 0 ? totals.costTl / totals.costUsd : null;
  const rateChange = buyAvg !== null && todayRate !== null ? (todayRate / buyAvg - 1) * 100 : null;
  const gap = pnlTlPct !== null && pnlUsdPct !== null ? pnlTlPct - pnlUsdPct : null;
  /* Kur iki ondalıkla: TCMB dört basamak yayımlıyor ama cümlede dört
     basamak okunmuyor; künyedeki bugünkü kur satırı tam değeri taşıyor. */
  const rate = (value: number) => `${formatPrice(value, locale, { digits: 2 })} ₺`;
  let story: string | null = null;
  if (buyAvg !== null && todayRate !== null && rateChange !== null && gap !== null) {
    const flat = Math.abs(rateChange) < 0.05;
    story = flat
      ? labels.fxStoryFlat
      : (rateChange > 0 ? labels.fxStoryUp : labels.fxStoryDown)
          .replace("{buy}", rate(buyAvg))
          .replace("{today}", rate(todayRate))
          .replace("{chg}", formatPercentPlain(Math.abs(rateChange), locale, 1))
          .replace("{gap}", formatPrice(Math.abs(gap), locale, { digits: 1 }));
  }

  const cards = [
    {
      key: "usd",
      label: labels.usdBasis,
      value: usd(totals.pnlUsd, true),
      pct: pnlUsdPct,
      tone: totals.pnlUsd,
      cost: usd(totals.costUsd),
      worth: usd(totals.valueUsd),
    },
    {
      key: "tl",
      label: labels.tlBasis,
      value: tl(totals.pnlTl, true),
      pct: pnlTlPct,
      tone: totals.pnlTl,
      cost: totals.costTl !== null ? tl(totals.costTl) : null,
      worth: totals.valueTl !== null ? tl(totals.valueTl) : null,
    },
  ];

  return (
    <div className={styles.totals}>
      <div className={styles.totalLead}>
        <p className={styles.totalLabel}>{labels.totalValue}</p>
        <RollingFigure value={usd(totals.valueUsd)} className={styles.totalValue} />
        <p className={`figure ${styles.totalTl}`}>{tl(totals.valueTl)}</p>
      </div>

      <dl className={styles.basisGrid}>
        {cards.map((card, index) => (
          <div key={card.key} className={styles.basisCard} data-tone={directionOf(card.tone)}>
            <dt className={styles.basisLabel}>{card.label}</dt>
            <dd className={styles.basisBody}>
              <span className={cn(styles.basisValue, directionText(directionOf(card.tone)))}>
                <RollingFigure value={card.value} delayMs={(index + 1) * 120} />
              </span>
              {card.pct !== null && (
                <span className={cn("figure", styles.basisPct)} data-tone={directionOf(card.tone)}>
                  {formatPercent(card.pct, locale)}
                </span>
              )}
              {card.cost && card.worth && (
                <span className={styles.basisLine}>
                  <span>
                    {labels.costShort} <b className="figure">{card.cost}</b>
                  </span>
                  <span>
                    {labels.value} <b className="figure">{card.worth}</b>
                  </span>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {stockPart !== null && fxPart !== null && totals.pnlTl !== null && (
        <div className={styles.breakdown}>
          <p className={styles.breakdownTitle}>{labels.breakdownTitle}</p>
          {stockShare !== null && (
            <span className={styles.sourceBar} aria-hidden>
              <span className={styles.sourceStock} style={{ flexGrow: stockShare }} />
              <span className={styles.sourceFx} style={{ flexGrow: 100 - stockShare }} />
            </span>
          )}
          <dl className={styles.equation}>
            <div>
              <dt>
                <span className={styles.keyStock} aria-hidden />
                {labels.fromStock}
              </dt>
              <dd className="figure">{tl(stockPart, true)}</dd>
              <dd className={styles.equationHint}>{labels.fromStockHint}</dd>
            </div>
            <span className={styles.equationOp} aria-hidden>+</span>
            <div>
              <dt>
                <span className={styles.keyFx} aria-hidden />
                {labels.fromFx}
              </dt>
              <dd className="figure">{tl(fxPart, true)}</dd>
              <dd className={styles.equationHint}>{labels.fromFxHint}</dd>
            </div>
            <span className={styles.equationOp} aria-hidden>=</span>
            <div className={styles.equationTotal}>
              <dt>{labels.tlTotal}</dt>
              <dd className="figure" data-tone={directionOf(totals.pnlTl)}>{tl(totals.pnlTl, true)}</dd>
            </div>
          </dl>
          {story && <p className={styles.story}>{story}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Sektör dağılımı
   --------------------------------------------------------------------------- */

/**
 * Sektör ağırlığı tek bir yüzde yüzlük şerit ve altında listesi.
 *
 * Halka kahramanda pozisyonları anlatıyor; sektör için ikinci bir halka
 * aynı şekli iki kez göstermek olurdu. Şerit bütünün parçalarını tek
 * satırda veriyor, liste sayıyı.
 */
export function SectorStrip({
  weights,
  locale,
}: {
  weights: { sector: string; pct: number }[];
  locale: Locale;
}) {
  const color = (index: number) =>
    index < SHARE_TOKENS.length ? SHARE_TOKENS[index] : REST_TOKEN;
  return (
    <div className={styles.sectors}>
      <span className={styles.sectorBar} aria-hidden>
        {weights.map((weight, index) => (
          <span
            key={weight.sector}
            style={{ flexGrow: weight.pct, background: color(index), "--i": index } as CSSProperties}
          />
        ))}
      </span>
      <ul className={styles.sectorList}>
        {weights.map((weight, index) => (
          <li key={weight.sector}>
            <span className={styles.swatch} style={{ background: color(index) }} aria-hidden />
            <span className={styles.sectorName}>{weight.sector}</span>
            <span className={`figure ${styles.sectorPct}`}>
              {formatPercentPlain(weight.pct, locale, 1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
