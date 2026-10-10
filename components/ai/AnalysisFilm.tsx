"use client";
import { useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ACTS, CURTAIN_S, renderFilm, type FilmData, type FilmPalette } from "@/lib/ink/analysis-film";
import styles from "./AnalysisFilm.module.css";

export type FilmBar = { o: number; h: number; l: number; c: number };
type T = Dictionary["aiAnalysis"];

/** Perde bitince rapor sekmesine geçilir (ClaudeWorkbench). */
export const CURTAIN_MS = CURTAIN_S * 1000;
/** Hareketi azaltana her perdenin SON karesi (sn): film değil, o adımın resmi. */
const STILL_AT = [4.4, 9.4, 14.9, 18.5];
const MAX_DPR = 2;

function rsi14(closes: number[]) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

function readPalette(labels: [string, string]): FilmPalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--text-strong", "#101c2b"), spark: v("--brass", "#a4720f"), paper: v("--page-bg", "#f7f9fb"),
    up: v("--up", "#0f8a5f"), down: v("--down", "#c2353b"), muted: v("--text-muted", "#5b6878"),
    font: getComputedStyle(document.body).fontFamily || "sans-serif", labels,
  };
}

/**
 * Bekleme filmi: tek mürekkep çizgisinin beş perdesi (`lib/ink/analysis-film.ts`).
 * Tuval süs (`aria-hidden`); ne olduğu altyazıda ve `role="status"` ile söylenir.
 */
export function AnalysisFilm({ bars, headlines, done, t }: {
  bars: FilmBar[]; headlines: string[]; symbol: string; done: boolean; t: T; locale: Locale;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef<number | null>(null);
  /** Filmin başladığı an (performance.now); bitiş anı buna göre saniye. */
  const startedRef = useRef(0);
  const [act, setAct] = useState(0);
  const S = t.claude.scenes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const data: FilmData = { closes: bars.map(b => b.c), highs: bars.map(b => b.h), lows: bars.map(b => b.l), headlines, rsi: rsi14(bars.map(b => b.c)) };
    const labels: [string, string] = [t.claude.positive, t.claude.negative];
    let pal = readPalette(labels);
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
      renderFilm(ctx, { t: time, doneAt: doneAt === null ? null : Math.min(doneAt, time) }, pal, data, { w, h });
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
    const themeWatch = new MutationObserver(() => { pal = readPalette(labels); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { cancelAnimationFrame(raf); clearInterval(stillTimer); observer.disconnect(); themeWatch.disconnect(); };
  }, [bars, headlines, t.claude.positive, t.claude.negative]);

  useEffect(() => {
    if (done && doneRef.current === null) doneRef.current = (performance.now() - startedRef.current) / 1000;
  }, [done]);

  const caption = act === 4 ? { title: t.claude.ready, line: "" } : S[act];
  return <div className={styles.stage} role="status" aria-live="polite" aria-label={`${t.claude.stage}: ${caption.title}`}>
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    <div className={styles.caption} key={act} data-final={act === 4 ? "" : undefined}>
      {act < 4 && <span className={styles.sceneNo}>{["I", "II", "III", "IV"][act]}</span>}
      <strong>{caption.title}</strong>
      {caption.line && <span>{caption.line}</span>}
    </div>
    <div className={styles.progress} aria-hidden>{S.map((s, i) => <span key={s.title} data-state={act === 4 || i < act ? "done" : i === act ? "active" : "next"} />)}</div>
  </div>;
}
