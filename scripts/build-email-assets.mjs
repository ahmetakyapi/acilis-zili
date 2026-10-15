import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * E-posta görselleri — `public/email/bell-ring.gif` (15 Ekim).
 *
 * NEDEN GIF. Postanın canlı tek öğesi bu: Gmail (web, iOS, Android) CSS
 * animasyonunu ve SVG'yi siliyor, GIF'i her istemci oynatıyor. Apple Mail
 * ayrıca `<style>` içindeki hafif düğme parlamasını da gösteriyor
 * (lib/email-layout.ts) ama posta onsuz da tam.
 *
 * ÇİZİM MARKA İŞARETİNİN KENDİSİ: karo degradesi ve zil geometrisi
 * components/brand/BellMark.tsx ile aynı sayılar. Zil askısından sallanıp
 * sönümleniyor, karonun çevresinden üç halka yayılıyor, sonra uzun bir
 * duraklama — döngü yorucu olmasın diye vuruş 1,4 saniye, sessizlik 3,2.
 *
 * ZEMİN DÜZ RENK (#0b2a5b), saydam değil: GIF'in tek bitlik saydamlığı
 * yumuşak kenarı tırtıklı bırakıyordu. Postadaki kahraman bandı aynı renk,
 * görselin kenarı görünmüyor. Koyu temada Gmail koyu zemini çevirmiyor.
 *
 * Çalıştır:  node scripts/build-email-assets.mjs
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const SIZE = 352; // postada 176 piksel basılıyor (2x)
const BG = "#0b2a5b";
const FPS = 20;
const STRIKE_FRAMES = 29; // 1,45 sn
const REST_MS = 3200;

const BELL = `
    <rect x="118" y="40" width="20" height="16" rx="8"/>
    <path d="M128 58c-27 0-44 20-46 47l-3 37c-1 11-7 18-18 22h134c-11-4-17-11-18-22l-3-37c-2-27-19-47-46-47z"/>
    <rect x="52" y="170" width="152" height="15" rx="7.5"/>`;
const CLAPPER = `<circle cx="128" cy="206" r="13"/>`;

const ease = (x) => 1 - Math.pow(1 - x, 3);

function frame(t) {
  // Sönümlenen salınım; tokmak gövdenin yarı fazında geride kalır.
  const swing = 16 * Math.sin(t * Math.PI * 2 * 2.1) * Math.exp(-t * 2.6);
  const clap = 16 * Math.sin(t * Math.PI * 2 * 2.1 - 0.9) * Math.exp(-t * 2.4);
  const tile = 152; // karonun kenarı
  const c = SIZE / 2;
  const rings = [0, 0.22, 0.44]
    .map((start) => {
      const p = (t - start) / 0.95;
      if (p <= 0 || p >= 1) return "";
      const r = tile * 0.62 + ease(p) * (SIZE * 0.5 - tile * 0.62 - 6);
      const o = (1 - p) * 0.55;
      return `<circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none" stroke="#5cc4ff" stroke-opacity="${o.toFixed(3)}" stroke-width="${(3 - p * 1.6).toFixed(2)}"/>`;
    })
    .join("");
  const x = c - tile / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="tile" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0" stop-color="#5cc4ff"/><stop offset=".48" stop-color="#1f86e0"/><stop offset="1" stop-color="#0b3f86"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#1f86e0" stop-opacity=".35"/><stop offset="1" stop-color="#1f86e0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
  <circle cx="${c}" cy="${c}" r="${SIZE * 0.46}" fill="url(#halo)"/>
  ${rings}
  <g transform="translate(${x} ${x})">
    <rect width="${tile}" height="${tile}" rx="${tile / 3}" fill="url(#tile)"/>
    <rect width="${tile}" height="${tile}" rx="${tile / 3}" fill="url(#gloss)"/>
    <rect x="1.5" y="1.5" width="${tile - 3}" height="${tile - 3}" rx="${tile / 3 - 1.5}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>
    <svg width="${tile}" height="${tile}" viewBox="-11.13 -15.13 278.26 278.26" fill="#ffffff">
      <g transform="rotate(${clap.toFixed(2)} 128 40)">${CLAPPER}</g>
      <g transform="rotate(${swing.toFixed(2)} 128 40)">${BELL}</g>
    </svg>
  </g>
</svg>`;
}

const frames = [];
for (let i = 0; i < STRIKE_FRAMES; i += 1) frames.push(frame(i / FPS));
frames.push(frame(STRIKE_FRAMES / FPS + 2)); // dinlenme karesi: zil durgun

const buffers = await Promise.all(
  frames.map((svg) => sharp(Buffer.from(svg)).png().toBuffer()),
);
const delay = [...Array(STRIKE_FRAMES).fill(1000 / FPS), REST_MS].map(Math.round);
const gif = await sharp(buffers, { join: { animated: true } })
  .gif({ delay, loop: 0, effort: 10, colours: 64, dither: 0 })
  .toBuffer();

await mkdir(path.join(ROOT, "public/email"), { recursive: true });
await writeFile(path.join(ROOT, "public/email/bell-ring.gif"), gif);
// Durgun kare ayrı: önizleme ve GIF oynatmayan istemciler (Outlook masaüstü
// ilk kareyi gösterir — ilk kare zaten durgun zil).
console.log(`bell-ring.gif yazıldı — ${frames.length} kare, ${(gif.length / 1024).toFixed(1)} KB`);
