/* ==========================================================================
   Rehber — yapı katmanı

   Yazıların dilden bağımsız kimliği burada durur: slug, konu, glif ve
   ilişkili yazılar. Metinler dil başına ayrı dosyada (`tr.ts`, `en.ts`) ve
   ikisi de `Record<GuideSlug, GuideText>` tipinde — bir dile yazı ekleyip
   diğerini unutursan derleme kırılır. Sözlüklerdeki `en: typeof tr`
   güvencesinin buradaki karşılığı budur.

   Sıra bir müfredat: hiç bilmeyen biri baştan okuyabilsin diye yazılar
   konularına göre dört blokta duruyor ve her blok kendi içinde kolaydan
   zora ilerliyor. Yeni bir yazı eklerken doğru bloğa, doğru sıraya koy.
   ========================================================================== */

export const GUIDE_TOPICS = [
  {
    key: "temel",
    labelTr: "Temel Kavramlar",
    labelEn: "Basics",
    descTr:
      "Hisse, borsa, endeks, fon — piyasayı ilk kez okuyan birinin sırayla öğreneceği yapı taşları.",
    descEn:
      "Stocks, exchanges, indexes, funds — the building blocks, in the order a newcomer should learn them.",
  },
  {
    key: "strateji",
    labelTr: "Pozisyon ve Risk",
    labelEn: "Positions & Risk",
    descTr:
      "Emir vermekten pozisyon büyüklüğüne: kazanmayı değil, oyunda kalmayı belirleyen kararlar.",
    descEn:
      "From placing an order to sizing a position: the decisions that determine whether you stay in the game.",
  },
  {
    key: "sirket",
    labelTr: "Şirketi Okumak",
    labelEn: "Reading a Company",
    descTr:
      "Bilanço, nakit, değerleme, temettü — bir şirketin sayılarını okuyup fiyatın yanına koymak.",
    descEn:
      "Earnings, cash, valuation, dividends — reading a company's numbers and holding them up against the price.",
  },
  {
    key: "makro",
    labelTr: "Makro ve Merkez Bankası",
    labelEn: "Macro",
    descTr:
      "Faiz, enflasyon, istihdam ve Fed — borsayı borsanın dışından yöneten güçler.",
    descEn:
      "Rates, inflation, jobs and the Fed — the forces that steer the market from outside it.",
  },
] as const;

export type GuideTopicKey = (typeof GUIDE_TOPICS)[number]["key"];

/** Bir dilin taşıdığı metin — yapı `meta.ts`'te, metin dil dosyalarında. */
export type GuideText = {
  title: string;
  /** Kartta ve sayfa başında okunan tek cümle. */
  dek: string;
  bodyMd: string;
};

type GuideMetaEntry = {
  slug: string;
  topic: GuideTopicKey;
  /** Kart üstündeki tipografik işaret — ikon değil, kavramın kendi notasyonu. */
  glyph: string;
  /** Notasyonun İngilizce karşılığı farklıysa (TÜFE→CPI) burada durur. */
  glyphEn?: string;
  /** İlgili yazılar; sayfa sonunda bağlantı olarak çıkar. */
  related?: readonly string[];
};

