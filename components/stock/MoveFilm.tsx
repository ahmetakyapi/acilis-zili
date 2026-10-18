"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./MoveFilm.module.css";

/**
 * "BU HAFTA NEDEN HAREKET ETTİ" BEKLEME FİLMİ — KISA FİLM (18 Ekim,
 * sahibinin isteği: "kısa film gibi olsun, bir konu ve hikâye akışı olsun").
 *
 * Not ilk kez yazılırken Claude 10–20 saniye sürüyor. O süre bir dedektif
 * hikâyesi: büyüteç karakter hissenin haftasını "dosya" olarak açar.
 *   1. Dosya: MU — klaket çarpar, sembol yazılır.
 *   2. Bir Hafta, Beş Seans — barlar büyür, en büyüğünün üstünde "!" belirir.
 *   3. Dedektif İz Sürüyor — büyüteç yürüyerek o bara gelir, gözleri açılır.
 *   4. Tanıklar Konuşuyor — haber kartları düşer; biri eşleşir, ötekiler soluklaşır.
 *   5. İpler Bağlanıyor — bardan habere ip gerilir (dedektif panosu).
 *   6. Claude Raporu Yazıyor — defter açılır, satırlar yazılır; dedektif bekler.
 * Hikâye notun gerçekten yaptığı işin sırası: seans barları → haberler →
 * eşleştirme → metin. Sahneler BİR KEZ oynar, son sahne not gelene kadar
 * bekler (CLAUDE.md "sahne dönmez"; yalnız göz kırpma ve kalem gibi tek
 * küçük öğeler döner). Hareketi azaltana her sahnenin son karesi.
 *
 * Çubuklar örnek, veri değil: yön rengi taşır, hiçbir sayı yazmaz. Renk
 * temadan (mürekkep, pirinç, yön); mavi yok. Her öğenin TEMEL konumu
 * animasyonun bittiği kare, keyframe yalnız `from` — hareket kapanınca
 * sahne doğru durur.
 */

const SCENE_MS = 2400;
const BARS = [18, -12, 22, 52, -10];
const HERO = 3;
const ZERO = 100;
const barX = (i: number) => 60 + i * 44;

