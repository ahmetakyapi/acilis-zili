import { Panel, PanelHeader, PanelLink, PercentReading } from "@/components/ui/primitives";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatEtDateCompact, formatPrice, NO_VALUE } from "@/lib/utils";
import { getDailyMarketSeries as getSeries, dailySourceLabel } from "@/lib/providers/daily-markets";
import { VIX_SERIES, vixBand } from "@/lib/vix";
import { buildYieldCurve, CURVE_OBSERVATIONS } from "@/lib/macro-visual";
import { curveCaption, YieldCurve } from "@/components/macro/YieldCurve";

/**
 * ABD tahvil faizleri — 2, 5 ve 10 yıllık.
 *
 * Endekslerin hemen altında durması bilinçli: hisse tarafındaki hareketin
 * karşılığı çoğu gün burada okunuyor. 30 yıllık bu kartta yok, tam seri
 * /piyasalar'da; yan kolonda üç vade yeterli.
 */
const TODAY_YIELDS = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin", labelKey: "yieldY5" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
] as const;

export async function YieldCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [vixResult, ...results] = await Promise.all([
    getSeries(VIX_SERIES, 2),
    ...TODAY_YIELDS.map((series) => getSeries(series, CURVE_OBSERVATIONS)),
  ]);

  const values = TODAY_YIELDS.map((series, index) => {
    const result = results[index];
    return {
      key: series.slug,
      source: result.ok ? dailySourceLabel(result.source) : "",
      label: t.markets[series.labelKey],
      latest: result.ok ? result.data.latestValue : null,
      prev: result.ok ? result.data.prevValue : null,
      date: result.ok ? (result.data.observations.at(-1)?.date ?? null) : null,
      observations: result.ok ? result.data.observations : [],
    };
  });
  /* EĞRİ MİNYATÜRÜ (25 Ekim) — /makro kapağıyla aynı bileşen ve aynı
     kural (karar kaydı components/macro/YieldCurve.tsx). Üç vade yan
     kolonda kalıyor: dört sütun 348 piksellik kartta değerleri 55
     piksele sıkıştırıyordu; 30 yıllık /makro'da. */
  const curve = buildYieldCurve(values.map((value) => ({ key: value.key, observations: value.observations })));
  const caption = curve ? curveCaption(curve, values.map((value) => value.label), locale, t) : null;

  if (values.every((value) => value.latest === null)) return null;

  /* GÖZLEM TARİHİ YAZILIYOR. FRED'in günlük hazine serileri bir-iki iş günü
     geriden yayımlanıyor: 20 Ağustos'ta en yeni gözlem 18 Ağustos'undu ve
     kart, iki gün önceki faizi bugünün faizi gibi 18 puntoyla basıyor,
     altındaki "▲ 0,04 puan" da bugünün hareketi gibi okunuyordu. Aynı
     sayılar /piyasalar'da zaten tarihiyle duruyor; ikisi arasındaki fark
     tek başına bir hataydı. Bkz. CLAUDE.md → "eski veriyi büyük puntoyla
     gösterme". */
  const observedAt = values.find((value) => value.date)?.date ?? null;

  const vixLevel = vixResult.ok ? vixResult.data.latestValue : null;
  const vixPrev = vixResult.ok ? vixResult.data.prevValue : null;
  /* VIX'İN KENDİ TARİHİ. Panelin "kaynak · tarih" künyesi (normalde
     "U.S. Treasury", yedekte FRED) tahvil serilerine ait ve VIX satırının
     ÜSTÜNDE duruyor; VIX ise tarihsiz basılıyordu. Aynı gün olduklarında sorun görünmüyor ama tahvil
     piyasasının kapalı, borsanın açık olduğu günlerde (Columbus Day,
     Veterans Day) ikisi farklı günlere işaret ediyor ve okuyucu üstteki
     tarihi VIX'e de ait sanıyor. Aynı gerekçe faiz künyesinin yazılma
     sebebiydi zaten; VIX atlanmıştı. */
  const vixDate = vixResult.ok
    ? (vixResult.data.observations.at(-1)?.date ?? null)
    : null;
  const vixDelta =
    vixLevel !== null && vixPrev !== null ? vixLevel - vixPrev : null;
  const bandLabel: Record<string, string> = {
    calm: t.markets.fearCalm,
    normal: t.markets.fearNormal,
    tense: t.markets.fearTense,
    fear: t.markets.fearHigh,
    panic: t.markets.fearPanic,
  };
  const vixTone =
    vixLevel !== null
      ? (() => {
          const band = vixBand(vixLevel);
          return { band, label: bandLabel[band.key] ?? "" };
        })()
      : null;

  return (
    <Panel>
      {/* GÖZLEM TARİHİ BAŞLIKTA DEĞİL, PANELİN DİBİNDE. Başlıkta üçüncü öğe
          olarak duruyordu ve 360 piksellik ekranda 324 piksellik panele üç
          öğe sığmıyordu: başlık kesiliyor, künye ve bağlantı kelime
          ortasından ikiye bölünüyordu. Aynı sayılar /piyasalar'da zaten
          tarihini dipte taşıyor — iki ekran artık aynı yerde söylüyor. */}
      <PanelHeader
        title={t.markets.yields}
        tone="title"
        action={<PanelLink href="/makro">{t.common.showAll}</PanelLink>}
      />
      {curve && caption ? (
        <div className="border-t border-line px-3 pb-3 pt-1 sm:px-4">
          <YieldCurve
            compact
            curve={curve}
            chartLabel={caption.chartLabel}
            legend={caption.legend}
            shape={caption.shape}
            shapeLabel={caption.shapeLabel}
            shapeNote={caption.shapeNote}
            columns={values.map((value, index) => {
              /* Değer EĞRİNİN gününden; değişim yalnız serinin son gözlemi o
                 günse (başka günün hareketi bu değerin altına yazılmaz).
                 `null` ile `0` ayrı: biri "önceki gözlemi bilmiyoruz",
                 öteki "faiz gerçekten değişmedi"; bilinmeyende tire. */
              const delta = value.latest !== null && value.prev !== null ? value.latest - value.prev : null;
              const sameDay = value.date === curve.date;
              return {
                key: value.key,
                label: value.label,
                value: (
                  <PercentReading value={curve.points[index].value} locale={locale} signClassName="mx-0.5 text-xs text-muted" />
                ),
                delta: !sameDay || delta === null ? NO_VALUE : delta === 0 ? t.macro.unchanged : (
                  <span className={delta > 0 ? "text-up" : "text-down"}>
                    <span aria-hidden>{delta > 0 ? "▲" : "▼"}</span>{" "}
                    {formatPrice(Math.abs(delta), locale, { digits: 2 })} {t.markets.point}
                  </span>
                ),
                ...caption.ghostOf(index),
              };
            })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 border-t border-line">
          {values.map((value, index) => (
            <div key={value.key} className={cn("px-4 py-3.5", index > 0 && "border-l border-line")}>
              <p className="plate text-nano">{value.label}</p>
              <PercentReading value={value.latest} locale={locale} className="tote mt-1 block text-lg" signClassName="mx-0.5 text-xs text-muted" />
            </div>
          ))}
        </div>
      )}

      {observedAt && (
        <p className="border-t border-line-soft px-4 py-2 text-tiny text-muted sm:px-5">
          {[...new Set(values.filter(value => value.date).map(value => `${value.source} · ${formatEtDateCompact(value.date!, locale)}`))].join(" / ")}
        </p>
      )}

      {/* ---- Korku Endeksi ----
           Kendi kartı vardı ve o kart Brent'le eşleşmişti; Brent düşünce
           (FRED'in spot serisi günlerce geriden geliyor) VIX tek başına
           kaldı. Yeri burası: faiz de VIX de hisse tarafının arka planını
           okuyan, tek sayıdan ibaret ölçüler ve ikisi de günlük kapanış:
           faiz Hazine'den, VIX Cboe'den doğrudan, ikisinin de yedeği FRED
           (`lib/providers/daily-markets.ts`). Bantlı tam göstergesi
           /piyasalar'da — eşikler oradan, tek yerden okunuyor. */}
      {/* İKİ KAT, TEK SATIR DEĞİL. Etiket, değer, bant, tarih ve değişim
          aynı esnek satırda ve beşi de `shrink-0` idi: 348 piksellik yan
          kolonda içerik 349 piksel tutuyor, iç dolguyu tüketip kartın
          kenarından kesiliyordu ("Puan" yarım okunuyordu); 320'de taşma 67
          piksele çıkıyordu (ölçüldü, 22 Eylül). Artık faiz hücreleriyle
          aynı kalıp: solda ad ve bant, sağda sayı ve altında değişimi. */}
      {vixLevel !== null && vixTone && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line px-4 py-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="plate text-nano">
              {t.markets.fearTitle}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-tiny font-semibold",
                // Band bir değerlendirme, yön değil (25 Ekim, /makro ile
                // aynı kural): sakin/normal nötr, gergin ve üstü pirinç uyarı.
                vixTone.band.tone === "up" || vixTone.band.tone === "flat"
                  ? "bg-surface-elevated text-body"
                  : "bg-brass-wash text-brass-ink",
              )}
            >
              {vixTone.label}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="tote text-lead leading-none">
              {formatPrice(vixLevel, locale, { digits: 2 })}
            </span>
            {(vixDate || (vixDelta !== null && vixDelta !== 0)) && (
              <span className="flex flex-wrap items-baseline justify-end gap-x-2">
                {/* VIX satırı KENDİ kaynağını ve tarihini her zaman yazar
                    (20 Ekim'de düzeltilen not: burada "yalnız faiz
                    künyesinden farklıysa" yazıyordu, kod hiç öyle
                    davranmadı). Yayıncı farklı (Cboe / Hazine) ve iki
                    piyasanın kapalı günleri ayrı (Columbus, Veterans Day),
                    üstteki künye VIX'in yerine geçemez; aynı "FRED · tarih"
                    ancak ikisi birden yedeğe düşünce tekrarlanır. */}
                {vixDate && vixResult.ok && (
                  <span className="numeral text-tiny text-muted">
                    {vixResult.ok && dailySourceLabel(vixResult.source)} · {formatEtDateCompact(vixDate, locale)}
                  </span>
                )}
                {vixDelta !== null && vixDelta !== 0 && (
                  <span
                    className={cn(
                      "numeral text-tiny font-semibold",
                      // Ok yalnız yön (25 Ekim): gerginlik yargısı bandın adında.
                      vixDelta > 0 ? "text-up" : "text-down",
                    )}
                  >
                    <span aria-hidden>{vixDelta > 0 ? "▲" : "▼"}</span>{" "}
                    {formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}{" "}
                    {/* Birim ŞART: hemen üstteki faiz satırları değişimi "0,04 puan"
                        diye yazıyor, VIX ise çıplak "1,12" yazıyordu. Yan yana
                        duran iki ölçüden biri birimli biri birimsiz olunca okuyucu
                        ikincisini yüzde sanıyor — VIX'te 1,12 puan ile %1,12 çok
                        farklı iki haber. */}
                    {t.markets.point}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
