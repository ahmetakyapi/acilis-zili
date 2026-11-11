/**
 * `portfolioAsk` ad alanı — "Portföyüne Sor" (11 Kasım): okurun kendi
 * portföyü hakkında düz cümleyle sorduğu, Claude'un yalnız o portföyün
 * verisiyle yanıtladığı kutu (components/portfolio/PortfolioAsk.tsx,
 * gerekçe lib/portfolio-question.ts). Sözlüğün parçası, ayrı dosyada:
 * paralel geliştirilen paketler sözlüğün ortasına anahtar serpiştirmesin.
 *
 * Ölçü etiketleri (`measures`) girdinin alan adlarıyla bire bir
 * (lib/portfolio-question-core.ts → `measureCatalog`); yeni alan eklenince
 * burada da etiket gerekir, yoksa kart alan adını basar.
 */

export const portfolioAskTr = {
  title: "Portföyüne Sor",
  intro: "Portföyün hakkında merak ettiğini düz cümleyle sor; Claude yalnız senin pozisyonlarından ve son tamamlanmış seansın verisinden yanıtlar.",
  label: "Portföyün Hakkındaki Sorun",
  placeholder: "Örneğin: SNDK'yi satsam yoğunlaşmam ne olur?",
  submit: "Sor",
  asking: "Claude portföyünün verisini okuyor…",
  remaining: "{n}/{limit} Soru Hakkı Kaldı",
  examplesLabel: "Hazır Sorular",
  examples: [
    "Portföyümde en çok hangi pozisyon ağır basıyor?",
    "Son 5 seansta portföyümü en çok ne taşıdı?",
    "Yaklaşan bilançolar portföyümün ne kadarını ilgilendiriyor?",
    "En büyük pozisyonumun yarısını satsam yoğunlaşmam ne olur?",
  ],
  question: "Soru",
  answer: "Claude'un Yanıtı",
  advice: "Tavsiye Değil",
  owner: "Sana Özel Görüş",
  partial: "Sorunun bir kısmı veride yok; yanıt yalnız verisi olan kısmı anlatıyor.",
  unanswerable: "Bu soruyu portföyünün verisiyle cevaplayamıyorum. Ağırlıklar, son seanslar, maliyete göre durum, risk ölçüleri, sektörler ya da yaklaşan bilançolarla ilgili bir soru deneyebilirsin.",
  scenarioUnavailable:
    "Bu senaryoyu hesaplayamıyorum. Tek bir hisse ve net bir eylemle sorabilirsin: \"SNDK'yi satsam\", \"NVDA'nın yarısını satsam\", \"MU'yu %10'a indirsem\" ya da \"%5 AAPL eklesem\".",
  measuresLabel: "Dayandığı Ölçüler",
  session: "{date} Kapanışına Kadar Veri",
  previewLabel: "Yanıtın Dayanabileceği Veri",
  preview: ["Ağırlıklar", "Son Seans, 5 ve 21 Seans", "Maliyete Göre", "Risk Ölçüleri", "Sektör Dağılımı", "Yaklaşan Bilançolar", "Sitenin Teknik Görüşü", "Senaryo Hesabı"],
  scopes: { portfolio: "Portföy", risk: "Risk", scenario: "Senaryo" },
  arrow: "→",
  measures: {
    weight: "Ağırlık",
    lastSession: "Son Seans",
    lastFiveSessions: "5 Seans",
    last21Sessions: "21 Seans",
    sinceAverageCost: "Maliyete Göre",
    top5Weight: "İlk 5 Payı",
    window: "Pencere",
    annualVolatility: "Yıllık Oynaklık",
    benchmarkVolatility: "S&P 500 Oynaklığı",
    beta: "Beta",
    maxDrawdown: "En Büyük Düşüş",
    effectivePositions: "Etkin Pozisyon Sayısı",
    averageCorrelation: "Ortalama Korelasyon",
    dividendYield: "Temettü Verimi",
    earningsNext30Days: "30 Günde Bilanço Açıklayanların Payı",
    largestSector: "En Büyük Sektör",
    symbolWeight: "Ağırlık",
    largest: "En Büyük Pozisyon",
    sectorWeight: "Sektörünün Payı",
  } as Record<string, string>,
  errors: {
    quota: "Bugünkü soru hakkın doldu; yarın yeniden sorabilirsin.",
    busy: "Önceki sorun hâlâ yanıtlanıyor; birkaç saniye bekle.",
    budget: "Claude'un bugünkü payı doldu; biraz sonra yeniden dene.",
    rate: "Biraz hızlı gittin; bir dakika içinde yeniden dene.",
    question: "Soru 3 ile 300 karakter arasında olmalı.",
    auth: "Oturumun kapanmış; yeniden giriş yap.",
    empty: "Soru sorabilmek için önce portföyüne pozisyon ekle.",
    data: "Pozisyonlarının son seans verisi şu an okunamıyor; birazdan yeniden dene.",
    unverified: "Yanıt sayı denetiminden geçmediği için gösterilmedi; hakkından düşmedi. Soruyu biraz farklı sorabilirsin.",
    error: "Yanıt şu an alınamadı; birazdan yeniden dene.",
  },
  disclosure:
    "Yanıtlar Claude ile, yalnız senin pozisyonlarından ve son tamamlanmış seansın kapanışından yazılır; yanıttaki her sayının veride geçmesi gerekir, senaryo hesabını site yapar. Yatırım tavsiyesi değildir.",
  ownerDisclosure:
    "Site sahibi oturumu: Claude bu kutuda açık görüş yazabilir. Sayılar yine yalnız verideki sayılardır; senaryo hesabını site yapar.",
};

