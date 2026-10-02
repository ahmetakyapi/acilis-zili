"use client";

import { useEffect, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { formatIsoDate, formatLira } from "@/lib/fx";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./Portfolio.module.css";
import { useWorkbench } from "./PortfolioWorkbench";
import type { ComposerPosition } from "./PositionComposer";

/**
 * POZİSYON LİSTESİ — istemcide, çünkü satırlar yaşıyor: düzeltme penceresini
 * açıyor, silinince kayarak çıkıyor, eklenince kayarak girip bir an
 * vurgulanıyor. Sayıların hepsi SUNUCUDA hesaplanıp geliyor
 * (`loadPortfolio`); burada hiçbir hesap yok, yalnızca biçim.
 *
 * TABLO DEĞİL, LİSTE (2 Ekim). On sütunlu bir tablo telefonda 980 piksel
 * tabanla kayıyordu ve ilk ekranda yalnızca sembol, ağırlık ve adet
 * görünüyordu — okuyucunun asıl sorusu (ne kadar kazandım) sağa kaydırmanın
 * sonundaydı. Sahibi "kabul edilemez" dedi ve haklıydı. Satır artık beş
 * soru: hangi hisse, ne kadar ağır, ne ediyor, dolarda ne getirdi, lirada ne
 * getirdi. İkincil sayılar (adet, maliyet, fiyat, alış kuru, kurun katkısı)
 * alt satırda düz bir künye.
 *
 * TEK DÜZEN, İKİ GENİŞLİK. Aynı satır telefonda kart (sembol ve değer üstte,
 * ağırlık çubuğu, iki getiri kutusu yan yana, künye), 900 pikselden itibaren
 * hizalı bir satır: her satır aynı `grid-template-columns`u taşıyor, başlık
 * satırı da — sütunlar tablo olmadan hizalı. Kaydırma yok, saklanan da yok.
 */

export type PositionRow = ComposerPosition & {
  price: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlUsdPct: number | null;
  costTl: number | null;
  valueTl: number | null;
  pnlTl: number | null;
  pnlTlPct: number | null;
  /** Portföy içindeki pay, yüzde. */
  share: number | null;
  /** En büyük pozisyona oran — ağırlık çubuğu. */
  ratio: number;
  rate: { rate: number; bulletin: string } | null;
  /** Lira K/Z'nin kurdan gelen kısmı: lira K/Z − dolar K/Z × bugünün kuru. */
  fxTl: number | null;
};

/** Giriş kademesi: bundan sonraki satırlar aynı anda girer. */
const STAGGER_CAP = 12;

export function PositionsTable({ rows }: { rows: PositionRow[] }) {
  const { labels: L, locale, hidden, fresh, openEdit, remove, setExisting } = useWorkbench();

  /* SÖKÜLÜNCE BOŞALT (28 Eylül denetimi). Liste yalnızca tablo varken
     yazılıyordu; portföy boşalınca (içe aktarmayı "Geri Al", son satırı
     silmek) tablo sökülüyor ve içe aktarma SON listeyle çalışıyordu: aynı
     ekstre yeniden yüklendiğinde her lot "Zaten Ekli" görünüyor, tavan
     hesabı da eski sayıyla yapılıyordu. */
  useEffect(() => {
    setExisting(rows.map((row) => ({ symbol: row.symbol, quantity: row.quantity, costUsd: row.costUsd, boughtAt: row.boughtAt })));
    return () => setExisting([]);
  }, [rows, setExisting]);

  const usd = (value: number | null, signed = false) =>
    value === null ? NO_VALUE : `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true })}`;
  const quantityText = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 8 });
  const visibleRows = rows.filter((row) => !hidden.has(row.id));

  return (
    <div className={styles.posList}>
      {/* Başlık yalnızca geniş ekranda: telefonda her kutu kendi etiketini
          taşıyor. Satırlarla aynı sütun şablonu. */}
      <div className={styles.posHead} aria-hidden>
        <span>{L.symbol}</span>
        <span>{L.weight}</span>
        <span>{L.value}</span>
        <span>{L.usdReturn}</span>
        <span>{L.tlReturn}</span>
        <span />
      </div>
      <ul className={styles.rows} aria-label={L.positionsTitle}>
        <AnimatePresence initial={false}>
          {visibleRows.map((row, i) => (
            <motion.li
              key={row.id}
              data-pos-row
              className={styles.posRow}
              data-fresh={fresh.has(row.id) || undefined}
              style={{ "--i": Math.min(i, STAGGER_CAP) } as CSSProperties}
              exit={{ opacity: 0, x: -16, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
            >
              <div data-col="sym" className={styles.posSym}>
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl ?? null} size="md" />
                <span className="flex min-w-0 flex-col">
                  <Link href={`/hisse/${row.symbol}`} className="numeral w-fit font-bold text-strong transition-colors hover:text-primary">
                    {row.symbol}
                  </Link>
                  <span className="numeral truncate text-nano text-muted">
                    {row.name ?? formatIsoDate(row.boughtAt, locale)}
                  </span>
                </span>
              </div>

              {/* AĞIRLIK BİR BÜYÜKLÜK: sayı portföy içindeki pay, çubuk en
                  büyük pozisyona göre (CLAUDE.md "karşılaştırılan her
                  büyüklük bir de çizgi"). Fiyatı olmayanın ağırlığı yok. */}
              <div data-col="weight" className={styles.posWeight}>
                <span className={styles.posMobileLabel}>{L.weight}</span>
                <span className="numeral font-semibold text-strong">
                  {row.share === null ? NO_VALUE : formatPercentPlain(row.share, locale, 1)}
                </span>
                <span className={styles.weightBar} aria-hidden>
                  <span className={styles.weightFill} style={{ "--ratio": row.ratio } as CSSProperties} />
                </span>
              </div>

              <div data-col="value" className={styles.posValue}>
                <span className="numeral font-semibold text-strong">
                  {row.price === null ? <span className="text-muted">{L.noQuote}</span> : usd(row.valueUsd)}
                </span>
                <span className="numeral text-nano text-muted">{formatLira(row.valueTl, locale)}</span>
              </div>

              <div data-col="usd" className={styles.posReturn} data-tone={directionOf(row.pnlUsd)}>
                <span className={styles.posMobileLabel}>{L.usdReturn}</span>
                <span className={cn("numeral", styles.posReturnValue, directionText(directionOf(row.pnlUsd)))}>
                  {usd(row.pnlUsd, true)}
                </span>
                <span className={cn("numeral", styles.posReturnPct, directionText(directionOf(row.pnlUsd)))}>
                  {formatPercent(row.pnlUsdPct, locale)}
                </span>
              </div>

              <div data-col="tl" className={styles.posReturn} data-tone={directionOf(row.pnlTl)}>
                <span className={styles.posMobileLabel}>{L.tlReturn}</span>
                <span className={cn("numeral", styles.posReturnValue, directionText(directionOf(row.pnlTl)))}>
                  {formatLira(row.pnlTl, locale, 2, true)}
                </span>
                <span className={cn("numeral", styles.posReturnPct, directionText(directionOf(row.pnlTl)))}>
                  {formatPercent(row.pnlTlPct, locale)}
                </span>
              </div>

              <div data-col="act" className={styles.rowActions}>
                <button
                  type="button"
                  aria-label={L.editAria.replace("{symbol}", row.symbol)}
                  className={styles.rowAction}
                  onClick={() => openEdit(row)}
                >
                  <PencilSimple size={16} weight="duotone" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={L.removeAria.replace("{symbol}", row.symbol)}
                  className={cn(styles.rowAction, styles.rowActionDanger)}
                  onClick={() => remove(row)}
                >
                  <Trash size={16} weight="duotone" aria-hidden />
                </button>
              </div>

              {/* Künye: ikincil sayılar, her biri kendi kutusunda kırılmadan. */}
              <p data-col="detail" className={cn("numeral", styles.posDetail)}>
                <span>{L.quantityUnit.replace("{n}", quantityText.format(row.quantity))}</span>
                <span>
                  {L.costShort} <b>{usd(row.costUsd)}</b>
                </span>
                {row.price !== null && (
                  <span>
                    {L.price} <b>{usd(row.price)}</b>
                  </span>
                )}
                <span>
                  {L.buyRateShort}{" "}
                  <b>{row.rate ? `${formatPrice(row.rate.rate, locale, { digits: 2 })} ₺` : NO_VALUE}</b> · {formatIsoDate(row.boughtAt, locale)}
                </span>
                {row.fxTl !== null && (
                  <span>
                    {L.fxPart} <b className={directionText(directionOf(row.fxTl))}>{formatLira(row.fxTl, locale, 2, true)}</b>
                  </span>
                )}
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
