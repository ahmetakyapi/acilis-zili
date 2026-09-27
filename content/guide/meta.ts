/* ==========================================================================
   Rehber — yapı katmanı

   Yazıların dilden bağımsız kimliği burada durur: slug, konu, glif ve
   ilişkili yazılar. Metinler dil başına ayrı dosyada (`tr.ts`, `en.ts`) ve
   ikisi de `Record<GuideSlug, GuideText>` tipinde — bir dile yazı ekleyip
   diğerini unutursan derleme kırılır. Sözlüklerdeki `en: typeof tr`
   güvencesinin buradaki karşılığı budur.

   Bu dosyadaki DİZİLİŞ ekrandaki sıra DEĞİL. Burada yazılar konu bloklarında
   ve blok içinde anlatı yakınlığına göre duruyor — hangi yazı hangisinin
   hemen ardından okununca anlamlı, o bilgi aşağıdaki yorumlarda. Okuyucunun
   gördüğü sıra `index.ts`'te bundan türetiliyor: konu bloğu, sonra zorluk.
   Sıralama kararlı olduğu için aynı seviyedeki komşuluklar korunuyor.

   Yeni yazı eklerken doğru bloğa ve anlatı olarak ait olduğu yere koy;
   seviyesini `level` ile işaretle. Sıralamayı düşünme, o türetiliyor.
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
      "Hesap açmaktan vergiye, emirden pozisyon büyüklüğüne: kazanmayı değil, oyunda kalmayı belirleyen kararlar.",
    descEn:
      "From opening an account to taxes, from placing an order to sizing a position: the decisions that determine whether you stay in the game.",
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

/* ==========================================================================
   Zorluk

   Müfredat zaten kolaydan zora sıralı ama ekranda bunu söyleyen bir şey
   yoktu: 32 yazılık bir listeye ilk kez bakan biri nereden başlayacağını
   ancak başlıkları okuyup tahmin ederek buluyordu.

   Seviye YAZI YAZI UYDURULMUYOR, konudan türüyor. Otuz iki yazıya tek tek
   "bu orta seviyedir" diye not düşmek uydurma bir kesinlik olurdu; konular
   zaten bir zorluk merdiveni. Konunun genel seviyesinden AÇIKÇA ayrılan
   yazılar (bir ön koşul zinciri gerektiren ya da tersine giriş niteliğinde
   olanlar) tek tek işaretleniyor — istisna listesi kısa tutuluyor ki kural
   okunabilir kalsın.
   ========================================================================== */

export const GUIDE_LEVELS = ["temel", "orta", "ileri"] as const;
export type GuideLevel = (typeof GUIDE_LEVELS)[number];

/** Konunun varsayılan seviyesi — istisna işaretlenmemişse bu geçerli. */
const TOPIC_LEVEL: Record<GuideTopicKey, GuideLevel> = {
  temel: "temel",
  strateji: "orta",
  sirket: "orta",
  makro: "orta",
};

export function guideLevel(entry: {
  topic: GuideTopicKey;
  level?: GuideLevel;
}): GuideLevel {
  return entry.level ?? TOPIC_LEVEL[entry.topic];
}

