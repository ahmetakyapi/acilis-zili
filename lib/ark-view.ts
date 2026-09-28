/**
 * ARK'ın günlük işlemleri — iki pozisyon dosyasının farkı (28 Eylül).
 *
 * SAF MODÜL: veritabanı ve ağ yok, testler doğrudan çağırıyor.
 *
 * PAY YARATMA/İADE AYIKLANIYOR. ETF'ye para girdiğinde (ya da çıktığında)
 * fon bütün hisselerini aynı oranda büyütüp küçültüyor. Ham farka bakılsa
 * o gün "ARK her şeyi aldı" okunurdu. Her fon için ortak pozisyonların adet
 * oranlarının MEDYANI fonun o günkü akış çarpanı sayılıyor: işlem yapılmayan
 * pozisyonlar tam bu çarpanla değişiyor, işlem yapılan azınlık ondan
 * sapıyor. İşlem = bugünkü adet − dünkü adet × çarpan. Akış yoksa çarpan
 * zaten 1.
 *
 * GÜRÜLTÜ EŞİĞİ: pozisyonun binde ikisinden küçük sapma yuvarlamadır, işlem
 * değil. Yeni giren ve tamamen çıkan pozisyon her zaman işlemdir.
 *
 * SEMBOLSÜZ SATIR YOK SAYILIYOR: nakit fonu, varant ve sahte CUSIP'ler
 * ("BREADUMMY"). Nakit yönetimi bir yatırım kararı değil; sembolü olmayan
 * satır ne logoya ne hisse sayfasına bağlanabiliyor.
 */

export type ArkHolding = {
  fund: string;
  cusip: string;
  ticker: string | null;
  company: string;
  shares: number;
  marketValue: number;
};

export type ArkTrade = {
  cusip: string;
  ticker: string;
  company: string;
  direction: "buy" | "sell";
  /** Adet, işaretsiz, bütün fonların toplamı. */
  shares: number;
  /** Dolar, dosyadaki fiyattan (piyasa değeri ÷ adet) yaklaşık. */
  value: number;
  /** İşlemin geçtiği fonlar, büyükten küçüğe. */
  funds: string[];
  /** Fonlardan birinde pozisyon yeni açıldı ya da tamamen kapandı. */
  opened: boolean;
  closed: boolean;
};

export type ArkDay = {
  /** Karşılaştırılan iki dosyanın tarihleri. */
  from: string;
  to: string;
  trades: ArkTrade[];
  buys: number;
  sells: number;
};

/** Pozisyonun bu oranından küçük sapma işlem sayılmıyor. */
export const ARK_NOISE_SHARE = 0.002;
/** Akış çarpanı için gereken en az ortak pozisyon; azsa çarpan 1. */
const MIN_COMMON = 5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function price(row: ArkHolding): number {
  return row.shares > 0 ? row.marketValue / row.shares : 0;
}

/** Bir fonun akış çarpanı: ortak pozisyonların adet oranlarının medyanı. */
export function flowFactor(prev: readonly ArkHolding[], curr: readonly ArkHolding[]): number {
  const before = new Map(prev.map((row) => [row.cusip, row.shares]));
  const ratios: number[] = [];
  for (const row of curr) {
    const was = before.get(row.cusip);
    if (was && was > 0 && row.shares > 0) ratios.push(row.shares / was);
  }
  return ratios.length >= MIN_COMMON ? median(ratios) : 1;
}

type FundTrade = { fund: string; shares: number; value: number; opened: boolean; closed: boolean; row: ArkHolding };

/** Tek fonun işlemleri; işaretli adet (+ alış, − satış). */
export function fundTrades(prev: readonly ArkHolding[], curr: readonly ArkHolding[]): FundTrade[] {
  const traded = (row: ArkHolding) => row.ticker !== null;
  const before = prev.filter(traded);
  const after = curr.filter(traded);
  const factor = flowFactor(before, after);
  const beforeBy = new Map(before.map((row) => [row.cusip, row]));
  const afterBy = new Map(after.map((row) => [row.cusip, row]));
  const out: FundTrade[] = [];

  for (const row of after) {
    const was = beforeBy.get(row.cusip);
    if (!was) {
      out.push({ fund: row.fund, shares: row.shares, value: row.marketValue, opened: true, closed: false, row });
      continue;
    }
    const delta = row.shares - was.shares * factor;
    if (Math.abs(delta) <= Math.max(1, was.shares * factor * ARK_NOISE_SHARE)) continue;
    out.push({ fund: row.fund, shares: delta, value: Math.abs(delta) * price(row), opened: false, closed: false, row });
  }
  for (const was of before) {
    if (afterBy.has(was.cusip)) continue;
    out.push({ fund: was.fund, shares: -was.shares, value: was.marketValue, opened: false, closed: true, row: was });
  }
  return out;
}

/**
 * İki günün bütün fonları → şirket başına tek satır. Aynı gün bir fonda
 * alınıp ötekinde satılan hisse NET yönüyle yazılıyor; net sıfırsa
 * (fonlar arası aktarım) satır düşüyor.
 */
export function arkDay(
  from: string,
  to: string,
  prev: readonly ArkHolding[],
  curr: readonly ArkHolding[],
): ArkDay {
  const funds = new Set([...prev, ...curr].map((row) => row.fund));
  const byCusip = new Map<string, FundTrade[]>();
  for (const fund of funds) {
    const trades = fundTrades(
      prev.filter((row) => row.fund === fund),
      curr.filter((row) => row.fund === fund),
    );
    for (const trade of trades) {
      const list = byCusip.get(trade.row.cusip) ?? [];
      list.push(trade);
      byCusip.set(trade.row.cusip, list);
    }
  }

  const trades: ArkTrade[] = [];
  for (const [cusip, list] of byCusip) {
    const net = list.reduce((sum, trade) => sum + trade.shares, 0);
    if (Math.abs(net) < 1) continue;
    const direction = net > 0 ? "buy" : "sell";
    const same = list.filter((trade) => Math.sign(trade.shares) === Math.sign(net));
    const unit = same.reduce((sum, trade) => sum + trade.value, 0) / same.reduce((sum, trade) => sum + Math.abs(trade.shares), 0);
    const head = same[0].row;
    trades.push({
      cusip,
      ticker: head.ticker ?? cusip,
      company: head.company,
      direction,
      shares: Math.abs(net),
      value: Math.abs(net) * (Number.isFinite(unit) ? unit : 0),
      funds: [...same].sort((a, b) => b.value - a.value).map((trade) => trade.fund),
      opened: same.some((trade) => trade.opened),
      closed: same.some((trade) => trade.closed),
    });
  }
  trades.sort((a, b) => b.value - a.value);
  return {
    from,
    to,
    trades,
    buys: trades.filter((trade) => trade.direction === "buy").length,
    sells: trades.filter((trade) => trade.direction === "sell").length,
  };
}
