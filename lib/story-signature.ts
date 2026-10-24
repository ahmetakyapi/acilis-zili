import type { Block } from "@/components/article/parse-blocks";

/* ==========================================================================
   Mercek yazısının İMZA BLOĞU — saf, React'siz (24 Ekim)

   Arşiv kartlarında görsel yalnız logo şeridiydi: 161 yazının hepsi aynı
   kalıpta, aynı şirketleri anlatan yazılar (MU dört yazıda) birbirinden
   ayırt edilmiyordu. Oysa her yazı kendi görselini taşıyor: gövdedeki
   `:::` blokları (CLAUDE.md → "yazılarda fotoğraf yok"). Kart artık o
   bloklardan birini minyatür olarak çiziyor — yazının kendi verisi, süs değil.

   ÖNCELİK SIRAYLA, GÖVDEDEKİ SIRAYLA DEĞİL: akis > oncesi > bar > sayilar >
   grafik. Gerekçe ayırt ediciliği: canlı arşivde (322 satır, 24 Ekim)
   `sayilar` ve `grafik` HER yazıda var, `bar` 196'sında, `oncesi` 94'ünde,
   `akis` 68'inde. Nadir blok yazıyı en iyi ayıran blok; her yazıda olan
   rakam şeridi ancak başka bir şey yoksa imza. Ana sayfanın Mercek kartı
   (`StoryFigure`) başka bir soruyu cevaplıyor — manşetin GÖVDEDEKİ ilk
   uygun bloğu — ve kendi listesini tutuyor.

   Ayrıştırma `parse-blocks.ts`te; burası yalnız seçim. Seçimin veritabanı
   tarafı (yalnız aday blokların metni çekiliyor) `story-signature-data.ts`.
   Testler: `tests/story-signature.test.ts`.
   ========================================================================== */

export const SIGNATURE_PRIORITY = ["flow", "shift", "bars", "stats", "chart"] as const;
export type SignatureKind = (typeof SIGNATURE_PRIORITY)[number];
export type SignatureBlock = Extract<Block, { kind: SignatureKind }>;

/** Bloğun gövdedeki SÖZDİZİMİ adı — veritabanı süzgeci bunu arıyor. */
export const SIGNATURE_WORD: Record<SignatureKind, string> = {
  flow: "akis",
  shift: "oncesi",
  bars: "bar",
  stats: "sayilar",
  chart: "grafik",
};

/** Minyatürün çizdiği en fazla öğe — kart şeridinin yüksekliği sabit. */
export const SIGNATURE_MAX_ITEMS: Record<Exclude<SignatureKind, "shift" | "chart">, number> = {
  flow: 4,
  bars: 3,
  stats: 2,
};

/** Çizilecek bir şeyi var mı — boş blok imza olamaz. */
function drawable(block: SignatureBlock): boolean {
  switch (block.kind) {
    case "flow":
    case "stats":
      return block.items.length > 0;
    case "bars":
      /* Sıfır ya da sayıya çevrilemeyen değerler çubuk çizmez (0'a iner);
         hepsi öyleyse kulvarlar boş kalırdı. */
      return block.items.some((item) => item.value !== 0);
    case "shift":
    case "chart":
      return true;
  }
}

/**
 * Yazının imza bloğu: öncelik sırasındaki ilk türün GÖVDEDEKİ ilk çizilebilir
 * örneği. Hiçbiri yoksa null — kart bugünkü logo şeridini basar.
 */
export function pickSignature(blocks: readonly Block[]): SignatureBlock | null {
  for (const kind of SIGNATURE_PRIORITY) {
    for (const block of blocks) {
      if (block.kind !== kind) continue;
      const candidate = block as SignatureBlock;
      if (drawable(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Gövdeden yalnız `kind` türündeki `:::` bloklarını yakalayan Postgres
 * düzenli ifadesi (ARE). Kartın imzası için 8 KB'lık gövdenin tamamı değil,
 * aday blokların birkaç yüz baytı çekiliyor.
 *
 * Kalıp ayrıştırıcının kuralını izliyor: blok satır başında (`:::`
 * öncesinde yalnız boşluk), tür sözcüğü büyük-küçük harf duyarsız, gövde
 * `:::` ile başlamayan satırlar, kapanış ilk `:::` satırı. `substring()`
 * yalnız İLK eşleşmeyi döndürüyor; seçim yine `pickSignature`ta, yani
 * kalıp ayrıştırıcıdan farklı bir şey yakalarsa yanlış blok değil en fazla
 * eksik imza çıkar (kart logo şeridine düşer). Arşivin tamamında
 * ayrıştırıcıyla birebir aynı seçimi verdiği ölçüldü (322/322, 24 Ekim).
 */
export function signaturePattern(kind: SignatureKind): string {
  const word = SIGNATURE_WORD[kind];
  return `(?i)(?:^|\\n)[ \\t]*(:::[ \\t]*${word}(?:[ \\t][^\\n]*)?\\n(?:(?![ \\t]*:::)[^\\n]*\\n)*[ \\t]*:::)`;
}

/** Günlük bar sayısıyla aralıklar — bir yıllık seriden kesiliyor. */
const DAILY_BARS: Partial<Record<string, number>> = { "1W": 5, "1M": 22, "3M": 63, "6M": 126 };

/**
 * `grafik` imzasının kapanış serisi — sayfanın zaten çektiği BİR YILLIK
 * günlük barlardan, yazarın seçtiği aralık kadar. Kart için ayrı bir istek
 * atılmıyor; seri o sembol için çekilmemişse ya da aralık bir yıllık
 * günlük seriden kesilemiyorsa (1D gün içi, 5Y) null: minyatür çizilmez,
 * kart logo şeridine düşer. Uydurma ölçekte çizgi yok.
 */
export function chartSignatureSeries(
  bars: readonly { time: number; close: number }[] | undefined,
  range: string,
): number[] | null {
  if (!bars || bars.length < 2) return null;
  let slice: readonly { time: number; close: number }[];
  if (range === "1Y") slice = bars;
  else if (range === "YTD") {
    const year = new Date(bars[bars.length - 1].time * 1000).getUTCFullYear();
    const start = Date.UTC(year, 0, 1) / 1000;
    slice = bars.filter((bar) => bar.time >= start);
  } else {
    const count = DAILY_BARS[range];
    if (!count) return null;
    slice = bars.slice(-count);
  }
  return slice.length > 1 ? slice.map((bar) => bar.close) : null;
}

/**
 * Yazının kartta çizilecek bloğu: ilk `::: sayilar`, yoksa ilk `::: bar`.
 * Rakam şeridi yazının kendi seçtiği "en çarpıcı sayılar" — paylaşılan
 * görselde başlığın yanında durunca kart bir haber manşeti değil bir
 * okuma gibi görünüyor. Çizilecek bir şeyi yoksa null: kart başlık + spot.
 */
export function storyOgFigure(blocks: readonly Block[]) {
  const stats = blocks.find(
    (block): block is Extract<Block, { kind: "stats" }> => block.kind === "stats" && block.items.length > 0,
  );
  if (stats) return stats;
  const bars = blocks.find(
    (block): block is Extract<Block, { kind: "bars" }> =>
      block.kind === "bars" && block.items.some((item) => item.value !== 0),
  );
  return bars ?? null;
}

