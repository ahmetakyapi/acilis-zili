import type { Block } from "@/components/article/parse-blocks";

/**
 * Topluluk akışının SAF hesapları (25 Ekim görsel turu) — kart künyesi,
 * manşetin önizleme bloğu ve başlık bandındaki sayılar. Düz modül ("use
 * client" değil): sayfa (sunucu) okur, test (`tests/community-feed.test.ts`)
 * doğrudan çağırır.
 *
 * KATEGORİ ROZETİ NEDEN ŞABLONDAN DEĞİL: `user_posts`ta şablon sütunu yok
 * (yazı şablonla başlar ama şablon kaydedilmez; lib/schema.ts → userPosts)
 * ve sütun eklemek migration demek. Kartta yazının İÇİNDE ne olduğu
 * gösteriliyor: gövdeden ayrıştırılan ::: blok türleri. Bu bir tahmin değil,
 * yazının kendisinden okunan bir olgu ("bu yazıda çubuk grafik ve zaman
 * çizelgesi var") ve okura "açınca ne göreceğim" sorusunu cevaplıyor.
 */

/** Kartta rozet olarak basılan blok türleri — editördeki ::: adları. */
export type VisualKind =
  | "sayilar"
  | "bar"
  | "pay"
  | "akis"
  | "oncesi"
  | "zaman"
  | "grafik"
  | "ornek"
  | "dikkat"
  | "ozet"
  | "tanim";

/** Veri taşıyan bloklar önce: okura yazının "görsel" yanını ilk o söyler. */
const DATA_KIND: Partial<Record<Block["kind"], VisualKind>> = {
  bars: "bar",
  share: "pay",
  stats: "sayilar",
  timeline: "zaman",
  flow: "akis",
  shift: "oncesi",
  chart: "grafik",
};

/**
 * Yazıdaki görsel blok türleri, ilk geçiş sırasıyla ve tekrarsız; veri
 * blokları metin kutularından (ornek, dikkat, ozet, tanim) önce. `max`
 * kartın taşıyabildiği kadar — fazlası basılmaz, sayısı da uydurulmaz.
 */
export function postVisualKinds(blocks: readonly Block[], max = 3): VisualKind[] {
  const data: VisualKind[] = [];
  const text: VisualKind[] = [];
  for (const block of blocks) {
    const kind = block.kind === "callout" ? block.tone : DATA_KIND[block.kind];
    if (!kind) continue;
    const bucket = block.kind === "callout" ? text : data;
    if (!data.includes(kind) && !text.includes(kind)) bucket.push(kind);
  }
  return [...data, ...text].slice(0, Math.max(0, max));
}

/**
 * Manşet kartında çizilebilen bloklar, ÖNCELİK sırasıyla. Çubuk ve pay bir
 * bakışta okunan şekiller; sayılar ve zaman çizelgesi metne yakın. `grafik`
 * hariç: sağlayıcıya gider, her akış açılışında fiyat çekmek akışı
 * yavaşlatırdı. Adım kipindeki akış da hariç: kaydırdıkça yanan bir blok
 * küçük önizlemede yarım görünür.
 */
const PREVIEW_ORDER: readonly Block["kind"][] = ["bars", "share", "shift", "stats", "timeline", "flow"];

/**
 * Manşetin sağ yarısı: yazının en iyi okunan veri bloğu (önceliğe göre,
 * eşitlikte ilk geçen), yazı sayfasındakiyle aynı çizimden. Sahte bir ekran
 * görüntüsü değil, yazının kendi parçası. Veri bloğu yoksa null — kart tek
 * kolona döner.
 */
export function leadPreviewBlock(blocks: readonly Block[]): Block | null {
  for (const kind of PREVIEW_ORDER) {
    const found = blocks.find((block) => block.kind === kind && !(block.kind === "flow" && block.stepped));
    if (found) return found;
  }
  return null;
}

type FeedPost = { author: { username: string }; symbols: readonly string[]; publishedAt: Date };

export type FeedStats = {
  posts: number;
  authors: number;
  /** En yeni yayın anı; boş akışta null. */
  latest: Date | null;
  /** En az İKİ yazıda geçen semboller, çoktan aza; eşitlikte ilk görülen
   *  önce. Tek yazıda geçen sembol "en çok geçen" değildir: hepsi birer kez
   *  geçiyorsa sıralama yalnız yazı sırasını tekrarlar, liste boş döner. */
  topSymbols: string[];
};

/** "En çok geçen" sayılmak için en az kaç yazıda geçmeli. */
const MIN_MENTIONS = 2;

/** Başlık bandının sayıları — hepsi akışın kendi satırlarından sayılır. */
export function feedStats(posts: readonly FeedPost[], topN = 5): FeedStats {
  const authors = new Set(posts.map((post) => post.author.username)).size;
  let latest: Date | null = null;
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!latest || post.publishedAt > latest) latest = post.publishedAt;
    for (const symbol of new Set(post.symbols)) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  const topSymbols = [...counts.entries()]
    .filter(([, count]) => count >= MIN_MENTIONS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, topN))
    .map(([symbol]) => symbol);
  return { posts: posts.length, authors, latest, topSymbols };
}
