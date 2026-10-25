import type { PosterMove, PosterStock } from "./day-poster";

/**
 * GÜNÜN SİLUETİ — Günün Posteri'nin sahnesi (25 Ekim, üçüncü kurulum).
 *
 * SAHİBİNİN İTİRAZI (canlıdaki "S&P 500, Hisse Hisse" sahnesi üzerine):
 * "Çok kötü gözüküyor, bu hâliyle kabul edilemez. Noktaların ne olduğunu
 * insan anlamaz. Daha görsel, daha anlaşılabilir ve benzersiz bir tasarım
 * yapalım; gerekirse Nasdaq 100 üzerinden çizelim." Arı kovanı düzeni
 * (yüzlerce kırmızı/yeşil nokta, x ekseni yüzde, boy piyasa değeri,
 * ölçek dışı halkalar) üç şeyi birden kodluyordu ve hiçbirini adıyla
 * söylemiyordu: okuyucu noktanın bir şirket olduğunu bile çıkaramıyordu.
 *
 * YENİ SAHNE BİR ŞEHİR SİLUETİ, NASDAQ 100 ÜZERİNDEN. Yüz şirket; her biri
 * tanınır ve her biri bir bina:
 *   - ortada yatay bir UFUK çizgisi: sıfır;
 *   - binanın YÜKSEKLİĞİ o günkü değişim: yükselen ufkun üstünde (yön
 *     yeşili), düşen ufkun altında, suya yansıyan bina gibi (yön kırmızısı;
 *     su ufkun altındaki gömük TON, degrade değil);
 *   - binanın GENİŞLİĞİ piyasa değeri, karekökle sıkıştırılmış: Nvidia ile
 *     en küçük üye arasındaki ~300 kat fark doğrusal çizilse küçükler kıl
 *     inceliğinde kalırdı; karekök farkı ~18 kata indiriyor ve her binaya
 *     bir taban genişlik (`minW`) ekleniyor;
 *   - binalar SEKTÖR MAHALLELERİNE ayrılıyor, mahalleler günün değişimine
 *     göre GÜÇLÜDEN ZAYIFA; mahalle içinde binalar da en çok yükselenden en
 *     çok düşene. Her mahalle böylece ufku bir yerde kesen bir "tepe":
 *     kesişme noktası yükselenle düşenin oranını gösteriyor.
 *   - En büyük şirketlerin ve günün uç hisselerinin çatısında LOGO, sembol
 *     ve yüzde (`placeLabels`; etiketler birbirine ve binalara binmiyor).
 *
 * Bu dosya SAF (veritabanı yok, DOM yok): sayfa, ana sayfa şeridi,
 * paylaşım görseli ve arşiv minyatürü AYNI yerleşimi buradan alıyor.
 * Testler `tests/day-skyline.test.ts`.
 *
 * Birim: "sahne birimi". Her sıra kendi SVG'si; `viewBox` bu birimde ve
 * tarayıcı onu kabın enine ölçekliyor (yükseklik orandan geliyor, sayfa
 * kaymıyor). Etiketlerin punto ve logo ölçüleri de birimde: düzenler
 * (`SKY_MODES`) her birinin göründüğü kap eni aralığında birimi ~1 piksele
 * denk getirecek biçimde seçildi.
 */

/* --------------------------------------------------------------------------
   Hisseler ve mahalleler
   -------------------------------------------------------------------------- */

/**
 * GICS sektörü → SPDR sektör fonunun sembolü. Fon yalnız ANAHTAR: mahallenin
 * adı fonun Türkçe/İngilizce adından (`SECTOR_FUNDS`), değişimi ise fonun
 * fiyatından DEĞİL, mahallenin kendi hisselerinden (`districtsOf`).
 */
