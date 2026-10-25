/**
 * Aracı kurum LOGOLARI ve KİMLİK RENKLERİ — tek kayıt (25 Ekim, sahibinin
 * isteği: "Renkli ve görsel olsun; şirketlerin logolarını da kullanalım,
 * herkese açık bir yerden.").
 *
 * LOGOLAR KURUMUN KENDİ SİTESİNDEN. Her dosya kurumun resmî web sitesinde
 * herkese açık yayımlanan logodan (başlıktaki logo, favicon ya da ana ekran
 * ikonu) alındı; yalnız kare işaret kırpıldı ve 128 piksellik WebP'ye
 * çevrildi (SVG'ler de raster oldu: depoya betik taşıyabilecek SVG girmiyor).
 * Kullanım NOMİNATİF: kurumu tanıtmak için, kurumun kendi işaretiyle; hiçbir
 * logo bir öneri ya da ortaklık anlamına gelmiyor (BrokerNotes →
 * tarafsızlık). Dosyalar depoda (`public/brokers/`), dış siteye sıcak
 * bağlantı yok: CSP `img-src` değişmiyor, kurumun sitesi düşse de logo
 * yerinde. Yatırımcı portrelerinin kalıbı (`lib/investors.ts` → PORTRAITS):
 * kaynağı yazılmayan görsel depoya girmez. Logosu olmayan kurumda kart baş
 * harf karosuna düşer (`brokerMonogram`).
 *
 * KİMLİK RENGİ LOGODAN, AMA ÖLÇÜLÜ. Altı kurum aynı grafikte çizgi olarak
 * duruyor; logoların ham renkleri üç ayrı mavi (Midas, İş, Gedik) ve
 * dataviz denetleyicisi (renk körlüğü benzetimli OKLab ΔE) onları ayırt
 * edilemez buldu (Gedik ↔ Midas ΔE 6, renk körlüğünde 2,4). Her renk
 * kurumun logo tonundan yola çıkıp tema yüzeyine göre yeniden basamaklandı:
 * açık temada #f0f2f5, koyu temada #131921 yüzeyinde altı rengin hepsi
 * açıklık bandında, kroma tabanının üstünde, yüzeye karşı ≥ 3:1, en yakın
 * çift renk körlüğünde ΔE ≥ 8,6 ve normal görüşte ≥ 15 (25 Ekim, ölçüldü).
 * Koyu tema ters çevrilmedi, kendi basamağını aldı. Yapı Kredi Yatırım ve
 * İnfo Yatırım grafikte yok (tarifelerinden tek komisyon çıkmıyor); renkleri
 * yalnız kartın üst şeridinde.
 *
 * Renk YALNIZ İŞARETTE: kart şeridi, çizgi, çubuk, nokta. Metin rengi hiçbir
 * yerde kurum renginden gelmez (sayılar ve adlar metin tokenlarında).
 * Bu dosya "use client" DEĞİL: sunucu ve istemci aynı kaydı okuyor.
 */

export type BrokerBrand = {
  /** `public/` altındaki dosya. */
  logo: string;
  source: {
    /** Logonun bulunduğu sayfa. */
    page: string;
    /** İndirilen dosyanın adresi (satır içi SVG ise sayfanın kendisi). */
    file: string;
    /** İndirilme günü ("YYYY-MM-DD"). */
    downloaded: string;
    /** Dosyaya ne yapıldı. */
    note: string;
  };
  /** Logodaki ana renk, kayıt için. */
  logoHex: string;
  /** Seri ve şerit rengi, temaya göre. */
  color: { light: string; dark: string };
};

const DOWNLOADED = "2026-10-25";
const USE = "Kurumun kendi sitesi; tanıtım amaçlı nominatif kullanım.";

