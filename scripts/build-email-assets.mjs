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
 * Pazar özetinin bandı da burada (weekly.gif — gerekçe dosyanın sonunda).
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
await buildWeekly();
/* Eski kare GIF (176×176, 15 Ekim) — yeni şablon onu kullanmıyor. Sıfırlama
   bağlantısı 30 dakikada ölüyor; eski postanın görseli tutulmuyor. */
await rm(path.join(ROOT, "public/email/bell-ring.gif"), { force: true });
console.log(`hero.gif yazıldı — ${frames.length} kare, ${W}×${H}, ${(gif.length / 1024).toFixed(1)} KB`);

/* ==========================================================================
   PAZAR ÖZETİNİN BANDI — public/email/weekly.gif (17 Ekim), 560×200.

   SAHNE: bir hafta şeridi. Solda geride kalan haftanın beş günü (dolu
   pirinç noktalar), ortada zil karosu, sağda yeni haftanın beş günü (boş
   halkalar). Bir ışık soldan beş günün üstünden geçip zile varıyor, zil
   vuruyor, ışık sağa geçip yeni haftanın günlerini sırayla yakıyor ve
   halkalar yeniden soluyor — "hafta kapandı, zil yenisini çalıyor".

   VERİ ÇİZMİYOR. Postanın görseli fiyat grafiğine benzerse (iniş çıkışlı
   çizgi, çubuk) okuyucu onu geçen haftanın gerçek seyri sanar; sayı taşıyan
   her çizgi postanın gövdesinde, gerçek veriden (lib/notify-emails.ts).
   Burada yalnız takvim geometrisi: on gün, eşit aralık, tek eksen.

   Hero ile aynı kurallar: ilk kare = son kare = durgun afiş (Outlook ilk
   kareyi gösterir), bir kez oynar (`loop: 1`), zemin düz renk.
   ========================================================================== */
