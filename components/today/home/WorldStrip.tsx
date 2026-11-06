import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MiniLane } from "@/components/day-poster/PosterLanes";
import { DataError, DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { quoteBasis } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { WORLD_MARKETS } from "@/db/seed/symbols";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { sharedLaneScale, WORLD_LANE_FLOOR } from "@/lib/home-figures";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain } from "@/lib/utils";
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

export type WorldRow = {
  symbol: string;
  flag: string;
  name: string;
  tracks: string;
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
 * Ölçek BÜTÜN satırlarda TEK (`sharedLaneScale`, taban ±%1) ve başlığın
 * sağında yazılı; renk yalnız işaretten. Son kapanışı gösteren satırın
 * şeridi yön rengini bırakıyor (yüzdesiyle aynı kural, veri dürüstlüğü 4).
 * Bayrak kendi sütununda: ad, künye ve şerit aynı sol hatta başlıyor.
 * Ölçümler HomeLanes.module.css başında.
 */
export function WorldStripView({
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
      <PanelHeader
        title={t.today.worldMarkets}
        tone="title"
        meta={
          <span className="numeral text-tiny text-muted">
            {t.homeDesk.scale.replace("{value}", formatPercentPlain(scale, locale, 1))}
          </span>
        }
      />
      <ul>
        {rows.map((market) => {
          const lastClose = market.lastClose;
          const tone = directionOf(market.changePct);
          const value = formatPercent(market.changePct, locale);
          return (
            <li key={market.symbol}>
              <Link
                href={`/hisse/${market.symbol}`}
                aria-label={t.homeDesk.rowAria
                  .replace("{name}", market.name)
                  .replace("{symbol}", market.symbol)
                  .replace("{value}", lastClose ? `${value} (${t.market.lastClose})` : value)}
                className={cn(styles.row, "border-t border-line px-4 py-2 transition-colors hover:bg-primary-tint sm:px-5")}
              >
                <span aria-hidden className={styles.flag}>{market.flag}</span>
                <span className={styles.main}>
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-base font-semibold text-strong">{market.name}</span>
                    <span className={styles.symbol}>{market.symbol}</span>
                  </span>
                  {/* DAR EKRANDA SARAR, KESİLMEZ. Bu satır fonun neyi
                      izlediğini söylüyor ("MSCI Japonya · Nikkei'yi izleyen
                      ABD fonu") ve kesildiğinde cümlenin taşıdığı tek bilgi
                      — vekil olduğu — kayboluyordu; 320 ve 360 piksellik
                      ekranlarda beş satırın üçü böyleydi. İki satıra kadar
                      sarıyor, ondan sonrası kesiliyor.
                      12 PUNTO (23 Eylül): 10 puntoda sayfanın 54 okunmayan
                      metin düğümünden beşi buydu; 390'da hâlâ iki satıra
                      sığıyor. */}
                  <span className="mt-0.5 line-clamp-2 block text-small leading-tight text-muted sm:truncate">
                    {market.tracks}
                  </span>
                  {lastClose && (
                    <span className="mt-0.5 block text-tiny font-semibold text-body">
                      {t.market.lastClose}
                    </span>
                  )}
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
                    anlamlı: fonun o günkü yönü. */}
                <span
                  aria-hidden
                  className={cn(
                    "numeral text-read",
                    styles.value,
                    lastClose ? "font-semibold text-body" : cn("font-bold", directionText(tone)),
                  )}
                >
                  {value}
                </span>
                {market.changePct !== null && (
                  <span className={styles.lane} data-basis={lastClose ? "lastClose" : undefined}>
                    <MiniLane change={market.changePct} scale={scale} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
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
