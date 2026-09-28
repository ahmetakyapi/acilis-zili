import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  DataError,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  LogoTile,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames } from "@/lib/data";
import { SESSION_BOUNDS, etParts, isSessionTrade } from "@/lib/market-hours";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import { indexSnapshot } from "@/components/today/home/index-snapshot";

/**
 * Günün hareketleri — endeks üyeleri arasında en çok yükselen ve düşen üç.
 *
 * PANEL ARTIK HER SEANSTA VAR. Ön seans ve akşam seansı için yazılmıştı
 * (`SessionMovers`) ve yalnızca o iki pencerede basılıyordu; seans açıkken
 * ana sayfada tek bir hissenin bugün ne yaptığını gösteren hiçbir şey
 * yoktu — kendi favorilerin dışında. Ölçüldü: sağ kolon panelleri toplamı
 * 1797 piksel, kolon ise 2379 piksele uzuyordu ve aradaki 580 piksel
 * `justify-between` tarafından panel aralarına dağıtılıyordu.
 *
 * YALNIZCA BU SEANSTA İŞLEM GÖRENLER — panelin en önemli kuralı.
 * Ön seansta bir hissenin çoğu hiç işlem görmüyor; o sembolün "son işlemi"
 * dünkü kapanış oluyor ve değişimi de DÜNÜN değişimi. Süzgeç olmasaydı liste,
 * bu sabah hiç kımıldamamış hisselerin dünkü hareketleriyle dolardı.
 *
 * SÜZGEÇ BİR DÖNEM YALNIZCA UZATILMIŞ SEANSTA ÇALIŞIYORDU ve buradaki
 * gerekçe şöyle yazılıydı: "Normal seansta ve kapalıyken böyle bir ayrım yok,
 * `changePct` zaten o günün kapanışına göre." Cümle sağlayıcı taze veri
 * döndürdüğü sürece doğru — ama `changePct`in hangi günün kapanışına göre
 * olduğuna sağlayıcı karar veriyor, biz değil. Alpaca düştüğünde (514
 * sembollük evrende Finnhub yedeği hiç denenmiyor, sınır sekiz sembol) Neon
 * önbelleğine düşülüyor ve o önbellek ÖNCEKİ seansın yüzdelerini taşıyor.
 * 17 Eylül 11:51'de, seans açıkken, panelde 16 Eylül kapanışının sıralaması
 * duruyordu: GNRC %+20,66 · SMCI %+10,35 · INTC %+9,73, künyesi de "seans
 * içi". Okuyucunun gördüğü şey dünkü hareketti.
 *
 * Kural artık her seansta aynı: sıralamaya giren her sayının işlem günü
 * `status.sessionDate` olmalı (gerekçesi o alanın üzerinde). Uzatılmış
 * seansta dakika tabanı da duruyor — orada soru yalnızca "bugün mü" değil,
 * "bu seansta mı".
 *
 * BAŞLIK VE KÜNYE SEANSI SÖYLÜYOR. Piyasa kapalıyken gösterilen şey
 * "günün" değil son kapanışın sıralaması; künye bunu yazmasa panel dünkü
 * sıralamayı bugünmüş gibi basardı.
 */
