import type { AskSource } from "@/lib/stock-question-core";

/**
 * "Bu Hisseye Sor"un ÖNERİ ve TAKİP soruları (11 Kasım, sahibinin isteği:
 * "daha mantıklı sorular olsun, oradan seçsin veya kendisi soru sorsun").
 *
 * Eskiden üç sabit örnek vardı ("Son bilançoda beklentiyi aştı mı?",
 * "Analistler ne diyor?", "Temettü ödüyor mu?"): bilançosu dört gün sonra
 * olan hissede de, beş seansta %9 düşen hissede de, temettü ödemeyen
 * hissede de aynı üçü. Okurun aklındaki soru çoğu zaman o günün olayıydı.
 *
 * KURAL: soru ancak YANITLANABİLİRSE önerilir. Her konu yanıtın dayanacağı
 * veri bloğuna bağlı (lib/stock-question.ts → `buildContext`): bilanço 10
 * gün içinde değilse "yaklaşan bilanço", sitenin teknik analizi yoksa
 * "teknik görünüm", güncel analist hedefi yoksa "hedef" sorusu hiç çıkmaz.
 * Sıra o günün önemine göre: açıklanan bilanço → yaklaşan bilanço → büyük
 * hareket → 52 hafta bandının ucu → seviyeler → analistler → değerleme →
 * geçmiş → haberler → oynaklık → temettü → son seans.
 *
 * 14 KASIM TURU (sahibinin isteği: "hazır sorular mantıklı olsun"):
 * - HER SORU TEK ŞEY SORAR. "Yaklaşan bilançoda beklenti ne, son çeyreklerde
 *   tuttu mu?" iki soruydu; 90 kelimelik yanıt ikisini de yarım anlatıyordu.
 *   Artık iki ayrı hap ("piyasa ne bekliyor" ve "son bilançoda aştı mı").
 * - VERİ KOŞULU İNCELDİ. Beklenti sayısı yoksa "piyasa ne bekliyor" yerine
 *   "ne zaman açıklanacak"; verim hesaplanamıyorsa "verimi ne kadar" yerine
 *   "en son ne kadar ödedi"; hareketi açıklayacak haber ya da not yoksa
 *   "neden düştü" hiç çıkmaz (yanıtı "haberlerde görünmüyor" olurdu).
 * - YENİ DURUMLAR: bilanço son `EARNINGS_FRESH_DAYS` günde açıklandıysa
 *   "beklentiyi karşıladı mı" ve (ilk tepki seansı kapandıysa) "nasıl tepki
 *   verdi" başa geçer; kapanış 52 hafta bandının ucuna `RANGE_NEAR_PCT`
 *   kadar yakınsa "zirvesine/dibine ne kadar yakın".
 * - ÇEŞİTLİLİK (`diversify`): ilk dört hap farklı açılardan gelir (olay,
 *   seviye, analist, değerleme…); olay açısından en çok iki. Kalanlar önem
 *   sırasıyla arkada, takip sorularının havuzu.
 * - HAREKET YÜZDESİ GİRDİYLE AYNI YAZIMDA: hap "%12,7" diyorsa girdideki
 *   `last5Sessions` da tek ondalıklı (`MOVE_PCT_DIGITS`); model soruda
 *   gördüğü sayıyı yanıtta tekrar ederse sayı denetiminden düşmesin.
 * - SABİT ÖRNEK YEDEĞİ KALKTI. Öneri listesi boşsa kutu eskiden sözlükteki
 *   üç sabit soruya dönüyordu: verisi olmayan küçük şirkette tam da
 *   yanıtlanamayacak üç soru. Liste boşsa hap basılmaz, okur kendi yazar.
 *
 * TAKİP SORULARI SUNUCU KURALIYLA, MODELDEN DEĞİL. İki yol tartıldı:
 * modelin çıktı şemasına `followUps` eklemek ya da bu listeden seçmek.
 * Liste seçildi: (1) model takip sorusunu verinin yanıtlayamayacağı bir
 * şeye kolayca yöneltir, okur hapı basar ve "cevaplayamıyorum" görürdü;
 * buradaki her soru girdide karşılığı olan bir bloğa bağlı. (2) Model
 * çıktısı tıklanabilir soru metnine dönüşmez: haber başlığındaki bir
 * talimat okura "soru" olarak basılamaz, sayı denetimine ikinci bir yüzey
 * açılmaz. (3) Çıktı jetonu ve önbellek şekli değişmez. Takip, son yanıtın
 * KONUSUNA komşu konulardan seçilir (`RELATED`): bilanço sorusunun altında
 * hedef ve hareket, hedefin altında analist dağılımı ve sektör kıyası.
 *
 * Saf modül: istemci de çağırır (takip hapları yanıt gelince istemcide
 * seçilir), bu yüzden yalnız tür içe aktarır; testler
 * tests/stock-question-suggest.test.ts.
 */

