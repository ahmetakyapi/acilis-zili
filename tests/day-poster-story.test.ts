import test from "node:test";
import assert from "node:assert/strict";
import {
  STORY_BROAD_SHARE,
  posterStory,
  sectorClause,
  storyText,
  type StoryLabels,
} from "../lib/day-poster-story";
import type { PosterBreadth, PosterMove } from "../lib/day-poster";
import { daySignatureEn, daySignatureTr } from "../lib/i18n/dictionaries/day-signature";

/**
 * Günün cümlesi — kurallar `lib/day-poster-story.ts`. Örnekler gerçek
 * seanslardan (Alpaca gün barları, 25 Ekim ölçümü): 23 Ekim geniş satış,
 * 22 Ekim dar düşüş, 20 Ekim geniş yükseliş, 16 Ekim bire bir eşitlik.
 */

const SECTOR_NAMES: Record<string, [string, string]> = {
  XLE: ["Enerji", "Energy"],
  XLK: ["Teknoloji", "Technology"],
  XLRE: ["Gayrimenkul", "Real Estate"],
  XLP: ["Temel Tüketim", "Consumer Staples"],
  XLV: ["Sağlık", "Health Care"],
};

function sectors(changes: number[]): PosterMove[] {
  const symbols = ["XLE", "XLK", "XLRE", "XLU", "XLB", "XLV", "XLI", "XLF", "XLY", "XLC", "XLP"];
  return changes.map((change, i) => ({ symbol: symbols[i], change }));
}

function breadth(advancing: number, declining: number, unchanged = 0): PosterBreadth {
  const known = advancing + declining + unchanged;
  return { advancing, declining, unchanged, known, members: known };
}

function text(poster: Parameters<typeof posterStory>[0], locale: "tr" | "en") {
  const labels: StoryLabels = locale === "tr" ? daySignatureTr.story : daySignatureEn.story;
  const list = new Intl.ListFormat(locale === "tr" ? "tr-TR" : "en-US", { type: "conjunction" });
  return storyText(posterStory(poster), labels, {
    name: (s) => SECTOR_NAMES[s]?.[locale === "tr" ? 0 : 1] ?? s,
    percent: (v) => (locale === "tr" ? `%${v.toFixed(2).replace(".", ",")}` : `${v.toFixed(2)}%`),
    list: (items) => list.format(items),
  });
}

const OCT23 = {
  sectors: sectors([2.6, 0.49, 0.12, -0.72, -0.74, -1.11, -1.27, -1.32, -1.66, -1.78, -1.92]),
  indices: [{ symbol: "SPY", change: -0.52 }],
  breadth: breadth(130, 363, 1),
};

test("geniş satış: hisselerin %70'inden fazlası düştü, üç sektör istisna", () => {
  const story = posterStory(OCT23);
  assert.equal(story.kind, "broadSelloff");
  assert.deepEqual(story.sectors, { kind: "only", dir: "up", symbols: ["XLE", "XLK", "XLRE"] });
  assert.equal(
    text(OCT23, "tr").sentence,
    "Geniş Satış: S&P 500'de 363 Hisse Düştü; Yalnız Enerji, Teknoloji ve Gayrimenkul Yükseldi",
  );
  assert.equal(text(OCT23, "en").sentence, "Broad Selloff: 363 S&P 500 Stocks Fell; Only Energy, Technology, and Real Estate Rose");
});

test("dar düşüş: endeks %1,18 düştü ama hisselerin %68'i yükseldi", () => {
  const poster = {
    sectors: sectors([3.31, 1, 0.5, 0.4, 0.3, 0.2, -0.1, -0.2, -0.3, -1, -3.29]).map((m, i) =>
      i === 10 ? { symbol: "XLK", change: m.change } : i === 1 ? { symbol: "XLP", change: m.change } : m,
    ),
    indices: [{ symbol: "SPY", change: -1.18 }],
    breadth: breadth(336, 157, 1),
  };
  const story = posterStory(poster);
  assert.equal(story.kind, "narrowDecline");
  assert.equal(text(poster, "tr").sentence, "Dar Düşüş: S&P 500 %1,18 Düştü ama 336 Hisse Yükseldi; En Çok Teknoloji Düştü");
  assert.equal(text(poster, "en").detail, "The S&P 500 Fell 1.18% but 336 Stocks Rose; Technology Fell the Most");
});

