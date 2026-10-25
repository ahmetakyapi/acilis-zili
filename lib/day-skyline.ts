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
 *     ve yüzde (`placeLabels`; etiket binasının ekseninde, birbirine ve
 *     binalara binmiyor).
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
 *
 * ŞERİT ALÇALDI (25 Ekim gece; sahibi: "Burası bir tık daha kompakt ve daha
 * az yer kaplayabilir"). Ana sayfa şeridinin masaüstü düzenlerinde ölçeğin
 * tavanı (`half`) 58 → 42 ve 72 → 52, karo 28 → 26 ve 32 → 28, ufkun iki
 * yanının taban payı (`minSide`) 0,24 → 0,2: düşüşlerin derinliği gerçek
 * ölçekte kalıyor, boş su payı azalıyor. 1440'ta panel 447 → 358 piksel
 * (TR, 23 Ekim). Posterin düzenlerine dokunulmadı.
 */
export const SKY_MODES = {
  narrow: { width: 400, rows: 3, gap: 1.2, districtGap: 10, minW: 1.8, minDistrictW: 92, half: 52, minSide: 0.22, label: "full", labelCaps: 8, labelExtremes: 1, font: 13, logo: 26 },
  medium: { width: 760, rows: 2, gap: 1.6, districtGap: 14, minW: 2.4, minDistrictW: 112, half: 82, minSide: 0.2, label: "full", labelCaps: 10, labelExtremes: 2, font: 12, logo: 26 },
  wide: { width: 1200, rows: 1, gap: 2, districtGap: 18, minW: 3, minDistrictW: 120, half: 124, minSide: 0.18, label: "full", labelCaps: 12, labelExtremes: 3, font: 12, logo: 30 },
  xwide: { width: 1680, rows: 1, gap: 2.4, districtGap: 24, minW: 3.6, minDistrictW: 140, half: 160, minSide: 0.18, label: "full", labelCaps: 14, labelExtremes: 3, font: 13, logo: 32 },
  stripNarrow: { width: 400, rows: 2, gap: 1.2, districtGap: 10, minW: 1.8, minDistrictW: 86, half: 34, minSide: 0.25, label: "full", labelCaps: 6, labelExtremes: 1, font: 13, logo: 26 },
  stripMedium: { width: 900, rows: 1, gap: 1.6, districtGap: 14, minW: 2.4, minDistrictW: 96, half: 44, minSide: 0.2, label: "full", labelCaps: 10, labelExtremes: 2, font: 15, logo: 30 },
  stripWide: { width: 1200, rows: 1, gap: 2, districtGap: 18, minW: 3, minDistrictW: 120, half: 42, minSide: 0.2, label: "full", labelCaps: 12, labelExtremes: 3, font: 11, logo: 26 },
  stripXwide: { width: 1680, rows: 1, gap: 2.4, districtGap: 24, minW: 3.6, minDistrictW: 140, half: 52, minSide: 0.2, label: "full", labelCaps: 14, labelExtremes: 3, font: 13, logo: 28 },
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
  /** Kat: 0 çatının hemen üstü (düşende altı), 1 yerleşmiş bir etiketin ötesi. */
  tier: number;
  /** Etiket çatısına oturmuyorsa çatıdan (x1, y1) etikete (x2, y2) dik bağ
   *  çizgisi; çizim çatıya küçük bir nokta da koyuyor. Dikey: x1 = x2. */
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
/** Etiket kenar payının denenen kesirleri ve kabul ölçüsü: pay binaların
 *  ortak ölçeğini (`k`) en çok %15 düşürebilir. */
const SIDE_SHARES = [1, 0.5] as const;
const SIDE_KEEP_K = 0.85;
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
/** Yüzdenin sabit karakterleri: işaret, "%" ve ondalık ayıracı + iki hane. */
const PCT_FIXED_CHARS = 5;
const LABEL_GAP = 3;

/**
 * Yüzdenin karakter sayısı: işaret + "%" + tam kısmın haneleri + ",dd".
 * İki dilde aynı ("+%2,31" / "+2.31%"). Kutu bugünün GERÇEK yüzdesine göre
 * ölçülüyor (eskiden hep en uzun hâline, yedi karaktere): "+%2,31" yedi
 * karakterlik kutudan ~%14 dar, etiketler binasının üstünde daha sık
 * sığıyor. Değişim verilmezse en uzun hâli.
 */
export function pctChars(change?: number): number {
  if (change === undefined || !Number.isFinite(change)) return PCT_CHARS;
  const whole = Math.floor(Math.abs(change) + 0.005);
  return PCT_FIXED_CHARS + String(whole).length;
}

export function labelBox(
  kind: LabelKind,
  symbol: string,
  mode: Pick<SkyMode, "font" | "logo">,
  change?: number,
): { w: number; h: number } {
  if (kind === "none") return { w: 0, h: 0 };
  if (kind === "logo") return { w: mode.logo, h: mode.logo };
  const text = Math.max(symbol.length, pctChars(change)) * mode.font * CHAR_EM;
  return { w: Math.max(mode.logo, text), h: mode.logo + 2 + mode.font * 2.3 };
}

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Önceliğin başı: en büyük bu kadar şirket, sonra günün tek ucu (iki yön). */
const LABEL_HEAD_CAPS = 3;
/** Öncelik başının boyu (`labelPicks`in ilk öğeleri): üç şirket + iki uç. */
export const LABEL_HEAD = LABEL_HEAD_CAPS + 2;

/**
 * Çatısında etiket olacak binalar, ÖNCELİK SIRASIYLA. Yerleşim etiketleri bu
 * sırayla koyuyor; yer kalmazsa sondakiler düşüyor (`placeLabels`). Sıra:
 * en büyük üç şirket, günün en çok yükseleni ve en çok düşeni, kalan büyük
 * şirketler (büyükten küçüğe), kalan uçlar. Siluetin tanınır binaları ve
 * günün iki ucu böylece hiçbir düzende düşmüyor.
 */
export function labelPicks(stocks: readonly SkyStock[], members: readonly number[], caps: number, extremes: number): number[] {
  const set = new Set(members);
  const pool = [...set];
  const byCap = pool
    .filter((i) => stocks[i].cap !== null)
    .sort((a, b) => (stocks[b].cap ?? 0) - (stocks[a].cap ?? 0) || stocks[a].symbol.localeCompare(stocks[b].symbol, "en"))
    .slice(0, caps);
  const ups = pool
    .filter((i) => stocks[i].change > 0)
    .sort((a, b) => stocks[b].change - stocks[a].change || stocks[a].symbol.localeCompare(stocks[b].symbol, "en"))
    .slice(0, extremes);
  const downs = pool
    .filter((i) => stocks[i].change < 0)
    .sort((a, b) => stocks[a].change - stocks[b].change || stocks[a].symbol.localeCompare(stocks[b].symbol, "en"))
    .slice(0, extremes);
  return [
    ...new Set([
      ...byCap.slice(0, LABEL_HEAD_CAPS),
      ...ups.slice(0, 1),
      ...downs.slice(0, 1),
      ...byCap.slice(LABEL_HEAD_CAPS),
      ...ups.slice(1),
      ...downs.slice(1),
    ]),
  ];
}

/**
 * ETİKET BİNASININ ÜSTÜNDE (25 Ekim, "Silüet: etiket" turu).
 *
 * SAHİBİNİN İTİRAZI (canlıda 1440): "Micron sağda ama grafikte solda
 * kalıyor gibi, çok tuhaf." Etiketler çakışmasın diye kendi eninin üç
 * katına kadar YANA kayıyordu; gerçek 23 Ekim verisinde MU etiketi
 * binasından 95, META ve TSLA 143, 1920'de 169 birim uzaktaydı (birim ≈
 * piksel). İnce bağ çizgisi bu mesafede görünmüyordu; üzerine gelince solda
 * bir bina aydınlanıp etiket sağda kalıyordu.
 *
 * YENİ KURAL: etiketin merkezi binasının merkezinden en çok
 * `LABEL_MAX_SHIFT` (16 birim) uzakta. 16, etiketin yarı eninden (masaüstünde
 * 26–33) hep küçük: binanın ekseni HER ZAMAN etiketin içinden geçiyor ve
 * bağ çizgisi dimdik iniyor. Çakışma bu payla çözülmezse etiket İKİNCİ
 * KATA çıkıyor (`LABEL_TIERS`: yerleşmiş bir etiketin hemen üstü, düşende
 * altı); orası da doluysa etiket DÜŞÜYOR. Öncelik `labelPicks` sırası,
 * yani düşen hep sıranın sonundaki (küçük şirket ya da ikinci-üçüncü uç).
 *
 * BAĞ GÖRÜNÜR. Etiket çatısına oturmuyorsa (kaydıysa ya da yukarı
 * kalktıysa) çatıdan etikete dik bir çizgi ve çatıda küçük bir nokta
 * (`leader`; çizim `SkyMarks`). Bağ çizgisi başka bir etiketin içinden
 * geçmiyor, etiket de başka bir bağ çizgisinin üstüne oturmuyor.
 *
 * Kenardaki bina için ayrıca yer: düzenin kenar payı (`labelSide`) en
 * geniş etiketin yarısı eksi kayma payı kadar büyüyor, yoksa en soldaki
 * binanın (en güçlü mahallenin en çok yükseleni: çoğu gün bir uç) etiketi
 * kabın dışına taşmadan ortalanamazdı.
 *
 * Sonuç testli (`tests/day-skyline.test.ts`): gerçek 23 Ekim verisiyle ve
 * tohumlu kalabalık şehirle her düzende kayma ≤ eşik, kutular kesişmiyor,
 * binalara ve bağ çizgilerine binmiyor, en büyük üç şirket ve iki uç
 * etiketli.
 */
export const LABEL_MAX_SHIFT = 16;
/** Yatay aday adımı (birim): 0, ±4, ±8, ±12, ±16. */
const LABEL_SHIFT_STEP = 4;
/** Kat sayısı: zemin (çatının hemen üstü) ve bir kat yukarısı. */
export const LABEL_TIERS = 2;
/** Kat çıkmanın bedeli (birim): kaymaktan ve kalkmaktan hep pahalı. */
const TIER_COST = 1000;
/** Kayma bedeli birim başına; kalkış birim başına 1. */
const LABEL_SHIFT_COST = 0.6;
/** Bu kadarın altındaki kayma ve kalkış "çatıda oturuyor" sayılıyor. */
const ATTACH_SHIFT = 0.5;
const ATTACH_LIFT = 2;
/** Etiketler arası en küçük boşluk. */
const LABEL_PAD = 2;

/** Düzenin etiket için ayırdığı ek kenar payı (birim). */
export function labelSide(mode: Pick<SkyMode, "label" | "font" | "logo">): number {
  if (mode.label === "none") return 0;
  return Math.max(0, labelBox(mode.label, "", mode).w / 2 - LABEL_MAX_SHIFT);
}

type Segment = { x: number; y1: number; y2: number };
const segmentHits = (s: Segment, box: Box) =>
  s.x > box.x && s.x < box.x + box.w && Math.max(s.y1, s.y2) > box.y && Math.min(s.y1, s.y2) < box.y + box.h;

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
  const segmentOf = (label: SkyLabel): Segment | null =>
    label.leader ? { x: label.leader.x1, y1: label.leader.y1, y2: label.leader.y2 } : null;
  const shifts: number[] = [0];
  for (let k = LABEL_SHIFT_STEP; k <= LABEL_MAX_SHIFT + 1e-9; k += LABEL_SHIFT_STEP) shifts.push(-k, k);

  /** `i`nin geçerli yerleri, ucuzdan pahalıya; `maxTier` kata kadar, kutu `[top, bottom]` içinde. */
  const candidates = (i: number, maxTier: number, top: number, bottom: number) => {
    const out: { label: SkyLabel; cost: number }[] = [];
    const b = byI.get(i);
    if (!b) return out;
    const dir: 1 | -1 = b.dir === -1 ? -1 : 1;
    const { w, h } = labelBox(mode.label, stocks[i].symbol, mode, stocks[i].change);
    const cx = b.x + b.w / 2;
    const roof = roofOf(b);
    for (const dx of shifts) {
      const x = cx - w / 2 + dx;
      if (x < EDGE - 1e-6 || x + w > mode.width - EDGE + 1e-6) continue;
      /* Kutunun altında kalan aynı yöndeki binalar: kutu onların çatısının ötesinde. */
      let edge = roof;
      for (const other of buildings) {
        if (other.x + other.w <= x - 1 || other.x >= x + w + 1) continue;
        if (other.dir === 0 || (other.dir === -1 ? -1 : 1) !== dir) continue;
        edge = dir === 1 ? Math.min(edge, roofOf(other)) : Math.max(edge, roofOf(other));
      }
      let y = dir === 1 ? edge - LABEL_GAP - h : edge + LABEL_GAP;
      /* Yerleşmiş etikete biniyorsa onun ötesindeki kata çık; kat bittiyse aday düşer. */
      let tier = 0;
      let ok = true;
      for (let guard = 0; guard <= placed.length; guard++) {
        const hit = placed.find((p) => overlaps({ x, y, w, h }, p, LABEL_PAD));
        if (!hit) break;
        tier = Math.max(tier, hit.tier + 1);
        if (tier > maxTier) {
          ok = false;
          break;
        }
        y = dir === 1 ? Math.min(y, hit.y - LABEL_PAD - h - 0.01) : Math.max(y, hit.y + hit.h + LABEL_PAD + 0.01);
      }
      if (!ok || y < top - 1e-6 || y + h > bottom + 1e-6) continue;
      const box = { x, y, w, h };
      const near = dir === 1 ? y + h : y;
      const lift = Math.abs(near - roof) - LABEL_GAP;
      const attached = Math.abs(dx) < ATTACH_SHIFT && lift < ATTACH_LIFT;
      const segment: Segment | null = attached ? null : { x: cx, y1: roof, y2: near };
      /* Bağ çizgisi başka etiketin içinden geçmez; etiket başka bağın üstüne oturmaz. */
      if (segment && placed.some((p) => segmentHits(segment, p))) continue;
      if (placed.some((p) => {
        const s = segmentOf(p);
        return s !== null && segmentHits(s, box);
      })) continue;
      out.push({
        cost: tier * TIER_COST + lift + Math.abs(dx) * LABEL_SHIFT_COST,
        label: { i, x, y, w, h, dir, tier, leader: segment ? { x1: cx, y1: roof, x2: cx, y2: near } : null },
      });
    }
    /* Kararlı sıralama: eşit bedelde ortadaki aday (dx = 0) önde. */
    return out.sort((p, q) => p.cost - q.cost);
  };
  const tryPlace = (i: number, maxTier: number, top: number, bottom: number) => candidates(i, maxTier, top, bottom)[0] ?? null;
  const commit = (best: { label: SkyLabel }) => placed.push(best.label);
  const remove = (label: SkyLabel) => placed.splice(placed.indexOf(label), 1);

  /* Birinci geçiş: herkes ZEMİNDE, öncelik sırasıyla. */
  const waiting: number[] = [];
  for (const i of picks) {
    const best = tryPlace(i, 0, -Infinity, Infinity);
    if (best) commit(best);
    else if (byI.has(i)) waiting.push(i);
  }
  /* İkinci geçiş: zeminde yer bulamayan İKİNCİ KATA. Öncelik başı
     (`LABEL_HEAD`: en büyük üç şirket ve günün iki ucu) kata serbestçe
     çıkıyor; ötekiler sahne yükselmeden: kat, binaların ve zemindeki
     etiketlerin zaten kapladığı yükseklikte kalıyor. Sınırsız katta üçüncü
     uç için şerit 70 birim uzuyordu (gerçek 23 Ekim, 1920 şerit: 277 →
     352); sınır herkese konunca da günün en çok düşeni (TMUS) 1440 şeritte
     düşüyordu. */
  if (LABEL_TIERS > 1 && waiting.length > 0) {
    const top = Math.min(0, ...buildings.map((b) => (b.dir === 1 ? -b.h : 0)), ...placed.map((l) => l.y));
    const bottom = Math.max(0, ...buildings.map((b) => (b.dir === -1 ? b.h : 0)), ...placed.map((l) => l.y + l.h));
    const head = new Set(picks.slice(0, LABEL_HEAD));
    const options = (i: number) =>
      head.has(i) ? candidates(i, LABEL_TIERS - 1, -Infinity, Infinity) : candidates(i, LABEL_TIERS - 1, top, bottom);
    const place = (i: number) => options(i)[0] ?? null;
    for (const i of waiting) {
      const best = place(i);
      if (best) {
        commit(best);
        continue;
      }
      if (!head.has(i)) continue;
      /* ONARIM. Öncelik başı hâlâ yersizse yakınındaki (aynı yöndeki)
         etiketler kaldırılıp yeniden deneniyor: önce bu etiket her yerinde
         ve ardından kaldırılanlar öncelik sırasıyla, ya da önce kaldırılan
         en öncelikli etiket her yerinde ve ardından bu. Kaldırılanlardan
         öncelik başı olan yerini bulamazsa onarım geri alınıyor; başı
         olmayan düşebilir (zaten sıranın sonu). Gerçek 23 Ekim'de 768
         şeritte Apple'ın ekseni Nvidia etiketinin içindeydi: Nvidia sağa
         kayınca ikisi de sığıyor. */
      const b = byI.get(i)!;
      const cx = b.x + b.w / 2;
      const { w } = labelBox(mode.label, stocks[i].symbol, mode, stocks[i].change);
      const reach = w + LABEL_MAX_SHIFT * 2 + LABEL_PAD;
      const blockers = placed
        .filter((p) => p.dir === (b.dir === -1 ? -1 : 1) && p.x < cx + reach && p.x + p.w > cx - reach)
        .sort((p, q) => picks.indexOf(p.i) - picks.indexOf(q.i));
      if (blockers.length === 0) continue;
      for (const blocker of blockers) remove(blocker);
      /* Sırayla yerleştir; öncelik başından biri yersiz kalırsa başarısız. */
      const fill = (rest: readonly SkyLabel[]) => {
        const added: SkyLabel[] = [];
        for (const r of rest) {
          const again = place(r.i);
          if (again) {
            commit(again);
            added.push(again.label);
          } else if (head.has(r.i)) {
            for (const x of added) remove(x);
            return null;
          }
        }
        return added;
      };
      let done = false;
      for (const mine of options(i)) {
        commit(mine);
        if (fill(blockers)) {
          done = true;
          break;
        }
        remove(mine.label);
      }
      if (!done) {
        const [first, ...rest] = blockers;
        outer: for (const lead of options(first.i)) {
          commit(lead);
          for (const mine of options(i)) {
            commit(mine);
            if (fill(rest)) {
              done = true;
              break outer;
            }
            remove(mine.label);
          }
          remove(lead.label);
        }
      }
      if (!done) for (const blocker of blockers) commit({ label: blocker });
    }
  }
  /* Çizim sırası öncelik sırası: okuma ve test aynı. */
  return placed.sort((p, q) => picks.indexOf(p.i) - picks.indexOf(q.i));
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
  const rowK = (set: number[], usable: number) => {
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
  const solve = (usable: number) => {
    let sets: number[][] = [];
    let best = -Infinity;
    let bestSpread = Infinity;
    for (const split of rowSplits(districts.length, mode.rows)) {
      const score = Math.min(...split.map((set) => rowK(set, usable)));
      const kk = Number.isFinite(score) ? Math.max(0, score) : 0;
      const widths = split.map((set) => rowWidth(set, kk));
      const spread = Math.max(...widths) - Math.min(...widths);
      if (score > best + 1e-9 || (Math.abs(score - best) <= 1e-9 && spread < bestSpread)) {
        sets = split;
        best = score;
        bestSpread = spread;
      }
    }
    return { sets, k: Number.isFinite(best) ? Math.max(0, best) : 0 };
  };
  /* KENAR PAYI ETİKET PAYIYLA (`labelSide`): kenardaki binanın etiketi de
     binasının üstünde ortalanabilsin. Pay binaları daraltıyor; şehri
     belirgin daraltıyorsa (`SIDE_KEEP_K`) yarıya, o da olmazsa sıfıra
     iniyor: telefon şeridinde (stripNarrow) mahalle tabanları sırayı zaten
     dolduruyor, tam pay k'yi sıfıra indirip bütün binaları aynı ene
     çekiyordu (gerçek 23 Ekim: Nvidia 8,8 → 1,8 birim). O düzende en
     kenardaki binanın etiketi sığmazsa düşüyor. */
  const base = solve(mode.width - EDGE * 2);
  let side = EDGE;
  let rowSets = base.sets;
  let k = base.k;
  for (const share of SIDE_SHARES) {
    const extra = labelSide(mode) * share;
    if (extra <= 0) break;
    const trial = solve(mode.width - (EDGE + extra) * 2);
    if (trial.k >= base.k * SIDE_KEEP_K && trial.k > 0) {
      side = EDGE + extra;
      rowSets = trial.sets;
      k = trial.k;
      break;
    }
  }
  const usable = mode.width - side * 2;

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
    let x = side + (spare - stretch * Math.max(0, set.length - 1)) / 2;
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
   Değer etiketi (25 Ekim gece, "Silüet: değer" turu)
   -------------------------------------------------------------------------- */

/**
 * ETİKETSİZ BİNANIN DEĞERİ. Sahibi etiket turundan sonra: "Artık diğer
 * çubuklardaki değerler de yazabilir." Şeritte logo karosu yalnız en büyük
 * şirketlerde ve günün uçlarında; öteki binaya gelince (dokununca, klavyeyle
 * seçince) binanın TAM UCUNDA küçük bir değer etiketi beliriyor: sembol ve
 * yüzde, logo yok, kart yok. Yükselende çatının üstünde, düşende dibinin
 * altında, değişmeyende ortasının üstünde; binanın ekseninde ortalı.
 *
 * Etiket önce tek satır ("AMD +%1,74"). Sahnenin kenarından taşıyorsa
 * kenarın içine kayıyor, ama en çok `LABEL_MAX_SHIFT` kadar (çatı
 * etiketleriyle aynı eşik: binanın ekseni her zaman etiketin içinden
 * geçiyor). Tek satır o payla sığmıyorsa iki satıra (sembol üstte, yüzde
 * altta; çatı etiketinin logosuz hâli) dönüyor; kenar payı (`labelSide`)
 * zaten o ene göre ayrılmış. Kaydıysa çatıdan etikete ince bir bağ çizgisi
 * (`leader`) ve etiket çatıdan biraz daha uzakta, bağ görünsün diye.
 *
 * Kutu ölçüsü üstten tahmin: çatı etiketinin `CHAR_EM`i (0,62) burada
 * yetmedi, tek satırda "MPWR −%2,38" 1440 şeritte 82 piksel çıktı (tahmin
 * 75; W geniş harf, araya sembolle yüzde arası giriyor) ve kutu komşu
 * etiketin 1,4 piksel içine düştü. `TAG_EM` 0,7 + hale payı; tarayıcıda
 * ölçüldü, gerçek metin kutuya sığıyor.
 */
export type SkyValueTag = {
  i: number;
  /** Metnin ekseni (birim) — binanın ekseninden en çok `LABEL_MAX_SHIFT` uzak. */
  cx: number;
  /** Kutunun üstü ve ölçüsü, sıranın koordinatında (ufuk y=0). */
  y: number;
  w: number;
  h: number;
  lines: 1 | 2;
  /** Kaydıysa çatıdan (x, y1) etikete (x, y2) dik bağ. */
  leader: { x: number; y1: number; y2: number } | null;
};

/** Değer etiketinin karakter eni ve satır yüksekliği (punto katı), hale payı,
 *  çatıya uzaklığı (birim). */
const TAG_EM = 0.7;
const TAG_LINE = 1.2;
const TAG_HALO = 2;
const TAG_GAP = 4;
/** Kaymış etiketin çatıya uzaklığı: bağ çizgisi görünsün. */
const TAG_LEAD = 9;

export function valueTag(b: SkyBuilding, stock: Pick<SkyStock, "symbol" | "change">, mode: Pick<SkyMode, "width" | "font">): SkyValueTag {
  const unit = mode.font * TAG_EM;
  const axis = b.x + b.w / 2;
  const sym = stock.symbol.length;
  const pct = pctChars(stock.change);
  /* Kenarın içine kalması için gereken kayma (işaretli). */
  const shiftFor = (w: number) => {
    const x = axis - w / 2;
    const lo = EDGE;
    const hi = Math.max(lo, mode.width - EDGE - w);
    return Math.min(Math.max(x, lo), hi) - x;
  };
  let lines: 1 | 2 = 1;
  let w = (sym + 1 + pct) * unit + TAG_HALO;
  let shift = shiftFor(w);
  if (Math.abs(shift) > LABEL_MAX_SHIFT) {
    lines = 2;
    w = Math.max(sym, pct) * unit + TAG_HALO;
    shift = shiftFor(w);
  }
  shift = Math.max(-LABEL_MAX_SHIFT, Math.min(LABEL_MAX_SHIFT, shift));
  const h = mode.font * TAG_LINE * lines;
  const shifted = Math.abs(shift) >= ATTACH_SHIFT;
  const gap = shifted ? TAG_LEAD : TAG_GAP;
  const down = b.dir === -1;
  const tip = down ? b.h : b.dir === 1 ? -b.h : -b.h / 2;
  const y = down ? tip + gap : tip - gap - h;
  return {
    i: b.i,
    cx: axis + shift,
    y,
    w,
    h,
    lines,
    leader: shifted ? { x: axis, y1: tip, y2: down ? y : y + h } : null,
  };
}

/** Değer etiketinin kutusu (kesişme denetimi için). */
export function valueTagBox(tag: SkyValueTag): Box {
  return { x: tag.cx - tag.w / 2, y: tag.y, w: tag.w, h: tag.h };
}

/** Değer etiketinin üstüne düşen çatı etiketleri: etiket görünürken sönüyor. */
export function tagCovers(tag: SkyValueTag, labels: readonly SkyLabel[]): number[] {
  const box = valueTagBox(tag);
  return labels.filter((label) => overlaps(box, label, LABEL_PAD)).map((label) => label.i);
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
