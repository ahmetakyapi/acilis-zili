/**
 * Mürekkep motoru — sahnelerin ortak fırçası.
 *
 * Her şey `renderFrame(t)` ile çizilir ve t'nin SAF fonksiyonudur: aynı
 * tohumla aynı saniye her seferinde aynı kareyi verir. Durum tutan bir
 * parçacık sistemi yok; sıçrayan damlalar bile tohumdan ve zamandan
 * hesaplanıyor. Bunun iki kazancı var: hareketi azaltan okuyucuya sahnenin
 * SON karesi tek çağrıyla basılabiliyor ve sekme arka plana düşüp geri
 * geldiğinde animasyon kaldığı yerden değil, olması gereken yerden devam
 * ediyor.
 *
 * Bu modül `"use client"` DEĞİL: yalnızca Canvas API'sine dokunuyor ve
 * tarayıcıda çağrılıyor, ama sabitleri sunucudan da okunabilsin diye
 * sınırın dışında duruyor (bkz. CLAUDE.md → İstemci ile sunucu sınırı).
 */

export type Point = { x: number; y: number };

export type InkPalette = {
  /** Fırçanın rengi — temanın en koyu metin tonu. */
  ink: string;
  /** Kıvılcım — zilin pirinci. Mavi yalnızca etkileşime ait. */
  spark: string;
  /** Kâğıt — sayfa zemini; silme ve "kuruma" için. */
  paper: string;
};

/* ----------------------------------------------------------------------- */
/* Tohumlu rastgelelik ve gürültü                                           */
/* ----------------------------------------------------------------------- */

