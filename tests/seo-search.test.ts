import test from "node:test";
import assert from "node:assert/strict";

import {
  analysisHref,
  canonicalPeriod,
  dropShadowedPeriods,
  periodSlug,
  periodVariants,
  pickAnalysisRow,
} from "../lib/analysis";
import { neighborsAmong, pickNeighbors, preferLocale } from "../lib/story-neighbors";

/**
 * Site içi bağlantı ve kopya adres düzeltmeleri (25 Ekim).
 * Gerekçeler: `lib/analysis.ts` → `canonicalPeriod`, `periodVariants`;
 * `lib/story-neighbors.ts`. Başlıklar `tests/seo-titles.test.ts`, rehber
 * künyesi `tests/guide-search.test.ts`.
 */

test("dönem adresi tek kalıp: İngilizce etiket Türkçe parçaya iner", () => {
  assert.equal(periodSlug("3Ç 2026"), "3c-2026");
  assert.equal(periodSlug("Q3 2026"), "3c-2026");
  assert.equal(periodSlug("Q4 FY2026"), "4c-fy2026");
  assert.equal(periodSlug("4Ç FY2026"), "4c-fy2026");
  assert.equal(canonicalPeriod("q3-2026"), "3c-2026");
  assert.equal(canonicalPeriod("3c-fy2027"), "3c-fy2027");
  // "Q" ile başlayan ama çeyrek olmayan etiket bozulmaz.
  assert.equal(periodSlug("Quarter 2026"), "quarter-2026");
});

test("site haritası ikizi olan eski dönemi düşürür, ikizsizi tutar", () => {
  const rows = [
    { symbol: "TXN", period: "3c-2026" },
    { symbol: "TXN", period: "q3-2026" },
    { symbol: "ABC", period: "q2-2026" },
  ];
  assert.deepEqual(dropShadowedPeriods(rows), [
    { symbol: "TXN", period: "3c-2026" },
    { symbol: "ABC", period: "q2-2026" },
  ]);
});

test("dönemin iki yazımı aynı adrese iner", () => {
  assert.deepEqual(periodVariants("3c-2026"), ["3c-2026", "q3-2026"]);
  assert.deepEqual(periodVariants("q3-2026"), ["3c-2026", "q3-2026"]);
  assert.deepEqual(periodVariants("fy2026"), ["fy2026"]);
  assert.equal(analysisHref("TXN", "q3-2026"), "/bilancolar/txn/3c-2026");
});

test("analiz satırı: önce dil, dil içinde tek kalıp; TR q3 + EN 3c eşleşir", () => {
  const tr = { period: "q3-2026", locale: "tr" };
  const en = { period: "3c-2026", locale: "en" };
  // Bir dilde yalnız eski, ötekinde yalnız yeni yazım: her dil kendi satırını alır.
  assert.equal(pickAnalysisRow([en, tr], "tr"), tr);
  assert.equal(pickAnalysisRow([tr, en], "en"), en);
  // Aynı dilde iki yazım: tek kalıp.
  const trNew = { period: "3c-2026", locale: "tr" };
  assert.equal(pickAnalysisRow([tr, trNew], "tr"), trNew);
  // Dil yoksa tek kalıp, o da yoksa ilk satır.
  assert.equal(pickAnalysisRow([tr, en], "de"), en);
  assert.equal(pickAnalysisRow([tr], "en"), tr);
  assert.equal(pickAnalysisRow([], "tr"), null);
});

test("mercek komşuları: bir yeni iki eski; uçta öteki taraf doldurur", () => {
  const s = (slug: string) => ({ slug });
  // newer yakından uzağa (eskiden yeniye), older yakından uzağa.
  assert.deepEqual(
    pickNeighbors([s("n1"), s("n2")], [s("o1"), s("o2"), s("o3")]).map((r) => r.slug),
    ["n1", "o1", "o2"],
  );
  // En yeni yazı: üç eski.
  assert.deepEqual(pickNeighbors([], [s("o1"), s("o2"), s("o3"), s("o4")]).map((r) => r.slug), [
    "o1",
    "o2",
    "o3",
  ]);
  // En eski yazı: üç yeni, ekranda yeniden eskiye.
  assert.deepEqual(pickNeighbors([s("n1"), s("n2"), s("n3")], []).map((r) => r.slug), [
    "n3",
    "n2",
    "n1",
  ]);
  // Tek eski varsa iki yeni.
  assert.deepEqual(pickNeighbors([s("n1"), s("n2")], [s("o1")]).map((r) => r.slug), [
    "n2",
    "n1",
    "o1",
  ]);
});

test("mercek komşuları: yeni taraf sonraki olay gününden, aynı günün sonrakisi değil", () => {
  const row = (slug: string, eventDate: string, hour: number, locale = "tr") => ({
    slug,
    locale,
    eventDate,
    publishedAt: new Date(`${eventDate}T${String(hour).padStart(2, "0")}:00:00Z`),
  });
  const current = row("asml", "2026-10-14", 8);
  const rows = [
    current,
    row("coreweave", "2026-10-14", 20), // aynı gün, daha geç: ne yeni ne eski
    row("tsmc", "2026-10-15", 9),
    row("sonraki", "2026-10-16", 9),
    row("jpm", "2026-10-13", 20),
    row("samsung", "2026-10-13", 8),
    row("eski", "2026-10-10", 8),
  ];
  assert.deepEqual(
    neighborsAmong(rows, current, "tr").map((r) => r.slug),
    ["tsmc", "jpm", "samsung"],
  );
});

test("mercek komşuları: sıra okuyucunun dilindeki satırın anıyla kurulur", () => {
  const at = (iso: string) => new Date(iso);
  const current = { slug: "leopold", eventDate: "2026-07-30", publishedAt: at("2026-08-01T23:00:00Z") };
  // EN çevirileri günler sonra: karışık sırada "hemen önceki" EN anına göre seçiliyordu.
  const rows = [
    { slug: "warsh", locale: "tr", eventDate: "2026-07-29", publishedAt: at("2026-08-02T09:56:00Z") },
    { slug: "warsh", locale: "en", eventDate: "2026-07-29", publishedAt: at("2026-08-05T17:46:00Z") },
    { slug: "meta", locale: "tr", eventDate: "2026-07-29", publishedAt: at("2026-08-02T18:09:00Z") },
    { slug: "meta", locale: "en", eventDate: "2026-07-29", publishedAt: at("2026-08-05T17:45:00Z") },
    { slug: "kore", locale: "tr", eventDate: "2026-07-29", publishedAt: at("2026-08-04T13:50:00Z") },
    { slug: "kore", locale: "en", eventDate: "2026-07-29", publishedAt: at("2026-08-05T13:22:00Z") },
  ];
  const picked = neighborsAmong(rows, current, "tr");
  assert.deepEqual(picked.map((r) => r.slug), ["kore", "meta", "warsh"]);
  assert.ok(picked.every((r) => r.locale === "tr"));
});

test("mercek komşuları: slug başına tek satır, istenen dil önde", () => {
  const rows = [
    { slug: "a", locale: "tr" },
    { slug: "a", locale: "en" },
    { slug: "b", locale: "tr" },
  ];
  assert.deepEqual(preferLocale(rows, "en"), [
    { slug: "a", locale: "en" },
    { slug: "b", locale: "tr" },
  ]);
});
