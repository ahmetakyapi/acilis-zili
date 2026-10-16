import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * E-posta görselleri — `public/email/hero.gif` (15 Ekim; 16 Ekim'de geniş bant).
 *
 * NEDEN GIF. Postanın canlı tek öğesi bu: Gmail (web, iOS, Android) CSS
 * animasyonunu ve SVG'yi siliyor, GIF'i her istemci oynatıyor. Apple Mail
 * ayrıca `<style>` içindeki düğme parlamasını da gösteriyor
 * (lib/email-layout.ts) ama posta onsuz da tam.
 *
 * NEDEN KENARDAN KENARA BANT (16 Ekim). İlk sürüm koyu lacivert bir bandın
 * ortasında 176 piksellik kare bir GIF'ti ve başlık bandın içindeydi. Gmail
 * iOS koyu temada sayfayı TAM ters çeviriyor: bant açılıyor, GIF çevrilmiyor
 * — bandın ortasında koyu bir kare kalıyordu. Artık GIF bandın KENDİSİ,
 * başlık kartın içinde: ters çeviren istemcide kart kararıyor, bant zaten
 * koyu. Her istemcide aynı görüntü.
 *
 * SAHNE: zil vuruyor, sesi iki yana ince bir şerit üzerinde sönümlenen dalga
 * olarak yayılıyor — açılış zilinin piyasayı uyandırması. Karonun çevresinde
 * halka YOK: ölçüldü, üç halka halo degradesinin üstünden geçerken dosyaya
 * ~150 KB ekliyordu ve sesi zaten dalga anlatıyor (2x, 16 kare/sn: 200 KB;
 * eski 176 piksellik kare GIF 256 KB'tı). Şerit pirinç
 * (`--brass` ailesi): sitede mürekkep sahnelerinin rengi, mavi değil (mavi
 * etkileşimdir). Halka ve karo marka işaretinin kendisi: degrade ve zil
 * geometrisi components/brand/BellMark.tsx ile aynı sayılar.
 *
 * İLK KARE DURGUN AFİŞ. Outlook masaüstü GIF oynatmaz, ilk kareyi gösterir;
 * Gmail önizlemesi de öyle. İlk kare = son kare = zil durgun, şerit düz.
 * BİR KEZ OYNAR, afişte durur (`loop: 1`): sitenin sahne kuralı ("sahne
 * dönmez, bir kez oynar") ve WCAG 2.2.2 — kendiliğinden başlayıp 5 saniyeyi
 * aşan hareket durdurulabilir olmalı; GIF hareketi azaltma tercihini de
 * okuyamıyor. Hareket ~2,1 sn.
 *
 * ZEMİN DÜZ RENK (#0b2a5b): GIF'in tek bitlik saydamlığı yumuşak kenarı
 * tırtıklı bırakır. Boyut her üretimde basılıyor; 250 KB'ı geçerse
 * sahne ağırlaşmış demektir (mobil veride posta bununla açılıyor).
 *
 * Çalıştır:  npm run build:email
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const SCALE = 2; // postada 560×220 basılıyor
const W = 560 * SCALE;
const H = 220 * SCALE;
const BG = "#0b2a5b";
const BRASS = "#d9a54a"; // --brass'ın koyu zemindeki açık kademesi (zeminde 6,3:1)
const LANE = "#24467f"; // dinlenen şerit: zeminin açık kademesi, gri değil
const FPS = 16;
const ACTIVE_S = 2.1; // vuruş + dalganın kenara varışı
const POSTER_MS = 900; // döngü başında, vuruştan önce
const REST_MS = 2600; // vuruştan sonra, döngü dönmeden

const BELL = `
    <rect x="118" y="40" width="20" height="16" rx="8"/>
    <path d="M128 58c-27 0-44 20-46 47l-3 37c-1 11-7 18-18 22h134c-11-4-17-11-18-22l-3-37c-2-27-19-47-46-47z"/>
    <rect x="52" y="170" width="152" height="15" rx="7.5"/>`;
const CLAPPER = `<circle cx="128" cy="206" r="13"/>`;

const ease = (x) => 1 - Math.pow(1 - x, 3);
const mix = (a, b, f) => {
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * f).toString(16).padStart(2, "0")).join("")}`;
};
const TILE = 92 * SCALE;
const CX = W / 2;
const CY = H / 2;
const GAP = 34 * SCALE; // karo kenarından dalganın başladığı yer
const EDGE = 40 * SCALE; // şerit kenara değmez: uçtaki nokta kesilmesin
const REACH = CX - TILE / 2 - GAP - EDGE; // dalganın şerit ucuna kadar yolu

/* Dalga: kenara doğru ilerleyen sönümlü bir paket. r = karodan uzaklık. */
function wave(r, t) {
  if (t <= 0) return 0;
  const front = 1.05 * REACH * ease(Math.min(1, t / 1.55));
  const sigma = 64 * SCALE;
  const env = Math.exp(-(((r - front) / sigma) ** 2)) * Math.exp(-t / 1.35) * Math.exp(-r / (900 * SCALE));
  const k = (2 * Math.PI) / (34 * SCALE);
  return 15 * SCALE * env * Math.sin(k * r - 15 * t);
}
function envelope(r, t) {
  if (t <= 0) return 0;
  const front = 1.05 * REACH * ease(Math.min(1, t / 1.55));
  const sigma = 64 * SCALE;
  return Math.exp(-(((r - front) / sigma) ** 2)) * Math.exp(-t / 1.35);
}

function side(t, dir) {
  const x0 = CX + dir * (TILE / 2 + GAP);
  const pts = [];
  const STEP = 3;
  for (let r = 0; r <= REACH + STEP; r += STEP) {
    const x = x0 + dir * r;
    pts.push(`${x.toFixed(1)},${(CY + wave(r, t)).toFixed(1)}`);
  }
  /* Parlaklık dalgayla gelir: şerit dinlenirken soluk, paket geçerken dolu. */
  const stops = [];
  for (let i = 0; i <= 24; i += 1) {
    const r = (REACH * i) / 24;
    /* Karışım eğriyle: düz karışım lacivertle pirincin ortasında griye
       düşüyor; kare kök ara tonu kısaltıyor. */
    const f = Math.sqrt(Math.min(1, envelope(r, t) * 2.2));
    stops.push(`<stop offset="${(i / 24).toFixed(3)}" stop-color="${mix(LANE, BRASS, f)}"/>`);
  }
  const id = dir < 0 ? "wl" : "wr";
  const x2 = x0 + dir * REACH;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x2}" y2="0">${stops.join("")}</linearGradient>
  <polyline points="${pts.join(" ")}" fill="none" stroke="url(#${id})" stroke-width="${2.2 * SCALE}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x2.toFixed(1)}" cy="${CY}" r="${3.5 * SCALE}" fill="${BRASS}"/>`;
}

/* Zaman çentikleri — şeridin altında, durgun: fiyat bandının ekseni gibi. */
const TICKS = [-1, 1]
  .flatMap((dir) =>
    Array.from({ length: 9 }, (_, i) => {
      const x = CX + dir * (TILE / 2 + GAP + ((i + 1) * REACH) / 9);
      const tall = i % 3 === 2;
      return `<rect x="${(x - SCALE / 2).toFixed(1)}" y="${CY + 16 * SCALE}" width="${SCALE}" height="${(tall ? 7 : 4) * SCALE}" fill="${LANE}"/>`;
    }),
  )
  .join("");

function frame(t) {
  const swing = t > 0 ? 15 * Math.sin(t * Math.PI * 2 * 2.1) * Math.exp(-t * 2.5) : 0;
  const clap = t > 0 ? 15 * Math.sin(t * Math.PI * 2 * 2.1 - 0.9) * Math.exp(-t * 2.3) : 0;
  const x = CX - TILE / 2;
  const y = CY - TILE / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="tile" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0" stop-color="#5cc4ff"/><stop offset=".48" stop-color="#1f86e0"/><stop offset="1" stop-color="#0b3f86"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#1f86e0" stop-opacity=".32"/><stop offset="1" stop-color="#1f86e0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <circle cx="${CX}" cy="${CY}" r="${H * 0.48}" fill="url(#halo)"/>
  ${TICKS}
  ${side(t, -1)}
  ${side(t, 1)}
  <g transform="translate(${x} ${y})">
    <rect width="${TILE}" height="${TILE}" rx="${TILE / 3}" fill="url(#tile)"/>
    <rect width="${TILE}" height="${TILE}" rx="${TILE / 3}" fill="url(#gloss)"/>
    <rect x="1.5" y="1.5" width="${TILE - 3}" height="${TILE - 3}" rx="${TILE / 3 - 1.5}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>
    <svg width="${TILE}" height="${TILE}" viewBox="-11.13 -15.13 278.26 278.26" fill="#ffffff">
      <g transform="rotate(${clap.toFixed(2)} 128 40)">${CLAPPER}</g>
      <g transform="rotate(${swing.toFixed(2)} 128 40)">${BELL}</g>
    </svg>
  </g>
</svg>`;
}

const ACTIVE = Math.round(ACTIVE_S * FPS);
const frames = [frame(0)];
for (let i = 1; i <= ACTIVE; i += 1) frames.push(frame(i / FPS));
frames.push(frame(0)); // dinlenme = afiş: zil durgun, şerit düz

const buffers = await Promise.all(frames.map((svg) => sharp(Buffer.from(svg)).png().toBuffer()));
const delay = [POSTER_MS, ...Array(ACTIVE).fill(1000 / FPS), REST_MS].map(Math.round);
const gif = await sharp(buffers, { join: { animated: true } })
  .gif({ delay, loop: 1, effort: 10, colours: 48, dither: 0, interFrameMaxError: 6, interPaletteMaxError: 4 })
  .toBuffer();

await mkdir(path.join(ROOT, "public/email"), { recursive: true });
await writeFile(path.join(ROOT, "public/email/hero.gif"), gif);
/* Eski kare GIF (176×176, 15 Ekim) — yeni şablon onu kullanmıyor. Sıfırlama
   bağlantısı 30 dakikada ölüyor; eski postanın görseli tutulmuyor. */
await rm(path.join(ROOT, "public/email/bell-ring.gif"), { force: true });
console.log(`hero.gif yazıldı — ${frames.length} kare, ${W}×${H}, ${(gif.length / 1024).toFixed(1)} KB`);
