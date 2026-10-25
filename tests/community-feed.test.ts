import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks } from "../components/article/parse-blocks";
import { feedStats, leadPreviewBlock, postVisualKinds } from "../components/community/feed-model";

const BODY = `Giriş paragrafı.

::: ozet Kısacası
Özet satırı.
:::

::: akis adim Zincir
A | bir
B | iki
:::

::: sayilar Rakamlar
%5 | not
:::

::: pay Dağılım
X | 60
Y | 40
:::

::: dikkat Uyarı
Dikkat satırı.
:::

::: sayilar İkinci
%7 | not
:::`;

test("postVisualKinds: veri blokları önce, tekrarsız, sınırlı", () => {
  const blocks = parseBlocks(BODY, "tr");
  assert.deepEqual(postVisualKinds(blocks, 10), ["akis", "sayilar", "pay", "ozet", "dikkat"]);
  assert.deepEqual(postVisualKinds(blocks, 3), ["akis", "sayilar", "pay"]);
  assert.deepEqual(postVisualKinds(blocks, 0), []);
  assert.deepEqual(postVisualKinds(parseBlocks("Yalnız metin, blok yok.", "tr")), []);
});

test("leadPreviewBlock: önceliğe göre seçer, adım kipli akışı atlar", () => {
  const blocks = parseBlocks(BODY, "tr");
  assert.equal(leadPreviewBlock(blocks)?.kind, "share");
  const onlyStepped = parseBlocks("::: akis adim Z\nA | b\nC | d\n:::", "tr");
  assert.equal(leadPreviewBlock(onlyStepped), null);
  const plainFlow = parseBlocks("::: akis Z\nA | b\nC | d\n:::", "tr");
  assert.equal(leadPreviewBlock(plainFlow)?.kind, "flow");
  assert.equal(leadPreviewBlock(parseBlocks("::: grafik NVDA | 6M | Son altı ay\n:::", "tr")), null);
});

const post = (username: string, symbols: string[], iso: string) => ({
  author: { username },
  symbols,
  publishedAt: new Date(iso),
});

test("feedStats: sayılar akıştan, en çok geçen en az iki yazıda", () => {
  const stats = feedStats([
    post("ayse", ["NVDA", "AMD"], "2026-10-20T10:00:00Z"),
    post("mehmet", ["AMD", "INTC", "AMD"], "2026-10-24T10:00:00Z"),
    post("ayse", ["NVDA", "AMD"], "2026-10-22T10:00:00Z"),
    post("can", ["TSLA"], "2026-10-21T10:00:00Z"),
  ]);
  assert.equal(stats.posts, 4);
  assert.equal(stats.authors, 3);
  assert.equal(stats.latest?.toISOString(), "2026-10-24T10:00:00.000Z");
  /* Aynı yazıda iki kez geçen AMD bir sayılır; TSLA ve INTC tek yazıda. */
  assert.deepEqual(stats.topSymbols, ["AMD", "NVDA"]);
  assert.deepEqual(feedStats([post("a", ["X"], "2026-10-01T00:00:00Z")]).topSymbols, []);
});

test("feedStats: boş akış", () => {
  assert.deepEqual(feedStats([]), { posts: 0, authors: 0, latest: null, topSymbols: [] });
});
