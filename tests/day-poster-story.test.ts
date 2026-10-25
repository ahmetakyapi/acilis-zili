import test from "node:test";
import assert from "node:assert/strict";
import {
  STORY_BROAD_SHARE,
  posterStory,
  sectorClause,
  storyText,
  type StoryInput,
  type StoryLabels,
} from "../lib/day-poster-story";
import { POSTER_ANCHOR, type PosterBreadth, type PosterMove } from "../lib/day-poster";
import { OTHER_DISTRICT } from "../lib/day-skyline";
import { daySignatureEn, daySignatureTr } from "../lib/i18n/dictionaries/day-signature";

/**
 * Günün cümlesi — kurallar `lib/day-poster-story.ts`. Nasdaq 100 kurulumu
 * (25 Ekim): endeks QQQ, genişlik yüz üye, "sektörler" siluetin
 * mahalleleri (`districtMoves`, güçlüden zayıfa). Mahalle anahtarı SPDR
 * fonunun sembolü ya da "Diğer Sektörler" (`OTHER_DISTRICT`).
 */

const DISTRICT_NAMES: Record<string, [string, string]> = {
  XLK: ["Teknoloji", "Technology"],
  XLC: ["İletişim", "Communication Services"],
  XLY: ["Tüketici Ürünleri", "Consumer Discretionary"],
  XLV: ["Sağlık", "Health Care"],
  XLI: ["Sanayi", "Industrials"],
  XLP: ["Temel Tüketim", "Consumer Staples"],
  [OTHER_DISTRICT]: ["Diğer Sektörler", "Other Sectors"],
};

/** Mahalleler bu sırayla dizilir; değişimler çağıranın (güçlüden zayıfa). */
const KEYS = ["XLK", "XLC", "XLY", "XLV", "XLI", "XLP", OTHER_DISTRICT];

function districts(changes: number[], keys: string[] = KEYS): PosterMove[] {
  return changes.map((change, i) => ({ symbol: keys[i], change }));
}

function breadth(advancing: number, declining: number, unchanged = 0): PosterBreadth {
  const known = advancing + declining + unchanged;
  return { advancing, declining, unchanged, known, members: known };
}

const qqq = (change: number) => [{ symbol: POSTER_ANCHOR, change }];

function text(poster: StoryInput, locale: "tr" | "en") {
  const labels: StoryLabels = locale === "tr" ? daySignatureTr.story : daySignatureEn.story;
  const list = new Intl.ListFormat(locale === "tr" ? "tr-TR" : "en-US", { type: "conjunction" });
  return storyText(posterStory(poster), labels, {
    name: (s) => DISTRICT_NAMES[s]?.[locale === "tr" ? 0 : 1] ?? s,
    percent: (v) => (locale === "tr" ? `%${v.toFixed(2).replace(".", ",")}` : `${v.toFixed(2)}%`),
    list: (items) => list.format(items),
  });
}

test("endeks Nasdaq 100 fonu: başka sembolün değişimi okunmuyor", () => {
  assert.equal(POSTER_ANCHOR, "QQQ");
  const poster = { sectors: districts([1, 0.5, 0.2, 0, -0.2, -0.5, -1]), indices: [{ symbol: "SPY", change: -2 }, ...qqq(0.8)], breadth: null };
  assert.equal(posterStory(poster).kind, "rally");
  assert.equal(posterStory(poster).anchor, 0.8);
});

test("geniş satış: yüz üyenin 74'ü düştü, tek mahalle istisna", () => {
  const poster = { sectors: districts([0.41, -0.3, -0.6, -0.8, -1.1, -1.3, -1.6]), indices: qqq(-0.92), breadth: breadth(25, 74, 2) };
  const story = posterStory(poster);
  assert.equal(story.kind, "broadSelloff");
  assert.deepEqual(story.sectors, { kind: "only", dir: "up", symbols: ["XLK"] });
  assert.equal(text(poster, "tr").sentence, "Geniş Satış: Nasdaq 100'de 74 Hisse Düştü; Yalnız Teknoloji Yükseldi");
  assert.equal(text(poster, "en").sentence, "Broad Selloff: 74 Nasdaq 100 Stocks Fell; Only Technology Rose");
});

test("dar düşüş: endeks düştü ama hisselerin çoğu yükseldi; odak en zayıf mahalle", () => {
  const poster = { sectors: districts([1.2, 0.8, 0.5, 0.3, 0.1, -0.2, -2.4], ["XLV", "XLI", "XLP", "XLY", OTHER_DISTRICT, "XLC", "XLK"]), indices: qqq(-1.18), breadth: breadth(64, 37, 0) };
  assert.equal(posterStory(poster).kind, "narrowDecline");
  assert.equal(text(poster, "tr").sentence, "Dar Düşüş: Nasdaq 100 %1,18 Düştü ama 64 Hisse Yükseldi; En Çok Teknoloji Düştü");
  assert.equal(text(poster, "en").detail, "The Nasdaq 100 Fell 1.18% but 64 Stocks Rose; Technology Fell the Most");
});

