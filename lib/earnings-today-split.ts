import { earningsStatus } from "./day-flow";
import { isSpotlight } from "./spotlight";

/**
 * Bugünün Akışı ile "Bugün Bilanço Açıklayanlar" panelinin bilanço bölüşümü
 * (11 Kasım, sahibinin kararı: "bilanço tekrarını mantıklı şekilde kırp").
 *
 * SORUN. Akış (`lib/day-flow-data.ts`) bugünün öne çıkan bilançolarını
 * saatiyle ve beklentisiyle gösteriyor; panel aynı günün takvimini piyasa
 * değerine göre sıralayıp ilk beşini basıyordu — yani tam da akışa giren
 * büyük şirketleri. 390'da aynı şirketler 811. ve 5.735. pikselde ikinci kez
 * okunuyordu (sahte sağlayıcı, gerçekçi piyasa değerleri: panelin beş
 * satırının üçü — CSCO, TDG, CRWV — akışta da vardı). Aynı gerekçeyle
 * "Bugünün Takvimi" paneli önceki turda kalktı (`app/(app)/page.tsx`,
 * haftaya bakışın üstündeki not).
 *
 * BÖLÜŞÜM. Akış ZAMANLI olay şeridi olarak kalır. Panel:
 *  - akışta OLMAYAN şirketleri (eşiğin altındaki günün geri kalanı) ve
 *  - akışta olsa da SONUCU GELMİŞ satırları (açıklanan HBK/gelir ya da
 *    yazılmış analiz) gösterir; sonucu gelenler öne çıkar. Akış sonucu
 *    yalnız açılan satırın gövdesinde, logoda yön okuyla veriyor; panel
 *    aynı bilançonun karnesini (iki ölçü, sapma, analiz rozeti) bir bakışta
 *    okutuyor — tekrar değil, sonucun kendisi.
 * Akışta duran ve sonucu henüz gelmemiş satır panelde tekrar edilmez;
 * panelin künyesi onları adıyla akışa bağlar.
 *
 * Akışa girme kuralı TEK YERDE: `inDayFlow`. `loadDayFlow` aynı fonksiyonu
 * çağırır; eşik değişirse ikisi birlikte değişir.
 */

/** Akışa piyasa değeriyle girme eşiği (USD). Gerekçe `loadDayFlow` →
    "GİZLENENLER SAYILIYOR"; adla seçilenler `lib/spotlight.ts`. */
export const DAY_FLOW_EARNINGS_MIN_CAP = 50e9;

export type FlowEarningsTraits = {
  symbol: string;
  /** O gün için yazılmış bilanço analizi var mı (dilden bağımsız). */
  analyzed: boolean;
  /** Oturumlu okurun takip listesinde mi. */
  watched: boolean;
  marketCap: number | null | undefined;
};

/** Bu bilanço Bugünün Akışı'nda gösteriliyor mu — `loadDayFlow` ile aynı kural. */
export function inDayFlow(row: FlowEarningsTraits): boolean {
  return row.analyzed || row.watched || isSpotlight(row.symbol) || (row.marketCap ?? 0) >= DAY_FLOW_EARNINGS_MIN_CAP;
}

type SplitRow = { symbol: string; epsActual: number | null; revenueActual: number | null };

export type EarningsSplitContext = {
  /** Panelin günü akışın günüyle aynı mı. Hafta sonu panel sıradaki işlem
      gününü, akış ise boş bugünü (ve önizlemesini) gösterir: o zaman
      süzülecek tekrar yoktur. */
  sameDay: boolean;
  analyzed: ReadonlySet<string>;
  watched: ReadonlySet<string>;
  marketCap: (symbol: string) => number | null | undefined;
};

export type EarningsSplit<R> = {
  /** Panelde basılacak satırlar: sonucu gelen önce, sonra piyasa değeri. */
  panel: R[];
  /** Akışta duran, sonucu bekleyen satırlar (piyasa değerine göre) — panel
      bunları basmaz, künyede adıyla akışa bağlar. */
  inFlow: R[];
};

/** Satırın sonucu geldi mi: açıklanan HBK ya da gelir, ya da yazılmış analiz. */
export function hasReported(row: SplitRow, analyzed: boolean): boolean {
  return earningsStatus(row.epsActual, row.revenueActual, analyzed) !== "scheduled";
}

export function splitEarningsToday<R extends SplitRow>(rows: readonly R[], ctx: EarningsSplitContext): EarningsSplit<R> {
  const cap = (row: R) => ctx.marketCap(row.symbol) ?? 0;
  const reported = (row: R) => hasReported(row, ctx.analyzed.has(row.symbol));
  const panel: R[] = [];
  const inFlow: R[] = [];
  for (const row of rows) {
    const flow = ctx.sameDay && inDayFlow({
      symbol: row.symbol,
      analyzed: ctx.analyzed.has(row.symbol),
      watched: ctx.watched.has(row.symbol),
      marketCap: ctx.marketCap(row.symbol),
    });
    (flow && !reported(row) ? inFlow : panel).push(row);
  }
  panel.sort((a, b) => Number(reported(b)) - Number(reported(a)) || cap(b) - cap(a));
  inFlow.sort((a, b) => cap(b) - cap(a));
  return { panel, inFlow };
}
