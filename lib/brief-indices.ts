import type { Bar, ChartRange } from "./providers/types";

/**
 * Bülten bağlamının endeks hareketi — İKİ KAPANIŞTAN.
 *
 * SORUN (13 Ekim). Haftalık ve geçmiş tarihli pakette yüzde "dönemin ilk
 * barının AÇILIŞI → son barın kapanışı" diye hesaplanıyordu. Haftanın
 * getirisi o değil: pazartesi açılışı cuma kapanışından boşlukla
 * ayrılabiliyor ve boşluk büyükse işaret bile dönüyor — 27–31 Temmuz haftası
 * "ekside kapandı" diye yazıldı, oysa bir önceki cumaya göre artıdaydı.
 * Piyasanın, basının ve rutinin okuduğu tek tanım kapanıştan kapanışa:
 * dönemin son kapanışı ÷ dönemden önceki son kapanış.
 *
 * Günlükte "önceki" bir önceki işlem günü, haftalıkta bir önceki haftanın
 * son işlem günü — ikisi de aynı kural: `from`dan ÖNCEKİ son bar. Tatil ve
 * hafta sonu kendiliğinden atlanıyor (bar yok).
 *
 * `prev_price` ve `prev_date` yanıtta: rutin hesabı denetleyebilsin, tarihi
 * yazabilsin. Kapanışlardan biri yoksa yüzde null — tahmin edilmez.
 */

export type IndexMove = {
  price: number | null;
  /** `price`ın ait olduğu işlem günü (ET). */
  price_date: string | null;
  prev_price: number | null;
  prev_date: string | null;
  change_pct: number | null;
};

export const EMPTY_MOVE: IndexMove = {
  price: null,
  price_date: null,
  prev_price: null,
  prev_date: null,
  change_pct: null,
};

/** Barın ET günü. Alpaca günlük barı 00:00 ET'de (04:00/05:00 UTC) damgalıyor. */
export function barDay(bar: Bar): string {
  return new Date(bar.time * 1000).toISOString().slice(0, 10);
}

export function pctChange(last: number | null, prev: number | null): number | null {
  if (last === null || prev === null || !prev) return null;
  return (last / prev - 1) * 100;
}

/** [from, to] dönemindeki son kapanış ve dönemden önceki son kapanış. */
export function closeToClose(bars: readonly Bar[], from: string, to: string): IndexMove {
  let last: Bar | null = null;
  let prev: Bar | null = null;
  for (const bar of bars) {
    const day = barDay(bar);
    if (day < from) prev = bar;
    else if (day <= to) last = bar;
  }
  if (!last) return EMPTY_MOVE;
  const price = last.close;
  const prevPrice = prev?.close ?? null;
  return {
    price,
    price_date: barDay(last),
    prev_price: prevPrice,
    prev_date: prev ? barDay(prev) : null,
    change_pct: pctChange(price, prevPrice),
  };
}

/**
 * `from`un bir gün öncesine kadar uzanan en kısa GÜNLÜK bar aralığı.
 * 5Y haftalık bar veriyor (kapanıştan kapanışa günlük hesap bozulur); bir
 * yıldan eski dönem için null — yüzde basılmaz.
 */
export function rangeCovering(from: string, today: string): ChartRange | null {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  /* +10: dönemden önceki son işlem günü uzun bir tatil kümesinin ardında
     kalabilir; alpaca.ts'teki geriye bakış günleri 95 / 190 / 370. */
  const need = days + 10;
  if (need <= 95) return "3M";
  if (need <= 190) return "6M";
  if (need <= 370) return "1Y";
  return null;
}