export function MoveFilm({ scenes, sceneLabel, symbol }: { scenes: readonly string[]; sceneLabel: string; symbol: string }) {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const timers = scenes.slice(1).map((_, i) => window.setTimeout(() => setScene(i + 1), SCENE_MS * (i + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [scenes]);

  const total = scenes.length;
  const title = (scenes[scene] ?? "").replace("{symbol}", symbol);
  return (
    <div className={styles.film} style={{ "--count": total } as CSSProperties}>
      <div className={styles.screen}>
        <span className={styles.perf} aria-hidden />
        <svg key={scene} viewBox="0 0 320 160" className={styles.stage} aria-hidden>
          {scene === 0 && <TitleCard symbol={symbol} />}
          {scene === 1 && <Week />}
          {scene === 2 && <Trail />}
          {scene === 3 && <Witnesses />}
          {scene === 4 && <Threads />}
          {scene >= 5 && <Report />}
        </svg>
        <span className={styles.perf} data-bottom aria-hidden />
      </div>
      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>{sceneLabel.replace("{n}", String(scene + 1)).replace("{total}", String(total))}</span>
        <span key={scene} className={styles.title}>{title}</span>
      </div>
      <div className={styles.progress} aria-hidden>
        {scenes.map((_, i) => (
          <span key={i} className={styles.segment} data-state={i < scene ? "done" : i === scene ? "now" : "next"} style={{ "--ms": `${SCENE_MS}ms` } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

/* ---- Karakter: büyüteç dedektif ---- */
function Detective({ className, style, mood }: { className?: string; style?: CSSProperties; mood?: "walk" | "nod" | "wait" | "surprised" }) {
  return (
    <g className={className} style={style}>
      <g className={styles.body} data-mood={mood}>
        <line x1="9" y1="9" x2="20" y2="20" className={styles.handle} />
        <circle r="13" className={styles.lens} />
        <g className={styles.eyes}>
          <ellipse cx="-4.5" cy="-1" rx="1.9" ry="2.6" />
          <ellipse cx="4.5" cy="-1" rx="1.9" ry="2.6" />
        </g>
        <path d="M -4 6 Q 0 8.5 4 6" className={styles.smile} />
      </g>
    </g>
  );
}

function Bars({ grow = false, highlight = false }: { grow?: boolean; highlight?: boolean }) {
  return (
    <>
      <line x1="30" x2="270" y1={ZERO} y2={ZERO} className={styles.zero} />
      {BARS.map((h, i) => (
        <rect
          key={i}
          className={grow ? styles.bar : styles.barStill}
          data-dir={h > 0 ? "up" : "down"}
          data-hero={(highlight && i === HERO) || undefined}
          x={barX(i) - 10}
          y={h > 0 ? ZERO - h : ZERO}
          width={20}
          height={Math.abs(h)}
          rx={3}
          style={{ "--d": `${i * 220}ms` } as CSSProperties}
        />
      ))}
    </>
  );
}

/* 1 · Dosya açılır */
function TitleCard({ symbol }: { symbol: string }) {
  return (
    <>
      <g className={styles.board}>
        <rect x="104" y="58" width="112" height="72" rx="8" className={styles.boardBody} />
        <text x="160" y="104" textAnchor="middle" className={styles.boardText}>
          {symbol}
        </text>
        <g className={styles.clapper}>
          <rect x="104" y="40" width="112" height="16" rx="4" className={styles.boardBody} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M ${116 + i * 26} 40 l 12 0 l -8 16 l -12 0 z`} className={styles.stripe} />
          ))}
        </g>
      </g>
      <Detective className={styles.peek} mood="wait" style={{ transform: "translate(250px, 110px)" }} />
    </>
  );
}

/* 2 · Hafta oynar */
function Week() {
  return (
    <>
      <Bars grow />
      <g className={styles.alert}>
        <circle cx={barX(HERO)} cy={ZERO - 52 - 18} r="9" className={styles.alertDot} />
        {/* Ünlem çizgiyle: SVG metni yazı tipi yüklenmeden görünmüyordu. */}
        <line x1={barX(HERO)} x2={barX(HERO)} y1={ZERO - 52 - 23} y2={ZERO - 52 - 17} className={styles.alertMark} />
        <circle cx={barX(HERO)} cy={ZERO - 52 - 13.5} r="1.3" className={styles.alertPoint} />
      </g>
    </>
  );
}

/* 3 · Dedektif iz sürer */
function Trail() {
  return (
    <>
      <Bars highlight />
      <Detective className={styles.walker} mood="surprised" style={{ transform: `translate(${barX(HERO) + 32}px, 40px)` }} />
    </>
  );
}

/* Küçültülmüş hafta (4–5. sahneler): barlar sola çekilir, kahraman bar işaretli. */
function MiniWeek() {
  return (
    <g transform="translate(6 34) scale(.55)">
      <Bars highlight />
    </g>
  );
}
const heroTop = { x: 6 + barX(HERO) * 0.55, y: 34 + (ZERO - 52) * 0.55 };

/* 4 · Tanıklar */
function Witnesses() {
  return (
    <>
      <MiniWeek />
      {[14, 62, 110].map((y, i) => (
        <g key={y} className={styles.witness} data-match={i === 1 || undefined} style={{ "--d": `${i * 260}ms` } as CSSProperties}>
          <rect x="180" y={y} width="124" height="32" rx="7" className={styles.card} />
          <rect x="190" y={y + 9} width="74" height="5" rx="2.5" className={styles.ink} />
          <rect x="190" y={y + 19} width="50" height="4" rx="2" className={styles.inkSoft} />
        </g>
      ))}
      <g className={styles.check}>
        <circle cx="300" cy="64" r="9" className={styles.checkDot} />
        <path d="M 295.5 64 l 3 3 l 5.5 -6" className={styles.checkMark} />
      </g>
      <Detective className={styles.hopper} mood="walk" style={{ transform: "translate(150px, 130px)" }} />
    </>
  );
}

/* 5 · İpler */
function Threads() {
  const card = { x: 180, y: 62 };
  return (
    <>
      <MiniWeek />
      <g>
        <rect x={card.x} y={card.y} width="124" height="32" rx="7" className={styles.card} data-matched />
        <rect x={card.x + 10} y={card.y + 9} width="74" height="5" rx="2.5" className={styles.ink} />
        <rect x={card.x + 10} y={card.y + 19} width="50" height="4" rx="2" className={styles.inkSoft} />
      </g>
      <path className={styles.thread} pathLength={100} d={`M ${heroTop.x} ${heroTop.y} C ${heroTop.x + 40} ${heroTop.y - 30}, ${card.x - 50} ${card.y - 10}, ${card.x} ${card.y + 16}`} />
      <circle cx={heroTop.x} cy={heroTop.y} r="4" className={styles.pin} />
      <circle cx={card.x} cy={card.y + 16} r="4" className={styles.pin} data-late />
      <Detective mood="nod" style={{ transform: "translate(140px, 126px)" }} />
    </>
  );
}

/* 6 · Rapor */
function Report() {
  const lines = [150, 128, 162, 104, 140];
  return (
    <>
      <g className={styles.notebook}>
        <rect x="36" y="14" width="184" height="132" rx="10" className={styles.card} />
        <rect x="52" y="28" width="86" height="8" rx="4" className={styles.ink} />
        {lines.map((w, i) => (
          <rect key={i} x="52" y={50 + i * 17} width={w} height="6" rx="3" className={styles.typed} style={{ "--d": `${i * 480 + 300}ms` } as CSSProperties} />
        ))}
      </g>
      <g className={styles.pen}>
        <path d="M0 -8 L2.2 -2.2 L8 0 L2.2 2.2 L0 8 L-2.2 2.2 L-8 0 L-2.2 -2.2 Z" />
      </g>
      <Detective mood="wait" style={{ transform: "translate(262px, 96px)" }} />
    </>
  );
}
