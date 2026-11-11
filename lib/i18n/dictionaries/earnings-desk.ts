/**
 * `earningsDesk` ad alanı — Bilanço Masası (11 Kasım): okurun portföyündeki
 * hisselerin yaklaşan ve yeni açıklanmış bilançoları için Claude notları.
 * Arayüz components/portfolio/EarningsDesk.tsx; gerekçe
 * lib/portfolio-earnings-desk.ts. Ayrı dosyada (bkz. home-desk.ts):
 * paralel paketler sözlüğün ortasına anahtar serpiştirmesin.
 */

export const earningsDeskTr = {
  title: "Bilanço Masası",
  homeTitle: "Bilanço Masası",
  session: "{date} Kapanışıyla",
  loading: "Claude portföyündeki bilançoları okuyor…",
  /* Kartlar var, Claude metni yok (anahtar, bütçe ya da denetim). */
  noText: "Not şu an yazılamadı; ölçüler kartlarda.",
  groups: { after: "Açıkladı", before: "Yaklaşıyor" },
  /* Tarih çipi: "13 Kas Perşembe". Zil saati okurun birincil saatiyle. */
  bell: "Zil {time}",
  timing: { bmo: "Açılış Öncesi", amc: "Kapanış Sonrası", dmh: "Seans İçi", unknown: "Saat Belirsiz" },
  eps: "Hisse Başına Kâr",
  revenue: "Gelir",
  estimate: "Beklenti",
  actual: "Gerçekleşen",
  verdict: { beat: "Aştı", miss: "Kaçırdı", inline: "Beklentide" },
  /* Geçmiş çeyrek tablosunun 58 piksellik sütununda "Beklentide" taşıyordu (ölçüldü). */
  inlineShort: "Tuttu",
  epsEstimate: "HBK Beklentisi",
  revenueEstimate: "Gelir Beklentisi",
  surprise: "{pct} Sürpriz",
  reaction: "İlk Tepki",
  reactionPending: "Seans Kapanınca",
  history: "Son Çeyrekler",
  historyCols: { surprise: "HBK Sürprizi", reaction: "İlk Tepki" },
  historyAria: "{quarter}: hisse başına kâr sürprizi {surprise}, ilk tepki {reaction}",
  weight: "Portföydeki Ağırlık",
  five: "5 Seans",
  month: "21 Seans",
  stock: "Hisse Sayfası",
  analysis: "Bilanço Analizi",
  view: {
    title: "Bilanço Görüşü",
    badge: "Yalnız Sana",
    actions: { add: "Ekle", hold: "Tut", trim: "Azalt" },
    takeProfit: "Kâr Al",
    stopLoss: "Zarar Kes",
    disclosure:
      "Bilanço Görüşü yalnız senin hesabında görünür. Seviyeler sitenin teknik analizlerinden, üç aylık banttan ve maliyetinden seçildi; görüş Claude'undur, lisanslı yatırım danışmanlığı değildir. Karar senin.",
  },
  disclosure:
    "Notlar bilanço takviminden, son tamamlanmış seansın kapanışından ve pozisyonlarından Claude ile yazıldı; her gün ilk açılışta yenilenir. Saatler {zone} saatiyle. Yatırım tavsiyesi değildir.",
  /* Ana sayfa kartının tek satırı. */
  brief: { before: "{n} Yaklaşan", after: "{n} Açıklanan", open: "Masayı Aç" },
  zone: { tr: "Türkiye", en: "New York" },
};

export const earningsDeskEn: typeof earningsDeskTr = {
  title: "Earnings Desk",
  homeTitle: "Earnings Desk",
  session: "As of {date} Close",
  loading: "Claude is reading the earnings in your portfolio…",
  noText: "The note could not be written right now; the figures are on the cards.",
  groups: { after: "Reported", before: "Coming Up" },
  bell: "Bell {time}",
  timing: { bmo: "Before Open", amc: "After Close", dmh: "During Session", unknown: "Time Unconfirmed" },
  eps: "Earnings per Share",
  revenue: "Revenue",
  estimate: "Estimate",
  actual: "Actual",
  verdict: { beat: "Beat", miss: "Missed", inline: "In Line" },
  inlineShort: "Met",
  epsEstimate: "EPS Estimate",
  revenueEstimate: "Revenue Estimate",
  surprise: "{pct} Surprise",
  reaction: "First Reaction",
  reactionPending: "After the Close",
  history: "Recent Quarters",
  historyCols: { surprise: "EPS Surprise", reaction: "Reaction" },
  historyAria: "{quarter}: EPS surprise {surprise}, first reaction {reaction}",
  weight: "Portfolio Weight",
  five: "5 Sessions",
  month: "21 Sessions",
  stock: "Stock Page",
  analysis: "Earnings Analysis",
  view: {
    title: "Earnings View",
    badge: "Only You",
    actions: { add: "Add", hold: "Hold", trim: "Trim" },
    takeProfit: "Take Profit",
    stopLoss: "Stop Loss",
    disclosure:
      "The Earnings View is visible only on your account. Levels are chosen from the site's technical analyses, the three-month range and your cost; the view is Claude's and is not licensed investment advice. The decision is yours.",
  },
  disclosure:
    "Notes are written by Claude from the earnings calendar, the last completed session's close and your positions; refreshed on the first visit each day. Times in {zone} time. Not investment advice.",
  brief: { before: "{n} Coming Up", after: "{n} Reported", open: "Open the Desk" },
  zone: { tr: "Türkiye", en: "New York" },
};
