import styles from "@/components/today/TodayExperience.module.css";
import { IndexLive } from "@/components/today/IndexLive";
import { loadIndexFeed, sessionDomain } from "@/components/today/index-feed";
import { DataError, Panel, Skeleton } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBarsMulti } from "@/lib/providers";

/* SAYI ENDEKSİN SEVİYESİ DEĞİL, FONUN FİYATI. Nasdaq 100 endeksi 25 binli
   seviyelerde; karttaki 716 dolar QQQ'nun hisse fiyatı. Ücretsiz
   sağlayıcılarda endeksin kendisi yok, o yüzden vekil fon izleniyor —
   yüzdesi endeksle neredeyse aynı, seviyesi hiç değil.

   Dünya piyasaları kartında bu sorun "fonun fiyatını hiç yazma" diye
   çözülmüştü (db/seed/symbols.ts → WORLD_MARKETS); burada fiyat yazılıyor
   çünkü QQQ/SPY kendi başına da alınıp satılan, tanınan bir enstrüman. O
   zaman da hangi enstrüman olduğu HER genişlikte görünmeli: sembol bir süre
   `hidden sm:inline` idi ve telefonda kart "Nasdaq 100 · 716,49" diye,
   endeksin seviyesiymiş gibi okunuyordu. Ad tablosu kartla birlikte
   `components/today/IndexLive.tsx` içinde. */

/**
 * Endeks kartları — geri sayımın sağında, mobilde altında 2×2 ızgara.
 * Dar kolonda dört sütun okunmuyordu; ikişerli dizilim aynı bilgiyi
 * sıkışmadan taşıyor.
 *
 * KARTLAR ARTIK CANLI BİR YAPRAK (`IndexLive`): sunucu ilk paketi ve
 * barları veriyor, seans içinde istemci `/api/endeks`ten tazeliyor.
 * Paket `loadIndexFeed` — alt şeridin de okuduğu aynı `getQuotes` anahtarı.
 */
export async function IndexStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  /* Barlar TEK istekte: sembol başına ayrı çağrı hem dört Alpaca isteği
     hem dört `candles_cache` yazması demekti. */
  const [feed, bars] = await Promise.all([
    loadIndexFeed(status),
    getChartBarsMulti([...INDEX_STRIP], "1D", status),
  ]);

  if (!feed.ok) {
    return (
      <Panel>
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  /* KIVILCIM ÇİZGİSİ SAYIYLA AYNI SEANSI ANLATMALI.
     Kartta iki şey yan yana duruyor ve ikisi AYRI kaynaktan geliyor: yüzde
     kotasyondan, çizgi 1G barlarından. Barlar artık seansa bağlı
     (`cachedBarsUsable`) ama kotasyon sağlayıcı düştüğünde önbelleğe
     düşüyor ve önceki seansın yüzdesini taşıyor. O hâlde kartta bir
     önceki seansın yüzdesinin ALTINDA bu seansın şekli çiziliyor —
     damga "güncel olmayabilir" dese de çizgi sessizce başka bir gün
     anlatıyor. Şekil de bir iddia; sayı o seansa ait değilse çizilmiyor
     (paket bayatsa ya da kotasyonun `basis`i "lastClose" ise — kural
     `IndexLive` içinde). Aynı kural favoriler özetinde de var.

     EKSEN SEANSIN KENDİSİ (23 Eylül). Barlar zamanlarıyla 04:00–20:00 ET
     eksenine, önceki kapanış kesik bir taban çizgisi olarak çiziliyor;
     gerekçe ve ölçüm `components/ui/Sparkline.tsx` başında. Yalnızca
     zaman ve kapanış istemciye iniyor, barın öteki dört alanı değil. */
  const { domain, openAt } = sessionDomain(status);
  const points: Record<string, { time: number; value: number }[]> = {};
  for (const symbol of INDEX_STRIP) {
    points[symbol] = (bars[symbol] ?? []).map((bar) => ({ time: bar.time, value: bar.close }));
  }

  return (
    <IndexLive
      symbols={INDEX_STRIP}
      initial={feed}
      bars={points}
      domain={domain}
      openAt={openAt}
      session={status.session}
      locale={locale}
      labels={{
        noData: t.common.noData,
        preMarket: t.market.preMarket,
        afterHours: t.market.afterHours,
        lastClose: t.market.lastClose,
        data: t.data,
      }}
    />
  );
}

export function IndexSkeleton() {
  // The previous deck measured 156px / mobile 135px. Use the final card's
  // minimum size and shared 2×2 grid while the right-hand panel streams in.
  return (
    <div className="flex flex-col gap-2.5">
      <div data-motion-stagger className={styles.indexGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={styles.indexSkeleton} />
        ))}
      </div>
      <Skeleton className="h-3 w-64 max-w-full" />
    </div>
  );
}
