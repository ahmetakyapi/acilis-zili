import { cache } from "react";
import { saglayiciMetni } from "@/lib/text";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { logoSrc } from "./logos";
import { indexMemberOf } from "../db/seed/indices";
import {
  dailyBriefs,
  earningsAnalyses,
  earningsCalendar,
  economicEvents,
  macroSeries,
  marketHolidays,
  news,
  quotesCache as quotesCacheTable,
  stories,
  symbols as symbolsTable,
  watchlistItems,
  watchlists,
  type DailyBriefRow,
  type EconomicEventRow,
  type EarningsAnalysisRow,
  type EarningsRow,
  type MacroSeriesRow,
  type NewsRow,
  type StoryRow,
} from "./schema";
import {
  addEtDays,
  etParts,
  getMarketStatus,
  todayEt,
  type MarketHoliday,
  type MarketStatus,
} from "./market-hours";
import type { BriefPeriod } from "./brief";

/**
 * Sayfaların kullandığı okuma fonksiyonları.
 * Hepsi hata durumunda boş değer döner — sayfa hiçbir zaman DB hatasıyla
 * çökmez, ilgili kart "veri yok" gösterir.
 */

/* React `cache()`: bir istek boyunca ilk çağrı sonucu paylaşılır.
   Tatil listesi ve ondan türeyen seans durumu tek bir sayfada dört-beş kez
   sorulabiliyor (ana sayfada endeks şeridi, dünya kartı, favoriler ve
   sayfanın kendisi) ve her biri ayrı bir veritabanı gidiş-dönüşüydü. Veri
   gün içinde değişmediği için tekrar sorulmasının bir faydası yok.
   İstekler arasında paylaşılmaz — istemcilerin verisi karışmaz. */
/* İSTEKLER ARASINDA DA ÖNBELLEKLİ. `cache()` yalnızca tek bir istek boyunca
   paylaşıyor; tatil listesi ise yılda birkaç kez değişen bir veri ve
   `getStatus` üzerinden sitedeki HER çizimde en az bir kez soruluyordu
   (ana sayfa, layout'taki şerit, /piyasalar, /sirketler, /hisse,
   /favoriler, /api/chart). Yani her sayfa görüntülemesi bir Neon
   gidiş-dönüşünü (~30-60 ms) tatil takvimine harcıyordu.

   Süre 24 saat. Etiket dışa açık ama şu an kimse tetiklemiyor: tatilleri
   yazan tek yer `db/seed/index.ts` ve o bir betik — `revalidateTag` yalnızca
   istek bağlamında (server action ya da route handler) çalışır. Yani seed
   koştuktan sonra liste en geç bir gün içinde yerine oturur. Anında
   gerekirse etiket hazır; bir uçtan `revalidateTag(HOLIDAYS_TAG)` yeter.
   Dıştaki `cache()` duruyor — aynı istekte tekrar sorulmasını o engelliyor. */
export const HOLIDAYS_TAG = "holidays";

/* HATA ÖNBELLEĞE GİRMEZ. İçerideki fonksiyon hatayı YUTMUYOR, fırlatıyor:
   `unstable_cache` yalnızca başarılı sonucu saklıyor. Yutulsaydı, Neon'un
   bir saniyelik kesintisi "bu yıl tatil yok" cevabını 24 saat boyunca
   dondurur ve site kapalı günleri açık sanardı. Boş listeye düşme kararı
   dışarıda, önbelleğin ötesinde. */
const loadHolidays = unstable_cache(
  async function loadHolidays(): Promise<MarketHoliday[]> {
    const rows = await db.select().from(marketHolidays);
    return rows.map((r) => ({
      date: r.date,
      nameTr: r.nameTr,
      nameEn: r.nameEn,
      earlyCloseEt: r.earlyCloseEt,
    }));
  },
  ["market-holidays"],
  { revalidate: 86_400, tags: [HOLIDAYS_TAG] },
);

export const getHolidays = cache(async function getHolidays(): Promise<
  MarketHoliday[]
> {
  try {
    return await loadHolidays();
  } catch (error) {
    yutuldu("loadHolidays", error);
    return [];
  }
});

export const getStatus = cache(async function getStatus(): Promise<MarketStatus> {
  const holidays = await getHolidays();
  return getMarketStatus(new Date(), holidays);
});

/**
 * Yutulan veritabanı hatası — SESSİZ DEĞİL, İZLİ.
 *
 * Bu dosyadaki okuma fonksiyonları hatayı yutup boş sonuç dönüyor ve bu
 * bilinçli: bir sorgunun düşmesi sayfayı çökertmemeli. Ama iz de
 * bırakmıyorlardı — Neon bir saat kesintiye girse sunucu günlüğünde tek satır
 * çıkmıyor, ekranda yalnızca "kayıt yok" görünüyordu. Yani ürünün en kötü
 * günü, en sessiz günü oluyordu.
 *
 * `console.error` sunucuda çalışıyor ve Vercel günlüklerine düşüyor;
 * okuyucuya hiçbir şey gitmiyor. Mesaj kısa tutuluyor: hangi sorgu, hangi
 * hata.
 */
function yutuldu(kaynak: string, error: unknown): void {
  const mesaj = error instanceof Error ? error.message : String(error);
  console.error(`[veri] ${kaynak} okunamadı: ${mesaj}`);
}

/* ---- Ekonomik takvim ---- */

/* Aynı aralık bir sayfada birden fazla bileşen tarafından isteniyor
   (ana sayfada gün şeridi ve bugünün takvimi). cache() argümanlara göre
   ayırır, yani farklı aralıklar hâlâ ayrı sorgu. */
export const getEventsBetween = cache(async function getEventsBetween(
  from: string,
  to: string,
): Promise<EconomicEventRow[]> {
  try {
    return await db
      .select()
      .from(economicEvents)
      .where(and(gte(economicEvents.eventDate, from), lte(economicEvents.eventDate, to)))
      .orderBy(asc(economicEvents.eventDate), asc(economicEvents.eventTimeEt));
  } catch (error) {
    yutuldu("loadHolidays", error);
    return [];
  }
});

export async function getTodayEvents(): Promise<EconomicEventRow[]> {
  const today = todayEt();
  return getEventsBetween(today, today);
}

/** Bugün olay yoksa ileriye bakan ilk N olay. */
export async function getUpcomingEvents(limit = 6): Promise<EconomicEventRow[]> {
  try {
    return await db
      .select()
      .from(economicEvents)
      .where(gte(economicEvents.eventDate, todayEt()))
      .orderBy(asc(economicEvents.eventDate), asc(economicEvents.eventTimeEt))
      .limit(limit);
  } catch (error) {
    yutuldu("getUpcomingEvents", error);
    return [];
  }
}

/* ---- Bilanço takvimi ---- */

/**
 * REVİZE EDİLMİŞ TARİHİN ESKİ SATIRINI ELER.
 *
 * Tablonun tekil anahtarı `(symbol, report_date)`. Sağlayıcı bir şirketin
 * beklenen rapor tarihini değiştirdiğinde (sık oluyor: "27 Ağustos" derken
 * "20 Ağustos"a çekiyor) upsert eski satırı GÜNCELLEMİYOR, yenisini
 * ekliyor — eskisi tabloda ölü olarak kalıyor. Ölçüldü: 566 sembol-çeyrek
 * çifti birden fazla tarihte duruyordu. Takvimde aynı şirket aynı çeyrek
 * için iki kez görünüyor, hatta sağlayıcının artık söylemediği bir tarihte
 * tek başına görünüyordu.
 *
 * Hangisi doğru: cron her koşuda sağlayıcının O AN söylediği satırları
 * yazıyor, yani `updated_at` en yeni olan güncel olan. Ölçüldü: 566 çiftin
 * 566'sında en yeni damga TEK, yani beraberlik yok.
 *
 * Çeyreği bilinmeyen satır elenmez — gruplanacak bir anahtarı yok.
 */
