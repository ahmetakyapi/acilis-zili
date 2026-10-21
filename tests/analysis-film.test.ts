import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTS, openingTimes } from "../lib/ink/analysis-film";

test("açılış anları sıralı ve I. perdenin içinde biter", () => {
  for (const origin of [false, true]) for (const len of [1, 4, 5, 10]) {
    const T = openingTimes(len, origin);
    // Sembol, logo kayarken yükselmeye başlar (SYM_IN < SLIDE_B bilerek): sıra kayışın BAŞINA göre.
    const order = [T.O, T.SLIDE_A, T.SYM_IN, T.DOT_AT, T.SYM_OUT, T.PEN_A, T.PEN_B];
    order.slice(1).forEach((v, i) => assert.ok(v >= order[i], `${i}: ${order[i]} → ${v}`));
    // Son kapanış künyesi PEN_B + 0,5'te oturur: II başlamadan önce okunacak zaman kalmalı.
    assert.ok(T.PEN_B + 0.5 < ACTS[1], `PEN_B ${T.PEN_B}`);
    assert.ok(T.PEN_B - T.PEN_A >= 1.2, `kalem ${T.PEN_B - T.PEN_A} sn`);
  }
});

test("perdeler ölçü başında (120 BPM, ölçü 4 vuruş)", async () => {
  const { BEAT } = await import("../lib/ink/analysis-film");
  for (const at of ACTS) assert.equal((at / (4 * BEAT)) % 1, 0, `perde ${at} sn ölçüde değil`);
});

test("III'te uzun bir başlık da okunacak kadar durur (harf ÷ 15 + 1,5 sn)", async () => {
  const { BEAT, HEADLINE_AT, HEADLINE_STEP, FLOOD_OUT, holdFor } = await import("../lib/ink/analysis-film");
  // 55 harflik başlık (boşluksuz): gerçek manşetlerin uzun ucu. Okuma kuralı harften
  // (motion-film SKILL § 0); kelime başına 0,3 sn uzun Türkçe kelimede kısa kalıyordu.
  const long = "Analistler bellek talebindeki artış sonrası hedefini yükseltti";
  assert.ok(long.replace(/\s+/g, "").length >= 55);
  const lastStart = ACTS[2] + HEADLINE_AT + 4 * HEADLINE_STEP;
  const typed = lastStart + 1.0; // daktilo en fazla 1 sn
  const floodOut = ACTS[3] + FLOOD_OUT;
  assert.ok(floodOut - typed >= holdFor(long), `bekleme ${floodOut - typed} < ${holdFor(long)}`);
  // Başlıklar sekizlikte iner (yarım vuruş ızgarası).
  assert.equal((HEADLINE_STEP / (BEAT / 2)) % 1, 0);
});

test("renk katmanları opak tona iner (sel tonu)", async () => {
  const { composite, parseColor } = await import("../lib/ink/analysis-film");
  assert.deepEqual(parseColor("#f7f9fb"), [247, 249, 251, 1]);
  assert.deepEqual(parseColor("#fff"), [255, 255, 255, 1]);
  assert.deepEqual(parseColor("rgb(164 114 15 / 0.12)"), [164, 114, 15, 0.12]);
  assert.deepEqual(parseColor("rgba(16, 32, 52, 0.5)"), [16, 32, 52, 0.5]);
  assert.equal(parseColor("var(--x)"), null);
  assert.equal(composite("#000000", "rgb(255 255 255 / 0.5)"), "rgb(128 128 128)");
  // Tanınmayan katman atlanır, zemin tanınmazsa olduğu gibi döner.
  assert.equal(composite("#102030", "bozuk"), "rgb(16 32 48)");
  assert.equal(composite("bozuk", "#fff"), "bozuk");
});

test("CSS degradesi duraklarına ayrışır (marka karosu, dev yazı)", async () => {
  const { parseGradients } = await import("../lib/ink/analysis-film");
  const mark = parseGradients("linear-gradient(180deg, rgb(255 255 255 / 0.22) 0%, rgb(255 255 255 / 0) 50%), linear-gradient(150deg, #5cc4ff 0%, #1f86e0 48%, #0b3f86 100%)");
  assert.equal(mark.length, 2);
  assert.equal(mark[0].angle, 180);
  assert.deepEqual(mark[1].stops.map(s => s.at), [0, 0.48, 1]);
  assert.equal(mark[1].stops[2].color, "#0b3f86");
  // Çok satırlı yazım ve konumsuz duraklar (eşit aralanır).
  const g = parseGradients("linear-gradient(\n    112deg,\n    #0a2140,\n    #0e4a8f,\n    #2493dd\n  )");
  assert.equal(g[0].angle, 112);
  assert.deepEqual(g[0].stops.map(s => s.at), [0, 0.5, 1]);
  assert.deepEqual(parseGradients("none"), []);
});

