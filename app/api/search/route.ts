import { NextResponse } from "next/server";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { stories, symbols } from "@/lib/schema";
import { searchSymbols } from "@/lib/providers/finnhub";
import { aliasSymbols } from "@/db/seed/aliases";
import { allFunds } from "@/db/seed/symbols";
import { guideArticles } from "@/content/guide";
import { getLocale } from "@/lib/i18n";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isTechnicalSymbol } from "@/lib/technical";
import { logoSrc } from "@/lib/logos";

export type SearchHit = {
  symbol: string;
  name: string;
  industry?: string | null;
  /** Günlük teknik analizi olan hisselerden biri mi. Palet o sembolün
      altına ikinci bir satır açıyor: "NVDA" yazan okuyucu hissenin teknik
      analizine şirket sayfasına uğramadan gidebilsin. */
  technical?: boolean;
  /** Logo adresi — önce depodaki dosya (`logoSrc`), yoksa sağlayıcınınki. */
  logo?: string | null;
};

/**
 * Yazı sonucu — rehber ya da mercek.
 *
 * Arama yalnızca sembol buluyordu. Otuz bir rehber yazısı ve bütün mercek
 * arşivi paletten ERİŞİLEMEZDİ: "hedge" yazan biri, iki gün önce yayımlanan
 * yazıyı bulamıyor, elle /rehber'e gidip listeyi taramak zorunda kalıyordu.
 * Sembol arayan da yazı arayan da aynı kutuyu açıyor; ayıran şey ne yazdığı.
 */
export type WritingHit = {
  kind: "rehber" | "mercek";
  slug: string;
  title: string;
  dek: string;
};

export type SearchResponse = {
  hits: SearchHit[];
  writings: WritingHit[];
  error?: string;
  /** Yanıt eksik: uzak genişletme gerekiyordu ama yapılamadı (kapı ya da
      sağlayıcı), ya da yerel sorgulardan biri (sembol tablosu, mercek)
      düştü. İstemci bunu önbelleğe YAZMAZ — gerekçe `SEARCH_REMOTE_LIMIT`
      üstünde ve sembol sorgusunun `catch`inde (`GET`). */
  partial?: boolean;
};

/** Yazı sonuçları listeyi boğmasın — sembol hâlâ paletin ana işi. */
const MAX_WRITINGS = 4;

/**
 * Türkçe duyarsız karşılaştırma.
 *
 * `toLowerCase()` Türkçede "İ" harfini "i̇" (i + birleşen nokta) yapıyor ve
 * "İSTİHDAM" araması "istihdam" başlığını bulamıyordu. Locale'li küçültme
 * doğru sonucu veriyor; ayrıca aksanlı harfler normalize ediliyor ki
 * "enflasyon" araması "Enflasyon"u da "ENFLASYON"u da bulsun.
 */
function fold(value: string): string {
  return (
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      /* NOKTASIZ "ı" NOKTALIYA KATLANIR — bu satır olmadan arama İngilizce
         başlıkları kaçırıyordu. Türkçe küçültme "I" harfini "ı" yapıyor:
         "Index" → "ındex" olurken kullanıcının yazdığı "index" olduğu gibi
         kalıyor ve eşleşme kırılıyordu. Aynı şey "IWM", "IBM", "INTC" gibi
         sembollerde de oluyordu. İkisini de "i"ye indirince hem "İSTİHDAM"
         hem "index" doğru buluyor. */
      .replace(/ı/g, "i")
  );
}

/**
 * Sembol arama.
 * Önce yerel tablo (anında, sağlayıcı kotası harcamaz), sonuç azsa Finnhub
 * ile genişletilir.
 */
/* Sitedeki tek yetkisiz uç ve hem veritabanına hem Finnhub'a gidiyor —
   yani kotayı harcayan yüzey burası. Dakikada 40 istek, tuşa basarak arayan
   bir insanın çok üstünde; kazara kurulmuş bir döngünün çok altında. */
const SEARCH_LIMIT = 40;
const SEARCH_WINDOW_MS = 60_000;

