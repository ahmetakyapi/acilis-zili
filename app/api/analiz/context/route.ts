import { NextResponse } from "next/server";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { earningsAnalyses, earningsCalendar, symbols } from "@/lib/schema";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { sectorGroupOf } from "@/lib/sectors";
import { SPOTLIGHT_SYMBOLS } from "@/lib/spotlight";

/**
 * Analiz rutini için bağlam paketi.
 *
 * Rutin bu ucu çeker ve iki soruyu cevaplar:
 *   1. Son günlerde hangi BÜYÜK şirketler bilanço açıkladı?
 *   2. Hangilerini zaten yazdım, hangi dilde ya da hangi alanda eksiğim var?
 *
 * Uç bir sıra ÖNERİR ama seçmez: aday listesi piyasa değerine göre sıralı
 * gelir, hangisinin yazılacağına rutin karar verir. Talimatı
 * docs/claude-rutinler.md § 4'te.
 *
 * Rakamlar burada YALNIZCA takvimin bildiği kadarıyla var (sağlayıcının
 * beklenti/gerçekleşen alanları); rutin bunları başlangıç noktası sayar ve
 * gerçek verileri şirketin resmi bülteninden doğrular.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/**
 * Aday havuzunun eşikleri — tek sayı değil, iki kademe.
 *
 * Teknoloji ve altyapı tarafında evren daha hızlı değişiyor: 100–200 milyar
 * bandındaki bir yarı iletken, veri merkezi ya da güç altyapısı şirketinin
 * çeyreği, aynı büyüklükteki bir perakendecininkinden çok daha fazla şey
 * anlatıyor. Öteki sektörlerde aynı bandın çoğu "sıradan iyi çeyrek"
 * oluyor ve analiz yazmaya değmiyor.
 */
const CAP_TECH_INFRA = 100e9;
const CAP_GENERAL = 200e9;

/**
 * Eşiğe bakılmaksızın aday sayılan şirketler.
 *
 * Liste burada DURMUYOR: aynı adlar bilanço takviminde ve gün şeridinde de
 * eşiği atlıyor ve üç kopya hâlinde yaşadıklarında biri güncellenip ötekiler
 * unutuluyordu. Tek kaynak `lib/spotlight.ts`; gerekçenin tamamı orada.
 */
const ALWAYS_ELIGIBLE = new Set(SPOTLIGHT_SYMBOLS);

/**
 * "Teknoloji ve altyapı" kümesi.
 *
 * İki sektör grubu doğrudan giriyor; kalanı endüstri adıyla ekleniyor çünkü
 * GICS taksonomisi bu kategoriyi tam karşılamıyor — Rocket Lab "Aerospace &
 * Defense", Bloom Energy "Electrical Equipment", Constellation Energy
 * "Utilities" altında duruyor ve üçü de bu işin altyapısı.
 */
const TECH_INFRA_GROUPS = new Set(["teknoloji", "yari-iletken"]);
const TECH_INFRA_INDUSTRIES = new Set([
  // Uzay ve savunma
  "Aerospace & Defense",
  // Güç ve elektrik ekipmanı
  "Electrical Equipment",
  "Electrical Components & Equipment",
  "Heavy Electrical Equipment",
  // Elektrik üretimi — veri merkezi talebinin ucu buraya çıkıyor
  "Utilities",
  "Electric Utilities",
  "Multi-Utilities",
  "Independent Power Producers & Energy Traders",
  "Renewable Electricity",
  // Şebekeyi ve veri merkezini fiziksel olarak kuranlar
  "Construction & Engineering",
  // Bağlantı katmanı
  "Communications",
  "Telecommunication",
  "Alternative Carriers",
  "Integrated Telecommunication Services",
  "Wireless Telecommunication Services",
  // Veri merkezinin kendisi
  "Data Center REITs",
]);

function isTechInfra(industry: string | null): boolean {
  if (industry && TECH_INFRA_INDUSTRIES.has(industry)) return true;
  return TECH_INFRA_GROUPS.has(sectorGroupOf(industry).key);
}

/** Geriye bakış penceresi — bir haftadan eski bilanço artık haber değil. */
const LOOKBACK_DAYS = 7;

/** Eksik denetiminin okuduğu satır — dizi alanlarının yalnızca UZUNLUĞU. */
type AuditRow = {
  price: number | null;
  marketCap: number | null;
  return1yPct: number | null;
  targetPrice: number | null;
  analystCount: number | null;
  highlights: number;
  quarterlyRevenue: number;
  guidance: number;
  revenueFooter: number;
  guidanceFooter: number;
  /** Halka arzı bilanço gününden bir yıldan yakın mı? */
  listedUnderAYear: boolean;
};

