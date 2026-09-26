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

/* ----------------------------------------------------------------------- */
/* Mercek — büyüteç satırların üstünden geçiyor                             */
/* ----------------------------------------------------------------------- */

/* "Mercek" büyüteç demek: bölümün adı sahnenin kendisi. Büyüteç GERÇEKTEN
   büyütüyor — camın içinde aynı satırlar kırpılıp 1,6 kat ölçekle yeniden
   çiziliyor, yani altındaki metin camda kalınlaşıyor. Sonunda bir satırın
   altı pirinçle çiziliyor: Mercek'in işi tam bu, akışın içinden tek bir
   hikâyeyi seçip altını çizmek. */
const LENS_LINES = [
  { y: 40, x0: 36, x1: 192 },
  { y: 56, x0: 36, x1: 170 },
  { y: 72, x0: 36, x1: 204 },
  { y: 88, x0: 36, x1: 158 },
  { y: 104, x0: 36, x1: 186 },
];
const LENS_R = 25;
const LENS_ZOOM = 1.6;

const lens: InkScene = {
  box: { w: 240, h: 150 },
  end: 3.0,
  render(ctx, t, pal, seed) {
    const doc = () => {
      LENS_LINES.forEach((ln, i) => {
        brush(ctx, segment({ x: ln.x0, y: ln.y }, { x: ln.x1, y: ln.y + 0.5 }, 14), {
          width: i === 2 ? 3 : 2.3,
          progress: ease.out(span(t, 0.04 + i * 0.09, 0.4 + i * 0.09)),
          seed: seed + i,
          taper: 0.5,
          color: pal.ink,
        });
      });
      // Seçilen satırın altı — pirinç, büyüteç oturduktan sonra.
      brush(ctx, segment({ x: 112, y: 79 }, { x: 204, y: 78.5 }, 16), {
        width: 3.4,
        progress: ease.out(span(t, 2.2, 2.62)),
        seed: seed + 20,
        taper: 0.8,
        dry: 0.4,
        color: pal.spark,
      });
    };
    doc();

    const appear = span(t, 0.42, 0.78);
    if (appear <= 0) return;
    const move = ease.inOut(span(t, 0.8, 2.15));
    const cx = 62 + (156 - 62) * move;
    const cy = 82 - 10 * move - 7 * Math.sin(move * Math.PI);
    const r = LENS_R * ease.back(appear);

    // Camın içi: zemin + çok soluk bir cam tonu + büyütülmüş satırlar.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.1, r - 1.5), 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = pal.paper;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = pal.ink;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.translate(cx, cy);
    ctx.scale(LENS_ZOOM, LENS_ZOOM);
    ctx.translate(-cx, -cy);
    doc();
    ctx.restore();

    // Çerçeve ve sap.
    const ring: Point[] = [];
    for (let i = 0; i <= 36; i++) {
      const a = -Math.PI * 0.75 + (i / 36) * Math.PI * 2.08;
      ring.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    brush(ctx, ring, { width: 3.6, progress: ease.out(appear), seed: seed + 30, taper: 0.3, color: pal.ink });
    const k = Math.SQRT1_2;
    brush(
      ctx,
      segment({ x: cx + r * k, y: cy + r * k }, { x: cx + (r + 22) * k, y: cy + (r + 22) * k }, 8),
      { width: 6, progress: ease.out(span(t, 0.62, 0.86)), seed: seed + 31, taper: 0.35, color: pal.ink },
    );

    spark(ctx, pal, 204, 78.5, (t - 2.55) / 0.45, 0.6, seed + 40);
  },
};

/* ----------------------------------------------------------------------- */
/* Bilanço — terazi dengeye geliyor                                          */
/* ----------------------------------------------------------------------- */

/* Bilanço iki tarafın eşitlenmesi. Terazi sola yatık çiziliyor, sağ kefeye
   bir damla düşüyor ve kol salınıp düz duruyor: sayılar okunmadan önce
   "bu ekran dengeyi tartıyor" diyor. Kol açısının işareti: artı, sağ kefe
   aşağıda. */
const SCALE_PIVOT = { x: 120, y: 42 };
const SCALE_ARM = 64;
const SCALE_TILT = -0.2;
const SCALE_DROP_AT = 1.12;

function scaleAngle(t: number) {
  const dt = t - SCALE_DROP_AT;
  if (dt <= 0) return SCALE_TILT;
  return SCALE_TILT * Math.exp(-dt * 2.3) * Math.cos(dt * 2.4 * Math.PI * 2);
}

const ledger: InkScene = {
  box: { w: 240, h: 150 },
  end: 3.2,
  render(ctx, t, pal, seed) {
    const { x: px, y: py } = SCALE_PIVOT;
    blot(ctx, 120, 134, 30, { seed: seed + 50, spread: span(t, 0.1, 0.5), color: pal.ink, alpha: 0.1, squash: 0.3 });

    // Ayak ve taban.
    brush(ctx, segment({ x: px, y: py + 4 }, { x: px + 0.5, y: 126 }, 12), {
      width: 5.5, progress: ease.inOut(span(t, 0, 0.36)), seed: seed + 1, taper: 0.3, color: pal.ink,
    });
    brush(ctx, path([{ x: 90, y: 130 }, { x: 110, y: 127 }, { x: 130, y: 127 }, { x: 150, y: 130 }], 16), {
      width: 6, progress: ease.out(span(t, 0.22, 0.5)), seed: seed + 2, taper: 0.7, dry: 0.5, color: pal.ink,
    });

    const a = scaleAngle(t);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const left = { x: px - SCALE_ARM * cos, y: py - SCALE_ARM * sin };
    const right = { x: px + SCALE_ARM * cos, y: py + SCALE_ARM * sin };

    // Kol: ortadan iki yana açılıyor.
    const beam = ease.out(span(t, 0.34, 0.64));
    for (const [i, end] of [left, right].entries()) {
      brush(ctx, segment({ x: px, y: py }, end, 12), {
        width: 4.6, progress: beam, seed: seed + 3 + i, taper: 0.5, taperStart: 0, color: pal.ink,
      });
    }

    // İpler ve kefeler — kefe dikey asılı, kolla birlikte iniyor.
    const hang = span(t, 0.56, 0.8);
    const pans = span(t, 0.7, 0.96);
    for (const [i, end] of [left, right].entries()) {
      const bowlY = end.y + 36;
      for (const side of [-1, 1]) {
        brush(ctx, segment(end, { x: end.x + side * 16, y: bowlY }, 8), {
          width: 1.6, progress: ease.out(hang), seed: seed + 10 + i * 2 + side, taper: 0.2, color: pal.ink,
        });
      }
      brush(
        ctx,
        path([{ x: end.x - 21, y: bowlY }, { x: end.x - 10, y: bowlY + 8 }, { x: end.x + 10, y: bowlY + 8 }, { x: end.x + 21, y: bowlY }], 14),
        { width: 4.2, progress: ease.out(pans), seed: seed + 14 + i, taper: 0.6, color: pal.ink },
      );
    }

    // Sol kefede baştan duran ağırlık.
    const weight = span(t, 0.88, 1.04);
    if (weight > 0) {
      blot(ctx, left.x, left.y + 38, 6.5, { seed: seed + 20, spread: ease.back(weight), color: pal.ink });
    }

    // Sağ kefeye düşen damla; düştükten sonra kefeyle birlikte hareket ediyor.
    const fall = span(t, 0.78, SCALE_DROP_AT);
    if (fall > 0 && fall < 1) {
      const y = -8 + (right.y + 36 - -8) * ease.in(fall);
      blot(ctx, right.x, y, 5, { seed: seed + 21, color: pal.ink, squash: 1 + fall * 0.6 });
    } else if (fall >= 1) {
      blot(ctx, right.x, right.y + 38, 6.5, { seed: seed + 22, color: pal.ink });
      splatter(ctx, right.x, right.y + 36, t - SCALE_DROP_AT, {
        seed: seed + 23, count: 6, reach: 18, size: 1.8, color: pal.ink, up: true, fade: 0.35,
      });
    }

    // Denge bulundu: pirinç düğme ve bir kıvılcım.
    blot(ctx, px, py, 4.6, { seed: seed + 30, spread: ease.back(span(t, 0.55, 0.72)), color: pal.ink });
    const settle = span(t, 2.62, 2.8);
    if (settle > 0) blot(ctx, px, py, 3.6, { seed: seed + 31, spread: ease.back(settle), color: pal.spark });
    spark(ctx, pal, px, py, (t - 2.66) / 0.5, 0.75, seed + 32);
  },
};

/* ----------------------------------------------------------------------- */
/* Merhaba — giriş ve kayıt                                                 */
/* ----------------------------------------------------------------------- */

/** Kalp — klasik parametrik eğri, `s` ölçeğinde. */
function heartPoints(cx: number, cy: number, s: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    pts.push({ x: cx + x * s, y: cy + y * s });
  }
  return pts;
}

