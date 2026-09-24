/**
 * Mürekkep sahneleri — her biri tek bir saf fonksiyon: `render(ctx, t)`.
 *
 * Sahneler kendi tasarım kutularında (`box`) çiziliyor; `InkCanvas` kutuyu
 * tuvale sığdırıyor. Zamanlama saniye cinsinden ve her sahne `end`
 * saniyesinde DURUYOR: son kare aynı zamanda hareketi azaltan okuyucuya
 * basılan tek kare.
 *
 * Döngü yok, bilinçli. İlk taslakta sahneler sonsuza dek dönüyordu; bir
 * haber listesinin başında ya da boş bir tablonun ortasında hiç durmayan
 * bir çizim okumayı böler (WCAG 2.2.2: beş saniyeden uzun, kendiliğinden
 * başlayan hareket durdurulabilmeli). Sahne görünüme girdiğinde bir kez
 * oynuyor ve oturuyor.
 *
 * Karakter: markanın zili. Fırçayla çiziliyor, iki nokta gözü ve bir
 * gülümsemesi var. BellMark'ın oranlarını taşıyor (omuzlu kubbe, açılan
 * etek, ağız çubuğu, kopuk tokmak) ama bir logo değil, bir oyuncu.
 */
import {
  blot,
  brush,
  clamp,
  damped,
  ease,
  path,
  rng,
  segment,
  span,
  splatter,
  transform,
  type InkPalette,
  type Point,
} from "./engine";

type Ctx = CanvasRenderingContext2D;

export type InkScene = {
  box: { w: number; h: number };
  end: number;
  render: (ctx: Ctx, t: number, pal: InkPalette, seed: number) => void;
};

/* ----------------------------------------------------------------------- */
/* Zil karakteri                                                            */
/* ----------------------------------------------------------------------- */

/* Yerel koordinat: askı noktası (0, -50), ağız çubuğu y = 40.
   Gövde İKİ yarım olarak tutuluyor ve ikisi de tepeden başlıyor: damla
   kubbeye düşüyor, mürekkep oradan iki yana akıyor. Tek parça çizgi sol
   eteğin ucundan başlıyordu ve damlanın düştüğü yerle hiç ilgisi yoktu. */
const BELL_HALF: Point[] = path(
  [
    // Tepede iki yarım 6 birim üst üste biniyor: uç uca gelince kenar
    // yumuşatması ortada ince bir kâğıt çizgisi bırakıyordu.
    { x: 3, y: -42 },
    { x: -22, y: -41 },
    { x: -30, y: -20 },
    { x: -31, y: 4 },
    { x: -32, y: 20 },
    { x: -38, y: 31 },
    { x: -48, y: 36 },
  ],
  22,
);
const BELL_LEFT = BELL_HALF;
const BELL_RIGHT = BELL_HALF.map((q) => ({ x: -q.x, y: q.y }));
const BELL_OUTLINE: Point[] = [...BELL_LEFT.slice().reverse(), ...BELL_RIGHT.slice(1)];
const BELL_LIP: Point[] = [
  { x: -54, y: 41 },
  { x: -18, y: 40 },
  { x: 18, y: 40.5 },
  { x: 54, y: 41 },
];
const BELL_HANGER: Point[] = path(
  [
    { x: -7, y: -42 },
    { x: -8, y: -52 },
    { x: 8, y: -52 },
    { x: 7, y: -42 },
  ],
  12,
);
const SMILE: Point[] = path(
  [
    { x: -7, y: 8 },
    { x: -3, y: 13 },
    { x: 3, y: 13 },
    { x: 7, y: 8 },
  ],
  10,
);
const PIVOT = { x: 0, y: -50 };

type BellPose = {
  x: number;
  y: number;
  s: number;
  /** Sallanma açısı (radyan), askıdan. */
  swing?: number;
  outline?: number;
  lip?: number;
  hanger?: number;
  wash?: number;
  clapper?: number;
  eyes?: number;
  /** 0 açık, 1 kapalı. */
  blink?: number;
  /** Göz bebeklerinin yatay kayması, -1…1. */
  look?: number;
  smile?: number;
  seed: number;
};