const guncelBilanco = sql`(
  ${earningsCalendar.quarter} is null
  or ${earningsCalendar.year} is null
  or ${earningsCalendar.updatedAt} = (
    select max(u.updated_at) from earnings_calendar u
    where u.symbol = ${earningsCalendar.symbol}
      and u.quarter = ${earningsCalendar.quarter}
      and u.year = ${earningsCalendar.year}
  )
)`;

export const getEarningsBetween = cache(async function getEarningsBetween(
  from: string,
  to: string,
): Promise<EarningsRow[]> {
  try {
    return await db
      .select()
      .from(earningsCalendar)
      .where(
        and(
          gte(earningsCalendar.reportDate, from),
          lte(earningsCalendar.reportDate, to),
          guncelBilanco,
        ),
      )
      .orderBy(asc(earningsCalendar.reportDate));
  } catch (error) {
    yutuldu("getUpcomingEvents", error);
    return [];
  }
});

export type UpcomingRow = {
  id: string;
  symbol: string;
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  name: string | null;
  logoUrl: string | null;
  marketCap: number | null;
};

/**
 * Yaklaşan bilançolar — EN BÜYÜKLERİ, veritabanında süzülmüş.
 *
 * Analizler ekranı bunu 30 günlük TAKVİMİN TAMAMINI çekip bellekte
 * sıralayarak yapıyordu: bilanço sezonunda birkaç bin satır Neon'dan HTTP
 * üzerinden geliyor, ardından o satırların tekil sembolleriyle ikinci bir
 * `getSymbolNames` çağrılıyordu (binlerce elemanlı `inArray`), ve bütün bu
 * işin çıktısı ekrandaki BEŞ satırdı.
 *
 * Sıralama iki kademeli ve ikisi de sorguda: aynı sembolün birden çok tarihi
 * varsa (sağlayıcı tahmini güncellerken eski satırı bırakıyor) en yakın
 * tarih alınır, sonra piyasa değerine göre sıralanır. Piyasa değeri
 * bilinmeyen sembol en sona düşer — `symbols` tablosunda karşılığı olmayan
 * satırlar da listeden çıkmaz, sadece geriye gider.
 */
export async function getUpcomingEarnings(
  from: string,
  to: string,
  limit: number,
  options: {
    /* Takip edilenler öne alınır. Liste kullanıcıya özel olduğu için
       sıralama ifadesine parametre olarak giriyor; boşsa koşul yazılmıyor. */
    preferred?: string[];
    /** Sayfanın kendi sembolü listede durmasın. */
    exclude?: string;
    /* Sektör süzgeci. Eşleme kodda olduğu için (lib/sectors.ts) buraya alt
       sektör adlarının kendisi geliyor; "Diğer" grubu `include: false` ile
       tersine çalışıyor. */
    industries?: { industries: readonly string[]; include: boolean };
  } = {},
): Promise<UpcomingRow[]> {
  const preferred = options.preferred ?? [];
  try {
    /* DISTINCT ON: aynı sembolün en yakın tarihli satırı. Sağlayıcı tahmini
       güncellerken eski satırı bırakabiliyor ve panelde aynı şirket iki kez
       görünüyordu. Postgres'e özgü ama şema zaten Postgres'e bağlı.

       Sıralama ve LİMİT dışarıda: DISTINCT ON, ORDER BY'ın kendi sütunuyla
       başlamasını şart koşuyor, oysa sıralama ölçütü piyasa değeri. İç
       sorgu alt sorgu olarak sarılıyor ve tavan orada uygulanıyor —
       ekrana beş satır gidecekse Neon'dan da beş satır gelmeli. */
    const uniq = db
      .selectDistinctOn([earningsCalendar.symbol], {
        id: earningsCalendar.id,
        symbol: earningsCalendar.symbol,
        reportDate: earningsCalendar.reportDate,
        hour: earningsCalendar.hour,
        epsEstimate: earningsCalendar.epsEstimate,
        name: symbolsTable.name,
        logoUrl: symbolsTable.logoUrl,
        marketCap: symbolsTable.marketCap,
      })
      .from(earningsCalendar)
      .leftJoin(symbolsTable, eq(symbolsTable.symbol, earningsCalendar.symbol))
      .where(
        and(
          gte(earningsCalendar.reportDate, from),
          lte(earningsCalendar.reportDate, to),
          guncelBilanco,
          options.exclude
            ? sql`${earningsCalendar.symbol} <> ${options.exclude}`
            : undefined,
          options.industries
            ? options.industries.include
              ? inArray(symbolsTable.industry, [...options.industries.industries])
              : /* "Diğer" grubu: bilinen hiçbir adı taşımayanlar VE alt
                   sektörü boş olanlar. `NOT IN` null'ı eleyeceği için
                   ikinci koşul ayrıca yazılıyor. */
                sql`(${symbolsTable.industry} is null or ${
                  symbolsTable.industry
                } not in (${sql.join(
                  [...options.industries.industries].map((name) => sql`${name}`),
                  sql`, `,
                )}))`
            : undefined,
        ),
      )
      .orderBy(asc(earningsCalendar.symbol), asc(earningsCalendar.reportDate))
      .as("yaklasan");

    /* Piyasa değeri bilinmeyen sembol (symbols tablosunda karşılığı yok)
       listeden çıkmıyor, sadece sona düşüyor. */
    const order: SQL[] = [sql`${uniq.marketCap} desc nulls last`];
    if (preferred.length > 0) {
      /* Tercih koşulu YALNIZCA liste doluyken ekleniyor. Boşken sabit bir
         ifade (`sql\`0\``) yazmak sessizce kırıyordu: Postgres ORDER BY
         içindeki çıplak tam sayıyı SÜTUN SIRASI sayıyor ve `ORDER BY 0`
         hata veriyor — hata yutulduğu için panel boş görünüyordu. */
      order.unshift(
        sql`case when ${uniq.symbol} in (${sql.join(
          [...new Set(preferred)].map((symbol) => sql`${symbol}`),
          sql`, `,
        )}) then 0 else 1 end`,
      );
    }

    const rows = await db.select().from(uniq).orderBy(...order).limit(limit);

    return rows.map((row) => ({
      ...row,
      logoUrl: logoSrc(row.symbol, row.logoUrl),
    }));
  } catch (error) {
    yutuldu("getUpcomingEarnings", error);
    return [];
  }
}

export async function getNextEarnings(
  symbol: string,
): Promise<EarningsRow | null> {
  try {
    const [row] = await db
      .select()
      .from(earningsCalendar)
      .where(
        and(
          eq(earningsCalendar.symbol, symbol),
          gte(earningsCalendar.reportDate, todayEt()),
          guncelBilanco,
        ),
      )
      .orderBy(asc(earningsCalendar.reportDate))
      .limit(1);
    return row ?? null;
  } catch (error) {
    yutuldu("getNextEarnings", error);
    return null;
  }
}

export async function getEarningsForSymbol(
  symbol: string,
  limit = 8,
): Promise<EarningsRow[]> {
  try {
    return await db
      .select()
      .from(earningsCalendar)
      .where(and(eq(earningsCalendar.symbol, symbol), guncelBilanco))
      .orderBy(desc(earningsCalendar.reportDate))
      .limit(limit);
  } catch (error) {
    yutuldu("getEarningsForSymbol", error);
    return [];
  }
}

/* ---- Haberler ---- */

/**
 * Satırın serbest metnini ekrana hazırlar.
 *
 * Temizlik girişte de yapılıyor (`toNewsItems`), ama veritabanında zaten
 * yazılmış satırlar var: ölçüldü, 400 haberin 36'sı ham HTML varlığı, 19'u
 * kodlama bozukluğu taşıyordu. Okuma tarafında da çalıştırmak geçmişi tek
 * hamlede düzeltiyor; işlem idempotent ve yalnızca ekrana basılan birkaç
 * düzine satırda dönüyor. Gerekçenin tamamı lib/text.ts'te.
 */
function haberiTemizle(row: NewsRow): NewsRow {
  return {
    ...row,
    headline: saglayiciMetni(row.headline) ?? row.headline,
    summary: saglayiciMetni(row.summary),
    headlineTr: saglayiciMetni(row.headlineTr),
    summaryTr: saglayiciMetni(row.summaryTr),
  };
}