/* Hesap ekranının karşılaması. Zil iki kez çalıp selam veriyor; yanında
   pirinç bir kalp beliriyor — hesabın okuyucuya verdiği asıl şey takip
   listesi. Kalp tek bir kez yükselip yerinde duruyor, atmıyor: sürekli
   atan bir kalp formun yanında dikkat dağıtırdı. */
const hello: InkScene = {
  box: { w: 240, h: 150 },
  end: 2.8,
  render(ctx, t, pal, seed) {
    blot(ctx, 112, 132, 17, { seed: seed + 50, spread: span(t, 0.05, 0.45), color: pal.ink, alpha: 0.12, squash: 0.42 });
    const swing = 0.22 * damped(t - 0.78, 1.5, 1.4);
    const blinkT = t - 2.05;
    const blink = blinkT > 0 && blinkT < 0.16 ? Math.sin((blinkT / 0.16) * Math.PI) : 0;
    drawBell(ctx, pal, {
      x: 112,
      y: 78,
      s: 0.8,
      swing,
      outline: span(t, 0, 0.5),
      lip: span(t, 0.4, 0.56),
      hanger: span(t, 0.45, 0.6),
      wash: span(t, 0.5, 0.72),
      clapper: span(t, 0.55, 0.7),
      eyes: span(t, 0.6, 0.76),
      blink,
      look: 0.5 * ease.inOut(span(t, 1.3, 1.6)),
      smile: span(t, 0.7, 0.9),
      seed,
    });
    ringArcs(ctx, pal, 112, 76, (t - 0.86) / 0.75, 0.8);
    ringArcs(ctx, pal, 112, 76, (t - 1.2) / 0.75, 0.8);

    const rise = span(t, 1.2, 1.7);
    if (rise > 0) {
      const cy = 64 - 14 * ease.out(rise);
      const pts = heartPoints(184, cy, 0.62 * ease.back(rise));
      ctx.save();
      ctx.globalAlpha = clamp(rise * 1.6);
      ctx.fillStyle = pal.spark;
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      spark(ctx, pal, 184, cy, (t - 1.55) / 0.5, 0.55, seed + 60);
    }
  },
};

