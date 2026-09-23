import { cache } from "react";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { HealthTone } from "@/components/admin/AdminUI";
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
  technicalAnalyses,
  users,
  watchlistItems,
  watchlists,
} from "./schema";
import { addEtDays, etDateTimeToUtc, todayEt } from "./market-hours";
import { BRIEF_PUBLISH_TR, getHolidays, weekAnchor } from "./data";
import {
  adminDay,
  adminDayIn,
  adminDayYear,
  adminStamp,
  adminWeekRange,
  agoLabel,
} from "./admin-format";
import { siteHost } from "./analytics";
import { briefRevisionKey } from "./content-write";
import { TR_ZONE, formatInZone } from "./session-clock";
import {
  ROUTINE_GRACE_MINUTES,
  cronState,
  dailyBriefDueAt,
  dailyBriefState,
  expectedDailyBrief,
  lastCronDue,
  technicalState,
  trDateOf,
  weeklyBriefDueAt,
  weeklyBriefState,
  type CronState,
} from "./routine-schedule";
import { SLOT_RANK, isTechnicalSlot, slotInstant, type TechnicalSlot } from "./technical";
import { activeTranslateBackend } from "./translate";
import trDictionary from "./i18n/dictionaries/tr";

/**
 * Yönetim panelinin sorguları.
 *
 * OKUNAMADI, BOŞ DEĞİLDİR (23 Eylül denetimi). Her okuma `AdminResult<T>`
 * döner — `{ ok: true, data }` ya da `{ ok: false }`, `lib/data.ts`teki
 * `EventsResult` ile aynı biçim. Okumalar bir dönem hatayı yutup sıfır ya
 * da boş liste döndürüyordu ve bu dosyanın başı "boş kutu ekranda 'veri
 * alınamadı' olarak duruyor" diyordu; o sözü tutan tek bir kutu yoktu.
 * Düşen sorgu ekranda "Üye 0", "Eksik yok.", "Henüz kayıtlı üye yok." ve
 * "Ölçüm ilk ziyaretle başlar" diye okunuyordu — bozuk olan tam da panelin
 * uyarması gereken şeydi. Ekranlar artık `ok`a bakıyor: okunamayan kutu
 * tire ve "Veri Alınamadı", boş durum cümlesi YALNIZCA başarılı ve boş bir
 * okumada.
 *
 * SAYFA YİNE ÇÖKMÜYOR. Panel dokuz ayrı kutu gösteriyor; birinin sorgusu
 * düştüğünde diğer sekizi yerinde kalıyor — panelin varlık sebebi zaten
 * "bir şey bozulduğunda görmek". Her yutulan hata sunucu günlüğüne bir
 * satır bırakıyor (`yutuldu`, lib/data.ts'teki kalıp).
 *
 * SAYFA ÖLÇÜMÜ ET GÜNÜNE GÖRE. `viewedOn` yazılırken de ET günü kullanılıyor
 * (lib/analytics.ts); panelde "bugün" ile sitenin geri kalanındaki "bugün"
 * aynı gün olsun diye. Türkiye saatiyle sabahın erken saatleri New York'ta
 * hâlâ dün — iki tanım karışırsa panel kendi kendisiyle çelişir. Sınırın TR
 * saati künyede yazılı (lib/session-clock.ts → `dayBoundaryNote`).
 */

/** Okumanın sonucu: veri ya da "okunamadı". Boş liste başarılı bir okumadır. */
export type AdminResult<T> = { ok: true; data: T } | { ok: false };

/**
 * Yutulan hata — SESSİZ DEĞİL, İZLİ. Gerekçe `lib/data.ts` → `yutuldu`:
 * Neon bir saat kesintiye girse sunucu günlüğünde tek satır çıkmıyordu.
 */
function yutuldu(kaynak: string, error: unknown): void {
  const mesaj = error instanceof Error ? error.message : String(error);
  console.error(`[yönetim] ${kaynak} okunamadı: ${mesaj}`);
}

/** Bir okumayı `AdminResult`a sarar — hata bir kez günlüğe, ekrana `ok: false`. */
async function oku<T>(kaynak: string, run: () => Promise<T>): Promise<AdminResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    yutuldu(kaynak, error);
    return { ok: false };
  }
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
  /**
   * Ölçüm o gün çalışıyor muydu — ilk kaydın gününden önce `false`.
   *
   * SIFIR İLE "ÖLÇÜLMEDİ" AYRI (23 Eylül denetimi). Boş günler sıfırla
   * dolduruluyor ve 90 günlük pencere 26 Haziran'dan başlıyordu; ilk kayıt
   * 13 Ağustos. Grafiğin sol yarısı gerçek bir sıfır trafik gibi çiziliyor,
   * kutu "Son 90 Tam Gün" diyordu — verinin kapsadığı 41 gündü.
   */
  measured: boolean;
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
 * Alan adı bunu söylüyor; ekran etiketleri de öyle (lib/admin-format.ts →
 * `METRIC`). Ölçüyü düzeltmek mümkün değilken adını düzeltmemek, sayının
 * yalan söylemesi demekti.
 */
export type TrafficTotals = {
  views: number;
  /** Ziyaretçi-günü — aynı kişi her gün yeniden sayılır. */
  visitorDays: number;
};

/**
 * Gün gün görüntüleme ve tekil ziyaretçi — grafiğin kaynağı.
 *
 * PENCERE KUTULARIN PENCERESİ + BUGÜN (23 Eylül denetimi). Seri bugünden
 * geriye `days` gündü, kutular ise dünde biten `fullDayWindow(days)`: aynı
 * "Son 30 Gün" seçicisinin altında grafik 25 Ağu–23 Eyl, kutular 24 Ağu–22
 * Eyl sayıyordu ve grafiğin tablosunun toplamı (2.466) kutudan (2.436)
 * farklıydı. Artık seri `fullDayWindow(days).from`dan bugüne, `days + 1`
 * nokta: düz çizgi birebir kutunun penceresi, kesik son parça bugün.
 */
export async function getTrafficSeries(
  days: number,
): Promise<AdminResult<TrafficPoint[]>> {
  const today = todayEt();
  const { from } = fullDayWindow(days);

  return oku("getTrafficSeries", async () => {
    const [rows, holidays, range] = await Promise.all([
      db
        .select({
          day: pageViews.viewedOn,
          views: count(),
          visitors: countDistinct(pageViews.visitorHash),
        })
        .from(pageViews)
        .where(and(gte(pageViews.viewedOn, from), lte(pageViews.viewedOn, today)))
        .groupBy(pageViews.viewedOn)
        .orderBy(asc(pageViews.viewedOn)),
      /* Tatiller `cache()`li ve bu istekte zaten okunmuş olabilir. */
      getHolidays(),
      getTrackingRange(),
    ]);

    /* Kayıt olmayan günler sorgudan HİÇ dönmez ve grafik o günleri atlayıp
       çizgiyi yalancı bir eğime sokar. Boş günler sıfırla dolduruluyor —
       ölçümün başladığı günden önceki sıfırlar ise `measured: false`. */
    const found = new Map(rows.map((r) => [r.day, r]));
    const tatiller = new Set(holidays.map((h) => h.date));
    /* Aralık okunamadıysa ölçülmemiş gün İLAN EDİLMİYOR: seri aynı
       tablodan az önce okundu, bilinmeyeni "yok" diye yazmak ikinci bir
       uydurma olurdu. */
    const firstDay = range.ok ? range.data.firstDay : null;
    const series: TrafficPoint[] = [];
    for (let day = from; day <= today; day = addEtDays(day, 1)) {
      const row = found.get(day);
      const gun = etWeekday(day);
      series.push({
        day,
        views: Number(row?.views ?? 0),
        visitors: Number(row?.visitors ?? 0),
        isToday: day === today,
        offDay: gun === 0 || gun === 6 || tatiller.has(day),
        measured: !range.ok || (firstDay !== null && day >= firstDay),
      });
    }
    return series;
  });
}

/**
 * "Son N gün" penceresi — DÜN BİTER, bugün dışarıda.
 *
 * Aynı seçici ("Son 30 Gün") sayfada iki farklı pencere anlamına geliyordu:
 * sayı kutuları tamamlanmış günleri sayıyordu (aşağıdaki gerekçe), kırılım
 * listeleri ise bugünü de içeriyordu. Okuyucu "Bölümler" listesindeki
 * satırları toplayıp üstteki "Görüntüleme" kutusuyla karşılaştırdığında
 * tutmayan iki sayı görüyordu. Tek tanım burada; grafik bu pencereyi AYNEN
 * çiziyor ve bugünü ayrı, kesik bir son parça olarak ekliyor
 * (`getTrafficSeries`).
 */
export function fullDayWindow(days: number): { from: string; to: string } {
  const to = addEtDays(todayEt(), -1);
  return { from: addEtDays(to, -(days - 1)), to };
}

/** Bir aralığın toplamı — ziyaretçi sayısı GÜN BAŞINA tekildir (bkz. tip). */
export async function getTrafficTotals(
  fromDay: string,
  toDay: string,
): Promise<AdminResult<TrafficTotals>> {
  return oku("getTrafficTotals", async () => {
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
  });
}

export type Breakdown = { key: string; views: number; visitors: number };

