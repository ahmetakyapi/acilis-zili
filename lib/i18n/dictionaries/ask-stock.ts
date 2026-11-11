/**
 * `askStock` (Bu Hisseye Sor) ad alanı — 11 Kasım'da page-claude.ts'ten
 * kendi dosyasına taşındı (bölüm sohbete döndü, metin iki katına çıktı).
 * page-claude.ts aynı adları yeniden dışa aktarıyor: tr.ts / en.ts'teki
 * içe aktarma ve `askStock:` anahtarı değişmedi.
 *
 * `suggest`: veriye göre seçilen öneri soruları (lib/stock-question-suggest.ts).
 * Soru cümlesi oldukları için cümle düzeninde; `{pct}` mutlak beş seanslık
 * değişim, okurun dilinde biçimli ("%7,4" / "7.4%"). Her soru yanıtın
 * dayanacağı veri bloğuna göre yazıldı: "geçmişte bilançoya nasıl tepki
 * verdi?" sorulmuyor, çünkü girdide bilanço sonrası fiyat tepkisi yok;
 * yerine "son çeyreklerde tuttu mu?" (bilanço geçmişi bloğu).
 */

export const askStockTr = {
  title: "Bu Hisseye Sor",
  composerLabel: "Kendi Sorun",
  chatPlaceholder: "Bir soru yaz",
  send: "Soruyu gönder",
  asking: "Claude sayfanın verisini okuyor…",
  remaining: "{n}/{limit} Soru Hakkı Kaldı",
  examplesLabel: "Örnek Sorular",
  examples: ["Son bilançoda beklentiyi aştı mı?", "Analistler bu hisse için ne diyor?", "Temettü ödüyor mu, verimi ne kadar?"],
  startersLabel: "Bugün Sorulabilecekler",
  followUpsLabel: "Sıradaki Sorular",
  threadLabel: "Bu hisse hakkındaki sohbet",
  you: "Sen",
  claude: "Claude",
  reset: "Sohbeti Temizle",
  retry: "Yeniden Dene",
  suggest: {
    earningsSoon: "Yaklaşan bilançoda beklenti ne, son çeyreklerde tuttu mu?",
    moveUp: "Son beş seansta neden {pct} yükseldi?",
    moveDown: "Son beş seansta neden {pct} düştü?",
    technical: "Teknik görünüm ne diyor, destekler nerede?",
    target: "Analistlerin ortalama hedefi ne söylüyor?",
    analysts: "Analistler bu hisse için ne diyor?",
    sectorValue: "Sektörüne göre pahalı mı, ucuz mu?",
    valuation: "Değerleme çarpanları ne gösteriyor?",
    lastEarnings: "Son bilançoda beklentiyi aştı mı?",
    dividend: "Temettü ödüyor mu, verimi ne kadar?",
    session: "Son seans nasıl geçti, piyasaya göre nerede?",
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
  examplesLabel: "Example Questions",
  examples: ["Did it beat estimates last quarter?", "What do analysts say about this stock?", "Does it pay a dividend, and what is the yield?"],
  startersLabel: "Worth Asking Today",
  followUpsLabel: "Ask Next",
  threadLabel: "Conversation about this stock",
  you: "You",
  claude: "Claude",
  reset: "Clear Conversation",
  retry: "Try Again",
  suggest: {
    earningsSoon: "What's expected from the upcoming earnings, and has it been beating?",
    moveUp: "Why is it up {pct} over the last five sessions?",
    moveDown: "Why is it down {pct} over the last five sessions?",
    technical: "What does the technical picture say, where is support?",
    target: "What does the average analyst target say?",
    analysts: "What do analysts say about this stock?",
    sectorValue: "Is it expensive or cheap versus its sector?",
    valuation: "What do the valuation multiples show?",
    lastEarnings: "Did it beat estimates last quarter?",
    dividend: "Does it pay a dividend, and what is the yield?",
    session: "How did the last session go versus the market?",
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