/* ----------------------------------------------------------------------- */
/* Kayıp — 404                                                               */
/* ----------------------------------------------------------------------- */

/* "Sayfa bulunamadı"nın kelimesi kelimesine hâli: zilin yanında duran
   yaprak rüzgârla uçup gidiyor, zil gözüyle onu izliyor ve sonra okuyucuya
   dönüyor. Suçlu kimse değil; sayfa yerinde değil. Altındaki kısayollar
   "o zaman buradan devam et" diyor. */
const lost: InkScene = {
  box: { w: 240, h: 150 },
  end: 3.6,
  render(ctx, t, pal, seed) {
    blot(ctx, 86, 132, 16, { seed: seed + 50, spread: span(t, 0.05, 0.45), color: pal.ink, alpha: 0.12, squash: 0.42 });

    // Rüzgâr: yaprağın ÜSTÜNDEN geçen üç kuru darbe, geçip soluyor. İlk
    // taslakta soldan esip zilin gövdesini kesiyordu; zil çizik gibi duruyordu.
    for (let i = 0; i < 3; i++) {
      const w = span(t, 0.86 + i * 0.07, 1.28 + i * 0.07);
      if (w <= 0) continue;
      const y = 60 + i * 11;
      brush(ctx, path([{ x: 128, y }, { x: 152, y: y - 3 }, { x: 176, y: y + 1 }, { x: 204, y: y - 3 }], 14), {
        width: 2.4, progress: ease.out(w), seed: seed + 70 + i, taper: 1, dry: 1,
        alpha: 1 - span(t, 1.5 + i * 0.06, 2.0), color: pal.ink,
      });
    }

    const lookOut = ease.inOut(span(t, 1.05, 1.35));
    const lookBack = ease.inOut(span(t, 2.55, 2.85));
    const look = lookOut - lookBack;
    const blinkT = t - 3.05;
    const blink = blinkT > 0 && blinkT < 0.16 ? Math.sin((blinkT / 0.16) * Math.PI) : 0;
    drawBell(ctx, pal, {
      x: 86,
      y: 80,
      s: 0.78,
      swing: 0.05 * look + 0.04 * damped(t - 0.95, 1.2, 2),
      outline: span(t, 0, 0.5),
      lip: span(t, 0.4, 0.55),
      hanger: span(t, 0.45, 0.6),
      wash: span(t, 0.5, 0.72),
      clapper: span(t, 0.55, 0.7),
      eyes: span(t, 0.62, 0.78),
      blink,
      look,
      smile: 0,
      seed,
    });

    // Yaprak gidince zilin üstünde üç nokta: söyleyecek bir şey yok. Yaprağın
    // erken dönüşlerinden ÖNCE çiziliyor, yoksa yaprak sönünce hiç çıkmıyordu.
    for (let d = 0; d < 3; d++) {
      const dot = span(t, 2.95 + d * 0.1, 3.08 + d * 0.1);
      if (dot > 0) blot(ctx, 114 + d * 8, 36, 2.2, { seed: seed + 90 + d, spread: ease.back(dot), color: pal.ink });
    }

    // Yaprak: önce yerde, eğik; sonra dönerek sağ üste uçuyor.
    const drawn = span(t, 0.2, 0.62);
    if (drawn <= 0) return;
    const f = ease.inOut(span(t, 1.0, 2.5));
    const x = 156 + 64 * f;
    const y = 108 - 86 * f + Math.sin(f * Math.PI * 2) * 7;
    const rot = -0.22 + f * 1.9 + Math.sin(f * Math.PI * 3) * 0.28;
    // Çıkarken tamamen sönüyor: kutunun kenarında kırpılmış bir köşe
    // olarak kalınca bir çizim hatası gibi okunuyordu.
    const alpha = 1 - ease.in(f);
    if (alpha <= 0.01) return;
    const sheet: Point[] = [
      { x: -13, y: -16 }, { x: 13, y: -16 }, { x: 13, y: 16 }, { x: -13, y: 16 }, { x: -13, y: -16 },
    ];
    const at = (q: Point) => ({
      x: x + q.x * Math.cos(rot) - q.y * Math.sin(rot),
      y: y + q.x * Math.sin(rot) + q.y * Math.cos(rot),
    });
    const edge: Point[] = [];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k <= 6; k++) {
        const a = sheet[i];
        const b = sheet[i + 1];
        edge.push(at({ x: a.x + (b.x - a.x) * (k / 6), y: a.y + (b.y - a.y) * (k / 6) }));
      }
    }
    brush(ctx, edge, { width: 2.2, progress: ease.inOut(drawn), seed: seed + 80, taper: 0.2, alpha, color: pal.ink });
    for (let l = 0; l < 3; l++) {
      brush(ctx, segment(at({ x: -8, y: -8 + l * 7 }), at({ x: l === 2 ? 2 : 8, y: -8 + l * 7 }), 6), {
        width: 1.6, progress: ease.out(span(t, 0.5 + l * 0.06, 0.7 + l * 0.06)), seed: seed + 81 + l, taper: 0.5, alpha, color: pal.ink,
      });
    }

  },
};