async function buildWeekly() {
  const WH = 200 * SCALE;
  const WCY = WH / 2;
  const WTILE = 78 * SCALE;
  const SIDE_GAP = 30 * SCALE;
  const EDGE_W = 44 * SCALE;
  const step = (CX - WTILE / 2 - SIDE_GAP - EDGE_W) / 4;
  const pastX = Array.from({ length: 5 }, (_, i) => EDGE_W + i * step);
  const nextX = Array.from({ length: 5 }, (_, i) => CX + WTILE / 2 + SIDE_GAP + i * step);
  const DOT = 6 * SCALE;
  const RING = 7 * SCALE;
  const IVORY = "#fbe7bf";
  const RING_REST = "#4b6fa8";
  const T_STRIKE = 1.0;
  const T_END = 2.75;

  /* Işığın konumu: 0–1 sn sol uçtan karoya, 1,05–2,25 sn karodan sağ uca. */
  function pulseX(t) {
    if (t <= 0) return null;
    if (t < T_STRIKE) return pastX[0] + (CX - WTILE / 2 - pastX[0]) * ease(t / T_STRIKE);
    if (t < 1.05) return null;
    if (t < 2.25) return CX + WTILE / 2 + (nextX[4] - CX - WTILE / 2) * ease((t - 1.05) / 1.2);
    return null;
  }
  /* Bir halkanın ışık geçtiği an — sonra sönerek afişe döner. */
  function passTime(x) {
    const span = nextX[4] - CX - WTILE / 2;
    const f = (x - CX - WTILE / 2) / span;
    // ease'in tersi: 1-(1-u)^3 = f → u = 1-(1-f)^(1/3)
    return 1.05 + 1.2 * (1 - Math.cbrt(1 - Math.min(0.999, f)));
  }

  function wframe(t) {
    const px = pulseX(t);
    const parts = [];
    /* Eksen: iki yarı, karoya değmiyor. */
    parts.push(`<rect x="${pastX[0]}" y="${WCY - SCALE / 2}" width="${CX - WTILE / 2 - 14 * SCALE - pastX[0]}" height="${SCALE}" fill="${LANE}"/>`);
    parts.push(`<rect x="${CX + WTILE / 2 + 14 * SCALE}" y="${WCY - SCALE / 2}" width="${nextX[4] - CX - WTILE / 2 - 14 * SCALE}" height="${SCALE}" fill="${LANE}"/>`);
    /* Geçen hafta: ışık geçerken nokta büyüyüp fildişine açılıyor. */
    for (const x of pastX) {
      const near = px !== null && t < T_STRIKE ? Math.exp(-(((px - x) / (16 * SCALE)) ** 2)) : 0;
      const r = DOT * (1 + 0.55 * near);
      parts.push(`<circle cx="${x}" cy="${WCY}" r="${r.toFixed(1)}" fill="${mix(BRASS, IVORY, near)}"/>`);
    }
    /* Yeni hafta: halka, ışık geçince dolup parlıyor, sonra sönüyor. */
    for (const x of nextX) {
      const tp = passTime(x);
      const glow = t >= tp - 0.08 ? Math.exp(-Math.max(0, t - tp) / 0.42) * Math.min(1, (t - tp + 0.08) / 0.08) : 0;
      if (glow > 0.02) {
        parts.push(`<circle cx="${x}" cy="${WCY}" r="${(RING * (1.9 + glow)).toFixed(1)}" fill="${BRASS}" fill-opacity="${(0.18 * glow).toFixed(3)}"/>`);
        /* Kare kök: düz karışım lacivertle pirincin ortasında griye düşüyor
           (hero'daki şeritle aynı gerekçe). */
        const g = Math.sqrt(glow);
        parts.push(`<circle cx="${x}" cy="${WCY}" r="${RING}" fill="${mix(BG, BRASS, g)}" stroke="${mix(RING_REST, BRASS, g)}" stroke-width="${2 * SCALE}"/>`);
      } else {
        parts.push(`<circle cx="${x}" cy="${WCY}" r="${RING}" fill="${BG}" stroke="${RING_REST}" stroke-width="${2 * SCALE}"/>`);
      }
    }
    if (px !== null) {
      parts.push(`<circle cx="${px.toFixed(1)}" cy="${WCY}" r="${18 * SCALE}" fill="url(#pulse)"/>`);
      parts.push(`<circle cx="${px.toFixed(1)}" cy="${WCY}" r="${3 * SCALE}" fill="${IVORY}"/>`);
    }
    const tt = t - T_STRIKE;
    const swing = tt > 0 ? 14 * Math.sin(tt * Math.PI * 2 * 2.1) * Math.exp(-tt * 2.6) : 0;
    const clap = tt > 0 ? 14 * Math.sin(tt * Math.PI * 2 * 2.1 - 0.9) * Math.exp(-tt * 2.4) : 0;
    const x = CX - WTILE / 2;
    const y = WCY - WTILE / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${WH}" viewBox="0 0 ${W} ${WH}">
  <defs>
    <linearGradient id="tile" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0" stop-color="#5cc4ff"/><stop offset=".48" stop-color="#1f86e0"/><stop offset="1" stop-color="#0b3f86"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#1f86e0" stop-opacity=".3"/><stop offset="1" stop-color="#1f86e0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pulse" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${BRASS}" stop-opacity=".55"/><stop offset="1" stop-color="${BRASS}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${WH}" fill="${BG}"/>
  <circle cx="${CX}" cy="${WCY}" r="${WH * 0.5}" fill="url(#halo)"/>
  ${parts.join("\n  ")}
  <g transform="translate(${x} ${y})">
    <rect width="${WTILE}" height="${WTILE}" rx="${WTILE / 3}" fill="url(#tile)"/>
    <rect width="${WTILE}" height="${WTILE}" rx="${WTILE / 3}" fill="url(#gloss)"/>
    <rect x="1.5" y="1.5" width="${WTILE - 3}" height="${WTILE - 3}" rx="${WTILE / 3 - 1.5}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>
    <svg width="${WTILE}" height="${WTILE}" viewBox="-11.13 -15.13 278.26 278.26" fill="#ffffff">
      <g transform="rotate(${clap.toFixed(2)} 128 40)">${CLAPPER}</g>
      <g transform="rotate(${swing.toFixed(2)} 128 40)">${BELL}</g>
    </svg>
  </g>
</svg>`;
  }

  const n = Math.round(T_END * FPS);
  const svgs = [wframe(0)];
  for (let i = 1; i <= n; i += 1) svgs.push(wframe(i / FPS));
  svgs.push(wframe(0));
  const pngs = await Promise.all(svgs.map((svg) => sharp(Buffer.from(svg)).png().toBuffer()));
  const delays = [POSTER_MS, ...Array(n).fill(1000 / FPS), REST_MS].map(Math.round);
  const out = await sharp(pngs, { join: { animated: true } })
    .gif({ delay: delays, loop: 1, effort: 10, colours: 48, dither: 0, interFrameMaxError: 6, interPaletteMaxError: 4 })
    .toBuffer();
  await writeFile(path.join(ROOT, "public/email/weekly.gif"), out);
  console.log(`weekly.gif yazıldı — ${svgs.length} kare, ${W}×${WH}, ${(out.length / 1024).toFixed(1)} KB`);
}
