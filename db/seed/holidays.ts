/**
 * NYSE / Nasdaq tatil takvimi.
 * Kaynak: NYSE Group resmî 2025-2027 Holiday and Early Closings Calendar.
 *
 * earlyCloseEt dolu olan günlerde borsa açıktır ama erken kapanır.
 */

export type HolidaySeed = {
  date: string;
  nameTr: string;
  nameEn: string;
  earlyCloseEt: string | null;
};

export const MARKET_HOLIDAYS: HolidaySeed[] = [
  // ---- 2026 ----
  { date: "2026-01-01", nameTr: "Yılbaşı", nameEn: "New Year's Day", earlyCloseEt: null },
  { date: "2026-01-19", nameTr: "Martin Luther King Jr. Günü", nameEn: "Martin Luther King, Jr. Day", earlyCloseEt: null },
  { date: "2026-02-16", nameTr: "Washington'ın Doğum Günü", nameEn: "Washington's Birthday", earlyCloseEt: null },
  { date: "2026-04-03", nameTr: "Kutsal Cuma", nameEn: "Good Friday", earlyCloseEt: null },
  { date: "2026-05-25", nameTr: "Anma Günü", nameEn: "Memorial Day", earlyCloseEt: null },
  { date: "2026-06-19", nameTr: "Juneteenth", nameEn: "Juneteenth National Independence Day", earlyCloseEt: null },
  { date: "2026-07-03", nameTr: "Bağımsızlık Günü (gözlem)", nameEn: "Independence Day (observed)", earlyCloseEt: null },
  { date: "2026-09-07", nameTr: "İşçi Bayramı", nameEn: "Labor Day", earlyCloseEt: null },
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving Day", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Şükran Günü ertesi (yarım gün)", nameEn: "Day after Thanksgiving (early close)", earlyCloseEt: "13:00" },
  { date: "2026-12-24", nameTr: "Noel arifesi (yarım gün)", nameEn: "Christmas Eve (early close)", earlyCloseEt: "13:00" },
  { date: "2026-12-25", nameTr: "Noel", nameEn: "Christmas Day", earlyCloseEt: null },

  // ---- 2027 ----
  { date: "2027-01-01", nameTr: "Yılbaşı", nameEn: "New Year's Day", earlyCloseEt: null },
  { date: "2027-01-18", nameTr: "Martin Luther King Jr. Günü", nameEn: "Martin Luther King, Jr. Day", earlyCloseEt: null },
  { date: "2027-02-15", nameTr: "Washington'ın Doğum Günü", nameEn: "Washington's Birthday", earlyCloseEt: null },
  { date: "2027-03-26", nameTr: "Kutsal Cuma", nameEn: "Good Friday", earlyCloseEt: null },
  { date: "2027-05-31", nameTr: "Anma Günü", nameEn: "Memorial Day", earlyCloseEt: null },
  { date: "2027-06-18", nameTr: "Juneteenth (gözlem)", nameEn: "Juneteenth (observed)", earlyCloseEt: null },
  { date: "2027-07-05", nameTr: "Bağımsızlık Günü (gözlem)", nameEn: "Independence Day (observed)", earlyCloseEt: null },
  { date: "2027-09-06", nameTr: "İşçi Bayramı", nameEn: "Labor Day", earlyCloseEt: null },
  { date: "2027-11-25", nameTr: "Şükran Günü", nameEn: "Thanksgiving Day", earlyCloseEt: null },
  { date: "2027-11-26", nameTr: "Şükran Günü ertesi (yarım gün)", nameEn: "Day after Thanksgiving (early close)", earlyCloseEt: "13:00" },
  { date: "2027-12-24", nameTr: "Noel (gözlem)", nameEn: "Christmas Day (observed)", earlyCloseEt: null },
];
