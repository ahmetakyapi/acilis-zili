/**
 * "Sayfanın İçinde Claude" (24 Ekim) — `watchlistToday` (Takip Listem
 * Bugün) ve `askStock` (Bu Hisseye Sor) ad alanları. Sözlüğün parçası
 * (tr.ts / en.ts sonuna ekliyor) ama AYRI dosyada: iki istemci bileşeni
 * etiketleri prop olarak alıyor ve özellik kendi dosyasında kalınca öteki
 * dallarla birleşmede sözlüğün ortasında çakışma çıkmıyor.
 */

export const watchlistTodayTr = {
  title: "Takip Listem Bugün",
  session: "{date} Kapanışıyla",
  credit: "Claude · {date} Kapanışı",
  loading: "Claude listeni son seansın kapanışıyla okuyor…",
  unavailable: "Bugünün okuması şu an hazırlanamadı; birazdan yeniden dene.",
  noteFailed: "Claude notu bu kez yazılamadı; hareketler son seansın kapanışından.",
  movers: "En Çok Hareket Edenler",
  market: "S&P 500 {pct}",
  versus: "S&P 500'e Göre {gap}",
  pointsUnit: "Puan",
  earnings: "Yakında Bilanço",
  bmo: "Açılış Öncesi",
  amc: "Kapanış Sonrası",
  partial: "{covered} hissenin {total} tanesi okunabildi; kalanın son seans verisi yok.",
  disclosure:
    "Bu okuma, takip listenden ve son tamamlanmış seansın kapanışından Claude ile yazıldı; ekrandaki canlı fiyatlar notta yer almaz. Yatırım tavsiyesi değildir.",
};

export const watchlistTodayEn: typeof watchlistTodayTr = {
  title: "My Watchlist Today",
  session: "As of the {date} Close",
  credit: "Claude · {date} Close",
  loading: "Claude is reading your list at the last session's close…",
  unavailable: "Today's reading couldn't be prepared right now; try again shortly.",
  noteFailed: "Claude's note couldn't be written this time; the moves are from the last session's close.",
  movers: "Biggest Movers",
  market: "S&P 500 {pct}",
  versus: "{gap} vs. S&P 500",
  pointsUnit: "pts",
  earnings: "Earnings Soon",
  bmo: "Before Open",
  amc: "After Close",
  partial: "{covered} of {total} stocks could be read; the rest have no data for the last session.",
  disclosure:
    "This reading was written with Claude from your watchlist and the last completed session's close; live prices on screen are not part of it. Not investment advice.",
};

