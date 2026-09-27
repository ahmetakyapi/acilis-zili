import { Panel, PanelHeader, PanelLink, PercentReading } from "@/components/ui/primitives";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatEtDateCompact, formatPrice, NO_VALUE } from "@/lib/utils";
import { getDailyMarketSeries as getSeries, dailySourceLabel } from "@/lib/providers/daily-markets";
import { VIX_SERIES, vixBand } from "@/lib/vix";

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
    ...TODAY_YIELDS.map((series) => getSeries(series, 2)),
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
    };
  });

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
  /* VIX'İN KENDİ TARİHİ. Panelin tek "FRED · tarih" künyesi tahvil
     serilerine ait ve VIX satırının ÜSTÜNDE duruyor; VIX ise tarihsiz
     basılıyordu. Aynı gün olduklarında sorun görünmüyor ama tahvil
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
      <div className="grid grid-cols-3 border-t border-line">
        {values.map((value, index) => {
          const delta =
            value.latest !== null && value.prev !== null
              ? value.latest - value.prev
              : null;
          return (
            <div
              key={value.key}
              className={cn(
                "px-4 py-3.5",
                index > 0 && "border-l border-line",
              )}
            >
              <p className="plate text-nano">{value.label}</p>
              {/* İşaret küçük ve sessiz kalıyor (birim künyesi gibi) ama YERİ
                  dile bağlı: Türkçede sayıdan önce, İngilizcede sonra. Kural
                  artık primitives → PercentReading içinde tek yerde; burada
                  ve /piyasalar'da ayrı ayrı yazılıyken ikisi ayrışmıştı. */}
              <PercentReading
                value={value.latest}
                locale={locale}
                className="tote mt-1 block text-lg"
                signClassName="mx-0.5 text-xs text-muted"
              />
              <p className="numeral mt-0.5 text-tiny text-muted">
                {/* `null` ile `0` AYRI ŞEYLER: biri "önceki gözlemi
                    bilmiyoruz", öteki "faiz gerçekten değişmedi". İkisini de
                    "değişmedi" diye yazmak, olmayan bir ölçümü ölçülmüş gibi
                    göstermek oluyordu. Bilinmeyende tire basılıyor. */}
                {delta === null ? (
                  NO_VALUE
                ) : delta === 0 ? (
                  t.macro.unchanged
                ) : (
                  <>
                    <span aria-hidden>{delta > 0 ? "▲" : "▼"}</span>{" "}
                    {formatPrice(Math.abs(delta), locale, { digits: 2 })}{" "}
                    {t.markets.point}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {observedAt && (
        <p className="border-t border-line-soft px-4 py-2 text-tiny text-muted sm:px-5">
          {[...new Set(values.filter(value => value.date).map(value => `${value.source} · ${formatEtDateCompact(value.date!, locale)}`))].join(" / ")}
        </p>
      )}

      {/* ---- Korku Endeksi ----
           Kendi kartı vardı ve o kart Brent'le eşleşmişti; Brent düşünce
           (FRED'in spot serisi günlerce geriden geliyor) VIX tek başına
           kaldı. Yeri burası: faiz de VIX de hisse tarafının arka planını
           okuyan, tek sayıdan ibaret ölçüler ve ikisi de aynı FRED
           beslemesinden günlük geliyor. Bantlı tam göstergesi
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
                vixTone.band.tone === "up" && "bg-up-wash text-up",
                vixTone.band.tone === "flat" && "bg-surface-elevated text-body",
                vixTone.band.tone === "warn" && "bg-brass-wash text-brass-ink",
                vixTone.band.tone === "down" && "bg-down-wash text-down",
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
                {/* Tarih yalnızca faiz künyesinden FARKLIYSA yazılıyor: aynı
                    günse üstteki künye zaten söylüyor ve tekrar etmek satırı
                    gereksiz kalabalıklaştırır. */}
                {vixDate && vixResult.ok && (
                  <span className="numeral text-tiny text-muted">
                    {vixResult.ok && dailySourceLabel(vixResult.source)} · {formatEtDateCompact(vixDate, locale)}
                  </span>
                )}
                {vixDelta !== null && vixDelta !== 0 && (
                  <span
                    className={cn(
                      "numeral text-tiny font-semibold",
                      // Yükselen VIX gerginlik demek — yön rengi hisse
                      // sözlüğünün tersine kurulu.
                      vixDelta > 0 ? "text-down" : "text-up",
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
