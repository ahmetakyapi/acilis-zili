import type { GuideSlug } from "./meta";

/* ==========================================================================
   Rehber — ARAMA SONUCU KÜNYESİ (25 Ekim)

   Yazının ekrandaki başlığı ve `dek`i okuyucu için yazıldı: dek bir merak
   cümlesi ("Hangi tuşa bastığın, ne aldığından bazen daha önemlidir.") ve
   arama sonucunda açıklama olarak basılıyordu. Arayan kişi bir soru soruyor;
   açıklama o sorunun cevabını ilk cümlede vermeli (Google ve yapay zekâ
   özetleri de o cümleyi alıntılıyor).

   Liste VERİYLE seçildi: Search Console'da 14–24 Ekim arasında gösterim
   alan yazılar ve sorguları. Örnek: emir-tipleri "emir tipleri nelerdir",
   "limit fiyatlı emir", "piyasa fiyatlı emir" (sıra 82–99);
   abd-hisse-nasil-alinir "amerikan borsasına nasıl girilir", "yabancı
   hisse senedi nasıl alınır" (sıra 77–95).

   KURAL: buradaki her cümle yazının gövdesinde zaten söyleniyor; künye
   yazıda olmayan bir şey vaat etmez. Başlık markasız ≤60, açıklama ≤155
   karakter; açıklamadaki sayı ve kısaltmaların hepsi, kelimelerin en az
   dörtte üçü yazıda geçer (`tests/guide-search.test.ts`). Listede olmayan
   yazı ekrandaki başlık ve dek ile kalır. Sayfadaki h1 değişmez.
   ========================================================================== */

export type GuideSearchCopy = { title?: string; description?: string };

export const GUIDE_SEARCH: Partial<
  Record<GuideSlug, { tr?: GuideSearchCopy; en?: GuideSearchCopy }>
> = {
  "abd-hisse-nasil-alinir": {
    tr: {
      title: "ABD Hissesi Nasıl Alınır? Türkiye'den Adım Adım",
      description:
        "Türkiye'den ABD hissesi almak beş adımda olur: aracı kurum seçmek, hesap açmak, lirayı dolara çevirmek, emir vermek ve saklama. Her adımın maliyeti.",
    },
  },
  "emir-tipleri": {
    tr: {
      title: "Emir Tipleri Nelerdir? Piyasa, Limit ve Stop Emri",
      description:
        "Emir tipi, işlemin ne zaman ve hangi fiyattan gerçekleşeceğini belirler: piyasa emri hemen dolar, limit emri fiyatı sabitler, stop emri tetikler.",
    },
    en: {
      title: "Order Types Explained: Market, Limit and Stop Orders",
      description:
        "The order type decides when and at what price your trade happens: a market order fills now, a limit order sets the price, a stop order is a trigger.",
    },
  },
  bilanco: {
    tr: {
      description:
        "Bilanço, şirketin üç aylık sonuçlarıdır: gelir, net kâr ve hisse başına kâr (EPS). Piyasa bu üç satıra ve şirketin gelecek dönem beklentisine bakar.",
    },
  },
  endeks: {
    tr: {
      title: "Endeks Nedir? S&P 500, Nasdaq ve Dow Jones Farkı",
      description:
        "Endeks, kurala göre seçilmiş bir hisse grubunun toplu hareketini tek sayıya indirir; anlamlı olan seviye değil yüzde değişim. Dört büyük ABD endeksi.",
    },
  },
  degerleme: {
    tr: {
      title: "F/K Oranı Nedir? Değerleme Oranları Nasıl Okunur?",
      description:
        "F/K, hisse fiyatının hisse başına kâra bölümüdür: bir yıllık kâr için kaç yıllık fiyat ödendiğini söyler. PD/DD ve öteki oranlar neyi ölçer.",
    },
  },
  "yurt-disi-hisse-vergisi": {
    tr: {
      title: "Yurt Dışı Hisse Vergisi: Kazanç ve Temettü Beyanı",
      description:
        "ABD hissesinden elde edilen satış kazancı ve temettünün vergisi Türkiye'de doğar. Kazanç nasıl hesaplanır, ne zaman beyan edilir; 2026 düzeni.",
    },
  },
  "halka-arz": {
    en: {
      title: "What Is an IPO? How a Company Goes Public",
      description:
        "An IPO is the first sale of a company's shares to the public and the start of exchange trading: the process, offer and open prices, and the lock-up.",
    },
  },
  "temettu-takvimi": {
    en: {
      title: "Dividend Calendar: Ex-Dividend, Record and Payment Dates",
      description:
        "A dividend announcement lists four dates: declaration, ex-dividend, record and payment. Which one decides who gets paid, and what changed in 2024.",
    },
  },
  "getiri-egrisi": {
    en: {
      description:
        "The yield curve plots Treasury yields across maturities and normally slopes up. When short rates rise above long rates it inverts: a recession signal.",
    },
  },
  enflasyon: {
    en: {
      title: "Inflation Data Explained: CPI, Core CPI and PCE",
      description:
        "CPI prices the household basket, core CPI drops food and energy, PCE is the Fed's preferred gauge. Why one monthly number moves rates and markets.",
    },
  },
  volatilite: {
    en: {
      description:
        "Volatility measures how far a price strays from its average, whatever the direction: the size of the moves, not where they go. How it is calculated.",
    },
  },
  hedge: {
    en: {
      title: "What Is Hedging? Limiting Losses and What It Costs",
      description:
        "A hedge is a second position opened to offset losses on an existing one. Its goal is capping the loss in advance, not profit, and every hedge has a cost.",
    },
  },
};

/** Yazının arama künyesi: tanımlıysa buradan, değilse ekrandaki başlık ve dek. */
export function guideSearchCopy(
  slug: string,
  locale: string,
  fallback: { title: string; dek: string },
): { title: string; description: string } {
  const entry = GUIDE_SEARCH[slug as GuideSlug];
  const copy = locale === "en" ? entry?.en : entry?.tr;
  return {
    title: copy?.title ?? fallback.title,
    description: copy?.description ?? fallback.dek,
  };
}