/* ----------------------------------------------------------------------- */
/* Aksilik — hata sayfası                                                   */
/* ----------------------------------------------------------------------- */

/* Zil çalarken tokmağı kopuyor: yere düşüp sekiyor, yuvarlanıp duruyor,
   zil de dönüp ona bakıyor. Hata ekranının dili bu: bir şey düştü, kimse
   suçlanmıyor ve yerine takılabilir — altındaki "Tekrar Dene" düğmesi
   tam o iş. Tokmağın yolu sabit adımlı bir benzetimle hesaplanıyor; her
   karede baştan kurulduğu için sahne yine `t`nin saf bir fonksiyonu. */
const MISHAP_BELL = { x: 120, y: 66, s: 0.82 };
const MISHAP_DETACH = 1.02;
const MISHAP_GROUND = 131;
const MISHAP_STEP = 1 / 240;

function mishapSwing(t: number) {
  return 0.26 * damped(t - 0.72, 1.35, 1.7);
}

function clapperPath(t: number) {
  const { x, y, s } = MISHAP_BELL;
  const swing = mishapSwing(MISHAP_DETACH);
  const start = placeOne({ x: 0, y: 53 }, { x, y, s, swing: swing * 1.35, seed: 0 });
  let px = start.x;
  let py = start.y;
  let vx = 64;
  let vy = -26;
  let landed: number | null = null;
  let landedX = px;
  const r = 7 * s;
  const steps = Math.floor(Math.max(0, t - MISHAP_DETACH) / MISHAP_STEP);
  for (let i = 0; i < steps; i++) {
    vy += 980 * MISHAP_STEP;
    px += vx * MISHAP_STEP;
    py += vy * MISHAP_STEP;
    if (py >= MISHAP_GROUND - r) {
      py = MISHAP_GROUND - r;
      if (landed === null) {
        landed = MISHAP_DETACH + i * MISHAP_STEP;
        landedX = px;
      }
      vy = Math.abs(vy) > 70 ? -Math.abs(vy) * 0.36 : 0;
      vx *= vy === 0 ? 0.992 : 0.72;
    }
  }
  return { x: px, y: py, landed, landedX };
}

