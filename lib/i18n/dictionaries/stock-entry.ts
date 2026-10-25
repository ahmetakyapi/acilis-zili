/**
 * `stockEntry` ad alanı — şirket ekranlarının künye şeridindeki kısa yollar
 * (25 Ekim UX turu): Claude raporu/analizi ve "Bu Hisseye Sor" çapası,
 * hisse seçimi raporunda bayrak listesinin katlaması. Ayrı dosyada:
 * birleştirmede iki büyük sözlükte çakışma alanı küçük kalsın
 * (changelog.ts ile aynı gerekçe).
 */

export const stockEntryTr = {
  claudeReport: "Claude Raporu",
  /** Telefondaki şeritte raporun kısa adı. */
  claudeShort: "Claude",
  claudeOpen: "Aç",
  claudeCreate: "Claude ile Analiz",
  /** Ekran okuyucu adı: görünür yazıyı bölmeden içerir (WCAG 2.5.3). */
  claudeReportLabel: "Claude Raporu: {verdict}, Aç",
  ask: "Bu Hisseye Sor",
  flagsMore: "{n} Bayrak Daha",
  flagsLess: "Daha Az Göster",
};

export const stockEntryEn: typeof stockEntryTr = {
  claudeReport: "Claude Report",
  claudeShort: "Claude",
  claudeOpen: "Open",
  claudeCreate: "Analyze with Claude",
  claudeReportLabel: "Claude Report: {verdict}, Open",
  ask: "Ask About This Stock",
  flagsMore: "{n} More Flags",
  flagsLess: "Show Less",
};
