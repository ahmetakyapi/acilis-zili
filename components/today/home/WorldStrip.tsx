import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DataError, DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { quoteBasis } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { WORLD_MARKETS } from "@/db/seed/symbols";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";

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
    <Panel>
      <PanelHeader title={t.today.worldMarkets} tone="title" />
      <ul>
        {shown.map((market) => {
          const quote = result.data[market.symbol];
          const lastClose = bases[market.symbol] === "lastClose";
          const tone = directionOf(quote.changePct);
          return (
            <li key={market.symbol}>
              <Link
                href={`/hisse/${market.symbol}`}
                className="flex items-center gap-3 border-t border-line px-4 py-2.5 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-base font-semibold text-strong">
                    <span aria-hidden>{market.flag}</span>
                    <span className="truncate">
                      {locale === "tr" ? market.nameTr : market.nameEn}
                    </span>
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
                    {locale === "tr" ? market.tracksTr : market.tracksEn}
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
                  className={cn(
                    "numeral shrink-0 text-read",
                    lastClose ? "font-semibold text-body" : cn("font-bold", directionText(tone)),
                  )}
                >
                  {formatPercent(quote.changePct, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* DAMGA BURADA DA VAR. Künye fonun neyi vekil ettiğini söylüyordu ama
          yüzdelerin yaşını söyleyen hiçbir şey yoktu; panel tam da bayat
          veriyi büyük puntoyla göstermenin yasak olduğu yerdi. */}
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <p className="text-tiny leading-relaxed text-muted">
          {allLastClose ? t.today.worldLastCloseHint : t.today.worldMarketsHint}
        </p>
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
          className="mt-1.5"
        />
      </div>
    </Panel>
  );
}
