import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CHANGELOG_EN, CHANGELOG_TR, CHANGE_AREAS, TELEGRAM_HREF } from "../content/changelog";
import { COMPARE_PAIR_SLUGS } from "../content/compare-pairs";
import { GUIDE_META } from "../content/guide/meta";
import {
  changelogEntries,
  entryAreas,
  entryDateLabel,
  filterEntries,
  groupByMonth,
  groupByArea,
  kindCounts,
  monthTicks,
  parseKind,
  releaseTimeline,
  resolveHref,
} from "../lib/changelog";
import { FRESH_DAYS, parseSeen, shouldBadge } from "../lib/changelog-seen";

/* Yenilikler içeriğinin bütünlüğü (25 Ekim). Kurallar content/changelog.ts
   başında; burada sınanan: iki dil hizası, tarih sırası, madde sayısı,
   her "Dene" bağlantısının bugün var olan bir rotaya gitmesi, arayüz
   metninde em dash olmaması ve rozet/süzgeç/katlama mantığı. */

/* ---- Rotalar: app/(app) altındaki page.tsx'lerden, dinamik segment kalıp ---- */

const APP_DIR = join(process.cwd(), "app", "(app)");

function collectRoutes(dir: string, prefix: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") out.push(prefix || "/");
      continue;
    }
    if (name.startsWith("_") || name.startsWith(".")) continue;
    collectRoutes(full, `${prefix}/${name}`, out);
  }
}

const ROUTES: string[] = [];
collectRoutes(APP_DIR, "", ROUTES);

function routeMatches(pattern: string, path: string): boolean {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((segment, index) => segment.startsWith("[") || segment === b[index]);
}

const GUIDE_SLUGS = new Set<string>(GUIDE_META.map((entry) => entry.slug));

/** Dinamik segmentte gerçek bir değer mi — bilinen içerik kümelerine karşı. */
function knownValue(path: string): boolean {
  const [, section, value] = path.split("/");
  if (section === "rehber" && value) return GUIDE_SLUGS.has(value);
  if (section === "karsilastir" && value) return COMPARE_PAIR_SLUGS.includes(value);
  return true;
}

test("routes were found", () => {
  assert.ok(ROUTES.includes("/"));
  assert.ok(ROUTES.includes("/yenilikler"));
  assert.ok(ROUTES.includes("/hisse/[symbol]"));
});

test("TR and EN line up: same entries, same dates, same item counts", () => {
  assert.equal(CHANGELOG_EN.length, CHANGELOG_TR.length);
  CHANGELOG_TR.forEach((entry, index) => {
    const en = CHANGELOG_EN[index];
    assert.equal(en.date, entry.date, `entry ${index}`);
    assert.equal(en.items.length, entry.items.length, entry.date);
  });
});

test("dates are valid, unique and strictly descending; ranges run forward", () => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  CHANGELOG_TR.forEach((entry, index) => {
    assert.match(entry.date, iso);
    assert.ok(!Number.isNaN(Date.parse(entry.date)), entry.date);
    if ("from" in entry) assert.ok(entry.from < entry.date, entry.date);
    if (index > 0) assert.ok(entry.date < CHANGELOG_TR[index - 1].date, `${entry.date} after ${CHANGELOG_TR[index - 1].date}`);
  });
  assert.equal(CHANGELOG_TR[CHANGELOG_TR.length - 1].date, "2026-08-01");
});

test("every entry has 2-6 items; only the featured latest entry may carry more", () => {
  CHANGELOG_TR.forEach((entry, index) => {
    const max = index === 0 ? 16 : 6;
    assert.ok(entry.items.length >= 2 && entry.items.length <= max, `${entry.date}: ${entry.items.length}`);
  });
});

