import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
/* Yalnızca TİP: derlemede siliniyor. drizzle-kit bu dosyayı `@/` takma
   adlarını çözmeden yüklüyor, yani buradan bir DEĞER içe aktarılamaz. */
import type { TechnicalCopy, TechnicalSnapshot } from "./technical";
import type { StoredMetrics } from "./scorecard";

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

/**
 * Profil ikonu — kullanıcının kendi seçtiği karo (26 Eylül).
 *
 * NEDEN `users` TABLOSUNDA BİR SÜTUN DEĞİL. Migration'lar dağıtımda
 * uygulanmıyor, elle uygulanıyor (deploy.yml `db:migrate` çalıştırmıyor).
 * `users`a sütun eklenseydi, migration canlıya inmeden push edilen kod
 * her `select().from(users)` sorgusunda o sütunu isteyecek ve GİRİŞİ
 * kıracaktı. Ayrı tablo bu bağı koparıyor: onu okuyan tek yer
 * (`lib/avatar-data.ts`) tablo yokken sessizce baş harflere düşüyor, yani
 * kod migration'dan önce de güvenle yayında durabiliyor.
 *
 * `icon` ve `color` ANAHTAR (`lib/avatars.ts`), çizim ya da hex değil;
 * hesap silinince satır da gidiyor. KVKK metnindeki üye verisi tablosunda
 * sayılı. İkisi de boş olabiliyor (0019): renk seçip baş harflerde kalmak
 * mümkün.
 */
