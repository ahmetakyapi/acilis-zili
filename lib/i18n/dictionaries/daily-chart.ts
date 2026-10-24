/**
 * `dailyChart` ad alanı — Günün Grafiği (24 Ekim). Sözlüğün parçası
 * (tr.ts / en.ts bunu `dailyChart` anahtarına koyuyor), ayrı dosyada:
 * paralel geliştirilen paketler sözlüğün ortasına anahtar serpiştirmesin.
 */

export const dailyChartTr = {
  title: "Günün Grafiği",
  subtitle: "Her işlem günü tek grafik ve kısa bir açıklama: piyasanın o gününü bir bakışta okumak için.",
  /* Başlığın altındaki künye: grafiğin anlattığı gün ve verinin cinsi. */
  sessionLine: "{date} Kapanışı",
  archiveTitle: "Arşiv",
  archiveCount: "{count} Grafik",
  empty: "Henüz Grafik Yok",
  emptyHint:
    "Her işlem gününün grafiği ertesi sabah, Türkiye saatiyle ~09:15'te yazılır. O zamana kadar son seansı Günün Posteri'nde görebilirsin.",
  emptyAction: "Son Günün Posteri",
  /* Kayıt okunan dilde değilse — tek anahtar, her dil kendi cümlesini
     söyler (TR arayüzde İngilizce kayıt, EN arayüzde Türkçe kayıt). */
  fallbackNote: "Bu grafiğin Türkçesi henüz yazılmadı; İngilizce orijinali gösteriliyor.",
  chartHeading: "Grafik",
  aboutHeading: "Ne Anlatıyor",
  sources: "Kaynaklar",
  dataNote: "Yüzdeler kapanıştan kapanışa, günlük işlem barlarından (Alpaca SIP) hesaplandı; metindeki her sayı o günün verisinde geçiyor.",
  disclaimer: "Yatırım Tavsiyesi Değildir.",
  downloadLandscape: "Yatay Görseli İndir",
  downloadPortrait: "Dikey Görseli İndir",
  shareTitle: "Bu Grafiği Paylaş",
  prevDay: "Önceki Grafik",
  nextDay: "Sonraki Grafik",
  allCharts: "Tüm Grafikler",
  dayNav: "Grafikler Arasında Gezin",
  readMore: "Grafiğe Git",
  /* Ana sayfa paneli. */
  homeAll: "Arşiv",
  /* Bülten sayısının altındaki bağlantı. */
  briefLink: "O Günün Grafiği",
  menuHint: "Her Gün Tek Grafik",
  landscapeAlt: "{title} · {date} · Günün Grafiği",
  portraitAlt: "{title} · {date} · Günün Grafiği, dikey",
  metaDescription: "Her işlem günü ABD borsasından tek grafik ve kısa bir açıklama; arşivli ve paylaşılabilir.",
};

export const dailyChartEn: typeof dailyChartTr = {
  title: "Chart of the Day",
  subtitle: "One chart and a short note every trading day: the session at a glance.",
  sessionLine: "{date} Close",
  archiveTitle: "Archive",
  archiveCount: "{count} Charts",
  empty: "No Charts Yet",
  emptyHint:
    "Each session's chart is written the next morning, around 09:15 Istanbul time. Until then, the Day's Poster shows the latest session.",
  emptyAction: "The Latest Day's Poster",
  fallbackNote: "This chart hasn't been written in English yet; the Turkish original is shown.",
  chartHeading: "Chart",
  aboutHeading: "What It Shows",
  sources: "Sources",
  dataNote: "Percentages are close-to-close, from daily trade bars (Alpaca SIP); every figure in the text appears in that day's data.",
  disclaimer: "Not Investment Advice.",
  downloadLandscape: "Download Landscape Image",
  downloadPortrait: "Download Portrait Image",
  shareTitle: "Share This Chart",
  prevDay: "Previous Chart",
  nextDay: "Next Chart",
  allCharts: "All Charts",
  dayNav: "Browse Charts",
  readMore: "Open the Chart",
  homeAll: "Archive",
  briefLink: "That Day's Chart",
  menuHint: "One Chart Every Day",
  landscapeAlt: "{title} · {date} · Chart of the Day",
  portraitAlt: "{title} · {date} · Chart of the Day, portrait",
  metaDescription: "One chart from the US market and a short note every trading day; archived and shareable.",
};

export type DailyChartLabels = typeof dailyChartTr;
