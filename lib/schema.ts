import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ==========================================================================
   Kullanıcı ve takip listeleri
   ========================================================================== */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    locale: text("locale").notNull().default("tr"),
    theme: text("theme").notNull().default("dark"),
    /**
     * "user" | "admin" — yönetim ekranının tek kapısı.
     *
     * Yetki env değişkeninde DEĞİL veritabanında: bir kullanıcıyı yönetici
     * yapmak ya da yetkisini almak yeniden deploy gerektirmemeli, ve iki
     * ayrı yerde tutulan bir yetki listesi er geç birbirinden ayrı düşer.
     * Varsayılan "user"; yükseltme elle SQL ile yapılır (scripts/make-admin.mts).
     *
     * Rol JWT'ye de basılır (auth.ts) — her istekte kullanıcıyı yeniden
     * okumamak için. Yetki alındığında oturum token'ı yenilenene kadar
     * (updateAge: 1 gün) açık kalabilir; bu yüzden yazan uçlar rolü
     * TOKEN'DAN DEĞİL veritabanından doğrular (lib/admin.ts).
     */
    role: text("role").notNull().default("user"),
    /**
     * Son başarılı giriş anı.
     *
     * NEDEN: panel üye SAYISINI biliyordu ama kaçının hâlâ kullandığını
     * bilmiyordu — otuz kayıtlı hesabın yirmi beşi bir daha hiç girmediyse
     * "toplam üye" sayısı bir şey anlatmıyor. Ölçü hesabı olan, yani kimliği
     * zaten bilinen kişilere ait; anonim ziyaretçi ölçümüne dokunmuyor.
     *
     * Yalnızca GİRİŞTE yazılıyor, her istekte değil: her sayfa isteğinde bir
     * UPDATE atmak Neon'da istek başına fazladan bir tur demek ve "son
     * giriş" sorusunun cevabı zaten girişte belli.
     *
     * KVKK metnindeki üye verisi tablosuna da eklendi — kaydedilen her alan
     * orada sayılı olmak zorunda.
     */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_key").on(t.username),
    uniqueIndex("users_email_key").on(t.email),
  ],
);

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Token adı ("primary" | "brass" | "up" | ...), hex değil. */
    color: text("color").notNull().default("primary"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("watchlists_user_idx").on(t.userId, t.sortOrder)],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("watchlist_items_unique").on(t.watchlistId, t.symbol),
    index("watchlist_items_symbol_idx").on(t.symbol),
  ],
);

/* ==========================================================================
   Sembol meta verisi ve fiyat önbelleği
   Sağlayıcı düşerse "son bilinen değer" buradan gösterilir.
   ========================================================================== */