test("bire bir eşitlik ayrışma sayılmıyor: 247'ye 246 sıradan düşüş günü", () => {
  const poster = { sectors: sectors([2.5, 1, 0.5, 0.3, 0.2, 0.1, -0.5, -1, -1.5, -2, -3]), indices: [{ symbol: "SPY", change: -1.11 }], breadth: breadth(247, 246, 1) };
  const story = posterStory(poster);
  assert.equal(story.kind, "decline");
  assert.deepEqual(story.sectors, { kind: "leadLag", lead: "XLE", lag: "XLP" });
  assert.equal(text(poster, "tr").sentence, "Düşüş Günü: S&P 500 %1,11 Düştü; Önde Enerji, Geride Temel Tüketim");
});

test("geniş yükseliş ve tek istisna; eşik dahil", () => {
  const poster = { sectors: sectors([2.37, 1, 1, 1, 1, 1, 1, 1, 0.5, 0.2, -0.28]), indices: [{ symbol: "SPY", change: 0.34 }], breadth: breadth(398, 96) };
  assert.equal(posterStory(poster).kind, "broadRally");
  assert.equal(text(poster, "tr").detail, "S&P 500'de 398 Hisse Yükseldi; Yalnız Temel Tüketim Düştü");
  // Tam %70: geniş.
  assert.equal(posterStory({ ...poster, breadth: breadth(70, 30) }).kind, "broadRally");
  assert.equal(STORY_BROAD_SHARE, 0.7);
});

test("dar yükseliş: endeks arttı, hisselerin çoğu düştü; odak en güçlü sektör", () => {
  const poster = { sectors: sectors([3.16, 0.1, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -1.38]).map((m, i) => (i === 0 ? { symbol: "XLK", change: m.change } : i === 1 ? { symbol: "XLE", change: m.change } : m)), indices: [{ symbol: "SPY", change: 0.66 }], breadth: breadth(150, 344) };
  assert.equal(posterStory(poster).kind, "narrowRally");
  assert.equal(text(poster, "tr").detail, "S&P 500 %0,66 Yükseldi ama 344 Hisse Düştü; En Çok Teknoloji Yükseldi");
});

test("yatay: endeks ±%0,10 içinde; hikâye hisselerde", () => {
  const base = { sectors: sectors([1, 0.5, 0.2, 0.1, 0, -0.1, -0.2, -0.3, -0.4, -0.5, -1]) };
  const down = { ...base, indices: [{ symbol: "SPY", change: -0.08 }], breadth: breadth(170, 325, 1) };
  assert.equal(text(down, "tr").sentence, "Yatay Kapanış: S&P 500 Yerinde Saydı; 325 Hisse Düştü");
  const split = { ...base, indices: [{ symbol: "SPY", change: -0.02 }], breadth: breadth(246, 249, 1) };
  assert.equal(text(split, "en").sentence, "Flat Close: The S&P 500 Barely Moved; Stocks Split Evenly");
  // Genişlik yoksa sektörler.
  const none = { ...base, indices: [{ symbol: "SPY", change: 0.05 }], breadth: null };
  assert.equal(text(none, "tr").detail, "S&P 500 Yerinde Saydı; Önde Enerji, Geride Temel Tüketim");
});

test("genişlik yoksa endeksin yönü; sektörlerin hepsi aynı yöne", () => {
  const poster = { sectors: sectors(Array(11).fill(-0.5)), indices: [{ symbol: "SPY", change: -0.9 }], breadth: null };
  assert.equal(posterStory(poster).kind, "decline");
  assert.equal(text(poster, "tr").detail, "S&P 500 %0,90 Düştü; Sektörlerin Hepsi Düştü");
});

test("sektör cümlesi: sıfır istisna sayılmaz ama 'hepsi' de denmez; dört istisna önde/geride", () => {
  assert.deepEqual(sectorClause(sectors([1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1]), "up"), { kind: "leadLag", lead: "XLE", lag: "XLP" });
  assert.equal(sectorClause(sectors([1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1]), "up")?.kind, "leadLag");
  assert.equal(sectorClause([], "up"), null);
});

test("sektör cümlesi: yatay banttaki ters fon 'Yalnız …' diye anılmaz", () => {
  /* Geniş satış, Enerji +%0,01: okunur fark yok → önde/geride. */
  const nearFlat = sectors([0.01, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1, -1.1, -1.2]);
  assert.deepEqual(sectorClause(nearFlat, "down"), { kind: "leadLag", lead: "XLE", lag: "XLP" });
  /* Bandın sınırı da içeride; bandı aşan istisna anılır. */
  assert.equal(sectorClause(sectors([0.1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]), "down")?.kind, "leadLag");
  assert.deepEqual(sectorClause(sectors([0.11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]), "down"), {
    kind: "only",
    dir: "up",
    symbols: ["XLE"],
  });
});
