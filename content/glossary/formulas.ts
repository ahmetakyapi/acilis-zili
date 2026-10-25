/* ==========================================================================
   Sözlük — terimin formülü (25 Ekim, öğrenme araçlarının görsel turu)

   Kavram işareti (`marks.ts`) bir ŞEKİL çiziyordu: oran terimlerinin hepsi
   aynı "pay ve payda" karosunu taşıyordu ve F/K ile PD/DD, Cari Oran ile
   Borç/Özsermaye kartta birbirinin kopyasıydı. Okuyucunun sorusu "bu oran
   neyi neye bölüyor"; cevap tanımın ilk cümlesinde yazılı ama cümlenin
   içinde. Formül o cümlenin ÇİZİLMİŞ hâli: pay üstte, çizgi, payda altta.

   UYDURMA YOK, İKİ KURAL:
   1. Her satır terimin kendi tanımından (iki dilde de). Pay ve payda
      tanımda geçen kelimeler; tanımı gerçekten bir bölme, çarpma ya da
      çıkarma olmayan terim burada YOK (Firma Değeri bir toplam ve fark
      zinciri, ikiden fazla kalem: kesre sığdırmak eksik anlatmak olurdu).
   2. Sayı yok. Kadranın eşikleri (RSI 30 / 70, PMI 50) tanımın kendisinde
      yazılı; iğne basılmıyor, çünkü hiçbir gerçek okumayı göstermiyor.

   `Partial`, `Record` değil: yüz elli terimin çoğunun formülü yok ve
   olmayan terim kartta kavram işaretiyle kalıyor. Test
   (`tests/glossary-visuals.test.ts`) her slug'ın sözlükte olduğunu ve iki
   dilin dolu olduğunu denetliyor.
   ========================================================================== */

import type { GlossarySlug } from "./meta";

export type FormulaOp = "divide" | "multiply" | "subtract";

type Sides = { a: string; b: string };

export type GlossaryFormula =
  | {
      kind: "formula";
      op: FormulaOp;
      /** Bölmede a pay, b payda; çarpma ve çıkarmada soldan sağa. */
      tr: Sides;
      en: Sides;
      /** Tanım "gelire oranı / as a percentage" diyorsa: sonuç yüzde okunur. */
      percent?: boolean;
    }
  | {
      kind: "dial";
      /** RSI ailesi 0-30-70-100; PMI 0-50-100. */
      scale: "rsi" | "pmi";
      /** Terimin anlattığı bölge — kadranda o dilim koyu. */
      focus?: "high" | "low";
    };

const ratio = (tr: Sides, en: Sides, percent?: boolean): GlossaryFormula => ({
  kind: "formula",
  op: "divide",
  tr,
  en,
  ...(percent ? { percent } : {}),
});

export const GLOSSARY_FORMULAS: Partial<Record<GlossarySlug, GlossaryFormula>> = {
  /* Değerleme — tanımlar "…bölünmesidir / … divided by …". */
  fk: ratio({ a: "Hisse Fiyatı", b: "Hisse Başı Kâr" }, { a: "Share Price", b: "Earnings per Share" }),
  "pd-dd": ratio({ a: "Piyasa Değeri", b: "Defter Değeri" }, { a: "Market Cap", b: "Book Value" }),
  "fd-favok": ratio({ a: "Firma Değeri", b: "Yıllık FAVÖK" }, { a: "Enterprise Value", b: "Annual EBITDA" }),
  "fiyat-satis-orani": ratio({ a: "Piyasa Değeri", b: "Yıllık Satış Geliri" }, { a: "Market Cap", b: "Annual Revenue" }),
  "peg-orani": ratio({ a: "F/K", b: "Beklenen Yıllık HBK Büyümesi (%)" }, { a: "P/E", b: "Expected EPS Growth (%)" }),
  "temettu-verimi": ratio(
    { a: "Hisse Başı Yıllık Temettü", b: "Hisse Fiyatı" },
    { a: "Annual Dividend per Share", b: "Share Price" },
    true,
  ),
  "hisse-basi-kar": ratio({ a: "Net Kâr", b: "Ortalama Hisse Sayısı" }, { a: "Net Income", b: "Average Shares Outstanding" }),
  "aktif-karliligi": ratio({ a: "Net Kâr", b: "Toplam Varlıklar" }, { a: "Net Income", b: "Total Assets" }, true),
  "ozsermaye-karliligi": ratio({ a: "Net Kâr", b: "Özsermaye" }, { a: "Net Income", b: "Shareholders' Equity" }, true),
  "borc-ozsermaye-orani": ratio({ a: "Borç", b: "Özsermaye" }, { a: "Debt", b: "Shareholders' Equity" }),
  "cari-oran": ratio({ a: "Dönen Varlıklar", b: "Kısa Vadeli Yükümlülükler" }, { a: "Current Assets", b: "Current Liabilities" }),
  "brut-kar-marji": ratio({ a: "Brüt Kâr", b: "Gelir" }, { a: "Gross Profit", b: "Revenue" }, true),
  "faaliyet-kar-marji": ratio({ a: "Faaliyet Kârı", b: "Gelir" }, { a: "Operating Income", b: "Revenue" }, true),
  "net-kar-marji": ratio({ a: "Net Kâr", b: "Gelir" }, { a: "Net Income", b: "Revenue" }, true),
  "temettu-dagitim-orani": ratio({ a: "Dağıtılan Temettü", b: "Net Kâr" }, { a: "Dividends Paid", b: "Net Income" }, true),
  "risk-getiri-orani": ratio({ a: "Olası Zarar", b: "Olası Kazanç" }, { a: "Potential Loss", b: "Potential Gain" }),

  /* Çarpma ve çıkarma — tanımda iki kalem ve tek işlem. */
  "piyasa-degeri": {
    kind: "formula",
    op: "multiply",
    tr: { a: "Hisse Fiyatı", b: "Hisse Sayısı" },
    en: { a: "Share Price", b: "Shares Outstanding" },
  },
  "defter-degeri": {
    kind: "formula",
    op: "subtract",
    tr: { a: "Toplam Varlıklar", b: "Toplam Yükümlülükler" },
    en: { a: "Total Assets", b: "Total Liabilities" },
  },
  "reel-faiz": {
    kind: "formula",
    op: "subtract",
    tr: { a: "Nominal Faiz", b: "Enflasyon" },
    en: { a: "Nominal Rate", b: "Inflation" },
  },

  /* Kadranlar — eşikler tanımda. */
  rsi: { kind: "dial", scale: "rsi" },
  "asiri-alim": { kind: "dial", scale: "rsi", focus: "high" },
  "asiri-satim": { kind: "dial", scale: "rsi", focus: "low" },
  pmi: { kind: "dial", scale: "pmi" },
};

/** Kadranın eşikleri — tanımdaki sayılar (RSI 30/70, PMI 50). */
export const DIAL_THRESHOLDS = {
  rsi: [30, 70],
  pmi: [50],
} as const;
