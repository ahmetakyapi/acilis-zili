/**
 * Portföy analizinin GÖRSEL KATMANININ saf hesapları (25 Ekim, öğrenme ve
 * hesap araçlarının görsel turu). Düz modül — `"use client"` DEĞİL: sunucu
 * ekranı da, istemcideki ısı matrisi de, testler de aynı fonksiyonları okur
 * (`tests/portfolio-analysis-visuals.test.ts`).
 *
 * Hiçbiri yeni bir ölçü üretmiyor: ekrandaki sayıların aynısını uzunluğa,
 * konuma ve yoğunluğa çeviriyor. Sayı ve çizim aynı kaynaktan (CLAUDE.md
 * veri dürüstlüğü 3).
 */

/* ------------------------------------------------------- ağırlık şeridi */

/** Şeritte adıyla duran en fazla kaç pozisyon; kalanı "Diğer" diliminde. */
export const STRIP_MAX = 7;

export type StripSegment = { key: string; symbol: string | null; weight: number };

/**
 * Pozisyonların yüzde yüzlük şeridi. Satırlar ağırlık sırasında gelir
 * (`analyzePortfolio`); ilk `STRIP_MAX - 1` pozisyon adıyla, kalanlar tek
 * "Diğer" diliminde toplanır — on beş pozisyonlu bir portföyde 2 piksellik
 * dilimler okunmuyor. Tam `STRIP_MAX` pozisyon varsa hepsi adıyla durur
 * (tek kişilik bir "Diğer" dilimi bilgi taşımaz). `symbol: null` = Diğer.
 */
export function weightStrip(rows: readonly { symbol: string; weight: number }[]): StripSegment[] {
  if (rows.length <= STRIP_MAX) return rows.map((row) => ({ key: row.symbol, symbol: row.symbol, weight: row.weight }));
  const named = rows.slice(0, STRIP_MAX - 1).map((row) => ({ key: row.symbol, symbol: row.symbol, weight: row.weight }));
  const rest = rows.slice(STRIP_MAX - 1).reduce((total, row) => total + row.weight, 0);
  return [...named, { key: "__rest", symbol: null, weight: rest }];
}

/* ------------------------------------------------------ ölçek yardımcısı */

/** Ölçeğin, iki değerin büyüğünden bir tık fazlası: uç çubuğa yapışmasın. */
export const SCALE_HEADROOM = 1.15;

/**
 * Aynı ölçekte iki büyüklük (portföy ve S&P 500): her biri ölçeğin oranı.
 * İşaret yok sayılır (düşüş derinliği eksi gelir; uzunluk mutlak değerdir,
 * yön rengi ekranda işaretten verilir). En az değer `floor`: beta gibi
 * 1 çevresindeki ölçüde ölçek hiçbir zaman 1'in altına inmesin.
 */
