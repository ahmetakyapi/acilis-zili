/* ==========================================================================
   Sözlük — yapı katmanı

   Rehberin üç katmanlı düzeninin aynısı (`content/guide/meta.ts`): kimlik,
   kategori, ilişkiler ve rehber bağı burada; metinler dil başına ayrı
   dosyalarda (`tr/*.ts`, `en/*.ts`) ve her kategori dosyası
   `GlossaryTexts<"kategori">` tipinde. Bir dile terim ekleyip ötekini
   unutursan derleme kırılır — sözlükteki `en: typeof tr` güvencesinin
   buradaki karşılığı.

   NEDEN VERİTABANINDA DEĞİL: tanımlar durağan ve editoryal. Yanlış bir tanım
   eski bir fiyattan pahalı; kod incelemesinden geçsin, sürüm geçmişinde
   dursun. Rehberle aynı gerekçe.

   Metin dosyaları kategori başına bölünmüş, tek dosya değil: yüz elli terim
   iki dilde tek dosyada ~3.000 satır ediyordu ve bir kategoriye bakan
   editör öteki yedisinin içinde kayboluyordu.
   ========================================================================== */

import type { GuideSlug } from "@/content/guide/meta";

export const GLOSSARY_CATEGORIES = [
  {
    key: "degerleme",
    labelTr: "Değerleme ve Temel Analiz",
    labelEn: "Valuation & Fundamentals",
  },
  {
    key: "piyasa",
    labelTr: "Piyasa İşleyişi",
    labelEn: "Market Mechanics",
  },
  {
    key: "makro",
    labelTr: "Makro ve Fed",
    labelEn: "Macro & the Fed",
  },
  {
    key: "teknik",
    labelTr: "Teknik Analiz",
    labelEn: "Technical Analysis",
  },
  {
    key: "bilanco",
    labelTr: "Bilanço Dönemi",
    labelEn: "Earnings Season",
  },
  {
    key: "opsiyon",
    labelTr: "Opsiyonlar",
    labelEn: "Options",
  },
  {
    key: "vergi",
    labelTr: "Vergi ve Türkiye",
    labelEn: "Tax & Turkey",
  },
  {
    key: "iceriden",
    labelTr: "Bildirimler ve İçeriden İşlemler",
    labelEn: "Filings & Insiders",
  },
] as const;

export type GlossaryCategoryKey = (typeof GLOSSARY_CATEGORIES)[number]["key"];

type GlossaryMetaEntry = {
  slug: string;
  category: GlossaryCategoryKey;
  /** İlişkili terimler — sayfa sonunda bağlantı. Tip değil test denetliyor
      (dizi kendi kendine başvuramıyor): `tests/glossary.test.ts`. */
  related?: readonly string[];
  /** Kavramı uzun uzun anlatan rehber yazısı varsa. */
  guide?: GuideSlug;
  /**
   * Daha dar konulu ikinci rehber yazısı — DÜZ DİZE, `GuideSlug` değil.
   * Bu yazıların bir kısmı başka bir dalda yazıldı ve bu dal onları henüz
   * görmüyor; tipe bağlansaydı derleme kırılırdı. `GuideHint` bilinmeyen
   * slug'ı sessizce düşürüyor, yani yazı birleşince bağlantı kendiliğinden
   * beliriyor. Test yazının VAR olmasını şart koşmuyor, biçimini denetliyor.
   */
  guideMore?: string;
};

/* Kategori içindeki sıra ekranda KULLANILMIYOR — liste alfabetik diziliyor
   (Türkçe harf sırasıyla). Buradaki sıra kavram yakınlığı: yeni terimi
   komşusunun yanına koy. */
