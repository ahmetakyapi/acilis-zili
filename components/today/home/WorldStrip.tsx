import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { HomeLane, LaneAxis } from "@/components/today/home/HomeLane";
import { DataError, DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { quoteBasis } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { WORLD_MARKETS } from "@/db/seed/symbols";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { sharedLaneScale, WORLD_LANE_FLOOR } from "@/lib/home-figures";
import { cn, directionOf, directionWash, formatPercent, formatPercentPlain } from "@/lib/utils";
import styles from "./HomeLanes.module.css";

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
  const scale = sharedLaneScale(
    rows.map((row) => row.changePct),
    WORLD_LANE_FLOOR,
  );
  return (
    <Panel>
      <PanelHeader title={t.today.worldMarkets} tone="title" />
      <div className={styles.desk}>
        <LaneAxis
          scale={scale}
          locale={locale}
          label={t.homeDesk.scale.replace("{value}", formatPercentPlain(scale, locale, 1))}
          className="px-4 sm:px-5"
        />
        <ul>
        {rows.map((market, index) => {
          const lastClose = market.lastClose;
          const tone = directionOf(market.changePct);
          const value = formatPercent(market.changePct, locale);
          return (
            <li key={market.symbol}>
              <Link
                href={`/hisse/${market.symbol}`}
                aria-label={`${t.homeDesk.rowAria
                  .replace("{name}", market.name)
                  .replace("{symbol}", market.symbol)
                  .replace("{value}", lastClose ? `${value} (${t.market.lastClose})` : value)}. ${market.tracks}`}
                className={cn(styles.row, "border-t border-line-soft px-4 py-2.5 transition-colors hover:bg-primary-tint sm:px-5")}
              >
                <span aria-hidden className={styles.lead}>
                  <span className={styles.flag}>{market.flag}</span>
                </span>
                <span className={styles.main}>
                  {/* KÜNYE KISA VE ADIN YANINDA (8 Kasım). Burada iki satıra
                      saran uzun cümle vardı ("MSCI Japonya · Nikkei'yi
                      izleyen ABD fonu"; kararı: dar ekranda sarar, kesilmez,
                      12 punto). 390'da satırı 80 piksele çıkarıyordu ve
                      Çin'inki yine de kesiliyordu; 768'de beşi, 1440'ta
                      üçü kesikti. Vekil olduğu bilgisi kaybolmuyor: dipnot
                      söylüyor, uzun cümle `aria-label`da. Künye ÖBEK
                      olarak sarar (HomeLanes `.ident`), kesilmez; 12 punto
                      tabanı korunuyor. */}
                  <span className={styles.ident}>
                    <span className="text-read font-semibold text-strong">{market.name}</span>
                    <span className={styles.symbol}>{market.symbol}</span>
                    <span className={styles.identMeta}>{market.index}</span>
                    {lastClose && (
                      <span className={cn(styles.identMeta, "font-semibold text-body")}>
                        {t.market.lastClose}
                      </span>
                    )}
                  </span>
                </span>
                {/* Satırın değeri YALNIZCA yüzde.
                    Burada bir süre fonun dolar fiyatı da (38,70 gibi)
                    büyük puntoyla yazıyordu. O sayı yanlış değildi ama
                    okuyucunun etiketten beklediği büyüklük DEĞİLDİ: "Türkiye
                    38,70" satırında 38,70 bir piyasa seviyesi değil, ABD'de
                    işlem gören bir MSCI fonunun fiyatı — BIST 100 on
                    binlerde. Alttaki açıklama bunu kurtarmıyordu; aynı
                    gerekçeyle Brent metriği de kaldırılmıştı (bkz.
                    CLAUDE.md → veri dürüstlüğü). Yüzde ise gerçekten
                    anlamlı: fonun o günkü yönü.
                    HAP (8 Kasım): yön zemini wash'ta; son kapanış ve %0,00
                    nötr zeminde — bu seansın yönü değil (veri dürüstlüğü 4). */}
                <span aria-hidden className={styles.value}>
                  <span
                    data-pill=""
                    className={cn(
                      "numeral",
                      styles.pill,
                      lastClose ? "bg-surface-sunken font-semibold text-body" : directionWash(tone),
                    )}
                  >
                    {value}
                  </span>
                </span>
                {market.changePct !== null && (
                  <span className={styles.laneCell}>
                    <HomeLane change={market.changePct} scale={scale} index={index} muted={lastClose} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        </ul>
      </div>
      {/* DAMGA BURADA DA VAR. Künye fonun neyi vekil ettiğini söylüyordu ama
          yüzdelerin yaşını söyleyen hiçbir şey yoktu; panel tam da bayat
          veriyi büyük puntoyla göstermenin yasak olduğu yerdi. */}
      <div className="border-t border-line-soft px-4 py-3 sm:px-5">
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