const mishap: InkScene = {
  box: { w: 240, h: 150 },
  end: 3.3,
  render(ctx, t, pal, seed) {
    const { x, y, s } = MISHAP_BELL;
    blot(ctx, x, MISHAP_GROUND + 1, 17, { seed: seed + 50, spread: span(t, 0.05, 0.45), color: pal.ink, alpha: 0.12, squash: 0.42 });

    const free = t >= MISHAP_DETACH;
    const c = free ? clapperPath(t) : null;
    const blinkT = t - 1.22;
    const blink = blinkT > 0 && blinkT < 0.2 ? Math.sin((blinkT / 0.2) * Math.PI) : 0;
    const look = c ? clamp((c.x - x) / 55, -1, 1) * ease.inOut(span(t, 1.35, 1.7)) : 0;
    drawBell(ctx, pal, {
      x,
      y,
      s,
      swing: mishapSwing(t),
      outline: span(t, 0, 0.5),
      lip: span(t, 0.4, 0.55),
      hanger: span(t, 0.45, 0.6),
      wash: span(t, 0.5, 0.7),
      clapper: free ? 0 : span(t, 0.52, 0.66),
      eyes: span(t, 0.6, 0.76),
      blink,
      look,
      smile: 0,
      seed,
    });

    // Kopma anındaki tın: eteğin ucunda pirinç kıvılcım.
    const lipTip = placeOne({ x: 48, y: 38 }, { x, y, s, swing: mishapSwing(MISHAP_DETACH), seed: 0 });
    spark(ctx, pal, lipTip.x, lipTip.y, (t - MISHAP_DETACH) / 0.45, 0.6, seed + 40);

    if (c) {
      blot(ctx, c.x, c.y, 7 * s, { seed: seed + 3, color: pal.ink });
      if (c.landed !== null) {
        // Sıçrantı ilk değdiği yerde kalıyor, yuvarlanan tokmağı izlemiyor.
        splatter(ctx, c.landedX, MISHAP_GROUND - 2, t - c.landed, {
          seed: seed + 60, count: 5, reach: 14, size: 1.6, color: pal.ink, up: true, fade: 0.3,
        });
      }
    }
  },
};

/* ----------------------------------------------------------------------- */
/* Gün şeridi — giriş sayfasının başlığı altında                            */
/* ----------------------------------------------------------------------- */

/* "Zil Çalmadan Önce Hazır Ol" başlığının çizimi: kuru fırçayla bir seans
   şeridi, saat çentikleri soldan sağa düşüyor ve açılış anına pirinç bir
   zil işareti basılıyor. Başlık bir ANI anlatıyor; şerit o anın yerini
   gösteriyor. Sitenin imzası olan gün şeridinin (ana sayfa) mürekkep hâli. */
const STRIP_TICKS = 13;
const STRIP_OPEN = 7;