/* SAĞLAYICI DALININ KENDİ KAPISI, İKİ KATLI (20 Ekim). Uzak dal katalog
   dışı her diziyle açılıyor ve Finnhub önbelleği sorgu başına: rastgele dizi
   her seferinde yeni bir çağrı. Ücretsiz katman SİTENİN TAMAMI için dakikada
   60 (profil, metrik, bilanço, haber ve gece senkronu aynı kotadan) ve
   yukarıdaki 40'lık tavanla iki adres onu tek başına bitiriyordu. Süreç
   başına 25: adres değiştiren betik bile kotanın yarısını geçemiyor — asıl
   kota bekçisi bu. IP başına 10: tek adres o ortak bütçenin yarısını
   yiyemesin. Sınır aşılınca hata yok — yalnızca uzak genişletme atlanıyor,
   yerel sonuçlar dönüyor.

   BEDEL ARAMA BAŞINA DEĞİL, TUŞ VURUŞU BAŞINA. Burada "tuşa basan insan
   dakikada birkaç katalog dışı arama yapar" yazıyordu; ama palet 120 ms
   bekleyip neredeyse her tuşta soruyor (SearchCommand) ve üç harften sonraki
   her ön ek ayrı bir sorgu: katalog dışı "enflasyon" yazmak yedi hak
   ("enf"…"enflasyon"). IP başına 10 böylece dakikada bir-iki katalog dışı
   kelimeye denk düşüyor ve birkaç eşzamanlı okuyucu ortak 25'i bitiriyor.
   İki önlem:
   (1) Finnhub'ın önbelleğindeki sorgu kotaya mal olmuyor, o yüzden kapıdan
       da geçmiyor (`remoteWarm`): silip yeniden yazan, geri alan, başka bir
       okuyucunun ardından aynı sembolü arayan hak harcamıyor.
   (2) Kapı ya da sağlayıcı uzak dalı düşürdüğünde yanıt `partial` taşıyor ve
       palet onu oturum önbelleğine yazmıyor. Eskiden düşen yanıt sessizce
       yerel-yalnız dönüyor, palet onu sayfalar arası yaşayan önbelleğine
       koyuyordu: katalog dışı sembol çoğu zaman boş liste demek ve aynı
       sembolü dakika dolduktan sonra yeniden yazan okuyucu oturum boyunca o
       boş listeyi görüyor, sunucuya bir daha hiç sorulmuyordu. */
const SEARCH_REMOTE_LIMIT = 10;
const SEARCH_REMOTE_GLOBAL = 25;

/* Finnhub'ın veri önbelleği sorguyu bir saat tutuyor (`searchSymbols`,
   `revalidate: 3600`; Next yalnız 200 yanıtı saklıyor). Kaydın süresi
   sağlayıcının `Date` başlığından sayılıyor — önbellekten gelen yanıtta o
   başlık ilk çekimin saati — ve 55 dakika: bayatlayan kayıt yeniden çekilir,
   o çekim kotaya yazılır; beş dakika saat farkına pay. Anahtar sorgunun
   KENDİSİ, katlanmış hâli değil: sağlayıcı adresi `q`yu olduğu gibi taşıyor
   ve "NVD" ile "nvd" iki ayrı önbellek kaydı. Süreç başına, en çok 500
   sorgu, en eskisi düşüyor; yeniden başlayan süreç boş başlar — tek bedeli
   birkaç fazladan hak. */
const REMOTE_WARM_MS = 55 * 60_000;
const REMOTE_WARM_MAX = 500;
const remoteWarm = new Map<string, number>();

function isRemoteWarm(query: string, now: number): boolean {
  const until = remoteWarm.get(query);
  if (until === undefined) return false;
  if (until > now) return true;
  remoteWarm.delete(query);
  return false;
}

function markRemoteWarm(query: string, fetchedAt: Date, now: number): void {
  const until = Math.min(fetchedAt.getTime(), now) + REMOTE_WARM_MS;
  remoteWarm.delete(query);
  if (until <= now) return;
  remoteWarm.set(query, until);
  if (remoteWarm.size > REMOTE_WARM_MAX) {
    const oldest = remoteWarm.keys().next().value;
    if (oldest !== undefined) remoteWarm.delete(oldest);
  }
}

/** Sağlayıcıya giden en uzun sorgu — daha uzunu anlamlı sonuç üretmiyor. */
const MAX_QUERY_LENGTH = 64;

/** Mercek yarısı — çağıran beklemeden başlatıyor (gerekçe `GET` içinde).
    Sorgu düşerse `null`, boş dizi DEĞİL (20 Ekim): "eşleşen yazı yok" ile
    "bakılamadı" ayrı; ikincisinde yanıt `partial` olur ve palet onu
    saklamaz. Eskiden ikisi de `[]` dönüyordu. */
