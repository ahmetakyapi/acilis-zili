/**
 * Claude analizi beklerken oynayan mürekkep filmi — TEK ÇİZGİNİN hikâyesi.
 *
 * Bekleme 20–30 saniye. Sahneler birbirine kesmeyle değil BİÇİM DEĞİŞTİREREK
 * geçiyor; göz baştan sona aynı mürekkep çizgisini izliyor:
 *
 *   I   Fiyat       kalem hissenin son 60 kapanışını elle çizer, ucunda pirinç
 *                   kıvılcım; geçtiği her seansın tepe-dip çentiği düşer.
 *   II  Göstergeler aynı çizgi "gevşer", 20 günlük ortalamaya dönüşür; 50
 *                   günlük ortalama pirinçle iner, köşede RSI kadranı çizilir.
 *   III Haberler    ortalama çizgisi kalkar, beş kâğıt şeride bölünür; her
 *                   şeridin üstüne bir haber başlığı mürekkeple yazılır.
 *   IV  Tartı       şeritler tek bir kola toplanır, terazi çizilir; kefelere
 *                   olumlu ve olumsuz damlalar düşer, kol hafifçe salınır.
 *   V   Perde       kol durulur, yerine markanın zili çizilir ve çalar;
 *                   "Rapor Hazır" yazılır.
 *
 * Mürekkep sahnelerinin kuralları (CLAUDE.md, lib/ink/scenes.ts): saf
 * `render(ctx, t)`, tohumlu ve belirli; renk temadan (mürekkep, pirinç; mavi
 * yok — yön renkleri yalnız tartının damlalarında, anlam taşıdıkları için).
 * IV. perde sonuç gelene kadar döner: bu bir yükleme göstergesi ("ringing"
 * istisnasıyla aynı gerekçe), sonuç gelince kalkar.
 */
import { blot, brush, clamp, damped, ease, segment, span, splatter, type InkPalette, type Point } from "./engine";
import { drawBell, ringArcs, spark } from "./scenes";

type Ctx = CanvasRenderingContext2D;
export type FilmPalette = InkPalette & { up: string; down: string; muted: string; font: string; /** Tartının iki kefesi: olumlu, olumsuz. */ labels: [string, string] };
export type FilmData = { closes: number[]; highs: number[]; lows: number[]; headlines: string[]; rsi: number | null };

/** Perdelerin başladığı an (sn) — üretimin gerçek iş sırası. */
export const ACTS = [0, 4.5, 9.5, 15] as const;
/** Perde (V) süresi: zil çizilir, çalar, yazı oturur. */
export const CURTAIN_S = 2.2;
const STRIPS = 5;
const SWAY_PERIOD = 3.2;
const SWAY = 0.075;
const DROP_EVERY = 1.1;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mix = (a: Point[], b: Point[], k: number) => a.map((p, i) => ({ x: lerp(p.x, b[i].x, k), y: lerp(p.y, b[i].y, k) }));

/** Pencere dolmadan da tanımlı ortalama: ilk seanslarda o ana kadarki ortalama (biçim dönüşümü kopmasın). */
function movingAverage(values: number[], n: number) {
  let sum = 0;
  return values.map((v, i) => { sum += v; if (i >= n) sum -= values[i - n]; return sum / Math.min(i + 1, n); });
}

/** Metni genişliğe sığdırır (sonuna …). */
function fit(ctx: Ctx, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + "…").width <= width) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo).trimEnd() + "…";
}

export type FilmFrame = { t: number; doneAt: number | null };