const dayStrip: InkScene = {
  box: { w: 360, h: 48 },
  end: 2.4,
  render(ctx, t, pal, seed) {
    const x0 = 10;
    const x1 = 350;
    const y = 30;
    brush(ctx, path([{ x: x0, y }, { x: 120, y: y - 1 }, { x: 240, y: y + 0.6 }, { x: x1, y: y - 0.5 }], 30), {
      width: 3.4,
      progress: ease.inOut(span(t, 0, 0.9)),
      seed: seed + 1,
      taper: 0.9,
      dry: 0.7,
      color: pal.ink,
    });
    for (let i = 0; i < STRIP_TICKS; i++) {
      const x = x0 + ((x1 - x0) * i) / (STRIP_TICKS - 1);
      const at = 0.15 + i * 0.055;
      const tall = i % 3 === 0;
      brush(ctx, segment({ x, y: y - (tall ? 9 : 5) }, { x, y: y + (tall ? 3 : 1) }, 4), {
        width: tall ? 2 : 1.4,
        progress: ease.out(span(t, at, at + 0.18)),
        seed: seed + 10 + i,
        taper: 0.4,
        alpha: tall ? 0.85 : 0.5,
        color: pal.ink,
      });
    }
    // Açılış anı: pirinç damga, küçük bir çınlama.
    const ox = x0 + ((x1 - x0) * STRIP_OPEN) / (STRIP_TICKS - 1);
    const stamp = span(t, 1.05, 1.3);
    if (stamp > 0) {
      blot(ctx, ox, y - 15, 6.5 * (1.4 - 0.4 * ease.back(stamp)), { seed: seed + 40, color: pal.spark, alpha: clamp(stamp * 2) });
      brush(ctx, segment({ x: ox - 7, y: y - 8 }, { x: ox + 7, y: y - 8 }, 6), {
        width: 2.4, progress: ease.out(stamp), seed: seed + 41, taper: 0.5, color: pal.spark,
      });
    }
    spark(ctx, pal, ox, y - 15, (t - 1.25) / 0.5, 0.45, seed + 42);
  },
};

/* ----------------------------------------------------------------------- */
/* Glifler — giriş sayfasının özellik satırları                            */
/* ----------------------------------------------------------------------- */

/* Her özellik kendi küçük mürekkep işaretini çiziyor; "01-04" numara
   rozetlerinin yerine. Numara bir SIRA söylüyordu, oysa özelliklerin
   sırası yok; işaret ise özelliğin kendisini söylüyor. Hepsi 48'lik
   kutuda, 1,1-1,4 saniyede biter ve durur. */