export const SUGGEST_TOPICS = [
  "earningsOut",
  "earningsReaction",
  "earningsSoon",
  "earningsDate",
  "move",
  "range52",
  "technical",
  "target",
  "analysts",
  "sectorValue",
  "valuation",
  "lastEarnings",
  "news",
  "volatility",
  "dividend",
  "session",
] as const;
export type SuggestTopic = (typeof SUGGEST_TOPICS)[number];

export type Suggestion = { topic: SuggestTopic; text: string };

/** Sayfanın sunucuda zaten okuduğu verinin özeti; hiçbiri yeni sağlayıcı çağrısı değil. */
export type SuggestFacts = {
  /** Sıradaki bilançoya kalan takvim günü (ET); tarih yoksa null. */
  earningsInDays: number | null;
  /** Sıradaki bilanço için HBK ya da gelir beklentisi var. */
  hasConsensus: boolean;
  /** Son AÇIKLANAN bilançodan bu yana geçen takvim günü (ET); yoksa null. */
  reportedDaysAgo: number | null;
  /** O bilançonun ilk tepki seansı kapandı (girdide yüzdesi var). */
  hasEarningsReaction: boolean;
  /** Son beş tamamlanmış seansın toplam değişimi (%), yoksa null. */
  movePct: number | null;
  /** Hareketi açıklayabilecek haber başlığı ya da hazır not girdide var. */
  hasMoveEvidence: boolean;
  /** Son kapanış 52 hafta bandının hangi ucuna yakın; bant yoksa ya da ortadaysa null. */
  near52: "high" | "low" | null;
  /** Sitenin teknik analizi güncel ve destek ya da direnç seviyesi taşıyor. */
  hasTechnical: boolean;
  /** Güncel ortalama analist hedefi var. */
  hasTarget: boolean;
  /** Analist dağılımı var. */
  hasAnalysts: boolean;
  /** Sektör içi skor kartı kurulabildi. */
  hasScorecard: boolean;
  /** F/K (son 12 ay ya da ileri) girdide var. */
  hasValuation: boolean;
  /** Raporlanmış bilanço geçmişi var. */
  hasPastEarnings: boolean;
  /** Temettü ödüyor. */
  paysDividend: boolean;
  /** Temettü verimi girdide var. */
  hasDividendYield: boolean;
  /** Son iki haftadan haber başlığı var. */
  hasNews: boolean;
  /** Beta girdide var. */
  hasBeta: boolean;
  /** Son tamamlanmış seansın barı var. */
  hasSession: boolean;
};

export type SuggestCopy = {
  earningsOut: string;
  earningsReaction: string;
  earningsSoon: string;
  earningsDate: string;
  moveUp: string;
  moveDown: string;
  range52High: string;
  range52Low: string;
  technical: string;
  target: string;
  analysts: string;
  sectorValue: string;
  valuation: string;
  lastEarnings: string;
  news: string;
  volatility: string;
  dividendYield: string;
  dividendLast: string;
  session: string;
};

/** "Yaklaşan bilanço" penceresi, takvim günü (sahibinin örneği: "10 gün içindeyse"). */
export const EARNINGS_SOON_DAYS = 10;
/**
 * "Bilanço yeni açıklandı" penceresi, takvim günü. Hafta sonunu da kapsasın
 * diye beş: cuma kapanış sonrası açıklayan şirketin tepki seansı pazartesi,
 * okur salı günü hâlâ "ne oldu" diye soruyor. Daha eskisi "son bilanço".
 */
export const EARNINGS_FRESH_DAYS = 5;
/**
 * "Neden hareket etti" eşiği: beş seansta mutlak %4. S&P 500'ün tipik beş
 * seanslık oynaması bunun yarısının altında; %4 ve üstü okurun "ne oldu?"
 * diye sorduğu boy. Eşiğin altındaki hafta için soru önerilmez — "neden
 * %0,8 yükseldi?" sorusunun yanıtı yok.
 */
