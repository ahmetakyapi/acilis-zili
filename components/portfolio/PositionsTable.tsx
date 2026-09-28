"use client";

import { useEffect, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { formatIsoDate, formatLira, formatRate } from "@/lib/fx";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./Portfolio.module.css";
import { useWorkbench } from "./PortfolioWorkbench";
import type { ComposerPosition } from "./PositionComposer";

/**
 * POZİSYON TABLOSU — istemcide, çünkü satırlar artık yaşıyor: düzeltme
 * penceresini açıyor, silinince kayarak çıkıyor, eklenince kayarak girip
 * bir an vurgulanıyor. Sayıların hepsi SUNUCUDA hesaplanıp geliyor
 * (`loadPortfolio`); burada hiçbir hesap yok, yalnızca biçim.
 *
 * TABAN GENİŞLİK, `table-fixed` DEĞİL (CLAUDE.md "Kaydırma saklanmaz"): on
 * sayı sütunu dar ekranda kaba zorlanınca hücreler birbirinin üstüne
 * biniyor. Tablo kaydırılıyor; SEMBOL solda, EYLEM sağda yerinde kalıyor —
 * telefonda düzeltme düğmesi 960 piksellik tablonun sonunda değil, başparmağın
 * altında. Telefonda tek düğme (düzelt); silme düzeltme penceresinin içinde.
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
    value === null ? NO_VALUE : `${signed && value > 0 ? "+ " : ""}${formatPrice(value, locale, { currency: true })}`;
  const quantityText = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 8 });
  const visibleRows = rows.filter((row) => !hidden.has(row.id));

  return (
    <ScrollEdges
      className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
      tabIndex={0}
      role="region"
      aria-label={L.positionsTitle}
    >
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-line-soft text-left text-nano text-muted">
            <th scope="col" className="sticky left-0 z-10 bg-(--panel-fixed) px-4 py-2.5 font-medium sm:px-5">
              {L.symbol}
            </th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.weight}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.quantity}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.costUsd}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.price}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.value}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.pnlUsd}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.costTl}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.valueTl}</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.pnlTl}</th>
            {/* `relative` ŞART: `sr-only` mutlak konumlu ve konumlu bir ata
                bulamayınca kaydırma kabının DIŞINA yerleşip yatay taşma
                yapıyordu (390'da 449 piksel, ölçüldü). */}
            <th scope="col" className={cn("relative px-2 py-2.5", styles.actionsCell)}>
              <span className="sr-only">{L.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody className={cn("divide-y divide-line-soft", styles.rows)}>
          <AnimatePresence initial={false}>
            {visibleRows.map((row, i) => (
              <motion.tr
                key={row.id}
                className="align-top"
                data-fresh={fresh.has(row.id) || undefined}
                style={{ "--i": Math.min(i, STAGGER_CAP) } as CSSProperties}
                exit={{ opacity: 0, x: -16, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
              >
                <th scope="row" className="sticky left-0 z-10 bg-(--panel-fixed) px-4 py-3 text-left font-normal sm:px-5">
                  <span className="flex items-center gap-2.5">
                    <LogoTile symbol={row.symbol} logoUrl={row.logoUrl ?? null} size="md" />
                    <span className="flex min-w-0 flex-col">
                      <Link href={`/hisse/${row.symbol}`} className="numeral w-fit font-bold text-strong transition-colors hover:text-primary">
                        {row.symbol}
                      </Link>
                      <span className="numeral whitespace-nowrap text-nano text-muted">{formatIsoDate(row.boughtAt, locale)}</span>
                    </span>
                  </span>
                </th>
                {/* AĞIRLIK BİR BÜYÜKLÜK: sayı portföy içindeki pay, çubuk en
                    büyük pozisyona göre (CLAUDE.md "karşılaştırılan her
                    büyüklük bir de çizgi"). Fiyatı olmayanın ağırlığı yok. */}
                <td className="px-2.5 py-3 text-right">
                  {row.share === null ? (
                    NO_VALUE
                  ) : (
                    <span className={styles.weight}>
                      <span className="numeral font-semibold text-strong">{formatPercentPlain(row.share, locale, 1)}</span>
                      <span className={styles.weightBar} aria-hidden>
                        <span className={styles.weightFill} style={{ "--ratio": row.ratio } as CSSProperties} />
                      </span>
                    </span>
                  )}
                </td>
                <td className="numeral px-2.5 py-3 text-right">{quantityText.format(row.quantity)}</td>
                <td className="numeral px-2.5 py-3 text-right">{usd(row.costUsd)}</td>
                <td className="numeral px-2.5 py-3 text-right">
                  {row.price === null ? <span className="text-muted">{L.noQuote}</span> : usd(row.price)}
                </td>
                <td className="numeral px-2.5 py-3 text-right text-strong">{usd(row.valueUsd)}</td>
                <td className={cn("numeral px-2.5 py-3 text-right", directionText(directionOf(row.pnlUsd)))}>
                  {usd(row.pnlUsd, true)}
                  <span className="block text-nano">{formatPercent(row.pnlUsdPct, locale)}</span>
                </td>
                <td className="numeral px-2.5 py-3 text-right">
                  {formatLira(row.costTl, locale)}
                  {row.rate && (
                    <span className="block text-nano text-muted">
                      {L.rateAt
                        .replace("{date}", formatIsoDate(row.rate.bulletin, locale))
                        .replace("{rate}", formatRate(row.rate.rate, locale))}
                    </span>
                  )}
                </td>
                <td className="numeral px-2.5 py-3 text-right text-strong">{formatLira(row.valueTl, locale)}</td>
                <td className={cn("numeral px-2.5 py-3 text-right", directionText(directionOf(row.pnlTl)))}>
                  {formatLira(row.pnlTl, locale, 2, true)}
                  <span className="block text-nano">{formatPercent(row.pnlTlPct, locale)}</span>
                </td>
                <td className={cn("px-2 py-2", styles.actionsCell)}>
                  <span className={styles.rowActions}>
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
                  </span>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </ScrollEdges>
  );
}
