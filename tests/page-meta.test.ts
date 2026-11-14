import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 404'te tek `robots` etiketi (14 Kasım, SEO ikinci tur) — gerekçe
 * `lib/page-meta.ts` → `missingMetadata`. `noindex`i Next basıyor; bizim
 * künyemiz etiket basmıyor. Bu ancak künyeyi döndüren sayfa `notFound()`
 * de çağırıyorsa güvenli: çağırmayan sayfa 200 ve dizine AÇIK kalırdı.
 * Sözleşme burada dosya dosya denetleniyor.
 */

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

test("missingMetadata döndüren her sayfa notFound() da çağırıyor", () => {
  const callers = pages("app").filter((file) => readFileSync(file, "utf8").includes("missingMetadata("));
  assert.ok(callers.length >= 15, `beklenenden az çağıran: ${callers.length}`);
  for (const file of callers) {
    // 404 ekranının kendisi: Next onu yalnız 404 yanıtında çizer.
    if (file.endsWith("not-found.tsx")) continue;
    const source = readFileSync(file, "utf8");
    assert.ok(
      count(source, "notFound()") >= count(source, "missingMetadata("),
      `${file}: missingMetadata var, karşılığı notFound() yok — sayfa 200 ve dizine açık kalır`,
    );
  }
});

test("404 künyeleri kendi robots etiketini basmıyor (miras da kesik)", () => {
  const helper = readFileSync("lib/page-meta.ts", "utf8");
  const body = helper.slice(helper.indexOf("export function missingMetadata"));
  assert.match(body.slice(0, body.indexOf("\n}\n")), /robots: null/);
  assert.match(readFileSync("app/not-found.tsx", "utf8"), /robots: null/);
  assert.doesNotMatch(readFileSync("app/not-found.tsx", "utf8"), /robots: \{/);
});

test("kendi 404 ekranı olan her segment künyesini ortak yardımcıdan alıyor", () => {
  const files = pages("app").filter((file) => file.endsWith("not-found.tsx"));
  assert.ok(files.length >= 6, `beklenenden az 404 dosyası: ${files.length}`);
  for (const file of files) {
    // Panelin 404'ü oturum arkasında ve `noindex` düzeninde (app/admin/layout.tsx).
    if (file.startsWith(join("app", "admin"))) continue;
    const source = readFileSync(file, "utf8");
    assert.ok(
      /notFoundMetadata as generateMetadata|missingMetadata\(|robots: null/.test(source),
      `${file}: künye yok — 404'te kökün "index, follow" etiketi miras alınır`,
    );
  }
});
