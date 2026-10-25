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

/* ------------------------------------------------------ tepedeki cümle */

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
  /** "{sector} portföyde {share}, S&P 500'de {bench}" */
  sector: string;
  /** "{count} pozisyon eşit ağırlıklı {effective} pozisyon kadar dağınık" */
  spread: string;
  /** "tek pozisyon: {symbol}" */
  single: string;
  /** "geçen yılki oynaklık S&P 500'ün {ratio} katı" */
  volatility: string;
  /** Sektör kısmıyla gerisinin arası: "; " */
  join: string;
  /** Dağılım ile oynaklığın arası: ", " */
  joinRisk: string;
};

export type LeadFormat = {
  percent: (value: number) => string;
  measure: (value: number, digits: number) => string;
  sector: (key: string) => string;
  /** Dile göre büyük harf ("i" → "İ" yalnız Türkçede); `capitalize` kullanılmaz. */
  upper: (text: string) => string;
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

/**
 * Ekranın tepesindeki TEK CÜMLE — şablon + veri, uydurma yok.
 *
 * Cümle yalnız ölçüyü söyler: en ağır sektör ve S&P 500'deki payı, kaç
 * pozisyonun kaç eşit pozisyon gibi davrandığı, oynaklığın endekse oranı.
 * Yargı ve öneri kipi YOK ("fazla", "azalt", "çeşitlendir" yazılmaz) —
 * SPK çizgisi (AnalysisScreen.tsx başındaki not; lib/advice-guard.ts aynı
 * kalıpları Claude'un metninde arıyor, testte bu cümle de ondan geçiyor).
 * Oran S&P oynaklığı sıfırsa basılmaz (bölme anlamsız).
 */
export function composeAnalysisLead(facts: LeadFacts, templates: LeadTemplates, format: LeadFormat): string {
  const spread =
    facts.count <= 1
      ? fill(templates.single, { symbol: facts.largest.symbol })
      : fill(templates.spread, { count: facts.count, effective: format.measure(facts.effective, 1) });
  const vol =
    facts.volatility && facts.volatility.benchmark > 0
      ? fill(templates.volatility, { ratio: format.measure(facts.volatility.portfolio / facts.volatility.benchmark, 1) })
      : null;
  const rest = vol ? `${spread}${templates.joinRisk}${vol}` : spread;
  const head = facts.sector
    ? fill(templates.sector, {
        sector: format.sector(facts.sector.key),
        share: format.percent(facts.sector.portfolio),
        bench: format.percent(facts.sector.benchmark),
      })
    : null;
  const sentence = head ? `${head}${templates.join}${rest}` : rest;
  return `${format.upper(sentence.charAt(0))}${sentence.slice(1)}.`;
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
