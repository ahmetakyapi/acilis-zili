import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/*
 * TABULAR FİGÜR YOK (25 Ekim). Schibsted Grotesk'te `tnum` virgülü ve
 * noktayı da rakam genişliğine çekiyor: "%1,23" ekranda "%1 , 23" diye
 * çıkıyor (ölçüm: 100 px'te virgül 29 → 63 px). Kök bunu kapattı
 * (app/globals.css, "Sayısal okumalar"), ama yeni ekranlar sınıfı tekrar
 * getirdi ve sahibi bulmacada, posterde, olasılıklarda gördü. Bu test
 * yeniden girmesini engeller.
 *
 * İstisna: yalnız ayırıcısı olmayan, yalnız rakamdan oluşan sayaçlar
 * (geri sayım penceresi, takvim günleri) — orada genişlik eşitliği titremeyi
 * önlüyor ve virgül yok.
 */
const ROOTS = ["app", "components", "lib"];
const ALLOWED = new Set(["components/today/Countdown.module.css", "components/ui/DatePicker.module.css", "app/globals.css"]);
const PATTERN = /font-variant-numeric\s*:\s*tabular-nums|["'`\s]tabular-nums["'`\s]|["']tnum["']/;

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(css|tsx?|mjs)$/.test(name)) out.push(path);
  }
}

test("tabular-nums only in digit-only counters", () => {
  const files: string[] = [];
  ROOTS.forEach((root) => walk(root, files));
  const offenders = files
    .filter((file) => !ALLOWED.has(file))
    .flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => PATTERN.test(line) && !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line) && !line.includes("`tabular-nums`"))
        .map(({ index }) => `${file}:${index + 1}`),
    );
  assert.deepEqual(offenders, []);
});
