"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ACTS, CURTAIN_S, filmCues, renderFilm, type FilmData, type FilmPalette, type FilmText } from "@/lib/ink/analysis-film";
import type { Point } from "@/lib/ink/engine";
import { muteFilmSound, playCue, primeFilmSound, setSoundPreferred, soundPreferred } from "./filmSound";
import { formatPrice } from "@/lib/utils";
import styles from "./AnalysisFilm.module.css";

export type FilmBar = { o: number; h: number; l: number; c: number };
type T = Dictionary["aiAnalysis"];

/** Perde bitince rapor sekmesine geçilir (ClaudeWorkbench). */
export const CURTAIN_MS = CURTAIN_S * 1000;
/** Hareketi azaltana her perdenin SON karesi (sn): film değil, o adımın resmi.
 *  III'ün karesi selin içinde, başlıklar yazılmışken; IV'ünkü kefeler dolarken. */
const STILL_AT = [ACTS[1] - 0.05, ACTS[2] - 1.45, ACTS[3] - 1.3, ACTS[3] + 5];
const NUMERALS = ["I", "II", "III", "IV"] as const;
/** Perdelerin süresi (ms) — ilerleme çizgisi gerçek süreyle dolsun; IV sonuca kadar sürer. */
const ACT_MS = ACTS.map((start, i) => i < ACTS.length - 1 ? (ACTS[i + 1] - start) * 1000 : 5000);
/** Sel ekranın bu kadarını kapladıysa altyazı kâğıt rengine döner. */
const INVERT_AT = 0.72;
const MAX_DPR = 2;
/** Bundan uzun bir boşlukta (sekme arka planda, film ekran dışında) kaçırılan ses olayları çalınmaz. */
const CUE_GAP_S = 0.5;
/** Ekran dışını erken sezmek için kenar payı (anatomy: rootMargin 120px). */
const VIEW_MARGIN = "120px 0px";

function rsi14(closes: number[]) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/**
 * CANLI KÜNYE (11 Ekim; anatomy skill'inin "readout" kuralı: kartın köşesinde,
 * çizimin kendisini çizen veriden gerçek sayılar). Perde I'in seans sayısı ve
 * son kapanışı tuvaldeki mumların aynısı; II'nin RSI'ı ve 20 günlük ortalaması
 * tuvaldeki çizgilerin aynısı; III'ün manşet sayısı tuvale düşen başlıkların
 * sayısı (en fazla 5); IV gerçekten geçen süre. Uydurma bir ilerleme yüzdesi
 * yok: Claude'un ne kadar sürdüğünü bilmiyoruz, ne kadar geçtiğini biliyoruz.
 */
