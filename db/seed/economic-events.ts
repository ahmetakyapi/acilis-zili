/**
 * Ekonomik takvim tohumu.
 *
 * Buraya yalnızca **ilan edilmiş veya kurala bağlı** tarihler girer:
 *   - CPI ve FOMC tarihleri BLS ve Federal Reserve'ün yayımladığı takvimlerden
 *   - Employment Situation, BLS'in yayımladığı takvimden (kural "ayın ilk
 *     Cuma günü" ama istisnası var: 2027 Ocak'ta ilk Cuma yılbaşına denk
 *     geldiği için yayın 8'ine kaydı. Bu yüzden üretilmiyor, işleniyor.)
 *   - İşsizlik başvuruları, "her Perşembe 08:30 ET" kuralından — tek
 *     ÜRETİLEN seri bu, her tohum koşumunda bugünden bir yıl ileri dolar.
 *
 * Tahmin edilen tarih yazılmaz.
 *
 * BURASI ARTIK YALNIZCA BAŞLANGIÇ. Takvimin ileriye doğru dolması günlük
 * cron'un işi: `lib/calendar-sync.ts` FRED'in yayın takviminden TÜFE,
 * istihdam raporu ve çekirdek PCE tarihlerini bir yıl ileriye kadar çekiyor
 * ve buradaki elle işlenmiş kayıtlara dokunmuyor. Yani bu dosyadaki CPI ve
 * istihdam listeleri bitse bile takvim boşalmıyor.
 *
 * TEK İSTİSNA FOMC. Fed'in toplantı takvimi bir FRED yayını değil — politika
 * faizi serisinin bağlı olduğu H.15 günlük çıkar, toplantı günleriyle ilgisi
 * yoktur. FOMC tarihleri elle işlenir ve BİTER. `manualCoverage()` kalan ömrü
 * hesaplar, `npm run db:seed` her koşumda yazdırır, eşiğin altına inince
 * uyarır. Kaynak:
 *   FOMC → federalreserve.gov/monetarypolicy/fomccalendars.htm
 *   (BLS takvimi de hâlâ elle tazelenebilir: bls.gov/schedule/news_release/ —
 *    ama artık zorunlu değil, FRED aynı tarihleri veriyor.)
 *
 * Tüm saatler New York saatiyle (ET).
 */

import { todayEt } from "../../lib/market-hours";

export type EconomicEventSeed = {
  eventDate: string;
  eventTimeEt: string | null;
  slug: string;
  titleTr: string;
  titleEn: string;
  importance: "high" | "medium" | "low";
  unit: string | null;
  fredSeriesId: string | null;
  source: string;
};

/** Kaynak: BLS CPI yayın takvimi — hepsi 08:30 ET. */
const CPI_RELEASES: { date: string; refTr: string; refEn: string }[] = [
  { date: "2026-08-12", refTr: "Temmuz", refEn: "July" },
  { date: "2026-09-11", refTr: "Ağustos", refEn: "August" },
  { date: "2026-10-14", refTr: "Eylül", refEn: "September" },
  { date: "2026-11-10", refTr: "Ekim", refEn: "October" },
  { date: "2026-12-10", refTr: "Kasım", refEn: "November" },
];

/**
 * Kaynak: federalreserve.gov FOMC takvimi.
 * Faiz kararı toplantının ikinci günü 14:00 ET'de açıklanır;
 * SEP (nokta grafiği) olan toplantılar ayrıca işaretlenir.
 */
const FOMC_DECISIONS: { date: string; sep: boolean }[] = [
  { date: "2026-09-16", sep: true },
  { date: "2026-10-28", sep: false },
  { date: "2026-12-09", sep: true },
  { date: "2027-01-27", sep: false },
  { date: "2027-03-17", sep: true },
  { date: "2027-04-28", sep: false },
  { date: "2027-06-09", sep: true },
  { date: "2027-07-28", sep: false },
  { date: "2027-09-15", sep: true },
  { date: "2027-10-27", sep: false },
  { date: "2027-12-08", sep: true },
];

