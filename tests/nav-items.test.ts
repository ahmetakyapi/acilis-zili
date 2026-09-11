import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, isActive } from "../components/layout/nav-items";

/* Masthead'in iki listesi (şerit ve "Daha Fazla") ile mobil alt çubuk aynı
   diziden okunuyor. Bu sınamalar modelin sözleşmesini tutuyor: bir öğe iki
   yerde birden görünmesin, taşma sırası belirsiz kalmasın, panel satırı
   ipucusuz çizilmesin. */

const strip = NAV_ITEMS.filter((item) => item.strip);
const more = NAV_ITEMS.filter((item) => item.more);

test("strip ranks are exactly 1..7, each used once", () => {
  const ranks = strip.map((item) => item.strip!.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7]);
});

test("strip and more never share a destination", () => {
  const stripHrefs = new Set(strip.map((item) => item.href));
  for (const item of more) assert.equal(stripHrefs.has(item.href), false, item.href);
});

test("every strip and more item carries a hint for the panel row", () => {
  for (const item of [...strip, ...more]) assert.ok(item.hint, item.href);
});

test("bottom bar stays Markets, Earnings, Close-Up, Menu", () => {
  assert.deepEqual(
    NAV_ITEMS.filter((item) => item.inBottomBar).map((item) => item.href),
    ["/piyasalar", "/bilancolar", "/mercek", "/menu"],
  );
});

test("home and the mobile menu are in neither desktop list", () => {
  for (const href of ["/", "/menu"]) {
    const item = NAV_ITEMS.find((entry) => entry.href === href);
    assert.ok(item, href);
    assert.equal(Boolean(item.strip || item.more), false, href);
  }
});

test("hrefs are unique", () => {
  const hrefs = NAV_ITEMS.map((item) => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("isActive compares the locale-free path and never marks home elsewhere", () => {
  assert.equal(isActive("/en/piyasalar", "/piyasalar"), true);
  assert.equal(isActive("/teknik/NVDA", "/teknik"), true);
  assert.equal(isActive("/en", "/"), true);
  assert.equal(isActive("/piyasalar", "/"), false);
  assert.equal(isActive("/en/rehber/pe-orani", "/rehber"), true);
});
