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

/**
 * Windows'un rezerve cihaz adları. Bu adlarda dosya OLUŞTURULAMIYOR —
 * uzantı eklemek de kurtarmıyor, `CON.webp` de yasak.
 *
 * CON gerçek bir sembol (Concentra Group) ve `public/logos/CON.webp` bir
 * süre depoda öylece durdu: Linux'ta ve CI'da sorun çıkarmadı, deploy da
 * aldı. Windows'ta ise depoyu KLONLANAMAZ yaptı — `git clone` bütün objeleri
 * indirdikten sonra checkout aşamasında `invalid path` ile düşüyor ve geriye
 * çalışan ağaç yerine boş bir dizin kalıyor. Tek bir logonun eksikliği değil,
 * projeye hiç girilememesi.
 *
 * Rezerve adlı semboller diske sonuna alt çizgi eklenerek yazılıyor
 * (`CON` → `CON_.webp`). Sembolün kendisi değişmiyor: eşleme manifeste
 * giriyor, adresi `logoSrc()` oradan kuruyor.
 */
const RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

/**
 * Sembolün diskteki dosya adı, uzantısız.
 *
 * Alt çizgiyle biten sembol de kaçırılıyor, yoksa eşleme tersine çevrilemez
 * olurdu: `CON_` diye bir sembol `CON`la AYNI dosyaya yazar ve biri diğerini
 * sessizce ezerdi. Böyle bir ticker yok, ama kaçış iki koşula bakıyor ve
 * karşılığında dosya adı ↔ sembol birebir kalıyor — kodlanan her ad alt
 * çizgiyle biter, kodlanmayan hiçbiri bitmez.
 */
function logoFileName(symbol) {
  const kacisGerek =
    RESERVED_NAMES.has(symbol.toUpperCase()) || symbol.endsWith("_");
  return kacisGerek ? `${symbol}_` : symbol;
}

/** `logoFileName`in tersi: dosya adından sembole. */
function logoSymbol(fileName) {
  if (!fileName.endsWith("_")) return fileName;
  const stripped = fileName.slice(0, -1);
  return RESERVED_NAMES.has(stripped.toUpperCase()) || stripped.endsWith("_")
    ? stripped
    : fileName;
}

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
      .map((f) => logoSymbol(f.replace(/\.webp$/, ""))),
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
        await writeFile(
          path.join(OUT_DIR, `${logoFileName(row.symbol)}.webp`),
          webp,
        );
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
  /* Neredeyse her sembolün dosya adı kendisi; eşlemeye yalnızca istisnalar
     giriyor, altı yüz satırlık ikinci bir liste değil. */
  const esleme = basarili
    .filter((s) => logoFileName(s) !== s)
    .map((s) => `  ["${s}", "${logoFileName(s)}"],`)
    .join("\n");
  await writeFile(
    MANIFEST,
    `/* ÜRETİLEN DOSYA — elle düzenleme. Kaynak: scripts/build-logos.mjs\n` +
      `   Yerel logosu olan semboller; dosyalar public/logos/{SEMBOL}.webp.\n` +
      `   LOGO_FILE_OVERRIDES'takiler istisna: adları Windows'ta rezerve\n` +
      `   olduğu için dosyaları başka adla duruyor.\n` +
      `   Gerekçe betiğin başında. */\n\n` +
      `export const LOCAL_LOGOS: ReadonlySet<string> = new Set([\n${liste}\n]);\n\n` +
      `export const LOGO_FILE_OVERRIDES: ReadonlyMap<string, string> = new Map([\n${esleme}\n]);\n`,
    "utf8",
  );

  console.log(`yazıldı: ${basarili.length} logo · manifest güncellendi`);
  if (hatalar.length > 0) {
    console.log(`indirilemedi (${hatalar.length}):`);
    for (const h of hatalar.slice(0, 12)) console.log("  ", h);
  }
}

await main();
