import { cache } from "react";
import { inArray, eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { candlesCache, quotesCache, symbols as symbolsTable } from "../schema";
import {
  boundedTtl,
  candleTtlSeconds,
  etParts,
  expectsSessionData,
  isSessionTrade,
  quoteTtlSeconds,
  type MarketStatus,
} from "../market-hours";
import * as alpaca from "./alpaca";
import * as finnhub from "./finnhub";
import * as fred from "./fred";
import {
  fail,
  ok,
  type Bar,
  type ChartRange,
  type CompanyProfile,
  type ProviderOk,
  type ProviderResult,
  type Quote,
} from "./types";
import { logoSrc } from "@/lib/logos";

export * as alpaca from "./alpaca";
export * as finnhub from "./finnhub";
export * as fred from "./fred";
export * as tcmb from "./tcmb";
export * from "./types";

/**
 * Sağlayıcı orkestrasyonu.
 *
 * Sıra her zaman aynı: canlı kaynak → yedek kaynak → Neon'daki son bilinen
 * değer. Üçü de başarısız olursa hata döner ve ekranda "veri alınamadı"
 * görünür. Hiçbir aşamada tahmini/uydurma değer üretilmez.
 */

export function providerStatus() {
  return {
    alpaca: alpaca.isAlpacaConfigured(),
    finnhub: finnhub.isFinnhubConfigured(),
    fred: fred.isFredConfigured(),
  };
}

/* --------------------------------------------------------------------------
   Fiyatlar
   -------------------------------------------------------------------------- */

/**
 * Tek yazmada kaç satır — Postgres'in 65535 parametre sınırının çok altında
 * (11 kolon × 500 = 5500) ve tek bir HTTP gövdesine rahat sığıyor.
 */
const QUOTE_WRITE_BATCH = 500;

/**
 * Taze fiyatları önbelleğe yazar; hata sessizce yutulur.
 *
 * TEK SORGU olması şart. Eskiden her kotasyon ayrı bir `db.insert()` idi ve
 * `Promise.all` ile paralel atılıyordu; neon-http'de her sorgu ayrı bir HTTP
 * gidiş-dönüşü olduğu için Şirketler dizini (513 sembol) TEK sayfa
 * görüntülemede 513 istek üretiyordu. Üstelik Alpaca yanıtı Data Cache'ten
 * gelse bile bu yazma çalıştığı için önbellek isabeti de aynı bedeli
 * ödüyordu.
 *
 * Artık çok satırlı tek upsert: 513 istek → 2 istek. `excluded.*` ile her
 * satır kendi yeni değerini alır.
 *
 * Beklenerek çağrılır. Eskiden `void` ile bırakılıyordu ve sunucusuz
 * fonksiyon yanıtı döndükten sonra donduğunda yazma yarıda kesilebiliyordu;
 * tek gidiş-dönüşün maliyeti (~20ms) bu belirsizliğe değmez.
 */
/**
 * En son yazılan işlem damgası — sembol → `tradedAt` (ms).
 *
 * DEĞİŞMEYEN SATIR YENİDEN YAZILMIYOR. Alpaca yanıtı Next'in veri
 * önbelleğinden geldiğinde de bu fonksiyon çalışıyordu: borsa kapalıyken
 * fiyatlar saatlerce sabit kalıyor ama Şirketler dizinini açan HER okuyucu
 * 753 satırlık iki upsert'i Neon'a gönderiyordu. Yazılan değer bir öncekinin
 * aynısıydı — tek kazandığı `updated_at` damgası, ki onu okuyan yok.
 *
 * Ölçüldü: sayfanın sunucu yanıtı 3,2 saniyeydi ve bunun yarısı bu yazma.
 * Seans açıkken `tradedAt` her kotasyonda değişiyor, yani yazma o zaman
 * eskisi gibi yapılıyor — atlanan yalnızca gereksiz olan.
 *
 * Harita süreç belleğinde ve sunucusuz ortamda örnek başına: bir örnek
 * "bilmiyorum" derse yazma yapılır, yani yanlış tarafa düşmüyor.
 */
const lastPersisted = new Map<string, number>();

async function persistQuotes(quotes: Quote[]): Promise<void> {
  if (quotes.length === 0) return;

  const fresh = quotes.filter((q) => {
    const stamp = q.tradedAt?.getTime() ?? 0;
    /* Damgası olmayan kotasyon her zaman yazılır: karşılaştıracak bir şey
       yok ve son bilinen değer tablosunun boş kalması daha kötü. */
    if (!stamp) return true;
    return lastPersisted.get(q.symbol) !== stamp;
  });
  if (fresh.length === 0) return;

  const now = new Date();
  const rows = fresh.map((q) => ({
    symbol: q.symbol,
    price: q.price,
    change: q.change,
    changePct: q.changePct,
    open: q.open,
    high: q.high,
    low: q.low,
    prevClose: q.prevClose,
    volume: q.volume,
    tradedAt: q.tradedAt,
    updatedAt: now,
  }));

  try {
    for (let i = 0; i < rows.length; i += QUOTE_WRITE_BATCH) {
      await db
        .insert(quotesCache)
        .values(rows.slice(i, i + QUOTE_WRITE_BATCH))
        .onConflictDoUpdate({
          target: quotesCache.symbol,
          set: {
            price: sql`excluded.price`,
            change: sql`excluded.change`,
            changePct: sql`excluded.change_pct`,
            open: sql`excluded.open`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            prevClose: sql`excluded.prev_close`,
            volume: sql`excluded.volume`,
            tradedAt: sql`excluded.traded_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
    for (const q of fresh) {
      const stamp = q.tradedAt?.getTime();
      if (stamp) lastPersisted.set(q.symbol, stamp);
    }
  } catch {
    // Önbellek yazımı ürünün çalışması için zorunlu değil.
  }
}

/**
 * Son çare: Neon önbelleğindeki son bilinen fiyat.
 *
 * KAYITLARIN YAŞI DA DÖNER. Eskiden yalnızca değerler dönüyordu ve çağıran
 * `ok(cached, "cache", { stale: true })` yazıyordu; `ok()` damga verilmediğinde
 * `new Date()` koyuyor, yani ekranda "önbellek · 14:32 güncellendi" görünüyordu
 * — 14:32 verinin yazıldığı an değil, SAYFANIN ÇİZİLDİĞİ an. Fiyat dünden
 * kalmış olabilirken damga onu az önce alınmış gösteriyordu; projenin
 * "eski veriyi güncelmiş gibi gösterme" kuralının doğrudan ihlali.
 */
async function quotesFromCache(
  symbolList: string[],
): Promise<{ quotes: Record<string, Quote>; oldest: Date | null }> {
  try {
    const rows = await db
      .select()
      .from(quotesCache)
      .where(inArray(quotesCache.symbol, symbolList));

    const result: Record<string, Quote> = {};
    let oldest: Date | null = null;
    for (const row of rows) {
      if (row.price === null) continue;
      /* En ESKİ damga alınıyor, en yenisi değil: kartta tek bir tarih
         yazılıyor ve o tarih "bu ekrandaki en eski sayı ne kadar geride"
         sorusunu cevaplamalı. */
      if (row.updatedAt && (!oldest || row.updatedAt < oldest)) {
        oldest = row.updatedAt;
      }
      result[row.symbol] = {
        symbol: row.symbol,
        price: row.price,
        change: row.change,
        changePct: row.changePct,
        open: row.open,
        high: row.high,
        low: row.low,
        prevClose: row.prevClose,
        volume: row.volume,
        tradedAt: row.tradedAt,
      };
    }
    return { quotes: result, oldest };
  } catch {
    return { quotes: {}, oldest: null };
  }
}

/**
 * Paketteki EN YENİ son işlem anı — hiçbirinde yoksa null.
 *
 * İki soruya birden cevap veriyor: paketin yaşı (damga) ve paketin hangi
 * seansa ait olduğu (tazelik kararı). İkisi de "en yeni"yi istiyor çünkü
 * paket tek bir çekimden geliyor; likiditesi düşük semboller günler öncesini
 * taşıyabilir ve paketin yaşını onlar tayin etmez.
 */
function newestTrade(quotes: Record<string, Quote>): Date | null {
  let newest: Date | null = null;
  for (const quote of Object.values(quotes)) {
    if (quote.tradedAt && (!newest || quote.tradedAt > newest)) {
      newest = quote.tradedAt;
    }
  }
  return newest;
}

/**
 * Yanıtın kendi yaşı için tanınan pay (saniye).
 *
 * Damga sağlayıcının `Date` başlığından geliyor ve saatler birebir aynı
 * değil; ağ gecikmesi de var. Altmış saniye, seans içi 15 saniyelik ömrün
 * yanında bol bir pay ama iki-üç dakikalık bir gecikmeyi yakalamaya yetiyor.
 */
const RESPONSE_AGE_SLACK_SECONDS = 60;
/** Kapalı piyasada paketin en fazla yaşı, son seansın sonu henüz gelmediyse. */
const CLOSED_FLOOR_MS = 60 * 60 * 1000;

/**
 * Paket ŞU ANI anlatıyor mu — iki soru, iki ölçü.
 *
 * (1) GÜN: paketteki en yeni işlem, ekranın anlattığı seansın gününe ait mi
 *     (`isSessionTrade`). Bu kontrol önce eklendi ve bir hata düzeltmesinden
 *     geldi: sağlayıcı düşünce Neon önbelleğine düşülüyor ve önceki seansın
 *     yüzdeleri "seans içi" künyesiyle basılıyordu.
 *
 * (2) YAŞ: yanıtın kendisi ne kadar eski. Gün kontrolü tek başına YETMİYOR
 *     ve eksiği canlı seansın ortasında görünüyor — paket bugüne ait ama
 *     yetmiş üç dakika önce çekilmiş olabilir. Next'in veri önbelleği süresi
 *     dolmuş kaydı atmıyor, isteğe eski gövdeyi verip tazelemeyi arkasında
 *     yapıyor; günde birkaç kez okunan bir sayfada okuyucunun gördüğü paket,
 *     bir önceki ziyaretçinin çektiği paket oluyor. SNDK sayfasında tam
 *     olarak bu görüldü: başlıkta 1.689,93 $ ("17:02 Güncellendi") yazarken
 *     aynı ekrandaki 1G grafiği 18:15'e kadar bar taşıyordu ve son barın
 *     kapanışı 1.711,24 $ idi. İki fiyat yan yana, aradaki fark yüzde 1,3 —
 *     okuyucu için bu bir hata, bizim için bir önbellek isabeti.
 *
 * Yaş ölçüsü SAĞLAYICININ `Date` BAŞLIĞINDAN geliyor (`responseDate`), son
 * işlem anından değil: likiditesi düşük bir sembol canlı seansta da bir
 * saat işlem görmeyebilir ve onu bayat saymak yanlış olurdu. Başlık
 * önbellek isabetinde de ilk çekimin saatini taşıyor — gerekçesi
 * `types.ts` → `responseDate`.
 *
 * İkisi de yalnızca beslemenin bu seansa ait veri verebildiği anlarda
 * sorulur; hafta sonunda ve ön seansın ilk çeyreğinde eski paket beklenen
 * hâl, orada boşa istek gitmez.
 */
/* Dışa açık YALNIZCA test için: kural bir cümleye sığmıyor ve takvimin
   köşelerinde (gece yarısı, hafta sonu, ön seansın ilk çeyreği) davranışı
   ancak doğrudan çağrılarak tutulabiliyor. Çağıran tek yer `fetchQuotes`. */
export function packCurrent(
  pack: ProviderOk<Record<string, Quote>>,
  status: MarketStatus,
  ttl: number,
  now: Date = new Date(),
): boolean {
  /* KAPALI PİYASADA DA BİR ALT SINIR VAR (3 Ekim). Bu dal "beslemeden seans
     verisi beklenmiyorsa yaş sorulmaz" diyor ve HER paketi güncel sayıyordu.
     Cumartesi açılan MU sayfası cuma SABAHININ (06:45 ET) ön seans fiyatını
     basıyordu: o paket cuma sabahı önbelleğe yazılmış, Next süresi dolmuş
     kaydı stale-while-revalidate ile bir kez daha vermişti — seyrek açılan
     her sembolde olabilecek bir şey. Kural `closedResponseCurrent`te. */
  if (!expectsSessionData(status, now)) return closedResponseCurrent(pack.fetchedAt, status, now);
  if (!isSessionTrade(newestTrade(pack.data), status)) return false;
  const age = now.getTime() - pack.fetchedAt.getTime();
  return age <= (ttl + RESPONSE_AGE_SLACK_SECONDS) * 1000;
}

/**
 * MELEZ KOTASYON — fiyat gerçek zamanlı (IEX), geri kalanı gecikmeli (SIP).
 *
 * SORUN. Ücretsiz katman konsolide tape'i 15 dakika geriden veriyor
 * (gerekçe `alpaca.ts` başında); seans içinde ekrandaki fiyat gerçek
 * fiyattan bu kadar uzaktı. IEX gerçek zamanlı ama tek borsa (hacmin %1-8'i,
 * aynı ölçüm) — yalnız başına kullanılması bu yüzden bırakılmıştı.
 *
 * ÖLÇÜLDÜ (1 Ekim seansı, 1 dakikalık barlar, 30 sembol — büyük, orta, az
 * işlem gören, endeks fonları). Aynı dakikada IEX'in son kapanışı ile
 * konsolide kapanış arasındaki fark ve bugünkü 15 dakikalık gecikmenin
 * kendi hatası, ikisi de gerçek konsolide fiyata göre:
 *
 *            15 dk gecikme  (medyan / p95 / en kötü)   melez
 *   NVDA     %0,218 / 0,628 / 0,980                    %0,006 / 0,032 / 0,078
 *   MU       %0,526 / 1,384 / 2,293                    %0,014 / 0,067 / 0,151
 *   ACN      %0,403 / 1,881 / 2,856                    %0,023 / 0,121 / 0,279
 *   ASTS     %0,390 / 1,360 / 3,858                    %0,043 / 0,225 / 0,528
 *   NVR      %0,374 / 0,976 / 1,307                    %0,077 / 0,673 / 1,161
 *
 * Melez medyanda 10-40 kat daha doğru. Tek zayıf yer IEX'in işlem görmediği
 * dakikalar (NVR seansın %62'si, DIA %44, AZO %34): orada IEX'in son barı
 * eskiyor. KURAL: bar üç dakikadan eskiyse o sembol gecikmeli fiyatta
 * kalıyor — ölçümde bu, en kötü durumda bugünkü hatayı aşmıyor (NVR'de
 * IEX'in kullanıldığı dakikalar %71, geri kalanı bugünkü gibi).
 *
 * NE DEĞİŞİYOR, NE DEĞİŞMİYOR.
 *  - Fiyat ve işlem anı: IEX barının kapanışı ve dakikası.
 *  - Değişim ve yüzde: RESMİ önceki kapanışa göre (SIP'in `prevClose`u) —
 *    taban değişmiyor, yalnızca pay güncelleniyor.
 *  - Gün içi yüksek/düşük: yeni fiyatı kapsayacak kadar genişliyor; aksi
 *    hâlde fiyat "En Yüksek"in üstünde basılırdı (işlem gerçekten oldu).
 *  - Hacim, açılış: gecikmeli tape'ten (IEX hacmi yirmide bir, sıralamayı
 *    bozar — gerekçe `alpaca.ts`).
 *  - Grafik barları: gecikmeli; 1G'nin son noktası zaten başlıktaki fiyatı
 *    okuyor (PriceChart → "SON NOKTANIN OKUMASI BAŞLIKTAKİ FİYATTIR"),
 *    iki sayı yine aynı.
 *
 * YALNIZCA NORMAL SEANSTA ve yalnızca SIP paketi güncelse: IEX'te seans
 * dışı işlem yok; açılış öncesi ve sonrası tape tek kaynak. Paketin künyesi
 * kaynağı söylüyor (`alpaca-live` / `alpaca-mixed`) ve IEX'in koşulu olan
 * atıf ("IEX Real-Time Price") damgada fiyatın yanında.
 *
 * İzin: IEX gerçek zamanlı verinin ücretsiz gösterimine atıfla izin veriyor
 * (iextrading.com/api-exhibit-a); bağlantı Hakkında sayfasında.
 */
const REALTIME_MAX_AGE_MS = 3 * 60 * 1000;

async function overlayRealtime(
  pack: ProviderOk<Record<string, Quote>>,
  status: MarketStatus,
  ttl: number,
): Promise<{ quotes: Record<string, Quote>; live: number }> {
  if (status.session !== "regular") return { quotes: pack.data, live: 0 };
  /* TAZELİK GERÇEK "ŞİMDİ"YE GÖRE. Yanıtın kendi saatine (`fetchedAt`)
     göre ölçülseydi Next'in önbelleğinden gelen on dakikalık bir yanıt
     kendi içinde "taze" görünür ve künye "Real-Time" derdi. Önbellekteki
     yanıt eskiyse bir kez önbelleksiz soruluyor (kotasyondaki kuralın eşi). */
  let iex = await alpaca.getLatestIexBars(Object.keys(pack.data), ttl);
  if (iex.ok && Date.now() - iex.fetchedAt.getTime() > (ttl + RESPONSE_AGE_SLACK_SECONDS) * 1000) {
    iex = await alpaca.getLatestIexBars(Object.keys(pack.data), ttl, { fresh: true });
  }
  if (!iex.ok) return { quotes: pack.data, live: 0 };
  return mergeRealtime(pack.data, iex.data, Date.now());
}

/**
 * Birleştirmenin saf hâli — kurallar `overlayRealtime` üzerinde.
 * Dışa açık YALNIZCA test için (tests/realtime-overlay.test.ts).
 */
export function mergeRealtime(
  data: Record<string, Quote>,
  bars: Record<string, { close: number; minute: Date }>,
  nowMs: number,
): { quotes: Record<string, Quote>; live: number } {
  const quotes: Record<string, Quote> = {};
  let live = 0;
  for (const [symbol, quote] of Object.entries(data)) {
    const bar = bars[symbol] ?? bars[symbol.replace("-", ".")];
    const fresh =
      bar &&
      nowMs - bar.minute.getTime() <= REALTIME_MAX_AGE_MS &&
      (!quote.tradedAt || bar.minute.getTime() > quote.tradedAt.getTime());
    if (!fresh) {
      quotes[symbol] = quote;
      continue;
    }
    const price = bar.close;
    const change = quote.prevClose !== null ? price - quote.prevClose : null;
    quotes[symbol] = {
      ...quote,
      price,
      change,
      changePct:
        change !== null && quote.prevClose ? (change / quote.prevClose) * 100 : null,
      high: quote.high !== null ? Math.max(quote.high, price) : null,
      low: quote.low !== null ? Math.min(quote.low, price) : null,
      tradedAt: bar.minute,
      realtime: true,
    };
    live += 1;
  }
  return { quotes, live };
}

/**
 * Kotasyon çekmenin gerçek gövdesi — sarmalayıcı aşağıda.
 *
 * AYNI İSTEKTE İKİ KEZ ÇALIŞMAMALI. Alpaca çağrısı Next'in `fetch`
 * belleklemesiyle zaten tekilleşiyordu ama ardından gelen `persistQuotes`
 * tekilleşmiyordu: hisse sayfası aynı sembolün kotasyonunu dört ayrı
 * bileşende soruyor (başlık, grafik, metrikler, uygunluk kartı) ve tek
 * satırlık aynı upsert dört kez Neon'a gidiyordu. Ana sayfada da benzeri
 * vardı — endeks şeridi ile layout'taki şerit aynı satırları iki kez
 * yazıyordu.
 */
async function fetchQuotes(
  symbolList: string[],
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  if (symbolList.length === 0) return ok({}, "alpaca");

  const unique = [...new Set(symbolList)];
  const ttl = quoteTtlSeconds(status);

  let primary = await alpaca.getSnapshots(unique, ttl);

  /* PAKET GÜNCEL DEĞİLSE BİR KEZ ÖNBELLEKSİZ TEKRARLANIR — gerekçesi
     `packCurrent` üzerinde. */
  if (primary.ok && !packCurrent(primary, status, ttl)) {
    const retaze = await alpaca.getSnapshots(unique, ttl, { fresh: true });
    if (retaze.ok) primary = retaze;
  }

  if (primary.ok) {
    /* DAMGA VERİNİN YAŞINI SÖYLÜYOR, İSTEĞİN ANINI DEĞİL.
       Aynı hata bir kez önbellek yolunda bulunup düzeltilmişti (gerekçesi
       `quotesFromCache` başında) ama CANLI yolda duruyordu: `alpacaFetch`
       damga vermiyor, `ok()` de damgasız çağrıda `new Date()` koyuyor. Next
       `fetch`i TTL dolduktan sonra bir süre eski gövdeyi servis edip
       tazelemeyi arkada yaptığı için ekranda saatler öncesinin fiyatı "az
       önce güncellendi" diye durabiliyordu — SNDK'da görüldü: başlık
       1.477,21 yazarken hissenin gerçek fiyatı 1.507 civarıydı ve damga o
       anın saatini gösteriyordu.

       Yerine yükün KENDİ zaman damgası konuyor: paketteki EN YENİ son işlem
       anı. Önbellek yolunda en ESKİSİ alınıyor çünkü orada her satırın ayrı
       bir yazılma zamanı var ve soru "en geride kalan ne kadar geride";
       burada bütün satırlar tek bir çekimden geliyor, sembollerin son işlem
       anları ise likiditeye göre farklı — o yüzden paketin ön ucu, yani en
       yenisi, o çekimin gerçek yaşını veriyor. Hiçbirinde işlem anı yoksa
       eski davranış sürüyor. */
    const enYeni = newestTrade(primary.data);

    /* Doğru damga yetmedi — İDDİA DA DÜZELTİLİYOR.
       Damganın gerçeği söylemesi bir adımdı; paket yine de `stale`
       işaretsiz dönüyordu, yani ekranlar onu canlı veri sayıp sıralamaya
       sokuyordu. Önbelleksiz tekrardan sonra bile seansa ait olmayan bir
       paket artık kendini eski ilan ediyor ve künye onu öyle basıyor. */
    const guncel = packCurrent(primary, status, ttl);

    /* MELEZ: güncel pakette fiyat gerçek zamanlıya çekiliyor (gerekçe ve
       ölçüm `overlayRealtime` üzerinde). Önbelleğe yazılan da bu hâl. */
    if (guncel) {
      const { quotes, live } = await overlayRealtime(primary, status, ttl);
      if (live > 0) {
        await persistQuotes(Object.values(quotes));
        const source = live === Object.keys(quotes).length ? "alpaca-live" : "alpaca-mixed";
        return ok(quotes, source, { fetchedAt: newestTrade(quotes) ?? enYeni ?? undefined });
      }
    }

    /* SEANSA AİT OLMAYAN PAKET ÖNBELLEĞE YAZILMIYOR. `persistQuotes`
       satırlara `updated_at = now` basıyor ve o damga `quotesFromCache`
       tarafından "bu sayıyı ne zaman öğrendik" diye okunuyor: eski bir
       paketi yazmak, son bilinen değer tablosuna hiçbir yeni bilgi katmadan
       oradaki yaşı sıfırlamak olurdu. */
    if (guncel) await persistQuotes(Object.values(primary.data));

    if (!enYeni) return guncel ? primary : { ...primary, stale: true };
    return ok(primary.data, "alpaca", { fetchedAt: enYeni, stale: !guncel });
  }

  // Yedek: Finnhub tek tek sorgular. Sadece küçük listelerde denenir,
  // 60 istek/dk sınırını bir sayfa yüklemesiyle tüketmemek için.
  if (unique.length <= 8 && finnhub.isFinnhubConfigured()) {
    const results = await Promise.all(
      unique.map((symbol) => finnhub.getQuote(symbol, ttl)),
    );
    const quotes: Record<string, Quote> = {};
    /* YEDEK YOL DA KENDİ DAMGASINI TAŞIR. Burası `ok(quotes, "finnhub")`
       diyordu, yani `types.ts` damgasız çağrıya `new Date()` koyuyor ve
       ekranda RENDER anı yazıyordu. Alpaca dalı ve önbellek dalı bu hatadan
       çoktan kurtarılmıştı; yedek yol arada kalmıştı ve tam da sağlayıcı
       düştüğünde, yani damganın en çok işe yaradığı anda yanlış saati
       basıyordu.

       Tercih sırası Alpaca dalıyla aynı: önce paketin EN YENİ işlem anı —
       veri o kadar taze. İşlem anı yoksa çekimlerin EN ESKİ `fetchedAt`i;
       Alpaca'daki gibi tek bir çekim yok, sembol başına ayrı `fetch` var ve
       her birinin önbellek yaşı bağımsız, yani sorulan soru "en geride
       kalan ne kadar geride". */
    let enYeniIslem: Date | null = null;
    let enEskiCekim: Date | null = null;
    for (const result of results) {
      if (!result.ok) continue;
      quotes[result.data.symbol] = result.data;
      const islem = result.data.tradedAt;
      if (islem && (!enYeniIslem || islem > enYeniIslem)) enYeniIslem = islem;
      if (!enEskiCekim || result.fetchedAt < enEskiCekim) {
        enEskiCekim = result.fetchedAt;
      }
    }
    if (Object.keys(quotes).length > 0) {
      /* TAZELİK KARARI ALPACA DALIYLA AYNI KURALDAN GEÇİYOR — gerekçesi
         orada. Yedek yol da Next'in veri önbelleğini kullanıyor, yani aynı
         biçimde bir önceki seansın paketini "canlı" diye döndürebilir.
         Önbelleksiz tekrar burada YOK: yol sembol başına ayrı istek atıyor ve
         yalnızca sekiz sembole kadar deneniyor, yani kazancı küçük, bedeli
         (sekiz ek istek, 60 istek/dk sınırı) büyük. İddia yine de
         düzeltiliyor: eski paket kendini eski ilan ediyor. */
      const damga = enYeniIslem ?? enEskiCekim ?? undefined;
      const guncel = expectsSessionData(status)
        ? isSessionTrade(enYeniIslem, status)
        : true;
      if (guncel) await persistQuotes(Object.values(quotes));
      return ok(quotes, "finnhub", { fetchedAt: damga, stale: !guncel });
    }
  }

  // Son çare: en son bilinen değer, "güncel değil" damgasıyla.
  const cached = await quotesFromCache(unique);
  if (Object.keys(cached.quotes).length > 0) {
    return ok(cached.quotes, "cache", {
      stale: true,
      fetchedAt: cached.oldest ?? undefined,
    });
  }

  return primary;
}

/* React `cache()` argümanları KİMLİĞE göre eşliyor: her çağıran kendi
   dizisini yazdığı için `["NVDA"]` hiçbir zaman aynı dizi olmuyordu ve
   önbellek hiç tutmuyordu. Anahtar bu yüzden sıralı ve birleştirilmiş bir
   dize. `status` ise `getStatus()`ten geliyor ve o da `cache()`li, yani
   istek boyunca aynı nesne referansı. */
const quotesForKey = cache(async function quotesForKey(
  key: string,
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  return fetchQuotes(key ? key.split(",") : [], status);
});

export async function getQuotes(
  symbolList: string[],
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  const unique = [...new Set(symbolList)].sort();
  return quotesForKey(unique.join(","), status);
}

/**
 * Haftalık (5 işlem günü) yüzde değişim — toplu.
 *
 * Şirketler dizininde günlük değişimin yanında duruyor: tek bir günün
 * hareketi çoğu zaman gürültü, hafta ise yönü gösteriyor. Günlük barlardan
 * hesaplandığı için gün içi fiyattan bağımsız ve uzun TTL ile önbellekli;
 * seans içinde saat başı tazelenmesi yeterli.
 *
 * Sağlayıcı düşerse boş sözlük döner ve kolon "—" gösterir; sayfanın geri
 * kalanı etkilenmez.
 */
export async function getWeeklyChanges(
  symbolList: string[],
  status: MarketStatus,
): Promise<Record<string, number>> {
  /* Taban 900 saniye ama SINIRI AŞMADAN: `Math.max` doğrudan yazıldığında
     seans sınırına kırpılmış ömrü geri büyütüyor ve kayıt yeniden iki
     seansa birden ait olabiliyordu (bkz. `boundedTtl`). */
  const ttl = boundedTtl(Math.max(candleTtlSeconds("1M", status), 900), status);
  const result = await alpaca.getPeriodChanges(symbolList, 5, ttl);
  return result.ok ? result.data : {};
}

export async function getQuote(
  symbol: string,
  status: MarketStatus,
): Promise<ProviderResult<Quote>> {
  const result = await getQuotes([symbol], status);
  if (!result.ok) return result;

  const quote = result.data[symbol];
  if (!quote) {
    return fail("alpaca", "not-found", `${symbol} için fiyat bulunamadı`);
  }
  return ok(quote, result.source, {
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  });
}

/* --------------------------------------------------------------------------
   Grafik barları
   -------------------------------------------------------------------------- */

/**
 * En son yazılan bar dizisinin imzası — "sembol:aralık" → "adet:son bar saati".
 *
 * DEĞİŞMEYEN GRAFİK YENİDEN YAZILMIYOR. Kotasyonlardaki sorunun aynısı, daha
 * pahalı hâli: Alpaca yanıtı Next'in veri önbelleğinden geldiğinde de bu
 * fonksiyon çalışıyor ve yüzlerce noktalı jsonb dizisi Neon'a yeniden
 * gönderiliyordu — hisse sayfasını açan HER okuyucu için, üstelik barlar
 * günlük grafikte 12 saat, gün içi grafikte seans kapalıyken saatlerce hiç
 * değişmezken.
 *
 * İmza ucuz: dizinin uzunluğu ve son barın zamanı. Yeni bir bar geldiğinde
 * ikisinden biri mutlaka değişiyor, yani gerçek güncelleme hiç kaçmıyor.
 */
const sonBarImzasi = new Map<string, string>();

function barImzasi(bars: Bar[]): string {
  return `${bars.length}:${bars.length > 0 ? bars[bars.length - 1]!.time : 0}`;
}

async function persistBars(
  symbol: string,
  range: ChartRange,
  bars: Bar[],
): Promise<void> {
  const anahtar = `${symbol}:${range}`;
  const imza = barImzasi(bars);
  if (sonBarImzasi.get(anahtar) === imza) return;
  try {
    await db
      .insert(candlesCache)
      .values({ symbol, timeframe: range, bars, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: [candlesCache.symbol, candlesCache.timeframe],
        set: { bars, fetchedAt: new Date() },
      });
    sonBarImzasi.set(anahtar, imza);
  } catch {
    // yoksay
  }
}

/** Çoklu bar yazması — tek upsert. */
async function persistBarsMulti(
  range: ChartRange,
  bySymbol: Record<string, Bar[]>,
): Promise<void> {
  const entries = Object.entries(bySymbol).filter(
    ([symbol, bars]) => sonBarImzasi.get(`${symbol}:${range}`) !== barImzasi(bars),
  );
  if (entries.length === 0) return;
  try {
    const now = new Date();
    await db
      .insert(candlesCache)
      .values(
        entries.map(([symbol, bars]) => ({
          symbol,
          timeframe: range,
          bars,
          fetchedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [candlesCache.symbol, candlesCache.timeframe],
        set: {
          bars: sql`excluded.bars`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
    for (const [symbol, bars] of entries) {
      sonBarImzasi.set(`${symbol}:${range}`, barImzasi(bars));
    }
  } catch {
    // yoksay
  }
}

/**
 * Birden çok sembolün grafik barları.
 *
 * `getChartBars` tek sembolle çalışıyor ve çağıranlar döngüde çağırıyordu:
 * giriş yapmış bir kullanıcının ana sayfası tek çizimde 12 Alpaca isteği +
 * 12 Neon yazması üretiyordu. Sağlayıcı çoklu sembolü zaten destekliyor,
 * yazma da tek upsert'e sığıyor.
 *
 * Sağlayıcı düşerse önbellekteki son barlara düşülür — tek sembollük
 * yoldaki davranışın aynısı, tek sorguda.
 *
 * YEDEK YOL SESSİZ: dönüş tipi yalnızca barlar, yani çağıran bir serinin
 * sağlayıcıdan mı yoksa aylar öncesinden kalmış bir satırdan mı geldiğini
 * ANLAYAMIYOR. Tek sembollük yol bunu `stale` bayrağıyla söylüyor ve ekranda
 * damga çıkıyor; burada öyle bir kanal yok. İki koruma eklendi:
 *
 *   · Satırın yaşı sınırlı. Süresiz bir yedek "son bilinen grafik" değil,
 *     bir enkaz: bir aylık bir satır bugünün grafiği diye çizilirdi. Beş gün,
 *     `alpaca.ts`teki ölü sembol eşiğiyle aynı gerekçe — uzun hafta sonu ve
 *     tatil birleşince dört günü buluyor.
 *   · `allowCache: false` yedeği tamamen kapatıyor. Ekrana çizen çağıranlar
 *     için eski bir seri hiç seriden iyidir; VERİTABANINA YAZAN çağıran için
 *     değil. Teknik analiz fotoğrafı bu yüzden kapalı istiyor (gerekçesi
 *     `getTechnicalSnapshots`te, bayat kotasyon kuralının aynısı).
 */
const BARS_CACHE_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Gün içi aralıklar — bir SEANSIN şeklini çiziyorlar, bir dönemin değil.
 *
 * "1D" tek işlem gününün beş dakikalık barları, "1W" beş günün yarım saatlik
 * barları; ikisinin de son barı içinde bulunduğumuz seansa ait olmalı.
 */
const INTRADAY_RANGES = new Set<ChartRange>(["1D", "1W"]);

/**
 * Önbellekten gelen bar dizisi EKRANIN ANLATTIĞI SEANSI mı çiziyor?
 *
 * Yaş sınırı tek başına yetmiyordu ve eksiği gün içi aralıklarda görünüyor:
 * beş günlük tavan, DÜNKÜ seansın 1G serisini geçerli sayıyor. Ana sayfanın
 * endeks kartlarında bu şöyle çıkıyor — yüzdenin altındaki kıvılcım çizgisi
 * bugünün yüzdesiyle dünün seans şeklini yan yana koyuyor. Aynı hata
 * kotasyon tarafında bir kez bulundu (gerekçesi `MarketStatus.sessionDate`
 * üzerinde); bar tarafında da aynı kural geçerli.
 *
 * Dönemsel aralıklarda (1A ve üstü) kural yaş sınırı olarak kalıyor: oradaki
 * seri zaten günlük/haftalık barlardan kuruluyor ve son barın bugün olması
 * beklenmiyor — seans açıkken günün barı henüz kapanmamış olabilir.
 */
function cachedBarsUsable(
  range: ChartRange,
  bars: Bar[],
  fetchedAt: Date | null,
  status: MarketStatus,
  now: Date = new Date(),
): boolean {
  if (bars.length === 0) return false;
  if (fetchedAt && fetchedAt.getTime() < now.getTime() - BARS_CACHE_MAX_AGE_MS) {
    return false;
  }
  if (!INTRADAY_RANGES.has(range)) return true;
  const last = bars[bars.length - 1];
  return etParts(new Date(last.time * 1000)).dateStr === status.sessionDate;
}

export async function getChartBarsMulti(
  symbolList: string[],
  range: ChartRange,
  status: MarketStatus,
  options: { allowCache?: boolean } = {},
): Promise<Record<string, Bar[]>> {
  const unique = [...new Set(symbolList)];
  if (unique.length === 0) return {};

  const ttl = candleTtlSeconds(range, status);
  const primary = await alpaca.getBarsMulti(unique, range, ttl);
  const out: Record<string, Bar[]> = primary.ok ? { ...primary.data } : {};

  /* Tek sembollük yolla aynı tazelik kuralı (`barsCurrent`): önbellekten
     eski gelen semboller bir kez önbelleksiz, yalnızca onlar. */
  if (primary.ok) {
    /* Yanıt yaşı paketin tamamı için tek ölçü; eskiyse bütün semboller bir
       kez önbelleksiz. */
    const stale = barsCurrent(primary.fetchedAt, status, ttl) ? [] : unique.filter((symbol) => out[symbol]);
    if (stale.length > 0) {
      const retry = await alpaca.getBarsMulti(stale, range, ttl, { fresh: true });
      if (retry.ok) Object.assign(out, retry.data);
    }
  }

  if (primary.ok && Object.keys(primary.data).length > 0) {
    await persistBarsMulti(range, primary.data);
  }

  const missing = unique.filter((symbol) => !out[symbol]);
  if (missing.length === 0 || options.allowCache === false) return out;

  try {
    const rows = await db
      .select()
      .from(candlesCache)
      .where(
        and(
          inArray(candlesCache.symbol, missing),
          eq(candlesCache.timeframe, range),
        ),
      );
    for (const row of rows) {
      if (!row.bars) continue;
      const cached = row.bars as Bar[];
      if (!cachedBarsUsable(range, cached, row.fetchedAt, status)) continue;
      out[row.symbol] = cached;
    }
  } catch {
    // yoksay
  }

  return out;
}

/** SIP'in gecikmesi — gerçek zamanlı kuyruğun "eski" eşiği. */
const SIP_DELAY_SECONDS = 15 * 60;

/**
 * KAPALI PİYASADA YANIT GÜNCEL Mİ — fiyat paketi ve bar serisi için tek kural.
 *
 * Beslemeden seans verisi beklenmeyen anlarda (gece, hafta sonu, ön seansın
 * ilk çeyreği) doğru yanıt, anlatılan seansın verisi TAMAMLANDIKTAN sonra
 * çekilmiş olanı: `status.sessionEnd` (o günün kendi kapanışı + akşam
 * seansı + besleme gecikmesi; yarım günler dahil). Bu an henüz gelmediyse
 * (ön seansın ilk çeyreğinde bugünün sonu ileride) yanıtın bir saatten yeni
 * olması yetiyor — sınırı bekleyen her istek önbelleksiz gitmesin.
 *
 * Ölçü sağlayıcının `Date` başlığı (`responseDate`): önbellek isabetinde de
 * ilk çekimin anını taşıyor, yani stale-while-revalidate'in verdiği eski
 * kayıt burada yakalanıyor.
 */
function closedResponseCurrent(fetchedAt: Date, status: MarketStatus, now: Date): boolean {
  const floor = Math.min(status.sessionEnd.getTime(), now.getTime() - CLOSED_FLOOR_MS);
  return fetchedAt.getTime() >= floor;
}

/**
 * Bar serisi ŞU ANI anlatıyor mu? (3 Ekim) — kotasyondaki `packCurrent`in
 * barlardaki karşılığı.
 *
 * Hisse sayfası grafiği bazen saatler önceki seriyi çiziyordu: barlar
 * Next'in veri önbelleğinden `revalidate` ile geliyor ve süresi dolmuş kayıt
 * stale-while-revalidate ile bir kez DAHA veriliyor — günde birkaç kez açılan
 * bir sembolde o kayıt sabahtan kalma olabiliyor.
 *
 *  - Seans verisi bekleniyorsa (`expectsSessionData`): yanıt TTL + payından
 *    eski olamaz. Tek ölçü bu. Bir dönem gün içi aralıklarda ayrıca "son bar
 *    15 dakika + bar süresi kadar yeni olmalı" deniyordu; yanıt tazeyse seri
 *    zaten sağlayıcının verebildiği en yeni seri, ve az işlem gören bir
 *    sembolde (SHAZ: 79 kovanın 73'ünde işlem) son dakikalarda bar olmaması
 *    gerçek bir durum — kural onu her istekte önbelleksiz tekrara
 *    zorluyordu.
 *  - Beklenmiyorsa (gece, hafta sonu): `closedResponseCurrent`.
 *
 * Güncel değilse çağıran bir kez önbelleksiz tekrarlıyor. Dışa açık YALNIZCA
 * test için (tests/chart-freshness.test.ts).
 */
export function barsCurrent(
  fetchedAt: Date,
  status: MarketStatus,
  ttl: number,
  now: Date = new Date(),
): boolean {
  if (!expectsSessionData(status, now)) return closedResponseCurrent(fetchedAt, status, now);
  return now.getTime() - fetchedAt.getTime() <= (ttl + RESPONSE_AGE_SLACK_SECONDS) * 1000;
}

/**
 * SIP serisinin bittiği yerden sonrasını gerçek zamanlı IEX barlarıyla
 * tamamlar. Yalnızca SON SIP barından SONRAKİ barlar ekleniyor (aynı kova
 * iki kez çizilmiyor), gelecekte zaman damgası taşıyan bar atılıyor. 1G'de
 * sonuç yeniden son işlem gününe süzülüyor: ön seansın başında SIP serisi
 * hâlâ dünü taşırken IEX bugünün ilk barlarını verirse grafik yalnızca bugünü
 * çiziyor, iki günü yan yana değil.
 *
 * Dışa açık YALNIZCA test için.
 */
export function spliceRealtimeTail(
  sip: readonly Bar[],
  iex: readonly Bar[],
  range: ChartRange,
  now: Date = new Date(),
): { bars: Bar[]; added: number } {
  const lastSip = sip[sip.length - 1]?.time ?? 0;
  const nowSec = now.getTime() / 1000;
  const tail = iex.filter((bar) => bar.time > lastSip && bar.time <= nowSec);
  if (tail.length === 0) return { bars: [...sip], added: 0 };
  const merged = [...sip, ...tail];
  const bars = range === "1D" ? alpaca.onlyLastTradingDay(merged) : merged;
  return { bars, added: tail.length };
}

/** Kuyruğun TTL'i: seans içinde 20 saniye — başlıktaki melez fiyatın ritmi. */
const TAIL_TTL_SECONDS = 20;

export async function getChartBars(
  symbol: string,
  range: ChartRange,
  status: MarketStatus,
): Promise<ProviderResult<Bar[]>> {
  const ttl = candleTtlSeconds(range, status);
  let primary = await alpaca.getBars(symbol, range, ttl);

  /* Önbellekten eski seri geldiyse bir kez önbelleksiz (gerekçe
     `barsCurrent`). */
  if (primary.ok && !barsCurrent(primary.fetchedAt, status, ttl)) {
    const retry = await alpaca.getBars(symbol, range, ttl, { fresh: true });
    /* Tekrar da düşerse eldeki seri gösteriliyor ama KENDİNİ ESKİ İLAN
       EDİYOR — kotasyondaki kuralın aynısı. */
    primary = retry.ok ? retry : { ...primary, stale: true };
  }

  if (primary.ok) {
    // Beklenerek çağrılır: tek gidiş-dönüş, ve `void` bırakıldığında
    // sunucusuz fonksiyon donunca yazma yarıda kesilebiliyordu.
    // Önbelleğe YALNIZCA SIP serisi yazılıyor; gerçek zamanlı kuyruk her
    // istekte yeniden ekleniyor, saklanan seri tek kaynaklı kalıyor.
    await persistBars(symbol, range, primary.data);

    /* GERÇEK ZAMANLI KUYRUK — seans açıkken gün içi aralıklarda. Kuyruk
       alınamazsa SIP serisi tek başına çiziliyor (15 dakika geriden). */
    /* YALNIZCA ANA SEANSTA (3 Ekim). IEX 08:00'den önce ve 17:00 ET'den sonra
       işlem görmüyor; uzatılmış seansta kuyruk ya boş geliyordu ya da ince
       likiditenin fiyatını taşıyordu, boş geldiğinde de her istek
       önbelleksiz tekrara düşüyordu. Başlıktaki melez kotasyon da yalnızca
       ana seansta (`overlayRealtime`) — eğrinin ucu ile fiyat aynı kuralda. */
    if ((range === "1D" || range === "1W") && status.session === "regular") {
      const lastSip = primary.data[primary.data.length - 1]?.time ?? 0;
      let tail = await alpaca.getIexBarsSince(symbol, range, lastSip, TAIL_TTL_SECONDS);
      /* Kuyruğun kendisi de önbellekten eski gelebilir: son barı beş
         dakikadan eskiyse (ve SIP ucundan sonra bir şey vermediyse) bir kez
         önbelleksiz. */
      const tailLast = tail.ok ? tail.data[tail.data.length - 1]?.time ?? 0 : 0;
      if (tail.ok && Date.now() / 1000 - Math.max(tailLast, lastSip) > SIP_DELAY_SECONDS) {
        const retry = await alpaca.getIexBarsSince(symbol, range, lastSip, TAIL_TTL_SECONDS, { fresh: true });
        if (retry.ok) tail = retry;
      }
      if (tail.ok) {
        const spliced = spliceRealtimeTail(primary.data, tail.data, range);
        if (spliced.added > 0) {
          return ok(spliced.bars, "alpaca-mixed", { fetchedAt: new Date() });
        }
      }
    }
    return primary;
  }

  try {
    const [row] = await db
      .select()
      .from(candlesCache)
      .where(
        and(
          eq(candlesCache.symbol, symbol),
          eq(candlesCache.timeframe, range),
        ),
      )
      .limit(1);

    /* YAŞ SINIRI BU YOLDA YOKTU. Çoklu yol satırın yaşına bakıyordu, tek
       sembollük yol bakmıyordu: aylar öncesinden kalmış bir satır "1Y grafiği"
       diye çizilebiliyordu. Aynı kural, aynı yardımcı — gün içi aralıklarda
       seans günü, dönemsel aralıklarda beş günlük tavan. */
    const cached = row?.bars ? (row.bars as Bar[]) : null;
    if (cached && cachedBarsUsable(range, cached, row.fetchedAt, status)) {
      return ok(cached, "cache", {
        stale: true,
        fetchedAt: row.fetchedAt,
      });
    }
  } catch {
    // yoksay
  }

  return primary;
}

/* --------------------------------------------------------------------------
   Şirket profili — Finnhub'dan gelir, symbols tablosunda kalıcılaşır
   -------------------------------------------------------------------------- */

export async function getCompanyProfile(
  symbol: string,
): Promise<ProviderResult<CompanyProfile>> {
  const live = await finnhub.getProfile(symbol);

  if (live.ok) {
    try {
      const profile = live.data;
      await db
        .insert(symbolsTable)
        .values({
          symbol: profile.symbol,
          name: profile.name,
          exchange: profile.exchange,
          industry: profile.industry,
          logoUrl: profile.logoUrl,
          country: profile.country,
          currency: profile.currency,
          marketCap: profile.marketCap,
          shareOutstanding: profile.shareOutstanding,
          ipoDate: profile.ipoDate,
          weburl: profile.weburl,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: symbolsTable.symbol,
          set: {
            name: profile.name,
            exchange: profile.exchange,
            industry: profile.industry,
            logoUrl: profile.logoUrl,
            marketCap: profile.marketCap,
            shareOutstanding: profile.shareOutstanding,
            weburl: profile.weburl,
            updatedAt: new Date(),
          },
        });
    } catch {
      // yoksay
    }
    /* Veritabanına KAYNAK adresi yazılıyor (indirme betiği onu okuyor),
       ekrana dönen ise yerel dosya. İkisi ayrı: biri kaynak kaydı, öteki
       sunum. Gerekçe `lib/logos.ts`'te. */
    return ok(
      { ...live.data, logoUrl: logoSrc(live.data.symbol, live.data.logoUrl) },
      live.source,
      { fetchedAt: live.fetchedAt, stale: live.stale },
    );
  }

  try {
    const [row] = await db
      .select()
      .from(symbolsTable)
      .where(eq(symbolsTable.symbol, symbol))
      .limit(1);

    if (row) {
      return ok(
        {
          symbol: row.symbol,
          name: row.name,
          exchange: row.exchange,
          industry: row.industry,
          logoUrl: logoSrc(row.symbol, row.logoUrl),
          country: row.country,
          currency: row.currency,
          marketCap: row.marketCap,
          shareOutstanding: row.shareOutstanding,
          ipoDate: row.ipoDate,
          weburl: row.weburl,
        },
        "cache",
        { stale: true, fetchedAt: row.updatedAt },
      );
    }
  } catch {
    // yoksay
  }

  return live;
}
