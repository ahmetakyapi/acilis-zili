import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "./db";
import {
  dailyBriefs,
  earningsAnalyses,
  earningsCalendar,
  economicEvents,
  macroSeries,
  news,
  pageViews,
  stories,
  symbols,
  users,
  watchlistItems,
  watchlists,
} from "./schema";
import { addEtDays, todayEt } from "./market-hours";

/**
 * Yönetim panelinin sorguları.
 *
 * HEPSİ KENDİ HATASINI YUTAR ve boş/sıfır döner. Panel dokuz ayrı kutu
 * gösteriyor; birinin sorgusu düştüğünde diğer sekiz kutunun da kaybolması
 * yanlış olur — panelin varlık sebebi zaten "bir şey bozulduğunda görmek".
 * Boş kutu ekranda "veri alınamadı" olarak duruyor, sayfa çökmüyor.
 *
 * SAYFA ÖLÇÜMÜ ET GÜNÜNE GÖRE. `viewedOn` yazılırken de ET günü kullanılıyor
 * (lib/analytics.ts); panelde "bugün" ile sitenin geri kalanındaki "bugün"
 * aynı gün olsun diye. Türkiye saatiyle sabahın erken saatleri New York'ta
 * hâlâ dün — iki tanım karışırsa panel kendi kendisiyle çelişir.
 */

/* --------------------------------------------------------------------------
   Trafik
   -------------------------------------------------------------------------- */

export type TrafficPoint = {
  /** "YYYY-MM-DD" ET */
  day: string;
  views: number;
  visitors: number;
};

export type TrafficTotals = {
  views: number;
  visitors: number;
};

/** Gün gün görüntüleme ve tekil ziyaretçi — grafiğin kaynağı. */
export async function getTrafficSeries(days: number): Promise<TrafficPoint[]> {
  const today = todayEt();
  const from = addEtDays(today, -(days - 1));

  try {
    const rows = await db
      .select({
        day: pageViews.viewedOn,
        views: count(),
        visitors: countDistinct(pageViews.visitorHash),
      })
      .from(pageViews)
      .where(and(gte(pageViews.viewedOn, from), lte(pageViews.viewedOn, today)))
      .groupBy(pageViews.viewedOn)
      .orderBy(asc(pageViews.viewedOn));

    /* Kayıt olmayan günler sorgudan HİÇ dönmez ve grafik o günleri atlayıp
       çizgiyi yalancı bir eğime sokar. Boş günler sıfırla dolduruluyor. */
    const found = new Map(rows.map((r) => [r.day, r]));
    const series: TrafficPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addEtDays(today, -i);
      const row = found.get(day);
      series.push({
        day,
        views: Number(row?.views ?? 0),
        visitors: Number(row?.visitors ?? 0),
      });
    }
    return series;
  } catch {
    return [];
  }
}

/** Bir aralığın toplamı — tekil ziyaretçi günleri birleştirerek sayılır. */
export async function getTrafficTotals(
  fromDay: string,
  toDay: string,
): Promise<TrafficTotals> {
  try {
    const [row] = await db
      .select({
        views: count(),
        visitors: countDistinct(pageViews.visitorHash),
      })
      .from(pageViews)
      .where(
        and(gte(pageViews.viewedOn, fromDay), lte(pageViews.viewedOn, toDay)),
      );
    return {
      views: Number(row?.views ?? 0),
      visitors: Number(row?.visitors ?? 0),
    };
  } catch {
    return { views: 0, visitors: 0 };
  }
}

export type Breakdown = { key: string; views: number; visitors: number };

/**
 * Bir sütuna göre kırılım — rota, yol, yönlendiren, cihaz, dil.
 *
 * Sütun tipi `PgColumn` olarak alınıyor, `typeof pageViews.route` olarak
 * değil: Drizzle her sütuna KENDİ adını taşıyan bir tip veriyor ve tek bir
 * sütunun tipini imza yapmak diğer beş çağrıyı derlemiyor.
 */
