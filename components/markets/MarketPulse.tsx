import styles from "./MarketExperience.module.css";
import { getSeries } from "@/lib/providers/fred";
import type { Dictionary, Locale } from "@/lib/i18n";
import { VIX_SERIES, vixBand } from "@/lib/vix";
import { formatEtDateCompact, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";

const YIELD_SERIES = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin", labelKey: "yieldY5" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin", labelKey: "yieldY30" },
] as const;

/** Bu farkın altındaki oynama "Değişmedi" sayılıyor (FRED iki ondalık yayımlar). */
const FLAT_DELTA = 0.001;

/**
 * Faiz ve oynaklık — piyasalar kapağının sol kolonunda kompakt bir ızgara.
 *
 * İKİ YER DENENDİ, İKİSİ DE GERİ ALINDI. Tahvil şeridi ve korku kadranı önce
 * endeks kartlarıyla sekme çubuğunun ARASINDAYDI: ekranın konusu
 * ("endeksler") ikiye bölünüyordu (ec4db48). Sonra bileşen tablosunun
 * altına indiler ve orada iki ayrı panel olarak 1440'ta 150, 390'da ~400
 * piksel tutuyorlardı — sayfanın en dibinde, 60 satırlık tablonun ardında
 * (sahibi: "çok kaplamayacak şekilde nerede durabilir", 23 Eylül).
 *
 * Kapak doğru yer: alt başlığı zaten "Endeksler, tahvil faizleri ve gün içi
 * hareket" diyor, yani tahvil kapağın vaadi. Izgara kapak çerçevesinin
 * İÇİNDE, dibinde tek satır: endeks akışını (kartlar → sekmeler → genişlik
 * → hareket edenler → bileşenler) bölmüyor. Telefonda ekran düzeni kuralı
 * gereği ana görselden (endeks kartları) sonra geliyor.
 *
 * Önce sol kolona, başlığın altına kondu ve ölçüldü: sol kolon kartlardan
 * uzun kalınca kapak 1440'ta 218'den 381 piksele çıkıyordu. Kapağın dibinde
 * iki kolonu kaplayan tek satır olarak ~90 piksel ekliyor; alttan kalkan iki
 * panel ~175 piksel tutuyordu.
 *
 * Eski iki panelin olguları yerinde: dört vade ve değişimleri, eğri farkı
 * ve yorumu, VIX seviyesi, bandı ve değişimi, gözlem tarihleri. Düşen iki
 * şey var: VIX ölçek çubuğu (bant adı aynı şeyi söylüyor) ve iki açıklama
 * kutusu — açıklamanın kendisi rehberde; sayfanın "Bunu Anlamak İçin"
 * satırı getiri eğrisi ve volatilite yazılarına bağlanıyor.
 */
export async function MarketPulse({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [vix, ...yields] = await Promise.all([
    getSeries(VIX_SERIES, 2),
    ...YIELD_SERIES.map((series) => getSeries(series, 10)),
  ]);

  const rows = YIELD_SERIES.map((series, index) => {
    const result = yields[index];
    const latest = result.ok ? result.data.latestValue : null;
    const prev = result.ok ? result.data.prevValue : null;
    return {
      key: series.slug,
      label: t.markets[series.labelKey],
      latest,
      delta: latest !== null && prev !== null ? latest - prev : null,
      date: result.ok ? (result.data.observations.at(-1)?.date ?? null) : null,
    };
  });

  const vixLevel = vix.ok ? vix.data.latestValue : null;
  const vixPrev = vix.ok ? vix.data.prevValue : null;
  const vixDelta = vixLevel !== null && vixPrev !== null ? vixLevel - vixPrev : null;
  const vixDate = vix.ok ? (vix.data.observations.at(-1)?.date ?? null) : null;

  if (rows.every((row) => row.latest === null) && vixLevel === null) return null;

  const y2 = rows[0].latest;
  const y10 = rows[2].latest;
  const spread = y2 !== null && y10 !== null ? y10 - y2 : null;
  const inverted = spread !== null && spread < 0;
  const band = vixLevel !== null ? vixBand(vixLevel) : null;
  const bandLabel: Record<string, string> = {
    calm: t.markets.fearCalm,
    normal: t.markets.fearNormal,
    tense: t.markets.fearTense,
    fear: t.markets.fearHigh,
    panic: t.markets.fearPanic,
  };

  /* Künye GÖZLEMİN tarihi, çekimin değil: FRED kapanışı bir iş günü
     geriden yayımlıyor. VIX başka bir güne aitse o da ayrıca yazılıyor. */
  const yieldDate = rows.find((row) => row.date)?.date ?? null;
  const stamp = [
    yieldDate && `FRED · ${formatEtDateCompact(yieldDate, locale)}`,
    vixDate && vixDate !== yieldDate && `VIX · ${formatEtDateCompact(vixDate, locale)}`,
  ].filter(Boolean).join(" · ");

  return (
    <section className={styles.pulse} aria-labelledby="market-pulse-title">
      <div className={styles.pulseHead}>
        <h2 id="market-pulse-title">{t.markets.pulseTitle}</h2>
        {stamp && <span className="numeral">{stamp}</span>}
      </div>

      <dl className={styles.pulseGrid}>
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd className="numeral">
              <b>{row.latest !== null ? formatPercentPlain(row.latest, locale, 2) : NO_VALUE}</b>
              {row.delta === null ? (
                /* Yer tutucu: satır basılmayınca sütun sekiz piksel yukarıda
                   bitiyordu; sayılar aynı hatta dursun. */
                <small aria-hidden>{"\u00a0"}</small>
              ) : Math.abs(row.delta) < FLAT_DELTA ? (
                <small>{t.macro.unchanged}</small>
              ) : (
                <small data-tone={row.delta > 0 ? "up" : "down"}>
                  <span aria-hidden>{row.delta > 0 ? "▲" : "▼"}</span>
                  {formatPrice(Math.abs(row.delta), locale)}
                </small>
              )}
            </dd>
          </div>
        ))}
        {spread !== null && (
          <div data-wide>
            <dt>{t.markets.curveShort}</dt>
            <dd className="numeral">
              <b data-tone={inverted ? "down" : "up"}>
                {spread >= 0 ? "+" : "−"}
                {formatPrice(Math.abs(spread), locale)} {t.markets.point}
              </b>
              {/* Farkın hangi iki vadeden kurulduğu yazılıyor: "Getiri
                  Eğrisi" tek başına 10−2 mi 10−3 ay mı demiyor. */}
              <small>
                <span>{inverted ? t.markets.curveInverted : t.markets.curveNormal}</span>
                <span data-basis>{t.markets.curveBasis}</span>
              </small>
            </dd>
          </div>
        )}
        {vixLevel !== null && band && (
          <div data-wide>
            <dt>VIX</dt>
            <dd className="numeral">
              <b>{formatPrice(vixLevel, locale, { digits: 2 })}</b>
              <small>
                <span className={styles.pulseBand} data-tone={band.tone}>{bandLabel[band.key]}</span>
                {vixDelta !== null && vixDelta !== 0 && (
                  /* Yükselen VIX gerginlik demek: yön rengi hisse
                     sözlüğünün tersine kurulu. */
                  <span data-tone={vixDelta > 0 ? "down" : "up"}>
                    <span aria-hidden>{vixDelta > 0 ? "▲" : "▼"}</span>{" "}
                    {formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}
                  </span>
                )}
              </small>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
