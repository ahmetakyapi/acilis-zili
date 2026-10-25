import { compareReleased, plainNumber, type Comparison } from "@/lib/release-notes-core";
import { formatPrice, MONEY_GAP } from "@/lib/utils";

/**
 * SAPMA ÇİZGİSİ — "Son Açıklanan Veriler" kartının görseli (25 Ekim).
 *
 * NEDEN: kart üç değeri (Gerçekleşen, Beklenti, Önceki) sıfırdan başlayan
 * üç ince çubukla çiziyordu. İşsizlik başvurusunda 194 bin ile 200 bin
 * sıfırdan bakınca aynı boyda iki çubuk: kartın asıl sorusu olan "beklentiye
 * göre nerede" görünmüyordu. Çizgi artık BEKLENTİYİ SIFIR alıyor: ortası
 * beklenti, nokta gerçekleşen, gri çentik önceki. Ölçek iki yana simetrik
 * (en büyük sapma kadar), yani "sağda = üstünde" her kartta aynı okunuyor.
 *
 * Beklenti yoksa sıfır ÖNCEKİ değer (künye de öyle der). İkisi de yoksa ya
 * da değerler düz sayı değilse ("4.25-4.50" gibi aralık) çizgi yok —
 * birimini bilmediğimiz metni kıyaslamıyoruz (`compareReleased` kuralı).
 *
 * Fark EKRANDAKİ hassasiyetle: takvim değerleri en çok iki haneyle basılıyor
 * ve yön `compareReleased`ten geliyor (rozet ile Claude notu aynı
 * fonksiyonu okuyor). Burada da aynı yuvarlama: "3,46 beklentinin 0,00
 * üstünde" yazılmaz.
 *
 * ORTAK ÖLÇEK (25 Ekim, görsel inceleme). Panel aynı seriyi yan yana iki
 * kartta gösterebiliyor (iki haftanın işsizlik başvurusu). Her kart kendi
 * en büyük sapmasıyla ölçeklenince 6 bin de 1 bin de rayın ucuna yakın
 * duruyordu (1440'ta 365 px'e 183 px; 1 bin, 6 binin yarısı gibi okunuyordu).
 * Aynı serinin kartları artık ortak açıklığı paylaşıyor (`deviationSpans`
 * → `releaseDeviation(..., { span })`): kartlar arasında boy kıyaslanabilir.
 * Farklı seriler kendi ölçeğinde kalır (birimleri farklı).
 *
 * YUVARLAMA ÖLÇEĞİ ondalık sayısından (`10 ** digits`): fark basılan
 * hassasiyetle hesaplanıyor, sabit yüzlük ölçek basılan haneden kopuktu.
 *
 * Düz modül: sayfa (sunucu) ve testler okuyor.
 */

/** Uç payı: nokta ve çentik rayın kenarına yapışmasın (−0,84…0,84). */
export const DEVIATION_REACH = 0.84;

/** Ekranda basılan en çok ondalık — `formatEventValue`ın tavanı. */
const MAX_DIGITS = 2;

export type Deviation = {
  /** Sıfır neyin: beklenti mi, o yoksa önceki değer mi. */
  base: "forecast" | "previous";
  direction: Comparison;
  /** Gerçekleşen − sıfır, ekrandaki hassasiyetle yuvarlanmış. */
  diff: number;
  /** Önceki − beklenti (yalnız sıfır beklentiyse ve önceki biliniyorsa). */
  previousDiff: number | null;
  previousDirection: Comparison | null;
  /** −REACH…REACH; 0 = sıfır (rayın ortası). */
  actualAt: number;
  previousAt: number | null;
  /** Farkın basılacağı ondalık sayısı (ham değerlerin en uzunu, tavan 2). */
  digits: number;
};

function decimals(raw: string | null | undefined): number {
  const trimmed = raw?.trim() ?? "";
  const dot = trimmed.indexOf(".");
  return dot === -1 ? 0 : trimmed.length - dot - 1;
}

/** Ekrandaki hassasiyetle fark: `digits` haneli tam sayılar üzerinden. */
export function roundedDiff(a: number, b: number, digits: number): number {
  const scale = 10 ** digits;
  return (Math.round(a * scale) - Math.round(b * scale)) / scale;
}

function rawDigits(...raws: (string | null | undefined)[]): number {
  return Math.min(MAX_DIGITS, Math.max(...raws.map(decimals)));
}