test("every href is a route that exists today", () => {
  for (const entry of CHANGELOG_TR) {
    for (const item of entry.items) {
      if (!("href" in item) || item.href === undefined) continue;
      if (item.href === TELEGRAM_HREF) continue;
      const path = item.href.split(/[?#]/)[0];
      assert.ok(ROUTES.some((route) => routeMatches(route, path)), `${entry.date} ${item.title}: ${item.href}`);
      assert.ok(knownValue(path), `${entry.date} ${item.title}: unknown value in ${item.href}`);
    }
  }
});

test("no em or en dash in any reader-facing text, titles start capitalised", () => {
  const texts: string[] = [];
  for (const entry of [...CHANGELOG_TR, ...CHANGELOG_EN]) {
    texts.push(entry.title, entry.summary);
    for (const item of entry.items) texts.push(item.title, item.body);
  }
  for (const text of texts) {
    assert.equal(/[–—]/.test(text), false, text);
    assert.equal(text.trim(), text, text);
  }
  for (const entry of [...CHANGELOG_TR, ...CHANGELOG_EN]) {
    for (const title of [entry.title, ...entry.items.map((item) => item.title)]) {
      assert.match(title, /^[A-ZÇĞİÖŞÜ0-9"]/u, title);
    }
  }
});

test("Telegram item links only when the channel URL is set", () => {
  assert.equal(resolveHref(TELEGRAM_HREF, null), null);
  assert.equal(resolveHref(TELEGRAM_HREF, "https://t.me/aciliszili"), "https://t.me/aciliszili");
  assert.equal(resolveHref("/tarama", null), "/tarama");
  assert.equal(resolveHref(undefined, null), null);
  const latest = changelogEntries("tr", null)[0];
  assert.ok(latest.items.some((item) => item.title === "Telegram Kanalı" && item.href === null));
});

test("entries merge language text with TR structure", () => {
  const tr = changelogEntries("tr", null);
  const en = changelogEntries("en", null);
  assert.equal(tr.length, en.length);
  assert.equal(en[0].from, "2026-10-24");
  assert.deepEqual(
    en[0].items.map((item) => [item.kind, item.href]),
    tr[0].items.map((item) => [item.kind, item.href]),
  );
  assert.notEqual(en[0].title, tr[0].title);
});

test("kind filter works per item and drops empty entries", () => {
  const all = changelogEntries("tr", null);
  const counts = kindCounts(all);
  assert.equal(counts.all, counts.yeni + counts.iyilestirme + counts.duzeltme);
  const fixes = filterEntries(all, "duzeltme");
  assert.ok(fixes.length > 0 && fixes.length < all.length);
  assert.ok(fixes.every((entry) => entry.items.length > 0 && entry.items.every((item) => item.kind === "duzeltme")));
  assert.equal(kindCounts(fixes).all, counts.duzeltme);
  assert.equal(filterEntries(all, null).length, all.length);
  assert.equal(parseKind("duzeltme"), "duzeltme");
  assert.equal(parseKind(["yeni", "x"]), "yeni");
  assert.equal(parseKind("bogus"), null);
  assert.equal(parseKind(undefined), null);
});

test("months keep order, newest first", () => {
  const months = groupByMonth(changelogEntries("tr", null));
  assert.deepEqual(months.map((month) => month.month), ["2026-10", "2026-09", "2026-08"]);
});

test("badge: seen date compares, empty storage only while the latest is fresh", () => {
  assert.equal(shouldBadge("2026-10-25", "2026-10-25", "2026-12-01"), false);
  assert.equal(shouldBadge("2026-10-25", "2026-10-22", "2026-12-01"), true);
  assert.equal(shouldBadge("2026-10-25", null, "2026-10-25"), true);
  assert.equal(shouldBadge("2026-10-25", null, "2026-11-04"), FRESH_DAYS >= 10);
  assert.equal(shouldBadge("2026-10-25", null, "2026-12-01"), false);
  assert.equal(parseSeen("2026-10-25"), "2026-10-25");
  assert.equal(parseSeen("garbage"), null);
  assert.equal(parseSeen(null), null);
});

test("date labels: ranges use a hyphen, never an en dash", () => {
  const [latest] = changelogEntries("tr", null);
  assert.equal(entryDateLabel(latest, "tr"), "24-25 Ekim 2026");
  assert.equal(entryDateLabel(changelogEntries("en", null)[0], "en"), "October 24-25, 2026");
  assert.equal(entryDateLabel({ ...latest, from: "2026-09-30" }, "tr"), "30 Eylül 2026 - 25 Ekim 2026");
  assert.equal(entryDateLabel({ ...latest, from: null }, "tr"), "25 Ekim 2026");
});

/* ---- Yeniden düzen (25 Ekim): alanlar, kısa özet, sürüm şeridi ---- */

/** Kısa özetin tavanı — 1440'ta dört sütunlu karoda tek satır (ölçüldü). */
const SHORT_MAX = 36;

test("every item has a known area; the latest entry has a one-line short in both languages", () => {
  for (const entry of CHANGELOG_TR) {
    for (const item of entry.items) assert.ok((CHANGE_AREAS as readonly string[]).includes(item.area), item.title);
  }
  const trTop = CHANGELOG_TR[0].items as readonly { short?: string; title: string }[];
  const enTop = CHANGELOG_EN[0].items as readonly { short?: string; title: string }[];
  for (const list of [trTop, enTop]) {
    for (const item of list) {
      assert.ok(item.short, `short missing: ${item.title}`);
      assert.ok(item.short.length <= SHORT_MAX, `short too long (${item.short.length}): ${item.short}`);
      assert.doesNotMatch(item.short, /[\u2013\u2014]/);
    }
  }
});

test("groupByArea keeps area order and item order, entryAreas lists each area once", () => {
  const [latest] = changelogEntries("tr", null);
  const groups = groupByArea(latest.items);
  assert.deepEqual(groups.map((g) => g.area), CHANGE_AREAS.filter((a) => latest.items.some((i) => i.area === a)));
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), latest.items.length);
  assert.deepEqual(entryAreas(latest), groups.map((g) => g.area));
});

test("release timeline runs oldest to newest on a 0-1 day scale with month ticks", () => {
  const points = releaseTimeline(changelogEntries("tr", null));
  assert.equal(points.length, CHANGELOG_TR.length);
  assert.equal(points[0].x, 0);
  assert.equal(points.at(-1)!.x, 1);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].x > points[i - 1].x);
  const ticks = monthTicks(points);
  assert.equal(ticks[0].month, points[0].date.slice(0, 7));
  assert.ok(ticks.every((t) => t.x >= 0 && t.x <= 1));
});
