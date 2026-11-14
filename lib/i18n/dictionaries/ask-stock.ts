/**
 * `askStock` (Bu Hisseye Sor) ad alanı — 11 Kasım'da page-claude.ts'ten
 * kendi dosyasına taşındı (bölüm sohbete döndü, metin iki katına çıktı).
 * page-claude.ts aynı adları yeniden dışa aktarıyor: tr.ts / en.ts'teki
 * içe aktarma ve `askStock:` anahtarı değişmedi.
 *
 * `suggest`: veriye göre seçilen öneri soruları (lib/stock-question-suggest.ts).
 * Soru cümlesi oldukları için cümle düzeninde; `{pct}` mutlak beş seanslık
 * değişim, okurun dilinde biçimli ("%7,4" / "7.4%"). Her soru yanıtın
 * dayanacağı veri bloğuna göre yazıldı ve TEK şey sorar (14 Kasım; eski
 * "beklenti ne, son çeyreklerde tuttu mu?" iki soruydu). Hangi sorunun
 * hangi veri varken çıktığı `rankSuggestions`ta; burada yalnız metin.
 * Sabit `examples` listesi 14 Kasım'da kalktı (veri yokken basılıyor ve
 * yanıtlanamayan üç soru sunuyordu).
 */

export const askStockTr = {
  title: "Bu Hisseye Sor",
  composerLabel: "Kendi Sorun",
  chatPlaceholder: "Bir soru yaz",
  send: "Soruyu gönder",
  asking: "Claude sayfanın verisini okuyor…",
  remaining: "{n}/{limit} Soru Hakkı Kaldı",
  startersLabel: "Bugün Sorulabilecekler",
  followUpsLabel: "Sıradaki Sorular",
  threadLabel: "Bu hisse hakkındaki sohbet",
  you: "Sen",
  claude: "Claude",
  reset: "Sohbeti Temizle",
  retry: "Yeniden Dene",
  suggest: {
    earningsOut: "Açıklanan bilanço beklentiyi karşıladı mı?",
    earningsReaction: "Hisse bilançoya ilk seansta nasıl tepki verdi?",
    earningsSoon: "Yaklaşan bilançoda piyasa ne bekliyor?",
    earningsDate: "Sıradaki bilanço ne zaman açıklanacak?",
    moveUp: "Son beş seansta neden {pct} yükseldi?",
    moveDown: "Son beş seansta neden {pct} düştü?",
    range52High: "52 haftalık zirvesine ne kadar yakın?",
    range52Low: "52 haftalık dibine ne kadar yakın?",
    technical: "Teknik analizde destek ve direnç seviyeleri nerede?",
    target: "Analistlerin ortalama hedef fiyatı son kapanışın neresinde?",
    analysts: "Analistlerin görüşü nasıl dağılıyor?",
    sectorValue: "Sektöründeki şirketlere göre pahalı mı?",
    valuation: "F/K oranı kaç?",
    lastEarnings: "Son bilançoda beklentiyi aştı mı?",
    news: "Son haberlerde öne çıkan ne var?",
    volatility: "Piyasaya göre ne kadar oynak?",
    dividendYield: "Temettü verimi ne kadar?",
    dividendLast: "Hisse başına ne kadar temettü ödüyor?",
    session: "Son seansı nasıl kapattı?",
  },
  advice: "Tavsiye Değil",
  unanswerable: "Bu soruyu sayfadaki veriyle cevaplayamıyorum. Fiyat, değerleme, bilanço, analistler, temettü ya da haberlerle ilgili bir soru deneyebilirsin.",
  sourcesLabel: "Yararlanılan Veri",
  sources: {
    session: "Son Seans",
    technical: "Teknik Analiz",
    valuation: "Değerleme",
    scorecard: "Skor Kartı",
    analysts: "Analist Dağılımı",
    target: "Analist Hedefi",
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
  composerLabel: "Your Question",
  chatPlaceholder: "Write a question",
  send: "Send question",
  asking: "Claude is reading the page data…",
  remaining: "{n}/{limit} Questions Left Today",
  startersLabel: "Worth Asking Today",
  followUpsLabel: "Ask Next",
  threadLabel: "Conversation about this stock",
  you: "You",
  claude: "Claude",
  reset: "Clear Conversation",
  retry: "Try Again",
  suggest: {
    earningsOut: "Did the latest earnings meet expectations?",
    earningsReaction: "How did the stock react in the first session after earnings?",
    earningsSoon: "What does the market expect from the upcoming earnings?",
    earningsDate: "When is the next earnings report?",
    moveUp: "Why is it up {pct} over the last five sessions?",
    moveDown: "Why is it down {pct} over the last five sessions?",
    range52High: "How close is it to its 52-week high?",
    range52Low: "How close is it to its 52-week low?",
    technical: "Where are the support and resistance levels?",
    target: "Where is the average analyst target versus the last close?",
    analysts: "How are the analyst ratings split?",
    sectorValue: "Is it expensive compared with its sector peers?",
    valuation: "What is its P/E ratio?",
    lastEarnings: "Did it beat estimates last quarter?",
    news: "What stands out in the recent news?",
    volatility: "How volatile is it compared with the market?",
    dividendYield: "What is the dividend yield?",
    dividendLast: "How much does it pay in dividends per share?",
    session: "How did it close the last session?",
  },
  advice: "Not Advice",
  unanswerable: "I can't answer this question with the data on this page. Try asking about the price, valuation, earnings, analysts, dividends or the news.",
  sourcesLabel: "Data Used",
  sources: {
    session: "Last Session",
    technical: "Technical Analysis",
    valuation: "Valuation",
    scorecard: "Scorecard",
    analysts: "Analyst Ratings",
    target: "Analyst Target",
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

export type AskStockLabels = typeof askStockTr;