/* `cache()`: haber detayı aynı satırı İKİ KEZ istiyor — bir kez künye için
   (`generateMetadata`), bir kez sayfa gövdesi için. İkisi aynı istekte
   çalıştığı için tek sorguya iniyor. */
export const getNewsById = cache(async function getNewsById(
  id: string,
): Promise<NewsRow | null> {
  try {
    const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
    return row ? haberiTemizle(row) : null;
  } catch (error) {
    yutuldu("getEarningsForSymbol", error);
    return null;
  }
});

/**
 * Görsel gerçekten habere mi ait?
 * Sağlayıcılar makale görseli yoksa kaynağın logosunu yolluyor; o logo
 * onlarca haberde tekrar eder. Aynı adres birden çok haberde geçiyorsa
 * jenerik sayılır ve gösterilmez — okuyucuya bilgi taşımaz.
 */
/**
 * Liste için toplu sürüm — her habere ayrı sorgu atmak yerine tek sorguda
 * "birden çok haberde geçen" görselleri bulur. Sağlayıcılar makale görseli
 * yoksa kaynak logosunu yolluyor; aynı URL onlarca haberde tekrar ediyor ve
 * liste aynı Reuters logosuyla doluyordu.
 */
export async function getGenericImageUrls(
  urls: (string | null)[],
): Promise<Set<string>> {
  const candidates = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  if (candidates.length === 0) return new Set();

  const generic = new Set(candidates.filter((u) => /\blogo\b/i.test(u)));

  try {
    const rows = await db
      .select({
        imageUrl: news.imageUrl,
        uses: sql<number>`count(*)::int`,
      })
      .from(news)
      .where(inArray(news.imageUrl, candidates))
      .groupBy(news.imageUrl);

    for (const row of rows) {
      if (row.imageUrl && row.uses > 1) generic.add(row.imageUrl);
    }
  } catch (error) {
    yutuldu("getGenericImageUrls", error);
    // Sorgu düşerse yalnızca ad kalıbıyla elenenler gizlenir.
  }

  return generic;
}

export async function isGenericNewsImage(imageUrl: string): Promise<boolean> {
  if (/\blogo\b/i.test(imageUrl)) return true;
  try {
    const [row] = await db
      .select({ uses: sql<number>`count(*)::int` })
      .from(news)
      .where(eq(news.imageUrl, imageUrl));
    return (row?.uses ?? 0) > 1;
  } catch (error) {
    yutuldu("isGenericNewsImage", error);
    return false;
  }
}

/**
 * AYNI HABER AYNI GÜN İKİ KEZ GELEBİLİYOR.
 *
 * Tekilleştirme sağlayıcının kimliğine (`provider_id`) bakıyor ve aynı yazı
 * bazen iki ayrı kimlikle düşüyor — biri kaynağın kendi adresiyle, biri
 * sağlayıcının yönlendirme adresiyle. Ölçüldü: son haftada bir yazı
 * ("California AG tells CNBC…") aynı gün 10:51 ve 14:52'de iki kayıt olarak
 * duruyordu ve listede iki kez görünüyordu.
 *
 * Ölçüt AYNI GÜN + AYNI MANŞET. Yalnızca manşete bakmak yanlış olurdu:
 * bazı kaynaklar her gün aynı başlıkla köşe yazıyor ("10 Information
 * Technology Stocks Whale Activity In Today's Session" son iki haftada altı
 * kez) ve onlar gerçekten farklı yazılar. Gün ayrımı New York takviminden,
 * çünkü haber akışı o günün seansına ait.
 */
function ayniGunTekille(rows: NewsRow[]): NewsRow[] {
  const gorulen = new Set<string>();
  const kept: NewsRow[] = [];
  for (const row of rows) {
    const key = `${etParts(row.publishedAt).dateStr}|${row.headline.trim().toLowerCase()}`;
    if (gorulen.has(key)) continue;
    gorulen.add(key);
    kept.push(row);
  }
  return kept;
}

export async function getLatestNews(limit = 20): Promise<NewsRow[]> {
  try {
    /* Tekilleştirme sorgudan SONRA olduğu için pencere geniş çekiliyor;
       yoksa elenen her satır listeyi kısaltırdı. */
    const rows = await db
      .select()
      .from(news)
      .orderBy(desc(news.publishedAt))
      .limit(limit + 12);
    return ayniGunTekille(rows).slice(0, limit).map(haberiTemizle);
  } catch (error) {
    yutuldu("getLatestNews", error);
    return [];
  }
}

/**
 * Bir sembolün haberleri — FİLTRE VERİTABANINDA.
 *
 * `/haberler?sembol=NVDA` bir dönem en yeni 60 haberi çekip bellekte
 * süzüyordu: hareketli bir günde o pencere birkaç saati kapsıyor ve sembol
 * o aralıkta geçmiyorsa sayfa "haber yok" diyordu — oysa dünkü haberler
 * tabloda duruyordu. Sayfalama da yalancıydı: 60 satırın kaçının kaldığına
 * bağlıydı.
 *
 * `symbols` bir metin dizisi; Postgres'in dizi içerme operatörü tam da bunun
 * için var. Tabloda `news_published_idx` zaten tarihe göre sıralı okuyor.
 */
export async function getNewsForSymbol(
  symbol: string,
  limit = 60,
): Promise<NewsRow[]> {
  try {
    const rows = await db
      .select()
      .from(news)
      .where(sql`${news.symbols} @> ARRAY[${symbol}]::text[]`)
      .orderBy(desc(news.publishedAt))
      .limit(limit);
    return rows.map(haberiTemizle);
  } catch (error) {
    yutuldu("getNewsForSymbol", error);
    return [];
  }
}

/* ---- Günlük özet ---- */

/**
 * Bültenlerin yazılma saatleri, Türkiye saatiyle.
 *
 * Metinleri claude.ai zamanlanmış görevleri yazıyor (docs/claude-rutinler.md):
 * günlük 16:00'da — Vercel senkronundan sonra, ABD açılışından hemen önce —
 * ve haftalık pazartesi 09:30'da. Sayı burada duruyor çünkü ekranda da
 * söyleniyor: bugünün özeti henüz yoksa kart okuyucuya ne zaman geleceğini
 * yazıyor. Rutinlerin saati değişirse burası da değişmeli.
 */
export const BRIEF_PUBLISH_TR: Record<BriefPeriod, string> = {
  daily: "16:00",
  weekly: "09:30",
};

/**
 * Belirli bir günün bülteni. Tablo (tarih, dil) benzersiz olduğu için her gün
 * kendi kaydını tutar — arşiv zaten birikmiş durumda, tek yaptığımız onu
 * okunabilir hale getirmek.
 */
export async function getBriefByDate(
  date: string,
  locale: string,
  period: BriefPeriod = "daily",
): Promise<DailyBriefRow | null> {
  try {
    /* Mercek'teki dil kuralının aynısı: istenen dil varsa o, yoksa yazılan
       dil — sayfa dil notunu satırdaki `locale` alanından basar. */
    const rows = await db
      .select()
      .from(dailyBriefs)
      .where(
        and(eq(dailyBriefs.briefDate, date), eq(dailyBriefs.period, period)),
      )
      .limit(4);
    return rows.find((row) => row.locale === locale) ?? rows[0] ?? null;
  } catch (error) {
    yutuldu("getBriefByDate", error);
    return null;
  }
}

export type BriefIndexRow = {
  briefDate: string;
  headline: string;
  generatedBy: string;
  period: string;
  locale: string;
};

/**
 * Dönemin en yeni kaydı.
 *
 * Bülten sayfası eskiden önce arşiv listesini çekip, listenin ilk satırından
 * tarihi okuyup, sonra o tarihin metnini çekiyordu — iki sorgu ARKA ARKAYA.
 * Günlük/haftalık sekmesi her değiştiğinde iki tam gidiş-dönüş bekleniyordu
 * ve geçiş takılıyordu. Bu fonksiyon zinciri kırıyor: seçili tarih
 * belirtilmediğinde en yeni kayıt doğrudan çekilebiliyor ve iki sorgu
 * paralel gidiyor.
 */