/**
 * Sayfanın yarım kalmaması için DOLU OLMASI GEREKEN alanlar.
 *
 * Denetim bir süre yalnızca iki grafiğe bakıyordu (`has_charts`), oysa rutin
 * prompt'u (docs/claude-rutinler.md § 4, adım 3 ve 4) on bir alanı zorunlu
 * sayıyor. Aradaki fark SESSİZDİ: başlık kartı ya da görüş şeridi boş kalmış
 * bir analiz, iki grafiği dolu olduğu sürece "tamam" görünüyordu ve rutin onu
 * bir daha hiç açmıyordu. Liste artık prompt'un sözleşmesi; biri değişirse
 * öteki de değişir.
 *
 * Sıra sayfanın sırası: başlık kartı, görüş şeridi, metrik kartları,
 * grafikler, grafik künyeleri. Rutin `missing`i bu sırayla okur.
 *
 * Listede OLMAYANLAR bilerek dışarıda:
 *   - `upside_pct` — prompt onu da zorunlu sayıyor ama görüş şeridi alan boşsa
 *     yüzdeyi fiyattan ve hedeften kendisi hesaplıyor; eksik bir şey yok.
 *   - `eps_ttm`, `growth_pct` — prompt'ta isteğe bağlı. Doğrulanamayan bölen
 *     yazılmıyor, oran da basılmıyor; boşluk eksik değil, dürüstlük.
 */
const REQUIRED_FIELDS: ReadonlyArray<
  readonly [field: string, isMissing: (row: AuditRow) => boolean]
> = [
  /* Başlık kartının manşeti. Yoksa kapanış fiyatı ile altındaki künye rayı
     BİRLİKTE basılmıyor — piyasa değeri ve getiri dolu olsa bile. */
  ["price", (row) => row.price === null],
  /* Künye rayı. Sayfa canlı piyasa değerini tercih ediyor ama o yalnızca
     sağlayıcı ayaktayken var; düştüğünde yerine bu geçiyor. */
  ["market_cap", (row) => row.marketCap === null],
  /* Künye rayı — ama halka arzı bilanço gününden bir yıl yakın bir şirkette
     "son 12 ayın getirisi" diye bir sayı YOK. Ölçüldü: SPCX 2Ç 2026'yı arzdan
     53 gün sonra açıkladı ve rutin alanı doğru olarak boş bıraktı. Eksik
     sayılsaydı rutin her gün aynı kayda dönecek, ya takılacak ya da arzdan bu
     yana getiriyi "12 ay" diye yazacaktı. Arz tarihi bilinmiyorsa (951
     sembolün 4'ü) alan istenir. */
  ["return_1y_pct", (row) => row.return1yPct === null && !row.listedUnderAYear],
  /* Görüş şeridinin sağ ucu; yoksa uç bomboş kalıyor. */
  ["target_price", (row) => row.targetPrice === null],
  /* Hedefin etiketi "Ort. Analist Hedefi (22)". Sayı yoksa etiket kaç
     analistin ortalaması olduğunu söylemiyor. */
  ["analyst_count", (row) => row.analystCount === null],
  /* Altı metrik kartı: ilk ikisi kapağa çıkıyor, kalan dördü ölçü
     ızgarasında. İki kart ya da daha azıyla ızgaraya hiç kart düşmüyor ve
     bölüm başlığı boş duruyor. */
  ["highlights", (row) => row.highlights < 6],
  ["quarterly_revenue", (row) => row.quarterlyRevenue === 0],
  ["guidance", (row) => row.guidance === 0],
  /* Künyeler boşsa site gövdedeki sayılardan birini türetiyor, yani sayfa
     kırılmıyor — ama o künye sayfanın başka yerinde duran üç sayıyı
     tekrarlıyor. Prompt ikisini de grafiklerle aynı gruba koyuyor. */
  ["revenue_footer", (row) => row.revenueFooter === 0],
  ["guidance_footer", (row) => row.guidanceFooter === 0],
];