test("bire bir eşitlik ayrışma sayılmıyor: 51'e 50 sıradan düşüş günü", () => {
  const poster = { sectors: districts([0.9, 0.4, 0.2, -0.1, -0.6, -1, -1.4]), indices: qqq(-0.71), breadth: breadth(51, 50) };
  const story = posterStory(poster);
  assert.equal(story.kind, "decline");
  assert.deepEqual(story.sectors, { kind: "leadLag", lead: "XLK", lag: OTHER_DISTRICT });
  assert.equal(text(poster, "tr").sentence, "Düşüş Günü: Nasdaq 100 %0,71 Düştü; Önde Teknoloji, Geride Diğer Sektörler");
  assert.equal(text(poster, "en").detail, "The Nasdaq 100 Fell 0.71%; Technology Led, Other Sectors Lagged");
});

test("geniş yükseliş ve tek istisna; eşik dahil", () => {
  const poster = { sectors: districts([2.1, 1.4, 1, 0.8, 0.6, 0.3, -0.28]), indices: qqq(1.34), breadth: breadth(83, 18) };
  assert.equal(posterStory(poster).kind, "broadRally");
  assert.equal(text(poster, "tr").detail, "Nasdaq 100'de 83 Hisse Yükseldi; Yalnız Diğer Sektörler Düştü");
  // Tam %70: geniş.
  assert.equal(posterStory({ ...poster, breadth: breadth(70, 30) }).kind, "broadRally");
  assert.equal(STORY_BROAD_SHARE, 0.7);
});

test("dar yükseliş: endeks arttı, hisselerin çoğu düştü; odak en güçlü mahalle", () => {
  const poster = { sectors: districts([3.16, 0.1, -0.1, -0.3, -0.5, -0.8, -1.38]), indices: qqq(0.66), breadth: breadth(38, 63) };
  assert.equal(posterStory(poster).kind, "narrowRally");
  assert.equal(text(poster, "tr").detail, "Nasdaq 100 %0,66 Yükseldi ama 63 Hisse Düştü; En Çok Teknoloji Yükseldi");
});

test("yatay: endeks ±%0,10 içinde; hikâye hisselerde", () => {
  const base = { sectors: districts([1, 0.5, 0.2, 0, -0.2, -0.5, -1]) };
  const down = { ...base, indices: qqq(-0.08), breadth: breadth(35, 65, 1) };
  assert.equal(text(down, "tr").sentence, "Yatay Kapanış: Nasdaq 100 Yerinde Saydı; 65 Hisse Düştü");
  const split = { ...base, indices: qqq(-0.02), breadth: breadth(50, 51) };
  assert.equal(text(split, "en").sentence, "Flat Close: The Nasdaq 100 Barely Moved; Stocks Split Evenly");
  // Genişlik yoksa mahalleler.
  const none = { ...base, indices: qqq(0.05), breadth: null };
  assert.equal(text(none, "tr").detail, "Nasdaq 100 Yerinde Saydı; Önde Teknoloji, Geride Diğer Sektörler");
});

test("genişlik yoksa endeksin yönü; mahallelerin hepsi aynı yöne", () => {
  const poster = { sectors: districts(Array(7).fill(-0.5)), indices: qqq(-0.9), breadth: null };
  assert.equal(posterStory(poster).kind, "decline");
  assert.equal(text(poster, "tr").detail, "Nasdaq 100 %0,90 Düştü; Sektörlerin Hepsi Düştü");
});

test("endeks fonu yoksa değişim sıfır: yatay", () => {
  assert.equal(posterStory({ sectors: districts([1, 0, -1]), indices: [], breadth: null }).kind, "flat");
});

test("mahalle cümlesi: sıfır istisna sayılmaz ama 'hepsi' de denmez; dört istisna önde/geride", () => {
  assert.deepEqual(sectorClause(districts([1, 1, 0, 1, 1, 1, 1]), "up"), { kind: "leadLag", lead: "XLK", lag: OTHER_DISTRICT });
  assert.equal(sectorClause(districts([1, 1, 1, -1, -1, -1, -1]), "up")?.kind, "leadLag");
  assert.equal(sectorClause([], "up"), null);
});

test("mahalle cümlesi: 'Yalnız' azınlık için; yedide üç istisna önde/geride", () => {
  assert.deepEqual(sectorClause(districts([1, 0.5, -0.3, -0.5, -0.7, -0.9, -1.1]), "down"), {
    kind: "only",
    dir: "up",
    symbols: ["XLK", "XLC"],
  });
  assert.equal(sectorClause(districts([1, 0.5, 0.3, -0.5, -0.7, -0.9, -1.1]), "down")?.kind, "leadLag");
  /* On bir sektörde üç istisna hâlâ azınlık. */
  const eleven = Array.from({ length: 11 }, (_, i) => ({ symbol: `S${i}`, change: i < 3 ? 1 : -1 }));
  assert.equal(sectorClause(eleven, "down")?.kind, "only");
});

test("mahalle cümlesi: yatay banttaki ters mahalle 'Yalnız …' diye anılmaz", () => {
  /* Geniş satış, Teknoloji +%0,01: okunur fark yok → önde/geride. */
  const nearFlat = districts([0.01, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8]);
  assert.deepEqual(sectorClause(nearFlat, "down"), { kind: "leadLag", lead: "XLK", lag: OTHER_DISTRICT });
  /* Bandın sınırı da içeride; bandı aşan istisna anılır. */
  assert.equal(sectorClause(districts([0.1, -1, -1, -1, -1, -1, -1]), "down")?.kind, "leadLag");
  assert.deepEqual(sectorClause(districts([0.11, -1, -1, -1, -1, -1, -1]), "down"), { kind: "only", dir: "up", symbols: ["XLK"] });
});
