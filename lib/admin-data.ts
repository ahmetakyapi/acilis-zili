import { cache } from "react";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
} from "drizzle-orm";
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
  storyRevisions,
  symbols,
  users,
  watchlistItems,
  watchlists,
} from "./schema";
import { addEtDays, todayEt } from "./market-hours";
import { BRIEF_PUBLISH_TR, getHolidays, weekAnchor } from "./data";
import { agoLabel } from "./admin-format";
import { TR_ZONE, formatInZone } from "./session-clock";

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

/** Bir anı ET takvim gününe indirger — panelin gün tanımı bu. */
function etDayOf(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/* --------------------------------------------------------------------------
   Trafik
   -------------------------------------------------------------------------- */

export type TrafficPoint = {
  /** "YYYY-MM-DD" ET */
  day: string;
  views: number;
  visitors: number;
  /** Bugün — sayısı henüz TAMAMLANMADI, gün sürüyor. */
  isToday: boolean;
  /**
   * Planlı olarak sessiz gün: hafta sonu ya da NYSE tatili.
   *
   * Grafikteki düşüşün sebebi bilgisi olmadan okunuyordu — cumartesi
   * çukurunu gören yönetici "trafik mi düştü, ölçüm mü bozuldu" diye
   * ayırt edemiyordu. Bayrak SUNUCUDA hesaplanıyor çünkü grafik
   * `"use client"` ve oradan takvim okunamaz.
   */
  offDay: boolean;
};

/**
 * ET tarih dizesinin hafta günü — 0 pazar, 6 cumartesi.
 *
 * `new Date("YYYY-MM-DD")` UTC gece yarısı olarak ayrıştırılıp YEREL saate
 * çevriliyor: UTC-5'te sonuç bir önceki güne kayıyor ve cumartesi cuma
 * görünüyor. Dizeyi parçalayıp `Date.UTC` ile kurmak o dönüşümü hiç
 * başlatmıyor.
 */
function etWeekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * GERÇEK TEKİL KİŞİ SAYISI ÜRETİLEMEZ ve bu bilinçli bir tasarım sonucu:
 * `visitorHash` her gün döner (lib/schema.ts), yani iki günün kaydı
 * birbirine bağlanamaz — gizliliğin bedeli tam olarak bu. Dolayısıyla çok
 * günlük pencerede sayılan şey KİŞİ değil ZİYARETÇİ-GÜNÜ: her gün gelen on
 * sadık okuyucu doksan günlük pencerede 900 satır üretir.
 *
 * Alan adı bunu söylüyor; ekran etiketleri de öyle. Ölçüyü düzeltmek
 * mümkün değilken adını düzeltmemek, sayının yalan söylemesi demekti.
 */
export type TrafficTotals = {
  views: number;
  /** Ziyaretçi-günü — aynı kişi her gün yeniden sayılır. */
  visitorDays: number;
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
    /* Tatiller `cache()`li ve bu istekte zaten okunmuş olabilir. */
    const tatiller = new Set((await getHolidays()).map((h) => h.date));
    const series: TrafficPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addEtDays(today, -i);
      const row = found.get(day);
      const gun = etWeekday(day);
      series.push({
        day,
        views: Number(row?.views ?? 0),
        visitors: Number(row?.visitors ?? 0),
        isToday: day === today,
        offDay: gun === 0 || gun === 6 || tatiller.has(day),
      });
    }
    return series;
  } catch {
    return [];
  }
}

/**
 * "Son N gün" penceresi — DÜN BİTER, bugün dışarıda.
 *
 * Aynı seçici ("Son 30 Gün") sayfada iki farklı pencere anlamına geliyordu:
 * sayı kutuları tamamlanmış günleri sayıyordu (aşağıdaki gerekçe), kırılım
 * listeleri ise bugünü de içeriyordu. Okuyucu "Bölümler" listesindeki
 * satırları toplayıp üstteki "Görüntüleme" kutusuyla karşılaştırdığında
 * tutmayan iki sayı görüyordu. Tek tanım burada; grafik bilerek dışarıda,
 * çünkü orada bugün AYRI BİR SÜTUN olarak duruyor ve eksik olduğu görülüyor.
 */
export function fullDayWindow(days: number): { from: string; to: string } {
  const to = addEtDays(todayEt(), -1);
  return { from: addEtDays(to, -(days - 1)), to };
}