/** Dizi alanının uzunluğu; `null` sıfır sayılır. */
const arrayLength = (column: AnyColumn) =>
  sql<number>`coalesce(jsonb_array_length(${column}), 0)`;

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days"));
  const lookback =
    Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 60
      ? Math.floor(daysParam)
      : LOOKBACK_DAYS;

  const today = todayEt();
  const from = addEtDays(today, -lookback);

  const reported = await db
    .select()
    .from(earningsCalendar)
    .where(
      and(
        gte(earningsCalendar.reportDate, from),
        lte(earningsCalendar.reportDate, today),
      ),
    )
    .orderBy(desc(earningsCalendar.reportDate));

  const symbolList = [...new Set(reported.map((row) => row.symbol))];

  const [profiles, existing] = await Promise.all([
    symbolList.length > 0
      ? db
          .select({
            symbol: symbols.symbol,
            name: symbols.name,
            exchange: symbols.exchange,
            industry: symbols.industry,
            marketCap: symbols.marketCap,
            currency: symbols.currency,
          })
          .from(symbols)
          .where(inArray(symbols.symbol, symbolList))
      : Promise.resolve([]),
    /* DİZİLER ÇEKİLMİYOR, UZUNLUKLARI SORULUYOR. Uç eskiden iki grafik
       dizisini TAMAMEN çekip yalnızca boş mu diye bakıyordu; denetim beş
       `jsonb` alanına çıkınca bu 400 satır × beş dizi olurdu ve hepsinde
       tek soru "kaç öğe var". Panelin aynı sorusu (`lib/admin-data.ts`,
       `getContentSummary`) da kararı veritabanında veriyor. */
    db
      .select({
        symbol: earningsAnalyses.symbol,
        period: earningsAnalyses.period,
        periodLabel: earningsAnalyses.periodLabel,
        locale: earningsAnalyses.locale,
        reportDate: earningsAnalyses.reportDate,
        verdict: earningsAnalyses.verdict,
        score: earningsAnalyses.score,
        price: earningsAnalyses.price,
        marketCap: earningsAnalyses.marketCap,
        return1yPct: earningsAnalyses.return1yPct,
        targetPrice: earningsAnalyses.targetPrice,
        analystCount: earningsAnalyses.analystCount,
        highlights: arrayLength(earningsAnalyses.highlights),
        quarterlyRevenue: arrayLength(earningsAnalyses.quarterlyRevenue),
        guidance: arrayLength(earningsAnalyses.guidance),
        revenueFooter: arrayLength(earningsAnalyses.revenueFooter),
        guidanceFooter: arrayLength(earningsAnalyses.guidanceFooter),
        /* Arz tarihi yoksa `false`: bilinmeyen tarih "ölçü yok" demek
           değil, alan istenmeye devam eder. */
        listedUnderAYear: sql<boolean>`coalesce(${symbols.ipoDate} > ${earningsAnalyses.reportDate} - interval '1 year', false)`,
      })
      .from(earningsAnalyses)
      .leftJoin(symbols, eq(symbols.symbol, earningsAnalyses.symbol))
      .orderBy(desc(earningsAnalyses.reportDate))
      .limit(400),
  ]);

  const profileOf = new Map(profiles.map((row) => [row.symbol, row]));

  /* Aynı analiz iki dilde iki satır — rutin için analiz başına TEK kayıt ve
     dillerin listesi kullanışlı: "hangisinin İngilizcesi eksik" tek bakışta
     görünür, geri doldurma da buradan beslenir. */
  const grouped = new Map<
    string,
    {
      symbol: string;
      period: string;
      period_label: string;
      report_date: string;
      verdict: string;
      score: number;
      locales: string[];
      /* Grafik alanları sonradan eklendi; onlardan önce yazılmış analizler
         sayfada metin yığını olarak duruyor.

         `missing` onu da kapsıyor (`quarterly_revenue`, `guidance`) ama
         bayrak YERİNDE KALIYOR: rutin prompt'u claude.ai'ye kopyalanıp orada
         yaşıyor ve eski kopyalar bu alana bakıyor. Alan kalkarsa o kopyalar
         grafiksiz bir kaydı bir daha hiç görmez — hata da vermeden. */
      has_charts: boolean;
      /* Dolu olması gereken ama boş kalmış alanlar, `REQUIRED_FIELDS`
         sırasıyla. İki dilden BİRİNDE boş olan da listeye girer — sayfa o
         dilde yarım duruyor. Boş dizi: analiz tam. */
      missing: string[];
    }
  >();
  for (const row of existing) {
    const key = `${row.symbol}:${row.period}`;
    const held = grouped.get(key);
    const charts = row.quarterlyRevenue > 0 && row.guidance > 0;
    /* Öteki dilin eksikleriyle birleşim; sırayı satırların geliş sırası
       değil `REQUIRED_FIELDS` belirliyor. */
    const missing = REQUIRED_FIELDS.filter(
      ([field, isMissing]) =>
        (held?.missing.includes(field) ?? false) || isMissing(row),
    ).map(([field]) => field);
    if (held) {
      if (!held.locales.includes(row.locale)) held.locales.push(row.locale);
      /* İki dilden biri grafiksizse analiz eksik sayılır. */
      held.has_charts = held.has_charts && charts;
      held.missing = missing;
    } else {
      grouped.set(key, {
        symbol: row.symbol,
        period: row.period,
        period_label: row.periodLabel,
        report_date: row.reportDate,
        verdict: row.verdict,
        score: row.score,
        locales: [row.locale],
        has_charts: charts,
        missing,
      });
    }
  }

  /* ÖLÇÜT PENCERE, SEMBOL DEĞİL. Bayrak `existing.map(row => row.symbol)`
     ile kuruluyordu ve `existing` sorgusu TARİHE BAKMIYOR (son 400 analiz,
     aylar geriye gidiyor). Sonuç: bir kez analiz edilmiş her şirket, YENİ
     çeyreğini açıkladığında da "zaten analiz edildi" görünüyordu — rutin onu
     bir daha hiç aday listesine almıyordu. Aynı dosyadaki `grouped` haritası
     doğru granülerliği (`sembol:dönem`) zaten kullanıyor; ikisi çelişiyordu.

     Anahtar olarak `sembol:reportDate` seçilmedi: analizin `report_date`i
     takvimden türemiyor, rutinin POST gövdesinde elle yazılıyor ve uç
     yalnızca biçimini doğruluyor. Takvimle bir gün oynadığında bayrak bu kez
     YANLIŞ NEGATİF verir ve aynı çeyrek ikinci kez yazılır.

     Aday penceresi daha dayanıklı: aday listesi zaten `from`–`today`
     aralığında bilanço açıklamış şirketler, yani o pencerede tarihi olan bir
     analiz o çeyreğe ait demektir. Bir gün kayması pencereyi değiştirmiyor. */
  const analyzed = new Set(
    existing
      .filter((row) => row.reportDate >= from)
      .map((row) => row.symbol),
  );

  const candidates = reported
    .flatMap((row) => {
      const profile = profileOf.get(row.symbol);
      /* Piyasa değeri yalnızca USD cinsinden karşılaştırılabilir; yabancı
         para birimli profiller elenir (TSM/TWD gibi). */
      const marketCap =
        profile?.currency === "USD" ? (profile.marketCap ?? null) : null;
      const industry = profile?.industry ?? null;
      const techInfra = isTechInfra(industry);
      const watched = ALWAYS_ELIGIBLE.has(row.symbol);
      const threshold = techInfra ? CAP_TECH_INFRA : CAP_GENERAL;
      if (!watched && (marketCap ?? 0) < threshold) return [];

      return [{
        symbol: row.symbol,
        company: profile?.name ?? null,
        exchange: profile?.exchange ?? null,
        industry,
        market_cap: marketCap,
        /* Adayın hangi kapıdan girdiği: eşiği geçtiği için mi, yoksa adı
           listede olduğu için mi. Rutin sıralama kararını buna bakarak
           veriyor. */
        tier: watched
          ? ("izlenen" as const)
          : techInfra
            ? ("teknoloji-altyapi" as const)
            : ("genel" as const),
        threshold: watched ? null : threshold,
        report_date: row.reportDate,
        timing: row.hour,
        quarter: row.quarter,
        year: row.year,
        eps_estimate: row.epsEstimate,
        eps_actual: row.epsActual,
        revenue_estimate: row.revenueEstimate,
        revenue_actual: row.revenueActual,
        already_analyzed: analyzed.has(row.symbol),
      }];
    })
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));

  return NextResponse.json({
    today_et: today,
    window_et: { from, to: today },
    thresholds: {
      "teknoloji-altyapi": CAP_TECH_INFRA,
      genel: CAP_GENERAL,
      izlenen: [...ALWAYS_ELIGIBLE],
    },
    /* Son bir haftada açıklamış, eşiği geçen ya da adı listede olan
       şirketler; piyasa değerine göre sıralı. `already_analyzed` true
       olanlar atlanır ya da güncellenir. */
    candidates,
    /* Zaten yazılmış analizler — `locales` hangi dillerin mevcut olduğunu
       söyler; "en" eksikse çevirisi bekleniyor. `missing` boş değilse
       sayfa yarım duruyor ve listedeki alanlar tamamlanmayı bekliyor. */
    existing_analyses: [...grouped.values()],
  });
}
