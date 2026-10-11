"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ACTS, CURTAIN_S, renderFilm, type FilmData, type FilmPalette, type FilmText } from "@/lib/ink/analysis-film";
import styles from "./AnalysisFilm.module.css";

export type FilmBar = { o: number; h: number; l: number; c: number };
type T = Dictionary["aiAnalysis"];

/** Perde bitince rapor sekmesine geçilir (ClaudeWorkbench). */
export const CURTAIN_MS = CURTAIN_S * 1000;
/** Hareketi azaltana her perdenin SON karesi (sn): film değil, o adımın resmi.
 *  III'ün karesi selin içinde, başlıklar yazılmışken; IV'ünkü kefeler dolarken. */
const STILL_AT = [4.95, 8.6, 14.6, 21];
/** Perdelerin süresi (ms) — ilerleme çizgisi gerçek süreyle dolsun; IV sonuca kadar sürer. */
const ACT_MS = ACTS.map((start, i) => i < ACTS.length - 1 ? (ACTS[i + 1] - start) * 1000 : 5000);
/** Sel ekranın bu kadarını kapladıysa altyazı kâğıt rengine döner. */
const INVERT_AT = 0.72;
const MAX_DPR = 2;

function rsi14(closes: number[]) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

function readPalette(): FilmPalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    // Kâğıt OPAK sayfa zemini: selin içindeki yazı onunla çizilir; `--surface-sunken` yarı saydam.
    ink: v("--text-strong", "#101c2b"), spark: v("--brass", "#a4720f"), paper: v("--page-bg", "#f7f9fb"),
    up: v("--up", "#0f8a5f"), down: v("--down", "#c2353b"), muted: v("--text-muted", "#5b6878"),
    brassInk: v("--brass-ink", "#8a5f0c"), font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

/**
 * Bekleme filmi: tek mürekkep çizgisinin kesilmeyen planı (`lib/ink/analysis-film.ts`).
 * Tuval süs (`aria-hidden`); ne olduğu altyazıda ve `role="status"` ile söylenir.
 * Sel ekranı kapladığında altyazı kâğıt rengine döner (`data-inverted`); son
 * perdede "Rapor Hazır" tuvalde dev yazıyla çizildiği için altyazı yalnız
 * ekran okuyucuda kalır.
 */
export function AnalysisFilm({ bars, headlines, symbol, done, t, locale }: {
  bars: FilmBar[]; headlines: string[]; symbol: string; done: boolean; t: T; locale: Locale;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef<number | null>(null);
  /** Filmin başladığı an (performance.now); bitiş anı buna göre saniye. */
  const startedRef = useRef(0);
  const [act, setAct] = useState(0);
  const [inverted, setInverted] = useState(false);
  const S = t.claude.scenes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const data: FilmData = { closes: bars.map(b => b.c), highs: bars.map(b => b.h), lows: bars.map(b => b.l), headlines, rsi: rsi14(bars.map(b => b.c)) };
    const F = t.claude.film;
    const text: FilmText = {
      symbol, locale: locale === "tr" ? "tr-TR" : "en-US", ...F,
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
    const tick = () => {
      const time = clock();
      draw(time);
      setAct(actOf(time));
      raf = requestAnimationFrame(tick);
    };
    const still = () => {
      const now = actOf(clock());
      const doneAt = doneRef.current;
      draw(now === 4 && doneAt !== null ? doneAt + CURTAIN_S : STILL_AT[now]);
      setAct(now);
    };
    resize();
    let stillTimer = 0;
    if (media.matches) { still(); stillTimer = window.setInterval(still, 500); } else raf = requestAnimationFrame(tick);
    const observer = new ResizeObserver(() => { resize(); if (media.matches) still(); });
    observer.observe(canvas);
    const themeWatch = new MutationObserver(() => { pal = readPalette(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { cancelAnimationFrame(raf); clearInterval(stillTimer); observer.disconnect(); themeWatch.disconnect(); };
  }, [bars, headlines, symbol, locale, t.claude]);

  useEffect(() => {
    if (done && doneRef.current === null) doneRef.current = (performance.now() - startedRef.current) / 1000;
  }, [done]);

  const caption = act === 4 ? { title: t.claude.ready, line: "" } : S[act];
  return <div className={styles.stage} role="status" aria-live="polite" aria-label={`${t.claude.stage}: ${caption.title}`}
    data-inverted={inverted ? "" : undefined} data-final={act === 4 ? "" : undefined}>
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    <div className={styles.caption} key={act}>
      {act < 4 && <span className={styles.sceneNo}>{["I", "II", "III", "IV"][act]}</span>}
      <strong>{caption.title}</strong>
      {caption.line && <span>{caption.line}</span>}
    </div>
    <div className={styles.progress} aria-hidden>{S.map((s, i) => <span key={s.title} style={{ "--act-ms": `${ACT_MS[i]}ms` } as CSSProperties}
      data-state={act === 4 || i < act ? "done" : i === act ? "active" : "next"} />)}</div>
  </div>;
}
