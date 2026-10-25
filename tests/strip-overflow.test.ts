import { test } from "node:test";
import assert from "node:assert/strict";
import { overflowingTabs } from "../components/layout/strip-overflow";

/* 1280, oturumlu TR, 25 Ekim öncesi ölçülen genişlikler (üretim derlemesi):
   altı sekme 558 piksel, aralık 6,4 × 5 = 32, şerit hücresinde 553 kalıyordu. */
const TABS = [
  { href: "/piyasalar", rank: 1, width: 91 },
  { href: "/teknik", rank: 4, width: 120 },
  { href: "/sirketler", rank: 6, width: 86 },
  { href: "/bilancolar", rank: 2, width: 98 },
  { href: "/mercek", rank: 3, width: 79 },
  { href: "/tema", rank: 5, width: 84 },
] as const;
const GAP = 6.4;

test("aralık sayılmazsa sığıyor görünen şerit aralıkla taşar", () => {
  /* Eski hesap: 558 <= 560 → hiçbiri inmez, ama liste 590 piksel ister. */
  assert.equal(overflowingTabs(TABS, 560, 0).size, 0);
  assert.deepEqual([...overflowingTabs(TABS, 560, GAP)], ["/sirketler"]);
});

test("taşmada önce en yüksek öncelik numarası iner", () => {
  assert.deepEqual([...overflowingTabs(TABS, 553, GAP)], ["/sirketler"]);
  assert.deepEqual([...overflowingTabs(TABS, 480, GAP)], ["/sirketler", "/tema"]);
});

test("gizlenen sekme kendi aralığını da götürür", () => {
  /* 590 − (86 + 6,4) = 497,6: tam o kadar yer varsa yalnız Şirketler iner. */
  assert.deepEqual([...overflowingTabs(TABS, 497.6, GAP)], ["/sirketler"]);
  assert.deepEqual([...overflowingTabs(TABS, 497.5, GAP)], ["/sirketler", "/tema"]);
});

test("yer yeterse hiçbir sekme inmez", () => {
  assert.equal(overflowingTabs(TABS, 590, GAP).size, 0);
  assert.equal(overflowingTabs([], 0, GAP).size, 0);
});
