import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * `app/favicon.ico` üretici — kaynağı `app/icon.svg`.
 *
 * NEDEN BİR SCRIPT. .ico ikili bir dosya, elle düzenlenemiyor ve depoda
 * duruyor. Zil geometrisi ya da karo degradesi değiştiğinde SVG güncelleniyor
 * ama .ico eski çizimi taşımaya devam ediyordu: sekmede bir işaret, ana
 * ekranda başka bir işaret. Bu script ikisini tek kaynağa bağlar.
 *
 * NEDEN HÂLÂ .ico. Next `app/icon.svg`'yi zaten servis ediyor ve modern
 * tarayıcılar SVG faviconu okuyor. Ama arama motorlarının bir kısmı, RSS
 * okuyucular ve Windows kısayolları hâlâ kökteki `favicon.ico`'yu istiyor;
 * yoksa 404 basıyorlar.
 *
 * Üç boyut: 16 (sekme), 32 (sekme, retina + yer imi), 48 (Windows kısayolu).
 * Daha büyüğü .ico içinde yer kaplıyor ve hiçbir yerde kullanılmıyor —
 * o boyutlarda apple-icon ve icon.svg devrede.
 *
 * Çalıştır:  node scripts/build-favicon.mjs
 */

const SIZES = [16, 32, 48];
const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Android / PWA ikonları.
 *
 * `manifest.ts` yalnızca `icon.svg` ve apple ikonunu listeliyordu. Chrome'un
 * kurulum ölçütü PNG istiyor ve en az 192 ile 512 arıyor; ikisi de yoksa
 * "ana ekrana ekle" istemi hiç çıkmıyor, elle eklendiğinde de sistem
 * kendi ürettiği bulanık bir kopyayı kullanıyor.
 *
 * MASKELİ SÜRÜM AYRI. Android ikonu kendi şekliyle kırpıyor (daire, kare,
 * damla — üreticiye göre değişiyor) ve güvenli alan yalnızca ortadaki %80'lik
 * daire. Yuvarlatılmış karomuzu gönderirsek köşeler kırpılıp kenarda saydam
 * bir ısırık kalıyor. Maskeli sürüm bu yüzden TAM TAŞMA degrade ve zil bir
 * kademe küçük — kırpma nereden gelirse gelsin zil güvenli dairenin içinde.
 */
const PWA_SIZES = [192, 512];

/** Zil geometrisi — components/brand/BellMark.tsx ile birebir aynı. */
const BELL = `
  <circle cx="128" cy="50" r="11"/>
  <path d="M128 68c-30 0-53 24-53 54v33h106v-33c0-30-23-54-53-54z"/>
  <rect x="56" y="159" width="144" height="16" rx="8"/>
  <circle cx="128" cy="196" r="12"/>`;

/** Maskeli ikon: köşe yuvarlama YOK, zil güvenli dairenin içinde (%50). */
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="tile" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0" stop-color="#6fd0ff"/>
      <stop offset="0.46" stop-color="#2f95e8"/>
      <stop offset="1" stop-color="#124f9e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#tile)"/>
  <svg x="128" y="128" width="256" height="256" viewBox="35 31 186 186" fill="#ffffff">${BELL}
  </svg>
</svg>`;

/** ICO kapsayıcısı: 6 baytlık başlık + boyut başına 16 baytlık dizin girdisi. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // ayrılmış
  header.writeUInt16LE(1, 2); // tür: 1 = ikon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;

  images.forEach((image, index) => {
    const entry = index * 16;
    // 256 piksel, ICO'da 0 olarak yazılır — alan tek bayt.
    directory[entry] = image.size >= 256 ? 0 : image.size;
    directory[entry + 1] = image.size >= 256 ? 0 : image.size;
    directory[entry + 2] = 0; // palet rengi yok
    directory[entry + 3] = 0; // ayrılmış
    directory.writeUInt16LE(1, entry + 4); // renk düzlemi
    directory.writeUInt16LE(32, entry + 6); // bit derinliği
    directory.writeUInt32LE(image.data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.data.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.data)]);
}

const svg = await readFile(path.join(ROOT, "app/icon.svg"));

const images = await Promise.all(
  SIZES.map(async (size) => ({
    size,
    // density: sharp SVG'yi vektör olarak ölçekler; küçük boyutta bulanıklaşmasın
    // diye hedef boyutun katında rasterleştirilip indiriliyor.
    data: await sharp(svg, { density: 384 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  })),
);

await writeFile(path.join(ROOT, "app/favicon.ico"), buildIco(images));

console.log(
  `favicon.ico yazıldı — ${SIZES.join(", ")} px (${images
    .map((i) => `${i.size}:${i.data.length}B`)
    .join(" · ")})`,
);

/* ---- PWA ikonları ---- */
// public/ depoda boş duramıyor (git boş dizin tutmaz); script kendi açar.
await mkdir(path.join(ROOT, "public"), { recursive: true });
for (const size of PWA_SIZES) {
  const file = `public/icon-${size}.png`;
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, file));
  console.log(`${file} yazıldı`);
}

for (const size of PWA_SIZES) {
  const file = `public/icon-maskable-${size}.png`;
  await sharp(Buffer.from(MASKABLE_SVG), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, file));
  console.log(`${file} yazıldı`);
}
