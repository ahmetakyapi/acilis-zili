/* ==========================================================================
   Sözlük — terimin kavram işareti

   Dizindeki karolar tek harf taşıyordu ("L", "P", "V"): Likidite ile Limit
   Emir aynı "L" karosuyla duruyordu, yani karo terimi ayırt ettirmiyordu
   (28 Eylül, ikinci tur). Karo artık kavramın ŞEKLİNİ çiziyor: oran bir
   pay ve payda, marj bir halkanın dilimi, getiri eğrisi bir eğri, emir
   defteri iki yana açılan basamaklar. Çizimler `components/glossary/TermMark.tsx`.

   SAYI YOK. Hiçbir çizim bir seriyi ya da bir değeri göstermiyor; bir
   çubuğun boyu, bir eğrinin eğimi kavramın yönünü anlatıyor, ölçüsünü
   değil. Rehberin konu çizimleriyle (`TopicDiagram`) aynı sözleşme.

   TAM KAYIT (`Record`, `Partial` değil): yeni bir terim işaret seçmeden
   derlenmiyor. Yüz elli terim otuz şekli paylaşıyor; aynı kategoride aynı
   şekli taşıyan terimler (F/K ile PD/DD) zaten aynı kavram ailesi.
   ========================================================================== */

import type { GlossarySlug } from "./meta";

export const GLOSSARY_MOTIFS = [
  "ratio", "margin", "waterfall", "bars", "discount", "split", "stack", "balance",
  "book", "timeline", "calendar", "document", "target", "tax", "trendUp", "trendDown",
  "grid", "gauge", "curveUp", "curveDown", "steps", "dots", "delta", "oscillator",
  "cross", "channel", "candles", "payoffCall", "payoffPut", "payoffV",
] as const;

export type GlossaryMotif = (typeof GLOSSARY_MOTIFS)[number];

