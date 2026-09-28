/* ==========================================================================
   Sözlük — terim sayfasının görseli

   İKİ TÜR GÖRSEL VAR, ikisi de uydurma sayı taşımıyor:

   1. `blocks` — yazıların `:::` blok ailesi (ArticleBody çiziyor). Her
      satırdaki her sayı o terimin `example` metninden AYNEN geliyor; yeni
      bir örnek yazılmadı. Örnek metni değişirse buradaki satır da değişmeli
      — `tests/glossary.test.ts` her sayının örnekte geçtiğini denetliyor.
   2. `concept` — sayısız kavram çizimi (getiri eğrisinin eğimi, RSI'ın
      eşik bantları). Eşikler tanımın kendisinde yazılı (70 / 30);
      eksenlerde değer yok, çünkü hiçbir gerçek seriyi göstermiyor.

   Görsel yalnızca bir örneği ÇİZİLEBİLEN terimlerde var. Yüz elli terimin
   hepsine bir çizim uydurmak, çoğunda metni tekrar eden süs olurdu.

   Blok sözdizimi `docs/claude-rutinler.md` § 3; blok adları çevrilmez.
   ========================================================================== */

import type { GlossarySlug } from "./meta";

export type GlossaryConcept = "curve-normal" | "curve-inverted" | "rsi-bands";

export type GlossaryVisual =
  | { kind: "blocks"; tr: string; en: string }
  | { kind: "concept"; concept: GlossaryConcept; focus?: "high" | "low" };

export const GLOSSARY_VISUALS: Partial<Record<GlossarySlug, GlossaryVisual>> = {
  fk: {
    kind: "blocks",
    tr: "::: sayilar\n100 $ | Hisse Fiyatı\n5 $ | Yıllık Hisse Başı Kâr\n20 | F/K (100 / 5)\n:::",
    en: "::: sayilar\n$100 | Share Price\n$5 | Annual Earnings per Share\n20 | P/E (100 / 5)\n:::",
  },
  "peg-orani": {
    kind: "blocks",
    tr: "::: sayilar\n30 | F/K\n%15 | Beklenen Yıllık Kâr Büyümesi\n2 | PEG (30 / 15)\n:::",
    en: "::: sayilar\n30 | P/E\n15% | Expected Annual Earnings Growth\n2 | PEG (30 / 15)\n:::",
  },
  "temettu-verimi": {
    kind: "blocks",
    tr: "::: sayilar\n2 $ | Yıllık Temettü\n80 $ | Hisse Fiyatı\n%2,5 | Temettü Verimi (2 / 80)\n:::",
    en: "::: sayilar\n$2 | Annual Dividend\n$80 | Share Price\n2.5% | Dividend Yield (2 / 80)\n:::",
  },
  "brut-kar-marji": {
    kind: "blocks",
    tr: "::: pay 100 Milyon Dolarlık Satış Geliri\nSatılan Malın Maliyeti | 60\nBrüt Kâr | 40\n:::",
    en: "::: pay $100 Million of Revenue\nCost of Goods Sold | 60\nGross Profit | 40\n:::",
  },
  "faaliyet-kar-marji": {
    kind: "blocks",
    tr: "::: akis\nSatış Geliri | 100 Milyon $\nBrüt Kâr | 40 Milyon $\nFaaliyet Giderleri Düşülür | -25 Milyon $\nFaaliyet Kârı | 15 Milyon $\n:::\n\n::: sayilar\n%15 | Faaliyet Kâr Marjı (15 / 100)\n:::",
    en: "::: akis\nRevenue | $100 Million\nGross Profit | $40 Million\nSubtract Operating Expenses | -$25 Million\nOperating Income | $15 Million\n:::\n\n::: sayilar\n15% | Operating Margin (15 / 100)\n:::",
  },
  "firma-degeri": {
    kind: "blocks",
    tr: "::: akis\nPiyasa Değeri | 100 Milyar $\nBorç Eklenir | +30 Milyar $\nNakit Düşülür | -10 Milyar $\nFirma Değeri | 120 Milyar $\n:::",
    en: "::: akis\nMarket Cap | $100 billion\nAdd Debt | +$30 billion\nSubtract Cash | -$10 billion\nEnterprise Value | $120 billion\n:::",
  },
  "serbest-nakit-akisi": {
    kind: "blocks",
    tr: "::: akis\nİşletme Nakit Akışı | 8 Milyar $\nSermaye Harcaması Düşülür | -3 Milyar $\nSerbest Nakit Akışı | 5 Milyar $\n:::",
    en: "::: akis\nOperating Cash Flow | $8 billion\nSubtract Capital Expenditures | -$3 billion\nFree Cash Flow | $5 billion\n:::",
  },
  "hisse-bolunmesi": {
    kind: "blocks",
    tr: "::: akis\nBölünmeden Önce | 10 Hisse × 400 $\n4'e 1 Bölünme | Her hisse dörde ayrılır\nBölünmeden Sonra | 40 Hisse × 100 $\n:::\n\n::: sayilar\n4.000 $ | Önce de Sonra da Toplam Değer\n:::",
    en: "::: akis\nBefore the Split | 10 shares × $400\n4-for-1 Split | Each share becomes four\nAfter the Split | 40 shares × $100\n:::\n\n::: sayilar\n$4,000 | Total Value, Before and After\n:::",
  },
  spread: {
    kind: "blocks",
    tr: "::: sayilar\n49,90 $ | Alış Fiyatı\n50,10 $ | Satış Fiyatı\n20 sent | Spread\n:::",
    en: "::: sayilar\n$49.90 | Bid\n$50.10 | Ask\n20 cents | Spread\n:::",
  },
  "risk-getiri-orani": {
    kind: "blocks",
    tr: "::: akis\nZarar Durdur | 95 $\nGiriş | 100 $\nHedef | 115 $\n:::\n\n::: sayilar\n5 $ | Risk\n15 $ | Getiri\n1'e 3 | Oran\n:::",
    en: "::: akis\nStop | $95\nEntry | $100\nTarget | $115\n:::\n\n::: sayilar\n$5 | Risk\n$15 | Reward\n1 to 3 | Ratio\n:::",
  },
  rsi: { kind: "concept", concept: "rsi-bands" },
  "asiri-alim": { kind: "concept", concept: "rsi-bands", focus: "high" },
  "asiri-satim": { kind: "concept", concept: "rsi-bands", focus: "low" },
  "getiri-egrisi": { kind: "concept", concept: "curve-normal" },
  "ters-getiri-egrisi": { kind: "concept", concept: "curve-inverted" },
};