async function mercekAra(
  needle: string,
  locale: Awaited<ReturnType<typeof getLocale>>,
  limit: number,
) {
  try {
    /* MERCEK YARISI DA KATLANIYOR. Rehber yarısı `fold()` ile bellekte
       eşleşiyor — Türkçe küçültme, aksan ayıklama ve noktasız "ı"nın
       noktalıya inmesi orada var. Mercek yarısı ise ham `ILIKE` ile
       gidiyordu ve ILIKE yalnızca büyük-küçük harfi eşitler: "sirket"
       araması "Şirket" başlığını, "ucus" araması "Uçuş"u bulamıyordu.
       Aynı arama kutusunda iki yarım iki farklı kurala göre çalışıyordu.

       Katlama SQL tarafına `translate` ile taşındı: `stories` küçük bir
       tablo, tam tarama önemsiz ve şema değişikliği gerekmiyor. Harf
       eşlemesi `fold()` ile birebir aynı — ikisi ayrı düşerse arama
       yeniden yarım çalışır, o yüzden aynı satırda tutuluyorlar.

       Desen `needle`den kuruluyor, `escaped`ten değil: eşleşecek olan
       katlanmış metin. `%` ve `_` kaçışı `escaped`te yapılıyordu, aynı
       kaçış burada da gerekiyor. */
    const foldedNeedle = needle.replace(/[\\%_]/g, (c) => `\\${c}`);
    const pattern = `%${foldedNeedle}%`;
    const katla = (kolon: AnyColumn) =>
      sql`lower(translate(${kolon}, 'ıİşŞğĞüÜöÖçÇâÂîÎûÛ', 'iIsSgGuUoOcCaAiIuU'))`;
    return await db
      .select({ slug: stories.slug, title: stories.title, dek: stories.dek })
      .from(stories)
      .where(
        and(
          eq(stories.locale, locale),
          or(
            sql`${katla(stories.title)} like ${pattern}`,
            sql`${katla(stories.dek)} like ${pattern}`,
          ),
        ),
      )
      .orderBy(desc(stories.eventDate))
      .limit(limit);
  } catch {
    // Veritabanı yoksa arama sembol tarafıyla çalışmaya devam eder.
    return null;
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(
    clientKey(request, "search"),
    SEARCH_LIMIT,
    SEARCH_WINDOW_MS,
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { hits: [], writings: [], error: "rate-limited" } satisfies SearchResponse,
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const query = (new URL(request.url).searchParams.get("q")?.trim() ?? "").slice(
    0,
    MAX_QUERY_LENGTH,
  );

  if (query.length < 1) {
    return NextResponse.json({ hits: [], writings: [] } satisfies SearchResponse);
  }

  /* ---- Yazılar — sembol aramasıyla AYNI ANDA ----
     Rehber depoda ve durağan: eşleşme bellekte yapılıyor, sorgu yok. Mercek
     veritabanında ve büyüyor: başlık ile giriş cümlesi katlanarak taranıyor.

     PARALEL (20 Ekim). Burada "ikisi de sembol aramasından SONRA çalışıyor
     ve yanıtı geciktirmiyor — mercek tek bir indeksli sorgu" yazıyordu; iki
     iddia da yanlıştı. Mercek sorgusu sembol sorgusunu (gerekirse Finnhub'ı
     da) bekliyor ve paletteki her aramaya sıralı bir Neon gidiş-dönüşü
     ekliyordu; katlanmış `like` de indeks kullanmıyor (`mercekAra`). İki
     sorgu hiçbir veri paylaşmıyor: mercek yalnız sorguyu, dili ve rehber
     eşleşmelerinin sayısını istiyor, üçü de baştan belli. Sorgu burada
     başlıyor, yanıttan hemen önce bekleniyor. */
  const locale = await getLocale();
  const needle = fold(query);
  const writings: WritingHit[] = [];

  if (query.length >= 2) {
    for (const article of guideArticles(locale)) {
      if (writings.length >= MAX_WRITINGS) break;
      if (fold(article.title).includes(needle) || fold(article.dek).includes(needle)) {
        writings.push({
          kind: "rehber",
          slug: article.slug,
          title: article.title,
          dek: article.dek,
        });
      }
    }
  }
  const mercekler =
    query.length >= 2 && writings.length < MAX_WRITINGS
      ? mercekAra(needle, locale, MAX_WRITINGS - writings.length)
      : Promise.resolve([]);

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  /* Yanıt eksik mi — üç kaynaktan biri: yerel sembol sorgusu, sağlayıcı
     dalı, mercek sorgusu (gerekçe `SearchResponse.partial`). */
  let partial = false;

  /* Marka adı ↔ resmî ad köprüsü.

     Arama yalnızca sembolde ve `symbols.name` alanında metin eşleşmesi
     yapıyordu; o ad ise sağlayıcıdan gelen TİCARİ SİCİL ADI. "spacex"
     araması hiçbir şey bulmuyordu çünkü tablodaki ad "Space Exploration
     Technologies Corp" ve içinde o dizi hiç geçmiyor. Aynı boşluk
     Google→Alphabet, Facebook→Meta için de vardı. Eşleme
     db/seed/aliases.ts içinde ve elle bakılıyor. */
  const aliased = aliasSymbols(query);

  /* JOKER KARAKTERLER KAÇIRILIYOR. Sorgu `%${query}%` desenine ham
     gömülüyordu; `%`, `_` ve `\` kaçırılmıyordu. Drizzle parametreleştirdiği
     için SQL enjeksiyonu yok ama iki somut sonuç vardı: `q=%` bütün katalogla
     eşleşip alakasız sonuç döndürüyor, ve `%_%_%_...` gibi bir desen
     Postgres'in LIKE eşleyicisinde geri izlemeyi tetikleyip her istekte
     boşuna işlemci yakıyordu — uç yetkisiz ve dakikada kırk istek serbest. */
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);

  try {
    const pattern = `%${escaped}%`;
    /* KISA SORGUDA AD ARAMASI YOK (26 Eylül). İki harfte ("mu") ad
       eşleşmesi gürültüydü: Micron'dan sonra adında "Municipal" geçen
       onlarca fon geliyordu. İki harfe kadar yalnızca SEMBOL ön eki ve
       takma ad aranıyor; üç harften itibaren ad da. */
    const matches = [
      query.length <= 2 ? ilike(symbols.symbol, `${escaped}%`) : ilike(symbols.symbol, pattern),
      ...(query.length > 2 ? [ilike(symbols.name, pattern)] : []),
      ...(aliased.length > 0 ? [inArray(symbols.symbol, aliased)] : []),
    ];

    const local = await db
      .select({
        symbol: symbols.symbol,
        name: symbols.name,
        industry: symbols.industry,
        logoUrl: symbols.logoUrl,
      })
      .from(symbols)
      .where(or(...matches))
      /* SIRA (26 Eylül, "doğru sonuçlarla çalışsın"): birebir sembol →
         takma ad → sembol ön eki → adın ya da bir kelimesinin başı → gerisi;
         her kademenin içinde PİYASA DEĞERİ büyükten küçüğe. Eskiden kademe
         içi sıra yoktu: "mu" aramasında içinde "MU" geçen onlarca sembol
         veritabanının kendi sırasıyla geliyor, Micron ilk sekizde bile
         olmayabiliyordu; "app" araması Apple'ı küçük şirketlerin arkasına
         atabiliyordu. */
      .orderBy(
        sql`case
              when upper(${symbols.symbol}) = upper(${query}) then 0
              when ${aliased.length > 0 ? inArray(symbols.symbol, aliased) : sql`false`} then 1
              when ${symbols.symbol} ilike ${escaped + "%"} then 2
              when ${symbols.name} ilike ${escaped + "%"} or ${symbols.name} ilike ${"% " + escaped + "%"} then 3
              else 4
            end`,
        sql`${symbols.marketCap} desc nulls last`,
      )
      .limit(8);

    for (const row of local) {
      seen.add(row.symbol);
      hits.push({ symbol: row.symbol, name: row.name, industry: row.industry, logo: logoSrc(row.symbol, row.logoUrl) });
    }
  } catch {
    /* Veritabanı yoksa arama yine de sağlayıcı üzerinden çalışsın — ama
       yanıt EKSİK (20 Ekim). Bu dal hatayı yutup boş yerel sonuçla devam
       ediyor; eskiden yanıt bunu söylemiyordu, `partial` yalnız sağlayıcı
       dalını kapsıyordu: Neon'un bir anlık düşüşünde sağlayıcıya hiç
       gidilmeyen bir-iki harflik ön ek ("nv") boş liste dönüyor, palet onu
       oturum önbelleğine yazıyor ve okuyucu aynı ön eki oturum boyunca boş
       görüyordu. Düşen yerel sorgu artık `partial`: palet yanıtı gösterir
       ama saklamaz. */
    partial = true;
  }

  /* FON KÜNYESİ DE ARANIYOR (4 Ekim). Sektör ve tema fonları (XLK, SMH,
     AIQ, DRAM, SPUS…) `symbols` tablosunda değil; "yarı iletken" ya da
     "yapay zeka" yazan okuyucu fonu bulamıyordu. Künye depoda ve küçük:
     bellekte, sembol + resmî ad + iki dildeki kısa ad. Birebir sembol
     eşleşmesi listenin başına, ad eşleşmesi yerel sonuçların ardına. */
  const needleFund = fold(query);
  for (const fund of allFunds()) {
    if (seen.has(fund.symbol)) continue;
    const exact = fund.symbol.toLowerCase() === query.toLowerCase();
    const byName =
      query.length >= 3 &&
      [fund.name, fund.labelTr, fund.labelEn].some((text) => fold(text).includes(needleFund));
    if (!exact && !byName) continue;
    seen.add(fund.symbol);
    const hit = { symbol: fund.symbol, name: fund.name, industry: null, logo: logoSrc(fund.symbol, null) };
    if (exact) hits.unshift(hit);
    else if (hits.length < 10) hits.push(hit);
  }

  /* SAĞLAYICIYA YALNIZCA GEREKTİĞİNDE (26 Eylül). Yerel sonuç 6'nın
     altındaysa her tuş vuruşunda Finnhub'a gidiliyordu ve yanıt onu
     bekliyordu; "nvi" gibi yerelde bir-iki sonucu olan her ara sorgu
     yavaşlıyordu. Yerel katalog bin sembolü aşkın; sağlayıcı artık yalnızca
     yerelde 3'ten az sonuç varken, katalog dışı bir şey arandığında. */
  /* İki harfte sağlayıcıya gidilmiyor: Finnhub "mu" için VZ, ZM, BNY gibi
     alakasız semboller döndürüyordu (ölçüldü). */
  /* Kapı sırası: önbellekteki sorgu kapısız; değilse önce IP, sonra süreç —
     reddedilen adres ortak bütçeden hak düşürmesin. Uzak dal gerekip de
     yapılamazsa yanıt `partial` (gerekçe `SEARCH_REMOTE_LIMIT` üstünde). */
  if (hits.length < 3 && query.length >= 3) {
    const gateOpen =
      isRemoteWarm(query, Date.now()) ||
      (rateLimit(clientKey(request, "search-remote"), SEARCH_REMOTE_LIMIT, SEARCH_WINDOW_MS).allowed &&
        rateLimit("search-remote:global", SEARCH_REMOTE_GLOBAL, SEARCH_WINDOW_MS).allowed);
    if (!gateOpen) {
      partial = true;
    } else {
      const remote = await searchSymbols(query);
      if (remote.ok) {
        markRemoteWarm(query, remote.fetchedAt, Date.now());
        for (const item of remote.data) {
          if (seen.has(item.symbol) || hits.length >= 10) continue;
          seen.add(item.symbol);
          hits.push({ symbol: item.symbol, name: item.description, logo: logoSrc(item.symbol, null) });
        }
      } else {
        /* Önbellekte sanılan kayıt düşmüş olabilir: hata, çağrının
           sağlayıcıya gerçekten gittiğini söylüyor. Bir dahaki soru yine
           kapıdan geçsin. */
        remoteWarm.delete(query);
        partial = true;
      }
    }
  }

  /* Mercek sorgusu düştüyse (`null`) yanıt yine `partial` — aynı gerekçe:
     rehber eşleşmesi olmayan bir sorguda boş yazı listesi oturum boyunca
     saklanmasın. */
  const mercekRows = await mercekler;
  if (mercekRows === null) partial = true;
  for (const row of mercekRows ?? []) {
    writings.push({
      kind: "mercek",
      slug: row.slug,
      title: row.title,
      dek: row.dek ?? "",
    });
  }

  /* Bayrak sunucuda ekleniyor: liste on iki sembollük sabit bir küme ve
     palete `lib/technical`i taşımak istemci demetine gösterge kodunu da
     çekerdi. */
  const flagged = hits.map((hit) => (isTechnicalSymbol(hit.symbol) ? { ...hit, technical: true } : hit));
  return NextResponse.json({
    hits: flagged,
    writings,
    ...(partial ? { partial: true } : {}),
  } satisfies SearchResponse);
}