export async function getLatestBrief(
  locale: string,
  period: BriefPeriod = "daily",
): Promise<DailyBriefRow | null> {
  try {
    /* Dil süzgeci sorguda değil sonra: en yeni GÜNÜN kaydı esas alınır ve
       o günün içinde istenen dil tercih edilir. Çeviri bir gün geride
       kaldığında İngilizce okur dünkü İngilizce yerine bugünkü Türkçeyi
       (dil notuyla) görür — bülten güne bağlı bir metin, tazelik dilden
       önce gelir. */
    const rows = await db
      .select()
      .from(dailyBriefs)
      .where(eq(dailyBriefs.period, period))
      .orderBy(desc(dailyBriefs.briefDate))
      .limit(4);
    if (rows.length === 0) return null;
    const latestDate = rows[0].briefDate;
    const sameDay = rows.filter((row) => row.briefDate === latestDate);
    return sameDay.find((row) => row.locale === locale) ?? sameDay[0];
  } catch (error) {
    yutuldu("getLatestBrief", error);
    return null;
  }
}

/**
 * Arşiv listesi — yeniden eskiye, gövde metni taşınmaz.
 * Gün başına tek satır: istenen dildeki kayıt varsa o, yoksa yazılan dil.
 */
export async function getBriefArchive(
  locale: string,
  period: BriefPeriod,
  limit = 60,
): Promise<BriefIndexRow[]> {
  try {
    const rows = await db
      .select({
        briefDate: dailyBriefs.briefDate,
        headline: dailyBriefs.headline,
        generatedBy: dailyBriefs.generatedBy,
        period: dailyBriefs.period,
        locale: dailyBriefs.locale,
      })
      .from(dailyBriefs)
      .where(eq(dailyBriefs.period, period))
      .orderBy(desc(dailyBriefs.briefDate))
      .limit(limit * 2);

    const byDate = new Map<string, BriefIndexRow>();
    for (const row of rows) {
      const held = byDate.get(row.briefDate);
      if (!held) {
        byDate.set(row.briefDate, row);
      } else if (held.locale !== locale && row.locale === locale) {
        byDate.set(row.briefDate, row);
      }
    }
    return [...byDate.values()].slice(0, limit);
  } catch (error) {
    yutuldu("getBriefArchive", error);
    return [];
  }
}

/** Verilen günü kapsayan haftanın pazartesisi — haftalık kaydın çapası. */
export function weekAnchor(dateEt: string): string {
  const d = new Date(`${dateEt}T00:00:00Z`);
  // getUTCDay: 0 pazar … 6 cumartesi. Pazar, biten haftaya sayılır.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/* ---- Makro ---- */

export async function getMacroRows(): Promise<MacroSeriesRow[]> {
  try {
    return await db.select().from(macroSeries).orderBy(asc(macroSeries.slug));
  } catch (error) {
    yutuldu("getMacroRows", error);
    return [];
  }
}

/* ---- Kullanıcı listeleri ---- */

export type WatchlistWithItems = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  items: { id: string; symbol: string; note: string | null }[];
};

export async function getUserWatchlists(
  userId: string,
): Promise<WatchlistWithItems[]> {
  try {
    /* TEK SORGU. Önce listeler, sonra o listelerin öğeleri diye iki ardışık
       tur atılıyordu ve neon-http'de her sorgu ayrı bir HTTP gidiş-dönüşü.
       `leftJoin` ikisini tek turda getiriyor; gruplama bellekte. Boş liste de
       görünmeye devam ediyor — `left` join olması tam bunun için. */
    const rows = await db
      .select({
        list: watchlists,
        item: watchlistItems,
      })
      .from(watchlists)
      .leftJoin(watchlistItems, eq(watchlistItems.watchlistId, watchlists.id))
      .where(eq(watchlists.userId, userId))
      .orderBy(
        asc(watchlists.sortOrder),
        asc(watchlists.createdAt),
        asc(watchlistItems.sortOrder),
        asc(watchlistItems.addedAt),
      );

    if (rows.length === 0) return [];

    const lists = [...new Map(rows.map((r) => [r.list.id, r.list])).values()];
    const items = rows
      .map((r) => r.item)
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      color: list.color,
      sortOrder: list.sortOrder,
      items: items
        .filter((item) => item.watchlistId === list.id)
        .map((item) => ({ id: item.id, symbol: item.symbol, note: item.note })),
    }));
  } catch (error) {
    yutuldu("getUserWatchlists", error);
    return [];
  }
}

export async function getUserSymbols(userId: string): Promise<string[]> {
  const lists = await getUserWatchlists(userId);
  return [...new Set(lists.flatMap((l) => l.items.map((i) => i.symbol)))];
}

/* ---- Sembol adları (kartlarda isim göstermek için) ---- */

export type SymbolMeta = {
  name: string;
  indexProxy: boolean;
  /**
   * Piyasa değeri — ÖNBELLEKTEKİ fiyattan hesaplanmış, kayıtlı fotoğraf
   * değil. Yalnızca USD cinsinden; yabancı para birimleri (ör. TSM/TWD)
   * karşılaştırılamaz olduğu için null.
   *
   * Aynı düzeltme `/sirketler` için yapılmıştı (bkz. `CompanyRow.marketCap`)
   * ama `getSymbolNames` atlanmıştı — oysa bilanço takvimi, ana sayfadaki
   * bilanço paneli ve hisse sayfasının benzer şirketler listesi hep buradan
   * besleniyor. Ölçüldü: kayıtlı değer 772 sembolde ORTALAMA %28,9
   * sapıyordu; WDAY takvimde 39,1 Mr $, dizinde 49,4 Mr $ görünüyordu.
   *
   * Sapma yalnızca ekrandaki sayıyı bozmuyordu: takvim günün en büyük iki
   * şirketini bu alana göre seçiyor ve `HERO_MIN_CAP` eşiğini bununla
   * ölçüyor, yani sıralama ve seçim de yanlış değerden çıkıyordu.
   */
  marketCap: number | null;
  /**
   * Sağlayıcının profilinde yazan ham değer — fotoğraf.
   * `liveMarketCap` mertebe koruması bunu referans alıyor; hesaplanmış değer
   * onun yerine geçse koruma kendi kendini ölçer hâle gelirdi.
   */
  storedMarketCap: number | null;
  /** Ödenmiş hisse sayısı — canlı piyasa değeri hesabı bunu kullanır. */
  shareOutstanding: number | null;
  /**
   * Şirketin ANA BORSASININ para birimi (ISO kodu) — USD olmayabilir.
   *
   * Sorgu bu alanı zaten çekiyordu ama yalnızca `marketCap`i null'lamak için
   * kullanıp dışarı vermiyordu. Oysa sağlayıcının hisse başı kâr, 52 hafta
   * bandı ve bilanço tahminleri de aynı para biriminde geliyor; onları dolar
   * sanıp `$` basan her ekranın bu alana ihtiyacı var.
   */
  currency: string | null;
  logoUrl: string | null;
  industry: string | null;
};

/**
 * Güncel piyasa değeri = son fiyat × hisse sayısı.
 *
 * Sağlayıcının yazdığı `marketCap` alanı profil çekildiği anın fotoğrafıdır;
 * hisse sayısı ise ancak geri alım/ihraçla, yani çeyreklerde değişir. Bu
 * yüzden değer canlı fiyattan hesaplanır ve gün içinde doğru kalır. Hisse
 * sayısı bilinmiyorsa kayıtlı değere düşülür.
 */