/**
 * Bir sütuna göre kırılım — rota, yol, yönlendiren, cihaz, dil.
 *
 * Sütun tipi `PgColumn` olarak alınıyor, `typeof pageViews.route` olarak
 * değil: Drizzle her sütuna KENDİ adını taşıyan bir tip veriyor ve tek bir
 * sütunun tipini imza yapmak diğer beş çağrıyı derlemiyor. `SQL` de
 * alınıyor: rota ve yol okumada bir ifadeden geçiyor (`ROUTE_READ`,
 * `PATH_READ`).
 */
async function breakdownBy(
  kaynak: string,
  column: PgColumn | SQL,
  days: number,
  limit: number,
  onlyNotNull = false,
  extraWhere?: SQL,
): Promise<AdminResult<Breakdown[]>> {
  const { from, to } = fullDayWindow(days);
  return oku(kaynak, async () => {
    const inWindow = and(
      gte(pageViews.viewedOn, from),
      lte(pageViews.viewedOn, to),
      extraWhere,
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
      /* EŞİTLİKTE ANAHTAR SIRASI. Yalnızca sayıya göre sıralanıyordu ve
         eşit sayılı satırlar (7 günde `/teknik` ile `/teknik/[symbol]`,
         ikisi de 63) her yüklemede yer değiştiriyordu — Postgres eşitlikte
         bir sıra vaat etmiyor. Liste kesildiğinde (`limit`) hangi satırın
         dışarıda kalacağı da buna bağlıydı. */
      .orderBy(desc(count()), asc(column))
      .limit(limit);

    return rows.map((r) => ({
      key: r.key == null ? "—" : String(r.key),
      views: Number(r.views),
      visitors: Number(r.visitors),
    }));
  });
}

/**
 * Rota şablonu OKUMADA da toplanıyor. `/teknik/[symbol]` deseni yazma
 * tarafına sonradan eklendi (lib/analytics.ts); ondan önceki satırlar
 * `/teknik/mu` gibi ham duruyor. Üretim tablosunu bir migration ile
 * yeniden yazmak yerine sorgu eski satırları da şablona indiriyor: yeni
 * satırlar zaten şablonlu geliyor, ifade onlara dokunmuyor.
 *
 * TEK PARÇALI `/bilancolar/[symbol]` YOK ve bilerek: `app/(app)/bilancolar/
 * [symbol]` altında yalnızca `[period]` var, öyle bir sayfa açılmıyor.
 * Denetim bu deseni önermişti; sayfası olmayan bir şablon uydurmak olurdu.
 */
const ROUTE_READ = sql<string>`regexp_replace(${pageViews.route}, '^(/en)?/teknik/[^/]+$', '\\1/teknik/[symbol]')`;

/**
 * Yol OKUMADA sitenin kendi yazımına iniyor — `ROUTE_READ`ın yol karşılığı.
 *
 * Yazma tarafı artık sembolü kanonik yazıyor (lib/analytics.ts →
 * `canonicalCase`: hisse büyük, teknik ve analiz küçük harf); eski satırlar
 * geldiği gibi duruyor ve aynı sayfa "Sayfalar" listesinde `/teknik/mu` ile
 * `/teknik/MU` diye iki satır oluyordu (23 Eylül denetimi). Postgres bir
 * yakalama grubunu büyütemediği için hisse dalı yolu son parçasından
 * bölüyor; teknik ve analiz adreslerinin tamamı zaten küçük harf
 * (`technicalHref`, `analysisHref`, dönem parçası `periodSlug`).
 */
const PATH_READ = sql<string>`case
  when ${pageViews.path} ~ '^(/en)?/hisse/[^/]+$'
    then regexp_replace(${pageViews.path}, '[^/]+$', '') || upper(substring(${pageViews.path} from '[^/]+$'))
  when ${pageViews.path} ~ '^(/en)?/(teknik/[^/]+|bilancolar/[^/]+/[^/]+)$'
    then lower(${pageViews.path})
  else ${pageViews.path}
end`;

export const getTopRoutes = (days: number, limit = 12) =>
  breakdownBy("getTopRoutes", ROUTE_READ, days, limit);
export const getTopPaths = (days: number, limit = 15) =>
  breakdownBy("getTopPaths", PATH_READ, days, limit);
/**
 * Yalnızca DİNAMİK ŞABLONLARIN altındaki tek sayfalar — hangi hisse, hangi
 * mercek yazısı, hangi analiz.
 *
 * "Sayfalar" listesi "Bölümler"i tekrar ediyordu (23 Eylül denetimi):
 * 30 günlük pencerede 15 satırın 9'u iki listede aynı etiket ve aynı
 * sayıyla duruyordu ("/", "/piyasalar", "/takvim"…), çünkü sabit bir
 * sayfanın yolu ile şablonu aynı şey. Yol şablondan farklıysa sayfa bir
 * şablonun altındaki tekil adrestir — ikinci listenin cevapladığı soru bu.
 */
export const getTopDetailPaths = (days: number, limit = 12) =>
  breakdownBy(
    "getTopDetailPaths",
    PATH_READ,
    days,
    limit,
    false,
    sql`${PATH_READ} <> ${ROUTE_READ}`,
  );
/* Sitenin kendi alan adı eski satırlarda "yönlendiren" olarak duruyor
   (ters vekil arkasında öz yönlendirme eşleşmiyordu, lib/analytics.ts →
   siteHost); okumada eleniyor. */
export const getTopReferrers = (days: number, limit = 10) => {
  const own = siteHost();
  return breakdownBy(
    "getTopReferrers",
    pageViews.referrerHost,
    days,
    limit,
    true,
    own ? ne(pageViews.referrerHost, own) : undefined,
  );
};
export const getDeviceSplit = (days: number) =>
  breakdownBy("getDeviceSplit", pageViews.device, days, 5);
export const getLocaleSplit = (days: number) =>
  breakdownBy("getLocaleSplit", pageViews.locale, days, 5);

export type SignedInShare = {
  /** Görüntüleme — girişli ve anonim. */
  views: { signedIn: number; anonymous: number };
  /** Ziyaretçi-günü — aynı ikili, kişi-gün olarak. */
  visitorDays: { signedIn: number; anonymous: number };
};

/**
 * Giriş yapmış okuyucunun payı — üyeliğin işe yarayıp yaramadığı.
 *
 * GÖRÜNTÜLEME KİŞİ DEĞİLDİR (23 Eylül denetimi). Sayı `count()` idi, yani
 * görüntüleme; ekran onu "1.351 üye · 1.085 ziyaretçi" diye basıyordu ve
 * sitede beş üye vardı. İki ölçü birden dönüyor: görüntüleme ve
 * ziyaretçi-günü — ekran hangisini yazıyorsa adını da o koyuyor.
 */
export async function getSignedInShare(
  days: number,
): Promise<AdminResult<SignedInShare>> {
  const { from, to } = fullDayWindow(days);
  return oku("getSignedInShare", async () => {
    const rows = await db
      .select({
        signedIn: pageViews.signedIn,
        views: count(),
        visitors: countDistinct(pageViews.visitorHash),
      })
      .from(pageViews)
      .where(and(gte(pageViews.viewedOn, from), lte(pageViews.viewedOn, to)))
      .groupBy(pageViews.signedIn);
    const girisli = rows.find((r) => r.signedIn);
    const anonim = rows.find((r) => !r.signedIn);
    return {
      views: {
        signedIn: Number(girisli?.views ?? 0),
        anonymous: Number(anonim?.views ?? 0),
      },
      visitorDays: {
        signedIn: Number(girisli?.visitors ?? 0),
        anonymous: Number(anonim?.visitors ?? 0),
      },
    };
  });
}

/**
 * Ölçümün ne kadar geriye gittiği — panel "veri yok" ile "yeni kuruldu"yu
 * ayırsın.
 *
 * Okunamadı, "kayıt yok" ile AYNIYDI: hata yutulduğunda dönen `{null, 0}`
 * yüzünden tablo okunamadığında panel "ölçüm henüz başlamadı" diyordu ve
 * bozuk olan tam da uyarması gereken şeydi. `ok` bu ayrım için vardı;
 * artık bütün okumaların biçimi bu.
 *
 * `cache()`: Trafik sayfası üç sınırdan soruyor (kutular, grafik,
 * `getTrafficSeries` içinden) ve Sistem sağlık listesi bir kez daha.
 */
export const getTrackingRange = cache(async function getTrackingRange(): Promise<
  AdminResult<{ firstDay: string | null; rows: number }>
> {
  return oku("getTrackingRange", async () => {
    const [row] = await db
      .select({
        firstDay: sql<string | null>`min(${pageViews.viewedOn})`,
        rows: count(),
      })
      .from(pageViews);
    return {
      firstDay: row?.firstDay ?? null,
      rows: Number(row?.rows ?? 0),
    };
  });
});

/* --------------------------------------------------------------------------
   Üyeler
   -------------------------------------------------------------------------- */

export type MemberSummary = {
  /** Bütün hesaplar — yöneticiler dahil. */
  total: number;
  /** Son 7 ET takvim günü (bugün dahil) açılan hesap. */
  last7: number;
  /** Son 30 ET takvim günü (bugün dahil) — `getSignupSeries(30)` toplamıyla aynı. */
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
  /**
   * ORANLARIN PAYDASI YÖNETİCİSİZ (23 Eylül denetimi). "Toplam Üye 5"in ikisi
   * yönetici hesabıydı (biri panel deneme hesabı); "Aktif Üye 2" ve "Liste
   * Kurmuş · %40" okur kitlesini ölçerken sahibinin kendi hesaplarını
   * sayıyordu. `total` ve `admins` yine dönüyor — kutu "2 Yönetici Dahil"
   * diyebilsin — ama oran bu üçüyle kuruluyor.
   */
  readers: number;
  readersActiveLast30: number;
  readersWithWatchlistItems: number;
};

/**
 * "Son N gün" üyelik penceresinin başı — N ET takvim günü, bugün dahil.
 *
 * TEK PENCERE (23 Eylül denetimi). Kutu `createdAt >= şimdi − 30×24 saat`
 * sayıyordu, kayıt eğrisi ise bugün−29'dan bugüne ET günlerini: otuz gün
 * önceki yarım günün kaydı kutuda sayılıp eğride düşüyordu ve "Son 30 Gün"
 * kutusu hemen altındaki "Son 30 günde N kayıt" cümlesinden bir fazla
 * olabiliyordu. İkisi de artık bu anı kullanıyor.
 */
function memberWindowStart(days: number): Date {
  return etDateTimeToUtc(addEtDays(todayEt(), -(days - 1)), null);
}

export async function getMemberSummary(): Promise<AdminResult<MemberSummary>> {
  return oku("getMemberSummary", async () => {
    const son7 = memberWindowStart(7);
    const son30 = memberWindowStart(30);
    const okur = sql`${users.role} is distinct from 'admin'`;
    /* İki sorgu bağımsız — sırayla beklemenin sebebi yoktu. Aktiflik
       penceresi kayan 30 gün kalıyor: "son girişin üstünden 30 gün geçti
       mi" bir takvim sorusu değil, bir yaş sorusu. */
    const aktifEsik = new Date(Date.now() - 30 * 86_400_000);
    const [[totals], [active]] = await Promise.all([
      db
        .select({
          total: count(),
          last7: sql<number>`count(*) filter (where ${users.createdAt} >= ${son7})`,
          last30: sql<number>`count(*) filter (where ${users.createdAt} >= ${son30})`,
          admins: sql<number>`count(*) filter (where ${users.role} = 'admin')`,
          activeLast30: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${aktifEsik})`,
          neverSeen: sql<number>`count(*) filter (where ${users.lastSeenAt} is null)`,
          readers: sql<number>`count(*) filter (where ${okur})`,
          readersActiveLast30: sql<number>`count(*) filter (where ${okur} and ${users.lastSeenAt} >= ${aktifEsik})`,
        })
        .from(users),
      db
        .select({
          n: countDistinct(watchlists.userId),
          readers: sql<number>`count(distinct ${watchlists.userId}) filter (where ${okur})`,
        })
        .from(watchlists)
        .innerJoin(
          watchlistItems,
          eq(watchlistItems.watchlistId, watchlists.id),
        )
        .innerJoin(users, eq(users.id, watchlists.userId)),
    ]);

    return {
      total: Number(totals?.total ?? 0),
      last7: Number(totals?.last7 ?? 0),
      last30: Number(totals?.last30 ?? 0),
      admins: Number(totals?.admins ?? 0),
      activeLast30: Number(totals?.activeLast30 ?? 0),
      neverSeen: Number(totals?.neverSeen ?? 0),
      withWatchlistItems: Number(active?.n ?? 0),
      readers: Number(totals?.readers ?? 0),
      readersActiveLast30: Number(totals?.readersActiveLast30 ?? 0),
      readersWithWatchlistItems: Number(active?.readers ?? 0),
    };
  });
}

export type SignupPoint = { day: string; signups: number };

/** Kayıt eğrisi — gün gün, boş günler sıfırla dolu. Pencere `memberWindowStart`. */
export async function getSignupSeries(
  days: number,
): Promise<AdminResult<SignupPoint[]>> {
  const today = todayEt();
  return oku("getSignupSeries", async () => {
    const rows = await db
      .select({
        day: sql<string>`to_char(${users.createdAt} at time zone 'America/New_York', 'YYYY-MM-DD')`,
        signups: count(),
      })
      .from(users)
      .where(gte(users.createdAt, memberWindowStart(days)))
      .groupBy(sql`1`);

    const found = new Map(rows.map((r) => [r.day, Number(r.signups)]));
    const series: SignupPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addEtDays(today, -i);
      series.push({ day, signups: found.get(day) ?? 0 });
    }
    return series;
  });
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
  /** Listelerindeki FARKLI sembol sayısı. */
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
 *
 * SAYI FARKLI SEMBOL (23 Eylül denetimi). `count(watchlistItems.id)` idi:
 * bir üyenin birden fazla adlı listesi olabiliyor ve iki listede duran
 * sembol iki kez sayılıyordu; sütun başlığı "Sembol" farklı sembol diye
 * okunuyor. "En Çok Takip Edilenler" zaten `countDistinct` kullanıyordu.
 */
export async function getRecentMembers(
  limit = 25,
): Promise<AdminResult<MemberRow[]>> {
  return oku("getRecentMembers", async () => {
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
        n: countDistinct(watchlistItems.symbol),
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
  });
}

export type WatchedSymbol = {
  symbol: string;
  name: string | null;
  members: number;
};

/**
 * En çok takip edilen semboller — hangi hisseler gerçekten izleniyor.
 *
 * EŞİTLİK SEMBOLLE BOZULUYOR (23 Eylül denetimi). Sıralama yalnızca üye
 * sayısıydı ve on beşin on ikisi "1 üye"de eşitti: hangi 1 üyeli sembolün
 * kesime girdiği her açılışta değişebiliyordu. `total` FARKLI sembol sayısı
 * — kırpılan liste kaçının dışarıda kaldığını söyleyebilsin (sessiz kırpma
 * yok, kayıt eğrisindeki kural).
 */
export async function getMostWatchedSymbols(
  limit = 15,
): Promise<AdminResult<{ rows: WatchedSymbol[]; total: number }>> {
  return oku("getMostWatchedSymbols", async () => {
    const [rows, [sayim]] = await Promise.all([
      db
        .select({
          symbol: watchlistItems.symbol,
          name: symbols.name,
          members: countDistinct(watchlists.userId),
        })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId))
        .leftJoin(symbols, eq(symbols.symbol, watchlistItems.symbol))
        .groupBy(watchlistItems.symbol, symbols.name)
        .orderBy(desc(countDistinct(watchlists.userId)), asc(watchlistItems.symbol))
        .limit(limit),
      db.select({ n: countDistinct(watchlistItems.symbol) }).from(watchlistItems),
    ]);
    return {
      rows: rows.map((r) => ({ ...r, members: Number(r.members) })),
      total: Number(sayim?.n ?? rows.length),
    };
  });
}

/* --------------------------------------------------------------------------
   İçerik
   -------------------------------------------------------------------------- */

/** Bir analiz kaydının adresini kurmaya yeten en küçük künye. */
export type AnalysisRef = { symbol: string; period: string; label: string };

/** Bir bülten — (gün, dönem). Dil bu anahtarda yok: iki dil aynı bülten. */
export type BriefRef = { date: string; period: string };

/** Bir mercek yazısı — adres ve okunacak başlık (Türkçe kayıttan). */
export type StoryRef = { slug: string; title: string };

export type ContentSummary = {
  /**
   * FARKLI bülten sayısı — (gün, dönem) çifti, iki dil TEK sayılır.
   *
   * "Bülten 124" yazıyordu (23 Eylül denetimi): `count()` dil satırlarını
   * sayıyordu (TR 63 + EN 61), yanındaki "Mercek Yazısı 98" ve "Bilanço
   * Analizi 41" ise farklı kaydı. Aynı sıradaki üç sayının biri iki kat
   * şişkindi.
   */
  briefs: number;
  dailyCount: number;
  weeklyCount: number;
  /** En yeni GÜNLÜK bültenin günü. Haftalık kayıt biten haftaya çapalı, eski duruyor. */
  briefsLatest: string | null;
  /**
   * İngilizcesi olmayan bültenler, en yeniden eskiye.
   *
   * Ekran bülten için hiç sormuyordu ve "Eksik yok." diyordu; 31 Temmuz ve
   * 3 Ağustos günlükleri yalnızca Türkçeydi (denetim, `?dil=` sayımları:
   * günlükte TR 54, EN 52).
   */
  briefsMissingEn: BriefRef[];
  storySlugs: number;
  /** Başlığıyla — liste ham slug basıyordu. */
  storiesMissingEn: StoryRef[];
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
  async function getContentSummary(): Promise<AdminResult<ContentSummary>> {
    return oku("getContentSummary", async () => {
      /* HEPSİ BAĞIMSIZ — sırayla beklenmelerinin bir sebebi yoktu.
       neon-http'de her sorgu ayrı bir HTTP gidiş-dönüşü; turlar bire indi. */
      const [[briefRow], briefGaps, storyRows, analysisRows] = await Promise.all([
        db
          .select({
            n: sql<number>`count(distinct (${dailyBriefs.briefDate}, ${dailyBriefs.period}))`,
            daily: sql<number>`count(distinct ${dailyBriefs.briefDate}) filter (where ${dailyBriefs.period} = 'daily')`,
            weekly: sql<number>`count(distinct ${dailyBriefs.briefDate}) filter (where ${dailyBriefs.period} = 'weekly')`,
            latest: sql<string | null>`max(${dailyBriefs.briefDate}) filter (where ${dailyBriefs.period} = 'daily')`,
          })
          .from(dailyBriefs),
        /* Tek sorgu, dilsiz gruplama: İngilizce satırı olmayan (gün, dönem). */
        db
          .select({ date: dailyBriefs.briefDate, period: dailyBriefs.period })
          .from(dailyBriefs)
          .groupBy(dailyBriefs.briefDate, dailyBriefs.period)
          .having(sql`count(*) filter (where ${dailyBriefs.locale} = 'en') = 0`)
          .orderBy(desc(dailyBriefs.briefDate)),
        db
          .select({ slug: stories.slug, locale: stories.locale, title: stories.title })
          .from(stories),
        /* GRAFİK DİZİLERİ ÇEKİLMİYOR, yalnızca DOLU MU diye soruluyor. İki
         `jsonb` sütunu (çeyreklik gelir ve öngörü) tek kullanım amacı
         `?.length > 0` kontrolüyken tamamen ağdan geçiyordu — altmış analiz
         × iki dil, yüzlerce kilobayt. Karar veritabanında veriliyor. */
        db
          .select({
            symbol: earningsAnalyses.symbol,
            period: earningsAnalyses.period,
            /* EKRANDA GÖRÜNEN DÖNEM ADI. `period` bir URL parçası
               ("4c-fy2026", şema yorumunda yazılı) ve eksik listelerine o
               basılıyordu; `period_label` tam bu iş için var, notNull ve
               her satırda dolu ("4Ç FY2026"). */
            periodLabel: earningsAnalyses.periodLabel,
            locale: earningsAnalyses.locale,
            hasCharts: sql<boolean>`
            coalesce(jsonb_array_length(${earningsAnalyses.quarterlyRevenue}), 0) > 0
            and coalesce(jsonb_array_length(${earningsAnalyses.guidance}), 0) > 0
          `,
          })
          .from(earningsAnalyses),
      ]);

      /* Başlık TÜRKÇE kayıttan: panel tek dilde (Yazılar listesinin kuralı,
         `getEditableStories`). Türkçe kaydı olmayan yazı İngilizce başlığıyla
         kalıyor — yine de slug'dan okunur. */
      const storyLocales = new Map<string, { locales: Set<string>; title: string }>();
      for (const row of storyRows) {
        const held = storyLocales.get(row.slug) ?? { locales: new Set<string>(), title: row.title };
        held.locales.add(row.locale);
        if (row.locale === "tr") held.title = row.title;
        storyLocales.set(row.slug, held);
      }

      const analysisLocales = new Map<string, Set<string>>();
      const analysisRefs = new Map<string, AnalysisRef>();
      const chartless = new Map<string, AnalysisRef>();
      for (const row of analysisRows) {
        /* ANAHTAR SLUG'DAN, ETİKET `period_label`DAN. İkisi ayrı: anahtar
           iki dilin aynı kaydını birleştiriyor, etiket okunacak metin.
           Etiketi anahtar yapmak, dile göre farklı yazılan bir alanın aynı
           kaydı ikiye bölmesi demekti. Türkçe satır geldiğinde etiket
           üzerine yazılıyor — panel yalnızca Türkçe. */
        const key = `${row.symbol} ${row.period}`;
        const ref: AnalysisRef = analysisRefs.get(key) ?? {
          symbol: row.symbol,
          period: row.period,
          label: `${row.symbol} ${row.periodLabel}`,
        };
        if (row.locale === "tr") {
          ref.label = `${row.symbol} ${row.periodLabel}`;
        }
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
        dailyCount: Number(briefRow?.daily ?? 0),
        weeklyCount: Number(briefRow?.weekly ?? 0),
        briefsLatest: briefRow?.latest ?? null,
        briefsMissingEn: briefGaps.map((row) => ({ date: row.date, period: row.period })),
        storySlugs: storyLocales.size,
        storiesMissingEn: [...storyLocales]
          .filter(([, held]) => !held.locales.has("en"))
          .map(([slug, held]) => ({ slug, title: held.title })),
        analyses: analysisLocales.size,
        analysesMissingEn: [...analysisLocales]
          .filter(([, locales]) => !locales.has("en"))
          .map(([key]) => analysisRefs.get(key))
          .filter((ref): ref is AnalysisRef => ref !== undefined),
        analysesWithoutCharts: [...chartless.values()],
      };
    });
  },
);

/**
 * Listede bir BÜLTEN — iki dilin satırı tek kayıtta.
 *
 * DİL BAŞINA SATIR DEĞİL (23 Eylül denetimi). Liste her dili ayrı satır
 * basıyordu: yirmi dört satır ancak on iki günü kapsıyordu, "Yazan" 24/24
 * "Rutin", "Dönem" 22/24 "Günlük"tü ve on iki çiftin on ikisinde EN, TR'nin
 * önündeydi (EN sonra yazılıyor, sıralama `generated_at desc`). Kardeş
 * sekme Mercek zaten yazı başına tek satır ve TR/EN rozeti kullanıyordu.
 */
export type BriefItem = {
  briefDate: string;
  period: string;
  /**
   * OKURUN GÖRDÜĞÜ GÜN — sıralama anahtarı. Günlükte kendi günü; haftalıkta
   * çapa + 7, çünkü kayıt biten haftanın pazartesisine çapalı ve bir hafta
   * sonra yazılıyor. Çapaya göre sıralanınca 21 Eylül'de yazılan bülten
   * listede "7 Gün Önce" ile "8 Gün Önce" satırlarının arasına düşüyordu.
   */
  publishedOn: string;
  /** Türkçe manşet; Türkçe satır yoksa İngilizcesi. */
  headline: string;
  /** Satırı olan diller, TR önce — "tr", "en". */
  locales: string[];
  /** En son yazılan satırın künyesi. */
  generatedBy: string;
  /** En son yazılan satırın anı. */
  generatedAt: Date;
  /** Panelden en az bir kez düzeltildi mi (`getAdminEditedKeys`). */
  elden: boolean;
};

/**
 * Son bültenler — okurun gördüğü güne göre en yeniden eskiye.
 *
 * SÜZGEÇ ŞART, SÜS DEĞİL: liste iki dönemi birlikte taşıyor ve haftalık
 * bülten haftada bir yazıldığı için süzgeçsiz bir pencerede kaybolabiliyor.
 *
 * DİL SÜZGECİ GRUBU SEÇER, SATIRI ELEMEZ: `dil=en` İngilizce satırı OLAN
 * bültenleri verir, iki diliyle. Süzgeç bir dönem `where` ile satırları
 * gruplamadan önce eliyordu ve `dil=en` görünümünde her bültenin dil
 * listesi yalnızca "en", manşeti İngilizceydi — TR kaydı olsa da; liste
 * "TR Eksik" rozetini o görünümde gizlemek zorunda kalıyordu. Şimdi
 * `having bool_or(...)`: grup bütün satırlarıyla kuruluyor, süzgeç grubun
 * o dili taşıyıp taşımadığına bakıyor. Sayım aynı soruyu soruyor — o dilde
 * satırı olan farklı bülten sayısı — ve orada `where` doğru cevap.
 *
 * TOPLAM DA DÖNÜYOR. Kırpılmış bir liste, kaç kaydın dışarıda kaldığını
 * söylemediği sürece "hepsi bu" diye okunuyor; toplam FARKLI bülten
 * sayısı — İçerik ekranının "Bülten" kutusuyla aynı tanım.
 */
export async function getRecentBriefs(
  limit = 14,
  filters: { period?: string; locale?: string; date?: string } = {},
): Promise<AdminResult<{ items: BriefItem[]; total: number }>> {
  return oku("getRecentBriefs", async () => {
    const kosullar = [
      filters.period ? eq(dailyBriefs.period, filters.period) : undefined,
      filters.date ? eq(dailyBriefs.briefDate, filters.date) : undefined,
    ].filter(Boolean);
    const where = kosullar.length > 0 ? and(...kosullar) : undefined;
    const dilli = filters.locale ? eq(dailyBriefs.locale, filters.locale) : undefined;

    /* TR ÖNCE — Mercek listesinin "SIRA SABİT" kuralı. */
    const trOnce = sql`case when ${dailyBriefs.locale} = 'tr' then 0 else 1 end`;
    const yayinGunu = sql`case when ${dailyBriefs.period} = 'weekly' then ${dailyBriefs.briefDate} + 7 else ${dailyBriefs.briefDate} end`;

    const [rows, [sayim], elden] = await Promise.all([
      db
        .select({
          briefDate: dailyBriefs.briefDate,
          period: dailyBriefs.period,
          locales: sql<string>`string_agg(${dailyBriefs.locale}, ',' order by ${trOnce})`,
          headline: sql<string>`(array_agg(${dailyBriefs.headline} order by ${trOnce}))[1]`,
          generatedBy: sql<string>`(array_agg(${dailyBriefs.generatedBy} order by ${dailyBriefs.generatedAt} desc))[1]`,
          generatedAt: sql<string>`max(${dailyBriefs.generatedAt})`,
        })
        .from(dailyBriefs)
        .where(where)
        .groupBy(dailyBriefs.briefDate, dailyBriefs.period)
        .having(dilli ? sql`bool_or(${dilli})` : undefined)
        /* Aynı yayın gününde (pazartesi) günlük 16:10'da, haftalık 09:30'da
           yazılıyor: son yazılan üstte. */
        .orderBy(desc(yayinGunu), desc(sql`max(${dailyBriefs.generatedAt})`))
        .limit(limit),
      db
        .select({
          n: sql<number>`count(distinct (${dailyBriefs.briefDate}, ${dailyBriefs.period}))`,
        })
        .from(dailyBriefs)
        .where(dilli ? and(where, dilli) : where),
      getAdminEditedKeys(),
    ]);

    const items = rows.map((row) => ({
      briefDate: row.briefDate,
      period: row.period,
      publishedOn: row.period === "weekly" ? addEtDays(row.briefDate, 7) : row.briefDate,
      headline: row.headline,
      locales: row.locales.split(","),
      generatedBy: row.generatedBy,
      generatedAt: new Date(row.generatedAt),
      elden: elden.has(
        briefRevisionKey(row.briefDate, row.period === "weekly" ? "weekly" : "daily"),
      ),
    }));
    return { items, total: Number(sayim?.n ?? items.length) };
  });
}

/**
 * Arşivin ilk ve son bülten günü — tarih seçicinin `min`/`max` sınırı.
 *
 * SINIR ARŞİVDEN GELİYOR, takvimden değil: veri olmayan bir güne izin veren
 * bir seçici, kullanıcıyı boş bir listeye götüren bir düğmedir.
 */
export async function getBriefDateRange(): Promise<
  AdminResult<{ first: string | null; last: string | null }>
> {
  return oku("getBriefDateRange", async () => {
    const [row] = await db
      .select({
        first: sql<string | null>`min(${dailyBriefs.briefDate})`,
        last: sql<string | null>`max(${dailyBriefs.briefDate})`,
      })
      .from(dailyBriefs);
    return { first: row?.first ?? null, last: row?.last ?? null };
  });
}

/* --------------------------------------------------------------------------
   Düzenlenebilir içerik
   -------------------------------------------------------------------------- */

export type EditableStory = {
  slug: string;
  title: string;
  eventDate: string;
  /**
   * İLK YAYIN ANI — listenin sıralama anahtarı.
   *
   * Liste `published_at`e göre sıralanıyor ama ekranda `event_date`
   * yazıyordu: künye "en yeniden eskiye" diye söz verirken görünen sütun
   * aşağı doğru bir artıp bir azalıyordu. Aynı ekranda iki farklı zaman
   * ölçüsü, biri sıralamayı öteki metni yönetince liste bozuk görünüyor.
   * Sıralama neyse görünen de o.
   */
  publishedAt: Date | null;
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
export async function getEditableStories(
  limit = 40,
  filters: { search?: string } = {},
): Promise<AdminResult<{ rows: EditableStory[]; total: number }>> {
  return oku("getEditableStories", async () => {
    /* ARAMA HEM BAŞLIKTA HEM SLUG'DA. Slug ASCII kebab olduğu için Türkçe
       büyük/küçük harf tuzağından bağışık; başlık aramasını `ilike`
       yapıyoruz ve bunun bilinen bir sınırı var — Postgres'in harf küçültmesi
       veritabanının derlemesine bağlı ve "İ" ile "ı" beklendiği gibi
       eşleşmeyebiliyor. Aranan sözcük genelde bir şirket adı ("nvidia",
       "gümrük") ve orada sorun çıkmıyor; çıktığında slug dalı yakalıyor. */
    const aranan = filters.search?.trim();
    const where = aranan
      ? or(
          ilike(stories.title, `%${aranan}%`),
          ilike(stories.slug, `%${aranan}%`),
        )
      : undefined;

    const [rows, [sayim]] = await Promise.all([
      db
        .select({
          slug: stories.slug,
          locale: stories.locale,
          title: stories.title,
          eventDate: stories.eventDate,
          updatedAt: stories.updatedAt,
          publishedAt: stories.publishedAt,
        })
        .from(stories)
        .where(where)
        .orderBy(desc(stories.publishedAt))
        .limit(limit * 2),
      db
        .select({ n: countDistinct(stories.slug) })
        .from(stories)
        .where(where),
    ]);

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
          /* Sorgu `published_at` azalan sırada geliyor, yani slug'ın İLK
             görülen satırı en yeni yayını taşıyor. */
          publishedAt: row.publishedAt,
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
    return {
      rows: [...bySlug.values()].slice(0, limit),
      total: Number(sayim?.n ?? bySlug.size),
    };
  });
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
 *
 * Okunamazsa BOŞ küme ve bu bilinçli: bir rozetin eksikliği bir sayının
 * sıfırlanması gibi yanıltmıyor. Hata yine günlüğe düşüyor.
 */
export const getAdminEditedKeys = cache(
  async function getAdminEditedKeys(): Promise<Set<string>> {
    try {
      const rows = await db
        .selectDistinct({ slug: storyRevisions.slug })
        .from(storyRevisions)
        .where(eq(storyRevisions.replacedBy, "admin"));
      return new Set(rows.map((row) => row.slug));
    } catch (error) {
      yutuldu("getAdminEditedKeys", error);
      return new Set();
    }
  },
);

/**
 * Yazılar sekmelerinin yanındaki sayılar.
 *
 * LİSTENİN UZUNLUĞU DEĞİL, ARŞİVİN BÜYÜKLÜĞÜ. Sekme "kaç mercek yazısı var"
 * sorusunu cevaplıyor; listeler kırpılmış ve süzgeçli olduğu için oradaki
 * satır sayısı bu soruya yanlış cevap verirdi. Bülten FARKLI bülten
 * (gün, dönem) — İçerik ekranıyla aynı tanım; dil satırı sayılınca "124"
 * yazıyordu, bülten 63'tü.
 *
 * İKİ SAYIM, tek `cache()`: iki sekme de aynı sayfada duruyor ve ikisi de
 * bu değeri okuyor.
 */
export const getWritingCounts = cache(
  async function getWritingCounts(): Promise<
    AdminResult<{ stories: number; briefs: number }>
  > {
    return oku("getWritingCounts", async () => {
      const [[s], [b]] = await Promise.all([
        db.select({ n: countDistinct(stories.slug) }).from(stories),
        db
          .select({
            n: sql<number>`count(distinct (${dailyBriefs.briefDate}, ${dailyBriefs.period}))`,
          })
          .from(dailyBriefs),
      ]);
      return { stories: Number(s?.n ?? 0), briefs: Number(b?.n ?? 0) };
    });
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
  /**
   * Günlük bültenin o günkü hâli — rutin HER GÜN yazıyor, hafta sonu dahil.
   *
   * `written` yazıldı · `missed` geçmiş bir gün, beklenirken yazılmadı ·
   * `late` bugünün 16:10 TR'si pay ile geçti, kayıt yok · `pending` henüz
   * beklenmiyor ya da pay içinde.
   *
   * GECİKME BUGÜN GÖRÜNÜYOR (23 Eylül denetimi). Bugünün hücresi ET günü
   * bitene kadar nötr kalıyordu ("bugün · gün sürüyor"): 16:10 TR'de
   * düşen bir koşum ertesi sabah 07:00 TR'ye kadar, on beş saat boyunca
   * hiçbir işaret vermiyordu.
   */
  dailyState: "written" | "missed" | "late" | "pending";
  /**
   * O PAZARTESİ yazılan haftalık bülten (biten haftanın kaydı) var mı.
   *
   * İŞARET YAZILDIĞI GÜNDE (23 Eylül denetimi). Kayıt biten haftanın
   * pazartesisine çapalı ve işaret çapanın hücresine düşüyordu: 14 Eylül
   * hücresi "haftalık bülten de bu güne yazıldı" diyordu, oysa o kayıt
   * 21 Eylül'de yazıldı ve 21'in hücresi boştu. İşaret artık çapa + 7'de.
   */
  weekly: boolean;
  /** Pazartesi 09:30 TR pay ile geçti, biten haftanın kaydı yok. */
  weeklyMissing: boolean;
  /** O gün yayımlanan FARKLI mercek yazısı sayısı. */
  stories: number;
  /** O gün yayımlanan FARKLI bilanço analizi sayısı. */
  analyses: number;
  /**
   * Hafta sonu ya da NYSE tatili. BÜLTEN İÇİN ANLAMI YOK (rutin her gün
   * yazıyor); bilanço şeridinde boş hücrenin neden boş olduğunu söylüyor.
   */
  offDay: boolean;
  /** Bugün (ET) — gün henüz bitmedi. */
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
 * saate düşmesin. BEKLENTİ ise TR saatiyle (16:10) — kural
 * lib/routine-schedule.ts'te, Sistem sayfasıyla aynı yerden.
 *
 * BÜLTEN HAFTA SONU DA BEKLENİYOR. Bu yorum bir dönem "piyasa kapalıysa o
 * gün için yazı yazma" kuralını rutinin kuralı diye yazıyordu ve hafta
 * sonu hücreleri hiçbir zaman kırmızı olamıyordu. Kural yalnızca geriye
 * dönük doldurma promptunda (docs/claude-rutinler.md); rutin tablosu "her
 * gün 16:10 TR" diyor ve ölçüldü: 03 Ağu–23 Eyl arası 52 günün 52'si hafta
 * sonu dahil yazılmış. Kaçırılan bir cumartesi artık kırmızı.
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
  /**
   * Arşivdeki EN ESKİ GÜNLÜK bülten — tarih seçicinin alt sınırı.
   * Seçici günlük bülteni açıyor; en eski HAFTALIK çapa (20 Tem) sınır
   * olunca günlükleri 31 Tem'de başlayan arşivde on bir boş gün seçilebiliyordu.
   */
  firstBriefDay: string | null;
};

/* `cache()`: İçerik ekranı ritmi iki ayrı Suspense sınırından okuyor
   ("Yazılmamış Bülten" satırı ve ızgara aynı günleri sayıyor). Sarmal bir
   dönem sayfanın kendisindeydi (`app/admin/icerik/page.tsx`); okuyucunun
   yanında olunca ritmi soran her yeni sınır beş sorguyu ikinci kez
   göndermiyor. */
export const getPublishRhythm = cache(async function getPublishRhythm(
  weeks = 8,
): Promise<AdminResult<PublishRhythm>> {
  const now = new Date();
  const today = todayEt(now);
  /* Izgara PAZARTESİ başlıyor: haftalık bülten pazartesi yazılıyor ve
     satır başı ile o gün aynı hücreye düşmezse okuma bozulur. */
  const sonPazartesi = weekAnchor(today);
  const ilkGun = addEtDays(sonPazartesi, -7 * (weeks - 1));
  const pay = ROUTINE_GRACE_MINUTES * 60_000;

  return oku("getPublishRhythm", async () => {
    const [briefRows, storyRows, analysisRows, holidays, firstRow] =
      await Promise.all([
        db
          .select({ day: dailyBriefs.briefDate, period: dailyBriefs.period })
          .from(dailyBriefs)
          /* Bir hafta geriden: ilk pazartesinin işareti bir önceki haftanın
             çapasından geliyor. */
          .where(gte(dailyBriefs.briefDate, addEtDays(ilkGun, -7)))
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
          .from(dailyBriefs)
          .where(eq(dailyBriefs.period, "daily")),
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
    const beklenen = expectedDailyBrief(now);

    const out: PublishDay[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const day = addEtDays(ilkGun, i);
      const gun = etWeekday(day);
      const yazildi = daily.has(day);
      const dailyState: PublishDay["dailyState"] = yazildi
        ? "written"
        : day > beklenen || now.getTime() < dailyBriefDueAt(day).getTime() + pay
          ? "pending"
          : day === today
            ? "late"
            : "missed";
      /* Pazartesi hücresi biten haftanın kaydını taşıyor: çapa bir hafta
         geride. */
      const capa = addEtDays(day, -7);
      const pazartesi = gun === 1;
      out.push({
        day,
        daily: yazildi,
        dailyState,
        weekly: pazartesi && weekly.has(capa),
        weeklyMissing:
          pazartesi &&
          !weekly.has(capa) &&
          now.getTime() >= weeklyBriefDueAt(capa).getTime() + pay,
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
  });
});

/* --------------------------------------------------------------------------
   Veri sağlığı
   -------------------------------------------------------------------------- */

export type HealthCheck = {
  label: string;
  /* Satır hangi listeye ait. Sistem sayfası panelleri buna göre çiziyor ve
     ayrım bir dönem `label.endsWith("anahtarı")` ile yapılıyordu: etiketin
     sonundaki bir kelime görünmez bir protokole dönüşmüştü, etiketi
     düzeltmek listeyi bozuyordu.

     "routine" grubu, sitenin yazılı içeriğini üreten beş claude.ai
     rutininin nabzı — kodun DIŞINDA koşan ve panelin bugüne kadar hiç
     sormadığı şey. */
  group: "data" | "key" | "routine";
  /** Ekranda basılan değer — "29 Gün İleri", "4 Saat Önce". */
  value: string;
  /**
   * "ok" yeşil, "warn" sarı, "down" kırmızı, "idle" nötr, "info" yargısız
   * (koşullu rutin: yazmaması da doğru davranış olabilir).
   */
  tone: HealthTone;
  /**
   * Durum sözcüğü tonun varsayılanından farklıysa — "Planlı Değil".
   * `idle` tek başına "Beklemede" diyor; hafta sonu hiçbir şey beklenmiyor.
   */
  status?: string;
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
 *
 * NOTLAR KÜNYE, CÜMLE DEĞİL (23 Eylül denetimi): "en uzak kayıt
 * 2026-10-22", "çevrilmemiş başlık: 24034" küçük harfle, ham ISO tarihle
 * ve binlik ayırıcısız basılıyordu; yanındaki değerler Title Case'ti.
 * Künyeler artık Title Case, sayılar tr-TR, tarihler okunur. Yalnızca
 * gerçekten cümle olan iki not (koşullu rutinler) cümle düzeninde.
 */
/* `cache()`: aynı istekte iki ayrı Suspense sınırı bunu çağırıyor —
   /admin/sistem'de hem üstteki nabız kutusu hem aşağıdaki liste. Sarmalsız
   bırakılırsa bütün yoklamalar iki kez koşuyor ve hepsi ağ ya da
   veritabanı turu. */
export const getHealthChecks = cache(async function getHealthChecks(): Promise<
  HealthCheck[]
> {
  const now = new Date();
  const today = todayEt(now);
  const checks: HealthCheck[] = [];

  /* YOKLAMALAR PARALEL. Hepsi birbirinden bağımsızdı ama ardışık `await`
     ile bekleniyordu ve neon-http'de her sorgu ayrı bir HTTP gidiş-dönüşü:
     her tur sistem sayfasının ilk baytına doğrudan biniyordu. Sonuçlar
     `allSettled` ile toplanıyor — biri düşerse yalnızca o satır "okunamadı"
     gösteriyor, diğerleri eskisi gibi yerinde. */
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
    /* Ölçüm aralığı da buraya alındı: ardışık beklendiğinde neon-http'de
       fazladan bir tam gidiş-dönüş demekti. */
    getTrackingRange(),
    /* TEKNİK RUTİN HİÇ SORULMUYORDU (23 Eylül denetimi) — günde üç koşan,
       rutinlerin en sıkı. Durduğunda /teknik bayatlıyor ve bu sayfa hiçbir
       şey demiyordu. En yeni yayın gününün slotları yeterli: borçlu nöbet
       o günden eskiyse zaten kapanmış. */
    db
      .select({
        sessionDate: technicalAnalyses.sessionDate,
        slots: sql<string>`string_agg(distinct ${technicalAnalyses.slot}, ',')`,
        wrote: sql<string>`max(greatest(${technicalAnalyses.publishedAt}, ${technicalAnalyses.updatedAt}))`,
      })
      .from(technicalAnalyses)
      .groupBy(technicalAnalyses.sessionDate)
      .orderBy(desc(technicalAnalyses.sessionDate))
      .limit(1),
    getHolidays(),
  ]);

  /* Düşen sorgu fırlatır ve aşağıdaki blokların kendi `catch`i onu
     "okunamadı" satırına çevirir. */
  function unwrap<T>(result: PromiseSettledResult<T>): T {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  }

  /* ---- Sağlayıcı anahtarları ----
     YALNIZCA ZORUNLU ANAHTARLAR (23 Eylül denetimi). Listede Anthropic
     vardı ve panonun TEK kırmızı satırı oydu: "Anthropic · Sorunlu ·
     ilgili kartlar veri alamaz". Oysa anahtar isteğe bağlı (.env.example
     onu "Opsiyonel" altında sayıyor) ve yalnızca haber çevirisinin YEDEĞİ
     (lib/translate.ts: önce DeepL, sonra Claude, sonra hiçbiri); asıl
     çeviri anahtarı DeepL ise hiç sorulmuyordu. Çeviri aşağıda kendi
     satırında, hangi arka ucun çalıştığını söyleyerek. */
  const keys: [string, string | undefined][] = [
    ["Alpaca", process.env.ALPACA_API_KEY_ID],
    ["Finnhub", process.env.FINNHUB_API_KEY],
    ["FRED", process.env.FRED_API_KEY],
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
         dışında, başlıksız listeliyor ve orada yalnızca "Finnhub" yazması
         neyin eksik olduğunu söylemiyordu. */
      note: value
        ? "Ortam Değişkeni Dolu"
        : "Anahtar Eksik · İlgili Kartlar Veri Alamaz",
    });
  }

  /* ---- Haber çevirisi ----
     Çevrilmemiş başlık sayısı bir dönem Haber Akışı'nın notundaydı ve
     "Sağlıklı" bir satırın altında 24.082 duruyordu; sayı çevirinin
     satırına ait. Tabloya hisse sayfası da yazıyor ve çeviri yalnızca en
     yeni kırk başlığı alıyor (lib/translate.ts), yani birikmiş sayı tek
     başına arıza değil — ton arka uçtan geliyor, sayı künye. */
  {
    const backend = activeTranslateBackend();
    let bekleyen: string | null = null;
    try {
      bekleyen = `Çevrilmemiş Başlık ${unwrap(probes[2]).untranslated.toLocaleString("tr-TR")}`;
    } catch {
      bekleyen = null;
    }
    const kaynak =
      backend === "deepl"
        ? "DeepL Anahtarı Tanımlı"
        : backend === "claude"
          ? "DeepL Yok · Claude Yedeği Çalışıyor"
          : "Çeviri Kapalı · Başlıklar İngilizce Kalıyor";
    checks.push({
      label: "Haber Çevirisi",
      group: "key",
      value: backend === "deepl" ? "DeepL" : backend === "claude" ? "Claude (Yedek)" : "Kapalı",
      tone: backend ? "ok" : "warn",
      note: bekleyen ? `${kaynak} · ${bekleyen}` : kaynak,
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
      note: row?.furthest
        ? `En Uzak Kayıt ${adminDayIn(row.furthest, today)}`
        : "Takvimde Kayıt Yok",
    });
  } catch {
    checks.push(failed("Bilanço Takvimi", "data"));
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
      note: "Yüksek Önemli Olayların En Uzağı",
    });
  } catch {
    checks.push(failed("Ekonomik Takvim", "data"));
  }

  /* ---- Haber akışı ----
     YALNIZCA SENKRONUN YAZDIĞI SATIRLAR (23 Eylül denetimi). Damga
     `max(fetched_at)`tı ve tabloya iki yazan var: senkron ve hisse sayfası
     (şirket haberleri görüntülendiği anda tabloya işleniyor,
     app/(app)/hisse/[symbol]/page.tsx). Senkron daha koşmamışken satır
     "0 Saat Önce · Sağlıklı" diyordu — bir okurun hisse sayfasını açması
     yetiyordu. Ölçü `newsPulse`ta. EŞİK TAKVİMDEN: son koşumdan (hafta
     sonu cumadan) beri çekim var mı; sabit "30 saat" pazartesi sabahı
     yanlış alarm verirdi. */
  try {
    const pulse = unwrap(probes[2]);
    checks.push({
      label: "Haber Akışı",
      group: "data",
      value: pulse.latest ? agoLabel(pulse.latest, now) : "Kayıt Yok",
      tone:
        pulse.latest === null ? "down" : pulse.latest >= lastCronDue(now) ? "ok" : "warn",
      note: pulse.latest
        ? `Genel Akış · Son Çekim ${adminStamp(pulse.latest, now)}`
        : "Genel Akışta Kayıt Yok",
    });
  } catch {
    checks.push(failed("Haber Akışı", "data"));
  }

  /* ---- Sembol profilleri ---- */
  try {
    const [row] = unwrap(probes[3]);
    const stalestHours = hoursSince(row?.stalest ?? null, now);
    const days = stalestHours === null ? null : Math.floor(stalestHours / 24);
    const total = Number(row?.total ?? 0).toLocaleString("tr-TR");
    const noCap = Number(row?.noCap ?? 0).toLocaleString("tr-TR");
    checks.push({
      label: "Sembol Profilleri",
      group: "data",
      value: days === null ? "Profil Yok" : `${days} Gün`,
      /* Cron günde 60 profil tazeliyor; ~700 sembollük evren 12 günde bir
         tur atıyor. 20 günü aşan bir kayıt turun aksadığını gösterir. */
      tone: days === null ? "idle" : days <= 20 ? "ok" : "warn",
      note:
        days === null
          ? "Profil Tablosu Boş"
          : `En Eski Profilin Yaşı · ${total} Kayıt · Piyasa Değeri Boş: ${noCap}`,
    });
  } catch {
    checks.push(failed("Sembol Profilleri", "data"));
  }

  /* ---- Makro seriler ----
     "0 Gün Önce" yazıyordu (23 Eylül denetimi) — eksik veri gibi okunuyor.
     Değer artık okunur ("Bugün Güncellendi", "Dün"); eşik de takvimden:
     bir koşum kaçabilir (FRED tek bir seriyi o gün vermeyebilir, aylık
     serilerde bir günlük gecikme okura bir şey kaybettirmiyor), iki koşum
     kaçtıysa dikkat. */
  try {
    const [row] = unwrap(probes[4]);
    const stalest = row?.stalest ? new Date(row.stalest) : null;
    const sonKosum = lastCronDue(now);
    const oncekiKosum = lastCronDue(new Date(sonKosum.getTime() - 1));
    checks.push({
      label: "Makro Seriler",
      group: "data",
      value:
        stalest === null
          ? "Kayıt Yok"
          : trDateOf(stalest) === trDateOf(now)
            ? "Bugün Güncellendi"
            : agoLabel(stalest, now),
      tone: stalest === null ? "down" : stalest >= oncekiKosum ? "ok" : "warn",
      note: "En Uzun Süredir Güncellenmeyen Seri",
    });
  } catch {
    checks.push(failed("Makro Seriler", "data"));
  }

  /* ---- Rutinler ----
     Sitenin yazılı içeriğinin TAMAMINI kod dışında, claude.ai üzerinde
     kurulu beş rutin üretiyor (docs/claude-rutinler.md; altıncısı yaz
     saati nöbetçisi, içerik yazmıyor). Panel bugüne kadar yalnızca SONUCU
     sayıyordu — kaç bülten, kaç yazı — ama üretimin kendisini hiç
     sormuyordu: bir rutin askıya alındığında bunu fark etmenin tek yolu
     siteye çıkıp bültenin tarihine bakmaktı.

     EŞİK HER RUTİNİN KENDİ DOĞASINA GÖRE. Tek eşik yanlış alarm üretirdi:
     bülten her gün yazılıyor ve yazılmaması bir arıza; mercek ise koşullu —
     rutinin kendi yönergesi "sıradan bir seans mercek konusu değildir"
     diyor, yani çoğu gün hiçbir şey yazmaması NORMAL. Ona eşik koymak
     uydurma alarm olurdu; o satır yalnızca son yazma anını söylüyor.

     BEKLENTİ TEK YERDE: lib/routine-schedule.ts. Saatler oradan da
     `BRIEF_PUBLISH_TR` ve teknik slotlardan geliyor — rutin saatlerini koda
     ikinci kez yazmak docs/claude-rutinler.md ile ayrışan bir sayı
     doğururdu. */
  try {
    const rows = unwrap(probes[5]);
    const bulten = new Map(rows.map((r) => [r.period, r]));

    const gunluk = bulten.get("daily");
    const gunlukSon = gunluk?.latest ?? null;
    const gunlukSaat = BRIEF_PUBLISH_TR.daily;
    const gunlukDurum = dailyBriefState(gunlukSon, now);
    const bugunYazildi = gunlukSon === trDateOf(now);
    checks.push({
      label: "Günlük Bülten",
      group: "routine",
      value:
        gunlukDurum.state === "ok"
          ? bugunYazildi
            ? "Bugün Yazıldı"
            : "Dün Yazıldı"
          : gunlukDurum.state === "waiting"
            ? "Bekleniyor"
            : "Gecikti",
      tone:
        gunlukDurum.state === "ok" ? "ok" : gunlukDurum.state === "waiting" ? "idle" : "warn",
      note:
        gunlukDurum.state === "ok"
          ? bugunYazildi
            ? `Son Yazma ${stampOf(gunluk?.wrote ?? null, now)}`
            : `Sıradaki Bugün ${gunlukSaat} TR`
          : gunlukDurum.state === "waiting"
            ? `${gunlukSaat} TR · ${ROUTINE_GRACE_MINUTES} Dakika Pay`
            : `Son Kayıt ${gunlukSon ? adminDay(gunlukSon) : "Yok"} · Beklenen ${adminDay(gunlukDurum.expected)} ${gunlukSaat} TR`,
    });

    const haftalik = bulten.get("weekly");
    const haftalikSon = haftalik?.latest ?? null;
    const haftalikSaat = BRIEF_PUBLISH_TR.weekly;
    const haftalikDurum = weeklyBriefState(haftalikSon, now);
    checks.push({
      label: "Haftalık Bülten",
      group: "routine",
      value:
        haftalikDurum.state === "ok"
          ? "Yazıldı"
          : haftalikDurum.state === "waiting"
            ? "Bekleniyor"
            : "Gecikti",
      tone:
        haftalikDurum.state === "ok" ? "ok" : haftalikDurum.state === "waiting" ? "idle" : "warn",
      note:
        haftalikDurum.state === "ok" && haftalikSon
          ? `${adminWeekRange(haftalikSon)} · Son Yazma ${stampOf(haftalik?.wrote ?? null, now)}`
          : haftalikDurum.state === "waiting"
            ? `Pazartesi ${haftalikSaat} TR · ${ROUTINE_GRACE_MINUTES} Dakika Pay`
            : `${adminWeekRange(haftalikDurum.expected)} Eksik · Pazartesi ${haftalikSaat} TR`,
    });
  } catch {
    /* Okunamayan rutin RUTİNLER listesinde kalıyor: `failed` bir dönem
       grubu hep "data" yazıyordu ve bu satırlar Veri Sağlığı'na göçüp
       Rutinler panelini boş bırakıyordu. */
    checks.push(failed("Günlük Bülten", "routine"));
    checks.push(failed("Haftalık Bülten", "routine"));
  }

  /* ---- Teknik analiz ---- */
  try {
    const [latest] = unwrap(probes[9]);
    const holidays = unwrap(probes[10]);
    const slots = latest ? latest.slots.split(",").filter(isTechnicalSlot) : [];
    const sonSlot = slots.sort((a, b) => SLOT_RANK[a] - SLOT_RANK[b]).at(-1) ?? null;
    const durum = technicalState(
      latest ? { sessionDate: latest.sessionDate, slots } : null,
      now,
      holidays,
    );
    const sonYayin =
      latest && sonSlot ? `${adminDay(latest.sessionDate)} ${SLOT_AD[sonSlot]}` : "Kayıt Yok";
    if (durum.state === "notScheduled") {
      checks.push({
        label: "Teknik Analiz",
        group: "routine",
        value: sonYayin,
        tone: "idle",
        status: "Planlı Değil",
        note: "Hafta Sonu ve Tatilde Koşmaz · Değer Son Yayın",
      });
    } else if (durum.state === "ok") {
      checks.push({
        label: "Teknik Analiz",
        group: "routine",
        value: sonSlot ? `${SLOT_AD[sonSlot]} Yazıldı` : "Yazıldı",
        tone: "ok",
        note: `Son Yayın ${stampOf(latest?.wrote ?? null, now)}`,
      });
    } else {
      const borc = durum.due;
      const nobet = borc
        ? `${borc.sessionDate === today ? "" : `${adminDay(borc.sessionDate)} `}${SLOT_AD[borc.slot]} ${formatInZone(slotInstant(borc.sessionDate, borc.slot), TR_ZONE)} TR`
        : "Son Nöbet";
      checks.push({
        label: "Teknik Analiz",
        group: "routine",
        value: "Gecikti",
        tone: "warn",
        note: `${nobet} Nöbeti Yazılmadı · Son Yayın ${sonYayin}`,
      });
    }
  } catch {
    checks.push(failed("Teknik Analiz", "routine"));
  }

  /* Mercek ve analiz YARGI VERMEZ. İkisi de koşullu rutin: yazacak bir şey
     yoksa yazmamak doğru davranış. Satırlar yalnızca son yazma anını
     söylüyor — yönetici o sayıya bakıp kendi kararını veriyor. Ton `info`
     ("Koşullu"): `idle` "Beklemede" diyordu, oysa beklenen bir şey yok.
     Notlar gerçekten cümle, o yüzden cümle düzeninde. */
  for (const [etiket, indeks, not] of [
    ["Mercek Yazısı", 6, "Koşullu rutin: anlatmaya değer olay yoksa yazmaz."],
    ["Bilanço Analizi", 7, "Koşullu rutin: aday çeyrek yoksa yazmaz."],
  ] as const) {
    try {
      const [row] = unwrap(probes[indeks]);
      checks.push({
        label: etiket,
        group: "routine",
        value: row?.latest ? agoText(row.latest, now) : "Kayıt Yok",
        tone: "info",
        note: not,
      });
    } catch {
      checks.push(failed(etiket, "routine"));
    }
  }

  /* ---- Ölçüm ---- */
  try {
    const range = unwrap(probes[8]);
    if (!range.ok) throw new Error("olcum okunamadi");
    checks.push({
      label: "Sayfa Ölçümü",
      group: "data",
      value: `${range.data.rows.toLocaleString("tr-TR")} Kayıt`,
      tone: range.data.rows > 0 ? "ok" : "idle",
      note: range.data.firstDay
        ? `İlk Kayıt ${adminDayYear(range.data.firstDay)} · 180 Günde Silinir`
        : "Henüz Kayıt Yok · İlk Ziyaretle Başlar",
    });
  } catch {
    checks.push(failed("Sayfa Ölçümü", "data"));
  }

  return checks;
});

/** Teknik nöbetlerin adı — sitenin kendi sözlüğünden, ikinci bir yazım yok. */
const SLOT_AD: Record<TechnicalSlot, string> = {
  premarket: trDictionary.technical.slotPremarket,
  midsession: trDictionary.technical.slotMidsession,
  lateday: trDictionary.technical.slotLateday,
};

/** Okunamayan satır — ÇAĞIRANIN grubunda kalır (bkz. rutin bloğu). */
function failed(label: string, group: HealthCheck["group"]): HealthCheck {
  return {
    label,
    group,
    value: "Okunamadı",
    tone: "down",
    note: "Veritabanı Sorgusu Başarısız",
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
function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "4 Saat Önce" — sorgudan Date ya da ISO dize gelebiliyor, ikisini de alır. */
function agoText(value: Date | string | null, now: Date): string {
  const d = toDate(value);
  return d ? agoLabel(d, now) : "Hiç";
}

/** "Bugün 16:12" — damga İstanbul saatiyle (`adminStamp`). */
function stampOf(value: Date | string | null, now: Date): string {
  const d = toDate(value);
  return d ? adminStamp(d, now) : "Bilinmiyor";
}

function hoursSince(value: Date | string | null, now: Date): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 3_600_000));
}

/* --------------------------------------------------------------------------
   Cron durumu
   -------------------------------------------------------------------------- */

/**
 * Haber akışının SENKRONDAN gelen son çekimi ve çevrilmemiş başlık sayısı.
 *
 * GENEL AKIŞ, ŞİRKET HABERİ DEĞİL. Senkron iki adımda yazıyor: genel akış
 * (sağlayıcının kategorisiyle, "company" dışı) ve büyük şirketlerin
 * haberleri ("company"). Hisse sayfası da şirket haberini görüntülendiği
 * anda tabloya işliyor — o satırlar senkronun izi değil. Genel akışı
 * yalnızca senkron yazıyor; tazelik ondan okunuyor.
 *
 * `cache()` — sistem sayfası bu sayıyı iki satırda kullanıyor (Haber
 * Akışı ve Haber Çevirisi); aynı sorgu iki HTTP gidiş-dönüşü demekti ve
 * ikisi ayrı anlarda okunduğu için farklı cevap da verebiliyordu.
 */
const newsPulse = cache(async function newsPulse(): Promise<{
  latest: Date | null;
  untranslated: number;
}> {
  const [row] = await db
    .select({
      latest: sql<
        string | null
      >`max(${news.fetchedAt}) filter (where ${news.category} is distinct from 'company')`,
      untranslated: sql<number>`count(*) filter (where ${news.headlineTr} is null)`,
    })
    .from(news);
  return {
    latest: row?.latest ? new Date(row.latest) : null,
    untranslated: Number(row?.untranslated ?? 0),
  };
});

export type CronPulse = {
  /** Senkronun kendi yazdığı en yeni damga — hiç yoksa null. */
  lastRun: Date | null;
  /** `ran` bugün koştu · `waiting` saati gelmedi · `missed` kaçtı · `notScheduled` hafta sonu. */
  state: CronState;
  /** Koşumun TR saati — "13:30". */
  dueTr: string;
};

/**
 * Günlük senkronun son koşumu ve bugünkü durumu.
 *
 * Ayrı bir "cron kayıtları" tablosu YOK ve bilerek eklenmedi: koşumun izi
 * zaten yazdığı verinin damgasında duruyor. Bu karar yerinde; yanlış olan
 * okunan damgaydı.
 *
 * `news.fetched_at` KANIT DEĞİLDİ (23 Eylül denetimi). Kutu 05:14 ET'de
 * "Bugün Koştu · Sağlıklı · 7 Dakika Önce" diyordu — senkron 10:30 UTC'de
 * (06:30 ET) koşuyor, yani o saatte bugünkü koşum OLAMAZDI. Damgayı hisse
 * sayfası yazmıştı: şirket haberleri görüntülendiği anda tabloya
 * işleniyor. Kutunun varlık sebebi olan uyarı, tam da senkronun aksadığı
 * sabah susuyordu.
 *
 * Damga artık YALNIZCA senkronun yazdığı iki sütundan: bilanço takviminin
 * `updated_at`i (koşumun tek `runAt`ı, tabloya yazan tek yer
 * app/api/cron/daily/route.ts) ve makro serilerin `updated_at`i (yine
 * yalnızca senkron; tohumlama betiği dışında). İkisinin büyüğü: biri
 * sağlayıcı yüzünden atlanırsa öteki koşumu yine gösteriyor.
 *
 * TAKVİM GÜNÜ, KAYAN 24 SAAT DEĞİL — beklenti lib/routine-schedule.ts →
 * `cronState`: hafta içi 10:30 UTC (13:30 TR), öncesi "bekleniyor", hafta
 * sonu "planlı değil".
 */
export async function getCronPulse(): Promise<AdminResult<CronPulse>> {
  return oku("getCronPulse", async () => {
    const [[takvim], [makro]] = await Promise.all([
      db
        .select({ at: sql<string | null>`max(${earningsCalendar.updatedAt})` })
        .from(earningsCalendar),
      db
        .select({ at: sql<string | null>`max(${macroSeries.updatedAt})` })
        .from(macroSeries),
    ]);
    const damgalar = [toDate(takvim?.at ?? null), toDate(makro?.at ?? null)].filter(
      (d): d is Date => d !== null,
    );
    const lastRun =
      damgalar.length > 0 ? new Date(Math.max(...damgalar.map((d) => d.getTime()))) : null;
    const now = new Date();
    return { lastRun, ...cronState(lastRun, now) };
  });
}