/** Bir aralığın toplamı — ziyaretçi sayısı GÜN BAŞINA tekildir (bkz. tip). */
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
      visitorDays: Number(row?.visitors ?? 0),
    };
  } catch {
    return { views: 0, visitorDays: 0 };
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
  const { from, to } = fullDayWindow(days);
  try {
    const inWindow = and(
      gte(pageViews.viewedOn, from),
      lte(pageViews.viewedOn, to),
    );
    const where = onlyNotNull ? and(inWindow, isNotNull(column)) : inWindow;

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
  const { from, to } = fullDayWindow(days);
  try {
    const rows = await db
      .select({ signedIn: pageViews.signedIn, views: count() })
      .from(pageViews)
      .where(and(gte(pageViews.viewedOn, from), lte(pageViews.viewedOn, to)))
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
  /* Sorgu koştu mu. Hata yutulduğunda dönen `{null, 0}` "kayıt yok" ile
     AYNIYDI: tablo okunamadığında panel "ölçüm henüz başlamadı" diyordu ve
     bozuk olan tam da uyarması gereken şeydi. */
  ok: boolean;
}> {
  try {
    const [row] = await db
      .select({
        firstDay: sql<string | null>`min(${pageViews.viewedOn})`,
        rows: count(),
      })
      .from(pageViews);
    return {
      firstDay: row?.firstDay ?? null,
      rows: Number(row?.rows ?? 0),
      ok: true,
    };
  } catch {
    return { firstDay: null, rows: 0, ok: false };
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
  /**
   * Son 30 günde GİRİŞ YAPMIŞ üye — "kayıtlı" ile "kullanan" ayrı sayılar.
   *
   * Toplam üye sayısı tek başına bir şey anlatmıyordu: otuz kayıtlı hesabın
   * yirmi beşi bir daha hiç girmediyse o sayı yalnızca geçmişi ölçüyor.
   * Damga `users.last_seen_at`ten ve yalnızca girişte yazılıyor.
   */
  activeLast30: number;
  /** Hiç giriş damgası olmayan üye — damga eklenmeden önce açılmış hesaplar. */
  neverSeen: number;
};

export async function getMemberSummary(): Promise<MemberSummary> {
  try {
    const now = new Date();
    const day = 86_400_000;
    /* İki sorgu bağımsız — sırayla beklemenin sebebi yoktu. */
    const [[totals], [active]] = await Promise.all([
      db
        .select({
          total: count(),
          last7: sql<number>`count(*) filter (where ${users.createdAt} >= ${new Date(now.getTime() - 7 * day)})`,
          last30: sql<number>`count(*) filter (where ${users.createdAt} >= ${new Date(now.getTime() - 30 * day)})`,
          admins: sql<number>`count(*) filter (where ${users.role} = 'admin')`,
          activeLast30: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${new Date(now.getTime() - 30 * day)})`,
          neverSeen: sql<number>`count(*) filter (where ${users.lastSeenAt} is null)`,
        })
        .from(users),
      db
        .select({ n: countDistinct(watchlists.userId) })
        .from(watchlists)
        .innerJoin(
          watchlistItems,
          eq(watchlistItems.watchlistId, watchlists.id),
        ),
    ]);

    return {
      total: Number(totals?.total ?? 0),
      last7: Number(totals?.last7 ?? 0),
      last30: Number(totals?.last30 ?? 0),
      admins: Number(totals?.admins ?? 0),
      activeLast30: Number(totals?.activeLast30 ?? 0),
      neverSeen: Number(totals?.neverSeen ?? 0),
      withWatchlistItems: Number(active?.n ?? 0),
    };
  } catch {
    return {
      total: 0,
      last7: 0,
      last30: 0,
      withWatchlistItems: 0,
      admins: 0,
      activeLast30: 0,
      neverSeen: 0,
    };
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
      .where(gte(users.createdAt, new Date(Date.now() - days * 86_400_000)))
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
  /** Son başarılı giriş — hiç giriş yapmamışsa null. */
  lastSeenAt: Date | null;
  id: string;
  username: string;
  role: string;
  locale: string;
  createdAt: Date;
  /** ET takvim günü ("YYYY-MM-DD") — ekranda basılan tarih bu. */
  createdOn: string;
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
        /* Kayıt günü ET'den — tablodaki tarih ile yandaki kayıt eğrisi aynı
           kaynaktan beslensin (ikisi ayrı tanım kullanınca aynı kayıt iki
           farklı güne düşüyordu). */
        createdOn: sql<string>`to_char(${users.createdAt} at time zone 'America/New_York', 'YYYY-MM-DD')`,
        lastSeenAt: users.lastSeenAt,
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

/** Bir analiz kaydının adresini kurmaya yeten en küçük künye. */
export type AnalysisRef = { symbol: string; period: string; label: string };

export type ContentSummary = {
  briefs: number;
  briefsLatest: string | null;
  storySlugs: number;
  storiesMissingEn: string[];
  analyses: number;
  /* ANALİZ LİSTELERİ YAPI TAŞIYOR, DİZE DEĞİL. Eskiden `"NVDA 2Ç FY2027"`
     gibi tek bir dizeydi ve panel onu bağlantıya çeviremiyordu: adres
     `analysisHref(symbol, period)` ile kuruluyor ve dizeden geri
     ayrıştırmak ikinci bir adres biçimi doğururdu — ölçüm de o adresi ayrı
     bir yol olarak sayıp okunmayı bölerdi. */
  analysesMissingEn: AnalysisRef[];
  analysesWithoutCharts: AnalysisRef[];
};

/**
 * İçeriğin eksikleri.
 *
 * Panelin buradaki işi liste göstermek değil, EKSİĞİ göstermek: hangi mercek
 * yazısının İngilizcesi yok, hangi analiz grafiksiz kalmış. Aynı soruları
 * `/api/analiz/context` rutin için cevaplıyor; burası insanın bakabildiği hâli.
 */
/* `cache()`: `/admin/icerik` bu özeti İKİ ayrı Suspense sınırından çağırıyor
   (`Summary` ve `Gaps`) ve sarmalı olmadığı için tek sayfa açılışında iki kez
   koşuyordu — üç ardışık sorgu × iki = altı HTTP gidiş-dönüşü. */
export const getContentSummary = cache(
  async function getContentSummary(): Promise<ContentSummary> {
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
      /* ÜÇÜ DE BAĞIMSIZ — sırayla beklenmelerinin bir sebebi yoktu.
       neon-http'de her sorgu ayrı bir HTTP gidiş-dönüşü; üç tur bire indi. */
      const [[briefRow], storyRows, analysisRows] = await Promise.all([
        db
          .select({
            n: count(),
            latest: sql<string | null>`max(${dailyBriefs.briefDate})`,
          })
          .from(dailyBriefs),
        db.select({ slug: stories.slug, locale: stories.locale }).from(stories),
        /* GRAFİK DİZİLERİ ÇEKİLMİYOR, yalnızca DOLU MU diye soruluyor. İki
         `jsonb` sütunu (çeyreklik gelir ve öngörü) tek kullanım amacı
         `?.length > 0` kontrolüyken tamamen ağdan geçiyordu — altmış analiz
         × iki dil, yüzlerce kilobayt. Karar veritabanında veriliyor. */
        db
          .select({
            symbol: earningsAnalyses.symbol,
            period: earningsAnalyses.period,
            locale: earningsAnalyses.locale,
            hasCharts: sql<boolean>`
            coalesce(jsonb_array_length(${earningsAnalyses.quarterlyRevenue}), 0) > 0
            and coalesce(jsonb_array_length(${earningsAnalyses.guidance}), 0) > 0
          `,
          })
          .from(earningsAnalyses),
      ]);

      const storyLocales = new Map<string, Set<string>>();
      for (const row of storyRows) {
        const seen = storyLocales.get(row.slug) ?? new Set<string>();
        seen.add(row.locale);
        storyLocales.set(row.slug, seen);
      }

      const analysisLocales = new Map<string, Set<string>>();
      const analysisRefs = new Map<string, AnalysisRef>();
      const chartless = new Map<string, AnalysisRef>();
      for (const row of analysisRows) {
        const key = `${row.symbol} ${row.period}`;
        const ref: AnalysisRef = {
          symbol: row.symbol,
          period: row.period,
          label: key,
        };
        analysisRefs.set(key, ref);
        const seen = analysisLocales.get(key) ?? new Set<string>();
        seen.add(row.locale);
        analysisLocales.set(key, seen);
        /* İki dilden biri grafiksizse analiz eksik sayılır — sayfası metin
         yığını gibi duruyor demektir. Aynı kural rutinin okuduğu
         /api/analiz/context ucunda da geçerli. */
        if (!row.hasCharts) chartless.set(key, ref);
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
          .map(([key]) => analysisRefs.get(key))
          .filter((ref): ref is AnalysisRef => ref !== undefined),
        analysesWithoutCharts: [...chartless.values()],
      };
    } catch {
      return empty;
    }
  },
);

export type BriefRow = {
  briefDate: string;
  locale: string;
  period: string;
  headline: string;
  generatedBy: string;
  generatedAt: Date;
};

/**
 * Son bültenler — en yeniden eskiye.
 *
 * SÜZGEÇ ŞART, SÜS DEĞİL: liste iki dönem ve iki dili birlikte taşıyor, yani
 * yirmi dört satır ancak altı günü kapsıyor. Haftalık bülten haftada bir
 * yazıldığı için o pencereye çoğu zaman HİÇ girmiyordu — süzgeç olmadan
 * haftalık bir bülteni panelden düzeltmenin yolu yoktu.
 */
export async function getRecentBriefs(
  limit = 14,
  filters: { period?: string; locale?: string } = {},
): Promise<BriefRow[]> {
  try {
    const kosullar = [
      filters.period ? eq(dailyBriefs.period, filters.period) : undefined,
      filters.locale ? eq(dailyBriefs.locale, filters.locale) : undefined,
    ].filter(Boolean);

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
      .where(kosullar.length > 0 ? and(...kosullar) : undefined)
      .orderBy(desc(dailyBriefs.briefDate), desc(dailyBriefs.generatedAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------------------
   Düzenlenebilir içerik
   -------------------------------------------------------------------------- */

export type EditableStory = {
  slug: string;
  title: string;
  eventDate: string;
  /** Hangi dillerde kaydı var — "TR", "EN". */
  locales: string[];
  updatedAt: Date | null;
};

/**
 * Panelden düzenlenebilecek mercek yazıları — en yeniden eskiye.
 *
 * SLUG BAŞINA TEK SATIR. Tablo (slug, locale) benzersiz, yani iki dilli bir
 * yazı iki satır tutuyor; listede ikisini ayrı göstermek aynı yazıyı iki kez
 * saymak olurdu. Diller satırın kendi rozetinde duruyor ve editör hangi dili
 * açacağını sorgudan alıyor.
 *
 * Gövde ÇEKİLMİYOR: liste yalnızca kimlik ve künye gösteriyor, kırk satırlık
 * arşivi gövdeleriyle çekmenin sebebi yok. Gövde editör sayfasında, tek
 * kayıt için okunuyor.
 */
export async function getEditableStories(limit = 40): Promise<EditableStory[]> {
  try {
    const rows = await db
      .select({
        slug: stories.slug,
        locale: stories.locale,
        title: stories.title,
        eventDate: stories.eventDate,
        updatedAt: stories.updatedAt,
        publishedAt: stories.publishedAt,
      })
      .from(stories)
      .orderBy(desc(stories.publishedAt))
      .limit(limit * 2);

    const bySlug = new Map<string, EditableStory>();
    for (const row of rows) {
      const held = bySlug.get(row.slug);
      const rozet = row.locale === "en" ? "EN" : "TR";
      if (!held) {
        bySlug.set(row.slug, {
          slug: row.slug,
          /* Başlık TÜRKÇE kayıttan tercih ediliyor: panel tek dilde ve
             listede İngilizce bir başlık görmek şaşırtıcı olurdu. */
          title: row.title,
          eventDate: row.eventDate,
          locales: [rozet],
          updatedAt: row.updatedAt,
        });
        continue;
      }
      if (!held.locales.includes(rozet)) {
        held.locales.push(rozet);
        /* SIRA SABİT: TR önce. Diziye ekleme sırası yayın zamanından
           geliyordu ve aynı listede bir satır "TR EN", bir sonraki "EN TR"
           yazıyordu — okuyan göz sıranın bir anlamı olduğunu sanıyor. */
        held.locales.sort((a, b) => (a === "TR" ? -1 : b === "TR" ? 1 : 0));
      }
      if (row.locale === "tr") held.title = row.title;
      /* İki dilden en son dokunulanın zamanı satırın zamanı: yazının bir
         yerine dokunulmuşsa satır bunu göstermeli. KÜNYE (`generated_by`)
         BURADA OKUNMUYOR — panelden düzeltme o alanı hiç değiştirmiyor ve
         "elden geçti" rozeti bir dönem ondan besleniyordu, yani hiç
         çizilmiyordu. Doğru kaynak `getAdminEditedKeys`. */
      if (
        row.updatedAt &&
        (!held.updatedAt || row.updatedAt > held.updatedAt)
      ) {
        held.updatedAt = row.updatedAt;
      }
    }
    return [...bySlug.values()].slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Panelden en az bir kez düzeltilmiş kayıtların anahtarları.
 *
 * KÜNYE DEĞİL, İZ. `generatedBy` sütunu bilerek dokunulmadan duruyor —
 * "yazıyı yine rutin yazdı, insan yalnızca elden geçirdi" (gerekçe
 * `lib/content-write.ts`te) ve o sütun rutin durduğunda ilk bakılan yer.
 * Ama listede "buna elle dokunulmuş" demenin bir yolu olmalıydı ve bir dönem
 * `generatedBy === "admin"` diye yazıldı: HİÇBİR ZAMAN DOĞRU OLMAYAN bir
 * koşul, çünkü upsert'ün `set` bloğunda o alan yok. Rozet ekranda hiç
 * çizilmiyordu.
 *
 * Doğru kaynak sürüm tablosu: `replacedBy` alanı, o fotoğrafın ÜZERİNE
 * kimin yazdığını söylüyor. "admin" satırı varsa panelden düzeltilmiştir.
 * Tek sorgu, `cache()` sarmalı — aynı sayfadaki iki liste de aynı turu
 * paylaşıyor.
 */
export const getAdminEditedKeys = cache(
  async function getAdminEditedKeys(): Promise<Set<string>> {
    try {
      const rows = await db
        .selectDistinct({ slug: storyRevisions.slug })
        .from(storyRevisions)
        .where(eq(storyRevisions.replacedBy, "admin"));
      return new Set(rows.map((row) => row.slug));
    } catch {
      return new Set();
    }
  },
);

export type EditableBrief = {
  briefDate: string;
  locale: string;
  period: string;
  headline: string;
  bodyMd: string;
  generatedBy: string;
  generatedAt: Date;
};

/**
 * Tek bir bülten kaydı — editörün okuduğu satır.
 *
 * `getBriefByDate` KULLANILAMAZ: o okuma tarafının fonksiyonu ve istenen dil
 * yoksa BAŞKA bir dildeki kayda düşüyor ("çevirisi yoksa orijinali göster"
 * kuralı). Editörde bu sessiz bir veri kaybı olurdu — İngilizceyi düzenlemek
 * için açılan sayfa Türkçe metni yükler, kaydet denince Türkçe metin
 * İngilizce satırın üzerine yazılırdı. Burada eşleşme ÜÇÜ DE TAM: tarih,
 * dil, dönem. Kayıt yoksa `null` ve sayfa 404 veriyor.
 */
export async function getBriefForEdit(
  briefDate: string,
  locale: string,
  period: string,
): Promise<EditableBrief | null> {
  try {
    const [row] = await db
      .select({
        briefDate: dailyBriefs.briefDate,
        locale: dailyBriefs.locale,
        period: dailyBriefs.period,
        headline: dailyBriefs.headline,
        bodyMd: dailyBriefs.bodyMd,
        generatedBy: dailyBriefs.generatedBy,
        generatedAt: dailyBriefs.generatedAt,
      })
      .from(dailyBriefs)
      .where(
        and(
          eq(dailyBriefs.briefDate, briefDate),
          eq(dailyBriefs.locale, locale),
          eq(dailyBriefs.period, period),
        ),
      )
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Aynı bültenin ÖTEKİ dildeki kaydı var mı — dil geçiş düğmesi için.
 *
 * Var olmayan bir kayda giden düğme 404'e götürürdü; mercek editöründe de
 * aynı kural işliyor.
 */
export async function briefLocalesFor(
  briefDate: string,
  period: string,
): Promise<string[]> {
  try {
    const rows = await db
      .select({ locale: dailyBriefs.locale })
      .from(dailyBriefs)
      .where(
        and(
          eq(dailyBriefs.briefDate, briefDate),
          eq(dailyBriefs.period, period),
        ),
      );
    return rows.map((row) => row.locale);
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------------------
   Yayın ritmi — hangi gün ne yazıldı
   -------------------------------------------------------------------------- */

export type PublishDay = {
  /** "YYYY-MM-DD" ET */
  day: string;
  /** O günün günlük bülteni yazıldı mı. */
  daily: boolean;
  /** O güne pazartesi çapasıyla düşen haftalık bülten yazıldı mı. */
  weekly: boolean;
  /** O gün yayımlanan FARKLI mercek yazısı sayısı. */
  stories: number;
  /** O gün yayımlanan FARKLI bilanço analizi sayısı. */
  analyses: number;
  /** Hafta sonu ya da NYSE tatili — rutin o gün bülten YAZMAZ. */
  offDay: boolean;
  /** Bugün — gün henüz bitmedi, eksik görünmesi normal. */
  isToday: boolean;
};

/**
 * Son N haftanın gün gün yayın ritmi.
 *
 * NE İŞE YARAR: panel bugüne kadar "bugünün bülteni var mı" sorusunu
 * cevaplıyordu; "geçen ay hangi günler boş kaldı" sorusunu değil. Bir rutin
 * birkaç gün durup sonra devam ettiğinde geriye dönüp bakmanın hiçbir yolu
 * yoktu. Izgara o boşlukları tek bakışta gösteriyor ve dolu günden kaydına
 * gidiliyor.
 *
 * SAYIM DISTINCT. Her içerik iki dilli ve `stories` ile `earnings_analyses`
 * aynı içerik için İKİ satır tutuyor; ham `count(*)` her günü "2" gösterir
 * ve ızgara sürekli dolu görünürdü.
 *
 * GÜN TANIMI ET. Sitenin her yerinde takvim günü ET; `published_at` ise
 * `timestamptz`. Dönüşüm sorguda yapılıyor, JavaScript tarafında yerel
 * saate düşmesin.
 *
 * BÜLTENDE HAFTA SONU BOŞ OLMASI EKSİK DEĞİL. Rutinin kendi kuralı "piyasa
 * kapalıysa o gün için yazı yazma" diyor — cron her gün koşuyor ama yazı
 * çıkmıyor. Bayrak olmadan ızgaranın her haftası iki kırmızı hücreyle
 * biterdi.
 *
 * MERCEK GÜNDE İKİ KOŞUM. Rutin 11:30 ve 23:30'da çalışıyor, yani bir günde
 * iki yazı olabilir; hücre adet sayıyor, dolu/boş değil.
 *
 * ANALİZ HÜCRESİ YARGI TAŞIMAZ. Rutin yalnızca aday çeyrek varsa yazıyor ve
 * aday geçmişi tutulmuyor — boş bir gün "yazılmadı" değil, "aday yoktu"
 * olabilir. Bu yüzden analiz şeridinde boş hücre nötr.
 */
export type PublishRhythm = {
  days: PublishDay[];
  /** Arşivdeki EN ESKİ bülten günü — tarih seçicinin alt sınırı. */
  firstBriefDay: string | null;
};

export async function getPublishRhythm(weeks = 8): Promise<PublishRhythm> {
  const today = todayEt();
  /* Izgara PAZARTESİ başlıyor: haftalık bülten pazartesiye çapalanıyor ve
     satır başı ile çapa aynı güne düşmezse okuma bozulur. */
  const sonPazartesi = weekAnchor(today);
  const ilkGun = addEtDays(sonPazartesi, -7 * (weeks - 1));

  try {
    const [briefRows, storyRows, analysisRows, holidays, firstRow] =
      await Promise.all([
        db
          .select({ day: dailyBriefs.briefDate, period: dailyBriefs.period })
          .from(dailyBriefs)
          .where(gte(dailyBriefs.briefDate, ilkGun))
          .groupBy(dailyBriefs.briefDate, dailyBriefs.period),
        db
          .select({
            day: sql<string>`(${stories.publishedAt} at time zone 'America/New_York')::date::text`,
            n: countDistinct(stories.slug),
          })
          .from(stories)
          .groupBy(
            sql`(${stories.publishedAt} at time zone 'America/New_York')::date`,
          ),
        db
          .select({
            day: sql<string>`(${earningsAnalyses.publishedAt} at time zone 'America/New_York')::date::text`,
            n: countDistinct(
              sql`${earningsAnalyses.symbol} || ':' || ${earningsAnalyses.period}`,
            ),
          })
          .from(earningsAnalyses)
          .groupBy(
            sql`(${earningsAnalyses.publishedAt} at time zone 'America/New_York')::date`,
          ),
        getHolidays(),
        /* Izgara sekiz haftalık ama arşiv daha eskiye gidiyor; tarih
         seçicinin alt sınırı ızgaranın değil ARŞİVİN başlangıcı olmalı,
         yoksa seçici veri olan günleri dışarıda bırakır. */
        db
          .select({ first: sql<string | null>`min(${dailyBriefs.briefDate})` })
          .from(dailyBriefs),
      ]);

    const daily = new Set(
      briefRows.filter((r) => r.period === "daily").map((r) => r.day),
    );
    const weekly = new Set(
      briefRows.filter((r) => r.period === "weekly").map((r) => r.day),
    );
    const storyByDay = new Map(storyRows.map((r) => [r.day, Number(r.n)]));
    const analysisByDay = new Map(
      analysisRows.map((r) => [r.day, Number(r.n)]),
    );
    const tatil = new Set(holidays.map((h) => h.date));

    const out: PublishDay[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const day = addEtDays(ilkGun, i);
      const gun = etWeekday(day);
      out.push({
        day,
        daily: daily.has(day),
        /* Haftalık bülten o haftanın PAZARTESİsine yazılıyor; hücre de
           orada işaretleniyor, haftanın her gününe yayılmıyor. */
        weekly: weekly.has(day),
        stories: storyByDay.get(day) ?? 0,
        analyses: analysisByDay.get(day) ?? 0,
        offDay: gun === 0 || gun === 6 || tatil.has(day),
        isToday: day === today,
      });
    }
    /* Gelecek günler ızgaraya girmiyor: bu haftanın kalanı henüz olmadı. */
    return {
      days: out.filter((d) => d.day <= today),
      firstBriefDay: firstRow[0]?.first ?? null,
    };
  } catch {
    return { days: [], firstBriefDay: null };
  }
}

/* --------------------------------------------------------------------------
   Veri sağlığı
   -------------------------------------------------------------------------- */

export type HealthCheck = {
  label: string;
  /* Satır hangi listeye ait. Sistem sayfası panelleri buna göre çiziyor ve
     ayrım bir dönem `label.endsWith("anahtarı")` ile yapılıyordu: etiketin
     sonundaki bir kelime görünmez bir protokole dönüşmüştü, etiketi
     düzeltmek listeyi bozuyordu.

     "routine" grubu, sitenin yazılı içeriğini üreten dört claude.ai
     rutininin nabzı — kodun DIŞINDA koşan ve panelin bugüne kadar hiç
     sormadığı şey. */
  group: "data" | "key" | "routine";
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
/* `cache()`: aynı istekte iki ayrı Suspense sınırı bunu çağırıyor —
   /admin/sistem'de hem üstteki nabız kutusu hem aşağıdaki liste. Sarmalsız
   bırakılırsa altı yoklama iki kez koşuyor ve hepsi ağ ya da veritabanı
   turu. */
export const getHealthChecks = cache(async function getHealthChecks(): Promise<
  HealthCheck[]
> {
  const today = todayEt();
  const checks: HealthCheck[] = [];

  /* ALTI SONDA PARALEL. Hepsi birbirinden bağımsızdı ama ardışık `await`
     ile bekleniyordu ve neon-http'de her sorgu ayrı bir HTTP gidiş-dönüşü:
     altı tur, sistem sayfasının ilk baytına doğrudan biniyordu. Sonuçlar
     `allSettled` ile toplanıyor — biri düşerse yalnızca o satır "okunamadı"
     gösteriyor, diğer beşi eskisi gibi yerinde. */
  const probes = await Promise.allSettled([
    db
      .select({
        furthest: sql<string | null>`max(${earningsCalendar.reportDate})`,
      })
      .from(earningsCalendar),
    db
      .select({
        furthest: sql<string | null>`max(${economicEvents.eventDate})`,
      })
      .from(economicEvents)
      .where(eq(economicEvents.importance, "high")),
    newsPulse(),
    db
      .select({
        total: count(),
        stalest: sql<string | null>`min(${symbols.updatedAt})`,
        noCap: sql<number>`count(*) filter (where ${symbols.marketCap} is null)`,
      })
      .from(symbols),
    db
      .select({ stalest: sql<string | null>`min(${macroSeries.updatedAt})` })
      .from(macroSeries),
    /* ---- Rutin nabzı ---- */
    db
      .select({
        period: dailyBriefs.period,
        latest: sql<string | null>`max(${dailyBriefs.briefDate})`,
        wrote: sql<string | null>`max(${dailyBriefs.generatedAt})`,
      })
      .from(dailyBriefs)
      .groupBy(dailyBriefs.period),
    /* TAZELİK `published_at`TAN OKUNMAZ. `/api/mercek` ve `/api/analiz`
       POST'ları var olan kaydın üstüne `onConflictDoUpdate` ile yazıyor ve
       güncellenen alanlar arasında `published_at` YOK — yani rutin aynı
       slug'ı güncellediğinde o sütun kıpırdamıyor. Mercek rutininin belgeli
       akışı da tam bunu söylüyor: "aynı olayda ciddi gelişme olduysa aynı
       slug ile güncelle". İkisinin büyüğü alınmazsa panel çalışan bir
       rutini durmuş sanır. */
    db
      .select({
        latest: sql<
          string | null
        >`max(greatest(${stories.publishedAt}, ${stories.updatedAt}))`,
      })
      .from(stories),
    db
      .select({
        latest: sql<
          string | null
        >`max(greatest(${earningsAnalyses.publishedAt}, ${earningsAnalyses.updatedAt}))`,
      })
      .from(earningsAnalyses),
    /* Ölçüm aralığı da buraya alındı: fonksiyonun kendi yorumu "ALTI SONDA
       PARALEL" derken yedincisi aşağıda ardışık bekleniyordu ve neon-http'de
       bu fazladan bir tam gidiş-dönüş. */
    getTrackingRange(),
  ]);

  /* Düşen sorgu fırlatır ve aşağıdaki blokların kendi `catch`i onu
     "okunamadı" satırına çevirir — davranış eskisiyle aynı. */
  function unwrap<T>(result: PromiseSettledResult<T>): T {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  }

  /* ---- Sağlayıcı anahtarları ---- */
  const keys: [string, string | undefined][] = [
    ["Alpaca", process.env.ALPACA_API_KEY_ID],
    ["Finnhub", process.env.FINNHUB_API_KEY],
    ["FRED", process.env.FRED_API_KEY],
    ["Anthropic", process.env.ANTHROPIC_API_KEY],
    ["Cron Anahtarı", process.env.CRON_SECRET],
    ["Rutin Anahtarı", process.env.BRIEF_SECRET],
  ];
  for (const [label, value] of keys) {
    checks.push({
      label,
      group: "key",
      value: value ? "Tanımlı" : "Yok",
      tone: value ? "ok" : "down",
      /* "anahtar" kelimesi NOTTA: özet ekranı bu satırları kendi panelinin
         dışında, başlıksız listeliyor ve orada yalnızca "Anthropic" yazması
         neyin eksik olduğunu söylemiyordu. */
      note: value
        ? "ortam değişkeni dolu"
        : "anahtar eksik — ilgili kartlar veri alamaz",
    });
  }

  /* ---- Bilanço takvimi ne kadar ileri gidiyor ---- */
  try {
    const [row] = unwrap(probes[0]);
    const days = row?.furthest ? daysBetween(today, row.furthest) : 0;
    checks.push({
      label: "Bilanço Takvimi",
      group: "data",
      value: `${days} Gün İleri`,
      /* Cron 30 gün dolduruyor; 20'nin altına düşmesi koşumun aksadığını
         söyler, 7'nin altı ekranın boşalmaya başladığı yer. */
      tone: days >= 20 ? "ok" : days >= 7 ? "warn" : "down",
      note: `en uzak kayıt ${row?.furthest ?? "yok"}`,
    });
  } catch {
    checks.push(failed("Bilanço Takvimi"));
  }

  /* ---- Ekonomik takvim ömrü ---- */
  try {
    const [row] = unwrap(probes[1]);
    const days = row?.furthest ? daysBetween(today, row.furthest) : 0;
    checks.push({
      label: "Ekonomik Takvim",
      group: "data",
      value: `${days} Gün İleri`,
      /* FRED bir yıl ileriye dolduruyor; 90 günün altı senkronun durduğunu
         gösterir ve bunu takvim boşalmadan görmek gerekiyor. */
      tone: days >= 90 ? "ok" : days >= 30 ? "warn" : "down",
      note: "yüksek önemli olayların en uzağı",
    });
  } catch {
    checks.push(failed("Ekonomik Takvim"));
  }

  /* ---- Haber akışı ---- */
  try {
    const pulse = unwrap(probes[2]);
    const hours = hoursSince(pulse.latest);
    checks.push({
      label: "Haber Akışı",
      group: "data",
      value: hours === null ? "Kayıt Yok" : `${hours} Saat Önce`,
      tone: hours === null ? "down" : hours <= 30 ? "ok" : "warn",
      note: `çevrilmemiş başlık: ${pulse.untranslated}`,
    });
  } catch {
    checks.push(failed("Haber Akışı"));
  }

  /* ---- Sembol profilleri ---- */
  try {
    const [row] = unwrap(probes[3]);
    const stalestHours = hoursSince(row?.stalest ?? null);
    const days = stalestHours === null ? null : Math.floor(stalestHours / 24);
    checks.push({
      label: "Sembol Profilleri",
      group: "data",
      value: `${Number(row?.total ?? 0)} Kayıt`,
      /* Cron günde 60 profil tazeliyor; ~700 sembollük evren 12 günde bir
         tur atıyor. 20 günü aşan bir kayıt turun aksadığını gösterir. */
      tone: days === null ? "idle" : days <= 20 ? "ok" : "warn",
      note:
        days === null
          ? "profil yok"
          : `en eski kayıt ${days} günlük · piyasa değeri boş: ${Number(row?.noCap ?? 0)}`,
    });
  } catch {
    checks.push(failed("Sembol Profilleri"));
  }

  /* ---- Makro seriler ---- */
  try {
    const [row] = unwrap(probes[4]);
    const hours = hoursSince(row?.stalest ?? null);
    checks.push({
      label: "Makro Seriler",
      group: "data",
      value:
        hours === null ? "Kayıt Yok" : `${Math.floor(hours / 24)} Gün Önce`,
      tone: hours === null ? "down" : hours <= 48 ? "ok" : "warn",
      note: "en uzun süredir güncellenmeyen serinin son güncellenme zamanı",
    });
  } catch {
    checks.push(failed("Makro Seriler"));
  }

  /* ---- Rutinler ----
     Sitenin yazılı içeriğinin TAMAMINI kod dışında, claude.ai üzerinde
     kurulu dört rutin üretiyor. Panel bugüne kadar yalnızca SONUCU
     sayıyordu — kaç bülten, kaç yazı — ama üretimin kendisini hiç
     sormuyordu: bir rutin askıya alındığında bunu fark etmenin tek yolu
     siteye çıkıp bültenin tarihine bakmaktı.

     EŞİK HER RUTİNİN KENDİ DOĞASINA GÖRE. Tek eşik yanlış alarm üretirdi:
     bülten her gün yazılıyor ve yazılmaması bir arıza; mercek ise koşullu —
     rutinin kendi yönergesi "sıradan bir seans mercek konusu değildir"
     diyor, yani çoğu gün hiçbir şey yazmaması NORMAL. Ona eşik koymak
     uydurma alarm olurdu; o satır yalnızca son yazma anını söylüyor.

     SAATLER TEK KAYNAKTAN: `BRIEF_PUBLISH_TR`. Rutin saatlerini koda ikinci
     kez yazmak, docs/claude-rutinler.md ile ayrışan bir sayı doğururdu. */
  const trSaat = formatInZone(new Date(), TR_ZONE);
  const gectiMi = (esik: string) => trSaat >= esik;

  try {
    const rows = unwrap(probes[5]);
    const bulten = new Map(rows.map((r) => [r.period, r]));

    /* Günlük: bugünün ET tarihinde kayıt var mı. Karşılaştırma ana
       sayfadaki `BriefCard` ile aynı kalıp — ikinci bir kopya yazılırsa
       ikisi ayrışır. */
    const gunluk = bulten.get("daily");
    const gunlukVar = gunluk?.latest === today;
    const gunlukSaat = BRIEF_PUBLISH_TR.daily;
    checks.push({
      label: "Günlük Bülten",
      group: "routine",
      value: gunlukVar ? "Bugün Yazıldı" : (gunluk?.latest ?? "Kayıt Yok"),
      tone: gunlukVar ? "ok" : gectiMi(gunlukSaat) ? "warn" : "idle",
      note: gunlukVar
        ? `son yazma ${agoText(gunluk?.wrote ?? null)}`
        : gectiMi(gunlukSaat)
          ? `${gunlukSaat} TR geçti, bugünün kaydı yok`
          : `${gunlukSaat} TR'de bekleniyor`,
    });

    /* Haftalık: o haftanın PAZARTESİ çapası. Çapa `/api/brief`in kendi
       `weekAnchor`ı ile aynı olmalı, yoksa panel yazılmış bülteni yok
       sayar. */
    const haftalik = bulten.get("weekly");
    const capa = weekAnchor(today);
    const haftalikVar = haftalik?.latest === capa;
    const haftalikSaat = BRIEF_PUBLISH_TR.weekly;
    const pazartesiGecti = etWeekday(today) !== 1 || gectiMi(haftalikSaat);
    checks.push({
      label: "Haftalık Bülten",
      group: "routine",
      value: haftalikVar
        ? "Bu Hafta Yazıldı"
        : (haftalik?.latest ?? "Kayıt Yok"),
      tone: haftalikVar ? "ok" : pazartesiGecti ? "warn" : "idle",
      note: haftalikVar
        ? `${capa} haftası · son yazma ${agoText(haftalik?.wrote ?? null)}`
        : pazartesiGecti
          ? `${capa} haftasının kaydı yok`
          : `pazartesi ${haftalikSaat} TR'de bekleniyor`,
    });
  } catch {
    checks.push(failed("Günlük Bülten"));
    checks.push(failed("Haftalık Bülten"));
  }

  /* Mercek ve analiz YARGI VERMEZ. İkisi de koşullu rutin: yazacak bir şey
     yoksa yazmamak doğru davranış. Satırlar yalnızca son yazma anını
     söylüyor — yönetici o sayıya bakıp kendi kararını veriyor. */
  for (const [etiket, indeks, not] of [
    ["Mercek Yazısı", 6, "koşullu rutin — anlatmaya değer olay yoksa yazmaz"],
    ["Bilanço Analizi", 7, "koşullu rutin — aday yoksa yazmaz"],
  ] as const) {
    try {
      const [row] = unwrap(probes[indeks]);
      checks.push({
        label: etiket,
        group: "routine",
        value: row?.latest ? agoText(row.latest) : "Kayıt Yok",
        tone: "idle",
        note: not,
      });
    } catch {
      checks.push(failed(etiket));
    }
  }

  /* ---- Ölçüm ---- */
  try {
    const range = unwrap(probes[8]);
    if (!range.ok) throw new Error("olcum okunamadi");
    checks.push({
      label: "Sayfa Ölçümü",
      group: "data",
      value: `${range.rows.toLocaleString("tr-TR")} Kayıt`,
      tone: range.rows > 0 ? "ok" : "idle",
      note: range.firstDay
        ? `ilk kayıt ${range.firstDay} · 180 gün sonra otomatik silinir`
        : "henüz kayıt yok — ilk ziyaretle başlar",
    });
  } catch {
    checks.push(failed("Sayfa Ölçümü"));
  }

  return checks;
});

function failed(label: string): HealthCheck {
  return {
    label,
    group: "data",
    value: "Okunamadı",
    tone: "down",
    note: "veritabanı sorgusu başarısız",
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
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
/** "4 saat önce" — sorgudan Date ya da ISO dize gelebiliyor, ikisini de alır. */
function agoText(value: Date | string | null): string {
  if (!value) return "hiç";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? agoLabel(d) : "hiç";
}

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
/**
 * Haber akışının son çekim damgası ve çevrilmemiş başlık sayısı.
 *
 * `cache()` — sistem sayfası aynı sayıyı İKİ KEZ soruyordu: bir kez cron
 * nabzı ("bugün koştu mu"), bir kez de sağlık listesi ("akış ne kadar
 * taze"). Aynı `max(fetched_at)` iki ayrı HTTP gidiş-dönüşü demekti ve
 * ikisi ayrı anlarda okunduğu için teorik olarak farklı cevap da
 * verebiliyorlardı.
 */
const newsPulse = cache(async function newsPulse(): Promise<{
  latest: Date | null;
  untranslated: number;
}> {
  const [row] = await db
    .select({
      latest: sql<string | null>`max(${news.fetchedAt})`,
      untranslated: sql<number>`count(*) filter (where ${news.headlineTr} is null)`,
    })
    .from(news);
  return {
    latest: row?.latest ? new Date(row.latest) : null,
    untranslated: Number(row?.untranslated ?? 0),
  };
});

export async function getCronPulse(): Promise<{
  lastNewsFetch: Date | null;
  ranToday: boolean;
}> {
  try {
    const pulse = await newsPulse();
    /* TAKVİM GÜNÜ, KAYAN 24 SAAT DEĞİL. "Son 24 saatte koştu" ile "bugün
       koştu" farklı sorular: cron hafta içi 10:30 UTC'de koşuyor, yani
       Çarşamba 09:00'da bakan biri Salı'nın koşumunu görüp "Bugün koştu"
       yazısıyla karşılaşıyordu — bugünkü koşum henüz olmamışken. Hafta
       sonu daha da yanlıştı: Cumartesi hiç planlanmamışken Cuma'nın koşumu
       22 saat önceydi ve kart yeşil yanıyordu. Panelin varlık sebebi olan
       uyarı, tam da cron aksadığı sabah susuyordu.

       Gün tanımı ET — panelin geri kalanıyla aynı (dosya başındaki not). */
    const latest = pulse.latest;
    return {
      lastNewsFetch: latest,
      ranToday: latest !== null && etDayOf(latest) === todayEt(),
    };
  } catch {
    return { lastNewsFetch: null, ranToday: false };
  }
}