/**
 * SAĞLAYICININ HİSSE SAYISI DENETLENİYOR. Finnhub, BRK.B için A SINIFININ
 * hisse sayısını döndürüyor (1,44 milyon — B sınıfı 2,2 milyar): çarpım
 * 726 milyon dolar veriyordu ve Berkshire, şirketler dizininde mikro ölçekli
 * bir şirket gibi listeleniyordu. Aynı satırda sağlayıcının kendi
 * `marketCap` alanı 972 milyar diyordu, yani veri kendi içinde çelişiyordu.
 *
 * EŞİK BİR KEZ YANLIŞ KONDU. Kural önce "canlı hesap kayıtlı değerden
 * ÜÇTE BİRDEN fazla ayrılıyorsa kayıtlı değeri bas" diye yazıldı ve bu,
 * gerçek fiyat hareketini de hata sayıyordu: MRNA 19 Ağustos 2026'da tek
 * günde 62,96 dolardan 174,38 dolara çıktı ve denetim devreye girdi —
 * ekranda hâlâ 25,1 milyar dolar yazıyordu, oysa şirket o gün 70 milyar
 * dolar olmuştu. Yani denetimin kendisi, önlemeye çalıştığı şeyi
 * (bayat sayıyı büyük puntoyla göstermek) yapıyordu.
 *
 * Ayırt edilmek istenen şey bir MERTEBE hatası: yanlış sınıfın hisse sayısı
 * kullanıldığında çarpım yüzde otuz değil yüzlerce KAT sapıyor (BRK.B'de
 * 1379 kat). Fiyat hareketiyse profil tazeleme penceresinde (~29 gün)
 * en çok birkaç katla sınırlı. Eşik bu yüzden orana çevrildi.
 *
 * KABUL EDİLEN SINIR: iki değer arasındaki KAT farkı. Bu sınırın üstünde
 * hisse sayısına güvenilmez ve sağlayıcının kendi `marketCap` alanı
 * basılır. Bilinen açık: bir hisse profil penceresi içinde gerçekten on
 * katına çıkarsa yine kayıtlı değere düşülür — o durumda da sayı bayat
 * olur ama alternatif, BRK.B'yi mikro şirket göstermek.
 */
const CAP_MERTEBE_KATI = 10;

export function liveMarketCap(
  /* Fonksiyonun ihtiyacı iki alan. Tam `SymbolMeta` isteniyordu ve şirketler
     dizini bu yüzden yalnızca denetimi geçmek için sahte bir nesne kuruyordu
     (ad, logo, sektör hep boş). İki alanlık bir imza, çağıranın elindekiyle
     doğrudan çalışıyor. */
  meta:
    | Pick<SymbolMeta, "marketCap" | "shareOutstanding">
    | undefined
    | null,
  price: number | null | undefined,
): number | null {
  if (!meta) return null;
  if (meta.shareOutstanding && typeof price === "number" && price > 0) {
    const canli = meta.shareOutstanding * price;
    if (meta.marketCap && meta.marketCap > 0) {
      const kat =
        Math.max(canli, meta.marketCap) / Math.min(canli, meta.marketCap);
      if (kat > CAP_MERTEBE_KATI) return meta.marketCap;
    }
    return canli;
  }
  return meta.marketCap;
}

/* İSTEK İÇİNDE TEKİL. Aynı sembol listesi bir sayfada birden çok yerden
   isteniyor — ana sayfada gün şeridi ve "bugünün bilançoları" aynı takvim
   sonucundan besleniyor, yoğun bir günde bu yüzlerce sembollük aynı sorgunun
   iki kez koşması demekti. `cache()` argümanları KİMLİĞE göre eşlediği için
   her seferinde yeni üretilen dizi hiçbir zaman isabet etmiyordu; anahtar bu
   yüzden sıralı ve birleştirilmiş bir dize (kotasyonlarda da aynı desen). */
const symbolNamesForKey = cache(async function symbolNamesForKey(
  key: string,
): Promise<Record<string, SymbolMeta>> {
  return loadSymbolNames(key ? key.split(",") : []);
});

export async function getSymbolNames(
  list: string[],
): Promise<Record<string, SymbolMeta>> {
  const unique = [...new Set(list)].sort();
  if (unique.length === 0) return {};
  return symbolNamesForKey(unique.join(","));
}

async function loadSymbolNames(
  list: string[],
): Promise<Record<string, SymbolMeta>> {
  if (list.length === 0) return {};
  try {
    const rows = await db
      .select({
        symbol: symbolsTable.symbol,
        name: symbolsTable.name,
        isIndexProxy: symbolsTable.isIndexProxy,
        marketCap: symbolsTable.marketCap,
        currency: symbolsTable.currency,
        shareOutstanding: symbolsTable.shareOutstanding,
        logoUrl: symbolsTable.logoUrl,
        industry: symbolsTable.industry,
        /* Önbellekteki son fiyat — piyasa değeri buradan hesaplanıyor.
           `getCompanies` aynı join'i zaten yapıyor; sağlayıcıya ek bir tur
           yok, tek bir sol birleştirme var. */
        cachedPrice: quotesCacheTable.price,
      })
      .from(symbolsTable)
      .leftJoin(
        quotesCacheTable,
        eq(quotesCacheTable.symbol, symbolsTable.symbol),
      )
      .where(inArray(symbolsTable.symbol, list));
    return Object.fromEntries(
      rows.map((r) => [
        r.symbol,
        ((): SymbolMeta => {
          /* Yabancı para biriminde hisse sayısı × DOLAR fiyatı anlamsız bir
             sayı verir (TSM'de 5,7 kat, NetEase'te 37 kat sapıyor: ADR
             oranları bilinmiyor). O yüzden ikisi de null. */
          const usd = r.currency === "USD";
          const stored = usd ? r.marketCap : null;
          const shares = usd ? r.shareOutstanding : null;
          return {
            name: r.name,
            indexProxy: r.isIndexProxy,
            marketCap:
              liveMarketCap(
                { marketCap: stored, shareOutstanding: shares },
                r.cachedPrice,
              ) ?? stored,
            storedMarketCap: stored,
            shareOutstanding: shares,
            currency: r.currency,
            logoUrl: logoSrc(r.symbol, r.logoUrl),
            industry: r.industry,
          };
        })(),
      ]),
    );
  } catch (error) {
    yutuldu("loadSymbolNames", error);
    return {};
  }
}

/* ---- Şirketler sayfası ---- */

export type CompanyRow = {
  symbol: string;
  name: string;
  industry: string | null;
  logoUrl: string | null;
  /**
   * Piyasa değeri — ÖNBELLEKTEKİ fiyatla hesaplanmış taban değer.
   *
   * Sağlayıcının yazdığı `marketCap` profil çekildiği ANIN fotoğrafı ve o
   * profil ~29 günde bir tazeleniyor; hisse sayısı ise ancak geri
   * alım/ihraçla değişiyor. `/piyasalar` ve bilanço analizi bu yüzden değeri
   * canlı fiyattan hesaplıyordu ama `/sirketler` fotoğrafı basıyordu: aynı
   * şirket iki ekranda iki farklı piyasa değeriyle görünüyordu ve okuyucu
   * için bu bir hata demek.
   *
   * Burada hesap `quotes_cache`teki fiyatla yapılıyor ve o fiyat, sayfanın
   * kendi çektiği canlı kotasyondan bir tur eski: aynı satırda "Fiyat"
   * sütunu canlı sayıyı, "Piyasa Değeri" sütunu bir önceki fiyattan çıkan
   * sayıyı gösteriyordu. Hızlı hareket eden bir hissede bu fark ekranda
   * görülüyor. Bu yüzden sayfa değeri canlı kotasyonla YENİDEN hesaplıyor
   * ve buradaki değer yalnızca kotasyon hiç gelmediğinde taban kalıyor —
   * aşağıdaki iki alan o hesabın malzemesi.
   */
  marketCap: number | null;
  /** Profil anındaki kayıtlı piyasa değeri — mertebe denetiminin tabanı. */
  storedMarketCap: number | null;
  /** Ödenmiş hisse sayısı; USD dışı para biriminde null. */
  shareOutstanding: number | null;
  volume: number | null;
};