export const GICS_SECTOR_FUND: Readonly<Record<string, string>> = {
  "Information Technology": "XLK",
  Financials: "XLF",
  "Health Care": "XLV",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Industrials: "XLI",
  Materials: "XLB",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

/** Küçük sektörlerin birleştiği mahalle. */
export const OTHER_DISTRICT = "OTHER";

/**
 * MAHALLE EN AZ BEŞ BİNA. Nasdaq 100'de enerji iki, hammadde ve finans
 * birer şirket (1 Ağustos bileşimi, `db/seed/indices.ts`); tek binalı bir
 * "mahalle"nin adı binasından geniş olur ve değişimi tek bir hissenin
 * değişimidir. Beşin altındaki sektörler "Diğer Sektörler"de birleşiyor
 * (bugünkü listede kamu hizmetleri 4 + enerji 2 + hammadde 1 + finans 1).
 */
export const MIN_DISTRICT_SIZE = 5;

export type SkyMember = { symbol: string; name: string; sector?: string };

/** Siluetin bir binası. `cap` dolar; bilinmiyorsa `null` (taban genişlik). */
export type SkyStock = { symbol: string; name: string; district: string; change: number; cap: number | null };

/** Değişim dört ondalık (%0,0001): binanın boyunda görünmez, yük üçte bir.
 *  Piyasa değeri üç anlamlı basamak. */
const CHANGE_ROUND = 1e4;
const CAP_DIGITS = 3;

function roundCap(cap: number | null): number | null {
  if (cap === null || !Number.isFinite(cap) || cap <= 0) return null;
  return Number(cap.toPrecision(CAP_DIGITS));
}

/**
 * Posterin hisselerini binalara çevirir: ad ve sektör üye listesinden,
 * piyasa değeri çağıranın `capOf`undan (o günün kapanışı × hisse sayısı,
 * `lib/day-poster-data.ts`). Sektörü bilinmeyen üye "Diğer"e düşüyor;
 * silinmiyor, genişlik sayımıyla siluet aynı küme kalıyor.
 */
export function skylineStocks(
  stocks: readonly PosterStock[],
  members: readonly SkyMember[],
  capOf: (symbol: string, close: number) => number | null,
): SkyStock[] {
  const bySymbol = new Map(members.map((member) => [member.symbol, member] as const));
  const fundOf = (symbol: string) => {
    const sector = bySymbol.get(symbol)?.sector;
    return (sector && GICS_SECTOR_FUND[sector]) || OTHER_DISTRICT;
  };
  const counts = new Map<string, number>();
  for (const stock of stocks) counts.set(fundOf(stock.symbol), (counts.get(fundOf(stock.symbol)) ?? 0) + 1);
  return stocks.map((stock) => {
    const fund = fundOf(stock.symbol);
    return {
      symbol: stock.symbol,
      name: bySymbol.get(stock.symbol)?.name ?? stock.symbol,
      district: (counts.get(fund) ?? 0) >= MIN_DISTRICT_SIZE ? fund : OTHER_DISTRICT,
      change: Math.round(stock.change * CHANGE_ROUND) / CHANGE_ROUND,
      cap: roundCap(capOf(stock.symbol, stock.close)),
    };
  });
}

export type District = {
  key: string;
  /** Mahallenin değişimi: hisselerinin piyasa değeriyle ağırlıklı ortalaması. */
  change: number;
  advancing: number;
  declining: number;
  /** Binalar (`stocks` dizinleri), en çok yükselenden en çok düşene. */
  members: number[];
};

/** Piyasa değeri bilinmeyen binanın ağırlığı ve genişliği: bilinenlerin en
 *  küçüğü (yoksa hepsi eşit). Uydurma bir değer değil, bir TABAN; künye
 *  yazıyor (`sizeNote`). */
function capFloor(stocks: readonly SkyStock[]): number {
  const known = stocks.flatMap((stock) => (stock.cap === null ? [] : [stock.cap]));
  return known.length > 0 ? Math.min(...known) : 1;
}

/**
 * MAHALLELER, GÜÇLÜDEN ZAYIFA. Değişim ağırlıklı ortalama, çünkü siluette
 * göz de geniş binaya bakıyor: Nvidia'nın %2'si ile küçük bir üyenin %2'si
 * mahallenin gününde aynı payı taşımıyor (Nasdaq 100'ün kendisi de piyasa
 * değeriyle ağırlıklı). Piyasa değerleri hiç okunamadıysa ağırlıklar eşit
 * (`capFloor`), künye bunu söylüyor.
 */
export function districtsOf(stocks: readonly SkyStock[]): District[] {
  const floor = capFloor(stocks);
  const groups = new Map<string, number[]>();
  stocks.forEach((stock, i) => {
    const list = groups.get(stock.district) ?? [];
    list.push(i);
    groups.set(stock.district, list);
  });
  const out: District[] = [];
  for (const [key, members] of groups) {
    let weight = 0;
    let sum = 0;
    for (const i of members) {
      const w = stocks[i].cap ?? floor;
      weight += w;
      sum += w * stocks[i].change;
    }
    members.sort((a, b) => stocks[b].change - stocks[a].change || stocks[a].symbol.localeCompare(stocks[b].symbol, "en"));
    out.push({
      key,
      change: weight > 0 ? sum / weight : 0,
      advancing: members.filter((i) => stocks[i].change > 0).length,
      declining: members.filter((i) => stocks[i].change < 0).length,
      members,
    });
  }
  return out.sort((a, b) => b.change - a.change || a.key.localeCompare(b.key, "en"));
}

/** Günün cümlesinin "sektörleri" mahallelerdir (`lib/day-poster-story.ts`). */
export function districtMoves(districts: readonly District[]): PosterMove[] {
  return districts.map((district) => ({ symbol: district.key, change: district.change }));
}

/* --------------------------------------------------------------------------
   Dikey ölçek
   -------------------------------------------------------------------------- */

/** Ölçeğin tabanı (yüzde puan): ±%0,3'lük sakin bir gün göğe değen bir
 *  silüet çizmesin; şehir o gün alçak. Posterin eski taban değeriyle aynı. */
export const SKY_FLOOR = 1;

/**
 * UÇ HİSSE ŞEHRİ EZMESİN. Bir hisse %12 oynadığında ölçek ona kurulursa
 * kalan yüz bina ufukta kibrit çöpü kalır. Ölçek mutlak değişimlerin
 * %98'lik dilimine kuruluyor (yüz binada en uçtaki iki bina); onları
 * aşan bina tavanda KESİK çiziliyor (`clip`) ve gerçek değeri
 * etiketinde ve ipucunda. Uç, dilimden ancak %25'ten fazla uzaksa kesiliyor:
 * yakın bir ucu kesmek bilgi kaybı, kazancı yok.
 */
export const SKY_CLIP_QUANTILE = 0.98;
export const SKY_CLIP_SLACK = 1.25;

export type SkyDomain = { hi: number; maxUp: number; maxDown: number };

export function skyDomain(changes: readonly number[]): SkyDomain {
  const abs = changes.map((change) => Math.abs(change)).sort((a, b) => a - b);
  const maxAbs = abs.length > 0 ? abs[abs.length - 1] : 0;
  const q = abs.length > 0 ? abs[Math.min(abs.length - 1, Math.round(SKY_CLIP_QUANTILE * (abs.length - 1)))] : 0;
  let hi = Math.max(SKY_FLOOR, q);
  if (maxAbs <= hi * SKY_CLIP_SLACK) hi = Math.max(SKY_FLOOR, maxAbs);
  return {
    hi,
    maxUp: Math.max(0, ...changes),
    maxDown: Math.max(0, ...changes.map((change) => -change)),
  };
}

/* --------------------------------------------------------------------------
   Düzenler
   -------------------------------------------------------------------------- */

/** Etiketin türü: tam (logo + sembol + yüzde), yalnız logo, ya da yok. */
export type LabelKind = "full" | "logo" | "none";

export type SkyMode = {
  /** Sıranın eni (birim). */
  width: number;
  /** Sıra sayısı: telefonda mahalleler alt alta. */
  rows: number;
  /** Binalar arası boşluk ve mahalleler arası sokak. */
  gap: number;
  districtGap: number;
  /** En dar bina ve en dar mahalle (mahallenin adı sığsın). */
  minW: number;
  minDistrictW: number;
  /** Ölçeğin tavanındaki binanın boyu (ufuktan). */
  half: number;
  /** Ufkun iki yanının en az boyu (kesirle): tek yönlü bir günde de su ve gök görünsün. */
  minSide: number;
  label: LabelKind;
  /** Çatısında etiket olan en büyük şirket sayısı ve iki yönün uç hisse sayısı. */
  labelCaps: number;
  labelExtremes: number;
  /** Etiketin punto ve logo çapı (birim). */
  font: number;
  logo: number;
};

/**
 * DÜZENLER. Her biri bir kap eni aralığında görünüyor (CSS kap sorgusu,
 * `SkyScene.module.css`); sunucu ekranın enini bilmediği için hepsi basılı,
 * görünmeyen `display:none`. `width` o aralıkta birim ≈ piksel olacak
 * biçimde: punto 11–13 piksel, logo karosu 22–32.
 *
 *   narrow  kap < 560 (telefon) — üç sıra
 *   medium  560–979 (tablet, dar masaüstü) — iki sıra
 *   wide    980–1499 — tek sıra
 *   xwide   ≥ 1500 (1920, 2560) — tek sıra, alanı dolduruyor
 *   strip*  ana sayfanın şeridi: posterden alçak; dar < 600 (iki sıra),
 *           orta 600–1079 (tablet: 768'de birim ≈ 0,75 piksel), geniş
 *           1080–1499, çok geniş ≥ 1500
 *   og*     paylaşım görseli; mini arşiv kartı (etiketsiz)
 *
 * LOGOLAR BÜYÜDÜ (25 Ekim, "Silüet" turu). Sahibi: "logolar, şirketler
 * daha görünür ve anlaşılır olmalı." Şeritte 18 birimlik yuvarlak logo tek
 * başına duruyordu (sembol ve yüzde yoktu), posterde 20. Şimdi her düzende
 * karo + sembol + yüzde; masaüstünde karo 28–32 piksel. Etiket sayısı da
 * SAHNE GENELİNDE (`labelCaps` en büyük şirket, `labelExtremes` iki yönün
 * uçları): telefonda en büyük altı ve birer uç, 1920'de on dört ve üçer.
 */
export const SKY_MODES = {
  narrow: { width: 400, rows: 3, gap: 1.2, districtGap: 10, minW: 1.8, minDistrictW: 92, half: 52, minSide: 0.22, label: "full", labelCaps: 8, labelExtremes: 1, font: 13, logo: 26 },
  medium: { width: 760, rows: 2, gap: 1.6, districtGap: 14, minW: 2.4, minDistrictW: 112, half: 82, minSide: 0.2, label: "full", labelCaps: 10, labelExtremes: 2, font: 12, logo: 26 },
  wide: { width: 1200, rows: 1, gap: 2, districtGap: 18, minW: 3, minDistrictW: 120, half: 124, minSide: 0.18, label: "full", labelCaps: 12, labelExtremes: 3, font: 12, logo: 30 },
  xwide: { width: 1680, rows: 1, gap: 2.4, districtGap: 24, minW: 3.6, minDistrictW: 140, half: 160, minSide: 0.18, label: "full", labelCaps: 14, labelExtremes: 3, font: 13, logo: 32 },
  stripNarrow: { width: 400, rows: 2, gap: 1.2, districtGap: 10, minW: 1.8, minDistrictW: 86, half: 34, minSide: 0.25, label: "full", labelCaps: 6, labelExtremes: 1, font: 13, logo: 26 },
  stripMedium: { width: 900, rows: 1, gap: 1.6, districtGap: 14, minW: 2.4, minDistrictW: 104, half: 50, minSide: 0.24, label: "full", labelCaps: 10, labelExtremes: 2, font: 15, logo: 32 },
  stripWide: { width: 1200, rows: 1, gap: 2, districtGap: 18, minW: 3, minDistrictW: 120, half: 58, minSide: 0.24, label: "full", labelCaps: 12, labelExtremes: 3, font: 11, logo: 28 },
  stripXwide: { width: 1680, rows: 1, gap: 2.4, districtGap: 24, minW: 3.6, minDistrictW: 140, half: 72, minSide: 0.24, label: "full", labelCaps: 14, labelExtremes: 3, font: 13, logo: 32 },
  og: { width: 1080, rows: 1, gap: 2, districtGap: 16, minW: 2.6, minDistrictW: 96, half: 118, minSide: 0.2, label: "full", labelCaps: 6, labelExtremes: 2, font: 15, logo: 26 },
  ogTall: { width: 960, rows: 2, gap: 2, districtGap: 16, minW: 2.6, minDistrictW: 120, half: 110, minSide: 0.2, label: "full", labelCaps: 10, labelExtremes: 2, font: 19, logo: 32 },
  mini: { width: 320, rows: 1, gap: 0.6, districtGap: 5, minW: 0.9, minDistrictW: 0, half: 52, minSide: 0.2, label: "none", labelCaps: 0, labelExtremes: 0, font: 0, logo: 0 },
} as const satisfies Record<string, SkyMode>;

export type SkyModeName = keyof typeof SKY_MODES;

export type SkyBuilding = {
  /** `stocks` dizini. */
  i: number;
  x: number;
  w: number;
  /** Ufuktan boy (hep pozitif); yön `dir`de. */
  h: number;
  /** 1 yükseldi (ufkun üstü), −1 düştü (altı), 0 değişmedi. */
  dir: 1 | -1 | 0;
  /** Ölçeğin dışında: tavanda kesik çiziliyor. */
  clip: boolean;
  /** Girişte yükselmeye başlama anı (saniye). */
  delay: number;
};

export type SkyLabel = {
  i: number;
  /** Kutunun sol üstü ve ölçüsü — sıranın koordinatında (ufuk y=0). */
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 1 | -1;
  /** Etiket çatısından uzaklaştıysa çatıya inen ince çizgi. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
};

export type SkyDistrictSpan = {
  key: string;
  x0: number;
  x1: number;
  change: number;
  /** Mahallenin yükselmeye başlama anı (saniye) — giriş mahalle mahalle. */
  delay: number;
};

export type SkyRow = {
  /** Sıranın görünen kutusu, ufuk y=0'a göre: `top` negatif. */
  top: number;
  bottom: number;
  /** Ufkun üstündeki ve altındaki bina alanı (su ve gök tonu). */
  upH: number;
  downH: number;
  buildings: SkyBuilding[];
  labels: SkyLabel[];
  districts: SkyDistrictSpan[];
};

export type SkyLayout = {
  mode: SkyModeName;
  width: number;
  domain: SkyDomain;
  rows: SkyRow[];
};

/** Bina boyunun alt sınırı (birim): %0,01'lik kıpırtı da görünsün. */
const MIN_H = 1.2;
/** Kenar payı: etiket ve en uçtaki bina kutunun içinde kalsın. */
const EDGE = 4;
/** Sokak genişlemesinin tavanı: artan yer sokaklara, kalanı ortalanıyor. */
const MAX_GAP_STRETCH = 2.2;
/** `k`nin ikiye bölme adımı: 40 adımda hata eni 2⁻⁴⁰ kat — birimin çok altı. */
const K_BISECT_STEPS = 40;
/**
 * GİRİŞ MAHALLE MAHALLE (25 Ekim, "Silüet" turu). Yüz binanın her biri
 * ayrı bir CSS animasyonuydu (SVG dönüşümü ana iş parçacığında çiziliyor);
 * şimdi mahalle başına TEK grup yükseliyor (yedi animasyon) ve sıra
 * okumayla aynı: güçlü mahalleden zayıfa. Zaman çizelgesi (saniye):
 *   0      gök tonu belirmeye başlıyor (0,5 sn)
 *   0,12   ilk mahalle ufuktan yükseliyor; son mahalle 0,12 + 0,42'de
 *   +0,5   her mahallenin yükselişi
 *   0,6    yansıma suya iniyor (0,45 sn)
 *   0,86   logolar yumuşak yayla oturuyor (0,34 sn) — bitiş 1,2 sn
 * Değerler `SkyScene.module.css`teki animasyonlarla aynı; değiştirirsen
 * ikisini birden.
 */
export const RISE_START = 0.12;
export const RISE_SPREAD = 0.42;
export const RISE_DURATION = 0.5;

/** `n` öğenin sırayı koruyarak `rows` (en çok `n`) boş olmayan parçaya
 *  bütün bölünüşleri. Mahalle sayısı küçük (≤ 8), sıra ≤ 3: en çok 21. */
export function rowSplits(n: number, rows: number): number[][][] {
  const k = Math.max(1, Math.min(rows, n));
  const out: number[][][] = [];
  const visit = (start: number, left: number, sets: number[][]) => {
    if (left === 1) {
      out.push([...sets, Array.from({ length: n - start }, (_, j) => start + j)]);
      return;
    }
    for (let cut = start + 1; cut <= n - left + 1; cut++) {
      visit(cut, left - 1, [...sets, Array.from({ length: cut - start }, (_, j) => start + j)]);
    }
  };
  if (n === 0) return [[]];
  visit(0, k, []);
  return out;
}

/**
 * Yüklere göre sıra bölme: sıra korunuyor (okuma soldan sağa, yukarıdan
 * aşağı = güçlüden zayıfa), en dolu sıranın yükü en aza iniyor. Siluetin
 * kendisi bölmeyi doğrudan ortak `k` ile seçiyor (`skylineLayout`); bu
 * yük sürümü genel yardımcı ve testlerin referansı.
 */
export function partitionRows(loads: readonly number[], rows: number): number[][] {
  let best: { sets: number[][]; worst: number; spread: number } | null = null;
  for (const sets of rowSplits(loads.length, rows)) {
    const sizes = sets.map((set) => set.reduce((acc, i) => acc + loads[i], 0));
    const worst = Math.max(...sizes);
    const spread = worst - Math.min(...sizes);
    if (!best || worst < best.worst - 1e-9 || (Math.abs(worst - best.worst) < 1e-9 && spread < best.spread)) {
      best = { sets, worst, spread };
    }
  }
  return best?.sets ?? [];
}

/** Etiket kutusunun ölçüsü (birim). Yazı genişliği tahmini: kalın
 *  Schibsted'de rakam ve büyük harf ~0,62em; tahmin ÜSTTEN, gerçek metin
 *  kutuya her zaman sığıyor (tarayıcıda ölçüldü). */
const CHAR_EM = 0.62;
/** Yüzdenin en uzun hâli: "+%10,25" / "+10.25%". */
const PCT_CHARS = 7;
const LABEL_GAP = 3;

export function labelBox(kind: LabelKind, symbol: string, mode: Pick<SkyMode, "font" | "logo">): { w: number; h: number } {
  if (kind === "none") return { w: 0, h: 0 };
  if (kind === "logo") return { w: mode.logo, h: mode.logo };
  const text = Math.max(symbol.length, PCT_CHARS) * mode.font * CHAR_EM;
  return { w: Math.max(mode.logo, text), h: mode.logo + 2 + mode.font * 2.3 };
}

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Çatısında etiket olacak binalar, öncelik sırasıyla: önce en büyük
 *  şirketler (siluetin tanınır binaları), sonra günün uçları. */
export function labelPicks(stocks: readonly SkyStock[], members: readonly number[], caps: number, extremes: number): number[] {
  const set = new Set(members);
  const pool = [...set];
  const byCap = pool
    .filter((i) => stocks[i].cap !== null)
    .sort((a, b) => (stocks[b].cap ?? 0) - (stocks[a].cap ?? 0))
    .slice(0, caps);
  const ups = pool
    .filter((i) => stocks[i].change > 0)
    .sort((a, b) => stocks[b].change - stocks[a].change)
    .slice(0, extremes);
  const downs = pool
    .filter((i) => stocks[i].change < 0)
    .sort((a, b) => stocks[a].change - stocks[b].change)
    .slice(0, extremes);
  return [...new Set([...byCap, ...ups, ...downs])];
}

/** Yatay arama: etiket çatısından en çok kendi eninin bu katı kadar
 *  kayabiliyor; kayma maliyeti kalkışın bu kesri (yana kaymak, yukarı
 *  yığılmaktan ucuz — şerit alçak kalıyor). */
const LABEL_REACH = 3;
const LABEL_SHIFT_COST = 0.3;

/**
 * ETİKETLER ÇAKIŞMAZ. Her etiket çatısının üstünde (düşen binada tabanının
 * altında) ortalanmış başlıyor. Altındaki binalardan yüksekse onların
 * üstüne kalkıyor; yerleşmiş bir etikete biniyorsa önce yana kayıyor, sonra
 * kalkıyor; en kısa yolu seçiyor. Çatısından ayrılan etikete ince bir çizgi
 * iniyor. Sonuç testli: hiçbir iki kutu kesişmiyor, hiçbiri bir binaya
 * binmiyor ve kutu sıranın eninde kalıyor (`tests/day-skyline.test.ts`).
 *
 * EN UZUN BİNA ÖNCE (25 Ekim, "Silüet" turu). Etiketler seçim sırasıyla
 * (önce büyük şirketler, sonra uçlar) yerleşiyordu; uçlar en uzun binalar
 * olduğu için en son gelip ötekilerin ÜSTÜNE yığılıyordu ve şerit üç kat
 * etiketle yükseliyordu. Şimdi en uzun bina önce: onun etiketi zaten en
 * yukarıda, kısa binaların etiketleri altında boş kalan yere iniyor.
 * Yatay arama da genişledi (±3 etiket eni, `LABEL_REACH`): tohumlu
 * şehirde şeridin sıra yüksekliği ölçüldü, test dosyası.
 */
export function placeLabels(
  buildings: readonly SkyBuilding[],
  picks: readonly number[],
  stocks: readonly SkyStock[],
  mode: Pick<SkyMode, "width" | "font" | "logo" | "label" | "gap">,
): SkyLabel[] {
  if (mode.label === "none") return [];
  const byI = new Map(buildings.map((b) => [b.i, b] as const));
  const placed: SkyLabel[] = [];
  const roofOf = (b: SkyBuilding) => (b.dir === -1 ? b.h : -b.h);
  const steps: number[] = [0];
  for (let k = 0.5; k <= LABEL_REACH + 1e-9; k += 0.5) steps.push(-k, k);
  const order = picks
    .filter((i) => byI.has(i))
    .sort((a, b) => byI.get(b)!.h - byI.get(a)!.h || picks.indexOf(a) - picks.indexOf(b));
  for (const i of order) {
    const b = byI.get(i)!;
    const dir: 1 | -1 = b.dir === -1 ? -1 : 1;
    const { w, h } = labelBox(mode.label, stocks[i].symbol, mode);
    const cx = b.x + b.w / 2;
    const offsets = steps.map((k) => k * w);
    let best: { label: SkyLabel; cost: number } | null = null;
    for (const dx of offsets) {
      const x = Math.min(mode.width - EDGE - w, Math.max(EDGE, cx - w / 2 + dx));
      /* Kutunun altında kalan binalar: kutu onların çatısının üstünde. */
      let edge = roofOf(b);
      for (const other of buildings) {
        if (other.x + other.w <= x - 1 || other.x >= x + w + 1) continue;
        if (other.dir === 0) continue;
        const otherDir = other.dir === -1 ? -1 : 1;
        if (otherDir !== dir) continue;
        edge = dir === 1 ? Math.min(edge, roofOf(other)) : Math.max(edge, roofOf(other));
      }
      let y = dir === 1 ? edge - LABEL_GAP - h : edge + LABEL_GAP;
      /* Yerleşmiş etikete biniyorsa onun ötesine kalk. */
      for (let guard = 0; guard < placed.length + 1; guard++) {
        const hit = placed.find((p) => overlaps({ x, y, w, h }, p, 2));
        if (!hit) break;
        y = dir === 1 ? Math.min(y, hit.y - 2 - h - 0.01) : Math.max(y, hit.y + hit.h + 2 + 0.01);
      }
      const roof = roofOf(b);
      const near = dir === 1 ? y + h : y;
      const lift = Math.abs(near - roof) - LABEL_GAP;
      const cost = lift + Math.abs(dx) * LABEL_SHIFT_COST;
      const attached = cx >= x && cx <= x + w && lift < 2;
      const label: SkyLabel = {
        i,
        x,
        y,
        w,
        h,
        dir,
        leader: attached
          ? null
          : { x1: cx, y1: roof + (dir === 1 ? -1 : 1), x2: Math.min(x + w - 2, Math.max(x + 2, cx)), y2: near },
      };
      if (!best || cost < best.cost) best = { label, cost };
    }
    if (best) placed.push(best.label);
  }
  /* Çizim sırası seçim sırası (önce büyük şirketler): okuma ve test aynı. */
  return placed.sort((a, b) => picks.indexOf(a.i) - picks.indexOf(b.i));
}

/**
 * SİLUETİN YERLEŞİMİ. Mahalleler sıralara (en büyük ortak k), binalar
 * mahallelere; genişlik `minW + k·√cap`, `k` en dolu sıradan çıkıyor ve
 * BÜTÜN SIRALARDA AYNI: telefonda iki sıradaki aynı büyüklükteki şirket
 * aynı genişlikte. Sığmayan mahalle adı için mahalle `minDistrictW`e
 * genişliyor (binalar ortada), artan yer önce sokaklara, kalanı ortaya.
 */
export function skylineLayout({
  stocks,
  districts,
  mode: modeName,
  domain = skyDomain(stocks.map((stock) => stock.change)),
}: {
  stocks: readonly SkyStock[];
  districts: readonly District[];
  mode: SkyModeName;
  domain?: SkyDomain;
}): SkyLayout {
  const mode: SkyMode = SKY_MODES[modeName];
  const floor = capFloor(stocks);
  const weight = (i: number) => Math.sqrt(stocks[i].cap ?? floor);
  const usable = mode.width - EDGE * 2;
  const spanOf = (d: District, k: number) =>
    d.members.reduce((s, i) => s + mode.minW + k * weight(i), 0) + Math.max(0, d.members.length - 1) * mode.gap;
  const rowFixed = (set: number[]) => Math.max(0, set.length - 1) * mode.districtGap;
  /* Sıranın eni `Σ max(minDistrictW, span(k)) + sokaklar`: k'de monoton
     artıyor ama kırıklı (k küçüldükçe daha çok mahalle tabana dayanıyor). */
  const rowWidth = (set: number[], kk: number) =>
    set.reduce((acc, index) => acc + Math.max(mode.minDistrictW, spanOf(districts[index], kk)), 0) + rowFixed(set);
  /* Bir sıranın sığdırabildiği en büyük `k`, ikiye bölmeyle. Önceki sabit
     nokta döngüsü kırıklarda salınıp fazla büyük bir k'de kalıyordu:
     medium düzende ikinci sıra 760'lık enin 26 birim dışına taşıyordu.
     k=0'da bile sığmayan sıra NEGATİF puan alıyor (taşma kadar), böylece
     bölme seçiminde her zaman sığan bölme önde. */
  const rowK = (set: number[]) => {
    const weights = set.reduce((acc, index) => acc + districts[index].members.reduce((s, i) => s + weight(i), 0), 0);
    const atZero = rowWidth(set, 0);
    if (atZero > usable) return usable - atZero;
    if (weights <= 0) return Infinity;
    let lo = 0;
    let hiK = usable / weights;
    for (let step = 0; step < K_BISECT_STEPS; step++) {
      const mid = (lo + hiK) / 2;
      if (rowWidth(set, mid) <= usable) lo = mid;
      else hiK = mid;
    }
    return lo;
  };
  /* SIRALARA BÖLME DOĞRUDAN ORTAK k İLE (25 Ekim). Bölme önce karekök
     yüküyle, sonra genişlik tahminiyle seçiliyordu; ikisi de mahalle
     tabanını ıskaladı: gerçek 23 Ekim verisinde telefonda (narrow, üç
     sıra) Teknoloji'nin ağırlığı onu tek başına bir sıraya itti, kalan beş
     mahalle üçüncü sıraya düştü (5×92 + sokaklar = 500 > 400) ve "Temel
     Tüketim" kabın dışında kaldı (390 ekran görüntüsü). Şimdi her ardışık
     bölme deneniyor (yedi mahalle, üç sıra: 15 aday) ve EN BÜYÜK ORTAK
     k'yi veren seçiliyor — binalar en geniş, hiçbir sıra taşmıyor. Eşitlikte
     sıra enleri en dengeli olan. */
  let rowSets: number[][] = [];
  let k = -Infinity;
  let bestSpread = Infinity;
  for (const split of rowSplits(districts.length, mode.rows)) {
    const score = Math.min(...split.map(rowK));
    const kk = Number.isFinite(score) ? Math.max(0, score) : 0;
    const widths = split.map((set) => rowWidth(set, kk));
    const spread = Math.max(...widths) - Math.min(...widths);
    if (score > k + 1e-9 || (Math.abs(score - k) <= 1e-9 && spread < bestSpread)) {
      rowSets = split;
      k = score;
      bestSpread = spread;
    }
  }
  k = Number.isFinite(k) ? Math.max(0, k) : 0;

  const hi = domain.hi;
  const scale = (value: number) => (Math.min(Math.abs(value), hi) / hi) * mode.half;
  const minSide = mode.half * mode.minSide;
  const upH = Math.max(minSide, scale(domain.maxUp));
  const downH = Math.max(minSide, scale(domain.maxDown));
  /* Etiketli binalar sahne genelinde seçiliyor (sıra başına değil):
     telefonda iki sıra "en büyük altı" sözünü iki katına çıkarıyordu. */
  const picks = labelPicks(
    stocks,
    districts.flatMap((d) => d.members),
    mode.labelCaps,
    mode.labelExtremes,
  );
  const delayOf = (index: number) => RISE_START + (districts.length > 1 ? index / (districts.length - 1) : 0) * RISE_SPREAD;

  const rows: SkyRow[] = rowSets.map((set) => {
    const spans = set.map((index) => Math.max(spanOf(districts[index], k), mode.minDistrictW));
    const used = spans.reduce((a, b) => a + b, 0) + rowFixed(set);
    const spare = Math.max(0, usable - used);
    const stretch = set.length > 1 ? Math.min(spare / (set.length - 1), mode.districtGap * (MAX_GAP_STRETCH - 1)) : 0;
    const gapW = mode.districtGap + stretch;
    let x = EDGE + (spare - stretch * Math.max(0, set.length - 1)) / 2;
    const buildings: SkyBuilding[] = [];
    const spansOut: SkyDistrictSpan[] = [];
    set.forEach((index, j) => {
      const d = districts[index];
      const natural = spanOf(d, k);
      const x0 = x;
      let bx = x + (spans[j] - natural) / 2;
      for (const i of d.members) {
        const w = mode.minW + k * weight(i);
        const change = stocks[i].change;
        const dir: 1 | -1 | 0 = change > 0 ? 1 : change < 0 ? -1 : 0;
        buildings.push({
          i,
          x: bx,
          w,
          h: Math.max(MIN_H, scale(change)),
          dir,
          clip: Math.abs(change) > hi,
          delay: delayOf(index),
        });
        bx += w + mode.gap;
      }
      x += spans[j];
      spansOut.push({ key: d.key, x0, x1: x, change: d.change, delay: delayOf(index) });
      x += gapW;
    });
    const inRow = new Set(set.flatMap((index) => districts[index].members));
    const labels = placeLabels(
      buildings,
      picks.filter((i) => inRow.has(i)),
      stocks,
      mode,
    );
    const top = Math.min(-upH, ...labels.map((label) => label.y)) - 2;
    const bottom = Math.max(downH, ...labels.map((label) => label.y + label.h)) + 2;
    return { top, bottom, upH, downH, buildings, labels, districts: spansOut };
  });

  return { mode: modeName, width: mode.width, domain, rows };
}

/* --------------------------------------------------------------------------
   Çizim yardımcıları
   -------------------------------------------------------------------------- */

const fixed = (value: number) => (Math.round(value * 100) / 100).toString();

/**
 * Binanın yolu: ufka oturan köşeler keskin, uç köşeler yuvarlak (dataviz:
 * veri ucunda 2 birimlik yarıçap, tabanda değil). Kesik bina (`clip`)
 * tavanda bir YARIKLA bölünüyor: ölçeğin dışına taştığını gösteren işaret.
 * Yarık yolun kendisinde (iki alt yol): eskiden zemin renginde bir
 * dikdörtgendi, gök degrade olunca zeminle aynı renk tutmuyordu.
 */
export function buildingPath(b: SkyBuilding): string {
  const r = Math.min(2, b.w / 2, b.h);
  const x0 = b.x;
  const x1 = b.x + b.w;
  if (b.dir === 0) {
    const half = b.h / 2;
    return `M${fixed(x0)} ${fixed(-half)}H${fixed(x1)}V${fixed(half)}H${fixed(x0)}Z`;
  }
  const s = b.dir === -1 ? 1 : -1;
  const y1 = s * b.h;
  const tip = `V${fixed(y1 - s * r)}Q${fixed(x0)} ${fixed(y1)} ${fixed(x0 + r)} ${fixed(y1)}H${fixed(x1 - r)}Q${fixed(x1)} ${fixed(y1)} ${fixed(x1)} ${fixed(y1 - s * r)}`;
  if (!b.clip) return `M${fixed(x0)} 0${tip}V0Z`;
  const m = clipMark(b);
  const near = b.dir === -1 ? m.y : m.y + m.h;
  const far = b.dir === -1 ? m.y + m.h : m.y;
  return `M${fixed(x0)} 0V${fixed(near)}H${fixed(x1)}V0ZM${fixed(x0)} ${fixed(far)}${tip}V${fixed(far)}Z`;
}

/** Kesik binanın tavan işareti: binanın enince, uca yakın ince bir yarık. */
export function clipMark(b: SkyBuilding): { x: number; y: number; w: number; h: number } {
  const gap = 1.6;
  const at = b.h - 7;
  return { x: b.x - 0.5, y: b.dir === -1 ? at : -at - gap, w: b.w + 1, h: gap };
}

/* --------------------------------------------------------------------------
   Sahnenin yolları (25 Ekim, "Silüet" turu)
   -------------------------------------------------------------------------- */

/** Pencere ritmi yalnız büyük binada: en az bu en ve boyda (birim). Küçük
 *  binada pencere gürültü olur; ritim büyük şirketleri işaretliyor. */
export const WINDOW_MIN_W = 9;
export const WINDOW_MIN_H = 16;
/** Pencere alanının bina kenarından içe payı ve çatıdan uzaklığı. */
const WINDOW_INSET = 2;
const WINDOW_ROOF = 5;
/** Çatı ışığının kalınlığı (birim): binanın ucunda ince, açık bir şerit. */
export const ROOF_LIGHT = 1.2;
/** Yansımanın boyu binanın kesri: suda kısalmış, sönen bir ikiz. */
export const REFLECTION_SCALE = 0.42;

export type SkyDistrictInk = {
  key: string;
  delay: number;
  /** Yön başına birleşik bina yolu: mahalle başına en çok üç öğe. */
  up: string;
  down: string;
  flat: string;
  /** Büyük binaların pencere alanları (desenle doluyor) ve çatı ışıkları. */
  windows: string;
  roofs: string;
};

const rectPath = (x: number, y: number, w: number, h: number) =>
  `M${fixed(x)} ${fixed(y)}h${fixed(w)}v${fixed(h)}h${fixed(-w)}Z`;

/**
 * SAHNE YOLLARI. Yüz bina yüz `<path>` değil: mahalle başına yön yönüne
 * birleşik yollar, pencere alanları ve çatı ışıkları; sıra başına bir
 * yansıma yolu (yalnız yükselen binalar — düşen bina zaten suda, yansıması
 * göğe çıkıp "yükseldi" diye okunurdu). Düğüm sayısı ~350'den ~40'a iniyor;
 * etkileşim yine bina bina (isabet sütunla, `Skyline`/`SkyScene`), etkin
 * bina ayrıca çiziliyor.
 */
export function cityInk(row: SkyRow, stocks: readonly SkyStock[]): { districts: SkyDistrictInk[]; reflection: string } {
  const byKey = new Map<string, SkyDistrictInk>();
  for (const span of row.districts) {
    byKey.set(span.key, { key: span.key, delay: span.delay, up: "", down: "", flat: "", windows: "", roofs: "" });
  }
  let reflection = "";
  for (const b of row.buildings) {
    const ink = byKey.get(stocks[b.i].district);
    if (!ink) continue;
    const path = buildingPath(b);
    if (b.dir === 1) {
      ink.up += path;
      reflection += path;
    } else if (b.dir === -1) ink.down += path;
    else ink.flat += path;
    if (b.dir === 0) continue;
    /* Çatı ışığı: köşe yuvarlaklığının içinde kalıyor. */
    const r = Math.min(2, b.w / 2, b.h);
    const lw = b.w - r * 2;
    if (lw > 0.4 && b.h > ROOF_LIGHT * 2) {
      ink.roofs += rectPath(b.x + r, b.dir === 1 ? -b.h : b.h - ROOF_LIGHT, lw, ROOF_LIGHT);
    }
    if (b.w >= WINDOW_MIN_W && b.h >= WINDOW_MIN_H) {
      const ww = b.w - WINDOW_INSET * 2;
      const wh = b.h - WINDOW_ROOF - WINDOW_INSET;
      ink.windows += rectPath(b.x + WINDOW_INSET, b.dir === 1 ? -b.h + WINDOW_ROOF : WINDOW_INSET, ww, wh);
    }
  }
  return { districts: [...byKey.values()], reflection };
}

export type SkyInk = { up: string; down: string; flat: string; horizon: string; water: string };

/**
 * Durağan SVG — arşiv kartının minyatürü (`/gun/[tarih]/minyatur`). Yalnız
 * binalar, su ve ufuk; yazı yok. Renkler çağırandan (dosya sayfanın CSS
 * değişkenlerini okuyamıyor).
 */
export function skylineSvg(layout: SkyLayout, ink: SkyInk): string {
  const parts: string[] = [];
  let offset = 0;
  for (const row of layout.rows) {
    const horizon = offset - row.top;
    parts.push(`<g transform="translate(0 ${fixed(horizon)})">`);
    parts.push(`<rect x="0" y="0" width="${layout.width}" height="${fixed(row.downH)}" fill="${ink.water}"/>`);
    const byTone: Record<"up" | "down" | "flat", string[]> = { up: [], down: [], flat: [] };
    for (const b of row.buildings) {
      byTone[b.dir === 1 ? "up" : b.dir === -1 ? "down" : "flat"].push(`<path d="${buildingPath(b)}"/>`);
    }
    if (byTone.up.length) parts.push(`<g fill="${ink.up}">${byTone.up.join("")}</g>`);
    if (byTone.down.length) parts.push(`<g fill="${ink.down}" fill-opacity="0.82">${byTone.down.join("")}</g>`);
    if (byTone.flat.length) parts.push(`<g fill="${ink.flat}">${byTone.flat.join("")}</g>`);
    parts.push(`<line x1="0" y1="0" x2="${layout.width}" y2="0" stroke="${ink.horizon}" stroke-width="1"/>`);
    parts.push("</g>");
    offset += row.bottom - row.top;
  }
  const height = fixed(offset);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${height}" width="${layout.width}" height="${height}">${parts.join("")}</svg>`;
}

/**
 * Günün uçları: en çok yükselen ve en çok düşen `n` hisse (`stocks`
 * dizinleri). Künye kartı ve paylaşım görseli.
 */
export function skyExtremes(stocks: readonly SkyStock[], n = 3): { up: number[]; down: number[] } {
  const all = stocks.map((_, i) => i);
  return {
    up: all.filter((i) => stocks[i].change > 0).sort((a, b) => stocks[b].change - stocks[a].change).slice(0, n),
    down: all.filter((i) => stocks[i].change < 0).sort((a, b) => stocks[a].change - stocks[b].change).slice(0, n),
  };
}