function place(pts: Point[], p: BellPose) {
  // Önce askı etrafında döndür, sonra ölçekle ve yerleştir.
  const swung = transform(pts, { r: p.swing ?? 0, ox: PIVOT.x, oy: PIVOT.y });
  return swung.map((q) => ({ x: p.x + q.x * p.s, y: p.y + q.y * p.s }));
}

function placeOne(pt: Point, p: BellPose) {
  return place([pt], p)[0];
}

function drawBell(ctx: Ctx, pal: InkPalette, p: BellPose) {
  const outline = p.outline ?? 1;
  const wash = p.wash ?? 1;

  // Gövdenin yıkaması: ince bir mürekkep suyu, çizgiden sonra iner.
  if (wash > 0) {
    const pts = place([...BELL_OUTLINE, ...BELL_LIP.slice().reverse()], p);
    ctx.save();
    ctx.globalAlpha = 0.13 * ease.out(wash);
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const [i, half] of [BELL_LEFT, BELL_RIGHT].entries()) {
    brush(ctx, place(half, p), {
      width: 7.5 * p.s,
      progress: ease.inOut(outline),
      seed: p.seed + i * 17,
      // Tepede iki yarım birleşiyor: orada incelirse kubbenin ortasında
      // bir boğum okunuyor. Yalnızca etek ucu sivri.
      taper: 0.75,
      taperStart: 0,
      dry: 0.5,
      color: pal.ink,
    });
  }
  brush(ctx, place(path([BELL_LIP[0], BELL_LIP[1], BELL_LIP[2], BELL_LIP[3]], 20), p), {
    width: 9 * p.s,
    progress: ease.out(p.lip ?? 1),
    seed: p.seed + 1,
    taper: 0.6,
    dry: 0.6,
    color: pal.ink,
  });
  brush(ctx, place(BELL_HANGER, p), {
    width: 5 * p.s,
    progress: ease.out(p.hanger ?? 1),
    seed: p.seed + 2,
    taper: 0.5,
    color: pal.ink,
  });

  // Tokmak: ağız çubuğundan kopuk, askıyla birlikte ama biraz gecikmeli
  // sallanıyor — tek gövde gibi dönse cansız duruyor.
  const clap = p.clapper ?? 1;
  if (clap > 0) {
    const lag = { ...p, swing: (p.swing ?? 0) * 1.35 };
    const c = placeOne({ x: 0, y: 53 }, lag);
    blot(ctx, c.x, c.y, 7 * p.s, {
      seed: p.seed + 3,
      spread: ease.back(clamp(clap)),
      color: pal.ink,
    });
  }

  const eyes = p.eyes ?? 1;
  if (eyes > 0) {
    const open = 1 - (p.blink ?? 0);
    const look = (p.look ?? 0) * 3.2;
    for (const side of [-1, 1]) {
      const e = placeOne({ x: side * 11 + look, y: -9 }, p);
      blot(ctx, e.x, e.y, 3.9 * p.s * ease.back(clamp(eyes)), {
        seed: p.seed + 5 + side,
        color: pal.ink,
        scaleY: Math.max(0.14, open),
      });
    }
  }

  const smile = p.smile ?? 1;
  if (smile > 0) {
    brush(ctx, place(SMILE.map((q) => ({ x: q.x + (p.look ?? 0) * 2, y: q.y })), p), {
      width: 3.2 * p.s,
      progress: ease.out(smile),
      seed: p.seed + 8,
      taper: 0.8,
      color: pal.ink,
    });
  }
}