function readoutOf(act: number, bars: FilmBar[], headlines: string[], seconds: number, R: T["claude"]["film"]["readout"], F: T["claude"]["film"], locale: Locale) {
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  // Sitenin para biçimi (lib/utils → formatPrice): "124,77 $", birim sayıdan kopmaz.
  const money = (v: number) => formatPrice(v, locale, { currency: true });
  const closes = bars.map(b => b.c);
  const last = closes.at(-1);
  if (act === 0) return [R.sessions.replace("{n}", String(bars.length)), last !== undefined ? `${F.last} ${money(last)}` : null].filter(Boolean).join(" · ");
  if (act === 1) {
    const rsi = rsi14(closes);
    const ma = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
    return [rsi !== null ? `RSI ${rsi.toLocaleString(tag, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}` : null, ma !== null ? `${F.ma20} ${money(ma)}` : null].filter(Boolean).join(" · ");
  }
  if (act === 2) return R.headlines.replace("{n}", String(Math.min(5, headlines.length)));
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
  return R.elapsed.replace("{t}", `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
}

function readPalette(): FilmPalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    // Kâğıt OPAK sayfa zemini: selin içindeki yazı onunla çizilir; `--surface-sunken` yarı saydam.
    ink: v("--text-strong", "#101c2b"), spark: v("--brass", "#a4720f"), paper: v("--page-bg", "#f7f9fb"),
    up: v("--up", "#0f8a5f"), down: v("--down", "#c2353b"), muted: v("--text-muted", "#5b6878"),
    brassInk: v("--brass-ink", "#8a5f0c"), plate: v("--logo-plate", "#ffffff"), font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

/**
 * Bekleme filmi: tek mürekkep çizgisinin kesilmeyen planı (`lib/ink/analysis-film.ts`).
 * Tuval süs (`aria-hidden`); ne olduğu altyazıda ve `role="status"` ile söylenir.
 * Sel ekranı kapladığında altyazı kâğıt rengine döner (`data-inverted`); son
 * perdede "Rapor Hazır" tuvalde dev yazıyla çizildiği için altyazı yalnız
 * ekran okuyucuda kalır.
 */
export function AnalysisFilm({ bars, headlines, symbol, name, logoUrl, logoImage, done, t, locale, minHeight, origin }: {
  bars: FilmBar[]; headlines: string[]; symbol: string; name: string; logoUrl: string | null; done: boolean; t: T; locale: Locale;
  /** Açılış sahnesinin boyu: film aynı kutuda başlasın (ClaudeWorkbench). En-boy oranı o
   *  zaman kapanır: oran + min-height genişliğe de aktarılıyor, telefonda kutu taşıyordu. */
  minHeight?: number | null;
  /** Düğmenin büzüldüğü damlanın sahnedeki yeri: film o damlayla açılır. */
  origin?: Point | null;
  /** Açılış sahnesinin önceden çözdüğü logo (ClaudeWorkbench); yoksa film kendisi indirir. */
  logoImage?: HTMLImageElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef<number | null>(null);
  /** Filmin başladığı an (performance.now); bitiş anı buna göre saniye. */
  const startedRef = useRef(0);
  const [act, setAct] = useState(0);
  const [inverted, setInverted] = useState(false);
  /** Geçen tam saniye: IV. perdenin künyesi (saniyede bir yazılır, her karede değil). */
  const [seconds, setSeconds] = useState(0);
  // Ses varsayılan kapalı; tercih tarayıcıda (filmSound.ts). Film yalnız istemcide çizildiği için ilk değer doğrudan okunur.
  const [sound, setSound] = useState(soundPreferred);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  const S = t.claude.scenes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Logo tuvale çizilir; inmeden önce yerine harfli karo durur (render her karede `complete`a bakar).
    const logo = logoImage ?? (logoUrl ? Object.assign(new Image(), { decoding: "async", src: logoUrl }) : null);
    const data: FilmData = { closes: bars.map(b => b.c), highs: bars.map(b => b.h), lows: bars.map(b => b.l), headlines, rsi: rsi14(bars.map(b => b.c)), logo, origin };
    const F = t.claude.film;
    const text: FilmText = {
      symbol, name, locale: locale === "tr" ? "tr-TR" : "en-US", ...F,
      positive: t.claude.positive, negative: t.claude.negative, ready: t.claude.ready,
    };
    let pal = readPalette();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dpr = 1, w = 0, h = 0, raf = 0;
    startedRef.current = performance.now();
    const clock = () => (performance.now() - startedRef.current) / 1000;

    const resize = () => {
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const box = canvas.getBoundingClientRect();
      w = box.width; h = box.height;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    };
    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const doneAt = doneRef.current;
      const cover = renderFilm(ctx, { t: time, doneAt: doneAt === null ? null : Math.min(doneAt, time) }, pal, data, text, { w, h });
      setInverted(cover >= INVERT_AT);
    };
    const actOf = (time: number) => doneRef.current !== null ? 4 : ACTS.findLastIndex(start => time >= start);
    /** Son çalınan an: her karede (son, şimdi] aralığındaki ses olayları çalar. */
    let heard = 0;
    const cueMeta = { symbolLength: symbol.length, hasOrigin: !!origin, headlines: Math.min(5, headlines.length) };
    /* EKRAN DIŞINDA DURUR (anatomy, motion.md). Film zamana bağlı bir öykü:
       geri gelince kaldığı yerden değil GEÇEN zamandan sürer. Gözlemcinin EN
       YENİ kaydı okunur — ekrandan çıkıp dönen kutu tek çağrıda iki kayıt
       getirir, ilki okunursa film ekrandayken donar. */
    let visible = true, running = false;
    const tick = () => {
      if (!visible) { raf = 0; return; }
      const time = clock();
      draw(time);
      // Uzun boşlukta (sekme arka planda, film ekran dışında) kaçırılan sesler üst üste çalmasın.
      if (soundRef.current && time - heard < CUE_GAP_S) for (const cue of filmCues(heard, time, { ...cueMeta, doneAt: doneRef.current })) playCue(cue);
      heard = time;
      setAct(actOf(time));
      setSeconds(Math.floor(time));
      raf = requestAnimationFrame(tick);
    };
    const still = () => {
      const now = actOf(clock());
      const doneAt = doneRef.current;
      draw(now === 4 && doneAt !== null ? doneAt + CURTAIN_S : STILL_AT[now]);
      setAct(now);
    };
    resize();
    let stillTimer = 0, cancelled = false;
    // Logo henüz çözülmediyse film en fazla 450 ms bekler: damga anında logo hazır
    // olsun (harfli karo yalnız logosu gerçekten olmayan hissede). Bekleme açılış
    // düğmesinin büzülmesinin arkasında kalıyor; boş kâğıt kısa bir an.
    const ready = logo && !(logo.complete && logo.naturalWidth > 0)
      ? Promise.race([logo.decode().catch(() => undefined), new Promise(r => setTimeout(r, 450))])
      : Promise.resolve();
    void ready.then(() => {
      if (cancelled) return;
      startedRef.current = performance.now();
      running = true;
      if (media.matches) { still(); stillTimer = window.setInterval(() => { still(); setSeconds(Math.floor(clock())); }, 500); } else raf = requestAnimationFrame(tick);
    });
    const observer = new ResizeObserver(() => { resize(); if (media.matches) still(); });
    observer.observe(canvas);
    const view = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible && !raf && !media.matches && running && !cancelled) { heard = clock(); raf = requestAnimationFrame(tick); }
    }, { rootMargin: VIEW_MARGIN });
    view.observe(canvas);
    const themeWatch = new MutationObserver(() => { pal = readPalette(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { cancelled = true; cancelAnimationFrame(raf); clearInterval(stillTimer); observer.disconnect(); view.disconnect(); themeWatch.disconnect(); };
  }, [bars, headlines, symbol, name, logoUrl, logoImage, locale, t.claude, origin]);

  useEffect(() => {
    if (done && doneRef.current === null) doneRef.current = (performance.now() - startedRef.current) / 1000;
  }, [done]);

  const caption = act === 4 ? { title: t.claude.ready, line: "" } : S[act];
  const readout = act < 4 ? readoutOf(act, bars, headlines, seconds, t.claude.film.readout, t.claude.film, locale) : "";
  return <div className={styles.stage} role="status" aria-live="polite" aria-label={`${t.claude.stage}: ${caption.title}`}
    data-inverted={inverted ? "" : undefined} data-final={act === 4 ? "" : undefined} style={minHeight ? { minHeight, aspectRatio: "auto" } : undefined}>
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    <button type="button" className={styles.sound} aria-pressed={sound} onClick={() => {
      const next = !sound;
      if (next) primeFilmSound(); else muteFilmSound();
      setSoundPreferred(next); setSound(next);
    }}>
      <svg viewBox="0 0 24 24" aria-hidden><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{sound
        ? <path className={styles.waves} pathLength={1} d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</svg>
      <span>{sound ? t.claude.sound.on : t.claude.sound.off}</span>
    </button>
    <div className={styles.caption} key={act}>
      {act < 4 && <span className={styles.sceneNo}>{NUMERALS[act]}</span>}
      <strong>{caption.title}</strong>
      {caption.line && <span className={styles.line}>{caption.line}</span>}
      {/* Künye ekran okuyucuya okunmaz: canlı bölge yalnız perde değişince konuşur, saniyeyi saymaz. */}
      {readout && <span className={styles.readout} aria-hidden>{readout}</span>}
    </div>
    {/* ADLI PERDE ÇİPLERİ (anatomy'deki sahne sekmeleri): filmin dört perdesi bir
        bakışta, etkin olanın çizgisi gerçek süreyle dolar. Telefonda yalnız numara. */}
    <ol className={styles.progress} aria-hidden>{S.map((s, i) => <li key={s.title} style={{ "--act-ms": `${ACT_MS[i]}ms` } as CSSProperties}
      data-state={act === 4 || i < act ? "done" : i === act ? "active" : "next"}>
      <span className={styles.chip}><b>{NUMERALS[i]}</b><em>{s.title}</em></span>
      <i className={styles.bar} />
    </li>)}</ol>
  </div>;
}
