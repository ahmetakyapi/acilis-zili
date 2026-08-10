/**
 * Şirket logolarını depoya indirir.
 *
 * NEDEN KENDİMİZ BARINDIRIYORUZ. Logolar Finnhub'dan geliyordu ve her biri
 * `next/image` üzerinden Vercel'in görsel iyileştiricisine düşüyordu. 671
 * sembol × 2 genişlik, üstelik kaynak `cache-control: no-store` yolladığı
 * için önbellek ömrünü tek başımıza taşıyorduk. Ücretsiz kota bir ayda
 * doldu ve iyileştirici HTTP 402 (`OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`)
 * dönmeye başladı: yeni dönüşüm isteyen her logo ekranda KIRIK göründü —
 * NVDA duruyordu, GOOGL yoktu. Bir ölçüm sayfasında büyük şirketlerin
 * logosunun eksik olması kabul edilebilir bir bozulma değil.
 *
 * Kota her ay yenileniyor ama çözüm o değil: aynı duvara yeniden çarpardık.
 * Logolar durağan marka varlıkları — ayda bir değişmiyorlar, yılda bir bile
 * zor. Depoda durup CDN'den statik dosya olarak servis edilmeleri hem
 * ücretsiz hem anlık, hem de hiçbir kotaya bağlı değil.
 *
 * TEK BOY, 128 piksel. Ekrandaki en büyük yuva 64 piksel (hisse sayfası
 * künyesi); 128 onu retinada da karşılıyor. İki boy (64 + 128) üretmek dosya
 * sayısını ikiye katlarken kazandırdığı şey, 26 piksellik hücrelerde
 * yaklaşık yarım kilobayt — sürüm geçmişinde taşımaya değmiyor.
 *
 * Manifest bir TS dosyası olarak yazılıyor: sunucu çalışırken dosya sistemine
 * bakmıyor (serverless'ta `public/` okunamaz), hangi sembolün yerel logosu
 * olduğunu derlenmiş bir kümeden öğreniyor.
 *
 * Koşum:  npm run build:logos
 * Sonrası: yeni sembol eklendiğinde tekrar çalıştır. Manifeste girmemiş
 *          sembol kırık görünmüyor, kaynaktaki adrese düşüyor.
 */

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { neon } from "@neondatabase/serverless";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "logos");
const MANIFEST = path.join(ROOT, "lib", "logo-manifest.ts");

/** Ekrandaki en büyük yuva 64px; 128 retinada onu da karşılıyor. */
const SIZE = 128;
/** Sağlayıcı arka arkaya yüzlerce istekte yavaşlıyor; ölçülü paralellik. */
const CONCURRENCY = 8;

async function databaseUrl() {
  const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error(".env.local içinde DATABASE_URL yok");
  return match[1].trim().replace(/^["']|["']$/g, "");
}

async function fetchLogo(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const sql = neon(await databaseUrl());
  const rows = await sql`
    select symbol, logo_url from symbols
    where logo_url is not null and logo_url <> ''
    order by symbol
  `;
  await mkdir(OUT_DIR, { recursive: true });

  /* Zaten indirilmiş olanlar atlanıyor: betik yeni sembol eklendiğinde
     tekrar koşuyor ve altı yüz dosyayı yeniden çekmesi için sebep yok. */
  const varOlan = new Set(
    (await readdir(OUT_DIR).catch(() => []))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.replace(/\.webp$/, "")),
  );

  const basarili = [...varOlan];
  const hatalar = [];
  const kuyruk = rows.filter((r) => !varOlan.has(r.symbol));
  console.log(
    `${rows.length} sembol · ${varOlan.size} zaten var · ${kuyruk.length} indirilecek`,
  );

  let index = 0;
  async function worker() {
    while (index < kuyruk.length) {
      const row = kuyruk[index++];
      try {
        const raw = await fetchLogo(row.logo_url);
        /* `contain` + saydam zemin: logolar kare değil ve `cover` kenardan
           kırpıyordu — bir markanın kelime işaretinin yarısı kesiliyordu. */
        const webp = await sharp(raw)
          .resize(SIZE, SIZE, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .webp({ quality: 82 })
          .toBuffer();
        await writeFile(path.join(OUT_DIR, `${row.symbol}.webp`), webp);
        basarili.push(row.symbol);
      } catch (error) {
        hatalar.push(`${row.symbol}: ${error.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker()),
  );

  basarili.sort();
  const liste = basarili.map((s) => `  "${s}",`).join("\n");
  await writeFile(
    MANIFEST,
    `/* ÜRETİLEN DOSYA — elle düzenleme. Kaynak: scripts/build-logos.mjs\n` +
      `   Yerel logosu olan semboller; dosyalar public/logos/{SEMBOL}.webp.\n` +
      `   Gerekçe betiğin başında. */\n\n` +
      `export const LOCAL_LOGOS: ReadonlySet<string> = new Set([\n${liste}\n]);\n`,
    "utf8",
  );

  console.log(`yazıldı: ${basarili.length} logo · manifest güncellendi`);
  if (hatalar.length > 0) {
    console.log(`indirilemedi (${hatalar.length}):`);
    for (const h of hatalar.slice(0, 12)) console.log("  ", h);
  }
}

await main();