export const GLOSSARY_META = [
  /* ---- Değerleme ve Temel Analiz --------------------------------------- */
  { slug: "fk", category: "degerleme", guide: "degerleme", related: ["hisse-basi-kar", "peg-orani", "pd-dd", "fd-favok"] },
  { slug: "pd-dd", category: "degerleme", guide: "degerleme", related: ["defter-degeri", "fk", "ozsermaye-karliligi"] },
  { slug: "fd-favok", category: "degerleme", guide: "degerleme", related: ["firma-degeri", "favok", "fk"] },
  { slug: "peg-orani", category: "degerleme", guide: "degerleme", related: ["fk", "hisse-basi-kar"] },
  { slug: "fiyat-satis-orani", category: "degerleme", guide: "degerleme", related: ["gelir", "fk"] },
  { slug: "hisse-basi-kar", category: "degerleme", guide: "bilanco", related: ["seyreltilmis-hisse-basi-kar", "fk", "eps-surprizi"] },
  { slug: "seyreltilmis-hisse-basi-kar", category: "degerleme", guide: "bilanco", related: ["hisse-basi-kar", "hisse-seyrelmesi"] },
  { slug: "gelir", category: "degerleme", guide: "bilanco", related: ["brut-kar-marji", "fiyat-satis-orani"] },
  { slug: "brut-kar-marji", category: "degerleme", guide: "bilanco", related: ["faaliyet-kar-marji", "net-kar-marji", "gelir"] },
  { slug: "faaliyet-kar-marji", category: "degerleme", guide: "bilanco", related: ["brut-kar-marji", "net-kar-marji", "favok"] },
  { slug: "net-kar-marji", category: "degerleme", guide: "bilanco", related: ["faaliyet-kar-marji", "hisse-basi-kar"] },
  { slug: "favok", category: "degerleme", guide: "nakit-akisi", related: ["fd-favok", "faaliyet-kar-marji", "serbest-nakit-akisi"] },
  { slug: "gaap-disi", category: "degerleme", guide: "bilanco", related: ["hisse-basi-kar", "hisse-bazli-odeme", "favok"] },
  { slug: "isletme-nakit-akisi", category: "degerleme", guide: "nakit-akisi", related: ["serbest-nakit-akisi", "sermaye-harcamasi"] },
  { slug: "serbest-nakit-akisi", category: "degerleme", guide: "nakit-akisi", related: ["isletme-nakit-akisi", "sermaye-harcamasi", "iskontolu-nakit-akisi"] },
  { slug: "sermaye-harcamasi", category: "degerleme", guide: "nakit-akisi", related: ["serbest-nakit-akisi", "isletme-nakit-akisi"] },
  { slug: "iskontolu-nakit-akisi", category: "degerleme", guide: "degerleme", related: ["serbest-nakit-akisi", "reel-faiz"] },
  { slug: "ozsermaye-karliligi", category: "degerleme", guide: "degerleme", related: ["aktif-karliligi", "pd-dd", "borc-ozsermaye-orani"] },
  { slug: "aktif-karliligi", category: "degerleme", guide: "degerleme", related: ["ozsermaye-karliligi", "net-kar-marji"] },
  { slug: "borc-ozsermaye-orani", category: "degerleme", guide: "bilanco", related: ["cari-oran", "ozsermaye-karliligi", "kaldirac"] },
  { slug: "cari-oran", category: "degerleme", guide: "bilanco", related: ["borc-ozsermaye-orani", "likidite"] },
  { slug: "defter-degeri", category: "degerleme", guide: "degerleme", related: ["pd-dd", "ozsermaye-karliligi"] },
  { slug: "piyasa-degeri", category: "degerleme", guide: "piyasa-degeri", related: ["firma-degeri", "halka-aciklik", "hisse-bolunmesi"] },
  { slug: "firma-degeri", category: "degerleme", guide: "degerleme", related: ["piyasa-degeri", "fd-favok"] },
  { slug: "temettu", category: "degerleme", guide: "temettu", related: ["temettu-verimi", "temettu-dagitim-orani", "hak-dusum-tarihi"] },
  { slug: "temettu-verimi", category: "degerleme", guide: "temettu", related: ["temettu", "temettu-dagitim-orani", "stopaj"] },
  { slug: "temettu-dagitim-orani", category: "degerleme", guide: "temettu", related: ["temettu", "temettu-verimi", "serbest-nakit-akisi"] },
  { slug: "hisse-geri-alimi", category: "degerleme", guide: "hisse-geri-alimi", related: ["hisse-basi-kar", "hisse-seyrelmesi", "temettu"] },
  { slug: "hisse-seyrelmesi", category: "degerleme", guide: "piyasa-degeri", related: ["seyreltilmis-hisse-basi-kar", "hisse-bazli-odeme", "hisse-geri-alimi"] },

  /* ---- Piyasa İşleyişi -------------------------------------------------- */
  { slug: "alis-satis-fiyati", category: "piyasa", guide: "spread-likidite", related: ["spread", "limit-emir", "piyasa-yapici"] },
  { slug: "spread", category: "piyasa", guide: "spread-likidite", related: ["alis-satis-fiyati", "likidite"] },
  { slug: "likidite", category: "piyasa", guide: "spread-likidite", related: ["spread", "islem-hacmi", "piyasa-yapici"] },
  { slug: "piyasa-yapici", category: "piyasa", guide: "borsa-nasil-isler", related: ["likidite", "spread"] },
  { slug: "islem-hacmi", category: "piyasa", guide: "spread-likidite", related: ["likidite", "vwap"] },
  { slug: "on-seans", category: "piyasa", guide: "borsa-nasil-isler", related: ["kapanis-sonrasi", "likidite"] },
  { slug: "kapanis-sonrasi", category: "piyasa", guide: "borsa-nasil-isler", related: ["on-seans", "bilanco-sezonu"] },
  { slug: "devre-kesici", category: "piyasa", guide: "volatilite", related: ["volatilite", "on-seans"] },
  { slug: "araci-kurum", category: "piyasa", guide: "borsa-nasil-isler", related: ["t-1-takas", "kesirli-hisse", "marj-hesabi"], guideMore: "araci-kurum-secimi" },
  { slug: "t-1-takas", category: "piyasa", guide: "borsa-nasil-isler", related: ["araci-kurum", "hak-dusum-tarihi"], guideMore: "abd-hisse-nasil-alinir" },
  { slug: "kesirli-hisse", category: "piyasa", guide: "hisse-senedi", related: ["araci-kurum", "hisse-bolunmesi"], guideMore: "kesirli-hisse" },
  { slug: "piyasa-emri", category: "piyasa", guide: "emir-tipleri", related: ["limit-emir", "stop-emir", "spread"] },
  { slug: "limit-emir", category: "piyasa", guide: "emir-tipleri", related: ["piyasa-emri", "stop-emir", "alis-satis-fiyati"] },
  { slug: "stop-emir", category: "piyasa", guide: "emir-tipleri", related: ["limit-emir", "piyasa-emri", "risk-getiri-orani"] },
  { slug: "aciga-satis", category: "piyasa", guide: "long-short", related: ["kisa-sikisma", "marj-hesabi"] },
  { slug: "kisa-sikisma", category: "piyasa", guide: "kisa-sikisma", related: ["aciga-satis", "halka-aciklik"] },
  { slug: "marj-hesabi", category: "piyasa", guide: "kaldirac", related: ["kaldirac", "aciga-satis"] },
  { slug: "kaldirac", category: "piyasa", guide: "kaldirac", related: ["marj-hesabi", "borc-ozsermaye-orani"] },
  { slug: "halka-arz", category: "piyasa", guide: "halka-arz", related: ["spac", "kilitlenme-suresi", "halka-aciklik"] },
  { slug: "spac", category: "piyasa", guide: "halka-arz", related: ["halka-arz", "hisse-seyrelmesi"], guideMore: "adr-spac" },
  { slug: "adr", category: "piyasa", guide: "kur-riski", related: ["kur-farki", "stopaj"], guideMore: "adr-spac" },
  { slug: "halka-aciklik", category: "piyasa", guide: "piyasa-degeri", related: ["piyasa-degeri", "kisa-sikisma"] },
  { slug: "hisse-bolunmesi", category: "piyasa", guide: "piyasa-degeri", related: ["ters-bolunme", "piyasa-degeri", "kesirli-hisse"] },
  { slug: "ters-bolunme", category: "piyasa", guide: "piyasa-degeri", related: ["hisse-bolunmesi"] },
  { slug: "endeks", category: "piyasa", guide: "endeks", related: ["etf", "piyasa-degeri", "cesitlendirme"], guideMore: "endeks-fonu-mu-tek-hisse-mi" },
  { slug: "etf", category: "piyasa", guide: "etf", related: ["endeks", "cesitlendirme"], guideMore: "endeks-fonu-mu-tek-hisse-mi" },
  { slug: "cesitlendirme", category: "piyasa", guide: "cesitlendirme", related: ["etf", "beta"] },
  { slug: "volatilite", category: "piyasa", guide: "volatilite", related: ["beta", "vix", "atr"] },
  { slug: "beta", category: "piyasa", guide: "volatilite", related: ["volatilite", "cesitlendirme"] },
  { slug: "boga-piyasasi", category: "piyasa", guide: "ayi-boga", related: ["ayi-piyasasi", "duzeltme"] },
  { slug: "ayi-piyasasi", category: "piyasa", guide: "ayi-boga", related: ["boga-piyasasi", "duzeltme", "resesyon"] },
  { slug: "duzeltme", category: "piyasa", guide: "ayi-boga", related: ["ayi-piyasasi", "boga-piyasasi"] },

  /* ---- Makro ve Fed ----------------------------------------------------- */
  { slug: "tufe", category: "makro", guide: "enflasyon", related: ["cekirdek-enflasyon", "pce", "ufe"] },
  { slug: "cekirdek-enflasyon", category: "makro", guide: "enflasyon", related: ["tufe", "pce"] },
  { slug: "pce", category: "makro", guide: "enflasyon", related: ["tufe", "cekirdek-enflasyon", "fomc"] },
  { slug: "ufe", category: "makro", guide: "enflasyon", related: ["tufe"] },
  { slug: "fomc", category: "makro", guide: "sahin-guvercin", related: ["politika-faizi", "nokta-grafigi", "sahin"] },
  { slug: "politika-faizi", category: "makro", guide: "faiz-tahvil", related: ["fomc", "baz-puan", "reel-faiz"] },
  { slug: "nokta-grafigi", category: "makro", guide: "sahin-guvercin", related: ["fomc", "politika-faizi"] },
  { slug: "sahin", category: "makro", guide: "sahin-guvercin", related: ["guvercin", "fomc"] },
  { slug: "guvercin", category: "makro", guide: "sahin-guvercin", related: ["sahin", "fomc"] },
  { slug: "baz-puan", category: "makro", guide: "faiz-tahvil", related: ["politika-faizi", "hazine-tahvili"] },
  { slug: "hazine-tahvili", category: "makro", guide: "faiz-tahvil", related: ["getiri-egrisi", "reel-faiz", "baz-puan"] },
  { slug: "reel-faiz", category: "makro", guide: "faiz-tahvil", related: ["hazine-tahvili", "tufe"] },
  { slug: "getiri-egrisi", category: "makro", guide: "getiri-egrisi", related: ["ters-getiri-egrisi", "hazine-tahvili"] },
  { slug: "ters-getiri-egrisi", category: "makro", guide: "getiri-egrisi", related: ["getiri-egrisi", "resesyon"] },
  { slug: "niceliksel-gevseme", category: "makro", guide: "faiz-tahvil", related: ["niceliksel-sikilasma", "hazine-tahvili"] },
  { slug: "niceliksel-sikilasma", category: "makro", guide: "faiz-tahvil", related: ["niceliksel-gevseme", "politika-faizi"] },
  { slug: "tarim-disi-istihdam", category: "makro", guide: "istihdam", related: ["issizlik-orani", "jolts", "issizlik-basvurulari"] },
  { slug: "issizlik-orani", category: "makro", guide: "istihdam", related: ["tarim-disi-istihdam", "sahm-kurali"] },
  { slug: "sahm-kurali", category: "makro", guide: "istihdam", related: ["issizlik-orani", "resesyon"] },
  { slug: "jolts", category: "makro", guide: "istihdam", related: ["tarim-disi-istihdam", "issizlik-orani"] },
  { slug: "issizlik-basvurulari", category: "makro", guide: "istihdam", related: ["issizlik-orani", "tarim-disi-istihdam"] },
  { slug: "gsyh", category: "makro", guide: "sektor-rotasyonu", related: ["resesyon", "pmi", "perakende-satislar"] },
  { slug: "resesyon", category: "makro", guide: "getiri-egrisi", related: ["gsyh", "sahm-kurali", "ters-getiri-egrisi"] },
  { slug: "pmi", category: "makro", guide: "sektor-rotasyonu", related: ["gsyh", "perakende-satislar"] },
  { slug: "perakende-satislar", category: "makro", guide: "sektor-rotasyonu", related: ["gsyh", "pmi"] },
  { slug: "dolar-endeksi", category: "makro", guide: "kur-riski", related: ["kur-farki", "reel-faiz"] },

  /* ---- Teknik Analiz ----------------------------------------------------- */
  { slug: "hareketli-ortalama", category: "teknik", related: ["ussel-hareketli-ortalama", "altin-kesisim", "olum-kesisimi"] },
  { slug: "ussel-hareketli-ortalama", category: "teknik", related: ["hareketli-ortalama", "macd"] },
  { slug: "altin-kesisim", category: "teknik", related: ["olum-kesisimi", "hareketli-ortalama"] },
  { slug: "olum-kesisimi", category: "teknik", related: ["altin-kesisim", "hareketli-ortalama"] },
  { slug: "rsi", category: "teknik", related: ["asiri-alim", "asiri-satim", "macd"] },
  { slug: "macd", category: "teknik", related: ["ussel-hareketli-ortalama", "rsi"] },
  { slug: "asiri-alim", category: "teknik", related: ["rsi", "asiri-satim"] },
  { slug: "asiri-satim", category: "teknik", related: ["rsi", "asiri-alim"] },
  { slug: "destek-seviyesi", category: "teknik", related: ["direnc-seviyesi", "pivot-noktasi", "kirilim"] },
  { slug: "direnc-seviyesi", category: "teknik", related: ["destek-seviyesi", "kirilim"] },
  { slug: "pivot-noktasi", category: "teknik", related: ["destek-seviyesi", "direnc-seviyesi"] },
  { slug: "trend-cizgisi", category: "teknik", related: ["kirilim", "destek-seviyesi"] },
  { slug: "kirilim", category: "teknik", related: ["direnc-seviyesi", "islem-hacmi", "trend-cizgisi"] },
  { slug: "fibonacci-duzeltmesi", category: "teknik", related: ["destek-seviyesi", "direnc-seviyesi"] },
  { slug: "bollinger-bantlari", category: "teknik", guide: "volatilite", related: ["hareketli-ortalama", "volatilite"] },
  { slug: "atr", category: "teknik", guide: "volatilite", related: ["volatilite", "stop-emir"] },
  { slug: "vwap", category: "teknik", related: ["islem-hacmi", "hareketli-ortalama"] },
  { slug: "mum-grafigi", category: "teknik", related: ["fiyat-boslugu", "destek-seviyesi"] },
  { slug: "fiyat-boslugu", category: "teknik", related: ["mum-grafigi", "on-seans"] },
  { slug: "risk-getiri-orani", category: "teknik", guide: "risk-yonetimi", related: ["stop-emir", "destek-seviyesi"] },

  /* ---- Bilanço Dönemi ---------------------------------------------------- */
  { slug: "bilanco-sezonu", category: "bilanco", guide: "bilanco", related: ["mali-ceyrek", "konsensus", "eps-surprizi"] },
  { slug: "mali-ceyrek", category: "bilanco", guide: "bilanco", related: ["mali-yil", "form-10-q"] },
  { slug: "mali-yil", category: "bilanco", guide: "bilanco", related: ["mali-ceyrek", "form-10-k"] },
  { slug: "konsensus", category: "bilanco", guide: "bilanco-gunu-nasil-okunur", related: ["eps-surprizi", "rehberlik"] },
  { slug: "eps-surprizi", category: "bilanco", guide: "bilanco-gunu-nasil-okunur", related: ["konsensus", "hisse-basi-kar", "beklenen-hareket"] },
  { slug: "rehberlik", category: "bilanco", guide: "bilanco-gunu-nasil-okunur", related: ["konsensus", "bilanco-toplantisi"] },
  { slug: "bilanco-toplantisi", category: "bilanco", guide: "bilanco-gunu-nasil-okunur", related: ["rehberlik", "form-8-k"], guideMore: "konferans-gorusmesi" },
  { slug: "yillik-bazda", category: "bilanco", guide: "bilanco", related: ["ceyreklik-bazda", "mali-ceyrek"] },
  { slug: "ceyreklik-bazda", category: "bilanco", guide: "bilanco", related: ["yillik-bazda", "mali-ceyrek"] },
  { slug: "form-10-q", category: "bilanco", guide: "bilanco", related: ["form-10-k", "form-8-k", "sec"], guideMore: "10k-10q" },
  { slug: "form-10-k", category: "bilanco", guide: "bilanco", related: ["form-10-q", "mali-yil", "sec"], guideMore: "10k-10q" },
  { slug: "form-8-k", category: "bilanco", guide: "bilanco", related: ["form-10-q", "sec"], guideMore: "10k-10q" },
  { slug: "hak-dusum-tarihi", category: "bilanco", guide: "temettu", related: ["kayit-tarihi", "temettu", "t-1-takas"], guideMore: "temettu-takvimi" },
  { slug: "kayit-tarihi", category: "bilanco", guide: "temettu", related: ["hak-dusum-tarihi", "temettu"], guideMore: "temettu-takvimi" },

  /* ---- Opsiyonlar --------------------------------------------------------- */
  { slug: "opsiyon", category: "opsiyon", guide: "opsiyonlar", related: ["alim-opsiyonu", "satim-opsiyonu", "opsiyon-primi"] },
  { slug: "alim-opsiyonu", category: "opsiyon", guide: "opsiyonlar", related: ["satim-opsiyonu", "kullanim-fiyati", "ortulu-alim"] },
  { slug: "satim-opsiyonu", category: "opsiyon", guide: "opsiyonlar", related: ["alim-opsiyonu", "kullanim-fiyati"] },
  { slug: "kullanim-fiyati", category: "opsiyon", guide: "opsiyonlar", related: ["parada", "vade-sonu"] },
  { slug: "vade-sonu", category: "opsiyon", guide: "opsiyonlar", related: ["theta", "kullanim-fiyati"] },
  { slug: "opsiyon-primi", category: "opsiyon", guide: "opsiyonlar", related: ["ortuk-oynaklik", "theta", "parada"] },
  { slug: "parada", category: "opsiyon", guide: "opsiyonlar", related: ["kullanim-fiyati", "delta"] },
  { slug: "delta", category: "opsiyon", guide: "opsiyonlar", related: ["theta", "parada"] },
  { slug: "theta", category: "opsiyon", guide: "opsiyonlar", related: ["delta", "vade-sonu", "opsiyon-primi"] },
  { slug: "ortuk-oynaklik", category: "opsiyon", guide: "volatilite", related: ["beklenen-hareket", "vix", "opsiyon-primi"] },
  { slug: "beklenen-hareket", category: "opsiyon", guide: "bilanco-gunu-nasil-okunur", related: ["ortuk-oynaklik", "straddle", "eps-surprizi"], guideMore: "beklenen-hareket" },
  { slug: "straddle", category: "opsiyon", guide: "opsiyonlar", related: ["beklenen-hareket", "alim-opsiyonu", "satim-opsiyonu"] },
  { slug: "ortulu-alim", category: "opsiyon", guide: "hedge", related: ["alim-opsiyonu", "opsiyon-primi"] },
  { slug: "vix", category: "opsiyon", guide: "volatilite", related: ["ortuk-oynaklik", "volatilite"] },

  /* ---- Vergi ve Türkiye --------------------------------------------------- */
  { slug: "w-8ben", category: "vergi", related: ["stopaj", "form-1042-s", "cifte-vergilendirmeyi-onleme"], guideMore: "w-8ben" },
  { slug: "form-1042-s", category: "vergi", related: ["w-8ben", "stopaj", "beyanname"], guideMore: "yurt-disi-hisse-vergisi" },
  { slug: "stopaj", category: "vergi", guide: "temettu", related: ["w-8ben", "cifte-vergilendirmeyi-onleme", "temettu-verimi"], guideMore: "yurt-disi-hisse-vergisi" },
  { slug: "cifte-vergilendirmeyi-onleme", category: "vergi", related: ["stopaj", "beyanname"], guideMore: "yurt-disi-hisse-vergisi" },
  { slug: "beyanname", category: "vergi", related: ["deger-artis-kazanci", "yi-ufe-endekslemesi", "form-1042-s"], guideMore: "yurt-disi-hisse-vergisi" },
  { slug: "deger-artis-kazanci", category: "vergi", related: ["yi-ufe-endekslemesi", "kur-farki", "beyanname"], guideMore: "yurt-disi-hisse-vergisi" },
  { slug: "yi-ufe-endekslemesi", category: "vergi", related: ["deger-artis-kazanci", "ufe"], guideMore: "yurt-disi-hisse-vergisi" },
  { slug: "kur-farki", category: "vergi", guide: "kur-riski", related: ["deger-artis-kazanci", "dolar-endeksi", "adr"], guideMore: "yurt-disi-hisse-vergisi" },

  /* ---- Bildirimler ve İçeriden İşlemler ------------------------------------ */
  { slug: "sec", category: "iceriden", related: ["form-10-k", "form-4", "form-13f"] },
  { slug: "iceriden-islem", category: "iceriden", related: ["form-4", "kilitlenme-suresi"], guideMore: "insider-islemleri" },
  { slug: "form-4", category: "iceriden", related: ["iceriden-islem", "sec"], guideMore: "insider-islemleri" },
  { slug: "form-13f", category: "iceriden", related: ["form-13d", "sec"] },
  { slug: "form-13d", category: "iceriden", related: ["form-13f", "iceriden-islem"] },
  { slug: "kilitlenme-suresi", category: "iceriden", guide: "halka-arz", related: ["halka-arz", "iceriden-islem"] },
  { slug: "hisse-bazli-odeme", category: "iceriden", guide: "nakit-akisi", related: ["hisse-seyrelmesi", "gaap-disi", "hisse-geri-alimi"] },
] as const satisfies readonly GlossaryMetaEntry[];

