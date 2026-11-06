import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CHANGELOG_EN, CHANGELOG_TR, CHANGE_AREAS, CHANGE_SCREENS, TELEGRAM_HREF } from "../content/changelog";
import { COMPARE_PAIR_SLUGS } from "../content/compare-pairs";
import { GUIDE_META } from "../content/guide/meta";
import {
  areaCounts,
  changelogEntries,
  entryDateLabel,
  filterEntries,
  groupByMonth,
  kindCounts,
  latestDigest,
  parseArea,
  parseKind,
  parseScreen,
  resolveHref,
  screenOf,
  screenSummary,
  weekStart,
  weeklyFlow,
  type ChangeEntry,
  type ChangeItem,
} from "../lib/changelog";
import { isUnseen } from "../components/changelog/seen-store";
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

test("every entry has 2-6 items; a major release (every item has a short) may carry up to 16", () => {
  CHANGELOG_TR.forEach((entry) => {
    const major = entry.items.every((item) => "short" in item && typeof item.short === "string");
    const max = major ? 16 : 6;
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
  const items = changelogEntries("tr", null).flatMap((entry) => entry.items);
  assert.ok(items.some((item) => item.title === "Telegram Kanalı" && item.href === null));
});

test("entries merge language text with TR structure", () => {
  const tr = changelogEntries("tr", null);
  const en = changelogEntries("en", null);
  assert.equal(tr.length, en.length);
  /* Aralıklı giriş (`from`) dilden bağımsız geçer; en üstteki giriş tek gün
     olabilir (6 Kasım), ilk aralıklı girişe bakılır. */
  const ranged = tr.findIndex((entry) => entry.from);
  assert.ok(ranged >= 0);
  assert.equal(en[ranged].from, tr[ranged].from);
  assert.ok(en[ranged].from! < en[ranged].date);
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
  assert.deepEqual(months.map((month) => month.month), ["2026-11", "2026-10", "2026-09", "2026-08"]);
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
  const latest = changelogEntries("tr", null).find((entry) => entry.date === "2026-10-25")!;
  assert.equal(entryDateLabel(latest, "tr"), "24-25 Ekim 2026");
  assert.equal(entryDateLabel(changelogEntries("en", null).find((entry) => entry.date === "2026-10-25")!, "en"), "October 24-25, 2026");
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

/* ---- Üçüncü düzen (6 Kasım): ekran, son güncelleme özeti, haftalık akış ---- */

test("screens come from the explicit field, then the link's route, else sitewide", () => {
  assert.equal(screenOf(undefined, "/"), "anasayfa");
  assert.equal(screenOf(undefined, "/hisse/NVDA"), "hisse");
  assert.equal(screenOf(undefined, "/claude/NVDA"), "hisse");
  assert.equal(screenOf(undefined, "/sirketler?sira=x"), "piyasalar");
  assert.equal(screenOf(undefined, "/bulmaca/hangisi-buyuk"), "gunluk");
  assert.equal(screenOf(undefined, "/bulten#x"), "mercek");
  assert.equal(screenOf(undefined, "/yenilikler"), "site");
  assert.equal(screenOf(undefined, TELEGRAM_HREF), "site");
  assert.equal(screenOf(undefined, undefined), "site");
  assert.equal(screenOf("teknik", "/"), "teknik");
  assert.equal(parseScreen("hisse"), "hisse");
  assert.equal(parseScreen(["takvim", "x"]), "takvim");
  assert.equal(parseScreen("bogus"), null);
  /* Her ekranın içerikte en az bir maddesi var (boş karo kalıcı olmasın). */
  const all = changelogEntries("tr", null);
  const summary = screenSummary(all);
  assert.deepEqual(summary.map((row) => row.screen), [...CHANGE_SCREENS]);
  for (const row of summary) assert.ok(row.counts.all > 0, `empty screen: ${row.screen}`);
  /* Gezinmede yeri olan her bağlantılı rota bir ekrana düşer (Site Geneli
     yalnız bağlantısız, dış ve sayfanın kendisi). */
  for (const item of all.flatMap((entry) => entry.items)) {
    if (item.href && item.href.startsWith("/") && !item.href.startsWith("/yenilikler") && !item.href.startsWith("/menu")) {
      assert.notEqual(screenOf(undefined, item.href), "site", `${item.title}: ${item.href}`);
    }
  }
});

test("screen filter works per item, combines with kind and area, summary counts add up", () => {
  const all = changelogEntries("tr", null);
  const hisse = filterEntries(all, null, null, "hisse");
  assert.ok(hisse.length > 0 && hisse.every((e) => e.items.every((i) => i.screen === "hisse")));
  const summary = screenSummary(all);
  assert.equal(summary.reduce((n, row) => n + row.counts.all, 0), kindCounts(all).all);
  const row = summary.find((r) => r.screen === "hisse")!;
  assert.equal(row.counts.all, kindCounts(hisse).all);
  assert.equal(row.counts.yeni + row.counts.iyilestirme + row.counts.duzeltme, row.counts.all);
  assert.equal(row.last, hisse[0].date);
  const both = filterEntries(all, "duzeltme", null, "anasayfa");
  assert.ok(both.every((e) => e.items.every((i) => i.kind === "duzeltme" && i.screen === "anasayfa")));
  assert.equal(screenSummary(filterEntries(all, "duzeltme")).find((r) => r.screen === "anasayfa")!.counts.all, kindCounts(both).all);
  assert.deepEqual(filterEntries(all, "yeni", "piyasa"), filterEntries(all, "yeni", "piyasa", null));
  /* Alan süzgeci (25 Ekim) aynı kuralla: madde düzeyinde, sayılar tutar. */
  assert.equal(parseArea("claude"), "claude");
  assert.equal(parseArea("bogus"), null);
  const byArea = areaCounts(all);
  assert.equal(Object.values(byArea).reduce((a, b) => a + b, 0), kindCounts(all).all);
  const claude = filterEntries(all, null, "claude");
  assert.ok(claude.length > 0 && claude.every((e) => e.items.every((i) => i.area === "claude")));
  assert.equal(kindCounts(claude).all, byArea.claude);
});

const item = (over: Partial<ChangeItem>): ChangeItem => ({
  kind: "yeni", area: "piyasa", screen: "piyasalar", title: "T", short: null, body: "B", href: "/x", ...over,
});

test("latest digest: three kind columns in order, Claude last in each, nothing lost", () => {
  const [latest] = changelogEntries("tr", null);
  const columns = latestDigest(latest);
  assert.deepEqual(columns.map((c) => c.kind), ["yeni", "iyilestirme", "duzeltme"]);
  assert.equal(columns.reduce((n, c) => n + c.items.length, 0), latest.items.length);
  for (const column of columns) assert.ok(column.items.every((i) => i.kind === column.kind));
  const entry: ChangeEntry = {
    date: "2026-11-06", from: null, title: "T", summary: "S",
    items: [item({ title: "c", area: "claude" }), item({ title: "a" }), item({ title: "f", kind: "duzeltme" }), item({ title: "b", area: "icerik" })],
  };
  const [fresh, improved, fixed] = latestDigest(entry);
  assert.deepEqual(fresh.items.map((i) => i.title), ["a", "b", "c"]);
  assert.equal(improved.items.length, 0);
  assert.deepEqual(fixed.items.map((i) => i.title), ["f"]);
});

test("weekly flow: Monday weeks with no gaps, totals add up, filter keeps the scale", () => {
  assert.equal(weekStart("2026-11-06"), "2026-11-02");
  assert.equal(weekStart("2026-11-02"), "2026-11-02");
  assert.equal(weekStart("2026-11-01"), "2026-10-26");
  const all = changelogEntries("tr", null);
  const weeks = weeklyFlow(all);
  assert.equal(weeks[0].start, weekStart(all.at(-1)!.date));
  assert.equal(weeks.at(-1)!.start, weekStart(all[0].date));
  for (let i = 1; i < weeks.length; i++) {
    assert.equal(Date.parse(weeks[i].start) - Date.parse(weeks[i - 1].start), 7 * 86_400_000, weeks[i].start);
  }
  assert.equal(weeks.reduce((n, w) => n + w.total, 0), kindCounts(all).all);
  assert.equal(weeks.reduce((n, w) => n + w.releases, 0), all.length);
  for (const week of weeks) {
    assert.equal(week.counts.yeni + week.counts.iyilestirme + week.counts.duzeltme, week.total);
    assert.equal(week.matchedTotal, week.total);
    if (week.total > 0) assert.ok(week.anchor && weekStart(week.anchor) === week.start);
  }
  const fixes = weeklyFlow(all, filterEntries(all, "duzeltme"));
  assert.deepEqual(fixes.map((w) => w.total), weeks.map((w) => w.total));
  assert.equal(fixes.reduce((n, w) => n + w.matchedTotal, 0), kindCounts(all).duzeltme);
  for (const week of fixes) {
    assert.equal(week.matched.yeni + week.matched.iyilestirme, 0);
    assert.ok(week.matched.duzeltme <= week.counts.duzeltme);
    if (week.matchedTotal === 0) assert.equal(week.anchor, null);
  }
  assert.deepEqual(weeklyFlow([]), []);
});

test("unseen: compares with the visit baseline; empty storage only marks a fresh latest", () => {
  assert.equal(isUnseen("2026-10-22", "2026-10-10", "2026-10-25", "2026-10-25"), true);
  assert.equal(isUnseen("2026-10-04", "2026-10-10", "2026-10-25", "2026-10-25"), false);
  assert.equal(isUnseen("2026-10-25", "2026-10-25", "2026-10-25", "2026-10-25"), false);
  assert.equal(isUnseen("2026-10-25", null, "2026-10-25", "2026-10-26"), true);
  assert.equal(isUnseen("2026-10-22", null, "2026-10-25", "2026-10-26"), false);
  assert.equal(isUnseen("2026-10-25", null, "2026-10-25", "2026-12-01"), false);
});