export async function DayMovers({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const { symbols, result } = await indexSnapshot(status);

  const extended =
    status.session === "pre-market" || status.session === "after-hours";
  /* Piyasa kapalıyken (gece, hafta sonu, tatil) liste son seansın
     kapanışı; "Günün" pazar günü var olmayan bir seansı söylüyordu. */
  const title = !extended
    ? status.session === "closed"
      ? t.today.dayMoversClosed
      : t.today.dayMovers
    : status.session === "pre-market"
      ? t.today.preMarketMovers
      : t.today.afterHoursMovers;

  if (!result.ok) {
    return (
      <Panel>
        <PanelHeader title={title} tone="title" />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  const sinceMinutes =
    status.session === "pre-market"
      ? SESSION_BOUNDS.preMarketOpen
      : status.closeMinutes;

  const usable = symbols
    .map((symbol) => ({ symbol, quote: result.data[symbol] }))
    .filter((row) => {
      const quote = row.quote;
      /* Değişimi BİLİNMEYEN sembol eleniyor, sıfır sayılmıyor: sıfır
         "bugün değişmedi" diye bir iddia, bilinmiyor iddiasızlık. */
      if (!quote || quote.changePct === null || quote.changePct === undefined) {
        return false;
      }
      /* İşlem günü seansın günü olmalı — her seansta. */
      const tradedAt = quote.tradedAt;
      if (!tradedAt || !isSessionTrade(tradedAt, status)) return false;
      if (!extended) return true;
      /* Uzatılmış seansta gün yetmiyor: işlem o PENCEREDE olmalı. */
      return etParts(tradedAt).minutes >= sinceMinutes;
    })
    .map((row) => ({ symbol: row.symbol, quote: row.quote! }));

  const ranked = [...usable].sort(
    (a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0),
  );
  /* ÜÇ SATIR TABAN, BEŞE KADAR YEDEK — sağ kolonun doldurma kapasitesi
     (24 Eylül). Giriş yapmamış okuyucunun favori paneli tek satıra inince
     (227 → 72 piksel) sağ kolonun açabileceği tek liste haftaya bakış
     kaldı ve takvimin boş olduğu bir günde 1024'te sağ kolon 129 piksel
     kısa bitiyordu (ölçüldü). Sıralama zaten elde: dördüncü ve beşinci
     isim sunucuda basılıyor, `FillColumn` ancak yer varsa açıyor. */
  const gainers = ranked.filter((row) => (row.quote.changePct ?? 0) > 0).slice(0, MOVERS_MAX);
  const losers = ranked
    .filter((row) => (row.quote.changePct ?? 0) < 0)
    .slice(-MOVERS_MAX)
    .reverse();

  /* KÜNYE SEANSI SÖYLÜYOR — üç ayrı cümle, üç ayrı hâl.
     Uzatılmış seansta liste yalnızca O SEANSTA işlem görenlerden kuruluyor.
     Seans açıkken sıralama gün içinde ve canlı. Piyasa KAPALIYKEN ise
     gösterilen şey "bugünün" değil son kapanışın sıralaması; tek bir künye
     kullanılsaydı panel cumartesi günü cuma kapanışını "seans içi" diye
     basardı. */
  const note = (
    extended
      ? t.today.moversNote
      : status.session === "closed"
        ? t.today.dayMoversClosedNote
        : t.today.dayMoversNote
  ).replace("{n}", String(symbols.length));

  /* BOŞ LİSTENİN İKİ AYRI SEBEBİ VAR ve ikisi aynı cümleyle anlatılamaz:
     ya gerçekten sıralanacak hareket yok, ya elimizdeki paket bu seansa ait
     değil. İkincisinde "bugün hareket yok" demek olmayan bir şeyi iddia
     etmek olurdu; doğru cümle "bu seansın verisi alınamadı" — kart boş, ama
     boşluğun sebebi piyasa değil biz. */
  if (gainers.length === 0 && losers.length === 0) {
    return (
      <Panel>
        <PanelHeader title={title} tone="title" />
        {result.stale ? (
          <DataError message={t.data.failed} hint={t.data.failedHint} />
        ) : (
          <EmptyState
            title={extended ? t.today.moversEmpty : t.today.dayMoversEmpty}
            hint={note}
          />
        )}
      </Panel>
    );
  }

  const meta = await getSymbolNames([
    ...gainers.map((row) => row.symbol),
    ...losers.map((row) => row.symbol),
  ]);

  /* DİKEY YIĞIN, İKİ SÜTUN DEĞİL. `SessionMovers` ana kolonda `sm:grid-cols-2`
     ile iki sütun çiziyordu; yan kolon 376 piksel ve sütun 167 pikselden
     düşüyor — satır 26 piksellik logo, sembol, ad ve yüzde istiyor, sığmıyor.
     Ayrım sütunla değil ALT BAŞLIKLA kuruluyor ve bu aynı zamanda doğrusu:
     düşüşle geçen bir günde "yükselenler" listesinin üçü de eksi olabiliyor,
     tek liste + renk o gün "kim yükseldi" sorusunu cevapsız bırakırdı. */
  const block = (heading: string, rows: typeof gainers, divided: boolean) => (
    <div className={cn(divided && "border-t border-line")}>
      <p className="plate px-4 pb-1.5 pt-3.5 text-nano sm:px-5">
        {heading}
      </p>
      <ul>
        {rows.length === 0 ? (
          <li className="px-4 pb-3.5 text-small text-muted sm:px-5">{t.common.noData}</li>
        ) : (
          rows.map((row, index) => (
            <li
              key={row.symbol}
              data-fill={index >= MOVERS_BASE ? "" : undefined}
              hidden={index >= MOVERS_BASE}
              suppressHydrationWarning
            >
              <Link
                href={`/hisse/${row.symbol}`}
                prefetch={false}
                className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <LogoTile
                  symbol={row.symbol}
                  logoUrl={meta[row.symbol]?.logoUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="numeral block text-base font-bold leading-tight text-strong">
                    {row.symbol}
                  </span>
                  <span className="block truncate text-tiny leading-tight text-muted">
                    {meta[row.symbol]?.name ?? ""}
                  </span>
                </span>
                {/* Yüzde ÇIPLAK, rozet değil: yan kolonun grameri bu
                    (dünya şeridi, favoriler, endeksler hepsi böyle). Rozetin
                    zemini dar sütunda satırın yarısını kaplıyor. */}
                <span
                  className={cn(
                    "numeral shrink-0 text-base font-bold",
                    directionText(directionOf(row.quote.changePct)),
                  )}
                >
                  {formatPercent(row.quote.changePct, locale)}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <Panel>
      <PanelHeader
        title={title}
        tone="title"
        action={<PanelLink href="/piyasalar">{t.common.showAll}</PanelLink>}
      />
      {block(t.today.moversUp, gainers, true)}
      {block(t.today.moversDown, losers, true)}
      {/* KÜNYE VE DAMGA BİRLİKTE. Panel uzun süre yalnızca "514 endeks üyesi
          tarandı · seans içi" yazıyordu: kaç sembolün tarandığını söylüyor,
          sayıların NE ZAMAN alındığını söylemiyordu. Yan kolondaki
          komşularının (endeksler, favoriler) hepsinde damga vardı; en hızlı
          bayatlayan sayıları basan panelde yoktu. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line-soft px-4 py-2 sm:px-5">
        <p className="text-tiny text-muted">{note}</p>
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
        />
      </div>
    </Panel>
  );
}

/* Günün hareketlerinin taban ve yedekli tavan satır sayısı (blok başına). */
const MOVERS_BASE = 3;
const MOVERS_MAX = 5;