export function renderFilm(ctx: Ctx, frame: FilmFrame, pal: FilmPalette, data: FilmData, size: { w: number; h: number }, seed = 11) {
  const { t, doneAt } = frame;
  const { w, h } = size;
  ctx.clearRect(0, 0, w, h);
  const n = data.closes.length;
  if (n < 2) return;
  const narrow = w < 560;
  const left = narrow ? 18 : 32, right = w - (narrow ? 18 : 32);
  const top = narrow ? 56 : 48, bottom = h - (narrow ? 132 : 118);
  const lo = Math.min(...data.lows), hi = Math.max(...data.highs);
  const yOf = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  const xOf = (i: number) => left + (i / (n - 1)) * (right - left);

  const price: Point[] = data.closes.map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  const ma20: Point[] = movingAverage(data.closes, 20).map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  const ma50: Point[] = movingAverage(data.closes, 50).map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  // III: çizgi beş şeride bölünür — her parça kendi şeridinin yatay hattına.
  const stripGap = (bottom - top) / (STRIPS + 0.4);
  const stripY = (k: number) => top + stripGap * (k + 0.7);
  // Şerit sırası yılan gibi (soldan sağa, sağdan sola): komşu şeritler AYNI yanda
  // buluşur; tek çizgi düz sırayla bölününce şeritler arasında boydan boya çapraz
  // bağlar kalıyordu (1280 ölçümü).
  const stripOf = (i: number) => Math.min(STRIPS - 1, Math.floor((i / n) * STRIPS));
  const strips: Point[] = price.map((_, i) => {
    const k = stripOf(i);
    const local = clamp((i - (k * n) / STRIPS) / (n / STRIPS - 1 || 1));
    const u = k % 2 ? 1 - local : local;
    return { x: lerp(left + 24, right - 24, u), y: stripY(k) };
  });
  // IV: hepsi tek kola toplanır.
  const cx = w / 2, beamY = top + (bottom - top) * 0.32, half = Math.min(220, (right - left) * 0.36);
  const sway = doneAt === null ? 1 : 1 - ease.out(span(t - doneAt, 0, 0.6));
  const angle = SWAY * Math.sin((2 * Math.PI * (t - ACTS[3] - 1.6)) / SWAY_PERIOD) * span(t, ACTS[3] + 1.4, ACTS[3] + 2.4) * sway;
  const beam: Point[] = price.map((_, i) => {
    const u = i / (n - 1) * 2 - 1;
    return { x: cx + u * half * Math.cos(angle), y: beamY + u * half * Math.sin(angle) };
  });

  // Çizginin o anki biçimi: fiyat → ortalama → şeritler → kol.
  const toMa = ease.inOut(span(t, ACTS[1] + 0.1, ACTS[1] + 1.8));
  const toStrips = ease.inOut(span(t, ACTS[2] + 0.1, ACTS[2] + 1.7));
  const toBeam = ease.inOut(span(t, ACTS[3] + 0.1, ACTS[3] + 1.5));
  let line = mix(price, ma20, toMa);
  line = mix(line, strips, toStrips);
  line = mix(line, beam, toBeam);
  const curtain = doneAt === null ? 0 : span(t - doneAt, 0.35, 1.0);

  /* ---- Zemin: silik kurşun kalem taban çizgisi (I–II) ---- */
  const groundAlpha = (1 - toStrips) * span(t, 0, 0.6) * 0.14;
  if (groundAlpha > 0) brush(ctx, segment({ x: left, y: bottom + 10 }, { x: right, y: bottom + 10 }, 20), { width: 1, taper: 0, seed: seed + 1, alpha: groundAlpha, color: pal.ink });

  /* ---- I: tepe-dip çentikleri, kalem geçtikçe ---- */
  const pen = span(t, 0.3, 3.8);
  const tickAlpha = (1 - toMa) * 0.32;
  if (tickAlpha > 0) for (let i = 0; i < n; i++) {
    const born = span(pen, i / n, i / n + 0.06);
    if (born <= 0) continue;
    brush(ctx, segment({ x: xOf(i), y: yOf(data.highs[i]) }, { x: xOf(i), y: yOf(data.lows[i]) }, 4), {
      width: 1.6, progress: ease.out(born), taper: 0.4, seed: seed + 100 + i, alpha: tickAlpha, color: pal.ink,
    });
  }

  /* ---- II: 50 günlük ortalama pirinçle, RSI kadranı ---- */
  const brass = span(t, ACTS[1] + 1.4, ACTS[1] + 3.6) * (1 - toStrips);
  if (brass > 0) brush(ctx, ma50, { width: 2.4, progress: ease.inOut(span(t, ACTS[1] + 1.4, ACTS[1] + 3.6)), taper: 0.6, dry: 0.4, seed: seed + 7, alpha: 1 - toStrips, color: pal.spark });
  const dial = span(t, ACTS[1] + 2.2, ACTS[1] + 3.4) * (1 - toStrips);
  if (dial > 0 && data.rsi !== null) {
    const r = narrow ? 26 : 32, dx = right - r - 4, dy = top + r - 6;
    const arc: Point[] = [];
    for (let i = 0; i <= 24; i++) { const a = Math.PI + (i / 24) * Math.PI; arc.push({ x: dx + Math.cos(a) * r, y: dy + Math.sin(a) * r }); }
    brush(ctx, arc, { width: 2.2, progress: ease.out(dial), taper: 0.5, seed: seed + 9, alpha: (1 - toStrips) * 0.9, color: pal.ink });
    const settle = span(t, ACTS[1] + 2.8, ACTS[1] + 4.4);
    const needle = Math.PI + (data.rsi / 100) * Math.PI * ease.out(settle) + damped(settle * 1.6, 1.2, 3) * 0.25;
    brush(ctx, segment({ x: dx, y: dy }, { x: dx + Math.cos(needle) * (r - 6), y: dy + Math.sin(needle) * (r - 6) }, 6), {
      width: 2.4, progress: ease.out(span(t, ACTS[1] + 2.6, ACTS[1] + 3)), taper: 0.3, seed: seed + 10, alpha: 1 - toStrips, color: pal.ink,
    });
    blot(ctx, dx, dy, 3, { seed: seed + 11, spread: dial, color: pal.ink, alpha: 1 - toStrips });
    ctx.save();
    ctx.globalAlpha = ease.out(span(t, ACTS[1] + 3.6, ACTS[1] + 4.2)) * (1 - toStrips);
    ctx.fillStyle = pal.muted; ctx.font = `600 11px ${pal.font}`; ctx.textAlign = "center";
    ctx.fillText(`RSI ${Math.round(data.rsi)}`, dx, dy + 16);
    ctx.restore();
  }

  /* ---- Ana çizgi (I–IV) ---- */
  const lineAlpha = 1 - curtain;
  if (lineAlpha > 0) {
    // III'ten itibaren şeritler AYRI fırça darbeleri: aradaki dönüş yolu soluyor.
    // Parçalar uçlarda birer nokta paylaşıyor; I–II'de tek çizgi gibi okunur.
    const splitK = toStrips * (1 - toBeam);
    if (splitK <= 0) {
      brush(ctx, line, { width: lerp(2.6, 3.6, toBeam), progress: ease.inOut(pen), taper: 0.7, dry: 0.3, wobble: 0.1, seed: seed + 3, alpha: lineAlpha, color: pal.ink });
    } else {
      for (let k = 0; k < STRIPS; k++) {
        const a = Math.ceil((k * n) / STRIPS), b = Math.min(n, Math.ceil(((k + 1) * n) / STRIPS) + 1);
        brush(ctx, line.slice(a, b), { width: 2.6, taper: 0.7 * splitK, dry: 0.3, wobble: 0.1, seed: seed + 3 + k, alpha: lineAlpha, color: pal.ink });
        // Şeritler arası dönüş: biçim değişirken görünür, şeritler oturunca kaybolur.
        if (k < STRIPS - 1 && splitK < 1) brush(ctx, line.slice(b - 2, b + 1), { width: 2.6, taper: 0, seed: seed + 50 + k, alpha: lineAlpha * (1 - splitK), color: pal.ink });
      }
    }
    // Kalemin ucu: çizerken pirinç kıvılcım, sonra çizgi kendi ucunda bir damla.
    if (pen < 1) {
      const i = Math.min(n - 1, Math.floor(pen * (n - 1)));
      blot(ctx, line[i].x, line[i].y, 3.6, { seed: seed + 4 + i, color: pal.spark, spread: 1 });
    } else if (toStrips < 1) {
      const end = line[n - 1];
      blot(ctx, end.x, end.y, 4.2 * ease.back(span(t, 3.8, 4.4)), { seed: seed + 5, color: pal.ink, alpha: 1 - toStrips });
    }
  }

  /* ---- III: şeritlerin üstüne başlıklar ---- */
  const writing = toStrips * (1 - toBeam);
  if (writing > 0) {
    ctx.save();
    ctx.font = `600 ${narrow ? 12.5 : 14}px ${pal.font}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = pal.ink;
    const titles = (data.headlines.length ? data.headlines : []).slice(0, STRIPS);
    titles.forEach((title, k) => {
      const x0 = left + 24, width = right - left - 48;
      const text = fit(ctx, title, width);
      const reveal = span(t, ACTS[2] + 1.5 + k * 0.55, ACTS[2] + 1.5 + k * 0.55 + Math.min(1.6, text.length * 0.025));
      const shown = text.slice(0, Math.round(text.length * reveal));
      ctx.globalAlpha = writing;
      ctx.fillText(shown, x0, stripY(k) - 8);
    });
    ctx.restore();
  }

  /* ---- IV: terazi ---- */
  const scale = span(t, ACTS[3] + 0.9, ACTS[3] + 1.8) * (1 - curtain);
  if (scale > 0) {
    // Ayak: kolun ortasından tabana.
    brush(ctx, [{ x: cx, y: beamY }, { x: cx - 3, y: lerp(beamY, bottom, 0.5) }, { x: cx - 26, y: bottom }], { width: 3, progress: ease.out(scale), taper: 0.4, seed: seed + 20, alpha: 1 - curtain, color: pal.ink });
    brush(ctx, [{ x: cx, y: beamY }, { x: cx + 3, y: lerp(beamY, bottom, 0.5) }, { x: cx + 26, y: bottom }], { width: 3, progress: ease.out(scale), taper: 0.4, seed: seed + 21, alpha: 1 - curtain, color: pal.ink });
    brush(ctx, segment({ x: cx - 44, y: bottom }, { x: cx + 44, y: bottom }, 12), { width: 3, progress: ease.out(scale), taper: 0.5, seed: seed + 22, alpha: 1 - curtain, color: pal.ink });
    blot(ctx, cx, beamY, 5, { seed: seed + 23, spread: ease.back(scale), color: pal.ink, alpha: 1 - curtain });
    const pans = span(t, ACTS[3] + 1.4, ACTS[3] + 2.3);
    for (const [side, tone] of [[-1, pal.up], [1, pal.down]] as const) {
      const end = beam[side < 0 ? 0 : n - 1];
      const drop = narrow ? 44 : 58, panW = narrow ? 30 : 38;
      const panY = end.y + drop;
      brush(ctx, segment(end, { x: end.x, y: panY }, 8), { width: 1.4, progress: ease.out(pans), taper: 0, seed: seed + 30 + side, alpha: 0.7 * (1 - curtain), color: pal.ink });
      const bowl: Point[] = [];
      for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); bowl.push({ x: end.x - Math.cos(a) * panW, y: panY + Math.sin(a) * 11 }); }
      brush(ctx, bowl, { width: 2.6, progress: ease.out(pans), taper: 0.5, seed: seed + 32 + side, alpha: 1 - curtain, color: pal.ink });
      // Damlalar: kefeye düşer, dibinde birikir. Olumlu solda, olumsuz sağda.
      const since = t - (ACTS[3] + 2.4) - (side < 0 ? 0 : DROP_EVERY / 2);
      const count = since > 0 ? Math.min(7, Math.floor(since / DROP_EVERY) + 1) : 0;
      for (let d = 0; d < count; d++) {
        const local = since - d * DROP_EVERY;
        const fall = ease.in(clamp(local / 0.55));
        const restX = end.x + ((d % 4) - 1.5) * (panW / 3), restY = panY + 4 - Math.floor(d / 4) * 6;
        const y = lerp(beamY - 70, restY, fall);
        blot(ctx, restX, y, 4.2, { seed: seed + 40 + d * 3 + side, color: tone, squash: fall >= 1 ? 0.25 : 0, alpha: 1 - curtain });
        if (local > 0.55 && local < 0.95) splatter(ctx, restX, restY, local - 0.55, { seed: seed + 60 + d, count: 4, reach: 9, size: 1.2, color: tone, up: true, fade: 0.25 });
      }
    }
    const labels = span(t, ACTS[3] + 2.2, ACTS[3] + 2.8) * (1 - curtain);
    if (labels > 0) {
      ctx.save(); ctx.globalAlpha = labels; ctx.font = `650 12.5px ${pal.font}`; ctx.textAlign = "center";
      ctx.fillStyle = pal.up; ctx.fillText(pal.labels[0], beam[0].x, beam[0].y + (narrow ? 44 : 58) + 34);
      ctx.fillStyle = pal.down; ctx.fillText(pal.labels[1], beam[n - 1].x, beam[n - 1].y + (narrow ? 44 : 58) + 34);
      ctx.restore();
    }
  }

  /* ---- V: perde — zil çizilir ve çalar ---- */
  if (doneAt !== null) {
    const d = t - doneAt;
    const s = narrow ? 0.9 : 1.15;
    const by = (top + bottom) / 2 + 6;
    drawBell(ctx, pal, {
      x: cx, y: by, s, swing: damped(Math.max(0, d - 1.05), 1.6, 2.2) * 0.22,
      outline: span(d, 0.4, 1.0), lip: span(d, 0.85, 1.05), hanger: span(d, 0.9, 1.1), wash: span(d, 0.95, 1.25),
      clapper: span(d, 1.0, 1.15), eyes: span(d, 1.05, 1.3), smile: span(d, 1.15, 1.45), seed: seed + 70,
    });
    ringArcs(ctx, pal, cx, by - 2, span(d, 1.1, 1.75), s);
    spark(ctx, pal, cx + 24 * s, by + 14 * s, span(d, 1.1, 1.55), s, seed + 80);
    spark(ctx, pal, cx - 24 * s, by + 14 * s, span(d, 1.3, 1.75), s, seed + 81);
  }
}