const glyphHeart: InkScene = {
  box: { w: 48, h: 48 },
  end: 1.2,
  render(ctx, t, pal, seed) {
    const pts = heartPoints(24, 23, 0.95);
    const fill = span(t, 0.7, 1.1);
    if (fill > 0) {
      ctx.save();
      ctx.globalAlpha = 0.9 * ease.out(fill);
      ctx.fillStyle = pal.spark;
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    brush(ctx, pts, { width: 2.6, progress: ease.inOut(span(t, 0, 0.75)), seed, taper: 0.3, color: pal.ink });
  },
};

const glyphLedger: InkScene = {
  box: { w: 48, h: 48 },
  end: 1.4,
  render(ctx, t, pal, seed) {
    const tilt = 0.28 * Math.exp(-Math.max(0, t - 0.55) * 3.2) * Math.cos(Math.max(0, t - 0.55) * 11);
    const a = t < 0.55 ? 0.28 : tilt;
    const px = 24;
    const py = 13;
    const arm = 15;
    const l = { x: px - arm * Math.cos(a), y: py - arm * Math.sin(a) };
    const r = { x: px + arm * Math.cos(a), y: py + arm * Math.sin(a) };
    brush(ctx, segment({ x: px, y: py }, { x: px, y: 40 }, 6), { width: 2.4, progress: ease.out(span(t, 0, 0.3)), seed, taper: 0.3, color: pal.ink });
    brush(ctx, segment({ x: 16, y: 41 }, { x: 32, y: 41 }, 6), { width: 2.6, progress: ease.out(span(t, 0.15, 0.4)), seed: seed + 1, taper: 0.5, color: pal.ink });
    brush(ctx, segment(l, r, 8), { width: 2.2, progress: ease.out(span(t, 0.25, 0.5)), seed: seed + 2, taper: 0.4, color: pal.ink });
    for (const [i, end] of [l, r].entries()) {
      const pan = span(t, 0.4, 0.65);
      // Kefe: dört noktalı eğri — `path` kübik parçalar kuruyor, üç noktayla
      // hiç çizilmiyordu (önizlemede terazi "T" gibi duruyordu).
      brush(ctx, path([{ x: end.x - 7, y: end.y + 10 }, { x: end.x - 3, y: end.y + 14 }, { x: end.x + 3, y: end.y + 14 }, { x: end.x + 7, y: end.y + 10 }], 10), {
        width: 2.4, progress: ease.out(pan), seed: seed + 3 + i, taper: 0.5, color: pal.ink,
      });
      brush(ctx, segment(end, { x: end.x, y: end.y + 10 }, 4), { width: 1, progress: ease.out(pan), seed: seed + 5 + i, taper: 0.2, alpha: 0.7, color: pal.ink });
    }
    blot(ctx, px, py, 2.4, { seed: seed + 8, spread: ease.back(span(t, 1.0, 1.2)), color: pal.spark });
  },
};

const glyphPress: InkScene = {
  box: { w: 48, h: 48 },
  end: 1.3,
  render(ctx, t, pal, seed) {
    const sheet = [{ x: 13, y: 8 }, { x: 35, y: 7 }, { x: 36, y: 41 }, { x: 13, y: 42 }, { x: 13, y: 8 }];
    const edge: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const a = sheet[i];
      const b = sheet[i + 1];
      for (let k = 0; k <= 5; k++) edge.push({ x: a.x + (b.x - a.x) * (k / 5), y: a.y + (b.y - a.y) * (k / 5) });
    }
    brush(ctx, edge, { width: 2, progress: ease.inOut(span(t, 0, 0.5)), seed, taper: 0.2, color: pal.ink });
    [16, 22, 28, 34].forEach((y, i) => {
      brush(ctx, segment({ x: 18, y }, { x: i === 0 ? 31 : i === 3 ? 25 : 30, y }, 6), {
        width: i === 0 ? 2.6 : 1.5, progress: ease.out(span(t, 0.45 + i * 0.14, 0.62 + i * 0.14)), seed: seed + 2 + i, taper: 0.5, color: pal.ink,
      });
    });
    blot(ctx, 33, 38, 2.6, { seed: seed + 9, spread: ease.back(span(t, 1.05, 1.25)), color: pal.spark });
  },
};

const glyphFree: InkScene = {
  box: { w: 48, h: 48 },
  end: 1.3,
  render(ctx, t, pal, seed) {
    // Etiket: köşesi kesik bir kart, delik ve pirinç bir onay.
    const tag = [{ x: 14, y: 12 }, { x: 34, y: 12 }, { x: 40, y: 24 }, { x: 34, y: 36 }, { x: 14, y: 36 }, { x: 14, y: 12 }];
    const edge: Point[] = [];
    for (let i = 0; i < tag.length - 1; i++) {
      const a = tag[i];
      const b = tag[i + 1];
      for (let k = 0; k <= 5; k++) edge.push({ x: a.x + (b.x - a.x) * (k / 5), y: a.y + (b.y - a.y) * (k / 5) });
    }
    brush(ctx, edge, { width: 2.2, progress: ease.inOut(span(t, 0, 0.6)), seed, taper: 0.2, color: pal.ink });
    blot(ctx, 33, 24, 2, { seed: seed + 3, spread: ease.back(span(t, 0.55, 0.7)), color: pal.ink });
    // Onay iki düz parça: üç noktalı `path` çizmiyordu (önizlemede yoktu).
    const check = [...segment({ x: 18, y: 24 }, { x: 22, y: 29 }, 6), ...segment({ x: 22, y: 29 }, { x: 29, y: 18 }, 8).slice(1)];
    brush(ctx, check, {
      width: 3, progress: ease.out(span(t, 0.75, 1.15)), seed: seed + 4, taper: 0.6, color: pal.spark,
    });
  },
};

export const INK_SCENES = { intro, searching, chart, press, lens, ledger, hello, lost, mishap, dayStrip, glyphHeart, glyphLedger, glyphPress, glyphFree } satisfies Record<string, InkScene>;
export type InkSceneName = keyof typeof INK_SCENES;

/** Gerçek saati sahnenin saatine çevirir: sonda durur. */
export function sceneTime(scene: InkScene, t: number) {
  return Math.min(t, scene.end);
}