async function breakdownBy(
  column: PgColumn,
  days: number,
  limit: number,
  onlyNotNull = false,
): Promise<Breakdown[]> {
  const today = todayEt();
  const from = addEtDays(today, -(days - 1));
  try {
    const where = onlyNotNull
      ? and(gte(pageViews.viewedOn, from), isNotNull(column))
      : gte(pageViews.viewedOn, from);

    const rows = await db
      .select({
        key: column,
        views: count(),
        visitors: countDistinct(pageViews.visitorHash),
      })
      .from(pageViews)
      .where(where)
      .groupBy(column)
      .orderBy(desc(count()))
      .limit(limit);

    return rows.map((r) => ({
      key: r.key ?? "—",
      views: Number(r.views),
      visitors: Number(r.visitors),
    }));
  } catch {
    return [];
  }
}

export const getTopRoutes = (days: number, limit = 12) =>
  breakdownBy(pageViews.route, days, limit);
export const getTopPaths = (days: number, limit = 15) =>
  breakdownBy(pageViews.path, days, limit);
export const getTopReferrers = (days: number, limit = 10) =>
  breakdownBy(pageViews.referrerHost, days, limit, true);
export const getDeviceSplit = (days: number) =>
  breakdownBy(pageViews.device, days, 5);
export const getLocaleSplit = (days: number) =>
  breakdownBy(pageViews.locale, days, 5);

/** Giriş yapmış okuyucunun payı — üyeliğin işe yarayıp yaramadığı. */
export async function getSignedInShare(
  days: number,
): Promise<{ signedIn: number; anonymous: number }> {
  const from = addEtDays(todayEt(), -(days - 1));
  try {
    const rows = await db
      .select({ signedIn: pageViews.signedIn, views: count() })
      .from(pageViews)
      .where(gte(pageViews.viewedOn, from))
      .groupBy(pageViews.signedIn);
    return {
      signedIn: Number(rows.find((r) => r.signedIn)?.views ?? 0),
      anonymous: Number(rows.find((r) => !r.signedIn)?.views ?? 0),
    };
  } catch {
    return { signedIn: 0, anonymous: 0 };
  }
}

/** Ölçümün ne kadar geriye gittiği — panel "veri yok" ile "yeni kuruldu"yu ayırsın. */
export async function getTrackingRange(): Promise<{
  firstDay: string | null;
  rows: number;
}> {
  try {
    const [row] = await db
      .select({
        firstDay: sql<string | null>`min(${pageViews.viewedOn})`,
        rows: count(),
      })
      .from(pageViews);
    return { firstDay: row?.firstDay ?? null, rows: Number(row?.rows ?? 0) };
  } catch {
    return { firstDay: null, rows: 0 };
  }
}

/* --------------------------------------------------------------------------
   Üyeler
   -------------------------------------------------------------------------- */

export type MemberSummary = {
  total: number;
  last7: number;
  last30: number;
  withWatchlistItems: number;
  admins: number;
};

export async function getMemberSummary(): Promise<MemberSummary> {
  try {
    const now = new Date();
    const day = 86_400_000;
    const [totals] = await db
      .select({
        total: count(),
        last7: sql<number>`count(*) filter (where ${users.createdAt} >= ${new Date(now.getTime() - 7 * day)})`,
        last30: sql<number>`count(*) filter (where ${users.createdAt} >= ${new Date(now.getTime() - 30 * day)})`,
        admins: sql<number>`count(*) filter (where ${users.role} = 'admin')`,
      })
      .from(users);

    const [active] = await db
      .select({ n: countDistinct(watchlists.userId) })
      .from(watchlists)
      .innerJoin(watchlistItems, eq(watchlistItems.watchlistId, watchlists.id));

    return {
      total: Number(totals?.total ?? 0),
      last7: Number(totals?.last7 ?? 0),
      last30: Number(totals?.last30 ?? 0),
      admins: Number(totals?.admins ?? 0),
      withWatchlistItems: Number(active?.n ?? 0),
    };
  } catch {
    return { total: 0, last7: 0, last30: 0, withWatchlistItems: 0, admins: 0 };
  }
}