/**
 * MAVİ MARKA DİLİ, İKİ TEMADA AA (21 Ekim). Sel bir dönem `--text-strong` ile doluyor ve
 * açık temada sayfanın ortasında koyu bir film açıyordu; sonra sahibinin yönüyle film
 * sitenin mavi diline geçti. Altyazının oturduğu en koyu (açıkta) / en açık (koyuda)
 * zemin: `--premium-surface` + `--primary-wash` + `--primary-tint` (alan + selin alt
 * tonu). Altyazının bütün metin renkleri orada ≥ 4,5 tutmalı; başlıklar selin üst
 * tonunda (`--primary-faint`) ve kart zemininde. Değerler globals.css'ten: token değişirse
 * bu test haber verir. Açık tema `:root` bloğunda, koyu `:root[data-theme="dark"]`te;
 * bazı token'lar (premium-surface) ayrı bloklarda tanımlı — hepsi taranır, sonuncu kazanır.
 */
test("mavi zeminde altyazı ve başlıklar iki temada AA (≥ 4,5:1)", async () => {
  const { composite, contrast, filmPalette } = await import("../lib/ink/analysis-film");
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  /** Bir seçicinin bütün bloklarındaki token'lar (sonra tanımlanan öncekini ezer). */
  const tokens = (selectors: string[]) => {
    const out: Record<string, string> = {};
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
      const sel = m[1].split(",").map(x => x.trim().split("\n").pop()!.trim());
      if (!sel.some(x => selectors.includes(x))) continue;
      for (const d of m[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[d[1]] = d[2].trim();
    }
    return out;
  };
  const light = tokens([":root", ':root[data-theme="light"]']);
  const dark = { ...light, ...tokens([':root[data-theme="dark"]']) };
  for (const [theme, tk] of [["açık", light], ["koyu", dark]] as const) {
    // Tarayıcının hesaplanmış değeri gibi: içteki `var(--x)` başvuruları da çözülür
    // (marka karosunun durakları kendi token'larında: `--mark-stop-1…3`).
    const read = (name: string) => { let v = tk[name] ?? ""; for (let i = 0; i < 4 && v.includes("var("); i++) v = v.replace(/var\((--[\w-]+)\)/g, (_, k: string) => tk[k] ?? ""); return v; };
    const p = filmPalette(read, "sans-serif");
    assert.ok(p.mark.length === 2 && p.display.stops.length >= 2, `${theme}: degradeler ayrışmadı`);
    const worst = composite(p.surface, p.primaryWash, p.primaryTint);
    // Altyazının metinleri (başlık, cümle + künye + çip, perde numarası) ve tuvaldeki künyeler (`muted`).
    for (const [name, color] of [["--text-strong", read("--text-strong")], ["--text-body", read("--text-body")], ["--primary-ink", read("--primary-ink")], ["künye", p.muted]]) {
      const r = contrast(color, worst);
      assert.ok(r >= 4.5, `${theme} ${name} altyazı zemininde ${r.toFixed(2)}`);
    }
    // Başlıklar: selin üst tonunda ve kartın üstünde.
    assert.ok(contrast(p.ink, p.wash[0]) >= 4.5, `${theme} başlık selde ${contrast(p.ink, p.wash[0]).toFixed(2)}`);
    assert.ok(contrast(p.ink, p.surface) >= 4.5);
    // Açık temada sel AÇIK kalır (koyu bir film değil), koyuda koyu.
    const { luminance } = await import("../lib/ink/analysis-film");
    if (theme === "açık") assert.ok(luminance(p.wash[0]) > 0.6, "açık temada sel açık tonda kalmalı");
    else assert.ok(luminance(p.wash[0]) < 0.1, "koyu temada sel koyu tonda kalmalı");
  }
});

test("açılış olayları yarım vuruş ızgarasında", () => {
  for (const origin of [false, true]) for (const len of [1, 4, 10]) {
    const T = openingTimes(len, origin);
    for (const v of [T.SYM_IN, T.DOT_AT, T.SYM_OUT, T.PEN_A]) assert.equal((v / 0.25) % 1, 0, `${v} ızgarada değil`);
  }
});