/** Endeks ETF'leri hariç, profili bilinen şirketler. */
export async function getCompanies(): Promise<CompanyRow[]> {
  try {
    const rows = await db
      .select({
        symbol: symbolsTable.symbol,
        name: symbolsTable.name,
        industry: symbolsTable.industry,
        logoUrl: symbolsTable.logoUrl,
        marketCap: symbolsTable.marketCap,
        shareOutstanding: symbolsTable.shareOutstanding,
        currency: symbolsTable.currency,
        volume: quotesCacheTable.volume,
        price: quotesCacheTable.price,
      })
      .from(symbolsTable)
      .leftJoin(
        quotesCacheTable,
        eq(quotesCacheTable.symbol, symbolsTable.symbol),
      )
      .where(eq(symbolsTable.isIndexProxy, false));
    // USD dışı piyasa değeri (ör. TWD) USD ile sıralanamaz — yok sayılır.
    return rows.map((r) => {
      const usd = r.currency === "USD";
      const storedMarketCap = usd ? r.marketCap : null;
      const shareOutstanding = usd ? r.shareOutstanding : null;
      return {
        symbol: r.symbol,
        name: r.name,
        /* SEKTÖR ÖNCE GICS'TEN. `symbols.industry` sağlayıcının serbest
           metinli alanı ve ana sektörle alt sektörü karıştırıyor: Cisco'ya
           "Communications" diyor (site onu Medya grubuna koyuyordu), Walmart
           ve Costco'ya "Retail" (Tüketim'e düşüyorlardı), Amphenol'e
           "Electrical Equipment" (Sanayi). Endeks tohumundaki GICS alt
           sektörü aynı şirketler için doğru olanı söylüyor: "Communications
           Equipment" → Teknoloji, "Consumer Staples Merchandise Retail" →
           Temel Tüketim.

           Ölçüldü: 802 şirketin 517'si tohumda ve bunların 40'ı iki
           taksonomide FARKLI gruba düşüyordu. Üstelik hisse sayfası zaten
           GICS'i gösteriyordu, yani aynı şirket iki ekranda iki sektör
           taşıyordu. Tohumda olmayan sembolde sağlayıcının alanı kalıyor. */
        industry: indexMemberOf(r.symbol)?.sub ?? r.industry,
        volume: r.volume,
        logoUrl: logoSrc(r.symbol, r.logoUrl),
        storedMarketCap,
        shareOutstanding,
        /* Canlı hesap `liveMarketCap` ile AYNI FONKSİYONDAN geçiyor — kural
           iki yerde ayrı yazılıyken sağlayıcının bozuk hisse sayısına karşı
           konan denetim yalnızca birinde vardı ve şirketler dizini (asıl
           listeleme ekranı) korumasız kalıyordu. Tek fark, burada fiyatın
           önbellek tablosundan gelmesi — sayfa aynı hesabı canlı kotasyonla
           tekrar yapıyor. */
        marketCap: liveMarketCap(
          { marketCap: storedMarketCap, shareOutstanding },
          r.price,
        ),
      };
    });
  } catch (error) {
    yutuldu("getCompanies", error);
    return [];
  }
}

/**
 * Önümüzdeki günlerin bilanço sembollerinden profili (piyasa değeri) henüz
 * bilinmeyenler — cron bunlara öncelik verir ki Bilançolar sayfasının
 * "Öne Çıkanlar" kartları dolabilsin.
 */
export async function getEarningsSymbolsMissingProfile(
  days: number,
  limit: number,
): Promise<string[]> {
  try {
    const today = todayEt();
    const rows = await db
      .select({ symbol: earningsCalendar.symbol })
      .from(earningsCalendar)
      .leftJoin(
        symbolsTable,
        eq(symbolsTable.symbol, earningsCalendar.symbol),
      )
      .where(
        and(
          gte(earningsCalendar.reportDate, today),
          lte(earningsCalendar.reportDate, addEtDays(today, days)),
          isNull(symbolsTable.marketCap),
        ),
      )
      .limit(limit * 3);
    return [...new Set(rows.map((r) => r.symbol))].slice(0, limit);
  } catch (error) {
    yutuldu("getEarningsSymbolsMissingProfile", error);
    return [];
  }
}

/* --------------------------------------------------------------------------
   Sembol tanınıyor mu

   Sağlayıcı kotasını tüketen saldırıya karşı ilk süzgeç. `isValidSymbol`
   yalnızca BİÇİMİ doğruluyor (`^[A-Z][A-Z.-]{0,9}$`) — yani "AAAA", "ZZZQ"
   gibi milyonlarca uydurma sembol geçerli sayılıyor ve her biri Next'in veri
   önbelleğini ıskalayıp doğrudan Alpaca/Finnhub'a gidiyordu.

   Burada sorulan soru: bu sembolü GERÇEKTEN tanıyor muyuz? `symbols` tablosu
   endeks üyeleri, tohumlanan popüler hisseler ve bilanço takviminden geçmiş
   şirketlerle doluyor (~500+ satır ve büyüyor).

   Tanınmayan sembol REDDEDİLMİYOR — arama, Finnhub üzerinden bu evrenin
   dışındaki hisseleri de bulabiliyor ve onlara tıklayan kullanıcı boş
   duvara çarpmamalı. Tanınmayanlar yalnızca çok daha dar bir oran sınırına
   tabi tutuluyor (bkz. app/api/chart/[symbol]/route.ts). Keşif çalışmaya
   devam ediyor, sayım saldırısı ilk saniyede duruyor.
   -------------------------------------------------------------------------- */
export const isKnownSymbol = cache(async function isKnownSymbol(
  symbol: string,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ symbol: symbolsTable.symbol })
      .from(symbolsTable)
      .where(eq(symbolsTable.symbol, symbol))
      .limit(1);
    return Boolean(row);
  } catch (error) {
    yutuldu("getEarningsSymbolsMissingProfile", error);
    // Veritabanı düştüyse sembolü tanınmış sayma; dar sınır uygulanır ve
    // sağlayıcı kotası korunur. Yanlış tarafa düşmek burada güvenli olan.
    return false;
  }
});

/* --------------------------------------------------------------------------
   Endeks listesi bayatlama dedektörü

   `db/seed/indices.ts` elle bakılan tek büyük veri parçası ve otomatikleşmesi
   mümkün değil: Finnhub'ın /index/constituents ucu ücretsiz katmanda 403
   dönüyor, başka ücretsiz kaynak da yok. Dosya elle tazeleniyor ve bir kez
   gerçekten bayatladı — SPCX 7 Temmuz 2026'da Nasdaq-100'e girdi, dosya 1
   Ağustos damgalı olmasına rağmen içermiyordu ve /piyasalar bileşenleri
   eksik gösterdi.

   Listeyi otomatik DÜZELTEMEYİZ ama bozulduğunu FARK EDEBİLİRİZ: dev bir
   şirket sembol tablosunda duruyor da hiçbir endekste görünmüyorsa,
   büyük ihtimalle endeks listesi geride kalmıştır. SPCX bu testten
   1,44 trilyon dolarla geçerdi.

   Kesin bir kanıt değil, bir koku: ABD'de listeli her dev şirket endekste
   olmak zorunda değil (yeni halka arzlar bekleme süresine tabi, çift
   kotasyonlar hiç girmeyebilir). Bu yüzden hata değil, cron raporuna düşen
   bir uyarı — insan bakıp karar verir.
   -------------------------------------------------------------------------- */

/** Bu piyasa değerinin üstünde olup endekste olmayanlar bildirilir. */
const INDEX_DRIFT_THRESHOLD_USD = 200e9;

export async function getIndexDriftCandidates(
  indexSymbols: Set<string>,
): Promise<{ symbol: string; name: string; marketCap: number }[]> {
  try {
    const rows = await db
      .select({
        symbol: symbolsTable.symbol,
        name: symbolsTable.name,
        marketCap: symbolsTable.marketCap,
        currency: symbolsTable.currency,
        isIndexProxy: symbolsTable.isIndexProxy,
      })
      .from(symbolsTable)
      .where(gte(symbolsTable.marketCap, INDEX_DRIFT_THRESHOLD_USD));

    return rows
      .filter(
        (row) =>
          // ETF'ler endeks üyesi değildir, doğal olarak listede yoklar.
          !row.isIndexProxy &&
          // USD dışı piyasa değeri eşikle karşılaştırılamaz (KRW'de her
          // şirket "trilyonluk" görünür) — SKHY bu yüzden elenmeli.
          row.currency === "USD" &&
          row.marketCap !== null &&
          !indexSymbols.has(row.symbol),
      )
      .map((row) => ({
        symbol: row.symbol,
        name: row.name,
        marketCap: row.marketCap as number,
      }))
      .sort((a, b) => b.marketCap - a.marketCap);
  } catch (error) {
    yutuldu("getIndexDriftCandidates", error);
    return [];
  }
}

