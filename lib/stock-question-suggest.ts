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
 * Sıra o günün önemine göre: yaklaşan olay → büyük hareket → seviyeler →
 * analistler → değerleme → geçmiş → temettü → son seans.
 *
 * TAKİP SORULARI SUNUCU KURALIYLA, MODELDEN DEĞİL. İki yol tartıldı:
 * modelin çıktı şemasına `followUps` eklemek ya da bu listeden seçmek.
 * Liste seçildi: (1) model takip sorusunu verinin yanıtlayamayacağı bir
 * şeye ("geçmişte bilançoya nasıl tepki verdi?" — girdide fiyat tepkisi
 * yok) kolayca yöneltir, okur hapı basar ve "cevaplayamıyorum" görürdü;
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
  "earningsSoon",
  "move",
  "technical",
  "target",
  "analysts",
  "sectorValue",
  "valuation",
  "lastEarnings",
  "dividend",
  "session",
] as const;
export type SuggestTopic = (typeof SUGGEST_TOPICS)[number];

export type Suggestion = { topic: SuggestTopic; text: string };

/** Sayfanın sunucuda zaten okuduğu verinin özeti; hiçbiri yeni sağlayıcı çağrısı değil. */
export type SuggestFacts = {
  /** Sıradaki bilançoya kalan takvim günü (ET); tarih yoksa null. */
  earningsInDays: number | null;
  /** Son beş tamamlanmış seansın toplam değişimi (%), yoksa null. */
  movePct: number | null;
  /** Sitenin teknik analizi var ve güncel. */
  hasTechnical: boolean;
  /** Güncel ortalama analist hedefi var. */
  hasTarget: boolean;
  /** Analist dağılımı var. */
  hasAnalysts: boolean;
  /** Sektör içi skor kartı kurulabildi. */
  hasScorecard: boolean;
  /** F/K gibi değerleme çarpanı var. */
  hasValuation: boolean;
  /** Raporlanmış bilanço geçmişi var. */
  hasPastEarnings: boolean;
  /** Temettü ödüyor. */
  paysDividend: boolean;
  /** Son tamamlanmış seansın barı var. */
  hasSession: boolean;
};

export type SuggestCopy = Record<Exclude<SuggestTopic, "move">, string> & { moveUp: string; moveDown: string };

/** "Yaklaşan bilanço" penceresi, takvim günü (sahibinin örneği: "10 gün içindeyse"). */
export const EARNINGS_SOON_DAYS = 10;
/**
 * "Neden hareket etti" eşiği: beş seansta mutlak %4. S&P 500'ün tipik beş
 * seanslık oynaması bunun yarısının altında; %4 ve üstü okurun "ne oldu?"
 * diye sorduğu boy. Eşiğin altındaki hafta için soru önerilmez — "neden
 * %0,8 yükseldi?" sorusunun yanıtı yok.
 */
export const MOVE_MIN_PCT = 4;
export const STARTER_COUNT = 4;
export const FOLLOW_UP_COUNT = 3;

/** O günün veriye bağlı soruları, önem sırasıyla. `formatPct` mutlak değeri okurun dilinde yazar. */
export function rankSuggestions(facts: SuggestFacts, copy: SuggestCopy, formatPct: (abs: number) => string): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (topic: SuggestTopic, text: string) => out.push({ topic, text });
  const earningsSoon = facts.earningsInDays !== null && facts.earningsInDays >= 0 && facts.earningsInDays <= EARNINGS_SOON_DAYS;
  if (earningsSoon) add("earningsSoon", copy.earningsSoon);
  if (facts.movePct !== null && Number.isFinite(facts.movePct) && Math.abs(facts.movePct) >= MOVE_MIN_PCT) {
    add("move", (facts.movePct > 0 ? copy.moveUp : copy.moveDown).replace("{pct}", formatPct(Math.abs(facts.movePct))));
  }
  if (facts.hasTechnical) add("technical", copy.technical);
  if (facts.hasTarget) add("target", copy.target);
  /* Hedef sorusunun yanıtı dağılımı da anlatıyor; ikisi birden aynı soru. */
  else if (facts.hasAnalysts) add("analysts", copy.analysts);
  if (facts.hasScorecard) add("sectorValue", copy.sectorValue);
  /* Sektör kıyası çarpanları da kapsıyor; yalnız kıyas yokken. */
  else if (facts.hasValuation) add("valuation", copy.valuation);
  /* Yaklaşan bilanço sorusu "son çeyreklerde tuttu mu?" diye de soruyor. */
  if (facts.hasPastEarnings && !earningsSoon) add("lastEarnings", copy.lastEarnings);
  if (facts.paysDividend) add("dividend", copy.dividend);
  if (facts.hasSession) add("session", copy.session);
  return out;
}

/** Bir konunun yanıtından sonra akla gelen komşu konular, yakından uzağa. */
const RELATED: Record<SuggestTopic, SuggestTopic[]> = {
  earningsSoon: ["target", "move", "lastEarnings", "analysts"],
  move: ["technical", "earningsSoon", "target", "session"],
  technical: ["move", "target", "session"],
  target: ["analysts", "sectorValue", "technical", "earningsSoon"],
  analysts: ["target", "sectorValue", "lastEarnings"],
  sectorValue: ["valuation", "target", "dividend"],
  valuation: ["sectorValue", "dividend", "target"],
  lastEarnings: ["earningsSoon", "target", "analysts", "sectorValue"],
  dividend: ["valuation", "sectorValue", "session"],
  session: ["move", "technical", "earningsSoon"],
};

/** Okurun kendi yazdığı sorunun konusu, yanıtın dayandığı bloklardan. */
const SOURCE_TOPICS: Record<AskSource, SuggestTopic[]> = {
  session: ["session", "move"],
  technical: ["technical"],
  valuation: ["valuation", "sectorValue"],
  scorecard: ["sectorValue"],
  analysts: ["analysts", "target"],
  target: ["target"],
  earnings: ["lastEarnings"],
  nextEarnings: ["earningsSoon"],
  dividends: ["dividend"],
  news: ["move"],
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