export const GLOSSARY_MARKS: Record<GlossarySlug, GlossaryMotif> = {
  /* Değerleme ve Temel Analiz */
  "fk": "ratio",
  "pd-dd": "ratio",
  "fd-favok": "ratio",
  "peg-orani": "ratio",
  "fiyat-satis-orani": "ratio",
  "temettu-verimi": "ratio",
  "hisse-basi-kar": "bars",
  "seyreltilmis-hisse-basi-kar": "split",
  "gelir": "bars",
  "brut-kar-marji": "margin",
  "faaliyet-kar-marji": "margin",
  "net-kar-marji": "margin",
  "aktif-karliligi": "margin",
  "ozsermaye-karliligi": "margin",
  "temettu-dagitim-orani": "margin",
  "favok": "waterfall",
  "firma-degeri": "waterfall",
  "isletme-nakit-akisi": "waterfall",
  "serbest-nakit-akisi": "waterfall",
  "sermaye-harcamasi": "waterfall",
  "gaap-disi": "document",
  "iskontolu-nakit-akisi": "discount",
  "borc-ozsermaye-orani": "balance",
  "cari-oran": "balance",
  "defter-degeri": "stack",
  "temettu": "stack",
  "piyasa-degeri": "grid",
  "hisse-geri-alimi": "split",
  "hisse-seyrelmesi": "split",

  /* Piyasa İşleyişi */
  "aciga-satis": "trendDown",
  "ayi-piyasasi": "trendDown",
  "duzeltme": "trendDown",
  "boga-piyasasi": "trendUp",
  "kisa-sikisma": "trendUp",
  "adr": "document",
  "spac": "document",
  "alis-satis-fiyati": "book",
  "araci-kurum": "book",
  "likidite": "book",
  "limit-emir": "book",
  "piyasa-emri": "book",
  "piyasa-yapici": "book",
  "spread": "book",
  "stop-emir": "book",
  "beta": "gauge",
  "volatilite": "gauge",
  "cesitlendirme": "grid",
  "endeks": "grid",
  "etf": "grid",
  "halka-arz": "grid",
  "halka-aciklik": "margin",
  "devre-kesici": "timeline",
  "kapanis-sonrasi": "timeline",
  "on-seans": "timeline",
  "hisse-bolunmesi": "split",
  "kesirli-hisse": "split",
  "ters-bolunme": "split",
  "islem-hacmi": "bars",
  "kaldirac": "balance",
  "marj-hesabi": "balance",
  "t-1-takas": "calendar",

  /* Makro ve Fed */
  "baz-puan": "steps",
  "politika-faizi": "steps",
  "sahin": "steps",
  "guvercin": "steps",
  "cekirdek-enflasyon": "delta",
  "tufe": "delta",
  "ufe": "delta",
  "pce": "delta",
  "issizlik-basvurulari": "delta",
  "issizlik-orani": "delta",
  "dolar-endeksi": "grid",
  "fomc": "calendar",
  "getiri-egrisi": "curveUp",
  "hazine-tahvili": "curveUp",
  "ters-getiri-egrisi": "curveDown",
  "gsyh": "bars",
  "jolts": "bars",
  "niceliksel-gevseme": "bars",
  "perakende-satislar": "bars",
  "tarim-disi-istihdam": "bars",
  "niceliksel-sikilasma": "discount",
  "nokta-grafigi": "dots",
  "pmi": "gauge",
  "reel-faiz": "ratio",
  "resesyon": "trendDown",
  "sahm-kurali": "trendUp",

  /* Teknik Analiz */
  "altin-kesisim": "cross",
  "olum-kesisimi": "cross",
  "hareketli-ortalama": "cross",
  "ussel-hareketli-ortalama": "cross",
  "vwap": "cross",
  "asiri-alim": "oscillator",
  "asiri-satim": "oscillator",
  "rsi": "oscillator",
  "macd": "delta",
  "atr": "candles",
  "fiyat-boslugu": "candles",
  "mum-grafigi": "candles",
  "bollinger-bantlari": "channel",
  "destek-seviyesi": "channel",
  "direnc-seviyesi": "channel",
  "fibonacci-duzeltmesi": "channel",
  "pivot-noktasi": "channel",
  "kirilim": "trendUp",
  "trend-cizgisi": "trendUp",
  "risk-getiri-orani": "balance",

  /* Bilanço Dönemi */
  "bilanco-sezonu": "calendar",
  "bilanco-toplantisi": "calendar",
  "hak-dusum-tarihi": "calendar",
  "kayit-tarihi": "calendar",
  "ceyreklik-bazda": "bars",
  "yillik-bazda": "bars",
  "eps-surprizi": "target",
  "rehberlik": "target",
  "konsensus": "dots",
  "form-10-k": "document",
  "form-10-q": "document",
  "form-8-k": "document",
  "mali-ceyrek": "timeline",
  "mali-yil": "timeline",

  /* Opsiyonlar */
  "alim-opsiyonu": "payoffCall",
  "kullanim-fiyati": "payoffCall",
  "opsiyon": "payoffCall",
  "ortulu-alim": "payoffCall",
  "parada": "payoffCall",
  "satim-opsiyonu": "payoffPut",
  "straddle": "payoffV",
  "beklenen-hareket": "target",
  "delta": "curveUp",
  "theta": "curveDown",
  "opsiyon-primi": "stack",
  "ortuk-oynaklik": "gauge",
  "vix": "gauge",
  "vade-sonu": "calendar",

  /* Vergi ve Türkiye */
  "deger-artis-kazanci": "tax",
  "kur-farki": "tax",
  "stopaj": "tax",
  "yi-ufe-endekslemesi": "tax",
  "beyanname": "document",
  "form-1042-s": "document",
  "w-8ben": "document",
  "cifte-vergilendirmeyi-onleme": "balance",

  /* Bildirimler ve İçeriden İşlemler */
  "form-13d": "document",
  "form-13f": "document",
  "form-4": "document",
  "iceriden-islem": "document",
  "sec": "document",
  "hisse-bazli-odeme": "split",
  "kilitlenme-suresi": "timeline",
};
