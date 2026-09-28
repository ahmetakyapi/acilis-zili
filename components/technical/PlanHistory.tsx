import { verdictLabel, verdictOf, verdictPillClass } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  formatRange,
  groupPlanHistory,
  planHistoryScale,
  slotLabel,
  stanceChangeLabel,
  type PlanHistoryEntry,
} from "@/lib/technical";
import { cn, formatEtDateCompact, formatPrice, NO_VALUE } from "@/lib/utils";
import { changeToneClass } from "./TechnicalCard";
import styles from "./Technical.module.css";

/* Çok dar bir bölge (tek fiyat ya da ölçeğin binde biri) çizgide kaybolmasın. */
const MIN_ZONE_PCT = 1.5;

/**
 * Görüş geçmişi — yayın yayın plan.
 *
 * İKİ DEĞİŞİKLİK (29 Eylül, ölçüldü: NVDA 1440'ta 630, 390'da 1.165 piksel).
 * Birincisi art arda aynı kalan yayınlar tek satır (`groupPlanHistory`,
 * gerekçesi orada). İkincisi planın SEYRİ bir çizgi: her satırda alım
 * bölgesi ve stop, tablonun bütün seviyelerini kapsayan ORTAK bir ölçek
 * üstünde. Satırlar aşağı doğru okunduğunda bölgenin günden güne nasıl
 * yukarı taşındığı basamak basamak değil uzunlukla görülüyor ("karşılaştırılan
 * her büyüklük bir de çizgi olarak okunur"). Sayılar tabloda kalıyor, çizgi
 * `aria-hidden`: yeni bir bilgi değil, aynı sayıların geometrisi. Çizgi
 * yalnızca tablodaki sayılardan — canlı fiyat ya da hedef eklenmiyor, çünkü
 * bu tablo onları taşımıyor.
 */
export function PlanHistory({
  history,
  locale,
  t,
}: {
  history: readonly PlanHistoryEntry[];
  locale: Locale;
  t: Dictionary;
}) {
  const runs = groupPlanHistory(history);
  const scale = planHistoryScale(history);
  const pct = (value: number) => (scale ? ((value - scale.min) / (scale.max - scale.min)) * 100 : 0);

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={cn(styles.table, styles.historyTable)}>
          <thead>
            <tr>
              <th scope="col">{t.technical.historyDate}</th>
              <th scope="col">{t.technical.historyEdition}</th>
              <th scope="col">{t.technical.historyStance}</th>
              <th scope="col">{t.technical.entryZone}</th>
              <th scope="col">{t.technical.stop}</th>
              {scale && (
                <th scope="col" data-cell="track">
                  <span className={styles.historyScale}>
                    <span>{t.technical.historyPlan}</span>
                    <span className="numeral">
                      {formatPrice(scale.min, locale)} – {formatPrice(scale.max, locale, { currency: true })}
                    </span>
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {runs.map(({ entry, slots }, index) => {
              const stance = verdictOf(entry.stance);
              const older = runs[index + 1]?.entry;
              const turned = older ? stanceChangeLabel(stance, verdictOf(older.stance), t) : null;
              const first = slots[0] ?? entry.slot;
              const last = slots.at(-1) ?? entry.slot;
              const zone =
                entry.entryLow !== null && entry.entryHigh !== null
                  ? { low: entry.entryLow, high: entry.entryHigh }
                  : null;
              const zoneLeft = zone ? pct(Math.min(zone.low, zone.high)) : 0;
              const zoneWidth = zone ? Math.max(MIN_ZONE_PCT, pct(Math.max(zone.low, zone.high)) - zoneLeft) : 0;
              return (
                <tr key={`${entry.sessionDate}-${entry.slot}`}>
                  <td data-cell="date">{formatEtDateCompact(entry.sessionDate, locale)}</td>
                  <td data-cell="edition">
                    {slots.length > 1 ? (
                      /* Birleşen yayınlar: ilk ve son dilim, arada kaç yayın
                         olduğu künyede. Tarih sütunu aynı günü söylüyor. */
                      <>
                        {slotLabel(first, t)} – {slotLabel(last, t)}
                        <span className={styles.historyCount}>
                          {t.technical.historyRuns.replace("{n}", String(slots.length))}
                        </span>
                      </>
                    ) : (
                      slotLabel(entry.slot, t)
                    )}
                  </td>
                  <td data-cell="stance">
                    <span className={cn("inline-flex rounded-full px-2.5 py-[2px] text-tiny font-bold", verdictPillClass(stance))}>
                      {verdictLabel(stance, t)}
                    </span>
                    {turned && <span className={cn("ml-2 text-tiny font-bold", changeToneClass(stance))}>{turned}</span>}
                  </td>
                  <td className="numeral" data-cell="entry" data-label={t.technical.entryZone}>
                    {zone
                      ? formatRange(zone.low, zone.high, locale)
                      : NO_VALUE /* Değer yok işareti tek: uzun çizgi değil (lib/utils). */}
                  </td>
                  <td className="numeral" data-cell="stop" data-label={t.technical.stop}>
                    {formatPrice(entry.stop, locale, { currency: true })}
                  </td>
                  {scale && (
                    <td data-cell="track" aria-hidden>
                      <span className={styles.historyTrack} data-verdict={stance}>
                        {zone && <b style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }} />}
                        {entry.stop !== null && <i style={{ left: `${pct(entry.stop)}%` }} />}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {scale && <p className={styles.footHint}>{t.technical.historyNote}</p>}
    </>
  );
}