export const MOVE_MIN_PCT = 4;
/** Hareket yüzdesinin ondalığı — hapta ve girdinin `last5Sessions` alanında AYNI. */
export const MOVE_PCT_DIGITS = 1;
/** 52 hafta bandının ucuna "yakın" sayılan uzaklık (uç değerin yüzdesi). */
export const RANGE_NEAR_PCT = 3;
export const STARTER_COUNT = 4;
export const FOLLOW_UP_COUNT = 3;

/** Son kapanış 52 hafta bandının hangi ucuna `RANGE_NEAR_PCT` kadar yakın. */
export function nearRangeEdge(close: number | null, low: number | null | undefined, high: number | null | undefined): "high" | "low" | null {
  if (close === null || !low || !high || !(close > 0) || !(low > 0) || !(high > low)) return null;
  if (close >= high * (1 - RANGE_NEAR_PCT / 100)) return "high";
  if (close <= low * (1 + RANGE_NEAR_PCT / 100)) return "low";
  return null;
}

/* Sorunun AÇISI: ilk dört hap aynı açıdan iki soru taşımasın (olay hariç;
   bilanço haftasında "beklenti" ile "neden düştü" ikisi de günün sorusu). */
type Angle = "event" | "levels" | "street" | "value" | "history" | "risk" | "income" | "session";
const ANGLE: Record<SuggestTopic, Angle> = {
  earningsOut: "event",
  earningsReaction: "event",
  earningsSoon: "event",
  earningsDate: "event",
  move: "event",
  news: "event",
  range52: "levels",
  technical: "levels",
  target: "street",
  analysts: "street",
  sectorValue: "value",
  valuation: "value",
  lastEarnings: "history",
  volatility: "risk",
  dividend: "income",
  session: "session",
};
const ANGLE_CAP: Partial<Record<Angle, number>> = { event: 2 };

/** Önem sırasını bozmadan açıları öne dağıtır: önce her açının ilk(ler)i, sonra kalanlar. */
function diversify(items: Suggestion[]): Suggestion[] {
  const taken = new Map<Angle, number>();
  const front: Suggestion[] = [];
  const back: Suggestion[] = [];
  for (const item of items) {
    const angle = ANGLE[item.topic];
    const n = taken.get(angle) ?? 0;
    if (n < (ANGLE_CAP[angle] ?? 1)) {
      taken.set(angle, n + 1);
      front.push(item);
    } else back.push(item);
  }
  return [...front, ...back];
}

/** O günün veriye bağlı soruları, önem sırasıyla. `formatPct` mutlak değeri okurun dilinde yazar. */
export function rankSuggestions(facts: SuggestFacts, copy: SuggestCopy, formatPct: (abs: number) => string): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (topic: SuggestTopic, text: string) => out.push({ topic, text });
  const fresh = facts.reportedDaysAgo !== null && facts.reportedDaysAgo >= 0 && facts.reportedDaysAgo <= EARNINGS_FRESH_DAYS;
  const reacted = fresh && facts.hasEarningsReaction;
  const upcoming = facts.earningsInDays !== null && facts.earningsInDays >= 0;
  const soon = upcoming && facts.earningsInDays! <= EARNINGS_SOON_DAYS;
  if (fresh) add("earningsOut", copy.earningsOut);
  if (reacted) add("earningsReaction", copy.earningsReaction);
  /* Beklenti sayısı yoksa "ne bekleniyor"un yanıtı yok; tarih yine sorulur. */
  if (soon) add(facts.hasConsensus ? "earningsSoon" : "earningsDate", facts.hasConsensus ? copy.earningsSoon : copy.earningsDate);
  /* Bilanço tepkisi sorulmuşken "neden hareket etti" aynı soruyu ikinci kez
     sorardı; nedeni anlatacak haber ya da not yoksa soru hiç çıkmaz. */
  if (!reacted && facts.hasMoveEvidence && facts.movePct !== null && Number.isFinite(facts.movePct) && Math.abs(facts.movePct) >= MOVE_MIN_PCT) {
    add("move", (facts.movePct > 0 ? copy.moveUp : copy.moveDown).replace("{pct}", formatPct(Math.abs(facts.movePct))));
  }
  if (facts.near52) add("range52", facts.near52 === "high" ? copy.range52High : copy.range52Low);
  if (facts.hasTechnical) add("technical", copy.technical);
  if (facts.hasTarget) add("target", copy.target);
  /* Hedef sorusunun yanıtı dağılımı da anlatıyor; ikisi birden aynı soru. */
  else if (facts.hasAnalysts) add("analysts", copy.analysts);
  if (facts.hasScorecard) add("sectorValue", copy.sectorValue);
  /* Sektör kıyası çarpanları da kapsıyor; yalnız kıyas yokken. */
  else if (facts.hasValuation) add("valuation", copy.valuation);
  /* Yeni açıklanan bilanço zaten "son bilanço"; aynı soru iki kez çıkmasın. */
  if (facts.hasPastEarnings && !fresh) add("lastEarnings", copy.lastEarnings);
  /* Bilanço takvimde ama pencerenin dışındaysa tarih sorusu arkada durur. */
  if (upcoming && !soon) add("earningsDate", copy.earningsDate);
  if (facts.hasNews) add("news", copy.news);
  if (facts.hasBeta) add("volatility", copy.volatility);
  if (facts.paysDividend) add("dividend", facts.hasDividendYield ? copy.dividendYield : copy.dividendLast);
  if (facts.hasSession) add("session", copy.session);
  return diversify(out);
}

