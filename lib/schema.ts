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
export type MarketHolidayRow = typeof marketHolidays.$inferSelect;