export const askStockTr = {
  title: "Bu Hisseye Sor",
  intro: "Sorunu yaz; Claude yalnız bu sayfadaki veriden yanıtlar ve al/sat tavsiyesi vermez.",
  label: "Bu hisse hakkındaki sorun",
  placeholder: "Örneğin: son bilançoda beklentiyi aştı mı?",
  submit: "Sor",
  asking: "Claude sayfanın verisini okuyor…",
  remaining: "{n}/{limit} Soru Hakkı Kaldı",
  examplesLabel: "Örnek Sorular",
  examples: ["Son bilançoda beklentiyi aştı mı?", "Analistler bu hisse için ne diyor?", "Temettü ödüyor mu, verimi ne kadar?"],
  question: "Soru",
  answer: "Claude'un Yanıtı",
  advice: "Tavsiye Değil",
  unanswerable: "Bu soruyu sayfadaki veriyle cevaplayamıyorum. Fiyat, değerleme, bilanço, analistler, temettü ya da haberlerle ilgili bir soru deneyebilirsin.",
  sourcesLabel: "Yararlanılan Veri",
  sources: {
    session: "Son Seans",
    valuation: "Değerleme",
    scorecard: "Skor Kartı",
    analysts: "Analist Dağılımı",
    earnings: "Bilanço Geçmişi",
    nextEarnings: "Sıradaki Bilanço",
    dividends: "Temettü",
    news: "Haber Başlıkları",
    notes: "Claude Notları",
  },
  newsLabel: "Kaynak Haberler",
  session: "{date} Kapanışına Kadar Veri",
  signedOut: "Bu hisse hakkında merak ettiğini sor; Claude yanıtı yalnız bu sayfadaki veriden yazar, al/sat tavsiyesi vermez. Soru sormak için giriş yap.",
  signIn: "Giriş Yap ve Sor",
  /* Oturumsuz önizleme (24 Ekim düzeltmesi): yanıtın YAPISINI anlatır,
     uydurma bir yanıt ya da sayı basmaz. */
  previewTitle: "Yanıt Nasıl Görünür",
  previewText: "Claude en çok 90 kelimelik düz bir paragraf yazar. Yanıttaki her sayı bu sayfanın verisinde geçmek zorunda; geçmezse yanıt hiç gösterilmez. Altında hangi veriden yararlandığı ve varsa kaynak haberler yazar.",
  previewSources: "Yanıtın Dayanabileceği Veri",
  memberQuota: "Üyelere Günde {limit} Soru",
  errors: {
    quota: "Bugünkü soru hakkın doldu; yarın yeniden sorabilirsin.",
    busy: "Önceki sorun hâlâ yanıtlanıyor; birkaç saniye bekle.",
    budget: "Claude'un bugünkü payı doldu; biraz sonra yeniden dene.",
    rate: "Biraz hızlı gittin; bir dakika içinde yeniden dene.",
    question: "Soru 3 ile 300 karakter arasında olmalı.",
    auth: "Oturumun kapanmış; yeniden giriş yap.",
    error: "Yanıt şu an alınamadı; birazdan yeniden dene.",
  },
  disclosure:
    "Yanıtlar Claude ile, yalnız bu sayfadaki veriden ve son tamamlanmış seansın kapanışından yazılır; yanıttaki her sayının veride geçmesi gerekir. Yatırım tavsiyesi değildir.",
};

export const askStockEn: typeof askStockTr = {
  title: "Ask About This Stock",
  intro: "Type your question; Claude answers only from the data on this page and gives no buy or sell advice.",
  label: "Your question about this stock",
  placeholder: "For example: did it beat estimates last quarter?",
  submit: "Ask",
  asking: "Claude is reading the page data…",
  remaining: "{n}/{limit} Questions Left Today",
  examplesLabel: "Example Questions",
  examples: ["Did it beat estimates last quarter?", "What do analysts say about this stock?", "Does it pay a dividend, and what is the yield?"],
  question: "Your Question",
  answer: "Claude's Answer",
  advice: "Not Advice",
  unanswerable: "I can't answer this question with the data on this page. Try asking about the price, valuation, earnings, analysts, dividends or the news.",
  sourcesLabel: "Data Used",
  sources: {
    session: "Last Session",
    valuation: "Valuation",
    scorecard: "Scorecard",
    analysts: "Analyst Ratings",
    earnings: "Earnings History",
    nextEarnings: "Next Earnings",
    dividends: "Dividends",
    news: "Headlines",
    notes: "Claude Notes",
  },
  newsLabel: "Source Headlines",
  session: "Data Through the {date} Close",
  signedOut: "Ask what you want to know about this stock; Claude answers only from the data on this page and gives no buy or sell advice. Sign in to ask.",
  signIn: "Sign In and Ask",
  previewTitle: "What an Answer Looks Like",
  previewText: "Claude writes one plain paragraph of at most 90 words. Every number in it must appear in this page's data; if one doesn't, the answer isn't shown at all. Below it you see which data it used and any source headlines.",
  previewSources: "Data an Answer Can Draw On",
  memberQuota: "{limit} Questions a Day for Members",
  errors: {
    quota: "You've used today's questions; you can ask again tomorrow.",
    busy: "Your previous question is still being answered; give it a few seconds.",
    budget: "Claude's share for today is used up; try again a little later.",
    rate: "That was quick; try again within a minute.",
    question: "The question should be between 3 and 300 characters.",
    auth: "Your session has ended; sign in again.",
    error: "Couldn't get an answer right now; try again shortly.",
  },
  disclosure:
    "Answers are written with Claude only from this page's data and the last completed session's close; every number in an answer must appear in that data. Not investment advice.",
};

export type WatchlistTodayLabels = typeof watchlistTodayTr;
export type AskStockLabels = typeof askStockTr;