export type GlossarySlug = (typeof GLOSSARY_META)[number]["slug"];

/** Bir kategorinin slug'ları — kategori dosyalarının anahtar kümesi. */
export type GlossarySlugIn<C extends GlossaryCategoryKey> = Extract<
  (typeof GLOSSARY_META)[number],
  { category: C }
>["slug"];

/** Bir dilin taşıdığı metin — yapı burada, metin dil dosyalarında. */
export type GlossaryText = {
  /** Sayfa başlığı ve dizindeki ad — Title Case. */
  term: string;
  /** Düz, doğru, iki ila dört cümle. Satır içi biçim yok. */
  definition: string;
  /** İsteğe bağlı somut örnek — tek paragraf. */
  example?: string;
  /**
   * Yazı gövdesinde bu terime bağlantı veren yüzey biçimleri.
   *
   * TUTUCU. Eşleşme `lib/autolink.ts`te: büyük harf taşıyan biçim (RSI,
   * F/K) birebir aranır ve ancak kesme işaretli ekle genişler ("F/K'sı");
   * küçük harfli biçim büyük/küçük harfe duyarsız aranır ve birkaç harflik
   * Türkçe eki kapsar ("getiri eğrisinin"). "destek", "prim", "vade" gibi
   * gündelik tek kelimeler BURAYA YAZILMAZ: "desteklemek" de destek
   * seviyesine bağlanırdı. Boş dizi = bu dilde otomatik bağlantı yok.
   */
  match: readonly string[];
};

export type GlossaryTexts<C extends GlossaryCategoryKey> = Record<
  GlossarySlugIn<C>,
  GlossaryText
>;