export const userAvatars = pgTable("user_avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Boşsa karo baş harfleri basıyor — renk seçip ikon seçmemek mümkün. */
  icon: text("icon"),
  /** `lib/avatars.ts` → AVATAR_COLORS; boşsa ikonun varsayılan rengi. */
  color: text("color"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

/**
 * Portföy pozisyonları — `/portfoy`.
 *
 * NEDEN AYRI TABLO, `watchlist_items`a sütun DEĞİL: migration'lar deploy'da
 * uygulanmıyor ve canlıdaki kod migration'dan önce yayına inebiliyor. Var
 * olan bir tabloya eklenen sütun, migration inene kadar favoriler
 * sorgusunu kırardı (26 Eylül'deki `user_avatars` dersi). Kendi tablosu
 * olan özellik tablo yokken sessizce düşüyor (`lib/portfolio-data.ts`).
 *
 * Takip listesi "neye bakıyorum", portföy "neyim var": adet ve maliyet
 * olmadan TL kâr/zarar ve vergi hesabı kurulamıyor.
 *
 * `cost_usd` HİSSE BAŞI alış fiyatı (dolar), toplam değil: kullanıcı aracı
 * kurumun ekstresinde bu sayıyı görüyor. `numeric` — kesirli adet (0,125
 * hisse) ve kuruşun altındaki fiyatlar kayan noktada yuvarlanmasın; sürücü
 * dize döndürüyor, okuyan taraf sayıya çeviriyor.
 *
 * Hesap silinince CASCADE ile düşüyor (bkz. `deleteAccountAction`).
 */
export const portfolioPositions = pgTable(
  "portfolio_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    costUsd: numeric("cost_usd", { precision: 20, scale: 6 }).notNull(),
    /** Alış günü — TL maliyeti o günün TCMB döviz alış kuruyla kuruluyor. */
    boughtAt: date("bought_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("portfolio_positions_user_idx").on(t.userId, t.boughtAt)],
);

/**
 * Portföy sıralaması — okuyucunun elle verdiği sıra (2 Ekim).
 *
 * KENDİ TABLOSU. Sıra `portfolio_positions`a bir sütun olarak eklenmedi:
 * migration'lar deploy'da uygulanmıyor ve o tabloya eklenen bir sütun,
 * migration inene kadar portföyün HER okumasını kırardı (CLAUDE.md,
 * "Bilinmesi gerekenler"). Bu tablo yokken okuma sessizce düşüyor ve liste
 * varsayılan sırayla (en büyük pozisyon üstte) çiziliyor.
 *
 * Kullanıcı başına tek satır, pozisyon kimlikleri sırayla. Satır yoksa
 * varsayılan; "En Büyük Üstte" satırı siliyor. Listede olmayan pozisyon
 * (sıra verildikten sonra eklenen) sona, kendi içinde büyükten küçüğe;
 * silinmiş pozisyonun kimliği okumada atlanıyor.
 */
/**
 * FİYAT ALARMLARI (8 Ekim) — "NVDA 250 doları geçerse haber ver".
 *
 * Favorilerde not vardı ama hedef yoktu: okuyucu beklediği fiyatı aklında
 * tutup her gün sayfayı açıp bakıyordu. Satır bir hedef ve yön (`above`:
 * hedefin üstüne çıkarsa, `below`: altına inerse); yön kurulurken o anki
 * fiyattan türetiliyor ve `ref_price` olarak saklanıyor ki ekran "kurduğundan
 * beri ne kadar yol aldı" diyebilsin.
 *
 * TETİK GÖRÜLDÜĞÜ AN, GERÇEKLEŞTİĞİ AN DEĞİL. Elimizde gün içi bir izleyici
 * yok (cron günde bir); alarm, okuyucunun sitede güncel bir kotasyon
 * gördüğü sayfada değerlendiriliyor ve `triggered_at` o kontrolün anı.
 * Arayüz bunu böyle yazıyor ("… Kontrolde Görüldü"), "şu saatte geçti"
 * demiyor — veri dürüstlüğü kuralı 1. Bayat kotasyon (`stale`) alarmı
 * tetiklemiyor: önbellekteki dünkü fiyat bugünün hedefini geçmiş saymaz.
 *
 * KENDİ TABLOSU, `users`a SÜTUN DEĞİL — migration deploy'da uygulanmıyor
 * (CLAUDE.md). Tablo yokken okuyan boş liste döner, yazan "kurulamadı" der
 * (lib/price-alerts.ts).
 */
export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    /** "above" | "below" */
    direction: text("direction").notNull(),
    target: numeric("target", { precision: 20, scale: 6 }).notNull(),
    /** Kurulduğu andaki fiyat; yoksa (sağlayıcı düşük) boş. */
    refPrice: numeric("ref_price", { precision: 20, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Hedefin geçildiğinin GÖRÜLDÜĞÜ kontrol; boşsa bekliyor. */
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    triggeredPrice: numeric("triggered_price", { precision: 20, scale: 6 }),
  },
  (t) => [
    index("price_alerts_user_idx").on(t.userId, t.createdAt),
    index("price_alerts_user_symbol_idx").on(t.userId, t.symbol),
  ],
);

/**
 * PORTFÖY SATIŞLARI (9 Ekim) — gerçekleşen kâr/zarar.
 *
 * Satış kaydı yoktu: kısmi satışı kaydetmenin tek yolu pozisyonun adedini
 * elle düşürmekti ve satılan kısmın dolar/lira kârı, vergi hesaplayıcısının
 * ihtiyaç duyduğu geçmişle birlikte kayboluyordu.
 *
 * SATIR SATIŞ DEĞİL, TÜKETİLEN PARTİ. Satış sembol bazında İLK GİREN İLK
 * ÇIKAR ile en eski alış partilerinden düşülüyor (Türkiye'de menkul kıymet
 * kazancının yöntemi; vergi hesaplayıcısı da aynısını yapıyor) ve her
 * tüketilen parti kendi maliyeti ve alış günüyle ayrı satır. Böylece
 * gerçekleşen lira kârı alış gününün kuruyla kurulabiliyor ve satışı geri
 * almak partileri birebir iade ediyor. Bir satışın satırlarını `sale_id`
 * bağlıyor.
 *
 * KENDİ TABLOSU — migration deploy'da uygulanmıyor (CLAUDE.md); tablo yokken
 * okuma boş döner ve satış düğmesi basılmaz (lib/portfolio-sales.ts).
 */
export const portfolioSales = pgTable(
  "portfolio_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Aynı satışın partilerini bağlar. */
    saleId: uuid("sale_id").notNull(),
    symbol: text("symbol").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Hisse başı satış fiyatı, dolar. */
    priceUsd: numeric("price_usd", { precision: 20, scale: 6 }).notNull(),
    soldAt: date("sold_at").notNull(),
    /** Tüketilen partinin hisse başı alış fiyatı ve günü. */
    costUsd: numeric("cost_usd", { precision: 20, scale: 6 }).notNull(),
    boughtAt: date("bought_at").notNull(),
    /** Partinin notu — satış geri alınırsa pozisyona geri yazılıyor. */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("portfolio_sales_user_idx").on(t.userId, t.soldAt),
    index("portfolio_sales_sale_idx").on(t.saleId),
  ],
);

export const portfolioOrder = pgTable("portfolio_order", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  positionIds: jsonb("position_ids").$type<string[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

/** Bir faaliyet segmentinin çeyrek geliri — ham dolar, yıllık değişim yüzde. */
export type AnalysisSegment = {
  name: string;
  revenue: number;
  yoyPct?: number | null;
  note?: string | null;
};

/**
 * Şirkete özgü bir ölçü (abone sayısı, teslimat, ARPU…).
 *
 * `unit` üç sözlükten biri ya da serbest bir sayma birimi: "USD" para
 * olarak, "%" yüzde olarak biçimlenir; başka her değer sayının arkasına
 * yazılan birimdir ("abone", "araç"). `source` bir SÖZLÜK, serbest metin
 * değil (bkz. `lib/earnings-extras.ts` → KPI_SOURCES).
 */
export type AnalysisKpi = {
  name: string;
  value: number;
  unit: string;
  yoyPct?: number | null;
  source: string;
};

/**
 * Bilanço analizinin İSTEĞE BAĞLI ekleri — "30 Saniyede" özeti, segment
 * gelirleri ve şirkete özgü ölçüler.
 *
 * AYRI TABLO, SÜTUN DEĞİL. `earnings_analyses`ta yeni alanları taşıyacak
 * esnek bir jsonb YOK: her jsonb sütunun tek bir anlamı var (özet
 * paragrafları, metrik kartları, CEO alıntısı…) ve oraya ilgisiz bir alan
 * gömmek, o sütunun tipini ve rutinin okuduğu gövdeyi bozmak demekti
 * (`ceo_quote.topics` bir istisnaydı: alıntının kendi parçası). Sütun
 * eklemek de olmaz: migration'lar deploy'dan SONRA elle uygulanıyor ve
 * `earnings_analyses`a eklenen bir sütun, migration inene kadar o tablonun
 * HER `select()`ini — detay sayfası, rutin ucu, panel — kırardı
 * (`user_avatars` kuralı, CLAUDE.md "Bilinmesi gerekenler").
 *
 * Anahtar analiz satırının kimliği: analiz dil başına bir satır ve
 * eklerin metni (segment adları, özet maddeleri) de dile göre. Upsert
 * (`onConflictDoUpdate`) satırın `id`sini korur, yani rutinin bir analizi
 * düzeltmesi ekleri koparmaz; analiz silinirse ekler de gider.
 *
 * Okuyan ve yazan her yol tablo yokken SESSİZCE düşer
 * (`lib/earnings-extras.ts`): sayfa eski hâliyle çizilir, rutin ucu ana
 * kaydı yazar ve yanıtında eklerin yazılamadığını söyler.
 */
export const earningsAnalysisExtras = pgTable("earnings_analysis_extras", {
  analysisId: uuid("analysis_id")
    .primaryKey()
    .references(() => earningsAnalyses.id, { onDelete: "cascade" }),
  /** Tam üç madde — sayfanın başındaki "30 Saniyede" özeti. */
  takeaways: jsonb("takeaways").$type<string[]>(),
  segments: jsonb("segments").$type<AnalysisSegment[]>(),
  /** Segment rakamlarının belgesi — KPI kaynaklarıyla aynı sözlük. */
  segmentsSource: text("segments_source"),
  kpis: jsonb("kpis").$type<AnalysisKpi[]>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Teknik analizler — takip listesindeki hisselerin her işlem günü üç kez
 * yazılan görüşü (liste `lib/technical.ts` → TECHNICAL_SYMBOLS).
 *
 * Kaynak `lib/technical.ts` (liste, göstergeler) ve rutin
 * (docs/claude-rutinler.md § 5). Anahtar `symbol + session_date + slot`:
 * her işlem günü iki analiz, açılış öncesi ve seans içi. Aynı üçlü ikinci
 * kez gelirse ÜZERİNE yazılır — rutin bir analizi düzeltebilir.
 *
 * DİL BAŞINA SATIR DEĞİL, TEK SATIR. Mercek ve bilanço analizi dil başına
 * ayrı satır tutuyor; burada o düzen bir tutarsızlığa kapı açardı: görüş
 * ve seviyeler DİLDEN BAĞIMSIZ sayılar ve iki ayrı gönderim, İngilizcede
 * farklı bir stop ya da farklı bir görüş taşıyabilirdi. Sayılar satırda bir
 * kez, iki dilin metni `copy` içinde. İngilizce yoksa sayfa Türkçesini not
 * düşerek gösterir.
 *
 * `snapshot` göstergelerin YAZMA ANINDAKİ fotoğrafı; gerekçesi
 * `TechnicalSnapshot` yorumunda. Uç onu rutinden almıyor, kendisi
 * hesaplıyor — gövdede sayı göndermek sayıyı değiştirmek demek olurdu.
 */
export const technicalAnalyses = pgTable(
  "technical_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    /** Analizin ait olduğu işlem günü (ET). */
    sessionDate: date("session_date").notNull(),
    /** premarket | midsession — açılış öncesi ya da seans içi. */
    slot: text("slot").notNull(),
    /** buy | hold | sell — ekranda AL/TUT/SAT; bilanço görüşüyle aynı sözlük. */
    stance: text("stance").notNull(),
    /** Alım bölgesi. İkisi birlikte gelir; tek seviye verilirse ikisi aynı. */
    entryLow: doublePrecision("entry_low"),
    entryHigh: doublePrecision("entry_high"),
    /** Bunun altında kapanış senaryoyu bozar. */
    stop: doublePrecision("stop"),
    /** Kâr alma / satış seviyeleri — fiyatın ÜSTÜNDE, yakından uzağa. */
    targets: jsonb("targets").$type<number[]>().notNull(),
    supports: jsonb("supports").$type<number[]>().notNull(),
    resistances: jsonb("resistances").$type<number[]>().notNull(),
    copy: jsonb("copy")
      .$type<{ tr: TechnicalCopy; en?: TechnicalCopy | null }>()
      .notNull(),
    snapshot: jsonb("snapshot").$type<TechnicalSnapshot>().notNull(),
    generatedBy: text("generated_by").notNull().default("claude"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("technical_analyses_key").on(t.symbol, t.sessionDate, t.slot),
    index("technical_analyses_session_idx").on(t.sessionDate),
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

/**
 * Sembol başına temel ölçüler — hisse skor kartının sektör karşılaştırması
 * için (28 Eylül).
 *
 * NEDEN TABLO. Bir şirketi sektörüne göre konumlamak sektördeki HER
 * şirketin ölçüsünü istiyor: Bilgi Teknolojileri'nde ~70 şirket, yani sayfa
 * başına 70 Finnhub isteği — dakikada 60 sınırını tek sayfa aşardı. Ölçüler
 * burada birikiyor: günlük cron en eski güncellenenden başlayarak küçük bir
 * paket tazeliyor (`lib/symbol-metrics.ts`), bir hisse sayfası açıldığında
 * da o hissenin satırı zaten çekilmiş metrikten yazılıyor (ek istek yok).
 *
 * `sector` GICS ana sektörü (endeks tohumu), `metrics` seçilmiş alanlar —
 * seçim ve gerekçesi lib/scorecard.ts → `StoredMetrics`. Yabancı anahtar
 * yok: sembol `symbols`ta olmasa da ölçüsü tutulabilir ve silinecek bir
 * ebeveyn yok. Okuyan ve yazan her yer tablo yokken sessizce düşüyor —
 * migration'lar elle uygulanıyor (`user_avatars` ile aynı desen).
 */
export const symbolMetrics = pgTable(
  "symbol_metrics",
  {
    symbol: text("symbol").primaryKey(),
    sector: text("sector"),
    /** Raporlama para birimi — hisse başı tutarlar yalnızca USD'de kullanılır. */
    currency: text("currency"),
    metrics: jsonb("metrics").$type<StoredMetrics>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("symbol_metrics_sector_idx").on(t.sector),
    index("symbol_metrics_updated_idx").on(t.updatedAt),
  ],
);

/* ==========================================================================
   Ünlü yatırımcılar — SEC 13F bildirimleri ve Kongre işlem bildirimleri
   ========================================================================== */

/**
 * Bir 13F dosyası — SEC'e verilen tek bir bildirim (28 Eylül).
 *
 * DOSYA, DÖNEM DEĞİL. Aynı dönem için birden çok dosya olabiliyor: asıl
 * bildirim (13F-HR), onu baştan yazan düzeltme (13F-HR/A, RESTATEMENT) ve
 * gizli tutulup süresi dolunca eklenen pozisyonlar (13F-HR/A, NEW
 * HOLDINGS — Berkshire'ın 2025 1. çeyreği böyle tamamlandı). Dönemin
 * portföyü okuma anında bu dosyalardan kuruluyor (lib/investor-view.ts →
 * `periodHoldings`); tablo SEC'in söylediğini olduğu gibi tutuyor.
 *
 * `investor` bir slug (lib/investors.ts), yabancı anahtar değil: yatırımcı
 * listesi kodda duruyor, veritabanında değil. Bir yatırımcının İKİ CIK'i
 * olabiliyor (Ackman, 2026 2. çeyrekten itibaren yeni şirket); `cik`
 * hangisinin dosyası olduğunu söylüyor.
 *
 * `value_scaled`: bu dosya değerleri BİN DOLAR yazmış ve okurken 1000 ile
 * çarpıldı. Kural 2023'ten beri dolar ama Baupost ve Duquesne hâlâ bin
 * yazıyor; algılama dosya bazında (lib/providers/sec-13f.ts →
 * `detectValueScale`). Tablodaki `value` her zaman DOLAR.
 *
 * Migration elle uygulanıyor; tablo yokken okuyan kod sessizce boş dönüyor
 * (`user_avatars` ile aynı desen).
 */
export const investorFilings = pgTable(
  "investor_filings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investor: text("investor").notNull(),
    cik: integer("cik").notNull(),
    accession: text("accession").notNull(),
    /** "13F-HR" | "13F-HR/A" */
    form: text("form").notNull(),
    /** Düzeltmenin türü: "restatement" | "new-holdings"; asıl bildirimde null. */
    amendment: text("amendment"),
    /** Bildirimin anlattığı çeyrek sonu. */
    period: date("period").notNull(),
    filedAt: date("filed_at").notNull(),
    /** Dolar, ölçek düzeltmesinden sonra. Opsiyonların dayanak değeri dahil. */
    valueTotal: doublePrecision("value_total").notNull(),
    entryCount: integer("entry_count").notNull(),
    valueScaled: boolean("value_scaled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("investor_filings_accession_unique").on(t.accession),
    index("investor_filings_investor_period_idx").on(t.investor, t.period),
  ],
);

/**
 * 13F dosyasının satırları, CUSIP + pozisyon türüne göre toplanmış.
 *
 * Aynı CUSIP birden çok satırda gelebiliyor (fonun alt yöneticileri ayrı
 * satır yazıyor); ekranda tek pozisyon olmalı, o yüzden yazarken
 * toplanıyor. `position` "long" | "call" | "put" — opsiyon satırındaki
 * değer PRİM değil DAYANAK hissenin değeri, ekranda ayrı duruyor.
 * `amount_type` "SH" (hisse) ya da "PRN" (tahvil anaparası).
 *
 * Dosya silinirse satırları da gider (ON DELETE CASCADE).
 */
export const investorHoldings = pgTable(
  "investor_holdings",
  {
    filingId: uuid("filing_id")
      .notNull()
      .references(() => investorFilings.id, { onDelete: "cascade" }),
    cusip: text("cusip").notNull(),
    position: text("position").notNull(),
    issuer: text("issuer").notNull(),
    titleOfClass: text("title_of_class"),
    amount: doublePrecision("amount").notNull(),
    amountType: text("amount_type").notNull(),
    /** Dolar. */
    value: doublePrecision("value").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.filingId, t.cusip, t.position] }),
    index("investor_holdings_cusip_idx").on(t.cusip),
  ],
);

/**
 * CUSIP → borsa sembolü, OpenFIGI'den (28 Eylül).
 *
 * SEC sembol vermiyor; 13F satırında yalnızca CUSIP ve şirket adı var.
 * Eşleme kalıcı: bir CUSIP bir kez sorulur. Çözülemeyen CUSIP (tahvil,
 * yurt dışı hisse, kapanmış şirket) `ticker` null ile yazılıyor ve
 * `tried_at` yeniden denemenin takvimini tutuyor — ekranda ad görünür,
 * UYDURMA sembol basılmaz.
 */
export const cusipTickers = pgTable("cusip_tickers", {
  cusip: text("cusip").primaryKey(),
  ticker: text("ticker"),
  figi: text("figi"),
  name: text("name"),
  securityType: text("security_type"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  triedAt: timestamp("tried_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * İşlenmiş Kongre bildirimleri (PTR) — PDF'i bir kez okumak için.
 *
 * İşlem satırı olmayan bir bildirim de (taranmış kâğıt, metin katmanı yok)
 * burada `trade_count = 0` ile durur; yoksa her gün yeniden indirilirdi.
 */
export const congressFilings = pgTable("congress_filings", {
  docId: text("doc_id").primaryKey(),
  member: text("member").notNull(),
  filedAt: date("filed_at").notNull(),
  tradeCount: integer("trade_count").notNull(),
  parsedAt: timestamp("parsed_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Kongre üyesinin (ve eşinin) bildirdiği tekil işlemler.
 *
 * TUTAR ARALIK: bildirim tek bir sayı değil bir aralık veriyor ("$1,000,001
 * - $5,000,000"); iki uç ayrı sütunda, ekranda da aralık olarak yazılıyor.
 * Tek sayı uydurulmuyor. `owner` SP (eş), JT (ortak), DC (bakmakla yükümlü
 * çocuk) ya da null (üyenin kendisi). İşlem tarihi ile bildirim tarihi
 * ayrı: yasa 45 güne kadar gecikmeye izin veriyor.
 *
 * `row_no` bildirimin içindeki sıra; (doc_id, row_no) tekil, yani aynı
 * PDF'i yeniden okumak satır çoğaltmıyor. Bildirim silinirse işlemleri de
 * gider (ON DELETE CASCADE).
 */
export const congressTrades = pgTable(
  "congress_trades",
  {
    docId: text("doc_id")
      .notNull()
      .references(() => congressFilings.docId, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    member: text("member").notNull(),
    ticker: text("ticker"),
    asset: text("asset").notNull(),
    /** ST hisse, OP opsiyon, AB, OT… — bildirimin kendi kodu. */
    assetType: text("asset_type"),
    /** "P" alış, "S" satış, "S (partial)" kısmi satış, "E" değişim. */
    txType: text("tx_type").notNull(),
    txDate: date("tx_date").notNull(),
    notifiedDate: date("notified_date"),
    amountLow: doublePrecision("amount_low"),
    amountHigh: doublePrecision("amount_high"),
    owner: text("owner"),
    description: text("description"),
  },
  (t) => [
    primaryKey({ columns: [t.docId, t.rowNo] }),
    index("congress_trades_member_date_idx").on(t.member, t.txDate),
    index("congress_trades_ticker_idx").on(t.ticker),
  ],
);

/**
 * ARK ETF'lerinin günlük pozisyon dosyaları (28 Eylül).
 *
 * Cathie Wood'un 13F'i çeyreklik ve 45 gün gecikmeli; ARK ise altı ETF'sinin
 * elindeki hisseleri HER GÜN yayımlıyor. İki ardışık günün farkı ARK'ın bir
 * önceki işlem günündeki alım ve satımları (hesap `lib/ark-view.ts`, pay
 * yaratma/iade etkisi orada ayıklanıyor). Satırlar dosyadaki gibi; fark
 * okuma anında hesaplanıyor.
 *
 * `as_of` dosyanın kendi tarihi. Son `ARK_KEEP_DAYS` gün tutuluyor, eskisi
 * günlük cron'da siliniyor. Ayrı tablo, yabancı anahtar yok: migration
 * elle uygulanıyor, tablo yokken okuyan kod sessizce boş dönüyor.
 */
export const arkHoldings = pgTable(
  "ark_holdings",
  {
    asOf: date("as_of").notNull(),
    fund: text("fund").notNull(),
    cusip: text("cusip").notNull(),
    ticker: text("ticker"),
    company: text("company").notNull(),
    shares: doublePrecision("shares").notNull(),
    /** Dolar. */
    marketValue: doublePrecision("market_value").notNull(),
    /** Yüzde (9,12 → 9.12). */
    weight: doublePrecision("weight").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.asOf, t.fund, t.cusip] }),
    index("ark_holdings_ticker_idx").on(t.ticker),
  ],
);

/**
 * GİB'den otomatik okunan gelir vergisi tarifeleri (28 Eylül).
 *
 * Günlük cron GİB portalının tarife listesine bakıyor; yeni bir yıl
 * belirince PDF'i okuyup SAĞLAMASINI yapıyor (lib/providers/gib-tariff.ts)
 * ve buraya yazıyor. Sağlamadan geçmeyen tarife yazılmıyor. Koddaki elle
 * doğrulanmış yıllar (lib/tax.ts → TAX_YEARS) her zaman önce gelir; bu tablo
 * yalnızca kodda olmayan yılları doldurur. Tablo yokken okuyan kod sessizce
 * yalnızca koddaki yıllarla çalışır.
 */
export const taxTariffs = pgTable("tax_tariffs", {
  year: integer("year").primaryKey(),
  /** [{ upTo: number | null, ratePct: number }] — ücret dışı tarife. */
  brackets: jsonb("brackets").notNull(),
  sourceUrl: text("source_url").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ==========================================================================
   Uygulama hataları — kendi barındırdığımız hata günlüğü
   ========================================================================== */

/**
 * Sunucu ve istemci hataları, gün başına toplanmış (28 Eylül).
 *
 * NEDEN KENDİ TABLOMUZ. Sunucu hataları yalnızca systemd günlüğüne
 * düşüyordu ve okuyucunun hata ekranında gördüğü kimliği (`digest`) oraya
 * SSH atmadan aramanın yolu yoktu; tarayıcıda doğan hatalar ise hiçbir
 * yere yazılmıyordu. Üçüncü taraf bir hata servisi README'deki "üçüncü
 * taraf analitik yok" sözünü bozardı.
 *
 * NE TUTULMUYOR: kullanıcı kimliği, IP, tarayıcı künyesi. Rota ŞABLON
 * olarak (`/hisse/[symbol]`), mesaj e-posta ve IP biçimli parçaları
 * örtülüp kırpılarak (lib/error-log-core.ts). Yığın yalnızca sunucu
 * hatasında — istemcinin yığını küçültülmüş paket satırları, okunmuyor.
 *
 * GÜN BAŞINA TEK SATIR: aynı rota + aynı parmak izi (sunucuda `digest`)
 * bir günde bir satır, tekrarı `count`u artırıyor. Bir sağlayıcı bir saat
 * düşünce binlerce satır değil bir satır ve bir sayı.
 *
 * AYRI TABLO, YABANCI ANAHTAR YOK. Migration elle uygulanıyor; tablo
 * yokken yazan da okuyan da sessizce düşüyor (lib/error-log.ts). 30 günde
 * siliniyor (`purgeOldErrors`, günlük cron).
 */
export const appErrors = pgTable(
  "app_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** ET takvim günü — tekilleştirmenin penceresi. */
    day: date("day").notNull(),
    /** "server" | "client" */
    kind: text("kind").notNull(),
    /** Rota şablonu: "/hisse/[symbol]", "/en/teknik/[symbol]". */
    route: text("route").notNull(),
    /** Next'in hata kimliği — okuyucunun hata ekranında gördüğü değer. */
    digest: text("digest"),
    /** Tekilleştirme anahtarı: digest ya da mesajın ilk satırının özeti. */
    fingerprint: text("fingerprint").notNull(),
    message: text("message").notNull(),
    /** Yalnızca sunucu hatasında, kırpılmış. */
    stack: text("stack"),
    count: integer("count").notNull().default(1),
    /** Günün ilk görülmesi. */
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** Günün son görülmesi. */
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("app_errors_unique").on(t.day, t.kind, t.route, t.fingerprint),
    index("app_errors_last_idx").on(t.lastAt),
  ],
);

/* ==========================================================================
   Çıkarsanan tipler
   ========================================================================== */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type PortfolioPositionRow = typeof portfolioPositions.$inferSelect;
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
export type EarningsAnalysisExtrasRow = typeof earningsAnalysisExtras.$inferSelect;
export type TechnicalAnalysisRow = typeof technicalAnalyses.$inferSelect;
export type PageViewRow = typeof pageViews.$inferSelect;
export type SymbolMetricsRow = typeof symbolMetrics.$inferSelect;

/** Kullanıcı rolleri — "admin" yönetim ekranını açar, başka ayrıcalığı yok. */
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** AL / TUT / SAT — kayıtta İngilizce anahtar, ekranda dile göre yazılır. */
export type Verdict = "buy" | "hold" | "sell";

/**
 * ORTALAMA ANALİST HEDEF FİYATI — günlük, kaynaklı (2 Ekim).
 *
 * Finnhub'ın `/stock/price-target` ucu ücretsiz katmanda kapalı (403) ve
 * bilanço analizindeki `target_price` yalnızca analizin yazıldığı günün
 * hedefi (MU'da üç ay önceki 1.502 $). Günlük bülten rutini takip edilen
 * hisselerin güncel ortalamasını kaynaklarından doğrulayıp
 * `/api/hedef`e yazıyor; doğrulama ve korumalar `lib/analyst-targets.ts`te.
 *
 * KENDİ TABLOSU: migration'lar deploy'da uygulanmıyor (CLAUDE.md) ve okuyan
 * kod tablo yokken sessizce analizin hedefine düşüyor
 * (`lib/analyst-target-data.ts`). Satır gün başına — geçmiş kendiliğinden
 * birikiyor; ekran en yenisini okuyor. Sayılar HAM ve hisse başına, kotasyon
 * parasında (ADR'de dolar).
 */
export const analystTargets = pgTable(
  "analyst_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    /** Kaynağın verdiği günün ET tarihi. */
    asOf: date("as_of").notNull(),
    mean: doublePrecision("mean").notNull(),
    median: doublePrecision("median"),
    high: doublePrecision("high"),
    low: doublePrecision("low"),
    analystCount: integer("analyst_count"),
    /** Kaynağın adı ("MarketBeat", "Nasdaq"…) — ekranda künyede. */
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    /** Yazma anındaki canlı fiyat — makullük kontrolünün dayanağı. */
    priceAtWrite: doublePrecision("price_at_write"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("analyst_targets_symbol_day_key").on(t.symbol, t.asOf),
    index("analyst_targets_symbol_idx").on(t.symbol),
  ],
);
