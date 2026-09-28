import type { CSSProperties } from "react";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { LogoTile, Skeleton } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Locale } from "@/lib/i18n";
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

export type TotalsLabels = {
  totalValue: string;
  totalPnlUsd: string;
  totalPnlTl: string;
  fxEffect: string;
  fxEffectHint: string;
  fromStock: string;
  fromFx: string;
  sourceTitle: string;
};

/**
 * Toplam değer büyük puntoyla solda; üç kâr/zarar ölçüsü sağda, alt alta.
 *
 * DÖRT EŞİT KUTU DEĞİL. İlk sürüm dört aynı kartı yan yana diziyordu ve
 * "neyim var" sorusunun cevabı (toplam değer) kâr/zararla aynı ağırlıkta
 * duruyordu. Hiyerarşi artık punto farkıyla.
 *
 * LİRA K/Z'NİN KAYNAĞI BİR ÇİZGİ. Ekranın varlık sebebi lira kazancının ne
 * kadarının hisseden, ne kadarının kurdan geldiği; iki parça aynı işaretteyse
 * (ikisi de kazanç ya da ikisi de kayıp) oranları tek çubukta okunuyor.
 * İşaretler ayrışınca bir parça ötekini yiyor ve "pay" diye bir şey
 * kalmıyor — o zaman çubuk hiç basılmıyor, sayılar yine yazıyor.
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
    value === null ? NO_VALUE : `${signed && value > 0 ? "+ " : ""}${formatPrice(value, locale, { currency: true })}`;
  const tl = (value: number | null, signed = false) =>
    value === null ? NO_VALUE : formatLira(value, locale, 2, signed);
  const pnlUsdPct = totals.costUsd > 0 ? (totals.pnlUsd / totals.costUsd) * 100 : null;
  const pnlTlPct = totals.pnlTl !== null && totals.costTl ? (totals.pnlTl / totals.costTl) * 100 : null;

  const stockPart = todayRate !== null ? totals.pnlUsd * todayRate : null;
  const fxPart = totals.fxEffectTl;
  const sameSign =
    stockPart !== null && fxPart !== null && stockPart !== 0 && Math.sign(stockPart) === Math.sign(fxPart);
  const stockShare = sameSign ? (stockPart / (stockPart + fxPart)) * 100 : null;

  const rows: { key: string; label: string; value: string; tone: number | null; sub: string | null }[] = [
    { key: "usd", label: labels.totalPnlUsd, value: usd(totals.pnlUsd, true), tone: totals.pnlUsd, sub: formatPercent(pnlUsdPct, locale) },
    { key: "tl", label: labels.totalPnlTl, value: tl(totals.pnlTl, true), tone: totals.pnlTl, sub: formatPercent(pnlTlPct, locale) },
    { key: "fx", label: labels.fxEffect, value: tl(totals.fxEffectTl, true), tone: totals.fxEffectTl, sub: null },
  ];

  return (
    <div className={styles.totals}>
      <div className={styles.totalLead}>
        <p className={styles.totalLabel}>{labels.totalValue}</p>
        <RollingFigure value={usd(totals.valueUsd)} className={styles.totalValue} />
        <p className={`figure ${styles.totalTl}`}>{tl(totals.valueTl)}</p>

        {stockShare !== null && stockPart !== null && fxPart !== null && (
          <div className={styles.source}>
            <p className={styles.sourceTitle}>{labels.sourceTitle}</p>
            <span className={styles.sourceBar} aria-hidden>
              <span className={styles.sourceStock} style={{ flexGrow: stockShare }} />
              <span className={styles.sourceFx} style={{ flexGrow: 100 - stockShare }} />
            </span>
            <dl className={styles.sourceLegend}>
              <div>
                <dt>
                  <span className={styles.keyStock} aria-hidden />
                  {labels.fromStock}
                </dt>
                <dd className="figure">{tl(stockPart, true)}</dd>
              </div>
              <div>
                <dt>
                  <span className={styles.keyFx} aria-hidden />
                  {labels.fromFx}
                </dt>
                <dd className="figure">{tl(fxPart, true)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <dl className={styles.pnlList}>
        {rows.map((row, index) => (
          <div key={row.key} className={styles.pnlRow}>
            <dt className={styles.pnlLabel}>
              {row.label}
              {row.key === "fx" && <span className={styles.pnlHint}>{labels.fxEffectHint}</span>}
            </dt>
            <dd className={cn(styles.pnlValue, directionText(directionOf(row.tone)))}>
              <RollingFigure value={row.value} delayMs={(index + 1) * 120} />
              {row.sub && <span className={`figure ${styles.pnlPct}`}>{row.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
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
