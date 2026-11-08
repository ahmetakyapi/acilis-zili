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
import { MOVERS_LANE_FLOOR, sharedLaneScale } from "@/lib/home-figures";
import { TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { cn, directionOf, directionText, directionWash, formatPercent, formatPercentPlain } from "@/lib/utils";
import { HomeLane, LaneAxis } from "@/components/today/home/HomeLane";
import styles from "./HomeLanes.module.css";
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

  const asRow = (row: (typeof gainers)[number]): MoverRow => ({
    symbol: row.symbol,
    changePct: row.quote.changePct ?? 0,
    name: meta[row.symbol]?.name ?? "",
    logoUrl: meta[row.symbol]?.logoUrl ?? null,
  });

  return (
    <DayMoversView
      locale={locale}
      t={t}
      title={title}
      note={note}
      gainers={gainers.map(asRow)}
      losers={losers.map(asRow)}
      gainersTotal={ranked.filter((row) => (row.quote.changePct ?? 0) > 0).length}
      losersTotal={ranked.filter((row) => (row.quote.changePct ?? 0) < 0).length}
      source={result.source}
      fetchedAt={result.fetchedAt}
      stale={result.stale}
    />
  );
}

type MoverRow = { symbol: string; changePct: number; name: string; logoUrl: string | null };

/**
 * Panelin çizimi — veriden ayrı (önizleme ve sunucu aynı ağacı basıyor).
 *
 * YÜZDE BİR DE ÇİZGİ (6 Kasım görsel tur). Liste logo, sembol, ad ve
 * yüzdeydi; GNRC'nin +%20'si ile üçüncü sıradaki +%4 aynı ağırlıkta
 * duruyordu. Her satırın altında artık ortak sıfırlı kulvar: yükselenler
 * sıfırdan sağa, düşenler sola — iki blok alt alta tek bir ayrışan grafik
 * gibi okunuyor. Ölçek iki blokta ve yedek satırlarda (`data-fill`) TEK
 * (`sharedLaneScale`, taban ±%3). Şerit ad sütunundan başlıyor, logo
 * sütunu boş: ad, künye ve şerit tek sol hatta (HomeLanes.module.css).
 *
 * İKİNCİ TUR (8 Kasım, sahibinin isteği — Dünya Piyasaları ile aynı dil):
 * - Ölçek künyesi ("Ortak Ölçek ±%17,2", ilk alt başlığın sağında) iki
 *   bloğun ÜSTÜNDE tek eksen oldu (`LaneAxis`): −%17,2 · 0 · +%17,2,
 *   şeritlerle aynı hatta. İki blok tek grafiğin iki yarısı; eksen bunu
 *   bir kez söylüyor.
 * - Satır üç kattan ikiye: sembol ve ad tek satırda (ad kesilebilir, tam
 *   adı `aria-label`da), altında şerit. Logo 26 → 32 (Dünya'nın bayrak
 *   karosuyla aynı sütun genişliği; iki panel alt alta aynı sol hatta).
 * - Grup başlığı yön ikonlu ve SAYILI: "Yükselenler · 312 Hisse" — liste
 *   ilk üç–beşi gösteriyor, sayaç o yöne gidenlerin tamamını (yalnız bu
 *   seansta işlem görenler, sıralamanın süzgeciyle aynı küme).
 * - Yüzde hap (up/down wash), şeridin ucunda değer noktası (`HomeLane`).
 */
