#!/usr/bin/env node
/**
 * iCloud çakışma kopyalarını siler.
 *
 * NEDEN VAR. Bu depo iCloud Drive'a bağlı bir klasörde duruyor (Masaüstü
 * senkronu). Senkron bir dosyayı iki yerde değişmiş görünce ikinci bir kopya
 * bırakıyor: "alpaca 2.ts", "routes.d 5.ts", ".gitignore 3". Kopyalar eski
 * sürüm taşır ve hiçbir yerden import edilmez — ama `.next/types` altına
 * düştüklerinde TypeScript onları da okuyor ve derleme şu hatayla kırılıyor:
 *
 *   TS6200: Definitions of the following identifiers conflict with those in
 *   another file: unstable_cache, revalidateTag, …
 *
 * Hata koddan gelmiyor, dosya sisteminden geliyor; bu yüzden `typecheck` ve
 * `build` öncesinde bir kez süpürülüyorlar. tsconfig `exclude` denendi ve
 * yetmedi: boşluk içeren desenlerde güvenilir eşleşmiyor.
 *
 * ASIL ÇÖZÜM KAYNAKTA: Sistem Ayarları → Apple Hesabı → iCloud →
 * iCloud Drive → "Masaüstü ve Belgeler Klasörleri" kapatılırsa kopyalar hiç
 * oluşmaz. Bu betik o zamana kadarki güvenlik ağı.
 *
 * Betik ASLA hata döndürmez: derlemeyi bu yüzden durdurmak istemiyoruz.
 */

import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

/** "alpaca 2.ts", "routes.d 5.ts", ".gitignore 3" — sondaki " N" eki. */
const DUPLICATE = /\s\d+(\.[^.]+)?$/;
const SKIP = new Set(["node_modules", ".git"]);

let removed = 0;

async function sweep(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // okunamayan dizin sessizce geçilir
  }

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);

    if (DUPLICATE.test(entry.name)) {
      try {
        await rm(path, { recursive: true, force: true });
        removed++;
      } catch {
        // silinemiyorsa bırak; kopya derlemeyi kırsa bile veri kaybı yok
      }
      continue;
    }

    if (entry.isDirectory()) await sweep(path);
  }
}

await sweep(process.cwd());

if (removed > 0) {
  console.log(`iCloud çakışma kopyası temizlendi: ${removed} dosya`);
}
