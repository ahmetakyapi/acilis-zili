/**
 * `portfolioAdvisor` ad alanı — /portfoy/analiz'deki kişisel danışman ve ana
 * sayfa portföy kartındaki özeti (11 Kasım). Yalnız site sahibine basılır;
 * gerekçe lib/portfolio-advisor-model.ts.
 */
export const portfolioAdvisorTr = {
  title: "Claude Danışman",
  badge: "Yalnız Sana",
  tabs: { daily: "Günlük", monthly: "Aylık" },
  sessionDaily: "{date} Kapanışıyla",
  sessionMonthly: "Son 21 Seans · {month}",
  loading: "Claude portföyünü senin için değerlendiriyor…",
  unavailable: "Danışman notu şu an yazılamadı; birazdan yeniden dene.",
  actionsTitle: "Önerilen Adımlar",
  risksTitle: "Dikkat",
  outlookTitle: "Önümüzdeki Dönem",
  monthlyTitle: "21 Seansın Karnesi",
  portfolio: "Portföy",
  sp500: "S&P 500",
  contributors: "Getiriyi Taşıyanlar",
  detractors: "Getiriyi Götürenler",
  pointsUnit: "Puan",
  kinds: { trim: "Azalt", add: "Ekle", diversify: "Çeşitlendir", hedge: "Riski Sınırla", hold: "Koru", watch: "İzle" },
  homeTitle: "Danışmanın Bugün",
  openFull: "Danışman Notunun Tamamı",
  disclosure:
    "Bu not yalnız senin hesabında görünür. Claude'un görüşüdür; pozisyonlarından, son tamamlanmış seanstan, sitenin teknik analizlerinden ve bir yıllık risk ölçülerinden yazıldı. Lisanslı yatırım danışmanlığı değildir, karar senin. Günlük not her gün, aylık not ayda bir yenilenir.",
};

export const portfolioAdvisorEn: typeof portfolioAdvisorTr = {
  title: "Claude Advisor",
  badge: "Only You",
  tabs: { daily: "Daily", monthly: "Monthly" },
  sessionDaily: "At the {date} Close",
  sessionMonthly: "Last 21 Sessions · {month}",
  loading: "Claude is reviewing your portfolio for you…",
  unavailable: "The advisor note couldn't be written right now; try again shortly.",
  actionsTitle: "Recommended Steps",
  risksTitle: "Watch Out",
  outlookTitle: "Looking Ahead",
  monthlyTitle: "The 21-Session Report",
  portfolio: "Portfolio",
  sp500: "S&P 500",
  contributors: "Carried the Return",
  detractors: "Dragged the Return",
  pointsUnit: "pts",
  kinds: { trim: "Trim", add: "Add", diversify: "Diversify", hedge: "Hedge", hold: "Hold", watch: "Watch" },
  homeTitle: "Your Advisor Today",
  openFull: "The Full Advisor Note",
  disclosure:
    "This note is visible only on your account. It is Claude's view, written from your positions, the last completed session, the site's technical analyses and one-year risk measures. It is not licensed investment advice; the decision is yours. The daily note refreshes every day, the monthly one once a month.",
};