export const symbols = pgTable("symbols", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  exchange: text("exchange"),
  sector: text("sector"),
  industry: text("industry"),
  logoUrl: text("logo_url"),
  description: text("description"),
  country: text("country"),
  currency: text("currency").default("USD"),
  marketCap: doublePrecision("market_cap"),
  shareOutstanding: doublePrecision("share_outstanding"),
  ipoDate: date("ipo_date"),
  weburl: text("weburl"),
  /** Endeks/ETF proxy'leri (SPY, QQQ, DIA) ayrı işaretlenir. */
  isIndexProxy: boolean("is_index_proxy").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quotesCache = pgTable("quotes_cache", {
  symbol: text("symbol").primaryKey(),
  price: doublePrecision("price"),
  change: doublePrecision("change"),
  changePct: doublePrecision("change_pct"),
  open: doublePrecision("open"),
  high: doublePrecision("high"),
  low: doublePrecision("low"),
  prevClose: doublePrecision("prev_close"),
  volume: doublePrecision("volume"),
  /** Sağlayıcının bildirdiği işlem anı. */
  tradedAt: timestamp("traded_at", { withTimezone: true }),
  source: text("source").notNull().default("alpaca"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Grafik barları — aralık başına tek satır, jsonb dizi. */
export const candlesCache = pgTable(
  "candles_cache",
  {
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    bars: jsonb("bars").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.timeframe] })],
);

/* ==========================================================================
   Takvimler
   ========================================================================== */

export const earningsCalendar = pgTable(
  "earnings_calendar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    reportDate: date("report_date").notNull(),
    /** bmo = açılış öncesi, amc = kapanış sonrası, dmh = seans içi */
    hour: text("hour"),
    epsEstimate: doublePrecision("eps_estimate"),
    epsActual: doublePrecision("eps_actual"),
    revenueEstimate: doublePrecision("revenue_estimate"),
    revenueActual: doublePrecision("revenue_actual"),
    quarter: integer("quarter"),
    year: integer("year"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("earnings_symbol_date_key").on(t.symbol, t.reportDate),
    index("earnings_date_idx").on(t.reportDate),
  ],
);

/**
 * Ekonomik takvim.
 * Tarih ve saat New York saatiyle (ET) tutulur — kaynaklar bu şekilde yayınlar.
 * UTC dönüşümü lib/market-hours.ts içinde yapılır.
 */
export const economicEvents = pgTable(
  "economic_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventDate: date("event_date").notNull(),
    /** "HH:mm" ET. Saati ilan edilmemiş olaylarda null. */
    eventTimeEt: text("event_time_et"),
    /** Aynı olayın tekrarlarını eşleştiren sabit anahtar: "cpi", "fomc-rate". */
    slug: text("slug").notNull(),
    titleTr: text("title_tr").notNull(),
    titleEn: text("title_en").notNull(),
    /** high | medium | low */
    importance: text("importance").notNull().default("medium"),
    actual: text("actual"),
    forecast: text("forecast"),
    previous: text("previous"),
    unit: text("unit"),
    /** Gerçekleşen değeri çekmek için FRED serisi. */
    fredSeriesId: text("fred_series_id"),
    source: text("source").notNull().default("seed"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("economic_events_slug_date_key").on(t.slug, t.eventDate),
    index("economic_events_date_idx").on(t.eventDate),
  ],
);

export const marketHolidays = pgTable("market_holidays", {
  /** NYSE/Nasdaq tatili, ET tarihi. */
  date: date("date").primaryKey(),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en").notNull(),
  /** Yarım gün ise erken kapanış saati "HH:mm" ET, tam tatilse null. */
  earlyCloseEt: text("early_close_et"),
});

/* ==========================================================================
   Makro seriler, haberler, günlük özet
   ========================================================================== */

export const macroSeries = pgTable("macro_series", {
  /** FRED serisi: CPIAUCSL, UNRATE, FEDFUNDS ... */
  seriesId: text("series_id").primaryKey(),
  slug: text("slug").notNull(),
  titleTr: text("title_tr").notNull(),
  titleEn: text("title_en").notNull(),
  latestValue: doublePrecision("latest_value"),
  prevValue: doublePrecision("prev_value"),
  unit: text("unit"),
  /** Verinin ait olduğu dönem: "2026-06" */
  periodLabel: text("period_label"),
  /** Son 60 gözlem — sayfa grafiği bunu kullanır. */
  observations: jsonb("observations"),
  nextReleaseAt: date("next_release_at"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const news = pgTable(
  "news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Sağlayıcı kimliği — mükerrer kaydı engeller. */
    providerId: text("provider_id").notNull(),
    headline: text("headline").notNull(),
    summary: text("summary"),
    /** Claude çevirisi — anahtar yoksa null kalır, orijinal gösterilir. */
    headlineTr: text("headline_tr"),
    summaryTr: text("summary_tr"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    source: text("source"),
    category: text("category"),
    symbols: text("symbols").array(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("news_provider_id_key").on(t.providerId),
    index("news_published_idx").on(t.publishedAt),
    /* Haber detayı her açılışta "bu görsel kaç haberde geçiyor" diye
       sayıyor (isGenericNewsImage — kaynak logosunu elemek için) ve o sorgu
       indekssiz kalınca tüm tabloyu tarıyordu. Tablo 90 günlük pencerede
       binlerce satır taşıyor; sayfa açılışına eklenen tarama boşuna.
       Kısmi indeks: satırların çoğunda görsel yok, onları taşımaya gerek
       yok — sorgu da zaten yalnızca dolu bir adresle geliyor. */
    index("news_image_url_idx")
      .on(t.imageUrl)
      .where(sql`${t.imageUrl} is not null`),
  ],
);

export const dailyBriefs = pgTable(
  "daily_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Günlükte o gün; haftalıkta haftanın PAZARTESİsi (dönemin çapası). */
    briefDate: date("brief_date").notNull(),
    locale: text("locale").notNull(),
    /** "daily" | "weekly" — aynı tarihe iki farklı dönem yazısı düşebilir. */
    period: text("period").notNull().default("daily"),
    headline: text("headline").notNull(),
    bodyMd: text("body_md").notNull(),
    /** "rules" | "claude" — özetin nasıl üretildiği ekranda belirtilir. */
    generatedBy: text("generated_by").notNull().default("rules"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_briefs_date_locale_period_key").on(
      t.briefDate,
      t.locale,
      t.period,
    ),
  ],
);

/**
 * Mercek yazıları — tek bir olayı uzun uzun anlatan yazılar.
 *
 * Haber tablosundan ayrı duruyor çünkü farklı bir şey: `news` sağlayıcıdan
 * gelen ham akış (başlık + iki cümle özet + kaynak linki), `stories` ise
 * kendi yazdığımız, kaynaklarını künyesinde sayan uzun metin. Ömürleri de
 * farklı: haber bir gün sonra ölür, dosya arşivde kalır.
 *
 * Rehber yazıları (ETF nedir, kaldıraç nedir...) bilinçli olarak burada
 * DEĞİL — onlar depoda `content/guide/` içinde yaşıyor. Gerekçe: rehber
 * içeriği durağan ve editoryal, kod incelemesinden geçmesi iyi; dosyalar
 * ise her akşam üretiliyor ve deploy beklemeden yazılabilmeli.
 */
export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    locale: text("locale").notNull().default("tr"),
    title: text("title").notNull(),
    /** Başlığın altındaki tek cümlelik giriş — kart ve sayfa başında. */
    dek: text("dek").notNull(),
    bodyMd: text("body_md").notNull(),
    /** Olayın yaşandığı gün (ET). Yayın tarihinden farklı olabilir. */
    eventDate: date("event_date").notNull(),
    /** Yazıda geçen semboller — ilgili hisselere bağlanır. */
    symbols: jsonb("symbols").$type<string[]>(),
    /* Kapak görseli alanı KASTEN YOK. Bir kez eklendi (0004) ve hemen geri
       alındı (0005): yazıların görsel dili metinden çizilen `:::` blokları —
       pay, akis, oncesi, bar, sayilar, zaman, grafik. Hepsi telifsiz, her
       temada tutarlı ve hiçbir yerde görsel barındırmayı gerektirmiyor.
       Haber fotoğrafı bunların hiçbirini sağlamıyordu. */
    /** [{ label, url }] — künyede kaynak listesi olarak basılır. */
    sources: jsonb("sources").$type<{ label: string; url?: string }[]>(),
    /** Okuma süresi dakika; yoksa gövdeden hesaplanır. */
    readMinutes: integer("read_minutes"),
    generatedBy: text("generated_by").notNull().default("claude"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("stories_slug_locale_key").on(t.slug, t.locale),
    index("stories_event_date_idx").on(t.eventDate),
  ],
);

/**
 * Mercek yazısının ÖNCEKİ hâlleri — üzerine yazılmadan önce alınan fotoğraf.
 *
 * NEDEN VAR: `stories` upsert'ü gövdeyi geçmişsiz eziyordu. Rutin aynı
 * slug'a ikinci kez yazdığında ya da panelden bir düzeltme yapıldığında eski
 * metin kayboluyor, yanlış bir düzenlemeden dönmenin hiçbir yolu kalmıyordu.
 * Panelden yazı düzenlemek açıldığı anda bu bir kayıp değil, bir risk oldu.
 *
 * FOTOĞRAF JSONB: satırın yazılmadan önceki hâli olduğu gibi saklanıyor.
 * Sütun sütun açmak, `stories` şeması her değiştiğinde bu tabloyu da
 * değiştirmek demekti; geri yükleme zaten fotoğrafı doğrulama şemasından
 * geçirip normal yazma yoluna veriyor, yani alanları burada tanımanın bir
 * faydası yok.
 *
 * SAYI SINIRLI: slug+dil başına son on sürüm tutuluyor, fazlası yazma
 * sırasında budanıyor. Sınırsız geçmiş, bir düzeltme aracının ödemesi
 * gereken bir bedel değil.
 */
export const storyRevisions = pgTable(
  "story_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    locale: text("locale").notNull(),
    /** Yazılmadan ÖNCEKİ satır — geri yükleme bunu okuyor. */
    snapshot: jsonb("snapshot").notNull(),
    /** Bu fotoğrafın üzerine kimin yazdığı: "claude" ya da "admin". */
    replacedBy: text("replaced_by").notNull(),
    replacedAt: timestamp("replaced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("story_revisions_key_idx").on(t.slug, t.locale, t.replacedAt)],
);

/**
 * Bilanço analizleri — açıklanmış bir çeyreğin okunmuş hâli.
 *
 * `earnings_calendar` ne zaman açıklanacağını söyler; bu tablo açıklandıktan
 * SONRA ne anlama geldiğini. İkisi ayrı duruyor çünkü ömürleri ve kaynakları
 * ayrı: takvim sağlayıcıdan gelir ve her gün senkronlanır, analiz bir kez
 * yazılır ve arşivde kalır. Takvim satırına bağlamak için yabancı anahtar da
 * yok — sağlayıcı satırı silip yeniden yazabiliyor; eşleşme sembol + tarih
 * üzerinden kuruluyor.
 *
 * Sayılar HAM tutulur (8.97e9), biçimlenmiş metin değil: aynı kayıt iki dilde
 * de gösteriliyor ve "8,97 Mr $" ile "$8.97B" arasındaki fark sunum katmanına
 * ait. Yalnızca kaynağı serbest metin olan alanlar (öne çıkan metrikler,
 * CEO alıntısı) dile göre yazılır.
 *
 * Mercek yazılarındaki gibi dil başına bir satır: aynı `symbol + period`
 * için `tr` ve `en` iki kayıt. Çeviri henüz yoksa sayfa orijinali not düşerek
 * gösterir, boş kalmaz.
 */
export const earningsAnalyses = pgTable(
  "earnings_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    /** URL parçası — küçük harf + tire: "4c-fy2026", "2c-2026". */
    period: text("period").notNull(),
    locale: text("locale").notNull().default("tr"),
    /** Ekranda görünen dönem adı: "4Ç FY2026" / "Q4 FY2026". */
    periodLabel: text("period_label").notNull(),
    company: text("company").notNull(),
    exchange: text("exchange"),
    sector: text("sector"),
    /** Bilançonun açıklandığı gün (ET). */
    reportDate: date("report_date").notNull(),
    /** bmo | amc | dmh — takvimdeki `hour` ile aynı sözlük. */
    timing: text("timing"),
    nextPeriodLabel: text("next_period_label"),
    /** "~Ekim 2026" gibi yaklaşık pencere; kesin tarih verilmez. */
    nextReportEstimate: text("next_report_estimate"),

    /** 0–100. Görüşün kendisi değil, gerekçesinin yoğunluğu. */
    score: integer("score").notNull(),
    /** buy | hold | sell — ekranda AL/TUT/SAT olarak yazılır. */
    verdict: text("verdict").notNull(),
    /** Kartlarda görünen tek cümlelik hikâye. */
    headline: text("headline").notNull(),

    price: doublePrecision("price"),
    /** Bilanço sonrası seans dışı tepki, yüzde. */
    reactionPct: doublePrecision("reaction_pct"),
    marketCap: doublePrecision("market_cap"),
    return1yPct: doublePrecision("return_1y_pct"),
    targetPrice: doublePrecision("target_price"),
    upsidePct: doublePrecision("upside_pct"),
    analystCount: integer("analyst_count"),

    revenue: doublePrecision("revenue"),
    revenueYoyPct: doublePrecision("revenue_yoy_pct"),
    eps: doublePrecision("eps"),
    /** Açıklanan EPS'in piyasa beklentisinden sapması, yüzde. */
    epsSurprisePct: doublePrecision("eps_surprise_pct"),

    /* ----------------------------------------------------------------
       Değerleme girdileri

       ORAN DEĞİL GİRDİ yazılır. Alanlar `pe_ratio`/`pb_ratio` olarak da
       açılabilirdi ama olmadı: bir oranın payı fiyattır ve fiyat her gün
       değişiyor. Analiz yazıldığı gün doğru olan F/K, üç hafta sonra
       sayfanın en üstünde duran canlı fiyatla çelişiyor — aynı sayfada iki
       fiyat, hangisinin hangisi olduğu söylenmeden. Ölçtük: sağlayıcının
       hazır F/K'si tam bu yüzden SNDK'da %5,6 sapıyordu.

       Bölenler burada, oranı sunum katmanı sayfadaki fiyatla kuruyor. Böylece
       okuyucu çarpıp doğrulayabiliyor.

       İkisi de İSTEĞE BAĞLI; yazılmayan oran hiç gösterilmez.

       PD/DD'nin böleni (`book_value_per_share`) bir süre buradaydı ve
       migration 0012 ile geri alındı. Sektöre bağlı bir ölçüydü: bankada
       ve GYO'da fiyatın kurulduğu yer, yarı iletkende gürültü — ve "bu
       şirkette anlamlı mı" kararı her analizde yeniden verilmesi gereken
       bir yargı çağrısıydı.
       ---------------------------------------------------------------- */

    /** Son dört çeyreğin toplam hisse başı kârı — F/K'nin böleni. */
    epsTtm: doublePrecision("eps_ttm"),
    /**
     * PEG'in böleni — beklenen yıllık kâr büyümesi, yüzde (18.4).
     *
     * `growthBasis` OLMADAN KULLANILMAZ. PEG'in tek sorunu hangi büyümenin
     * bölündüğünün söylenmemesi: aynı gün aynı şirket için iki kaynak, biri
     * ileriye dönük öteki son on iki ay üzerinden, üç kat farklı PEG
     * veriyordu (MU: 0,04 ile 0,12). Sayı tek başına yazılırsa okuyucunun
     * doğrulama şansı kalmıyor.
     */
    growthPct: doublePrecision("growth_pct"),
    /** Büyümenin tanımı — "ileriye dönük 3 yıl", "son 12 ay". Ekranda yazılı. */
    growthBasis: text("growth_basis"),

    /** 3 paragraflık özet. */
    summary: jsonb("summary").$type<string[]>().notNull(),
    /** Detaylı değerlendirme — her biri kalın mini başlıkla açılan bölümler. */
    analysis: jsonb("analysis")
      .$type<{ title: string; body: string }[]>()
      .notNull(),
    strengths: jsonb("strengths").$type<string[]>(),
    risks: jsonb("risks").$type<string[]>(),
    /** "Katalizörler" değil: Beklenen Gelişmeler. Tarih taşır. */
    upcoming: jsonb("upcoming").$type<string[]>(),
    /** Altı metrik kartı — etiketi de değeri de serbest metin, çünkü hangi
        ölçünün öne çıkacağı şirkete göre değişiyor (bankada net faiz marjı,
        bellekte brüt marj). `note` değerin altındaki renkli bağlam satırı. */
    highlights: jsonb("highlights").$type<
      { label: string; value: string; note?: string | null; tone?: string | null }[]
    >(),
    /**
     * Çeyreklik gelir serisi — sayfadaki sütun grafiği.
     *
     * Sağlayıcıdan çekilmiyor, analizle birlikte yazılıyor: mali yıl
     * takvimi şirkete göre kayıyor ("4Ç FY2026" kimi şirkette Temmuz'da
     * biter) ve doğru çeyrek etiketini yalnızca bilançoyu okuyan bilir.
     * `projected` işaretli son öğe gelecek çeyrek öngörüsüdür ve kesikli
     * çizilir; `note` varsa sütunun üstünde onun metni yazılır ("10,3–10,8").
     */
    quarterlyRevenue: jsonb("quarterly_revenue").$type<
      {
        label: string;
        value: number;
        projected?: boolean | null;
        note?: string | null;
      }[]
    >(),
    /**
     * Grafiklerin altındaki üçlü mini künye şeridi.
     *
     * Karnede olan ama sayfada olmayan parça buydu: sütun grafiğinin altında
     * "Yıllık Gelir Büyümesi · Veri Merkezi Payı · Tüketici Segmenti",
     * öngörü kartının altında "Faaliyet Gideri · Hisse Sayısı · Yatırım
     * Harcaması". Grafiği tamamlayan bağlam; onsuz kart yarım duruyor.
     */
    revenueFooter: jsonb("revenue_footer").$type<
      { label: string; value: string; note?: string | null; tone?: string | null }[]
    >(),
    guidanceFooter: jsonb("guidance_footer").$type<
      { label: string; value: string; note?: string | null; tone?: string | null }[]
    >(),
    /**
     * Gelecek çeyrek şirket öngörüsü — aralık barları.
     *
     * Her satır bir ölçü: şirketin verdiği alt–üst bandı dolu bar, piyasa
     * beklentisi onun üstündeki nokta. "Konsensüs" kelimesi hiçbir yerde
     * geçmez; `note` satırı bandın beklentiye göre nerede durduğunu yazar.
     */
    guidance: jsonb("guidance").$type<
      {
        label: string;
        low: number;
        high: number;
        consensus?: number | null;
        unit?: string | null;
        note?: string | null;
        evaluation?: string | null;
        tone?: string | null;
      }[]
    >(),
    /** `topics`: CEO'nun çağrıda vurguladığı 2-3 konu, hap rozet olarak
        basılır. jsonb içinde olduğu için şema değişikliği gerektirmedi. */
    ceoQuote: jsonb("ceo_quote").$type<{
      quote: string;
      name: string;
      title: string;
      topics?: string[] | null;
    }>(),
    /* Alanların hepsinde `| null` var: giriş şeması `.nullish()` kabul
       ediyor (GET boş alanları `null` döndürüyor ve o gövde geri
       gönderilebilmeli), dolayısıyla jsonb içinde de null durabiliyor. */
    sources: jsonb("sources").$type<{ label: string; url?: string | null }[]>(),

    generatedBy: text("generated_by").notNull().default("claude"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("earnings_analyses_key").on(t.symbol, t.period, t.locale),
    index("earnings_analyses_report_idx").on(t.reportDate),
    index("earnings_analyses_symbol_idx").on(t.symbol),
  ],
);


/* ==========================================================================
   Ölçüm — birinci taraf, çerezsiz sayfa görüntülemeleri
   ========================================================================== */

/**
 * Sayfa görüntülemeleri.
 *
 * NEDEN KENDİ TABLOMUZ: Vercel Web Analytics sayfa sayılarını veriyor ama bu
 * ürünün asıl soruları onun kırılımıyla cevaplanmıyor — "hangi hisse sayfası
 * okunuyor", "hangi analiz okundu", "İngilizce tarafa kim geliyor". Yol
 * şablonunu ve dili kendimiz yazdığımız için bu sorular tek SQL sorgusu.
 *
 * NE TUTULMUYOR — liste kısa olsun diye değil, tutulmadığı için:
 *   · IP adresi. Hiçbir sütunda yok, ham hâliyle bir yere yazılmıyor.
 *   · User-Agent metni. Yalnızca "mobil / tablet / masaüstü" üçlüsüne indirgenir.
 *   · Tam yönlendiren adres. Yalnızca alan adı; sorgu dizesi ve yol atılır
 *     (arama terimleri ve özel bağlantılar oraya sızıyor).
 *   · Kullanıcı kimliği. `signedIn` yalnızca evet/hayır — kim olduğu değil.
 *
 * `visitorHash` GÜNLÜK DÖNER: girdisi (IP + tarayıcı künyesi + O GÜNÜN
 * tarihi + sunucu sırrı) ve sonuç 16 karaktere kırpılır. Aynı ziyaretçi gün
 * içinde aynı özeti üretir — tekil ziyaretçi bu yüzden sayılabiliyor — ama
 * ertesi gün başka bir özet üretir ve iki gün birbirine bağlanamaz. Geri
 * döndürülemez; sır olmadan üretilemez.
 *
 * SAKLAMA SÜRESİ 180 GÜN. Günlük cron daha eskisini siler; tablo sonsuza
 * kadar büyümez ve panelin ihtiyacı olan pencere zaten altı ay.
 */
export const pageViews = pgTable(
  "page_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Ziyaret edilen yol, sorgu dizesi atılmış: "/hisse/AAPL". */
    path: text("path").notNull(),
    /** Rota şablonu: "/hisse/[symbol]". Toplamlar bunun üzerinden alınır. */
    route: text("route").notNull(),
    locale: text("locale").notNull(),
    /** Yalnızca alan adı — "google.com". Site içi gezinmede null. */
    referrerHost: text("referrer_host"),
    /** "mobile" | "tablet" | "desktop" */
    device: text("device").notNull(),
    /** Giriş yapmış bir okuyucu mu — kim olduğu değil. */
    signedIn: boolean("signed_in").notNull().default(false),
    /** Günlük dönen tuzlu özet; gerekçesi tablo yorumunda. */
    visitorHash: text("visitor_hash").notNull(),
    /** ET takvim günü — panelin bütün toplamları bu sütuna göre. */
    viewedOn: date("viewed_on").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("page_views_day_idx").on(t.viewedOn),
    index("page_views_route_idx").on(t.viewedOn, t.route),
    index("page_views_path_idx").on(t.viewedOn, t.path),
    index("page_views_visitor_idx").on(t.viewedOn, t.visitorHash),
  ],
);

/* ==========================================================================
   Çıkarsanan tipler
   ========================================================================== */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type SymbolRow = typeof symbols.$inferSelect;
export type QuoteRow = typeof quotesCache.$inferSelect;
export type EarningsRow = typeof earningsCalendar.$inferSelect;
export type EconomicEventRow = typeof economicEvents.$inferSelect;
export type MacroSeriesRow = typeof macroSeries.$inferSelect;
export type NewsRow = typeof news.$inferSelect;
export type DailyBriefRow = typeof dailyBriefs.$inferSelect;
export type StoryRow = typeof stories.$inferSelect;
export type MarketHolidayRow = typeof marketHolidays.$inferSelect;
export type EarningsAnalysisRow = typeof earningsAnalyses.$inferSelect;
export type PageViewRow = typeof pageViews.$inferSelect;

/** Kullanıcı rolleri — "admin" yönetim ekranını açar, başka ayrıcalığı yok. */
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** AL / TUT / SAT — kayıtta İngilizce anahtar, ekranda dile göre yazılır. */
export type Verdict = "buy" | "hold" | "sell";