/** Zilin çınlaması: iki yanda açılan ince yaylar. */
function ringArcs(ctx: Ctx, pal: InkPalette, x: number, y: number, t: number, s: number) {
  if (t <= 0 || t >= 1) return;
  for (let k = 0; k < 2; k++) {
    const local = clamp(t * 1.25 - k * 0.22);
    if (local <= 0 || local >= 1) continue;
    const r = (46 + local * 34 + k * 6) * s;
    for (const side of [-1, 1]) {
      const a0 = side < 0 ? Math.PI * 0.82 : -Math.PI * 0.18;
      const pts: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = a0 + (i / 12) * Math.PI * 0.36;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      brush(ctx, pts, {
        width: 3 * s,
        seed: 40 + k * 3 + side,
        taper: 1,
        alpha: (1 - local) * 0.9,
        color: pal.ink,
      });
    }
  }
}

/** Pirinç kıvılcım: vuruş anında dışarı savrulan kısa fırça darbeleri. */
function spark(ctx: Ctx, pal: InkPalette, x: number, y: number, t: number, s: number, seed: number) {
  if (t <= 0 || t >= 1) return;
  const r = rng(seed);
  const k = ease.out(t);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4;
    const d0 = (8 + k * 20) * s;
    const d1 = d0 + (6 + r() * 10) * s * (1 - t);
    brush(
      ctx,
      segment(
        { x: x + Math.cos(a) * d0, y: y + Math.sin(a) * d0 },
        { x: x + Math.cos(a) * d1, y: y + Math.sin(a) * d1 },
        6,
      ),
      { width: 3.6 * s * (1 - t * 0.6), seed: seed + i, taper: 1, color: pal.spark },
    );
  }
  blot(ctx, x, y, 5 * s * (1 - t), { seed, color: pal.spark });
}

/* ----------------------------------------------------------------------- */
/* Açılış — damla, zil, çınlama, imza                                      */
/* ----------------------------------------------------------------------- */

const intro: InkScene = {
  box: { w: 320, h: 230 },
  end: 2.3,
  render(ctx, t, pal, seed) {
    const bx = 160;
    const by = 104;

    // 1. Damla düşer — hızlanarak, boyuna uzamış.
    const fall = span(t, 0, 0.32);
    if (fall < 1) {
      const y = -10 + (by - 42 - -10) * ease.in(fall);
      blot(ctx, bx, y, 5.5, { seed, color: pal.ink, squash: 1 + fall * 0.7 });
    }
    // 2. Kubbeye çarpar: sıçrantı yukarı.
    splatter(ctx, bx, by - 44, t - 0.32, {
      seed: seed + 11,
      count: 7,
      reach: 26,
      size: 2.4,
      color: pal.ink,
      up: true,
      fade: 0.35,
    });

    // 3. Zil fırçayla çizilir, sonra karakter uyanır.
    const swingT = t - 1.3;
    const swing = 0.2 * damped(swingT, 1.5, 2.4);
    const blinkT = t - 1.95;
    const blink = blinkT > 0 && blinkT < 0.16 ? Math.sin((blinkT / 0.16) * Math.PI) : 0;
    drawBell(ctx, pal, {
      x: bx,
      y: by,
      s: 1,
      swing,
      outline: span(t, 0.3, 1.0),
      lip: span(t, 0.82, 1.05),
      hanger: span(t, 0.95, 1.1),
      wash: span(t, 1.0, 1.3),
      clapper: span(t, 1.05, 1.25),
      eyes: span(t, 1.18, 1.36),
      blink,
      look: 0,
      smile: span(t, 1.5, 1.7),
      seed,
    });

    // 4. İlk vuruş: tokmak eteğe değdiği an kıvılcım ve çınlama.
    const hit = t - 1.46;
    const hitX = bx + Math.sin(0.2) * 60;
    spark(ctx, pal, hitX + 14, by + 38, hit / 0.5, 1, seed + 21);
    ringArcs(ctx, pal, bx, by - 2, (t - 1.42) / 0.8, 1);

    // 5. İmza: altında kuru fırçayla tek bir süpürme.
    brush(
      ctx,
      path(
        [
          { x: 78, y: 186 },
          { x: 130, y: 180 },
          { x: 196, y: 183 },
          { x: 244, y: 178 },
        ],
        30,
      ),
      {
        width: 8,
        progress: ease.inOut(span(t, 1.6, 2.15)),
        seed: seed + 30,
        taper: 1,
        dry: 1,
        color: pal.ink,
      },
    );
  },
};

