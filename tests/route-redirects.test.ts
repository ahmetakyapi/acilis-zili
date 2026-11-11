import test from "node:test";
import assert from "node:assert/strict";
import { RENAMED_ROUTES, legacyRedirects, legacyTarget } from "../lib/route-redirects";

/* Eski adreslerin kalıcı yönlendirmesi (11 Kasım). Kurallar
   `next.config.ts → redirects()`e bu modülden gidiyor; burada hem saf
   çeviri hem de kural listesinin şekli sınanıyor. */

test("bare old names go to the new names", () => {
  assert.equal(legacyTarget("/gun"), "/seans-silueti");
  assert.equal(legacyTarget("/teknik"), "/teknik-analiz");
  assert.equal(legacyTarget("/tema"), "/temalar");
  assert.equal(legacyTarget("/raporum"), "/zil-raporu");
  assert.equal(legacyTarget("/risk"), "/risk-masasi");
});

test("sub-paths are kept, share image paths included", () => {
  assert.equal(legacyTarget("/gun/2026-11-10"), "/seans-silueti/2026-11-10");
  assert.equal(legacyTarget("/gun/2026-11-10/kart"), "/seans-silueti/2026-11-10/kart");
  assert.equal(legacyTarget("/gun/bugun/kart"), "/seans-silueti/bugun/kart");
  assert.equal(legacyTarget("/gun/2026-11-10/gorsel"), "/seans-silueti/2026-11-10/gorsel");
  assert.equal(legacyTarget("/gun/2026-11-10/minyatur/koyu"), "/seans-silueti/2026-11-10/minyatur/koyu");
  assert.equal(legacyTarget("/teknik/nvda"), "/teknik-analiz/nvda");
  assert.equal(legacyTarget("/tema/yapay-zeka"), "/temalar/yapay-zeka");
  assert.equal(legacyTarget("/u/ahmet"), "/uye/ahmet");
});

test("EN prefix is preserved", () => {
  assert.equal(legacyTarget("/en/gun"), "/en/seans-silueti");
  assert.equal(legacyTarget("/en/gun/2026-11-10/kart"), "/en/seans-silueti/2026-11-10/kart");
  assert.equal(legacyTarget("/en/teknik/mu"), "/en/teknik-analiz/mu");
  assert.equal(legacyTarget("/en/u/ahmet"), "/en/uye/ahmet");
  assert.equal(legacyTarget("/en/raporum"), "/en/zil-raporu");
});

test("query string and hash are carried", () => {
  assert.equal(legacyTarget("/gun/2026-11-10/kart?bicim=dikey"), "/seans-silueti/2026-11-10/kart?bicim=dikey");
  assert.equal(legacyTarget("/en/tema?sira=medyan#liste"), "/en/temalar?sira=medyan#liste");
});

test("look-alike and untouched paths are not redirected", () => {
  for (const path of [
    "/gunun-grafigi",
    "/gunun-grafigi/2026-11-10",
    "/api/teknik",
    "/api/cron/risk",
    "/teknik-analiz",
    "/temalar/yapay-zeka",
    "/uye/ahmet",
    "/u",
    "/en",
    "/",
    "/en/piyasalar",
    "/risk-masasi",
  ]) {
    assert.equal(legacyTarget(path), path === "/u" ? "/uye" : null, path);
  }
});

test("config rules: four permanent rules per renamed route, TR and EN", () => {
  const rules = legacyRedirects();
  assert.equal(rules.length, RENAMED_ROUTES.length * 4);
  assert.ok(rules.every((r) => r.permanent === true));
  const by = new Map(rules.map((r) => [r.source, r.destination]));
  assert.equal(by.get("/gun"), "/seans-silueti");
  assert.equal(by.get("/gun/:path*"), "/seans-silueti/:path*");
  assert.equal(by.get("/en/gun"), "/en/seans-silueti");
  assert.equal(by.get("/en/gun/:path*"), "/en/seans-silueti/:path*");
  assert.ok(!rules.some((r) => r.source.startsWith("/api")));
});

test("new names never collide with an old name (no redirect loop)", () => {
  for (const { to } of RENAMED_ROUTES) {
    assert.equal(legacyTarget(to), null, to);
    assert.equal(legacyTarget(`${to}/x`), null, to);
  }
});