/** Profili en bayat semboller — cron her gün bir dilimini tazeler. */
export async function getStalestSymbols(limit: number): Promise<string[]> {
  try {
    const rows = await db
      .select({ symbol: symbolsTable.symbol })
      .from(symbolsTable)
      .orderBy(asc(symbolsTable.updatedAt))
      .limit(limit);
    return rows.map((r) => r.symbol);
  } catch (error) {
    yutuldu("getStalestSymbols", error);
    return [];
  }
}

/** Takvim görünümü için hafta aralığı ("YYYY-MM-DD"). */
export function weekRange(anchor: string): { from: string; to: string } {
  return { from: anchor, to: addEtDays(anchor, 6) };
}

/* --------------------------------------------------------------------------
   Mercek yazıları

   Sıralama olay tarihine göre: bir dosya olaydan günler sonra yazılabilir
   (arşiv doldurulurken hep öyle olacak) ve okuyucu için önemli olan yazının
   ne zaman yazıldığı değil, olayın ne zaman yaşandığı.
   -------------------------------------------------------------------------- */

export type StoryIndexRow = Pick<
  StoryRow,
  "slug" | "title" | "dek" | "eventDate" | "symbols" | "readMinutes" | "locale"
>;

/**
 * Arşiv slug başına TEK kayıt döndürür: istenen dildeki sürüm varsa o,
 * yoksa hangi dilde yazıldıysa o. Çeviri rutini akşamları koşuyor ve iki
 * dil arasında her zaman bir boşluk penceresi olacak; o pencerede İngilizce
 * ekranı boş bırakmak yerine orijinal gösterilir. Satırda `locale` bu
 * yüzden dönüyor — arayüz "TR" rozetini oradan basar.
 */
/**
 * Arşivdeki tekil yazı sayısı — dil satırları tekilleştirilmiş.
 *
 * Sayfalama künyesi ("60 / 128") ve filtre çipleri bunu istiyor: liste
 * kırpıldığı için sayım kırpılmış listeden yapılamaz.
 */
export async function countStories(): Promise<number> {
  try {
    const [row] = await db
      .select({ total: sql<number>`count(distinct ${stories.slug})::int` })
      .from(stories);
    return row?.total ?? 0;
  } catch (error) {
    yutuldu("countStories", error);
    return 0;
  }
}

/**
 * Tek bir sembolün yazı sayısı — hisse sayfasındaki mercek bloğu için.
 *
 * `countStoriesBySymbol()` DEĞİL: o, filtre çipleri için tablonun tamamını
 * çekip bellekte grupluyor ve burada tek bir sayı isteniyor.
 *
 * `count(distinct slug)` ZORUNLU — tablo dil başına bir satır tutuyor, ham
 * `count(*)` her yazıyı iki kez sayar.
 */
export async function countStoriesForSymbol(symbol: string): Promise<number> {
  try {
    const [row] = await db
      .select({ total: sql<number>`count(distinct ${stories.slug})::int` })
      .from(stories)
      .where(sql`${stories.symbols} @> ${JSON.stringify([symbol])}::jsonb`);
    return row?.total ?? 0;
  } catch (error) {
    yutuldu("countStoriesForSymbol", error);
    return 0;
  }
}

/**
 * Arşivdeki sembollerin yazı sayısı — filtre çipleri için.
 *
 * ÇİPLER YÜKLENEN PENCEREDEN DEĞİL ARŞİVİN TAMAMINDAN sayılıyor. Sayım
 * ekrandaki listeden yapılırken iki şey birden yanlıştı: yalnızca eski
 * yazılarda geçen bir şirket hiç çip almıyor (41 yazılık arşivin 24'ü
 * yüklüydü), çip alanların sayısı da gerçek toplamdan küçük çıkıyordu.
 *
 * SORGU İKİ SÜTUN ÇEKİYOR. `jsonb` dizisini Postgres'te açıp gruplamak daha
 * zarif olurdu ama ham SQL yazmayı gerektiriyor; slug ve sembol listesi iki
 * küçük sütun ve arşiv bu ölçekte (yüzler mertebesi) tek gidiş-dönüşte
 * geliyor. Binlere çıkarsa gruplama veritabanına taşınmalı.
 *
 * Dil satırları tekilleştiriliyor: aynı yazının TR ve EN sürümü iki değil
 * bir sayılır.
 */
export async function countStoriesBySymbol(): Promise<Map<string, number>> {
  try {
    const rows = await db
      .select({ slug: stories.slug, symbols: stories.symbols })
      .from(stories);

    const slugsOf = new Map<string, Set<string>>();
    for (const row of rows) {
      for (const symbol of row.symbols ?? []) {
        const held = slugsOf.get(symbol) ?? new Set<string>();
        held.add(row.slug);
        slugsOf.set(symbol, held);
      }
    }
    return new Map(
      [...slugsOf].map(([symbol, slugs]) => [symbol, slugs.size]),
    );
  } catch (error) {
    yutuldu("countStoriesBySymbol", error);
    return new Map();
  }
}

/**
 * Bir sembolün geçtiği mercek yazıları — hisse sayfası için.
 *
 * SORGU VERİTABANINDA SÜZÜYOR. Arşivin tamamını çekip bellekte `symbols`
 * dizisini taramak, yazı sayısı büyüdükçe her hisse sayfasına binen bir
 * maliyet olurdu; `jsonb` içinde arama Postgres'in kendi işi.
 *
 * Dil düşüşü arşivdekiyle aynı kural: istenen dildeki sürüm varsa o, yoksa
 * yazının orijinali. Aynı slug iki dilde de dönebileceği için tekilleştirme
 * burada da yapılıyor.
 */
export async function getStoriesForSymbol(
  symbol: string,
  locale: string,
  limit = 3,
): Promise<StoryIndexRow[]> {
  try {
    const rows = await db
      .select({
        slug: stories.slug,
        title: stories.title,
        dek: stories.dek,
        eventDate: stories.eventDate,
        symbols: stories.symbols,
        readMinutes: stories.readMinutes,
        locale: stories.locale,
      })
      .from(stories)
      .where(sql`${stories.symbols} @> ${JSON.stringify([symbol])}::jsonb`)
      .orderBy(desc(stories.eventDate), desc(stories.publishedAt))
      .limit(limit * 2);

    const bySlug = new Map<string, StoryIndexRow>();
    for (const row of rows) {
      const held = bySlug.get(row.slug);
      if (!held) bySlug.set(row.slug, row);
      else if (held.locale !== locale && row.locale === locale) {
        bySlug.set(row.slug, row);
      }
    }
    return [...bySlug.values()].slice(0, limit);
  } catch (error) {
    yutuldu("getStoriesForSymbol", error);
    return [];
  }
}

export async function getStories(
  locale: string,
  limit = 60,
): Promise<StoryIndexRow[]> {
  try {
    const rows = await db
      .select({
        slug: stories.slug,
        title: stories.title,
        dek: stories.dek,
        eventDate: stories.eventDate,
        symbols: stories.symbols,
        readMinutes: stories.readMinutes,
        locale: stories.locale,
      })
      .from(stories)
      .orderBy(desc(stories.eventDate), desc(stories.publishedAt))
      /* Dil başına bir satır düşebileceği için sınır iki katıyla çekilir;
         birleştirme sonrası tekrar kırpılır. */
      .limit(limit * 2);

    const bySlug = new Map<string, StoryIndexRow>();
    for (const row of rows) {
      const held = bySlug.get(row.slug);
      if (!held) {
        bySlug.set(row.slug, row);
      } else if (held.locale !== locale && row.locale === locale) {
        /* Map sıra korur: değeri değiştirmek satırın yerini oynatmaz. */
        bySlug.set(row.slug, row);
      }
    }
    return [...bySlug.values()].slice(0, limit);
  } catch (error) {
    yutuldu("getStories", error);
    return [];
  }
}

