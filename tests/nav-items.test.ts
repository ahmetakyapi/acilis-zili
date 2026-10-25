import test from "node:test";
import assert from "node:assert/strict";
import { MORE_GROUPS, NAV_ITEMS, isActive, menuGroupOf } from "../components/layout/nav-items";

/* Masthead'in iki listesi (şerit ve "Daha Fazla") ile mobil alt çubuk aynı
   diziden okunuyor. Bu sınamalar modelin sözleşmesini tutuyor: bir öğe iki
   yerde birden görünmesin, taşma sırası belirsiz kalmasın, panel satırı
   ipucusuz çizilmesin. */

const strip = NAV_ITEMS.filter((item) => item.strip);
const more = NAV_ITEMS.filter((item) => item.more);

test("strip ranks are exactly 1..n, each used once", () => {
  const ranks = strip.map((item) => item.strip!.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, strip.map((_, index) => index + 1));
});

test("every more item belongs to a panel group", () => {
  for (const item of more) assert.ok(MORE_GROUPS.includes(item.more!), item.href);
});

/* 25 Ekim mega paneli, ikinci tur: üstte üç araç karosu, altında dört
   sütun EŞİT DÖRT SATIR (sahibinin isteği: "sağ sol dengesiz uzamasın").
   Kapılı öğe (Risk Masası) yalnız erişimi olana basılır ve sayılmaz;
   erişimi olana araç bandının dördüncü karosu. Yenilikler artık
   "Öğren ve Oku"nun satırı, dipte ayrı satır yok. */
test("tools band is three tiles and every column is exactly four ungated rows", () => {
  const count = (group: string) => more.filter((item) => item.more === group && !item.gate).length;
  assert.equal(count("tools"), 3);
  for (const group of MORE_GROUPS.filter((entry) => entry !== "tools")) {
    assert.equal(count(group), 4, group);
  }
  for (const item of more.filter((entry) => entry.gate)) assert.equal(item.more, "tools", item.href);
});

test("What's New is the last row of Learn and Read", () => {
  const learn = more.filter((item) => item.more === "learn").map((item) => item.href);
  assert.equal(learn[learn.length - 1], "/yenilikler");
});

/* Telefondaki /menu aynı diziden kuruluyor: şerit sekmeleri de bir gruba
   düşmeli, yoksa telefonda hiçbir yerde görünmezler. */
test("every strip and more item lands in a mobile menu group", () => {
  for (const item of [...strip, ...more]) assert.ok(menuGroupOf(item), item.href);
  for (const item of more) assert.equal(item.menu, undefined, item.href);
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
  assert.equal(isActive("/hisse/NVDA", "/sirketler"), true);
  assert.equal(isActive("/en/hisse/NVDA", "/sirketler"), true);
});