export type SignupPoint = { day: string; signups: number };

/** Kayıt eğrisi — gün gün, boş günler sıfırla dolu. */
export async function getSignupSeries(days: number): Promise<SignupPoint[]> {
  const today = todayEt();
  try {
    const rows = await db
      .select({
        day: sql<string>`to_char(${users.createdAt} at time zone 'America/New_York', 'YYYY-MM-DD')`,
        signups: count(),
      })
      .from(users)
      .where(
        gte(
          users.createdAt,
          new Date(Date.now() - days * 86_400_000),
        ),
      )
      .groupBy(sql`1`);

    const found = new Map(rows.map((r) => [r.day, Number(r.signups)]));
    const series: SignupPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addEtDays(today, -i);
      series.push({ day, signups: found.get(day) ?? 0 });
    }
    return series;
  } catch {
    return [];
  }
}

export type MemberRow = {
  id: string;
  username: string;
  role: string;
  locale: string;
  createdAt: Date;
  symbolCount: number;
};

/**
 * Son kaydolanlar — e-posta BİLEREK okunmuyor, panelde işi yok.
 *
 * Sembol sayısı İLİŞKİLİ ALT SORGUYLA alınmıyor. Bir kez öyle yazıldı ve
 * sessizce boş liste döndürdü: ham `sql` şablonunun içinde sütunlar tablo
 * adı olmadan basılıyor (`"id" = "watchlist_id"`, `"user_id" = "id"`) ve
 * sorgu belirsiz sütun hatasıyla düşüyordu. Hata yutulduğu için ekranda
 * "üye yok" görünüyordu — var olan üç üyeye rağmen.
 *
 * İki sorgu + bellekte birleştirme hem doğru hem okunur. Üye sayısı bu
 * ürünün ölçeğinde küçük; ikinci sorgu tek bir gruplama.
 */
