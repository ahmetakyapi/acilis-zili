import { DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScaleBar } from "@/components/markets/CompareScale";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { getHolidays, getStatus } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { normalizeTiming, MIN_MOVES_FOR_AVERAGE } from "@/lib/expected-move";
import { getExpectedMove } from "@/lib/expected-move-data";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatEtDateLong,
  formatEtDateMedium,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import { earningsWindow } from "./earnings-time";
import styles from "./depth.module.css";

/**
 * Beklenen hareket — sonraki rapor yakınsa (sayfa karar veriyor:
 * `EXPECTED_MOVE_HORIZON_DAYS`). Hesaplar ve eşikler lib/expected-move.ts.
 *
 * İKİ SAYI YAN YANA ve aynı ölçekte çizgi olarak: opsiyonların fiyatladığı
 * ile geçmiş raporların ortalaması. İkisi ayrı sorulara cevap (piyasa ne
 * bekliyor / şirket geçmişte ne yaptı) ama okuyucu onları zaten
 * karşılaştıracak; çubuk bunu basamak saydırmadan yapıyor (CLAUDE.md
 * "Karşılaştırılan her büyüklük bir de çizgi olarak okunur").
 */
export async function ExpectedMovePanel({
  symbol,
  next,
  locale,
  t,
}: {
  symbol: string;
  next: { date: string; hour: string | null };
  locale: Locale;
  t: Dictionary;
}) {
  const d = t.stockDepth;
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  const data = await getExpectedMove(symbol, { date: next.date, timing: normalizeTiming(next.hour) }, status);
  const when = earningsWindow(next.date, next.hour, holidays, locale, t);

  const implied = data.implied?.ok ? data.implied : null;
  const reason = data.implied === null ? "no-quotes" : data.implied.ok ? null : data.implied.reason;
  const measured = data.history.filter((row) => row.movePct !== null);
  /* Satırlarda eksi bir hareket varsa ölçek işaretli (sıfır ortada);
     CompareScale'ın kuralı. Üstteki iki okuma mutlak büyüklük, işaretsiz. */
  const anyDown = measured.some((row) => row.movePct! < 0);
  const scaleMax = Math.max(implied?.pct ?? 0, data.average?.avg ?? 0, ...measured.map((row) => Math.abs(row.movePct!)));
  const timingLabel = (hour: string | null) =>
    hour === "bmo" ? t.earnings.beforeOpen : hour === "amc" ? t.earnings.afterClose : d.emTimingUnknown;

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={d.emTitle}
        meta={`${formatEtDateLong(next.date, locale)} · ${when.approx ?? when.window}`}
      />
      <div className={styles.body}>
        {/* KOMPAKT (30 Eylül, sahibinin isteği). Telefonda panel 1.220
            piksel tutuyordu: iki okuma alt alta, "Gösterge Fiyat" kendi
            satırında, tek raporluk geçmiş için başlık satırlı bir tablo ve
            iki uzun yöntem paragrafı. Okumalar her genişlikte yan yana,
            gösterge rozeti etiketin yanında, geçmiş satırları başlıksız
            (başlıklar ekran okuyucuya duruyor), yöntem "Nasıl Hesaplanıyor"
            katlamasında. Hiçbir bilgi kalkmadı. */}
        <dl className={cn(styles.readings, styles.emReadings)}>
          <div className={styles.reading}>
            <dt>{d.emImplied}</dt>
            {implied ? (
              <>
                {/* Gösterge rozeti sayının YANINDA: türetilmiş besleme (OPRA
                    değil) sayıya yapışık kalıyor, ayrı satır tutmuyor. Etiketin
                    yanına konduğunda 390'daki yarım sütunda kendi satırına
                    kırılıyordu (ölçüldü). */}
                <dd className={styles.emValueLine}>
                  <span className={cn("numeral", styles.readingValue)}>±{formatPercentPlain(implied.pct, locale, 1)}</span>
                  <span className={styles.emBadge}>{d.emIndicative}</span>
                </dd>
                {scaleMax > 0 && <ReadingBar ratio={implied.pct / scaleMax} />}
                <dd className={cn("numeral", styles.readingMeta)}>
                  {d.emImpliedDetail
                    .replace("{expiry}", formatEtDateCompact(implied.expiry, locale))
                    .replace("{strike}", formatPrice(implied.strike, locale, { currency: true }))
                    .replace("{straddle}", formatPrice(implied.straddle, locale, { currency: true }))}
                </dd>
              </>
            ) : (
              <dd className="text-small leading-relaxed text-muted">{d.emReason[reason ?? "no-quotes"]}</dd>
            )}
          </div>
          <div className={styles.reading}>
            <dt>{d.emAverage}</dt>
            {data.average ? (
              <>
                <dd className={cn("numeral", styles.readingValue)}>{formatPercentPlain(data.average.avg, locale, 1)}</dd>
                {scaleMax > 0 && <ReadingBar ratio={data.average.avg / scaleMax} />}
                <dd className={cn("numeral", styles.readingMeta)}>{d.emAverageCount.replace("{n}", String(data.average.count))}</dd>
              </>
            ) : (
              <dd className="text-small leading-relaxed text-muted">
                {data.history.length === 0
                  ? d.emHistoryEmpty
                  : d.emAverageTooFew.replace("{n}", String(MIN_MOVES_FOR_AVERAGE))}
              </dd>
            )}
          </div>
        </dl>

        {data.history.length > 0 && (
          <>
            <p className="border-t border-line-soft pt-3 text-tiny font-semibold text-strong">{d.emHistory}</p>
            <ScrollEdges className="scroll-x" tabIndex={0} role="region" aria-label={d.emHistory}>
              <table className={cn(styles.table, styles.historyTable, styles.emTable)}>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{`${d.emColReport} · ${d.emColTiming}`}</th>
                    <th scope="col">{d.emColMove}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((row) => (
                    <tr key={row.date}>
                      {/* Zaman tarihin altında: iki kısa bilgi tek hücrede,
                          satır ikiye değil tek hatta okunuyor. */}
                      <td>
                        <span className="numeral block font-semibold text-strong">{formatEtDateMedium(row.date, locale)}</span>
                        <span className="block text-tiny text-muted">{timingLabel(row.timing)}</span>
                      </td>
                      <td>
                        {row.movePct !== null ? (
                          <span className="inline-flex flex-col items-end gap-1">
                            <span className={cn("numeral font-semibold", directionText(directionOf(row.movePct)))}>
                              {formatPercent(row.movePct, locale, 1)}
                            </span>
                            {scaleMax > 0 && (
                              <span aria-hidden className="block w-20">
                                <ScaleBar ratio={row.movePct / scaleMax} signed={anyDown} tone="signal" />
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted">
                            {row.reason === "timing-unknown" ? d.emTimingUnknown : d.emBarsMissing} {NO_VALUE}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollEdges>
          </>
        )}

        <details className={styles.how}>
          <summary>{d.emHowTitle}</summary>
          <p>{d.emImpliedNote}</p>
          {data.history.length > 0 && <p>{d.emHistoryNote}</p>}
        </details>
        {implied && data.optionsFetchedAt ? (
          <DataStamp
            labels={t.data}
            source="alpaca"
            at={data.optionsFetchedAt}
            locale={locale}
            note={d.emIndicative}
            className={styles.stamp}
          />
        ) : (
          data.barsFetchedAt && (
            <DataStamp labels={t.data} source="alpaca" at={data.barsFetchedAt} locale={locale} className={styles.stamp} />
          )
        )}
      </div>
    </Panel>
  );
}

/**
 * Okumanın altındaki çizgi — sayı sola yaslı olduğu için çubuk da soldan
 * doluyor (`ScaleBar` sağa yaslı sütunlar için, tablo satırında kalıyor).
 * İki okumanın tavanı aynı: ikisinin ve geçmiş satırların en büyüğü.
 */
function ReadingBar({ ratio }: { ratio: number }) {
  return (
    <dd aria-hidden className={styles.readingTrack}>
      <i style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </dd>
  );
}
