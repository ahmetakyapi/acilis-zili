"use client";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import styles from "./AnalysisFilm.module.css";

export type FilmBar = { o: number; h: number; l: number; c: number };
type T = Dictionary["aiAnalysis"];

/** Sahnelerin başladığı an (ms): ölçülen 20–30 sn'lik üretimin gerçek iş sırası. */
const SCENE_STARTS_MS = [0, 4_500, 9_500, 15_000];
const TICK_MS = 250;
/** Perde: sonuç gelince "Rapor Hazır" bu kadar görünür, sonra rapor sekmesi. */
export const CURTAIN_MS = 1_400;
const VIEW_W = 640;
const VIEW_H = 300;
const PAD_Y = 0.08;

const sma = (closes: number[], n: number) => closes.map((_, i) => i + 1 < n ? null : closes.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n);
function rsi14(closes: number[]) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/**
 * Üretim beklerken oynayan kısa film — dört sahne, hepsi O HİSSENİN verisi.
 *
 * Bekleme 20–30 saniye ve kullanıcı ekrana bakıyor: "Hazırlanıyor…" yazısı
 * yerine yapılan işi gösteriyoruz. Mumlar (sunucunun verdiği son 3 ay),
 * ortalamalar ve RSI (aynı mumlardan burada hesaplanır; raporun sayıları
 * değil, yalnız sahne), son haber başlıkları ve kanıtı tartan terazi.
 * Sahneler zamanla ilerler; son sahne sonuç gelene kadar hafifçe döner
 * (bekleme göstergesi — mürekkep sahnelerinin "bir kez oyna" kuralı onlar
 * için). Hareketi azaltana sahne yok: yalnız adım listesi.
 */
export function AnalysisFilm({ bars, headlines, symbol, done, t, locale }: {
  bars: FilmBar[]; headlines: string[]; symbol: string; done: boolean; t: T; locale: Locale;
}) {
  const reduced = useMotionPreference();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const scene = done ? 4 : SCENE_STARTS_MS.findLastIndex(start => elapsed >= start);
  const S = t.claude.scenes;

  const chart = useMemo(() => {
    if (bars.length < 2) return null;
    const closes = bars.map(b => b.c);
    const lo = Math.min(...bars.map(b => b.l)), hi = Math.max(...bars.map(b => b.h));
    const span = hi - lo || 1;
    const y = (v: number) => (PAD_Y + (1 - (v - lo) / span) * (1 - PAD_Y * 2)) * VIEW_H;
    const step = VIEW_W / bars.length;
    const line = (series: (number | null)[]) => series.map((v, i) => v === null ? null : `${(i * step + step / 2).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(" ");
    return { y, step, ma20: line(sma(closes, 20)), ma50: line(sma(closes, 50)), rsi: rsi14(closes), last: closes.at(-1)! };
  }, [bars]);

  if (reduced) {
    return <div className={styles.static} role="status">
      <ol>{S.map((s, i) => <li key={s.title} data-state={i < scene ? "done" : i === scene ? "active" : "next"}>{s.title}</li>)}</ol>
    </div>;
  }

  return <div className={styles.stage} role="status" aria-live="polite" aria-label={`${t.claude.stage}: ${S[Math.min(scene, 3)].title}`} data-scene={scene}>
    {/* ---- 1 · Mumlar ---- */}
    {chart && <svg className={styles.chart} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden data-dim={scene >= 2 ? "" : undefined}>
      {bars.map((b, i) => {
        const x = i * chart.step + chart.step / 2;
        const up = b.c >= b.o;
        const top = chart.y(Math.max(b.o, b.c)), bottom = chart.y(Math.min(b.o, b.c));
        return <g key={i} className={styles.candle} data-tone={up ? "up" : "down"} style={{ "--i": i } as React.CSSProperties}>
          <line x1={x} x2={x} y1={chart.y(b.h)} y2={chart.y(b.l)} vectorEffect="non-scaling-stroke" />
          <rect x={x - chart.step * 0.32} width={chart.step * 0.64} y={top} height={Math.max(1, bottom - top)} rx={1} />
        </g>;
      })}
      {/* ---- 2 · Ortalamalar ---- */}
      {scene >= 1 && <>
        <polyline points={chart.ma20} className={styles.ma} data-line="20" vectorEffect="non-scaling-stroke" />
        <polyline points={chart.ma50} className={styles.ma} data-line="50" vectorEffect="non-scaling-stroke" />
      </>}
    </svg>}
    {scene === 1 && chart && <div className={styles.chips} aria-hidden>
      <span style={{ "--i": 0 } as React.CSSProperties}>{symbol} <b>{formatPrice(chart.last, locale, { currency: true })}</b></span>
      {chart.rsi !== null && <span style={{ "--i": 1 } as React.CSSProperties}>RSI <b>{formatPrice(chart.rsi, locale, { digits: 0 })}</b></span>}
      <span style={{ "--i": 2 } as React.CSSProperties}>{bars.length} <b>{t.claude.sessions}</b></span>
    </div>}

    {/* ---- 3 · Haberler ---- */}
    {scene === 2 && <ul className={styles.news} aria-hidden>
      {(headlines.length ? headlines : S[2].line.split(".").filter(Boolean)).slice(0, 5).map((h, i) => <li key={i} style={{ "--i": i } as React.CSSProperties}>{h}</li>)}
    </ul>}

    {/* ---- 4 · Terazi ---- */}
    {scene === 3 && <div className={styles.scale} aria-hidden>
      <svg viewBox="0 0 240 160">
        <path d="M120 40 L106 150 L134 150 Z" className={styles.post} />
        <g className={styles.beam}>
          <line x1="30" y1="40" x2="210" y2="40" />
          <circle cx="120" cy="40" r="5" />
          <g className={styles.pan} data-side="left"><line x1="30" y1="40" x2="30" y2="88" /><path d="M6 88 H54 Q30 110 6 88 Z" />
            {[0, 1, 2].map(i => <circle key={i} cx={22 + i * 8} cy={84} r="4" className={styles.token} data-tone="up" style={{ "--i": i } as React.CSSProperties} />)}</g>
          <g className={styles.pan} data-side="right"><line x1="210" y1="40" x2="210" y2="88" /><path d="M186 88 H234 Q210 110 186 88 Z" />
            {[0, 1, 2].map(i => <circle key={i} cx={202 + i * 8} cy={84} r="4" className={styles.token} data-tone="down" style={{ "--i": i + 0.5 } as React.CSSProperties} />)}</g>
        </g>
      </svg>
      <div className={styles.scaleLabels}><span data-tone="up">{t.claude.positive}</span><span data-tone="down">{t.claude.negative}</span></div>
    </div>}

    {/* ---- Perde ---- */}
    {scene === 4 && <div className={styles.curtain}><strong>{t.claude.ready}</strong></div>}

    {scene < 4 && <div className={styles.caption} key={scene}>
      <span className={styles.sceneNo}>{scene + 1} / 4</span>
      <strong>{S[scene].title}</strong>
      <span>{S[scene].line}</span>
    </div>}
    <div className={styles.progress} aria-hidden>{S.map((s, i) => <span key={s.title} data-state={i < scene ? "done" : i === scene ? "active" : "next"} />)}</div>
  </div>;
}