export async function getRecentMembers(limit = 25): Promise<MemberRow[]> {
  try {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        locale: users.locale,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);

    if (rows.length === 0) return [];

    const counts = await db
      .select({
        userId: watchlists.userId,
        n: count(watchlistItems.id),
      })
      .from(watchlists)
      .leftJoin(watchlistItems, eq(watchlistItems.watchlistId, watchlists.id))
      .where(
        inArray(
          watchlists.userId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(watchlists.userId);

    const byUser = new Map(counts.map((c) => [c.userId, Number(c.n)]));
    return rows.map((r) => ({ ...r, symbolCount: byUser.get(r.id) ?? 0 }));
  } catch {
    return [];
  }
}

export type WatchedSymbol = {
  symbol: string;
  name: string | null;
  members: number;
};

/** En çok takip edilen semboller — hangi hisseler gerçekten izleniyor. */
export async function getMostWatchedSymbols(
  limit = 15,
): Promise<WatchedSymbol[]> {
  try {
    const rows = await db
      .select({
        symbol: watchlistItems.symbol,
        name: symbols.name,
        members: countDistinct(watchlists.userId),
      })
      .from(watchlistItems)
      .innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId))
      .leftJoin(symbols, eq(symbols.symbol, watchlistItems.symbol))
      .groupBy(watchlistItems.symbol, symbols.name)
      .orderBy(desc(countDistinct(watchlists.userId)))
      .limit(limit);
    return rows.map((r) => ({ ...r, members: Number(r.members) }));
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------------------
   İçerik
   -------------------------------------------------------------------------- */

export type ContentSummary = {
  briefs: number;
  briefsLatest: string | null;
  storySlugs: number;
  storiesMissingEn: string[];
  analyses: number;
  analysesMissingEn: string[];
  analysesWithoutCharts: string[];
};

/**
 * İçeriğin eksikleri.
 *
 * Panelin buradaki işi liste göstermek değil, EKSİĞİ göstermek: hangi mercek
 * yazısının İngilizcesi yok, hangi analiz grafiksiz kalmış. Aynı soruları
 * `/api/analiz/context` rutin için cevaplıyor; burası insanın bakabildiği hâli.
 */
export async function getContentSummary(): Promise<ContentSummary> {
  const empty: ContentSummary = {
    briefs: 0,
    briefsLatest: null,
    storySlugs: 0,
    storiesMissingEn: [],
    analyses: 0,
    analysesMissingEn: [],
    analysesWithoutCharts: [],
  };

  try {
    const [briefRow] = await db
      .select({
        n: count(),
        latest: sql<string | null>`max(${dailyBriefs.briefDate})`,
      })
      .from(dailyBriefs);

    const storyRows = await db
      .select({ slug: stories.slug, locale: stories.locale })
      .from(stories);

    const analysisRows = await db
      .select({
        symbol: earningsAnalyses.symbol,
        period: earningsAnalyses.period,
        locale: earningsAnalyses.locale,
        quarterlyRevenue: earningsAnalyses.quarterlyRevenue,
        guidance: earningsAnalyses.guidance,
      })
      .from(earningsAnalyses);

    const storyLocales = new Map<string, Set<string>>();
    for (const row of storyRows) {
      const seen = storyLocales.get(row.slug) ?? new Set<string>();
      seen.add(row.locale);
      storyLocales.set(row.slug, seen);
    }

    const analysisLocales = new Map<string, Set<string>>();
    const chartless = new Set<string>();
    for (const row of analysisRows) {
      const key = `${row.symbol} ${row.period}`;
      const seen = analysisLocales.get(key) ?? new Set<string>();
      seen.add(row.locale);
      analysisLocales.set(key, seen);
      /* İki dilden biri grafiksizse analiz eksik sayılır — sayfası metin
         yığını gibi duruyor demektir. Aynı kural rutinin okuduğu
         /api/analiz/context ucunda da geçerli. */
      const hasCharts =
        (row.quarterlyRevenue?.length ?? 0) > 0 && (row.guidance?.length ?? 0) > 0;
      if (!hasCharts) chartless.add(key);
    }

    return {
      briefs: Number(briefRow?.n ?? 0),
      briefsLatest: briefRow?.latest ?? null,
      storySlugs: storyLocales.size,
      storiesMissingEn: [...storyLocales]
        .filter(([, locales]) => !locales.has("en"))
        .map(([slug]) => slug),
      analyses: analysisLocales.size,
      analysesMissingEn: [...analysisLocales]
        .filter(([, locales]) => !locales.has("en"))
        .map(([key]) => key),
      analysesWithoutCharts: [...chartless],
    };
  } catch {
    return empty;
  }
}

export type BriefRow = {
  briefDate: string;
  locale: string;
  period: string;
  headline: string;
  generatedBy: string;
  generatedAt: Date;
};

export async function getRecentBriefs(limit = 14): Promise<BriefRow[]> {
  try {
    return await db
      .select({
        briefDate: dailyBriefs.briefDate,
        locale: dailyBriefs.locale,
        period: dailyBriefs.period,
        headline: dailyBriefs.headline,
        generatedBy: dailyBriefs.generatedBy,
        generatedAt: dailyBriefs.generatedAt,
      })
      .from(dailyBriefs)
      .orderBy(desc(dailyBriefs.briefDate), desc(dailyBriefs.generatedAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------------------
   Veri sağlığı
   -------------------------------------------------------------------------- */

export type HealthCheck = {
  label: string;
  /** Ekranda basılan değer — "142 gün", "4 saat önce". */
  value: string;
  /** "ok" yeşil, "warn" sarı, "down" kırmızı, "idle" nötr. */
  tone: "ok" | "warn" | "down" | "idle";
  /** Tek satırlık açıklama; neden bu renk. */
  note: string;
};

/**
 * Verinin durumu — panelin en çok bakılacak bölümü.
 *
 * Her satır bir SORU cevaplıyor: bu veri ne kadar taze, kaç gün ileriye
 * yetiyor, hangi anahtar eksik. Eşikler sabit değil, her satırın kendi
 * gerçeğine göre: bilanço takvimi 30 gün ileriye doldurulur (cron), ekonomik
 * takvim bir yıla; ikisini aynı eşikle ölçmek yanlış alarm üretir.
 */
export async function getHealthChecks(): Promise<HealthCheck[]> {
  const today = todayEt();
  const checks: HealthCheck[] = [];

  /* ---- Sağlayıcı anahtarları ---- */
  const keys: [string, string | undefined][] = [
    ["Alpaca", process.env.ALPACA_API_KEY_ID],
    ["Finnhub", process.env.FINNHUB_API_KEY],
    ["FRED", process.env.FRED_API_KEY],
    ["Anthropic", process.env.ANTHROPIC_API_KEY],
    ["Cron sırrı", process.env.CRON_SECRET],
    ["Rutin sırrı", process.env.BRIEF_SECRET],
  ];
  for (const [label, value] of keys) {
    checks.push({
      label: `${label} anahtarı`,
      value: value ? "tanımlı" : "yok",
      tone: value ? "ok" : "down",
      note: value
        ? "ortam değişkeni dolu"
        : "eksik — ilgili kartlar veri alamaz",
    });
  }

  /* ---- Bilanço takvimi ne kadar ileri gidiyor ---- */
  try {
    const [row] = await db
      .select({ furthest: sql<string | null>`max(${earningsCalendar.reportDate})` })
      .from(earningsCalendar);
    const days = row?.furthest ? daysBetween(today, row.furthest) : 0;
    checks.push({
      label: "Bilanço takvimi",
      value: `${days} gün ileri`,
      /* Cron 30 gün dolduruyor; 20'nin altına düşmesi koşumun aksadığını
         söyler, 7'nin altı ekranın boşalmaya başladığı yer. */
      tone: days >= 20 ? "ok" : days >= 7 ? "warn" : "down",
      note: `en uzak kayıt ${row?.furthest ?? "yok"}`,
    });
  } catch {
    checks.push(failed("Bilanço takvimi"));
  }

  /* ---- Ekonomik takvim ömrü ---- */
  try {
    const [row] = await db
      .select({ furthest: sql<string | null>`max(${economicEvents.eventDate})` })
      .from(economicEvents)
      .where(eq(economicEvents.importance, "high"));
    const days = row?.furthest ? daysBetween(today, row.furthest) : 0;
    checks.push({
      label: "Ekonomik takvim",
      value: `${days} gün ileri`,
      /* FRED bir yıl ileriye dolduruyor; 90 günün altı senkronun durduğunu
         gösterir ve bunu takvim boşalmadan görmek gerekiyor. */
      tone: days >= 90 ? "ok" : days >= 30 ? "warn" : "down",
      note: "yüksek önemli olayların en uzağı",
    });
  } catch {
    checks.push(failed("Ekonomik takvim"));
  }

  /* ---- Haber akışı ---- */
  try {
    const [row] = await db
      .select({
        latest: sql<string | null>`max(${news.fetchedAt})`,
        untranslated: sql<number>`count(*) filter (where ${news.headlineTr} is null)`,
      })
      .from(news);
    const hours = hoursSince(row?.latest ?? null);
    checks.push({
      label: "Haber akışı",
      value: hours === null ? "kayıt yok" : `${hours} saat önce`,
      tone: hours === null ? "down" : hours <= 30 ? "ok" : "warn",
      note: `çevrilmemiş başlık: ${Number(row?.untranslated ?? 0)}`,
    });
  } catch {
    checks.push(failed("Haber akışı"));
  }

  /* ---- Sembol profilleri ---- */
  try {
    const [row] = await db
      .select({
        total: count(),
        stalest: sql<string | null>`min(${symbols.updatedAt})`,
        noCap: sql<number>`count(*) filter (where ${symbols.marketCap} is null)`,
      })
      .from(symbols);
    const stalestHours = hoursSince(row?.stalest ?? null);
    const days = stalestHours === null ? null : Math.floor(stalestHours / 24);
    checks.push({
      label: "Sembol profilleri",
      value: `${Number(row?.total ?? 0)} kayıt`,
      /* Cron günde 60 profil tazeliyor; ~700 sembollük evren 12 günde bir
         tur atıyor. 20 günü aşan bir kayıt turun aksadığını gösterir. */
      tone: days === null ? "idle" : days <= 20 ? "ok" : "warn",
      note:
        days === null
          ? "profil yok"
          : `en bayat kayıt ${days} günlük · piyasa değeri boş: ${Number(row?.noCap ?? 0)}`,
    });
  } catch {
    checks.push(failed("Sembol profilleri"));
  }

  /* ---- Makro seriler ---- */
  try {
    const [row] = await db
      .select({ stalest: sql<string | null>`min(${macroSeries.updatedAt})` })
      .from(macroSeries);
    const hours = hoursSince(row?.stalest ?? null);
    checks.push({
      label: "Makro seriler",
      value: hours === null ? "kayıt yok" : `${Math.floor(hours / 24)} gün önce`,
      tone: hours === null ? "down" : hours <= 48 ? "ok" : "warn",
      note: "en bayat serinin tazelenme zamanı",
    });
  } catch {
    checks.push(failed("Makro seriler"));
  }

  /* ---- Ölçüm ---- */
  try {
    const range = await getTrackingRange();
    checks.push({
      label: "Sayfa ölçümü",
      value: `${range.rows.toLocaleString("tr-TR")} kayıt`,
      tone: range.rows > 0 ? "ok" : "idle",
      note: range.firstDay
        ? `ilk kayıt ${range.firstDay} · 180 gün sonra otomatik silinir`
        : "henüz kayıt yok — ilk ziyaretle başlar",
    });
  } catch {
    checks.push(failed("Sayfa ölçümü"));
  }

  return checks;
}

function failed(label: string): HealthCheck {
  return {
    label,
    value: "okunamadı",
    tone: "down",
    note: "veritabanı sorgusu başarısız",
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * Bir zaman damgasının üstünden kaç saat geçti.
 *
 * GİRDİ METİN DE OLABİLİR. Toplama fonksiyonlarından dönen değer (`max(...)`,
 * `min(...)`) Drizzle'ın kolon eşlemesinden geçmiyor: sürücü ham
 * `"2026-08-12 18:42:32+00"` dizesini veriyor. Tipini `Date` yazmak sorunu
 * çözmüyor, yalnızca gizliyordu — `getTime()` çağrısı çalışma zamanında
 * patlıyor, hata yutuluyor ve üç sağlık satırı "okunamadı" gösteriyordu.
 */
function hoursSince(value: Date | string | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 3_600_000));
}

/* --------------------------------------------------------------------------
   Cron durumu
   -------------------------------------------------------------------------- */

/**
 * Cron'un son koşumu ne zamandı.
 *
 * Ayrı bir "cron kayıtları" tablosu YOK ve bilerek eklenmedi: koşumun izi
 * zaten yazdığı verinin damgasında duruyor. Haber ve profil tazeliği
 * yukarıdaki sağlık satırlarında; buradaki tek ek soru bugün koşup
 * koşmadığı.
 */
export async function getCronPulse(): Promise<{
  lastNewsFetch: Date | null;
  ranToday: boolean;
}> {
  try {
    const [row] = await db
      .select({ latest: sql<string | null>`max(${news.fetchedAt})` })
      .from(news);
    const hours = hoursSince(row?.latest ?? null);
    return {
      lastNewsFetch: row?.latest ? new Date(row.latest) : null,
      ranToday: hours !== null && hours < 24,
    };
  } catch {
    return { lastNewsFetch: null, ranToday: false };
  }
}
