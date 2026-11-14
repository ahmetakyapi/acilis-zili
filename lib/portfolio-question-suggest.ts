/**
 * "PORTFÖYÜNE SOR"UN HAZIR SORULARI (14 Kasım, sahibinin isteği: "hazır
 * sorular mantıklı olsun").
 *
 * Eskiden sözlükte dört SABİT soru vardı; her portföye aynı dördü
 * basılıyordu. Tek pozisyonlu portföyde "en çok hangi pozisyon ağır
 * basıyor?" ve "en büyük pozisyonumun yarısını satsam yoğunlaşmam ne olur?"
 * anlamsız; bilançosu yaklaşan pozisyonu olmayan portföyde "yaklaşan
 * bilançolar portföyümün ne kadarını ilgilendiriyor?" boş yanıt üretiyordu.
 *
 * KURAL (hisse sorusuyla aynı, lib/stock-question-suggest.ts): soru ancak
 * girdide karşılığı varsa basılır ve o günün durumuna göre sıralanır.
 * Girdi lib/portfolio-scan-model.ts → `scanInput` + risk bloğu + sunucunun
 * hesapladığı senaryo (lib/portfolio-question-core.ts):
 * - yaklaşan bilanço (10 gün) olan pozisyon varsa o soru başta;
 * - en büyük pozisyon `HEAVY_WEIGHT_PCT` ve üstündeyse yoğunlaşma ve
 *   "yarısını satsam" senaryosu öne geçer (senaryoyu SUNUCU hesaplar:
 *   `parseScenario` "en büyük pozisyonum"u ve "yarısını satsam"ı tanır —
 *   tests/portfolio-question-suggest.test.ts bunu ayrıştırıcıya karşı
 *   sınar; ayrıştırılamayan hazır soru "hesaplayamıyorum"a çıkardı);
 * - tek pozisyonda karşılaştırma, dağılım ve senaryo sorusu YOK;
 * - boş portföyde hiç soru yok (uç zaten "önce pozisyon ekle" der).
 * Fiyat senaryosu ("X %10 düşerse") SORULMAZ: ayrıştırıcı yalnız ağırlık
 * senaryolarını hesaplıyor (sat, yarısını sat, iki katına çıkar, %X'e
 * getir, %X ekle).
 *
 * SAHİBİN SORULARI: site sahibinin oturumunda (açık görüş istisnası,
 * .claude/rules/site-ici-claude.md) görüş isteyen soru da sunulur. Üyeye
 * ASLA: tavsiye isteyen soru üyede "Tavsiye veremem" yanıtına çıkar;
 * reddedilecek soru sunulmaz.
 *
 * Sorular küçük sayıları YAZIYLA yazar ("son beş seansta"): model sorudaki
 * sayıyı yanıtta tekrar ederse girdide karşılığı olmayabilir.
 *
 * Saf modül; testler tests/portfolio-question-suggest.test.ts.
 */

export const PORTFOLIO_STARTER_COUNT = 4;
/** En büyük pozisyonun "ağır" sayıldığı pay (%): yoğunlaşma sorusu öne geçer. */
export const HEAVY_WEIGHT_PCT = 25;
/** Risk ölçüleri (oynaklık, beta, korelasyon) en az bu kadar pozisyonda anlamlı bir soru. */
const RISK_MIN_POSITIONS = 3;

export type PortfolioStarterTopic = "ownerView" | "earnings" | "concentration" | "scenarioHalf" | "movers" | "sectors" | "cost" | "costOne" | "risk" | "position";

export type PortfolioStarterFacts = {
  /** Ayrı sembol sayısı (aynı hissenin lotları birleşik). */
  positionCount: number;
  /** En büyük pozisyonun payı (%), hesaplanamıyorsa null. */
  largestWeightPct: number | null;
  /** Ayrı sektör sayısı. */
  sectorCount: number;
  /** Önümüzdeki 10 günde bilanço açıklayacak pozisyon sayısı. */
  earningsSoonCount: number;
  /** Site sahibinin oturumu (açık görüş serbest). */
  owner: boolean;
};

export type PortfolioStarterCopy = Record<PortfolioStarterTopic, string>;

export type PortfolioStarter = { topic: PortfolioStarterTopic; text: string };

/** Portföyün o günkü durumuna göre hazır sorular, önem sırasıyla; en çok `max`. */
export function portfolioStarters(facts: PortfolioStarterFacts, copy: PortfolioStarterCopy, max = PORTFOLIO_STARTER_COUNT): PortfolioStarter[] {
  if (!(facts.positionCount > 0)) return [];
  const out: PortfolioStarter[] = [];
  const add = (topic: PortfolioStarterTopic) => out.push({ topic, text: copy[topic] });
  const many = facts.positionCount >= 2;
  const heavy = many && facts.largestWeightPct !== null && facts.largestWeightPct >= HEAVY_WEIGHT_PCT;

  if (facts.owner && many) add("ownerView");
  if (facts.earningsSoonCount > 0) add("earnings");
  if (!many) {
    /* Tek pozisyon: kıyas, dağılım ve senaryo yok; pozisyonun kendisi sorulur. */
    add("position");
    add("costOne");
    return out.slice(0, max);
  }
  if (heavy) {
    add("concentration");
    add("scenarioHalf");
    add("movers");
  } else {
    add("movers");
    add("concentration");
  }
  if (facts.sectorCount >= 2) add("sectors");
  add("cost");
  if (facts.positionCount >= RISK_MIN_POSITIONS) add("risk");
  if (!heavy) add("scenarioHalf");
  return out.slice(0, max);
}