export const BROKER_BRANDS: Readonly<Record<string, BrokerBrand>> = {
  midas: {
    logo: "/brokers/midas.webp",
    source: {
      page: "https://www.getmidas.com/",
      file: "https://www.getmidas.com/ (başlıktaki satır içi SVG logo)",
      downloaded: DOWNLOADED,
      note: `${USE} Vektör işaret 128 piksel WebP'ye çizildi.`,
    },
    logoHex: "#4959ea",
    color: { light: "#8d45f7", dark: "#8265c5" },
  },
  "is-yatirim": {
    logo: "/brokers/is-yatirim.webp",
    source: {
      page: "https://www.isyatirim.com.tr/",
      file: "https://www.isyatirim.com.tr/SiteAssets/img/logo-tr-blue.svg",
      downloaded: DOWNLOADED,
      note: `${USE} Logodaki kare işaret kırpıldı.`,
    },
    logoHex: "#0030a0",
    color: { light: "#448acb", dark: "#1aa1c8" },
  },
  "garanti-bbva-yatirim": {
    logo: "/brokers/garanti-bbva-yatirim.webp",
    source: {
      page: "https://www.garantibbvayatirim.com.tr/",
      file: "https://www.garantibbvayatirim.com.tr/_assets/img/logo.svg",
      downloaded: DOWNLOADED,
      note: `${USE} Logodaki yonca işareti kırpıldı.`,
    },
    logoHex: "#007840",
    color: { light: "#258b11", dark: "#189551" },
  },
  "yapi-kredi-yatirim": {
    logo: "/brokers/yapi-kredi-yatirim.webp",
    source: {
      page: "https://www.ykyatirim.com.tr/",
      file: "https://www.ykyatirim.com.tr/getmedia/e186bb87-8360-41ae-994a-292cfbc09293/ykyatirim.svg",
      downloaded: DOWNLOADED,
      note: `${USE} Logodaki işaret kırpıldı.`,
    },
    logoHex: "#8d8d8d",
    color: { light: "#7a7d84", dark: "#a6a9b0" },
  },
  "qnb-invest": {
    logo: "/brokers/qnb-invest.webp",
    source: {
      page: "https://www.qnbinvest.com.tr/",
      file: "https://www.qnbinvest.com.tr/images/imagesV2/qnb-invest-logo.png",
      downloaded: DOWNLOADED,
      note: `${USE} Logodaki işaret kırpıldı; kaynak işaret 45 piksel, sitede daha büyüğü yok.`,
    },
    logoHex: "#c82070",
    color: { light: "#9c4159", dark: "#c12d91" },
  },
  gedik: {
    logo: "/brokers/gedik.webp",
    source: {
      page: "https://gedik.com/",
      file: "https://gedik.com/favicon.ico",
      downloaded: DOWNLOADED,
      note: `${USE} Site ikonu (228 piksel) olduğu gibi küçültüldü.`,
    },
    logoHex: "#0050f8",
    color: { light: "#1f47bd", dark: "#0c5df9" },
  },
  "info-yatirim": {
    logo: "/brokers/info-yatirim.webp",
    source: {
      page: "https://infoyatirim.com/",
      file: "https://infoyatirim.com/assets/img/logo-transparent.svg",
      downloaded: DOWNLOADED,
      note: `${USE} Logodaki işaret kırpıldı.`,
    },
    logoHex: "#6abf4b",
    color: { light: "#3f8f2a", dark: "#6abf4b" },
  },
  "interactive-brokers": {
    logo: "/brokers/interactive-brokers.webp",
    source: {
      page: "https://www.interactivebrokers.com/",
      file: "https://www.interactivebrokers.com/images/web/favicons/home-screen-icon-192x192.png",
      downloaded: DOWNLOADED,
      note: `${USE} Ana ekran ikonu 128 piksele küçültüldü.`,
    },
    logoHex: "#d81222",
    color: { light: "#fb465e", dark: "#fc0f2b" },
  },
};

export function brokerBrand(id: string): BrokerBrand | null {
  return BROKER_BRANDS[id] ?? null;
}

/**
 * Kurum renginin CSS değişkenleri — bileşen `style`a yazar, modül CSS'i
 * temaya göre seçer (`--brand-l` / `--brand-d` → `--brand`). Renk değeri
 * yalnız bu kayıtta; CSS'te hex yok.
 */
export function brandVars(id: string): Record<"--brand-l" | "--brand-d", string> | undefined {
  const brand = BROKER_BRANDS[id];
  return brand ? { "--brand-l": brand.color.light, "--brand-d": brand.color.dark } : undefined;
}
