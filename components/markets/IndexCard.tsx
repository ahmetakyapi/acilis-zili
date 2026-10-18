import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel } from "@/components/ui/primitives";
import { Sparkline, sparkFrame } from "@/components/ui/Sparkline";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import { cn, directionOf, formatChange, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./MarketExperience.module.css";

/**
 * Piyasalar kapağının endeks kartı (18 Ekim; önce `piyasalar/page.tsx`
 * içinde satır içiydi). Sayfanın kendi dosyasında 1700 satır vardı ve kart
 * sayfanın en sık değişen parçası; "büyük sayfalar panellere bölünür".
 *
 * OKUMA SIRASI: ad ve fon → fiyat → yüzde + puan → gün içi eğri → gün
 * aralığı. Yüzde ile mutlak değişim YAN YANA: kart önce yalnız yüzdeyi
 * yazıyordu ve "707,87'lik fon bugün kaç dolar kaybetti" sorusu kart
 * açılmadan cevapsızdı. İkisi de aynı kotasyondan (`quote.change`,
 * `quote.changePct`), yani aynı sayının iki biçimi (veri dürüstlüğü 3).
 *
 * EĞRİNİN TABANI ADLANDIRILDI. Kesik çizgi önceki kapanıştı ama bunu
 * yazan bir şey yoktu; okuyucu çizgiyi açılış ya da ortalama sanabiliyordu.
 * Künye çizginin hemen üstünde ya da altında, eğrinin bittiği tarafın
 * TERSİNDE (fiyat kapanışın altındaysa künye üstte): son nokta ile künye
 * çakışmıyor. Konum `sparkFrame`ten, eğrinin kendi ölçeğinden — tahmin yok.
 * Seansın açılış ve kapanış anı eğrinin arkasında ince birer dikey çizgi:
 * ön seans ile asıl seans, eğrinin yarı tonundan başka bir yerde de okunuyor.
 */

type Rail = { domain: [number, number]; openAt: number; closeAt: number };

/** Kartın SVG ölçüsü — Sparkline'a ve `sparkFrame`e aynı sayılar gider. */
const SPARK = { height: 44, strokeWidth: 1.8 } as const;

export function IndexCard({
  href,
  label,
  proxy,
  quote,
  points,
  sparkOk,
  rail,
  selected,
  order,
  locale,
  t,
}: {
  href: string;
  label: string;
  proxy: string;
  quote: Quote | null;
  points: { time: number; value: number }[];
  /** Kotasyon bu seansa ait mi — değilse eğri ve gün aralığı HİÇ çizilmez. */
  sparkOk: boolean;
  rail: Rail;
  selected: boolean;
  /** Giriş kademesi — kartın sırası. */
  order: number;
  locale: Locale;
  t: Dictionary;
}) {
  const tone = directionOf(quote?.changePct);
  const toneText = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted";
  const drawSpark = Boolean(quote) && sparkOk && points.length > 1;
  const frame = drawSpark
    ? sparkFrame({ points, height: SPARK.height, strokeWidth: SPARK.strokeWidth, baseline: quote!.prevClose, domain: rail.domain })
    : null;
  const baseShare = frame?.anchored && quote?.prevClose != null ? frame.yShare(quote.prevClose) : null;
  /* Künye çizginin hangi yanında: fiyat kapanışın altındaysa üstte. Çizgi
     kutunun üst ya da alt beşte birindeyse künye içeride kalsın diye ters
     yana geçer (künyenin kendi boyu ~16 piksel, kutu 44–70). */
  const below = quote !== null && quote.prevClose !== null && quote.price >= quote.prevClose;
  const baseSide = baseShare === null ? null : baseShare < 0.24 ? "below" : baseShare > 0.76 ? "above" : below ? "below" : "above";
  const ticks = frame ? [frame.xShare(rail.openAt), frame.xShare(rail.closeAt)].filter((x): x is number => x !== null) : [];

  const range =
    drawSpark && quote!.low !== null && quote!.high !== null && quote!.high > quote!.low
      ? { low: quote!.low, high: quote!.high }
      : null;
  const at = (value: number) =>
    range ? Math.min(100, Math.max(0, ((value - range.low) / (range.high - range.low)) * 100)) : 0;
  const pricePos = range ? at(quote!.price) : 0;
  /* Kapanıştan fiyata uzanan dolgu: gün aralığında bugünkü hareketin
     kendisi. Kapanış aralığın dışındaysa (boşlukla açılış) dolgu kulvarın
     ucundan başlıyor. Renk yalnız işaretten. */
  const closePos = range && quote!.prevClose !== null ? at(quote!.prevClose) : null;

  return (
    <Link
      href={href}
      scroll={false}
      /* SEÇİLİ OLAN YALNIZCA RENKLE SÖYLENİYORDU. Kart seçildiğinde
         accent kenarlık ve tint alıyor ama ekran okuyucuya hiçbir şey
         ulaşmıyordu. Sektör çipleri (/sirketler) bunu zaten yapıyor. */
      aria-current={selected ? "true" : undefined}
      className={styles.indexLink}
      style={{ "--i": order } as CSSProperties}
    >
      <Panel className={cn("panel-hover", styles.indexCard)} data-tone={tone}>
        <div className={styles.identity}>
          <p className={styles.indexName}>{label}</p>
          <p className={styles.indexProxy}>
            <span className="numeral">{proxy}</span>
            <ArrowUpRight size={14} aria-hidden />
          </p>
        </div>
        {quote ? (
          <>
            <div className={styles.reading}>
              <p className={cn("numeral", styles.price)}>{formatPrice(quote.price, locale)}</p>
              <p data-tone={tone} className={cn(styles.indexChange, "numeral", toneText)}>
                <span className={styles.indexPct}>{formatPercent(quote.changePct, locale)}</span>
                {quote.change !== null && <span className={styles.indexDelta}>{formatChange(quote.change, locale)}</span>}
              </p>
            </div>
            {drawSpark && (
              <div className={styles.chart}>
                {ticks.map((x) => (
                  <i key={x} className={styles.sessionTick} style={{ left: `${(x * 100).toFixed(2)}%` }} aria-hidden />
                ))}
                <Sparkline
                  points={points}
                  title={`${label} · ${locale === "tr" ? "1G" : "1D"}`}
                  tone={tone}
                  height={SPARK.height}
                  showLastDot
                  strokeWidth={SPARK.strokeWidth}
                  baseline={quote.prevClose}
                  domain={rail.domain}
                  split={rail.openAt}
                  className={styles.spark}
                />
                {baseShare !== null && quote.prevClose !== null && (
                  <span
                    className={styles.baseLabel}
                    data-side={baseSide}
                    style={{ top: `${(baseShare * 100).toFixed(2)}%` }}
                  >
                    {t.markets.prevClose} <b className="numeral">{formatPrice(quote.prevClose, locale)}</b>
                  </span>
                )}
              </div>
            )}
            {/* GÜN ARALIĞI (17 Ekim): kıvılcım şekli söylüyor, aralık
                ölçüyü — günün dibi ve tepesi arasında fiyat nerede.
                Kıvılcımla aynı kural: sayı bu seansa ait değilse yok.
                18 Ekim: kulvarda önceki kapanışın çentiği ve ondan fiyata
                uzanan dolgu — eğrinin tabanıyla aynı referans. */}
            {range && (
              <div
                className={styles.dayRange}
                aria-label={`${t.markets.dayRange}: ${formatPrice(range.low, locale)} – ${formatPrice(range.high, locale)}`}
              >
                <span className="numeral">{formatPrice(range.low, locale)}</span>
                <i className={styles.rangeLane} aria-hidden>
                  {closePos !== null && (
                    <>
                      <span
                        className={styles.rangeFill}
                        data-tone={tone}
                        style={{ left: `${Math.min(closePos, pricePos)}%`, width: `${Math.abs(pricePos - closePos)}%` }}
                      />
                      <span className={styles.rangeClose} style={{ left: `${closePos}%` }} />
                    </>
                  )}
                  <span className={styles.rangeDot} data-tone={tone} style={{ left: `${pricePos}%` }} />
                </i>
                <span className="numeral">{formatPrice(range.high, locale)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs text-muted">{NO_VALUE}</p>
        )}
      </Panel>
    </Link>
  );
}
