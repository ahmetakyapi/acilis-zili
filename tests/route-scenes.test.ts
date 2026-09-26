import test from "node:test";
import assert from "node:assert/strict";
import { sceneForPath } from "../lib/ink/route-scenes";
import { INK_SCENES } from "../lib/ink/scenes";

/* Yükleme kartının kısa filmi hedef adrese göre seçiliyor. Bu sınamalar
   haritanın sözleşmesini tutuyor: dil öneki fark etmesin, alt yollar üst
   bölümün sahnesini alsın, benzer adla başlayan başka bir yol yanlışlıkla
   eşleşmesin ve bilinmeyen her yer açılış sahnesine düşsün. */

test("each section gets its own short film", () => {
  assert.equal(sceneForPath("/haberler/123"), "press");
  assert.equal(sceneForPath("/mercek"), "lens");
  assert.equal(sceneForPath("/bilancolar/analizler"), "ledger");
  assert.equal(sceneForPath("/bilancolar/NVDA/2026Q2"), "ledger");
  assert.equal(sceneForPath("/teknik/NVDA"), "chart");
  assert.equal(sceneForPath("/giris"), "hello");
  assert.equal(sceneForPath("/kayit"), "hello");
});

test("the locale prefix does not change the scene", () => {
  assert.equal(sceneForPath("/en/mercek/some-story"), "lens");
  assert.equal(sceneForPath("/en/giris"), "hello");
});

test("a prefix only matches a whole path segment", () => {
  assert.equal(sceneForPath("/mercekler"), "intro");
  assert.equal(sceneForPath("/haberlerim"), "intro");
});

test("unknown targets, home and missing hrefs fall back to the opening scene", () => {
  assert.equal(sceneForPath("/"), "intro");
  assert.equal(sceneForPath("/en"), "intro");
  assert.equal(sceneForPath("/boyle-bir-sayfa-yok"), "intro");
  assert.equal(sceneForPath(null), "intro");
});

test("every scene ends and has a drawable box", () => {
  for (const [name, scene] of Object.entries(INK_SCENES)) {
    assert.ok(scene.end > 0 && scene.end <= 6, name);
    assert.ok(scene.box.w > 0 && scene.box.h > 0, name);
  }
});