/* ----------------------------------------------------------------------- */
/* Arıyor — boş sonuç, bulunamayan kayıt                                    */
/* ----------------------------------------------------------------------- */

const QUESTION: Point[] = path(
  [
    { x: -9, y: -8 },
    { x: -9, y: -20 },
    { x: 10, y: -20 },
    { x: 9, y: -8 },
    { x: 8, y: -1 },
    { x: 0, y: 0 },
    { x: 0, y: 8 },
  ],
  14,
);

const searching: InkScene = {
  box: { w: 240, h: 150 },
  // Çizilir, bir kez etrafına bakınır, soru işareti belirir ve oturur.
  end: 5.6,
  render(ctx, t, pal, seed) {
    const intro = t < 1.1;
    const lt = intro ? 0 : t - 1.1;

    // Zemin: zilin asılı durduğu ince bir çizgi değil, altında bir gölge
    // lekesi — askı yok, zil havada duruyor gibi okunuyor.
    blot(ctx, 120, 132, 17, {
      seed: seed + 50,
      spread: span(t, 0.05, 0.5),
      color: pal.ink,
      alpha: 0.12,
      squash: 0.42,
    });

    // Bakış: sola, sonra sağa, sonra yukarı soru işaretine.
    const look = intro
      ? 0
      : lt < 0.4
        ? 0
        : lt < 1.5
          ? -ease.inOut(span(lt, 0.4, 0.7))
          : lt < 2.6
            ? -1 + 2 * ease.inOut(span(lt, 1.5, 1.85))
            : 1 - ease.inOut(span(lt, 2.6, 2.9));
    const blinkT = lt - 3.4;
    const blink = !intro && blinkT > 0 && blinkT < 0.18 ? Math.sin((blinkT / 0.18) * Math.PI) : 0;
    const bob = intro ? 0 : Math.sin(lt * ((Math.PI * 2) / 5.2) * 2) * 1.6;
    const sway = intro ? 0 : Math.sin(lt * ((Math.PI * 2) / 5.2)) * 0.05;

    drawBell(ctx, pal, {
      x: 120,
      y: 76 + bob,
      s: 0.82,
      swing: sway + look * 0.03,
      outline: span(t, 0, 0.55),
      lip: span(t, 0.45, 0.62),
      hanger: span(t, 0.5, 0.66),
      wash: span(t, 0.55, 0.8),
      clapper: span(t, 0.6, 0.78),
      eyes: span(t, 0.7, 0.9),
      blink,
      look,
      smile: 0,
      seed,
    });

    // Soru işareti: bakış yukarı döndüğünde yazılıyor, sonra soluyor.
    if (!intro) {
      const q = span(lt, 2.9, 3.4);
      if (q > 0) {
        const pts = QUESTION.slice(0, -2).map((p) => ({ x: 172 + p.x, y: 44 + p.y }));
        brush(ctx, pts, {
          width: 4,
          progress: ease.out(q),
          seed: seed + 60,
          taper: 0.7,
          color: pal.ink,
        });
        blot(ctx, 172, 60, 2.6, {
          seed: seed + 61,
          spread: span(lt, 3.35, 3.5),
          color: pal.ink,
        });
      }
    }
  },
};

/* ----------------------------------------------------------------------- */
/* Grafik — mumlar ve üstünden geçen bir çizgi                              */
/* ----------------------------------------------------------------------- */