export function pairScale(a: number, b: number, floor = 0): { a: number; b: number; max: number } {
  const max = Math.max(floor, Math.abs(a), Math.abs(b)) * SCALE_HEADROOM;
  if (!(max > 0)) return { a: 0, b: 0, max: 0 };
  return { a: clamp01(Math.abs(a) / max), b: clamp01(Math.abs(b) / max), max };
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/* --------------------------------------------------------- ısı matrisi */

/**
 * Korelasyonun hücre yoğunluğu (0-1): mutlak değer, tek ton (markanın
 * yumuşak mavisi). −0,6 ile +0,6 aynı koyulukta, eksi ayrı bir işaretle
 * (kesikli kenar) ayrılıyor — ikinci bir renk tonu "iyi/kötü" diye
 * okunurdu, korelasyon bir yargı değil. Yoğunluğun TAVANI temaya göre
 * CSS'te (`--heat-cap`, Analysis.module.css; yazı kontrastı orada
 * hesaplı). Taban %8: sıfıra yakın hücre zeminle kaybolmasın.
 */
export const HEAT_MIN = 0.08;
export const HEAT_MAX = 1;
export function heatOf(value: number): number {
  return HEAT_MIN + (HEAT_MAX - HEAT_MIN) * clamp01(Math.abs(value));
}

/* ------------------------------------------------- tepedeki kısa okumalar */

export type LeadFacts = {
  count: number;
  effective: number;
  largest: { symbol: string; weight: number };
  /** En ağır sektör: portföy payı en büyük olan (eşitlikte S&P farkı büyük olan). */
  sector: { key: string; portfolio: number; benchmark: number } | null;
  /** Yıllık oynaklık, portföy ve S&P 500 (risk ölçüsü yoksa null). */
  volatility: { portfolio: number; benchmark: number } | null;
};

export type LeadTemplates = {
  /** "{sector}: portföyde {share}, S&P 500'de {bench}." */
  sector: string;
  /** "{count} pozisyon, eşit ağırlıklı {effective} pozisyon gibi dağılıyor." */
  spread: string;
  /** "Portföy tek pozisyon: {symbol}." */
  single: string;
  /** "Oynaklık S&P 500'ün {ratio} katı." */
  volatility: string;
};

export type LeadFormat = {
  percent: (value: number) => string;
  measure: (value: number, digits: number) => string;
  sector: (key: string) => string;
};

/** Okumanın bir parçası: `strong` = şablona giren sayı ya da ad (kalın basılır). */
export type LeadPart = { text: string; strong: boolean };
export type LeadFact = { key: "sector" | "spread" | "volatility"; parts: LeadPart[] };

const PLACEHOLDER = /^\{([a-z]+)\}$/i;

/** Şablonu parçalara böler: yer tutucuların değeri `strong`, aradaki metin düz. */
export function fillParts(template: string, values: Record<string, string | number>): LeadPart[] {
  return template
    .split(/(\{[a-z]+\})/i)
    .filter((piece) => piece !== "")
    .map((piece) => {
      const key = PLACEHOLDER.exec(piece)?.[1];
      return key !== undefined && key in values ? { text: String(values[key]), strong: true } : { text: piece, strong: false };
    });
}

/** Okumanın düz metni (ekran okuyucu ve test). */
export const leadText = (fact: LeadFact) => fact.parts.map((part) => part.text).join("");

/**
 * Ekranın tepesindeki KISA OKUMALAR — şablon + veri, uydurma yok.
 *
 * 31 EKİM (sahibinin isteği: tepedeki özet okunmuyordu). Bandın altında
 * noktalı virgülle bağlanmış tek uzun kalın cümle vardı (1440'ta iki
 * satır, 160 karakter), altında küçük gri hesap künyesi. Şimdi en fazla
 * üç kısa cümle, her biri kendi ikonuyla ve sayısı kalın: en ağır sektör
 * ve S&P 500'deki payı, kaç pozisyonun kaç eşit pozisyon gibi davrandığı,
 * oynaklığın endekse oranı. Künye "Nasıl Hesaplanır" katında.
 *
 * Yalnız ölçüyü söyler. Yargı ve öneri kipi YOK ("fazla", "azalt",
 * "çeşitlendir" yazılmaz) — SPK çizgisi (AnalysisScreen.tsx başındaki
 * not; lib/advice-guard.ts aynı kalıpları Claude'un metninde arıyor,
 * testte bu cümleler de ondan geçiyor). Oran S&P oynaklığı sıfırsa
 * basılmaz (bölme anlamsız); ölçüsü olmayan cümle düşer.
 */
export function composeAnalysisFacts(facts: LeadFacts, templates: LeadTemplates, format: LeadFormat): LeadFact[] {
  const out: LeadFact[] = [];
  if (facts.sector) {
    out.push({
      key: "sector",
      parts: fillParts(templates.sector, {
        sector: format.sector(facts.sector.key),
        share: format.percent(facts.sector.portfolio),
        bench: format.percent(facts.sector.benchmark),
      }),
    });
  }
  out.push({
    key: "spread",
    parts:
      facts.count <= 1
        ? fillParts(templates.single, { symbol: facts.largest.symbol })
        : fillParts(templates.spread, { count: facts.count, effective: format.measure(facts.effective, 1) }),
  });
  const ratio = facts.volatility ? ratioTo(facts.volatility.portfolio, facts.volatility.benchmark) : null;
  if (ratio !== null) out.push({ key: "volatility", parts: fillParts(templates.volatility, { ratio: format.measure(ratio, 1) }) });
  return out;
}

/* ------------------------------------------------ etkin pozisyon kutuları */

/** Kutu dizisinin tavanı: daha çok pozisyonda kutu 6 pikselin altına iniyor (390'da kart 155 piksel). */
export const PIP_MAX = 20;

/**
 * Etkin pozisyon sayısının KUTU DİZİSİ (31 Ekim). Eski halka "etkin /
 * toplam" oranını çiziyordu; yoğun portföyde (5 pozisyon, 2,7 etkin) ince
 * bir yay kalıyor, kart boş görünüyordu. Şimdi her pozisyon bir kutu,
 * etkin sayı kadarı dolu, kesirli kısım son kutuda kısmi dolgu: "5 kutunun
 * 2,7'si dolu" okumadan görülüyor. Değerler 0-1 arası dolgu; pozisyon
 * sayısı `PIP_MAX`'ı aşarsa null (ekran tek kulvara düşer).
 */
export function effectivePips(count: number, effective: number): number[] | null {
  if (!(count > 0) || count > PIP_MAX) return null;
  const filled = Math.min(count, Math.max(0, effective));
  return Array.from({ length: count }, (_, index) => clamp01(filled - index));
}


/** En ağır sektör: portföy payı en büyük olan; satır yoksa null. */
export function heaviestSector(
  rows: readonly { sector: string; portfolio: number; benchmark: number; diff: number }[],
): LeadFacts["sector"] {
  const held = rows.filter((row) => row.portfolio > 0);
  if (held.length === 0) return null;
  const top = [...held].sort((a, b) => b.portfolio - a.portfolio || b.diff - a.diff)[0]!;
  return { key: top.sector, portfolio: top.portfolio, benchmark: top.benchmark };
}

/* ------------------------------------------------ kart panosu (25 Ekim) */

export type SectorShare = { sector: string; portfolio: number; benchmark: number; diff: number };

/**
 * Sektör kartının iki bölümü. Eski panel on bir sektörü tam genişlik
 * satır olarak basıyordu; tek sektörde yoğunlaşmış portföyde (canlıda
 * %97,5 Bilgi Teknolojileri) on satır "%0,0" idi. Artık:
 *
 *   `held`   portföyde payı olan sektörler, portföy payı sırasıyla (eşitse
 *            S&P 500 payı büyük olan önde) — her biri satır, kulvar ve çentik;
 *   `absent` portföyde HİÇ olmayan ama S&P 500'de payı olan sektörler,
 *            endeksteki payı sırasıyla — kompakt ızgarada yalnız çentik.
 *
 * İkisi aynı ölçeği paylaşır (`scale`, iki tarafın en büyük değeri): yokta
 * duran sektörün çentiği, satırdakilerle doğrudan karşılaştırılır. Hiçbir
 * satır düşmüyor; yalnız biçimi değişiyor (portföyde payı sıfır olan
 * sektörün bilgisi S&P 500 payından ibaret).
 */
export function sectorBoard(rows: readonly SectorShare[]): { held: SectorShare[]; absent: SectorShare[]; scale: number } {
  const held = rows
    .filter((row) => row.portfolio > 0)
    .sort((a, b) => b.portfolio - a.portfolio || b.benchmark - a.benchmark);
  const absent = rows
    .filter((row) => row.portfolio <= 0 && row.benchmark > 0)
    .sort((a, b) => b.benchmark - a.benchmark);
  const scale = Math.max(1, ...held.flatMap((row) => [row.portfolio, row.benchmark]), ...absent.map((row) => row.benchmark));
  return { held, absent, scale };
}

/**
 * Portföy ölçüsünün S&P 500'e oranı ("6,7 Kat"). Tepedeki cümle ve
 * oynaklık kartı AYNI fonksiyonu okur (veri dürüstlüğü 3). Endeksin değeri
 * sıfır ya da eksiyse oran anlamsız: null, ekranda basılmaz.
 */
export function ratioTo(portfolio: number, benchmark: number): number | null {
  if (!(benchmark > 0) || !Number.isFinite(portfolio)) return null;
  return portfolio / benchmark;
}