/** Bir konunun yanıtından sonra akla gelen komşu konular, yakından uzağa. */
const RELATED: Record<SuggestTopic, SuggestTopic[]> = {
  earningsOut: ["earningsReaction", "target", "analysts", "sectorValue", "news"],
  earningsReaction: ["earningsOut", "technical", "range52", "target", "news"],
  earningsSoon: ["lastEarnings", "target", "move", "analysts"],
  earningsDate: ["lastEarnings", "target", "analysts"],
  move: ["news", "technical", "earningsSoon", "range52", "session"],
  range52: ["technical", "move", "target", "sectorValue"],
  technical: ["range52", "move", "target", "session"],
  target: ["analysts", "sectorValue", "technical", "earningsSoon"],
  analysts: ["target", "sectorValue", "lastEarnings"],
  sectorValue: ["valuation", "target", "volatility", "dividend"],
  valuation: ["sectorValue", "target", "dividend"],
  lastEarnings: ["earningsSoon", "earningsDate", "target", "analysts", "sectorValue"],
  news: ["move", "earningsSoon", "technical", "target"],
  volatility: ["range52", "technical", "sectorValue", "session"],
  dividend: ["valuation", "sectorValue", "volatility"],
  session: ["move", "news", "technical"],
};

/** Okurun kendi yazdığı sorunun konusu, yanıtın dayandığı bloklardan. */
const SOURCE_TOPICS: Record<AskSource, SuggestTopic[]> = {
  session: ["session", "move"],
  technical: ["technical"],
  valuation: ["valuation", "sectorValue"],
  scorecard: ["sectorValue"],
  analysts: ["analysts", "target"],
  target: ["target"],
  earnings: ["lastEarnings", "earningsOut"],
  nextEarnings: ["earningsSoon", "earningsDate"],
  dividends: ["dividend"],
  news: ["news", "move"],
  notes: ["move"],
};

/**
 * Yanıtın altındaki takip soruları: önce son yanıtın konusuna komşu
 * konular, sonra havuzun kalanı önem sırasıyla. Sorulmuş soru (metniyle ya
 * da konusuyla) ve son yanıtın kendi konusu tekrar önerilmez.
 */
export function pickFollowUps(
  pool: readonly Suggestion[],
  last: { topic: SuggestTopic | null; sources: readonly AskSource[] },
  asked: { texts: readonly string[]; topics: readonly SuggestTopic[] },
  max = FOLLOW_UP_COUNT,
): Suggestion[] {
  const current = new Set<SuggestTopic>(last.topic ? [last.topic] : last.sources.flatMap((source) => SOURCE_TOPICS[source] ?? []));
  const askedTexts = new Set(asked.texts.map((text) => text.trim().toLocaleLowerCase("tr-TR")));
  const askedTopics = new Set(asked.topics);
  const open = pool.filter(
    (item) => !current.has(item.topic) && !askedTopics.has(item.topic) && !askedTexts.has(item.text.trim().toLocaleLowerCase("tr-TR")),
  );
  const near = [...current].flatMap((topic) => RELATED[topic]);
  const rank = (item: Suggestion) => {
    const at = near.indexOf(item.topic);
    return at === -1 ? near.length + pool.indexOf(item) : at;
  };
  return [...open].sort((a, b) => rank(a) - rank(b)).slice(0, max);
}
