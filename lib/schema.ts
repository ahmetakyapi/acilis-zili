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
      { label: string; value: string; note?: string; tone?: string }[]
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
      { label: string; value: number; projected?: boolean; note?: string }[]
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
        consensus?: number;
        unit?: string;
        note?: string;
        tone?: string;
      }[]
    >(),
    ceoQuote: jsonb("ceo_quote").$type<{
      quote: string;
      name: string;
      title: string;
    }>(),
    sources: jsonb("sources").$type<{ label: string; url?: string }[]>(),
    /** Karne PNG'sinin site içi yolu: "/karne/sndk-4c-fy2026.png". Yoksa
        kart hiç basılmaz — boş çerçeve göstermektense yokluğu dürüst. */
    cardImageUrl: text("card_image_url"),

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

/**
 * Bilanço karnesi görselleri — analiz kaydının PNG'si.
 *
 * Ayrı tabloda çünkü megabaytlık bir alan: `earnings_analyses` her liste
 * sorgusunda okunuyor ve görsel oraya konsaydı, altı satırlık bir tabloyu
 * çizmek için on megabayt taşımak gerekirdi. Burada yalnızca görseli servis
 * eden rota dokunuyor.
 *
 * Veri base64 METİN olarak tutuluyor, bytea olarak değil. Neon'un HTTP
 * sürücüsü bytea'yı sürüm ve yapılandırmaya göre kâh Buffer kâh `\x…` hex
 * dizesi döndürüyor; base64 her iki uçta da aynı şey. %33 yer maliyeti,
 * sürücü davranışına bağlı sessiz bir bozulmadan ucuz.
 *
 * Dil başına ayrı satır: karne metin içeriyor ("Genel Görüş", "Piyasa
 * Beklentisi") ve Türkçesiyle İngilizcesi aynı görsel değil.
 */
export const earningsAnalysisCards = pgTable(
  "earnings_analysis_cards",
  {
    symbol: text("symbol").notNull(),
    period: text("period").notNull(),
    locale: text("locale").notNull().default("tr"),
    mimeType: text("mime_type").notNull().default("image/png"),
    /** Base64 gövde — `data:` ön eki OLMADAN. */
    dataBase64: text("data_base64").notNull(),
    /** Düzen zıplamasın diye kaydediliyor; yoksa A4 2x varsayılır. */
    width: integer("width"),
    height: integer("height"),
    byteSize: integer("byte_size"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.period, t.locale] })],
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
export type EarningsAnalysisCardRow = typeof earningsAnalysisCards.$inferSelect;

/** AL / TUT / SAT — kayıtta İngilizce anahtar, ekranda dile göre yazılır. */
export type Verdict = "buy" | "hold" | "sell";
