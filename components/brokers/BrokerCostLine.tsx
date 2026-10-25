"use client";

import { setAmountIndex, useAmountIndex } from "./broker-view-state";
import { motion } from "motion/react";
import type { CostLine } from "@/lib/broker-line";
import { pctDigits } from "@/lib/broker-cards";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import { EASE_BRAND_POINTS } from "@/lib/motion";
import styles from "./BrokerCostLine.module.css";

/**
 * ALIMINA GÖRE KOMİSYON — kaydırıcı ve tek ölçekli maliyet çizgisi
 * (25 Ekim). Hesap sunucuda (`costLine`, lib/broker-line.ts): her durak
 * için kurumların komisyonu hazır geliyor, kaydırıcı yalnız seçiyor —
 * tarife verisinin tamamı istemciye inmiyor.
 *
 * ÇİZGİ BİR YARGI DEĞİL, BÜYÜKLÜK (CLAUDE.md, CompareScale): her satır
 * ortak bir ölçekte (sıfırdan bu tutardaki en yüksek komisyona) bir nokta;
 * renk nötr, en ucuz vurgulanmıyor. Sıra yalnız komisyona göre ve bu
 * künyede açıkça yazıyor ("önermez" ilkesi, BrokerNotes → tarafsızlık).
 *
 * TUTAR PAYLAŞILIYOR (25 Ekim kart turu): kaydırıcının durağı
 * `broker-view-state.ts`teki depoda; tepedeki cümle ve kartlar aynı değeri
 * okuyor. Eskiden burada duran "{min} ile {max} arasında" cümlesi sayfanın
 * tepesine çıktı (BrokerLead) — aynı cümle iki yerde durmasın.
 *
 * HAREKET: tutar değişince satırlar yeni sıralarına KAYIYOR (`layout`),
 * noktalar yeni yerlerine `--ease-brand` ile gidiyor. Hareketi azaltan
 * okuyucuda kabuğun MotionConfig'i yerleşimi kapatıyor, CSS geçişi de
 * modülde kapalı.
 */

const ROW_MOTION = { type: "tween", duration: 0.42, ease: EASE_BRAND_POINTS } as const;

export type BrokerLineLabels = {
  amountLabel: string;
  amountValue: string;
  unpricedTitle: string;
  unpricedFallback: string;
  ofTrade: string;
  rowLabel: string;
  chartLabel: string;
};

export function BrokerCostLine({
  lines,
  locale,
  labels,
}: {
  /** Kaydırıcının her durağı için hazır çizgi. */
  lines: CostLine[];
  locale: "tr" | "en";
  labels: BrokerLineLabels;
}) {
  const index = useAmountIndex();
  const line = lines[index];
  const usd = (value: number, digits = 2) => formatPrice(value, locale, { currency: true, digits });
  const amount = usd(line.amount, 0);
  const max = line.max ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className={styles.control}>
        <label htmlFor="broker-amount" className={styles.amountLabel}>
          {labels.amountLabel}
        </label>
        <output htmlFor="broker-amount" className={cn("numeral", styles.amountValue)}>
          {amount}
        </output>
        <input
          id="broker-amount"
          type="range"
          min={0}
          max={lines.length - 1}
          step={1}
          value={index}
          onChange={(event) => setAmountIndex(Number(event.target.value))}
          aria-valuetext={labels.amountValue.replace("{amount}", amount)}
          className={styles.slider}
        />
        <span aria-hidden className={cn("numeral", styles.scaleEnds)}>
          <span>{usd(lines[0].amount, 0)}</span>
          <span>{usd(lines[lines.length - 1].amount, 0)}</span>
        </span>
      </div>

      <ol className={styles.lanes} aria-label={labels.chartLabel}>
        {line.priced.map((entry) => {
          const ratio = max > 0 ? entry.fee / max : 0;
          const pct = formatPercentPlain(entry.pct, locale, pctDigits(entry.pct));
          return (
            <motion.li
              key={entry.id}
              layout="position"
              transition={ROW_MOTION}
              className={styles.lane}
            >
              <span className="sr-only">
                {labels.rowLabel.replace("{name}", entry.name).replace("{fee}", usd(entry.fee)).replace("{pct}", pct)}
              </span>
              <span className={cn("numeral", styles.rank)} aria-hidden>
                {entry.rank}
              </span>
              <span className={styles.name} aria-hidden>
                {entry.name}
              </span>
              <span className={styles.track} aria-hidden style={{ "--x": ratio } as React.CSSProperties}>
                <span className={styles.fill} />
                <span className={styles.dotRail}>
                  <span className={styles.dot} />
                </span>
              </span>
              <span className={styles.value} aria-hidden>
                <b className="numeral">{usd(entry.fee)}</b>
                <small className="numeral">{labels.ofTrade.replace("{pct}", pct)}</small>
              </span>
            </motion.li>
          );
        })}
      </ol>

      {line.unpriced.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-tiny font-semibold text-muted">{labels.unpricedTitle}</h3>
          <ul className="flex flex-col gap-1">
            {line.unpriced.map((entry) => (
              <li key={entry.id} className="text-small leading-snug text-body">
                <b className="font-semibold text-strong">{entry.name}.</b>{" "}
                {entry.reason ? entry.reason[locale] : labels.unpricedFallback}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