/** BLS kuralı: Employment Situation ayın ilk Cuma günü 08:30 ET. */
const PAYROLL_RELEASES: { date: string; refTr: string; refEn: string }[] = [
  { date: "2026-08-07", refTr: "Temmuz", refEn: "July" },
  { date: "2026-09-04", refTr: "Ağustos", refEn: "August" },
  { date: "2026-10-02", refTr: "Eylül", refEn: "September" },
  { date: "2026-11-06", refTr: "Ekim", refEn: "October" },
  { date: "2026-12-04", refTr: "Kasım", refEn: "November" },
  { date: "2027-01-08", refTr: "Aralık", refEn: "December" },
];

/* BAŞLIKLARDA EM DASH YOK. Sekiz olay adı "TÜFE — Ağustos Verisi" kalıbıyla
   yazılıyordu ve tire burada gösterge adıyla referans dönemini ayırıyordu.
   Bunlar makale nesri değil, takvim satırında okunan ETİKETLER; tasarım
   kuralı (design-taste-frontend §9.G) tam bu tür arayüz metnini hedefliyor.

   Tire kaldırılırken cümle yeniden kurulmadı, SIRALAMA değişti: dönem başa
   geldi. "Ağustos TÜFE Verisi" hem Türkçede hem "August CPI Data" biçimiyle
   İngilizcede doğal sıralama; ayırıcıya hiç gerek kalmıyor. Virgül ya da
   parantez de olurdu ama ikisi de ayırıcının kendisini koruyup yalnızca
   şeklini değiştirirdi.

   VERİTABANI KENDİLİĞİNDEN GÜNCELLENMEZ. Bu dosya tohum; mevcut satırlar
   eski başlığı taşımaya devam eder. `npm run db:seed` `onConflictDoUpdate`
   ile yazıyor, yani bir kez koşturulması gerekiyor. */
function cpiEvents(): EconomicEventSeed[] {
  return CPI_RELEASES.flatMap(({ date, refTr, refEn }) => [
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `cpi-${date}`,
      titleTr: `${refTr} TÜFE Verisi`,
      titleEn: `${refEn} CPI Data`,
      importance: "high" as const,
      unit: "%",
      fredSeriesId: "CPIAUCSL",
      source: "bls-schedule",
    },
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `core-cpi-${date}`,
      titleTr: `${refTr} Çekirdek TÜFE Verisi`,
      titleEn: `${refEn} Core CPI Data`,
      importance: "high" as const,
      unit: "%",
      fredSeriesId: "CPILFESL",
      source: "bls-schedule",
    },
  ]);
}

function fomcEvents(): EconomicEventSeed[] {
  return FOMC_DECISIONS.flatMap(({ date, sep }) => {
    const events: EconomicEventSeed[] = [
      {
        eventDate: date,
        eventTimeEt: "14:00",
        slug: `fomc-rate-${date}`,
        titleTr: "FOMC Faiz Kararı",
        titleEn: "FOMC Rate Decision",
        importance: "high",
        unit: "%",
        fredSeriesId: "DFEDTARU",
        source: "federalreserve",
      },
      {
        eventDate: date,
        eventTimeEt: "14:30",
        slug: `fomc-presser-${date}`,
        titleTr: "Fed Başkanı Basın Toplantısı",
        titleEn: "Fed Chair Press Conference",
        importance: "high",
        unit: null,
        fredSeriesId: null,
        source: "federalreserve",
      },
    ];

    if (sep) {
      events.push({
        eventDate: date,
        eventTimeEt: "14:00",
        slug: `fomc-sep-${date}`,
        titleTr: "Ekonomik Projeksiyonlar (Nokta Grafiği)",
        titleEn: "Summary of Economic Projections (Dot Plot)",
        importance: "high",
        unit: null,
        fredSeriesId: null,
        source: "federalreserve",
      });
    }

    return events;
  });
}

function payrollEvents(): EconomicEventSeed[] {
  return PAYROLL_RELEASES.flatMap(({ date, refTr, refEn }) => [
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `nfp-${date}`,
      titleTr: `${refTr} Tarım Dışı İstihdam Verisi`,
      titleEn: `${refEn} Nonfarm Payrolls Data`,
      importance: "high" as const,
      unit: "bin",
      fredSeriesId: "PAYEMS",
      source: "bls-rule",
    },
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `unemployment-${date}`,
      titleTr: `${refTr} İşsizlik Oranı Verisi`,
      titleEn: `${refEn} Unemployment Rate Data`,
      importance: "high" as const,
      unit: "%",
      fredSeriesId: "UNRATE",
      source: "bls-rule",
    },
  ]);
}

