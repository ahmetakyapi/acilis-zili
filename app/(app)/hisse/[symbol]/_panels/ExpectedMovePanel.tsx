import { DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
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
import { ExpectedMoveFigure } from "./ExpectedMoveFigure";
import styles from "./depth.module.css";
import craft from "./craft.module.css";

/** Figür için en az bu kadar ölçülmüş rapor; tek nokta bir dağılım değil. */
const MIN_FIG_MOVES = 2;
/** Geçmiş satırlarının kulvarında uç payı: figürün `SCALE_PAD`i ile aynı. */
const LANE_PAD = 1.15;

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
  /* Figürün noktaları tarih sırasıyla, eskiden yeniye (kademe o sırada). */
  const figMoves = measured
    .flatMap((row) => (row.movePct === null ? [] : [{ date: row.date, pct: row.movePct }]))
    .sort((a, b) => a.date.localeCompare(b.date));
  /* Geçmiş satırlarının kulvarı: figürün ekseni (sıfır ortada, uçta pay). */
  const laneMax = Math.max(implied?.pct ?? 0, ...measured.map((row) => Math.abs(row.movePct!))) * LANE_PAD;
  const laneX = (value: number) => 50 + (value / laneMax) * 50;
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
        {/* Ana görsel ölçülerin ÜSTÜNDE (CLAUDE.md "Ekran düzeni" 3 → 4):
            bant ile geçmiş hareketler aynı eksende. İki ölçülmüş rapordan
            azsa figür bir şey göstermiyor, basılmıyor. */}
        {implied && measured.length >= MIN_FIG_MOVES && (
          <ExpectedMoveFigure
            band={implied.pct}
            moves={figMoves}
            locale={locale}
            d={d}
          />
        )}
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
              <table className={cn(styles.table, styles.historyTable, styles.emTable, craft.emWide)}>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{`${d.emColReport} · ${d.emColTiming}`}</th>
                    <td />
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
                      {/* KULVAR SATIRIN TAMAMINDA (10 Kasım 2026). Tablo 640
                          pikselde bitiyor, 1440'ta panelin sağ 650 pikseli
                          boş kalıyordu; hareket de 80 piksellik bir çubuktu.
                          Kulvar artık tarih ile yüzde arasındaki bütün yeri
                          alıyor ve figürle AYNI eksende: sıfır ortada, gri
                          şerit opsiyonların fiyatladığı bant, renkli çubuk o
                          raporun hareketi. Bandı aşan rapor şeridin dışına
                          taşan çubukla okunuyor. Çizim `aria-hidden`; sayı
                          yanındaki hücrede. */}
                      <td className={craft.emLaneCell} aria-hidden>
                        {row.movePct !== null && laneMax > 0 && (
                          <span className={craft.emLane}>
                            {implied && (
                              <i
                                className={craft.emLaneBand}
                                style={{ left: `${laneX(-implied.pct)}%`, right: `${100 - laneX(implied.pct)}%` }}
                              />
                            )}
                            <i className={craft.emLaneZero} />
                            <i
                              className={craft.emLaneBar}
                              data-dir={row.movePct < 0 ? "down" : "up"}
                              data-motion-draw="line"
                              style={{
                                left: `${Math.min(50, laneX(row.movePct))}%`,
                                width: `${Math.abs(laneX(row.movePct) - 50)}%`,
                                transformOrigin: row.movePct < 0 ? "right center" : "left center",
                              }}
                            />
                          </span>
                        )}
                      </td>
                      <td>
                        {row.movePct !== null ? (
                          <span className={cn("numeral font-semibold", directionText(directionOf(row.movePct)))}>
                            {formatPercent(row.movePct, locale, 1)}
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
 * doluyor (geçmiş satırlarının kulvarı işaretli ve kendi ekseninde).
 * İki okumanın tavanı aynı: ikisinin ve geçmiş satırların en büyüğü.
 */
function ReadingBar({ ratio }: { ratio: number }) {
  return (
    <dd aria-hidden className={styles.readingTrack}>
      {/* Şerit görünüme girince soldan dolar (ortak sözleşme, `line`). */}
      <i data-motion-draw="line" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </dd>
  );
}
