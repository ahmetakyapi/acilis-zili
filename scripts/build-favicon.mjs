import { readFile, writeFile } from "node:fs/promises";
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