/**
 * Haftalık İşsizlik Başvuruları — her Perşembe 08:30 ET.
 * Tatile denk gelen haftalarda BLS bir gün kaydırır; FRED senkronizasyonu
 * bu istisnaları düzeltir.
 */
export function joblessClaimsEvents(from: string, weeks: number): EconomicEventSeed[] {
  const events: EconomicEventSeed[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);

  // İlk Perşembeye ilerle (getUTCDay: Perşembe = 4)
  while (cursor.getUTCDay() !== 4) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (let i = 0; i < weeks; i++) {
    const date = cursor.toISOString().slice(0, 10);
    events.push({
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `jobless-claims-${date}`,
      titleTr: "Haftalık İşsizlik Başvuruları",
      titleEn: "Initial Jobless Claims",
      importance: "medium",
      unit: "bin",
      fredSeriesId: "ICSA",
      source: "dol-rule",
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return events;
}

/** İşsizlik başvurularının kaç hafta ileri tohumlanacağı. */
const JOBLESS_WEEKS = 52;

export function economicEventSeeds(
  today: string = todayEt(),
): EconomicEventSeed[] {
  return [
    ...cpiEvents(),
    ...fomcEvents(),
    ...payrollEvents(),
    /* Başlangıç ÇALIŞMA ANINDAN türer. Eskiden "2026-08-01" sabitti: tohum
       2027 yazında çalıştırıldığında geçmiş 40 haftayı yazıp geleceği boş
       bırakıyordu. Kural tabanlı olan tek seri bu olduğu için kendini
       yenileyebilen de yalnızca bu — her seed koşumu bugünden itibaren bir
       yıl ileriyi doldurur. */
    ...joblessClaimsEvents(today, JOBLESS_WEEKS),
  ].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

/* --------------------------------------------------------------------------
   Kapsam denetimi

   CPI, FOMC ve istihdam tarihleri KURAL DEĞİL, ilan edilmiş takvimlerdir:
   BLS ve Fed bunları yılda bir yayımlar ve buraya elle işlenir. Yani bu
   dosyanın bir son kullanma tarihi var ve o tarih geldiğinde takvim sessizce
   boşalıyordu — ekranda hata yok, sadece "yaklaşan olay yok" yazıyor.
   Yatırımcının FOMC gününü kaçırması için yeterli.

   Sessiz bitişi görünür bir uyarıya çeviriyoruz: `npm run db:seed` her
   koşumda kalan kapsamı yazdırır, eşiğin altına inince yüksek sesle söyler.
   Otomatik çözüm değil — hatırlatıcı. Asıl çözüm tarihleri tazelemek.
   -------------------------------------------------------------------------- */

/** Bu kadar günün altına inince tohum uyarı basar. */
export const COVERAGE_WARN_DAYS = 90;

export type SeriesCoverage = {
  label: string;
  /** Elle işlenen son tarih; seri hiç yoksa null. */
  lastDate: string | null;
  /** Bugünden itibaren kaç gün kaldı. */
  daysLeft: number;
};

/** Elle bakımı gereken serilerin kapsamı — kural tabanlı olanlar hariç. */
export function manualCoverage(today: string = todayEt()): SeriesCoverage[] {
  const daysBetween = (from: string, to: string) =>
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86400000,
    );

  const lastOf = (dates: string[]): string | null =>
    dates.length > 0 ? [...dates].sort().at(-1)! : null;

  return [
    { label: "TÜFE (BLS)", lastDate: lastOf(CPI_RELEASES.map((r) => r.date)) },
    { label: "FOMC (Fed)", lastDate: lastOf(FOMC_DECISIONS.map((r) => r.date)) },
    {
      label: "İstihdam (BLS)",
      lastDate: lastOf(PAYROLL_RELEASES.map((r) => r.date)),
    },
  ].map((entry) => ({
    ...entry,
    daysLeft: entry.lastDate ? daysBetween(today, entry.lastDate) : 0,
  }));
}
