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

/* 25 Ekim mega paneli: üstte üç araç karosu, altında dört sütun. Panel 900
   piksellik ekranda taşmasın diye (ölçüm MastheadMore.module.css) en uzun
   sütun beş satır; araç bandı tek sıra üç karo. Sütunların eşit boyda
   olması GEREKMİYOR — eski iki sütunlu panelin satır hizası kuralı
   grupları anlamına göre değil boyuna göre dağıtıyordu. */
test("tools band is three tiles and no column runs past five rows", () => {
  const count = (group: string) => more.filter((item) => item.more === group).length;
  assert.equal(count("tools"), 3);
  for (const group of MORE_GROUPS.filter((entry) => entry !== "tools")) {
    assert.ok(count(group) >= 1 && count(group) <= 5, `${group}: ${count(group)}`);
  }
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
