"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./MoveFilm.module.css";

/**
 * "BU HAFTA NEDEN HAREKET ETTİ" BEKLEME FİLMİ (18 Ekim, sahibinin isteği:
 * "bir animasyon filmi oynatalım, güzel ve eğlenceli olsun"). Not ilk kez
 * yazılırken Claude 10–20 saniye sürüyor; iskelet çizgileri o süreyi boş
 * geçiriyordu. Film, notun gerçekten yaptığı işi dört sahnede anlatır:
 * beş seansın barları → haberler taranır → hareket haberle eşleşir → not
 * yazılır. Sahneler BİR KEZ oynar, son sahne not gelene kadar bekler
 * (CLAUDE.md "sahne dönmez"); hareketi azaltana kareler kıpırdamadan,
 * yalnız sahne sırasıyla değişir (CSS, MoveFilm.module.css).
 *
 * Çubuklar örnek, veri değil: yön rengi taşıyorlar ama hiçbir sayı yazmıyor.
 * Renk temadan (mürekkep, pirinç, yön); mavi yok. Boyu iskeletin ölçülmüş
 * boyunun içinde (StockInsightCard.module.css → .loading).
 */

const SCENE_MS = 2600;
/* Örnek beş seans: yukarı, aşağı, yukarı, yukarı, aşağı — yalnız biçim. */
const BARS = [34, -18, 26, 44, -14];

export function MoveFilm({ scenes, sceneLabel }: { scenes: readonly string[]; sceneLabel: string }) {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const timers = scenes.slice(1).map((_, i) => window.setTimeout(() => setScene(i + 1), SCENE_MS * (i + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [scenes]);

  const total = scenes.length;
  return (
    <div className={styles.film}>
      <div className={styles.screen}>
        <span className={styles.perf} aria-hidden />
        <svg key={scene} viewBox="0 0 320 150" className={styles.stage} data-scene={scene} aria-hidden>
          {scene === 0 && <Candles />}
          {scene === 1 && <News />}
          {scene === 2 && <Match />}
          {scene === 3 && <Write />}
        </svg>
        <span className={styles.perf} data-bottom aria-hidden />
      </div>
      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>{sceneLabel.replace("{n}", String(scene + 1)).replace("{total}", String(total))}</span>
        <span key={scene} className={styles.title}>{scenes[scene]}</span>
      </div>
      <div className={styles.progress} aria-hidden>
        {scenes.map((_, i) => (
          <span key={i} className={styles.segment} data-state={i < scene ? "done" : i === scene ? "now" : "next"} style={{ "--ms": `${SCENE_MS}ms` } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

const ZERO = 92;
const barX = (i: number) => 52 + i * 46;

function Bars({ scale = 1, dx = 0 }: { scale?: number; dx?: number }) {
  return (
    <g transform={`translate(${dx} 0) scale(${scale} 1)`}>
      {BARS.map((h, i) => (
        <rect
          key={i}
          className={styles.bar}
          data-dir={h > 0 ? "up" : "down"}
          x={barX(i) - 9}
          y={h > 0 ? ZERO - h : ZERO}
          width={18}
          height={Math.abs(h)}
          rx={3}
          style={{ "--d": `${i * 260}ms` } as CSSProperties}
        />
      ))}
    </g>
  );
}

function Candles() {
  const points = BARS.reduce<{ x: number; y: number }[]>((acc, h, i) => {
    const prev = acc.length ? acc[acc.length - 1]!.y : ZERO - 10;
    return [...acc, { x: barX(i), y: Math.max(16, Math.min(140, prev - h * 0.6)) }];
  }, []);
  return (
    <>
      <line x1="24" x2="296" y1={ZERO} y2={ZERO} className={styles.zero} />
      <Bars />
      <polyline className={styles.trace} pathLength={100} points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
      {points.map((p, i) => (
        <circle key={i} className={styles.dot} cx={p.x} cy={p.y} r="3.5" style={{ "--d": `${i * 260 + 300}ms` } as CSSProperties} />
      ))}
    </>
  );
}

function Card({ y, i, wide = 1 }: { y: number; i: number; wide?: number }) {
  return (
    <g className={styles.card} style={{ "--d": `${i * 320}ms` } as CSSProperties}>
      <rect x="96" y={y} width="200" height="34" rx="8" className={styles.cardBox} />
      <rect x="108" y={y + 9} width={120 * wide} height="6" rx="3" className={styles.ink} />
      <rect x="108" y={y + 20} width={80 * wide} height="5" rx="2.5" className={styles.inkSoft} />
      <circle cx="278" cy={y + 17} r="5" className={styles.badge} />
    </g>
  );
}

function News() {
  return (
    <>
      <Card y={12} i={0} />
      <Card y={56} i={1} wide={0.8} />
      <Card y={100} i={2} wide={0.9} />
      <g className={styles.glass}>
        <circle cx="0" cy="0" r="15" className={styles.lens} />
        <line x1="11" y1="11" x2="24" y2="24" className={styles.handle} />
      </g>
      <g className={styles.paperStack}>
        <rect x="22" y="40" width="52" height="66" rx="6" className={styles.cardBox} />
        <rect x="30" y="50" width="36" height="5" rx="2.5" className={styles.ink} />
        <rect x="30" y="61" width="28" height="4" rx="2" className={styles.inkSoft} />
        <rect x="30" y="70" width="32" height="4" rx="2" className={styles.inkSoft} />
        <rect x="30" y="79" width="22" height="4" rx="2" className={styles.inkSoft} />
      </g>
    </>
  );
}

function Match() {
  return (
    <>
      <line x1="14" x2="150" y1={ZERO} y2={ZERO} className={styles.zero} />
      <g className={styles.settled}>
        <Bars scale={0.52} dx={0} />
      </g>
      {[20, 64, 108].map((y, i) => (
        <g key={y} className={styles.card} data-still style={{ "--d": "0ms" } as CSSProperties}>
          <rect x="184" y={y} width="122" height="28" rx="7" className={styles.cardBox} data-hit={i !== 1 || undefined} />
          <rect x="194" y={y + 9} width="70" height="5" rx="2.5" className={styles.ink} />
          <rect x="194" y={y + 18} width="48" height="4" rx="2" className={styles.inkSoft} />
        </g>
      ))}
      <path className={styles.link} pathLength={100} d="M 27 58 C 100 58, 130 34, 184 34" style={{ "--d": "250ms" } as CSSProperties} />
      <path className={styles.link} pathLength={100} d="M 99 48 C 150 60, 140 122, 184 122" style={{ "--d": "800ms" } as CSSProperties} />
      <circle className={styles.spark} cx="184" cy="34" r="4" style={{ "--d": "1000ms" } as CSSProperties} />
      <circle className={styles.spark} cx="184" cy="122" r="4" style={{ "--d": "1550ms" } as CSSProperties} />
    </>
  );
}

function Write() {
  const lines = [176, 150, 188, 120, 164];
  return (
    <>
      <rect x="54" y="10" width="212" height="130" rx="10" className={styles.cardBox} />
      <rect x="70" y="24" width="96" height="8" rx="4" className={styles.ink} />
      {lines.map((w, i) => (
        <rect key={i} x="70" y={46 + i * 17} width={w} height="6" rx="3" className={styles.typed} style={{ "--d": `${i * 520 + 200}ms`, "--w": w } as CSSProperties} />
      ))}
      <g className={styles.star}>
        <path d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z" />
      </g>
    </>
  );
}
