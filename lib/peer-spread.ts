import { SCORECARD_MIN_PEERS, percentileOf, type ScoreSubject } from "@/lib/scorecard";
import { bandFiyatiKapsiyorMu } from "@/lib/utils";

/**
 * Temel Göstergeler'in SEKTÖR KULVARI (25 Ekim, görsel zirve turu).
 *
 * Kartta dokuz değer yalın rakam duruyordu: "F/K 39,85" yüksek mi düşük mü,
 * okuyucunun aklındaki bir ölçüye kalıyordu. Kulvar o ölçüyü veriyor: aynı
 * GICS sektöründeki şirketlerin dağılımı, medyanı (çentik) ve şirketin
 * kendisi (nokta). Kaynak Hisse Skor Kartı'nın tablosu (`symbol_metrics`,
 * lib/symbol-metrics.ts) — iki panel aynı evrene ve aynı yönteme bakıyor.
 *
 * YALNIZ KAYNAKTA OLAN ÖLÇÜDE. Tablo F/K'nin parçalarını (EPS, canlı fiyat),
 * net kâr marjını ve borç/özsermayeyi taşıyor; ileri F/K, PD/DD, temettü,
 * beta ve hacim için sektör verisi YOK ve kulvar uydurulmuyor. Hisse başına
 * kâr ise kaynakta olsa da kulvar almıyor: iki şirketin EPS'i karşılaştırılabilir
 * bir büyüklük değil (hisse sayısı kadar keyfi — CompareScale'deki fiyat
 * satırı gerekçesi).
 *
 * YARGI YOK. Yüksek F/K "pahalı = kötü", düşük borç "iyi" diye boyanmıyor;
 * nokta da çentik de nötr. Etiket yalnız konumu söylüyor ("Sektörün %72'sinden
 * yüksek"), hangisinin iyi olduğunu değil (lib/scorecard.ts başlığı).
 */

export const PEER_METRICS = ["pe", "netMargin", "debtToEquity"] as const;
export type PeerMetric = (typeof PEER_METRICS)[number];

/**
 * Kulvarın iki ucu sektörün %5 ve %95 dilimi. En uçtaki bir iki şirket
 * (F/K'si 400 olan yeni kâra geçmiş biri) ölçeği kendi tarafına çekip
 * geri kalan herkesi bir uca sıkıştırıyordu. Uçların dışına düşen şirket
 * ucun üstünde durur ve `clipped` taşır; ekran onu açık noktayla çizer.
 */
export const SPREAD_TAIL = 0.05;

/** Bir şirketin ölçüsü — tablo satırından ve CANLI fiyattan. */
export function peerValue(subject: ScoreSubject, metric: PeerMetric): number | null {
  const m = subject.metrics;
  switch (metric) {
    case "pe": {
      /* Skor kartının kâr getirisiyle aynı koşullar (lib/scorecard.ts →
         metricValue): dolar cinsinden rapor, canlı fiyat ve hisse sınıfı
         tutarlılığı. Zarardaki şirketin F/K'si tanımsız: kulvardan çıkıyor
         (kartta da "—" yazıyor, `peRatioOf`). */
      if (subject.currency !== "USD" || subject.price === null || !(subject.price > 0)) return null;
      if (!bandFiyatiKapsiyorMu(subject.price, m.low52, m.high52)) return null;
      return m.epsTTM !== null && m.epsTTM > 0 ? subject.price / m.epsTTM : null;
    }
    case "netMargin":
      return m.netProfitMarginTTM;
    case "debtToEquity":
      /* Eksi özsermaye oranı anlamsızlaştırıyor (lib/screening.ts → debt). */
      return m.debtToEquity !== null && m.debtToEquity >= 0 ? m.debtToEquity : null;
  }
}

export type PeerSpread = {
  /** Şirketin değeri (kartta yazan sayının kendisi). */
  value: number;
  median: number;
  /** Kulvarın uçları (sektörün %5 ve %95 dilimi). */
  lo: number;
  hi: number;
  /** 0–100: değerin ve medyanın kulvardaki yeri. */
  at: number;
  medianAt: number;
  /** Şirketin altında kalan komşuların yüzdesi (eşitlik yarım), 0–100. */
  below: number;
  /** Karşılaştırılan komşu sayısı (şirket hariç). */
  peers: number;
  /** Değer uçların dışında mı: -1 altında, 1 üstünde. */
  clipped: -1 | 0 | 1;
};

/** Sıralı dizinin `q` dilimi (doğrusal ara değer). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base]! : sorted[base]! + rest * (next - sorted[base]!);
}

/**
 * Değerin komşular arasındaki yeri. Skor kartıyla aynı eşik: sekizden az
 * komşuyla dağılım bir şey söylemiyor, kulvar çizilmiyor (null).
 */
export function peerSpread(value: number, peers: readonly number[], minPeers = SCORECARD_MIN_PEERS): PeerSpread | null {
  const sorted = peers.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!Number.isFinite(value) || sorted.length < minPeers) return null;
  const lo = quantile(sorted, SPREAD_TAIL);
  const hi = quantile(sorted, 1 - SPREAD_TAIL);
  if (!(hi > lo)) return null;
  const place = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const median = quantile(sorted, 0.5);
  return {
    value,
    median,
    lo,
    hi,
    at: place(value),
    medianAt: place(median),
    below: percentileOf(value, sorted, "higher"),
    peers: sorted.length,
    clipped: value < lo ? -1 : value > hi ? 1 : 0,
  };
}

/**
 * EMSAL PİYASA DEĞERİ, LOGARİTMİK (25 Ekim son düzeltme). "Aynı Sektörden
 * Şirketler" çubukları doğrusal ölçekteydi: AAPL 5,07 T $ iken 290 Mr $'lık
 * DELL çubuğun %6'sı, 21,6 Mr $'lık SMCI bir nokta kadardı; listenin
 * sekizi aynı boyda (yok) okunuyordu. Log ölçekte her adım on kat: taban
 * en küçük değerin ALTINDAKİ onluk (10ⁿ, en küçük değer tam onluksa bir
 * alttaki, çubuğu sıfır kalmasın), tavan en büyük değer. Künyede yazılı.
 * Sıralı liste zaten büyüklüğe göre; log çubuk sıradaki ARALIĞI okutuyor.
 */
export function logScale(values: readonly number[]): { floor: number; ratio: (value: number) => number } | null {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0);
  if (positive.length === 0) return null;
  const min = Math.min(...positive);
  const max = Math.max(...positive);
  const floor = 10 ** (Math.ceil(Math.log10(min)) - 1);
  const span = Math.log10(max) - Math.log10(floor);
  return {
    floor,
    ratio: (value) => (!(value > 0) ? 0 : Math.min(1, Math.max(0, (Math.log10(value) - Math.log10(floor)) / span))),
  };
}