export function guideLevelLabel(level: GuideLevel, locale: string): string {
  if (locale === "tr") {
    return level === "temel" ? "Temel" : level === "orta" ? "Orta" : "İleri";
  }
  return level === "temel"
    ? "Basic"
    : level === "orta"
      ? "Intermediate"
      : "Advanced";
}

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
  /** Konunun varsayılan seviyesinden AÇIKÇA ayrılıyorsa — bkz. § Zorluk. */
  level?: GuideLevel;
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
    related: ["endeks", "temettu", "endeks-fonu-mu-tek-hisse-mi", "kripto-etf"],
  },
  {
    /* ETF'ten hemen sonra: o yazı fonun ne olduğunu anlatıyor, bu yazı
       "fon mu, şirket mi" kararını. Getirinin çarpık dağılımı ve şirkete
       özgü risk burada ilk kez geçiyor; çeşitlendirme yazısı aynı fikri
       portföy düzeyinde büyütüyor. */
    slug: "endeks-fonu-mu-tek-hisse-mi",
    topic: "temel",
    glyph: "1:500",
    related: ["etf", "cesitlendirme", "duzenli-alim", "endeks"],
  },
  {
    /* ETF yapısının özel bir hâli: yaratma/itfa, takip farkı ve gider
       oranı ETF yazısında okunmuş olmalı. Orta seviye çünkü vadeli işlem
       yenileme maliyeti ve tröst yapısı ek kavram. */
    slug: "kripto-etf",
    topic: "temel",
    level: "orta", // ETF mekaniği + vadeli işlem yenilemesi + tröst yapısı
    glyph: "₿",
    related: ["etf", "volatilite", "spread-likidite", "endeks-fonu-mu-tek-hisse-mi"],
  },
  {
    slug: "volatilite",
    topic: "temel",
    glyph: "σ",
    related: ["ayi-boga", "risk-yonetimi", "opsiyonlar", "beklenen-hareket"],
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
    related: ["borsa-nasil-isler", "emir-tipleri", "araci-kurum-secimi", "konferans-gorusmesi"],
  },
  {
    slug: "halka-arz",
    topic: "temel",
    glyph: "IPO",
    related: ["hisse-senedi", "piyasa-degeri", "adr-spac", "10k-10q"],
  },
  {
    /* Halka arzın kardeşi: ikisi de "bir şirket ABD borsasına nasıl girer"
       sorusunun cevabı. ADR yabancı şirketin, SPAC ise klasik arzın
       dışındaki yolu anlatıyor. Seyrelme aritmetiği yüzünden orta. */
    slug: "adr-spac",
    topic: "temel",
    level: "orta", // depo bankası, kur katmanı ve SPAC seyrelmesi
    glyph: "ADR",
    related: ["halka-arz", "kur-riski", "10k-10q", "w-8ben"],
  },

  /* ---- 2 · Pozisyon ve Risk -------------------------------------------- */
  {
    /* Bloğun kapısı: ilk emirden önce hesabın açılması, paranın dolara
       çevrilmesi ve W-8BEN geliyor. Emir tipleri bu yazının dördüncü
       adımını büyütüyor; o yüzden hemen önünde duruyor. */
    slug: "abd-hisse-nasil-alinir",
    topic: "strateji",
    level: "temel", // ön koşulu yok; bir ABD hissesine giden ilk adım
    glyph: "₺→$",
    related: ["araci-kurum-secimi", "w-8ben", "emir-tipleri", "yurt-disi-hisse-vergisi"],
  },
  {
    slug: "araci-kurum-secimi",
    topic: "strateji",
    level: "temel", // hesap açmadan önce okunuyor
    glyph: "SIPC",
    related: ["abd-hisse-nasil-alinir", "spread-likidite", "kesirli-hisse", "kur-riski"],
  },
  {
    slug: "emir-tipleri",
    topic: "strateji",
    level: "temel", // ilk emri verirken okunuyor, ön koşulu yok
    glyph: "LMT",
    related: ["spread-likidite", "risk-yonetimi", "abd-hisse-nasil-alinir", "kesirli-hisse"],
  },
  {
    /* Emir tiplerinin ardından: kesirli emir, emir tipleri ve seans
       erişiminde kısıtlarla geliyor ve o kısıtlar ancak emir tipleri
       bilinince okunuyor. */
    slug: "kesirli-hisse",
    topic: "strateji",
    level: "temel", // tek mekanizma, ön koşulu emir tipleri
    glyph: "0,25",
    glyphEn: "0.25",
    related: ["araci-kurum-secimi", "duzenli-alim", "hisse-senedi", "yurt-disi-hisse-vergisi"],
  },
  {
    /* Vergi çifti: önce ABD'nin kestiği (W-8BEN), sonra Türkiye'de
       beyan edilen. İkincisi temettü bölümünde birincinin %20'sine
       yaslanıyor; sıra bu yüzden sabit. */
    slug: "w-8ben",
    topic: "strateji",
    glyph: "W-8",
    related: ["yurt-disi-hisse-vergisi", "temettu-takvimi", "abd-hisse-nasil-alinir", "adr-spac"],
  },
  {
    slug: "yurt-disi-hisse-vergisi",
    topic: "strateji",
    glyph: "Beyan",
    glyphEn: "Tax",
    related: ["w-8ben", "kur-riski", "temettu", "abd-hisse-nasil-alinir"],
  },
  {
    slug: "risk-yonetimi",
    topic: "strateji",
    level: "temel", // en erken okunması gereken yazı; ön koşul değil ön şart
    glyph: "1R",
    related: ["cesitlendirme", "kaldirac"],
  },
  {
    slug: "cesitlendirme",
    topic: "strateji",
    glyph: "⁙",
    related: ["risk-yonetimi", "etf", "endeks-fonu-mu-tek-hisse-mi", "duzenli-alim"],
  },
  {
    /* Çeşitlendirmenin zaman eksenindeki karşılığı: o yazı riski
       varlıklara, bu yazı alım anlarına yayıyor. Mekanizma tek bir
       ortalama eşitsizliği; ön koşulu yok. */
    slug: "duzenli-alim",
    topic: "strateji",
    level: "temel", // tek hesap, davranış tarafı ağır basıyor
    glyph: "DCA",
    related: ["yatirimci-psikolojisi", "kesirli-hisse", "endeks-fonu-mu-tek-hisse-mi", "risk-yonetimi"],
  },
  {
    slug: "long-short",
    topic: "strateji",
    glyph: "L/S",
    related: ["kaldirac", "ayi-boga"],
  },
  {
    /* Long/short'a yaslanıyor: sıkışmayı anlatmak için açığa satışın
       mekaniği (ödünç hisse, geri alma zorunluluğu) okunmuş olmalı. Ekranda
       bitişik durmuyorlar — bu ileri, long/short orta — ama ön koşul yine de
       önce geliyor ve `related` ikisini birbirine bağlıyor. */
    slug: "kisa-sikisma",
    topic: "strateji",
    level: "ileri", // long/short mekaniği + ödünç hisse zinciri gerekiyor
    glyph: "⇈",
    related: ["long-short", "yatirimci-psikolojisi", "volatilite"],
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
    level: "ileri", // prim, vade ve zaman erimesi üç ayrı kavram
    glyph: "C/P",
    related: ["kaldirac", "volatilite", "beklenen-hareket", "hedge"],
  },
  {
    /* Opsiyonlardan SONRA: primin zaman ve oynaklık parçası orada
       anlatılıyor, burada o parçanın içinden piyasanın beklediği hareket
       okunuyor. Opsiyon işlemi değil, opsiyon FİYATINI okuma yazısı. */
    slug: "beklenen-hareket",
    topic: "strateji",
    level: "ileri", // örtük oynaklık, straddle ve karekök ölçekleme
    glyph: "±%",
    related: ["opsiyonlar", "volatilite", "bilanco-gunu-nasil-okunur", "konferans-gorusmesi"],
  },
  {
    /* Opsiyonlardan SONRA: koruyucu put ile covered call'u anlatmak için
       primin, vadenin ve zaman erimesinin önce okunmuş olması gerekiyor.
       Kaldıraç ve long/short da ön koşul — hedge, o üç yazının kurduğu
       araçları bir araya getiren yazı. */
    slug: "hedge",
    topic: "strateji",
    level: "ileri", // opsiyon + long/short + risk yönetimi üçünün üstüne kuruluyor
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
    related: ["nakit-akisi", "degerleme", "temettu", "10k-10q"],
  },
  {
    /* Bilançonun kaynağı: o yazı tabloları, bu yazı tabloların durduğu
       belgeyi ve dipnotları okumayı öğretiyor. */
    slug: "10k-10q",
    topic: "sirket",
    glyph: "10-K",
    related: ["bilanco", "nakit-akisi", "konferans-gorusmesi", "insider-islemleri"],
  },
  {
    /* Bilançodan hemen sonra: o yazı tabloları okumayı öğretiyor, bu yazı
       AÇIKLAMA GÜNÜNÜ okumayı — beklenti, sapma ve rehberlik üçlüsünü.
       İkisi ayrı çünkü sayıyı anlamak ile fiyatın neden ters yöne gittiğini
       anlamak farklı iki iş. */
    slug: "bilanco-gunu-nasil-okunur",
    topic: "sirket",
    glyph: "4Ç",
    glyphEn: "Q4",
    related: ["bilanco", "degerleme", "konferans-gorusmesi", "beklenen-hareket"],
  },
  {
    /* Bilanço gününün ikinci yarısı: sayılar bültende, rehberliğin nasıl
       anlatıldığı görüşmede. Bilanço günü yazısının hemen ardından. */
    slug: "konferans-gorusmesi",
    topic: "sirket",
    glyph: "Q&A",
    related: ["bilanco-gunu-nasil-okunur", "10k-10q", "beklenen-hareket", "spread-likidite"],
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
    level: "temel", // tek kavram, tek cümlelik tanım
    glyph: "%",
    related: ["bilanco", "nakit-akisi", "hisse-geri-alimi", "temettu-takvimi"],
  },
  {
    /* Temettünün takvim tarafı: dört tarih temettü yazısında tanıtılıyor,
       burada T+1 ile değişen kural ve hak kesme sabahının hesabı işleniyor.
       Temettüyle birlikte bloğun başına geçiyor. */
    slug: "temettu-takvimi",
    topic: "sirket",
    level: "temel", // tek kural: hak kesmeden bir önceki iş günü
    glyph: "Ex",
    related: ["temettu", "w-8ben", "yurt-disi-hisse-vergisi", "borsa-nasil-isler"],
  },
  {
    /* Temettünün karşı yakası: ikisi de "şirket kazandığı parayı hissedara
       nasıl döndürür" sorusunun cevabı ve yazı sürekli temettüyle
       karşılaştırma yaparak ilerliyor. Temettü bloğun tek `temel` yazısı
       olduğu için ekranda başa geçiyor, bu ise orta bandın içinde kalıyor. */
    slug: "hisse-geri-alimi",
    topic: "sirket",
    glyph: "↺",
    related: ["temettu", "bilanco", "degerleme", "insider-islemleri"],
  },
  {
    /* Geri alımın öteki yüzü: şirket kendi hissesini alırken yöneticiler
       ne yapıyor? Form 4'ü okumak için 10-K/10-Q'daki hisse bazlı ödeme
       dipnotunun bilinmesi işi kolaylaştırıyor. */
    slug: "insider-islemleri",
    topic: "sirket",
    glyph: "P/S",
    related: ["10k-10q", "hisse-geri-alimi", "yatirimci-psikolojisi", "bilanco"],
  },

  /* ---- 4 · Makro ve Merkez Bankası ------------------------------------- */
  {
    slug: "faiz-tahvil",
    topic: "makro",
    glyph: "10Y",
    related: ["sahin-guvercin", "enflasyon"],
  },
  {
    /* Faiz-tahvilin devamı: eğrinin ne olduğu orada anlatılıyor, burada
       TERSİNE DÖNMESİ işleniyor. Ayrı yazı çünkü sinyalin kendisi kadar
       "sinyal ile olay arasındaki gecikme" de anlatılması gereken bir şey.
       Ekranda araya orta seviyedeki makro yazıları giriyor; ön koşul yine de
       önce okunmuş oluyor. */
    slug: "getiri-egrisi",
    topic: "makro",
    level: "ileri", // iki ucun ayrı ayrı ne fiyatladığını bilmeyi gerektiriyor
    glyph: "2s10s",
    related: ["faiz-tahvil", "sahin-guvercin", "ayi-boga"],
  },
  {
    slug: "enflasyon",
    topic: "makro",
    glyph: "TÜFE",
    glyphEn: "CPI",
    related: ["faiz-tahvil", "sahin-guvercin", "istihdam", "yurt-disi-hisse-vergisi"],
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
    related: ["etf", "faiz-tahvil", "yurt-disi-hisse-vergisi", "abd-hisse-nasil-alinir"],
  },
  {
    /* Makro bloğunun SONU: faiz, enflasyon, istihdam ve eğri okunduktan
       sonra "peki bu bilgi hangi sektöre para akıtır" sorusunu cevaplıyor.
       Müfredatın da doğal kapanışı — makroyu portföye bağlayan yazı. */
    slug: "sektor-rotasyonu",
    topic: "makro",
    level: "ileri", // faiz, iskonto ve döngü — makro bloğunun tamamı ön koşul
    glyph: "◷",
    related: ["faiz-tahvil", "getiri-egrisi", "endeks", "cesitlendirme"],
  },
] as const satisfies readonly GuideMetaEntry[];

export type GuideSlug = (typeof GUIDE_META)[number]["slug"];