const chart: InkScene = {
  box: { w: 280, h: 150 },
  end: 3.7,
  render(ctx, t, pal, seed) {
    const lt = t;
    const r = rng(seed);
    const n = 8;
    const x0 = 34;
    const step = 30;
    let price = 78;
    const candles: { x: number; o: number; c: number; hi: number; lo: number }[] = [];
    for (let i = 0; i < n; i++) {
      const drift = (r() - 0.4) * 22;
      const o = price;
      const c = price - drift;
      candles.push({
        x: x0 + i * step,
        o,
        c,
        hi: Math.min(o, c) - 4 - r() * 10,
        lo: Math.max(o, c) + 4 + r() * 10,
      });
      price = c;
    }
    // Rastgele yürüyüş nereye giderse gitsin sahne aynı çerçeveyi dolduruyor:
    // mumlar 40…112 bandına yayılıyor, üstünde çizgiye 24 birim pay kalıyor.
    const top = Math.min(...candles.map((k) => k.hi));
    const bottom = Math.max(...candles.map((k) => k.lo));
    const fit = (y: number) => 40 + ((y - top) / (bottom - top || 1)) * 72;
    for (const k of candles) {
      k.o = fit(k.o);
      k.c = fit(k.c);
      k.hi = fit(k.hi);
      k.lo = fit(k.lo);
    }

    // Taban: kuru fırçayla tek darbe.
    brush(
      ctx,
      path([{ x: 16, y: 128 }, { x: 100, y: 127 }, { x: 190, y: 129 }, { x: 266, y: 127.5 }], 30),
      { width: 4, progress: ease.inOut(span(lt, 0, 0.6)), seed: seed + 1, taper: 0.9, color: pal.ink },
    );

    candles.forEach((k, i) => {
      const at = 0.35 + i * 0.22;
      const wick = span(lt, at, at + 0.2);
      const body = span(lt, at + 0.1, at + 0.32);
      // Fitil iki parça: gövdenin içinden geçmesin, içi boş mum boş kalsın.
      const top = Math.min(k.o, k.c);
      const bot = top + Math.max(4, Math.abs(k.c - k.o));
      for (const [j, [a, b]] of [[k.hi, top], [bot, k.lo]].entries()) {
        brush(ctx, segment({ x: k.x, y: a }, { x: k.x, y: b }, 8), {
          width: 2.2,
          progress: ease.out(wick),
          seed: seed + 10 + i * 2 + j,
          taper: 0.6,
          color: pal.ink,
        });
      }
      if (body <= 0) return;
      const h = Math.max(4, Math.abs(k.c - k.o)) * ease.back(body);
      const up = k.c < k.o;
      // Yükselen mum dolu, düşen içi boş — renk yok, yalnızca yoğunluk.
      ctx.save();
      ctx.globalAlpha = up ? 1 : 0.9;
      if (up) {
        ctx.fillStyle = pal.ink;
        ctx.fillRect(k.x - 6, top, 12, h);
      } else {
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(k.x - 5, top, 10, h);
      }
      ctx.restore();
    });

    // Kapanışların üstünden geçen yumuşak çizgi — mumlardan sonra.
    const line: Point[] = [];
    candles.forEach((k, i) => {
      const next = candles[i + 1];
      if (!next) return;
      const seg = path(
        [
          { x: k.x, y: k.c - 16 },
          { x: k.x + step * 0.45, y: k.c - 16 },
          { x: next.x - step * 0.45, y: next.c - 16 },
          { x: next.x, y: next.c - 16 },
        ],
        10,
      );
      line.push(...(line.length ? seg.slice(1) : seg));
    });
    const lp = span(lt, 2.2, 3.1);
    brush(ctx, line, {
      width: 3.4,
      progress: ease.inOut(lp),
      seed: seed + 30,
      taper: 0.5 * 0.85,
      color: pal.ink,
    });
    // Ucundaki pirinç kıvılcım: çizgi son muma vardığında bir kez çakar.
    const last = candles[n - 1];
    spark(ctx, pal, last.x, last.c - 16, (lt - 3.05) / 0.55, 0.7, seed + 40);
    if (lp >= 1) {
      blot(ctx, last.x, last.c - 16, 3.4, { seed: seed + 41, color: pal.ink });
    }
  },
};