/** mulberry32 — küçük, hızlı ve tohumdan tamamen belirli. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tek boyutlu değer gürültüsü: -1…1, yumuşak, tohum + konumdan belirli. */
export function noise1(seed: number, x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let v = Math.imul((n + seed * 374761393) | 0, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return (((v ^ (v >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/* ----------------------------------------------------------------------- */
/* Zaman                                                                     */
/* ----------------------------------------------------------------------- */

export const clamp = (v: number, lo = 0, hi = 1) =>
  v < lo ? lo : v > hi ? hi : v;

/** t'nin [a, b] aralığındaki ilerlemesi, 0…1'e kıstırılmış. */
export const span = (t: number, a: number, b: number) =>
  clamp((t - a) / (b - a));

export const ease = {
  inOut: (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  in: (x: number) => x * x * x,
  /** Hafif taşan varış — ezilip geri gelen bir damla, sıçrayan bir göz. */
  back: (x: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  },
};

/** Sönen salınım: bir vuruştan sonra sallanan zil. */
export const damped = (t: number, freq: number, decay: number) =>
  t <= 0 ? 0 : Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * decay);

/* ----------------------------------------------------------------------- */
/* Eğriler                                                                   */
/* ----------------------------------------------------------------------- */

/** Kübik Bézier'i `n` noktaya örnekler. */
export function cubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  n = 32,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const m = 1 - t;
    out.push({
      x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
      y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Kübik parçalardan oluşan bir yol: ardışık dörtlüler, uçlar ortak. */
export function path(points: Point[], per = 24): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 3 < points.length; i += 3) {
    const seg = cubic(points[i], points[i + 1], points[i + 2], points[i + 3], per);
    out.push(...(out.length ? seg.slice(1) : seg));
  }
  return out;
}

/** Düz bir çizgiyi örnekler. Fırçanın basınç eğrisi örnekler üzerinden
 *  işliyor: iki noktalık bir çizgi iki ucunda da sıfır kalınlıkta kalır. */
export function segment(a: Point, b: Point, n = 10): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

export function transform(
  pts: Point[],
  { x = 0, y = 0, s = 1, r = 0, ox = 0, oy = 0 },
): Point[] {
  const c = Math.cos(r);
  const sn = Math.sin(r);
  return pts.map((p) => {
    const dx = (p.x - ox) * s;
    const dy = (p.y - oy) * s;
    return { x: ox + x + dx * c - dy * sn, y: oy + y + dx * sn + dy * c };
  });
}

/* ----------------------------------------------------------------------- */
/* Fırça                                                                     */
/* ----------------------------------------------------------------------- */

export type BrushOptions = {
  width: number;
  /** Çizginin ne kadarı çizildi (0…1) — "yazılıyor" etkisi. */
  progress?: number;
  seed?: number;
  /** Uçlardaki incelme; 0 düz kalem, 1 tam fırça. */
  taper?: number;
  /** Başlangıç ucunun incelmesi, verilmezse `taper`. İki yarımın buluştuğu
   *  yerde 0: birleşim yerinde boğum kalmasın. */
  taperStart?: number;
  /** Kenar titremesi — kâğıdın emdiği mürekkep. */
  wobble?: number;
  /** Kuru fırça izleri: çizginin içinde ince, kesik boşluklar. */
  dry?: number;
  alpha?: number;
  color: string;
};

/**
 * Değişken kalınlıklı fırça darbesi.
 *
 * Çizgi, merkez hattının iki yanına basınç eğrisi kadar açılan bir dolgu
 * çokgeni olarak çiziliyor — `lineWidth` tek bir kalınlık taşıyabiliyor,
 * fırçanın asıl karakteri ise basınçta: girişte ince, ortada dolgun,
 * çıkışta sivri. Basınç `sin(πu)^0,55` ile, üstüne tohumlu gürültü.
 */
export function brush(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  o: BrushOptions,
) {
  const progress = clamp(o.progress ?? 1);
  if (progress <= 0 || pts.length < 2) return;
  const seed = o.seed ?? 1;
  const taper = o.taper ?? 1;
  const wobble = o.wobble ?? 0.12;

  // Yay uzunluğuna göre kesim: eşit adımlı olmayan örneklerde bile
  // "yarısı çizildi" gerçekten yolun yarısı.
  const lens = [0];
  for (let i = 1; i < pts.length; i++) {
    lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = lens[lens.length - 1] || 1;
  const cut = total * progress;
  const drawn: Point[] = [];
  const us: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (lens[i] <= cut) {
      drawn.push(pts[i]);
      us.push(lens[i] / total);
    } else {
      const prev = pts[i - 1];
      const k = (cut - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      drawn.push({ x: prev.x + (pts[i].x - prev.x) * k, y: prev.y + (pts[i].y - prev.y) * k });
      us.push(progress);
      break;
    }
  }
  if (drawn.length < 2) return;

  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < drawn.length; i++) {
    const a = drawn[Math.max(0, i - 1)];
    const b = drawn[Math.min(drawn.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const u = us[i];
    // Uçtaki incelme, çizilen ucun kendisinde de: fırça kâğıttan kalkarken
    // değil, ilerlerken de sivri bir baş taşıyor.
    const head = progress < 1 ? clamp((progress - u) / 0.08) : 1;
    const press = Math.pow(Math.sin(Math.PI * clamp(u)), 0.55);
    const tp = u < 0.5 ? (o.taperStart ?? taper) : taper;
    const shape = 1 - tp + tp * press;
    const grain = 1 + noise1(seed, u * 9) * wobble;
    const w = (o.width / 2) * shape * grain * (0.35 + 0.65 * head);
    left.push({ x: drawn[i].x + nx * w, y: drawn[i].y + ny * w });
    right.push({ x: drawn[i].x - nx * w, y: drawn[i].y - ny * w });
  }

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();

  // Kuru fırça: dolgunun içinden kâğıt rengiyle ince, kesik çizgiler.
  // Geniş darbelerde "kıl izi" okunuyor; ince çizgilerde anlamsız.
  const dry = o.dry ?? 0;
  if (dry > 0 && o.width > 6) {
    const r = rng(seed * 7 + 3);
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    const strands = Math.round(2 + dry * 4);
    for (let s = 0; s < strands; s++) {
      const off = (r() - 0.5) * 0.7;
      const from = 0.25 + r() * 0.5;
      const to = Math.min(1, from + 0.15 + r() * 0.4);
      ctx.lineWidth = Math.max(0.6, o.width * 0.05 * (0.6 + r()));
      ctx.globalAlpha = 0.35 + dry * 0.4;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < drawn.length; i++) {
        const u = us[i];
        if (u < from || u > to) continue;
        const px = drawn[i].x + (left[i].x - drawn[i].x) * off * 2;
        const py = drawn[i].y + (left[i].y - drawn[i].y) * off * 2;
        if (!started) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        started = true;
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Mürekkep lekesi: gürültüyle bozulmuş bir daire. `spread` 0'dan 1'e
 * yayılırken kenar dalgası da oturuyor — ıslak mürekkep önce titrek,
 * sonra dingin.
 */
export function blot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  o: {
    seed?: number;
    spread?: number;
    color: string;
    alpha?: number;
    /** Hacmi koruyan ezilme: yatayda açılır, dikeyde basılır (damla, gölge). */
    squash?: number;
    /** Yalnızca dikey ölçek — göz kırpması; genişlik değişmemeli. */
    scaleY?: number;
  },
) {
  const spread = clamp(o.spread ?? 1);
  if (spread <= 0 || r <= 0) return;
  const seed = o.seed ?? 1;
  const squash = o.squash ?? 1;
  const rr = r * ease.out(spread);
  const jag = 0.16 * (1 - spread * 0.6);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + noise1(seed, (i % n) * 0.45) * jag;
    const px = x + Math.cos(a) * rr * k * (1 / squash);
    const py = y + Math.sin(a) * rr * k * squash * (o.scaleY ?? 1);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Sıçrantı: bir çarpma anından sonra dışarı savrulan damlacıklar. Her
 * damlanın yönü, hızı ve boyu tohumdan; konumu zamandan hesaplanıyor.
 */
export function splatter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  o: { seed: number; count: number; reach: number; size: number; color: string; up?: boolean; fade?: number },
) {
  if (t <= 0) return;
  // Kuruyan damlalar: `fade` saniyesinden sonra 0,3 saniyede soluyor —
  // yere inen sıçrantı başka bir şeklin üstünde çil gibi kalmasın.
  const life = o.fade === undefined ? 1 : 1 - clamp((t - o.fade) / 0.3);
  if (life <= 0) return;
  const r = rng(o.seed);
  const k = ease.out(clamp(t / 0.45));
  for (let i = 0; i < o.count; i++) {
    const base = o.up ? -Math.PI / 2 : 0;
    const spreadA = o.up ? Math.PI * 0.9 : Math.PI * 2;
    const a = base + (r() - 0.5) * spreadA;
    const dist = o.reach * (0.35 + r() * 0.65) * k;
    const size = o.size * (0.35 + r() * 0.65);
    // Yukarı savrulanlar yerçekimiyle geri iner.
    const fall = o.up ? 80 * Math.pow(clamp(t), 2) * (0.5 + r()) : 0;
    blot(ctx, x + Math.cos(a) * dist, y + Math.sin(a) * dist + fall, size, {
      seed: o.seed + i,
      spread: clamp(t / 0.2),
      color: o.color,
      alpha: life,
    });
  }
}

/** Kâğıt: sayfa zeminine tohumlu, çok hafif bir lif dokusu. */
export function paperGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  o: { seed: number; color: string; alpha: number },
) {
  const r = rng(o.seed);
  ctx.save();
  ctx.fillStyle = o.color;
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = o.alpha * (0.3 + r() * 0.7);
    const x = r() * w;
    const y = r() * h;
    const l = 2 + r() * 7;
    const a = r() * Math.PI;
    ctx.fillRect(x, y, Math.cos(a) * l || 0.8, 0.8);
  }
  ctx.restore();
}