function DayMoversView({
  locale,
  t,
  title,
  note,
  gainers,
  losers,
  gainersTotal,
  losersTotal,
  source,
  fetchedAt,
  stale,
}: {
  locale: Locale;
  t: Dictionary;
  title: string;
  note: string;
  gainers: MoverRow[];
  losers: MoverRow[];
  /** O yöne giden sıralanabilir sembollerin tamamı (listede ilk beşi var). */
  gainersTotal?: number;
  losersTotal?: number;
  source: string;
  fetchedAt?: Date | string | null;
  stale?: boolean;
}) {
  const scale = sharedLaneScale(
    [...gainers, ...losers].map((row) => row.changePct),
    MOVERS_LANE_FLOOR,
  );

  /* DİKEY YIĞIN, İKİ SÜTUN DEĞİL. `SessionMovers` ana kolonda `sm:grid-cols-2`
     ile iki sütun çiziyordu; yan kolon 376 piksel ve sütun 167 pikselden
     düşüyor — satır 26 piksellik logo, sembol, ad ve yüzde istiyor, sığmıyor.
     Ayrım sütunla değil ALT BAŞLIKLA kuruluyor ve bu aynı zamanda doğrusu:
     düşüşle geçen bir günde "yükselenler" listesinin üçü de eksi olabiliyor,
     tek liste + renk o gün "kim yükseldi" sorusunu cevapsız bırakırdı. */
  /* ÖLÇEK PANEL BAŞLIĞINDA DEĞİL: "Son Kapanışın Hareketleri" + künye +
     "Tümünü Gör" 350 piksellik kolonda iki satıra bölünüyordu (başlık
     satırı 77 piksel, ölçüldü). 6 Kasım'da ilk alt başlığın sağına inmişti;
     8 Kasım'dan beri iki bloğun üstünde eksen. */
  const countText = (n: number) =>
    (n === 1 ? t.homeDesk.moversCountOne : t.homeDesk.moversCount).replace(
      "{n}",
      /* Evren 514 sembol: binlik ayırıcı hiç gerekmiyor. */
      String(n),
    );
  const block = (
    heading: string,
    rows: MoverRow[],
    dir: "up" | "down",
    total: number | undefined,
    offset: number,
  ) => (
    <div className="border-t border-line">
      {/* GRUP BAŞLIĞI satırla aynı ızgarada: ikon işaret sütununda (logo
          karolarının ortasında), ad sembollerle aynı sol hatta, sayaç
          hapların sağ hattında. İkon karesi yok (AI-slop yasakları); yön
          ikonu yönün rengi — renk anlam taşıyor. */}
      <p className={cn(styles.row, styles.groupHead, "px-4 pb-1.5 pt-3 sm:px-5")}>
        <span aria-hidden className={cn(styles.lead, styles.groupIcon, directionText(dir))}>
          {dir === "up" ? <TrendUp weight="bold" /> : <TrendDown weight="bold" />}
        </span>
        <span className={cn(styles.groupLabel, "plate text-nano text-strong")}>{heading}</span>
        {total !== undefined && total > 0 && (
          <span className={cn(styles.groupCount, "numeral text-tiny text-muted")}>
            {countText(total)}
          </span>
        )}
      </p>
      <ul>
        {rows.length === 0 ? (
          <li className="px-4 pb-3.5 text-small text-muted sm:px-5">{t.common.noData}</li>
        ) : (
          rows.map((row, index) => {
            const value = formatPercent(row.changePct, locale);
            return (
              <li
                key={row.symbol}
                data-fill={index >= MOVERS_BASE ? "" : undefined}
                hidden={index >= MOVERS_BASE}
                suppressHydrationWarning
              >
                <Link
                  href={`/hisse/${row.symbol}`}
                  prefetch={false}
                  aria-label={t.homeDesk.rowAria
                    .replace("{name}", row.name || row.symbol)
                    .replace("{symbol}", row.symbol)
                    .replace("{value}", value)}
                  className={cn(styles.row, "px-4 py-2 transition-colors hover:bg-primary-tint sm:px-5")}
                >
                  <span className={styles.lead}>
                    <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" />
                  </span>
                  <span className={styles.main}>
                    <span className={styles.identTight}>
                      <span className="numeral shrink-0 text-read font-bold text-strong">
                        {row.symbol}
                      </span>
                      <span className="min-w-0 truncate text-tiny text-muted">{row.name}</span>
                    </span>
                  </span>
                  {/* YÜZDE HAP (8 Kasım). Burada "yüzde ÇIPLAK, rozet değil"
                      kararı vardı: rozetin zemini 167 piksellik sütunda
                      satırın yarısını kaplıyordu. Panel artık tek sütun ve
                      hap 390'da 62 piksel (satırın beşte biri, ölçüldü);
                      yön zemini şeridin rengini sayıya da taşıyor. */}
                  <span aria-hidden className={styles.value}>
                    <span
                      data-pill=""
                      className={cn("numeral", styles.pill, directionWash(directionOf(row.changePct)))}
                    >
                      {value}
                    </span>
                  </span>
                  <span className={styles.laneCell}>
                    <HomeLane change={row.changePct} scale={scale} index={offset + index} />
                  </span>
                </Link>
              </li>
            );
          })
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
      <div className={styles.desk}>
        <LaneAxis
          scale={scale}
          locale={locale}
          label={t.homeDesk.scale.replace("{value}", formatPercentPlain(scale, locale, 1))}
          className="px-4 sm:px-5"
        />
        {block(t.today.moversUp, gainers, "up", gainersTotal, 0)}
        {block(t.today.moversDown, losers, "down", losersTotal, gainers.length)}
      </div>
      {/* KÜNYE VE DAMGA BİRLİKTE. Panel uzun süre yalnızca "514 endeks üyesi
          tarandı · seans içi" yazıyordu: kaç sembolün tarandığını söylüyor,
          sayıların NE ZAMAN alındığını söylemiyordu. Yan kolondaki
          komşularının (endeksler, favoriler) hepsinde damga vardı; en hızlı
          bayatlayan sayıları basan panelde yoktu. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line-soft px-4 py-2 sm:px-5">
        <p className="text-tiny text-muted">{note}</p>
        <DataStamp
          labels={t.data}
          source={source}
          at={fetchedAt}
          stale={stale}
          locale={locale}
        />
      </div>
    </Panel>
  );
}

/* Günün hareketlerinin taban ve yedekli tavan satır sayısı (blok başına). */
const MOVERS_BASE = 3;
const MOVERS_MAX = 5;
