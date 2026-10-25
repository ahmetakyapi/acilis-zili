import styles from "./MacroExperience.module.css";
import { getDailyMarketSeries as getSeries, dailySourceLabel } from "@/lib/providers/daily-markets";
import type { Dictionary, Locale } from "@/lib/i18n";
import { VIX_SERIES, vixBand } from "@/lib/vix";
import { buildYieldCurve, CURVE_OBSERVATIONS } from "@/lib/macro-visual";
import { formatEtDateCompact, formatPercentPlain, formatPrice } from "@/lib/utils";
import { curveCaption, YieldCurve } from "./YieldCurve";

const YIELD_SERIES = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin", labelKey: "yieldY5" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin", labelKey: "yieldY30" },
] as const;

/** Bu farkın altındaki oynama "Değişmedi" sayılıyor (FRED iki ondalık yayımlar). */
const FLAT_DELTA = 0.001;

/**
 * 27 Eylül: Kullanıcı isteğiyle Makro kapağına taşındı. Aşağıdaki kayıt
 * önceki yerleşim kararını anlatır; ana sayfadaki özet korunuyor.
 *
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
    ...YIELD_SERIES.map((series) => getSeries(series, CURVE_OBSERVATIONS)),
  ]);

  const rows = YIELD_SERIES.map((series, index) => {
    const result = yields[index];
    const latest = result.ok ? result.data.latestValue : null;
    const prev = result.ok ? result.data.prevValue : null;
    return {
      key: series.slug,
      source: result.ok ? dailySourceLabel(result.source) : "",
      label: t.markets[series.labelKey],
      latest,
      delta: latest !== null && prev !== null ? latest - prev : null,
      date: result.ok ? (result.data.observations.at(-1)?.date ?? null) : null,
      observations: result.ok ? result.data.observations : [],
    };
  });

  const vixLevel = vix.ok ? vix.data.latestValue : null;
  const vixPrev = vix.ok ? vix.data.prevValue : null;
  const vixDelta = vixLevel !== null && vixPrev !== null ? vixLevel - vixPrev : null;
  const vixDate = vix.ok ? (vix.data.observations.at(-1)?.date ?? null) : null;

  if (rows.every((row) => row.latest === null) && vixLevel === null) return null;

  /* EĞRİ (25 Ekim): dört vade aynı günün kapanışıyla tek çizgi, bir ay
     önceki eğri soluk iz (karar kaydı YieldCurve.tsx). Eğri farkı ve
     biçimi de eğrinin GÜNÜNDEN: önce iki serinin son tarihi eşitse
     hesaplanıyordu; artık aynı kural `buildYieldCurve`te tek yerde. */
  const curve = buildYieldCurve(rows.map((row) => ({ key: row.key, observations: row.observations })));
  const caption = curve ? curveCaption(curve, rows.map((row) => row.label), locale, t) : null;
  const spread = caption?.spread ?? null;
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
    yieldDate && [...new Set(rows.filter(row => row.date).map(row => `${row.source} · ${formatEtDateCompact(row.date!, locale)}`))].join(" / "),
    vix.ok && vixDate && `${dailySourceLabel(vix.source)} · VIX · ${formatEtDateCompact(vixDate, locale)}`,
  ].filter(Boolean).join(" · ");

  return (
    <section className={styles.pulse} aria-labelledby="market-pulse-title">
      <div className={styles.pulseHead}>
        <h2 id="market-pulse-title">{t.markets.pulseTitle}</h2>
        {stamp && <span className="numeral">{stamp}</span>}
      </div>

      <div className={styles.pulseGrid}>
        {curve && caption && (
          <div data-curve>
            <YieldCurve
              curve={curve}
              chartLabel={caption.chartLabel}
              legend={caption.legend}
              shape={caption.shape}
              shapeLabel={caption.shapeLabel}
              shapeNote={caption.shapeNote}
              columns={rows.map((row, index) => {
                /* Değişim yalnız serinin son gözlemi eğrinin günüyse: başka
                   bir günün hareketi bu günün değerinin altına yazılmaz. */
                const sameDay = row.date === curve.date;
                return {
                  key: row.key,
                  label: row.label,
                  value: curve.points[index].value !== null ? formatPercentPlain(curve.points[index].value, locale, 2) : "",
                  delta: !sameDay || row.delta === null ? undefined : Math.abs(row.delta) < FLAT_DELTA ? (
                    t.macro.unchanged
                  ) : (
                    <span data-tone={row.delta > 0 ? "up" : "down"}>
                      <span aria-hidden>{row.delta > 0 ? "▲" : "▼"}</span> {formatPrice(Math.abs(row.delta), locale)}
                    </span>
                  ),
                  ...caption.ghostOf(index),
                };
              })}
            />
          </div>
        )}
        {spread !== null && (
          <dl data-wide>
            <dt>{t.markets.curveShort}</dt>
            <dd className="numeral">
              {/* Fark bir seviye, yön değil: nötr mürekkep (25 Ekim son
                  düzeltme; önce artıda yeşil, eksi farkta kırmızıydı).
                  Ters eğrinin uyarısı eğrinin künyesinde, pirinç rozet. */}
              <b>
                {spread >= 0 ? "+" : "−"}
                {formatPrice(Math.abs(spread), locale)} {t.markets.point}
              </b>
              {/* Farkın hangi iki vadeden kurulduğu yazılıyor: "Getiri
                  Eğrisi" tek başına 10−2 mi 10−3 ay mı demiyor. */}
              {/* Biçim adı ("Normal Eğri") eğrinin künyesinde; burada yalnız
                  farkın hangi iki vadeden kurulduğu. */}
              <small>
                <span data-basis>{t.markets.curveBasis}</span>
              </small>
            </dd>
          </dl>
        )}
        {vixLevel !== null && band && (
          <dl data-wide>
            <dt>VIX</dt>
            <dd className="numeral">
              <b>{formatPrice(vixLevel, locale, { digits: 2 })}</b>
              <small>
                <span className={styles.pulseBand} data-tone={band.tone}>{bandLabel[band.key]}</span>
                {vixDelta !== null && vixDelta !== 0 && (
                  /* Ok yalnız YÖN (25 Ekim son düzeltme): önce yükselen
                     VIX kırmızıydı, sayfanın öteki oklarının tersine.
                     Gerginlik yargısı yanındaki bandın adında. */
                  <span data-tone={vixDelta > 0 ? "up" : "down"}>
                    <span aria-hidden>{vixDelta > 0 ? "▲" : "▼"}</span>{" "}
                    {formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}
                  </span>
                )}
              </small>
            </dd>
          </dl>
        )}
      </div>
    </section>
  );
}