/** Kartın kendi açıklığı: gerçekleşen ve önceki farkın en büyüğü. */
function ownSpan(diff: number, previousDiff: number | null): number {
  return Math.max(Math.abs(diff), Math.abs(previousDiff ?? 0));
}

export function releaseDeviation(
  actual: string | null | undefined,
  forecast: string | null | undefined,
  previous: string | null | undefined,
  /** Aynı serinin kartlarının ortak açıklığı (`deviationSpans`); kartın
      kendi açıklığından küçükse kendi açıklığı geçer. */
  { span: shared = 0 }: { span?: number } = {},
): Deviation | null {
  const a = plainNumber(actual);
  const f = plainNumber(forecast);
  const p = plainNumber(previous);
  if (a === null) return null;
  const base = f !== null ? "forecast" : p !== null ? "previous" : null;
  if (base === null) return null;
  const baseRaw = base === "forecast" ? forecast : previous;
  const b = (base === "forecast" ? f : p)!;
  const direction = compareReleased(actual, baseRaw);
  if (direction === null) return null;

  const digits = rawDigits(actual, forecast, previous);
  const diff = roundedDiff(a, b, digits);
  const previousDiff = base === "forecast" && p !== null ? roundedDiff(p, b, digits) : null;
  const span = Math.max(ownSpan(diff, previousDiff), shared);
  /* Hepsi aynıysa ölçek yok: nokta ve çentik ortada, sıfırın üstünde. */
  const at = (value: number) => (span === 0 ? 0 : (value / span) * DEVIATION_REACH);

  return {
    base,
    direction,
    diff,
    previousDiff,
    previousDirection: base === "forecast" && p !== null ? compareReleased(actual, previous) : null,
    actualAt: at(diff),
    /* Önceki değerin yeri sıfıra göre (önceki − beklenti). */
    previousAt: previousDiff === null ? null : at(previousDiff),
    digits,
  };
}

/**
 * Olayın SERİ anahtarı: `slug` tekrar başına tarihli ("jobless-claims-
 * 2026-10-22"); sondaki tarih atılınca seri kalır. FRED kimliği anahtar
 * yapılmadı: aynı seriden türeyen iki olay (manşet ve aylık) farklı
 * birimde olabilir.
 */
export function seriesKey(slug: string): string {
  return slug.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

/**
 * Seri başına ortak açıklık: aynı serinin (`seriesKey`) kartlarının en
 * büyük sapması. Çizgisi olmayan (düz sayı değil) kart hesaba girmez.
 */
export function deviationSpans(
  events: readonly {
    slug: string;
    actual: string | null | undefined;
    forecast: string | null | undefined;
    previous: string | null | undefined;
  }[],
): Map<string, number> {
  const spans = new Map<string, number>();
  for (const event of events) {
    const d = releaseDeviation(event.actual, event.forecast, event.previous);
    if (!d) continue;
    const key = seriesKey(event.slug);
    spans.set(key, Math.max(spans.get(key) ?? 0, ownSpan(d.diff, d.previousDiff)));
  }
  return spans;
}

/**
 * Farkın künyedeki yazımı — birimiyle, işaretsiz (yön sözcükte).
 *
 * Yüzde serilerde fark YÜZDE PUAN: %3,1 ile %3,0 arası "%0,1" değil
 * "0,1 puan" (İngilizcede "pp"). "bin" Türkçede "Bin", İngilizcede "K"
 * (`unitLabel` kuralı); "puan" İngilizcede "pts". Tanınmayan birim olduğu
 * gibi geçer. Künye Title Case: "6 Bin", "0,1 Puan".
 */
export function formatDeviation(
  diff: number,
  unit: string | null | undefined,
  digits: number,
  locale: string,
  words: { unitPoint: string; unitThousand: string },
): string {
  const shown = formatPrice(Math.abs(diff), locale, { digits });
  const u = unit?.trim() ?? "";
  /* Birim sayıdan kopmasın: bağlantısız boşluk (`MONEY_GAP`). */
  if (u === "%") return `${shown}${MONEY_GAP}${words.unitPoint}`;
  if (u === "bin") return locale === "tr" ? `${shown}${MONEY_GAP}${words.unitThousand}` : `${shown}${words.unitThousand}`;
  if (u === "puan") return `${shown}${MONEY_GAP}${locale === "tr" ? words.unitPoint : "pts"}`;
  if (!u) return shown;
  return `${shown}${MONEY_GAP}${u}`;
}
