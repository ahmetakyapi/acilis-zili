/**
 * Ekonomik takvim tohumu.
 *
 * Buraya yalnızca **ilan edilmiş veya kurala bağlı** tarihler girer:
 *   - CPI ve FOMC tarihleri BLS ve Federal Reserve'ün yayımladığı takvimlerden
 *   - Employment Situation, BLS'in "ayın ilk Cuma günü" kuralından
 *   - İşsizlik başvuruları, "her Perşembe 08:30 ET" kuralından
 *
 * Tahmin edilen tarih yazılmaz. PPI, PCE, perakende satışlar ve GDP gibi
 * yayınlar FRED'in release-dates ucundan senkronize edilir
 * (app/api/cron/sync-calendar). Böylece takvimde uydurma satır olmaz.
 *
 * Tüm saatler New York saatiyle (ET).
 */

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

function cpiEvents(): EconomicEventSeed[] {
  return CPI_RELEASES.flatMap(({ date, refTr, refEn }) => [
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `cpi-${date}`,
      titleTr: `TÜFE — ${refTr} Verisi`,
      titleEn: `CPI — ${refEn} Data`,
      importance: "high" as const,
      unit: "%",
      fredSeriesId: "CPIAUCSL",
      source: "bls-schedule",
    },
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `core-cpi-${date}`,
      titleTr: `Çekirdek TÜFE — ${refTr} Verisi`,
      titleEn: `Core CPI — ${refEn} Data`,
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
      titleTr: `Tarım Dışı İstihdam — ${refTr} Verisi`,
      titleEn: `Nonfarm Payrolls — ${refEn} Data`,
      importance: "high" as const,
      unit: "bin",
      fredSeriesId: "PAYEMS",
      source: "bls-rule",
    },
    {
      eventDate: date,
      eventTimeEt: "08:30",
      slug: `unemployment-${date}`,
      titleTr: `İşsizlik Oranı — ${refTr} Verisi`,
      titleEn: `Unemployment Rate — ${refEn} Data`,
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
function joblessClaimsEvents(from: string, weeks: number): EconomicEventSeed[] {
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

export function economicEventSeeds(): EconomicEventSeed[] {
  return [
    ...cpiEvents(),
    ...fomcEvents(),
    ...payrollEvents(),
    ...joblessClaimsEvents("2026-08-01", 40),
  ].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}