export const portfolioAskEn: typeof portfolioAskTr = {
  title: "Ask Your Portfolio",
  intro: "Ask anything about your portfolio in plain words; Claude answers only from your positions and the last completed session's data.",
  label: "Your Question About Your Portfolio",
  placeholder: "For example: what if I sell SNDK, how does my concentration change?",
  submit: "Ask",
  asking: "Claude is reading your portfolio data…",
  remaining: "{n}/{limit} Questions Left Today",
  examplesLabel: "Ready Questions",
  examples: [
    "Which position weighs most in my portfolio?",
    "What drove my portfolio over the last 5 sessions?",
    "How much of my portfolio reports earnings soon?",
    "What if I sell half of my largest position?",
  ],
  question: "Your Question",
  answer: "Claude's Answer",
  advice: "Not Advice",
  owner: "Your Personal View",
  partial: "Part of your question isn't in the data; the answer covers only the part that is.",
  unanswerable: "I can't answer this question with your portfolio data. Try asking about weights, recent sessions, position vs cost, risk measures, sectors or upcoming earnings.",
  scenarioUnavailable:
    "I can't compute this scenario. Ask with a single stock and a clear action: \"if I sell SNDK\", \"if I sell half of NVDA\", \"if I bring MU to 10%\" or \"if I add 5% AAPL\".",
  measuresLabel: "Measures Used",
  session: "Data Through the {date} Close",
  previewLabel: "Data an Answer Can Draw On",
  preview: ["Weights", "Last Session, 5 and 21 Sessions", "Vs Cost", "Risk Measures", "Sector Mix", "Upcoming Earnings", "The Site's Technical View", "Scenario Math"],
  scopes: { portfolio: "Portfolio", risk: "Risk", scenario: "Scenario" },
  arrow: "→",
  measures: {
    weight: "Weight",
    lastSession: "Last Session",
    lastFiveSessions: "5 Sessions",
    last21Sessions: "21 Sessions",
    sinceAverageCost: "Vs Cost",
    top5Weight: "Top 5 Share",
    window: "Window",
    annualVolatility: "Annual Volatility",
    benchmarkVolatility: "S&P 500 Volatility",
    beta: "Beta",
    maxDrawdown: "Max Drawdown",
    effectivePositions: "Effective Positions",
    averageCorrelation: "Average Correlation",
    dividendYield: "Dividend Yield",
    earningsNext30Days: "Share Reporting in 30 Days",
    largestSector: "Largest Sector",
    symbolWeight: "Weight",
    largest: "Largest Position",
    sectorWeight: "Its Sector's Share",
  },
  errors: {
    quota: "You've used today's questions; you can ask again tomorrow.",
    busy: "Your previous question is still being answered; give it a few seconds.",
    budget: "Claude's share for today is used up; try again a little later.",
    rate: "That was quick; try again within a minute.",
    question: "The question should be between 3 and 300 characters.",
    auth: "Your session has ended; sign in again.",
    empty: "Add a position to your portfolio before asking.",
    data: "Your positions' last-session data can't be read right now; try again shortly.",
    unverified: "The answer didn't pass the number check, so it isn't shown; it didn't use up a question. Try rephrasing.",
    error: "Couldn't get an answer right now; try again shortly.",
  },
  disclosure:
    "Answers are written with Claude only from your positions and the last completed session's close; every number in an answer must appear in that data, and the site does the scenario math. Not investment advice.",
  ownerDisclosure:
    "Site owner session: Claude may state open views in this box. Numbers are still only those in the data; the site does the scenario math.",
};

export type PortfolioAskLabels = typeof portfolioAskTr;