/** İstenen dil yoksa yazının orijinali döner — sayfa dil notunu kendisi basar. */
export async function getStoryBySlug(
  slug: string,
  locale: string,
): Promise<StoryRow | null> {
  try {
    const rows = await db
      .select()
      .from(stories)
      .where(eq(stories.slug, slug))
      .limit(4);
    return rows.find((row) => row.locale === locale) ?? rows[0] ?? null;
  } catch (error) {
    yutuldu("getStoryBySlug", error);
    return null;
  }
}

/* --------------------------------------------------------------------------
   Bilanço analizleri

   Dil yedeği mercek yazılarındakiyle aynı kural: kayıt dil başına bir satır,
   istenen dil yoksa orijinal gösterilir ve satır kendi `locale` değerini
   taşır — arayüz rozeti oradan basar. Analiz rutini iki dili birlikte
   yazıyor ama arada her zaman bir pencere olacak.
   -------------------------------------------------------------------------- */

/** Liste ekranlarının ihtiyacı — gövde metinleri çekilmez. */
export type AnalysisIndexRow = Pick<
  EarningsAnalysisRow,
  | "symbol"
  | "period"
  | "periodLabel"
  | "locale"
  | "company"
  | "sector"
  | "reportDate"
  | "timing"
  | "score"
  | "verdict"
  | "headline"
  | "revenue"
  | "revenueYoyPct"
  | "eps"
  | "epsSurprisePct"
  | "reactionPct"
>;

const ANALYSIS_INDEX_COLUMNS = {
  symbol: earningsAnalyses.symbol,
  period: earningsAnalyses.period,
  periodLabel: earningsAnalyses.periodLabel,
  locale: earningsAnalyses.locale,
  company: earningsAnalyses.company,
  sector: earningsAnalyses.sector,
  reportDate: earningsAnalyses.reportDate,
  timing: earningsAnalyses.timing,
  score: earningsAnalyses.score,
  verdict: earningsAnalyses.verdict,
  headline: earningsAnalyses.headline,
  revenue: earningsAnalyses.revenue,
  revenueYoyPct: earningsAnalyses.revenueYoyPct,
  eps: earningsAnalyses.eps,
  epsSurprisePct: earningsAnalyses.epsSurprisePct,
  reactionPct: earningsAnalyses.reactionPct,
} as const;

/** `symbol + period` başına tek satır; istenen dil öncelikli. */
function dedupeAnalyses<T extends { symbol: string; period: string; locale: string }>(
  rows: T[],
  locale: string,
  limit: number,
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.symbol}:${row.period}`;
    const held = byKey.get(key);
    if (!held) {
      byKey.set(key, row);
    } else if (held.locale !== locale && row.locale === locale) {
      /* Map sıra korur: değeri değiştirmek satırın yerini oynatmaz. */
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].slice(0, limit);
}

export type AnalysisSort = "tarih" | "skor" | "tepki";

export async function getAnalyses(
  locale: string,
  options: { limit?: number; sort?: AnalysisSort; symbols?: string[] } = {},
): Promise<AnalysisIndexRow[]> {
  const limit = options.limit ?? 40;
  const sort = options.sort ?? "tarih";
  try {
    const order =
      sort === "skor"
        ? [desc(earningsAnalyses.score), desc(earningsAnalyses.reportDate)]
        : sort === "tepki"
          ? [
              /* NULLS LAST. `reaction_pct` nullable ve Postgres'in `DESC`
                 varsayılanı NULLS FIRST: "Tepki" sekmesine geçen okuyucu, en
                 büyük tepkiyi veren bilançolar yerine tepki verisi hiç
                 girilmemiş kayıtları görüyordu — sıralamanın vaat ettiğinin
                 tam tersi. */
              sql`${earningsAnalyses.reactionPct} desc nulls last`,
              desc(earningsAnalyses.reportDate),
            ]
          : [desc(earningsAnalyses.reportDate), desc(earningsAnalyses.publishedAt)];

    const query = db.select(ANALYSIS_INDEX_COLUMNS).from(earningsAnalyses);
    const rows = await (options.symbols
      ? query.where(inArray(earningsAnalyses.symbol, options.symbols))
      : query
    )
      .orderBy(...order)
      /* Dil başına bir satır düşebileceği için sınır iki katıyla çekilir. */
      .limit(limit * 2);

    return dedupeAnalyses(rows, locale, limit);
  } catch (error) {
    yutuldu("getAnalyses", error);
    return [];
  }
}

/** İstenen dil yoksa analizin orijinali döner — sayfa dil notunu kendi basar. */
export async function getAnalysis(
  symbol: string,
  period: string,
  locale: string,
): Promise<EarningsAnalysisRow | null> {
  try {
    const rows = await db
      .select()
      .from(earningsAnalyses)
      .where(
        and(
          eq(earningsAnalyses.symbol, symbol.toUpperCase()),
          eq(earningsAnalyses.period, period),
        ),
      )
      .limit(4);
    return rows.find((row) => row.locale === locale) ?? rows[0] ?? null;
  } catch (error) {
    yutuldu("getAnalysis", error);
    return null;
  }
}

/**
 * Takvim satırına düşecek rozetler.
 *
 * Anahtar `SEMBOL:TARİH`: takvim satırının kimliği bu ikili, analizin
 * `period` alanı ise şirketin kendi mali takviminden geliyor ve takvim
 * satırında böyle bir alan yok. Eşleşme tarihten kuruluyor.
 */
export type AnalysisBadge = {
  symbol: string;
  period: string;
  verdict: string;
  score: number;
};

export async function getAnalysisBadges(
  symbols: string[],
  locale: string,
  /* TARİH ARALIĞI ŞART DEĞİL AMA OLMALI. Süzgeç yokken fonksiyon verilen
     sembollerin TÜM analiz arşivini çekiyordu — takvim ekranı bunu 30 günlük
     takvimin tekil sembolleriyle çağırıyor, yani bilanço sezonunda binlerce
     elemanlı bir `inArray` ve arşivin tamamı. Oysa rozet yalnızca takvim
     satırının SEMBOL:TARİH anahtarıyla eşleşenler için kullanılıyor, geri
     kalan her satır aşağıda atılıyor. `earnings_analyses_report_idx` bu
     süzgeci karşılıyor. */
  range?: { from: string; to: string },
): Promise<Record<string, AnalysisBadge>> {
  if (symbols.length === 0) return {};
  try {
    const bySymbol = inArray(earningsAnalyses.symbol, [...new Set(symbols)]);
    const rows = await db
      .select({
        symbol: earningsAnalyses.symbol,
        period: earningsAnalyses.period,
        locale: earningsAnalyses.locale,
        verdict: earningsAnalyses.verdict,
        score: earningsAnalyses.score,
        reportDate: earningsAnalyses.reportDate,
      })
      .from(earningsAnalyses)
      .where(
        range
          ? and(
              bySymbol,
              gte(earningsAnalyses.reportDate, range.from),
              lte(earningsAnalyses.reportDate, range.to),
            )
          : bySymbol,
      );

    const out: Record<string, AnalysisBadge> = {};
    for (const row of rows) {
      const key = `${row.symbol}:${row.reportDate}`;
      /* Aynı bilançonun iki dil satırı aynı rozeti taşır; yine de istenen
         dildeki kayıt kazansın ki `period` slug'ı o dilin sayfasına gitsin. */
      if (!out[key] || row.locale === locale) {
        out[key] = {
          symbol: row.symbol,
          period: row.period,
          verdict: row.verdict,
          score: row.score,
        };
      }
    }
    return out;
  } catch (error) {
    yutuldu("getAnalysisBadges", error);
    return {};
  }
}