/* Müfredat sırası — liste sayfası ve önceki/sıradaki gezinmesi bu sırayı okur. */
export const GUIDE_META = [
  /* ---- 1 · Temel Kavramlar --------------------------------------------- */
  {
    slug: "hisse-senedi",
    topic: "temel",
    glyph: "◧",
    related: ["borsa-nasil-isler", "bilanco", "halka-arz"],
  },
  {
    slug: "borsa-nasil-isler",
    topic: "temel",
    glyph: "⇄",
    related: ["emir-tipleri", "spread-likidite"],
  },
  {
    slug: "endeks",
    topic: "temel",
    glyph: "Σ",
    related: ["etf", "ayi-boga"],
  },
  {
    slug: "etf",
    topic: "temel",
    glyph: "ETF",
    related: ["endeks", "temettu"],
  },
  {
    slug: "volatilite",
    topic: "temel",
    glyph: "σ",
    related: ["ayi-boga", "risk-yonetimi", "opsiyonlar"],
  },
  {
    slug: "ayi-boga",
    topic: "temel",
    glyph: "▲▼",
    related: ["volatilite", "yatirimci-psikolojisi"],
  },
  {
    slug: "spread-likidite",
    topic: "temel",
    glyph: "⇔",
    related: ["borsa-nasil-isler", "emir-tipleri"],
  },
  {
    slug: "halka-arz",
    topic: "temel",
    glyph: "IPO",
    related: ["hisse-senedi", "piyasa-degeri"],
  },

  /* ---- 2 · Pozisyon ve Risk -------------------------------------------- */
  {
    slug: "emir-tipleri",
    topic: "strateji",
    glyph: "LMT",
    related: ["spread-likidite", "risk-yonetimi"],
  },
  {
    slug: "risk-yonetimi",
    topic: "strateji",
    glyph: "1R",
    related: ["cesitlendirme", "kaldirac"],
  },
  {
    slug: "cesitlendirme",
    topic: "strateji",
    glyph: "⁙",
    related: ["risk-yonetimi", "etf"],
  },
  {
    slug: "long-short",
    topic: "strateji",
    glyph: "L/S",
    related: ["kaldirac", "ayi-boga"],
  },
  {
    slug: "kaldirac",
    topic: "strateji",
    glyph: "4×",
    related: ["risk-yonetimi", "long-short", "opsiyonlar"],
  },
  {
    slug: "opsiyonlar",
    topic: "strateji",
    glyph: "C/P",
    related: ["kaldirac", "volatilite"],
  },
  {
    /* Opsiyonlardan SONRA: koruyucu put ile covered call'u anlatmak için
       primin, vadenin ve zaman erimesinin önce okunmuş olması gerekiyor.
       Kaldıraç ve long/short da ön koşul — hedge, o üç yazının kurduğu
       araçları bir araya getiren yazı. */
    slug: "hedge",
    topic: "strateji",
    glyph: "Δ",
    related: ["opsiyonlar", "long-short", "risk-yonetimi", "cesitlendirme"],
  },
  {
    slug: "yatirimci-psikolojisi",
    topic: "strateji",
    glyph: "!",
    related: ["risk-yonetimi", "ayi-boga"],
  },

  /* ---- 3 · Şirketi Okumak ---------------------------------------------- */
  {
    slug: "bilanco",
    topic: "sirket",
    glyph: "EPS",
    related: ["nakit-akisi", "degerleme", "temettu"],
  },
  {
    slug: "nakit-akisi",
    topic: "sirket",
    glyph: "FCF",
    related: ["bilanco", "degerleme"],
  },
  {
    slug: "degerleme",
    topic: "sirket",
    glyph: "F/K",
    glyphEn: "P/E",
    related: ["bilanco", "piyasa-degeri", "nakit-akisi"],
  },
  {
    slug: "piyasa-degeri",
    topic: "sirket",
    glyph: "Mr$",
    glyphEn: "$B",
    related: ["degerleme", "endeks"],
  },
  {
    slug: "temettu",
    topic: "sirket",
    glyph: "%",
    related: ["bilanco", "nakit-akisi"],
  },

  /* ---- 4 · Makro ve Merkez Bankası ------------------------------------- */
  {
    slug: "faiz-tahvil",
    topic: "makro",
    glyph: "10Y",
    related: ["sahin-guvercin", "enflasyon"],
  },
  {
    slug: "enflasyon",
    topic: "makro",
    glyph: "TÜFE",
    glyphEn: "CPI",
    related: ["faiz-tahvil", "sahin-guvercin", "istihdam"],
  },
  {
    slug: "istihdam",
    topic: "makro",
    glyph: "NFP",
    related: ["enflasyon", "sahin-guvercin"],
  },
  {
    slug: "sahin-guvercin",
    topic: "makro",
    glyph: "Fed",
    related: ["enflasyon", "istihdam", "faiz-tahvil"],
  },
  {
    slug: "kur-riski",
    topic: "makro",
    glyph: "₺/$",
    related: ["etf", "faiz-tahvil"],
  },
] as const satisfies readonly GuideMetaEntry[];

export type GuideSlug = (typeof GUIDE_META)[number]["slug"];
