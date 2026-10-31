import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";
import {
  PREVIEW_PARAM,
  normalizePreviewInput,
  previewPathError,
  previewSrc,
  splitPreviewLocale,
} from "../lib/preview";

/** Cihaz önizlemesi — yol denetimi, çerçeve adresi ve çerçeve başlıkları (lib/preview.ts). */

test("tam adres yola indirgenir, kök bilgisi atılır", () => {
  assert.equal(normalizePreviewInput("https://evil.example/mercek/x?a=1"), "/mercek/x?a=1");
  assert.equal(normalizePreviewInput("piyasalar"), "/piyasalar");
  assert.equal(normalizePreviewInput("  "), "/");
});

test("dil öneki ayrılır", () => {
  assert.deepEqual(splitPreviewLocale("/en/piyasalar"), { locale: "en", path: "/piyasalar" });
  assert.deepEqual(splitPreviewLocale("/en"), { locale: "en", path: "/" });
  assert.deepEqual(splitPreviewLocale("/enerji"), { locale: null, path: "/enerji" });
});

test("yönetim, API ve site dışı yollar önizlenmez", () => {
  assert.equal(previewPathError("/mercek/x"), null);
  assert.equal(previewPathError("/"), null);
  for (const bad of ["/admin", "/admin/uyeler", "/API/olcum", "/_next/static/x", "//evil.example", "/a\\b", "/a b"]) {
    assert.notEqual(previewPathError(bad), null, bad);
  }
  assert.notEqual(previewPathError(`/${"x".repeat(400)}`), null);
});

test("çerçeve adresi dil öneki, işaret ve tema taşır; yolun sorgusu korunur", () => {
  assert.equal(previewSrc("/", { locale: "tr", theme: "acik" }), "/?onizleme=1&tema=acik");
  assert.equal(previewSrc("/", { locale: "en", theme: "koyu" }), "/en?onizleme=1&tema=koyu");
  assert.equal(
    previewSrc("/bulten/2026-10-30?tur=x&onizleme=0#bas", { locale: "en", theme: "acik" }),
    "/en/bulten/2026-10-30?tur=x&onizleme=1&tema=acik#bas",
  );
});

type Rule = {
  source: string;
  has?: { type: string; key: string }[];
  missing?: { type: string; key: string }[];
  headers: { key: string; value: string }[];
};

test("çerçeve başlıkları: her site isteği tam bir kural alır, önizleme yalnız aynı köke açılır", async () => {
  const rules = (await nextConfig.headers!()) as Rule[];
  const framing = rules.filter((r) => r.headers.some((h) => h.key === "Content-Security-Policy"));
  const csp = (r: Rule) => r.headers.find((h) => h.key === "Content-Security-Policy")?.value;
  const xfo = (r: Rule) => r.headers.find((h) => h.key === "X-Frame-Options")?.value;

  const deny = framing.find((r) => r.missing?.some((m) => m.key === PREVIEW_PARAM));
  const preview = framing.find((r) => r.has?.some((m) => m.key === PREVIEW_PARAM));
  assert.ok(deny && preview);
  assert.equal(deny.source, preview.source, "çift aynı yol kümesini kapsamalı");
  assert.equal(csp(deny), "frame-ancestors 'none'");
  assert.equal(xfo(deny), "DENY");
  assert.equal(csp(preview), "frame-ancestors 'self'");
  assert.equal(xfo(preview), "SAMEORIGIN");
  /* Tek koşul: ikinci bir koşul `missing`in "hiçbiri yoksa" anlamıyla
     arada başlıksız bir küme bırakırdı. */
  assert.equal(deny.missing?.length, 1);
  assert.equal(preview.has?.length, 1);
  assert.equal(deny.has, undefined);
  assert.equal(preview.missing, undefined);

  /* Gömülü parçalar değişmedi. */
  const embed = framing.filter((r) => r.source.includes("gomulu/:path"));
  assert.equal(embed.length, 2);
  for (const r of embed) assert.equal(csp(r), "frame-ancestors *");
});
