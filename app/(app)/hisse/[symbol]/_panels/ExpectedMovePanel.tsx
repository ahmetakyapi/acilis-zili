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
import styles from "./depth.module.css";
import craft from "./craft.module.css";

/** Okuma cümlesi için en az bu kadar ölçülmüş rapor; tek rapor bir sayım değil. */
const MIN_READOUT_MOVES = 2;
/** Geçmiş satırlarının kulvarında uç payı: en uzun çubuk kenara yapışmasın. */
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
 *
 * TEK ÖLÇEK, TEK FİGÜR (26 Kasım 2026, görsel tur — sahibinin sözü: "bu da
 * eksik hissettiriyor, daha güzel daha görsel olarak ele al"). İki okumanın
 * altında 200 piksellik kısa çubuklar vardı; geçmiş satırları ise BAŞKA bir
 * ölçekte (sıfır ortada, işaretli) çiziliyordu. Okur "±%9,8 ile %2,0" ve
 * "+%3,0 ile bant" kıyaslarını iki ayrı eksende yapıyordu, üst satırın sağ
 * yarısı boştu (NVDA, 1440: okuma çubuğu 200 piksel, panel 1280; sağdaki
 * okumanın sağında ~440 piksel zemin). Şimdi:
 *
 * - Üstte ÜÇ okuma: fiyatlanan bant, onun DOLAR karşılığı (taban fiyat ±
 *   straddle — `getExpectedMove`in zaten döndürdüğü spot ve straddle; yeni
 *   sayı yok) ve geçmiş ortalama. Okuma çubukları kalktı.
 * - Altta tek figür: ilk iki satır "Fiyatlanan" (bandın kendisi, koyu) ve
 *   "Ortalama" (±ortalama, dolu çubuk); ardından her rapor. Hepsi AYNI
 *   kulvarda, sıfır ortada — bant, ortalama ve gerçekleşen hareket tek
 *   bakışta aynı eksende.
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
  /* Okuma cümlesi: ölçülmüş raporların kaçı fiyatlanan bandın dışında. */
  const outside = implied ? measured.filter((row) => Math.abs(row.movePct!) > implied.pct).length : 0;
  /* Geçmiş satırlarının kulvarı: sıfır ortada, uçta pay. */
  const laneMax = Math.max(implied?.pct ?? 0, ...measured.map((row) => Math.abs(row.movePct!))) * LANE_PAD;
  const laneX = (value: number) => 50 + (value / laneMax) * 50;
  /* Fiyat karşılığı: straddle zaten dolar (orta fiyatların toplamı) ve
     yüzde onun spota oranı; bant spot ± straddle. */
  const range =
    implied && data.spot !== null && data.spot > 0
      ? { low: data.spot - implied.straddle, high: data.spot + implied.straddle }
      : null;
  const band = (pct: number) => ({ left: `${laneX(-pct)}%`, right: `${100 - laneX(pct)}%` });
  const timingLabel = (hour: string | null) =>
    hour === "bmo" ? t.earnings.beforeOpen : hour === "amc" ? t.earnings.afterClose : d.emTimingUnknown;

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={d.emTitle}
        meta={`${formatEtDateLong(next.date, locale)} · ${when.approx ?? when.window}`}
      />
      <div className={styles.body}>
        {/* NOKTALI FİGÜR KALKTI (10 Kasım 2026). Ölçülerin üstünde "Bant ve
            Geçmiş Raporlar" figürü vardı (12 Ekim, `ExpectedMoveFigure`):
            gri bandın üstünde rapor başına 11 piksellik bir nokta, üstünde
            yüzde etiketi, altında "±%10,0". Sahibinin itirazı (aynı gün,
            Temalar panosundaki çentikler için; "başka ekran varsa onları
            da yapalım"): "böyle nokta nokta ne anlatıyor anlamıyorum;
            yatayda uzun kalın çizgi seviyorum." Aynı bilgi aşağıdaki
            satırlarda zaten AYNI eksende ve çubukla duruyor (her rapor bir
            satır: bant gri şerit, hareket renkli çubuk); figür onu nokta
            diliyle bir kez daha söylüyordu. Kalan iki şey satırların
            başına taşındı: çizimin okunuşu ve "kaç rapor bandı aştı"
            cümlesi. Canlıda ölçüldü (NVDA, 1440, iki rapor): figür bloğu
            ~165 piksel tutuyordu; yerine 20 piksellik tek satır. */}
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
          {/* FİYAT KARŞILIĞI (26 Kasım 2026): yüzdenin doların diliyle okunuşu —
              "hisse rapor ertesinde nereye kadar gidebilir" sorusunun piyasanın
              fiyatladığı cevabı. Bant yoksa okuma da yok (yer ayrılmıyor). */}
          {range && implied && data.spot !== null && (
            <div className={cn(styles.reading, styles.emRangeReading)}>
              <dt>{d.emRange}</dt>
              <dd className={cn("numeral", styles.readingValue, styles.emRangeValue)}>
                {formatPrice(range.low, locale)}
                {" – "}
                <span className="whitespace-nowrap">{formatPrice(range.high, locale, { currency: true })}</span>
              </dd>
              <dd className={cn("numeral", styles.readingMeta)}>
                {d.emRangeMeta
                  .replace("{spot}", formatPrice(data.spot, locale, { currency: true }))
                  .replace("{move}", formatPrice(implied.straddle, locale, { currency: true }))}
              </dd>
            </div>
          )}
          <div className={styles.reading}>
            <dt>{d.emAverage}</dt>
            {data.average ? (
              <>
                <dd className={cn("numeral", styles.readingValue)}>{formatPercentPlain(data.average.avg, locale, 1)}</dd>
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
            <p className="border-t border-line-soft pt-3 text-tiny font-semibold text-strong">{d.emFigTitle}</p>
            {implied && (
              <p className={styles.emReadout}>
                {measured.length >= MIN_READOUT_MOVES && (
                  <>
                    <b>
                      {(outside === 0 ? d.emFigReadoutNone : d.emFigReadout)
                        .replace("{n}", String(measured.length))
                        .replace("{k}", String(outside))}
                    </b>{" "}
                  </>
                )}
                {d.emFigHint.replace("{band}", formatPercentPlain(implied.pct, locale, 1))}
              </p>
            )}
            <ScrollEdges className="scroll-x" tabIndex={0} role="region" aria-label={d.emHistory}>
              <table className={cn(styles.table, styles.historyTable, styles.emTable, craft.emWide)}>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{`${d.emColReport} · ${d.emColTiming}`}</th>
                    <td />
                    <th scope="col">{d.emColMove}</th>
                  </tr>
                </thead>
                {/* ÖLÇÜNÜN İKİ SATIRI raporlarla AYNI kulvarda (26 Kasım 2026):
                    "Fiyatlanan" bandın kendisi (raporların arkasındaki gri
                    şeridin koyusu — lejant işini de görüyor), "Ortalama"
                    ±ortalama mutlak hareket, iki yöne dolu çubuk. */}
                {(implied || data.average) && (
                  <tbody className={craft.emSummary}>
                    {implied && (
                      <tr>
                        <th scope="row">
                          <span className="block font-semibold text-strong">{d.emRowBand}</span>
                          <span className="block text-tiny font-normal text-muted">{d.emRowBandSub}</span>
                        </th>
                        <td className={craft.emLaneCell} aria-hidden>
                          {laneMax > 0 && (
                            <span className={craft.emLane}>
                              <i className={cn("value-lane", craft.emLaneTrack)} />
                              <i className={cn(craft.emLaneBand, craft.emLaneBandStrong)} style={band(implied.pct)} />
                              <i className={craft.emLaneZero} />
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="numeral font-semibold text-strong">±{formatPercentPlain(implied.pct, locale, 1)}</span>
                        </td>
                      </tr>
                    )}
                    {data.average && (
                      <tr>
                        <th scope="row">
                          <span className="block font-semibold text-strong">{d.emRowAverage}</span>
                          <span className="block text-tiny font-normal text-muted">
                            {d.emAverageCount.replace("{n}", String(data.average.count))}
                          </span>
                        </th>
                        <td className={craft.emLaneCell} aria-hidden>
                          {laneMax > 0 && (
                            <span className={craft.emLane}>
                              <i className={cn("value-lane", craft.emLaneTrack)} />
                              {implied && <i className={craft.emLaneBand} style={band(implied.pct)} />}
                              <i className={craft.emLaneZero} />
                              {/* İki yöne: ortalama MUTLAK hareket, işaretsiz. Sıfırdan
                                  iki yana açılır (kaynak ortada). */}
                              <i
                                className="value-bar"
                                data-motion-draw="line"
                                style={{ ...band(data.average.avg), transformOrigin: "center" }}
                              />
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="numeral font-semibold text-strong">{formatPercentPlain(data.average.avg, locale, 1)}</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                )}
                <tbody>
                  <tr className={craft.emDivider}>
                    <th scope="colgroup" colSpan={3}>
                      {d.emHistory}
                    </th>
                  </tr>
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
                          alıyor: sıfır ortada, gri
                          şerit opsiyonların fiyatladığı bant, renkli çubuk o
                          raporun hareketi. Bandı aşan rapor şeridin dışına
                          taşan çubukla okunuyor. Çubuk 8 piksel (kulvar 5):
                          kalın yatay şerit kuralı, dış ucu yuvarlak. Çizim
                          `aria-hidden`; sayı yanındaki hücrede. */}
                      <td className={craft.emLaneCell} aria-hidden>
                        {row.movePct !== null && laneMax > 0 && (
                          <span className={craft.emLane}>
                            <i className={cn("value-lane", craft.emLaneTrack)} />
                            {implied && (
                              <i
                                className={craft.emLaneBand}
                                style={{ left: `${laneX(-implied.pct)}%`, right: `${100 - laneX(implied.pct)}%` }}
                              />
                            )}
                            <i className={craft.emLaneZero} />
                            <i
                              className="value-bar"
                              data-tone={row.movePct < 0 ? "down" : "up"}
                              data-end={row.movePct < 0 ? "start" : "end"}
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