/* ----------------------------------------------------------------------- */
/* Baskı — haber sayfası yazılıyor                                          */
/* ----------------------------------------------------------------------- */

const press: InkScene = {
  box: { w: 240, h: 150 },
  end: 4.8,
  render(ctx, t, pal, seed) {
    const lt = t;
    const r = rng(seed);

    // Kâğıt: hafif eğik bir yaprak, kenarı fırçayla.
    const sheet = [
      { x: 58, y: 18 },
      { x: 184, y: 15 },
      { x: 188, y: 134 },
      { x: 62, y: 137 },
      { x: 58, y: 18 },
    ];
    ctx.save();
    // Yaprağın kendisi zeminden bir ton koyu bir yıkama: kâğıt rengiyle
    // boyamak panel yüzeyini tahmin etmek olurdu, yıkama her yüzeyde okunuyor.
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    sheet.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.fill();
    ctx.restore();
    const edge: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const a = sheet[i];
      const b = sheet[i + 1];
      for (let k = 0; k <= 8; k++) edge.push({ x: a.x + (b.x - a.x) * (k / 8), y: a.y + (b.y - a.y) * (k / 8) });
    }
    brush(ctx, edge, {
      width: 2.6,
      progress: ease.inOut(span(lt, 0, 0.7)),
      seed: seed + 1,
      taper: 0.2,
      wobble: 0.3,
      color: pal.ink,
    });

    // Manşet: kalın, kuru fırça.
    const lines: { y: number; x0: number; x1: number; w: number; at: number }[] = [
      { y: 34, x0: 72, x1: 170, w: 7, at: 0.6 },
      { y: 46, x0: 72, x1: 140, w: 4.5, at: 0.95 },
    ];
    // Gövde: iki sütun, satır satır.
    for (let c = 0; c < 2; c++) {
      for (let l = 0; l < 6; l++) {
        const colX = 72 + c * 56;
        const len = l === 5 ? 20 + r() * 16 : 38 + r() * 8;
        lines.push({ y: 64 + l * 11, x0: colX, x1: colX + len, w: 2.2, at: 1.25 + c * 1.3 + l * 0.2 });
      }
    }
    lines.forEach((ln, i) => {
      const p = span(lt, ln.at, ln.at + (ln.w > 4 ? 0.4 : 0.22));
      brush(
        ctx,
        segment({ x: ln.x0, y: ln.y }, { x: ln.x1, y: ln.y + 0.4 }, 12),
        { width: ln.w, progress: ease.out(p), seed: seed + 5 + i, taper: 0.5, dry: ln.w > 6 ? 1 : 0, color: pal.ink },
      );
    });

    // Yazan uç: son yazılan satırın başında bir damla.
    const active = lines.find((ln) => lt >= ln.at && lt < ln.at + 0.3);
    if (active) {
      const p = ease.out(span(lt, active.at, active.at + 0.22));
      blot(ctx, active.x0 + (active.x1 - active.x0) * p, active.y, 2.4, {
        seed: seed + 90,
        color: pal.ink,
        });
    }

    // Damga: pirinç renkli küçük zil mührü köşeye basılıyor.
    const stamp = span(lt, 4.1, 4.35);
    if (stamp > 0) {
      const s = 1.6 - 0.6 * ease.back(stamp);
      blot(ctx, 170, 126, 6 * s, { seed: seed + 99, color: pal.spark, alpha: clamp(stamp * 2), spread: 1 });
      splatter(ctx, 170, 126, (lt - 4.3) * 1.4, { seed: seed + 100, count: 5, reach: 16, size: 1.5, color: pal.spark });
    }
  },
};

export const INK_SCENES = { intro, searching, chart, press } satisfies Record<string, InkScene>;
export type InkSceneName = keyof typeof INK_SCENES;

/** Gerçek saati sahnenin saatine çevirir: sonda durur. */
export function sceneTime(scene: InkScene, t: number) {
  return Math.min(t, scene.end);
}
