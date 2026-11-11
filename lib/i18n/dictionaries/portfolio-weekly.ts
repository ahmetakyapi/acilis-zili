/**
 * `portfolioWeekly` ad alanı — pazar postasındaki Haftalık Portföy Karnesi
 * (11 Kasım). Hesap lib/portfolio-weekly.ts, şablon lib/notify-emails.ts →
 * portfolioBlock. Ayrı dosyada: paralel geliştirilen paketler sözlüğün
 * ortasına anahtar serpiştirmesin (bkz. home-desk.ts).
 */

export const portfolioWeeklyTr = {
  title: "Portföyün Bu Hafta",
  /* Büyük sayının künyesi — ölçünün ne olduğu ve neyle yapıldığı. */
  changeLabel: "Haftalık Değişim · Kapanıştan Kapanışa",
  vsMarket: "S&P 500 {pct}",
  moversTitle: "Haftayı En Çok Taşıyanlar",
  moversNote: "Hissenin Haftası · Portföye Katkısı",
  aheadTitle: "Yeni Haftada Bilanço Açıklayacak Pozisyonların",
  /* Künye satırı: bugünkü pozisyonlar, tutar yok, eksik ölçüm. */
  basis: "Bugünkü pozisyonlarınla, haftanın başındaki ağırlıklarla hesaplandı. Tutar ve adet postaya yazılmaz.",
  partial: "{total} pozisyonun {covered} tanesinin haftası ölçülebildi.",
  skipped: "Hafta içinde alınan {n} lot hesapta yok.",
  noteLabel: "Claude ile yazıldı; yalnız yukarıdaki sayılardan. Yatırım tavsiyesi değildir.",
  ownerNoteLabel: "Claude ile yazıldı; yalnız site sahibine açık görüş. Sayılar yukarıdaki tablodan.",
  button: "Portföyünü Aç",
};

export const portfolioWeeklyEn: typeof portfolioWeeklyTr = {
  title: "Your Portfolio This Week",
  changeLabel: "Weekly Change · Close to Close",
  vsMarket: "S&P 500 {pct}",
  moversTitle: "What Moved Your Week",
  moversNote: "Stock's Week · Contribution to Portfolio",
  aheadTitle: "Your Holdings Reporting Next Week",
  basis: "Calculated with your current positions, weighted at the start of the week. Amounts and share counts are never written in this email.",
  partial: "The week could be measured for {covered} of {total} positions.",
  skipped: "{n} lot(s) bought during the week are not included.",
  noteLabel: "Written with Claude, only from the figures above. Not investment advice.",
  ownerNoteLabel: "Written with Claude; an open view for the site owner only. Figures from the table above.",
  button: "Open Your Portfolio",
};
