import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { CSSProperties } from "react";
import { DataError, DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { quoteBasis } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { WORLD_MARKETS } from "@/db/seed/symbols";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { sharedLaneScale, WORLD_LANE_FLOOR } from "@/lib/home-figures";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import tiles from "./WorldTiles.module.css";
import pair from "./PanelPair.module.css";

/**
 * Dünya piyasaları şeridi — ülke fonları üzerinden.
 * Yerel endeksin kendisi değil; kartın altındaki künye bunu açıkça söyler.
 */
export async function WorldStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const result = await getQuotes(
    WORLD_MARKETS.map((market) => market.symbol),
    status,
  );
  /* SAĞLAYICI DÜŞTÜĞÜNDE PANEL KAYBOLMUYOR, SÖYLÜYOR.
     `!result.ok` dalı `null` dönüyordu: aynı arıza endeks şeridinde ve
     hareket panelinde "Veri alınamadı" yazarken bu panel sessizce sayfadan
     siliniyordu. İki zarar birden — okuyucu sitenin dünya piyasalarını
     izlediğini hiç öğrenemiyor, ve sayfanın o günkü hâli ile bir başka
     günkü hâli arasındaki fark açıklanmıyor. Ayrımı doğru yerden kurmak
     gerekiyordu: SAĞLAYICI ARIZASI bir haber, YAYIN OLMAMASI değil. Pano
     boş diye çizilmeyen teknik panel ile faizi hiç gelmeyen tahvil kartı
     (ikisi de `null` dönüyor) ikinci gruba giriyor — orada bir arıza yok,
     gösterilecek bir şey yok. Burada bir arıza var. */
  if (!result.ok) {
    return (
      <Panel>
        <PanelHeader title={t.today.worldMarkets} tone="title" />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  /* Kotasyon geldi ama HİÇBİR dünya sembolü dönmediyse bu da bir arıza:
     liste sabit (`WORLD_MARKETS`), "bugün bu fonlar yok" diye bir hâl yok. */
  const shown = WORLD_MARKETS.filter((market) => result.data[market.symbol]);
  if (shown.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t.today.worldMarkets} tone="title" />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  /* YÜZDE HANGİ SEANSI ANLATIYOR (Veri dürüstlüğü 4, 23 Eylül).
     Açılış öncesinde (11:46 TR) satır "Türkiye −%0,77" yazıyordu ve
     damgası "11:30 Güncellendi"ydi; aynı sembol /hisse/TUR'da "22 Eylül
     23:00 Güncellendi · Güncel Olmayabilir" diyordu — son işlem dünkü
     kapanıştı, yani −0,77 DÜNÜN hareketiydi. Damga çekim anını söylüyor,
     işlemin yaşını değil. Günün Hareketleri paneli bu hatayı bir kez
     düzeltmişti (`isSessionTrade`); bu panel sormuyordu.
     Kural `quoteBasis`te tek yerde: bu seansa ait işlem yoksa yüzde yön
     rengini bırakıyor, altında "Son Kapanış" künyesi duruyor. Satırların
     hiçbiri bu seansta işlem görmediyse künye cümlesi de bunu söylüyor. */
  const bases = Object.fromEntries(
    shown.map((market) => [market.symbol, quoteBasis(result.data[market.symbol], status)]),
  );
  const allLastClose = shown.every((market) => bases[market.symbol] === "lastClose");

  return (
    <WorldStripView
      locale={locale}
      t={t}
      rows={shown.map((market) => ({
        symbol: market.symbol,
        flag: market.flag,
        name: locale === "tr" ? market.nameTr : market.nameEn,
        tracks: locale === "tr" ? market.tracksTr : market.tracksEn,
        index: locale === "tr" ? market.indexTr : market.indexEn,
        changePct: result.data[market.symbol].changePct ?? null,
        lastClose: bases[market.symbol] === "lastClose",
      }))}
      allLastClose={allLastClose}
      source={result.source}
      fetchedAt={result.fetchedAt}
      stale={result.stale}
    />
  );
}

type WorldRow = {
  symbol: string;
  flag: string;
  name: string;
  /** Uzun künye cümlesi — artık yalnız ekran okuyucuya (`aria-label`). */
  tracks: string;
  /** Yerel endeksin kısa adı — satırda adın yanında künye. */
  index: string;
  changePct: number | null;
  /** Yüzde bu seansın değil, son kapanışın (`quoteBasis`). */
  lastClose: boolean;
};

/**
 * Panelin çizimi — veriden ayrı, önizleme (geçici `app/tmp*`) ve sunucu
 * aynı ağacı basıyor.
 *
 * YÜZDE BİR DE ÇİZGİ (6 Kasım görsel tur). Satırlar düz listeydi: bayrak,
 * ad, künye, sağda yüzde; beş ülkenin hangisinin sert, hangisinin sakin
 * olduğu sayıları tek tek okuyarak çıkıyordu. Her satırın altında artık
 * 5 piksellik kulvar (`--line-soft`), ortada sıfır (`--line-strong`), yüzde
 * sıfırdan iki yöne şerit — bülten bandının `MiniLane`i, aynı ölçek mantığı.
 * Ölçek BÜTÜN satırlarda TEK (`sharedLaneScale`, taban ±%1); renk yalnız
 * işaretten. Son kapanışı gösteren satırın şeridi yön rengini bırakıyor
 * (yüzdesiyle aynı kural, veri dürüstlüğü 4). Bayrak kendi sütununda: ad,
 * künye ve şerit aynı sol hatta başlıyor.
 *
 * İKİNCİ TUR (8 Kasım, sahibinin isteği — 390'da "çok daha görsel"):
 * - Ölçek künyesi ("Ortak Ölçek ±%4,1", başlığın sağında) EKSENE döndü:
 *   şeritlerin üstünde −%4,1 · 0 · +%4,1, şeritlerle aynı hatta
 *   (`LaneAxis`). Ortaklık artık okunarak değil, tek eksenin bütün
 *   satırların üstünde durmasından anlaşılıyor.
 * - Satır üç kattan ikiye: künye cümlesi ("MSCI Türkiye · BIST'i izleyen
 *   ABD fonu") yerine adın yanında yerel endeksin KISA adı. "ABD fonu"
 *   beş satırda aynıydı ve dipnot zaten söylüyor (fonların dolar bazlı
 *   MSCI ülke fonu olduğu, yönün güvenilir, yüzdenin ayrışabilir olduğu);
 *   uzun cümle ekran okuyucuya kaldı (`aria-label`).
 * - Bayrak 32 piksellik karo, kimlik + şerit bloğunun boyunda.
 * - Yüzde hap (up/down wash), şeridin ucunda değer noktası (`HomeLane`).
 * Ölçümler HomeLanes.module.css başında.
 *
 * ÜÇÜNCÜ TUR (10 Kasım gece, ana oturumun kararı): bandın dili. İnce şerit
 * + uç noktası + renkli hap yerine 10 piksellik DOLU çubuk ve hapsız, yön
 * renginde 17/700 yüzde; ülke adı 15/600 (gerekçe HomeLane.tsx,
 * HomeLanes.module.css). SON KAPANIŞ satırı bandın kararına geçti: bu
 * seansta işlem görmeyen ülkenin çubuğu çizilmiyor (önce soluk çubuktu),
 * kulvarın yerinde "Son Kapanış" künyesi duruyor, yüzdesi soluk ve ortak
 * ölçeğe girmiyor — başka bir günün hareketi bugünün cetveline konmaz.
 * Hepsi son kapanıştaysa (hafta sonu) çubuklar çizilir: hepsi aynı günü
 * anlatıyor, dönemi dipnot söylüyor.
 *
 * DÖRDÜNCÜ TUR (28 Kasım, Görsel Tur 4 — bayraklı karolar). Sağ kolonda
 * Hareketler, Dünya Piyasaları ve Dünün Grafiği üst üste aynı "kimlik +
 * yüzde + altında kalın çubuk" satırını konuşuyordu; sol kolondaki sektör
 * sıralaması da (`arayuz.md` → "Aynı 'satır + çubuk + yüzde' kalıbı bir
 * bölümde yinelenmez"). Hareketler tek gerçek sıralı liste olarak çubukta
 * kaldı; dünya KARO ızgarasına döndü: beş ülke bir bakışta harita gibi
 * okunuyor, sıralama gibi değil. Kurallar:
 * - Türkiye karosu iki sütunu kaplıyor (okurun kendi piyasası; 1 + 2 + 2
 *   ızgarada boş hücre kalmıyor). Ötekiler 2 × 2.
 * - Değer karonun en büyük puntosu (22/700, yön renginde); bayrak 28
 *   piksellik karo, ad 14/600, altında sembol · yerel endeks künyesi.
 * - BÜYÜKLÜK ZEMİNİN DOYGUNLUĞUNDA: zemin yönün wash'ı, doygunluğu
 *   |yüzde| / ortak ölçek (`sharedLaneScale`, taban ±%1; en az %30). Isı
 *   Haritası karosunun küçük kardeşi; ölçek tek, renk yalnız işaretten.
 *   Satır vurgu zemini değil: karo bir veri hücresi, bütün karolar boyalı.
 * - SON KAPANIŞ karosu (karışık günde): zemin nötr, yüzde soluk, altında
 *   "Son Kapanış" künyesi; ortak ölçeğe girmiyor (üçüncü turun kuralı).
 * - Tablette (768–1279) Hareketler'le çift: ızgara panelin boyuna uzar,
 *   karolar satırları eşit paylaşır; dipnot ile liste arasındaki 84
 *   piksellik ölü pay karoların içine dağıldı. Rayda (≥1280) ve telefonda
 *   karo içeriği kadar.
 * Eksen (`LaneAxis`) kalktı: çubuk yoksa eksen de yok. Ölçüm
 * WorldTiles.module.css başında.
 */
function WorldStripView({
  locale,
  t,
  rows,
  allLastClose,
  source,
  fetchedAt,
  stale,
}: {
  locale: Locale;
  t: Dictionary;
  rows: WorldRow[];
  allLastClose: boolean;
  source: string;
  fetchedAt?: Date | string | null;
  stale?: boolean;
}) {
  /** Bu karo ortak ölçekte mi: karışık günde son kapanıştaki ülke değil. */
  const onScale = (row: WorldRow) => row.changePct !== null && (allLastClose || !row.lastClose);
  const scale = sharedLaneScale(
    rows.map((row) => (onScale(row) ? row.changePct : null)),
    WORLD_LANE_FLOOR,
  );
  return (
    /* Tablette Hareketler'le çift: künye dibe yaslı, ızgara arada uzar
       (gerekçe PanelPair.module.css, WorldTiles.module.css). */
    <Panel className={cn(pair.fill, tiles.panel)}>
      <PanelHeader title={t.today.worldMarkets} tone="title" />
      <ul className={tiles.grid} data-world-grid>
        {rows.map((market, index) => {
          const drawn = onScale(market);
          const tone = directionOf(market.changePct);
          const value = formatPercent(market.changePct, locale);
          /* Doygunluk: %30 taban (en sakin karo da yönünü söylesin), üstü
             büyüklükle; ölçek dışı ve yatay karo boyanmaz. */
          const heat =
            drawn && market.changePct !== null && tone !== "flat"
              ? 0.3 + 0.7 * Math.min(1, Math.abs(market.changePct) / scale)
              : 0;
          return (
            <li key={market.symbol} data-lead={index === 0 || undefined}>
              <Link
                href={`/hisse/${market.symbol}`}
                aria-label={`${t.homeDesk.rowAria
                  .replace("{name}", market.name)
                  .replace("{symbol}", market.symbol)
                  .replace("{value}", market.lastClose ? `${value} (${t.market.lastClose})` : value)}. ${market.tracks}`}
                className={tiles.tile}
                data-tone={heat > 0 ? tone : undefined}
                style={{ "--heat": heat.toFixed(2) } as CSSProperties}
              >
                <span aria-hidden className={tiles.flag}>{market.flag}</span>
                <span aria-hidden className={tiles.name}>{market.name}</span>
                <span aria-hidden className={tiles.meta}>
                  <span className={tiles.symbol}>{market.symbol}</span>
                  <span>{market.index}</span>
                </span>
                <span aria-hidden className={tiles.value}>
                  <span
                    className={cn("numeral", tiles.pct, tone === "flat" ? "text-muted" : directionText(tone))}
                    data-quiet={!drawn || undefined}
                  >
                    {value}
                  </span>
                  {!drawn && market.changePct !== null && <span className={tiles.note}>{t.market.lastClose}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* DAMGA BURADA DA VAR. Künye fonun neyi vekil ettiğini söylüyordu ama
          yüzdelerin yaşını söyleyen hiçbir şey yoktu; panel tam da bayat
          veriyi büyük puntoyla göstermenin yasak olduğu yerdi. */}
      <div className={cn("border-t border-line-soft px-4 py-3 sm:px-5", pair.foot)}>
        <p className="text-tiny leading-relaxed text-muted">
          {allLastClose ? t.today.worldLastCloseHint : t.today.worldMarketsHint}
        </p>
        <DataStamp
          labels={t.data}
          source={source}
          at={fetchedAt}
          stale={stale}
          locale={locale}
          className="mt-1.5"
        />
      </div>
    </Panel>
  );
}
