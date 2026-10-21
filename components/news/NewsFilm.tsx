"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EASE_BRAND } from "@/lib/motion";
import styles from "./NewsFilm.module.css";

/**
 * HABER NOTU BEKLEME FİLMİ — "video serisi"nin üçüncüsü (21 Ekim, sahibinin
 * isteği: "bir kısa film animasyonu gibi olsun, güzel ve tatlı detaylar
 * barındırsın"). Seri: Claude analizi (mürekkep tuvali), "Bu Hafta Neden
 * Hareket Etti" (MoveFilm, büyüteç dedektif) ve bu.
 *
 * Haberlerin çoğu İngilizce kaynak; Claude okur, Türkçeye geçirir, özünü
 * çıkarır, notu yazar. Film bu işin sırası:
 *   1. Haber Masada — kâğıt masaya düşer (gündemde üç kâğıt üst üste), toz
 *      kalkar, köşe kıvrılır; zil irkilip çalar, "EN" etiketi belirir.
 *   2. Haber Okunuyor — zil gözlüğünü alnından indirir, cam bir kez parlar,
 *      gözler satır satır gezer; okunan satır koyulaşır.
 *   3. Türkçeye Geçiyor — "EN" etiketi dönüp "TR" olur, manşetin harfleri
 *      soldan sağa tek tek değişir (Türkçe kelimeler biraz daha uzun) ve
 *      ş/ç/ö imleri düşer; masadaki sözlüğün sayfaları çırpınır.
 *   4. Öz Çıkarılıyor — fosforlu kalem bir satırı boyar, ikisinin altını
 *      pirinçle çizer, kalanı soluklaşır. Gündemde bunun yerine kâğıtlar
 *      üç konu yığınına ayrılır, her yığına bir sekme takılır.
 *   5. Claude Notu Yazıyor — not kartı, kurşun kalem satır satır yazar, zil
 *      başını sallar; yanında ince belli bardakta çay buğusu. Not gelene
 *      kadar bu sahne bekler.
 *
 * KARAKTER: ZİL, gözlüklü (dedektif değil). Seri bir antoloji: her film o
 * işin karakteriyle; dedektif "neden"i soruşturuyordu, burada iş okumak ve
 * çevirmek — gözlüklü bir okur. Zil sitenin adı ve işareti (BellMark'ın
 * tören zili, kendi çizimiyle); haberin geldiğini çalarak haber veren şey
 * de zildir; BellMark'ın karosu gibi mavi degrade, beyaz parıltı, beyaz
 * yüz. Seri görsel dilde birleşiyor: mavi degrade perde ve karakter, aynı
 * altyazı ve ilerleme şeridi (renk kuralı NewsFilm.module.css başında).
 *
 * KURALLAR (MoveFilm'le aynı): sahneler BİR KEZ oynar, son sahne not
 * gelene kadar bekler; yalnız tek küçük öğeler döner (göz kırpma, buğu,
 * kalemin ucu, kıvılcım). Her öğenin TEMEL konumu sahnenin son karesi;
 * keyframe yalnız `from` ya da ara kareler — hareketi azaltana son kare.
 * Harfler ve etiketler çizgiyle çizilir (SVG metni yazı tipi inmeden
 * görünmüyordu, MoveFilm). Renk temadan (token), elle renk yok.
 */

const SCENE_MS = 3100; // en uzun başlık 16 harf: 16/15 + 1,5 sn okunur + .45 sn giriş
const DESK = 146;
const BELL_X = 256;

/* Kâğıt: masaya dik duran gazete sayfası. */
const P = { x: 66, y: 54, w: 124, h: 92, fold: 12 };
/* Manşet harfleri: İngilizce dört kelime, Türkçe üç (Türkçe kelime uzun). */
const LETTER = 2.6;
const PITCH = 3.4;
const WORD_GAP = 4.5;
const EN_WORDS = [5, 7, 4, 6];
const TR_WORDS = [8, 6, 9];
const TR_DOTS = [1, 9, 16]; // ö, ü, ı gibi üst imler
const TR_HOOKS = [4, 12, 20]; // ç, ş gibi alt imler
const BODY = [104, 88, 100, 70];
const bodyY = (i: number) => P.y + 47 + i * 11;

function letters(words: number[]) {
  const out: { x: number; tall: boolean }[] = [];
  let x = P.x + 10;
  words.forEach((n) => {
    for (let i = 0; i < n; i++) {
      out.push({ x, tall: (out.length * 7) % 5 === 2 });
      x += PITCH;
    }
    x += WORD_GAP - (PITCH - LETTER);
  });
  return out;
}
const EN_LETTERS = letters(EN_WORDS);
const TR_LETTERS = letters(TR_WORDS);
const HEAD_Y = P.y + 24;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return reduce;
}

export function NewsFilm({ kind, scenes, sceneLabel }: { kind: "briefing" | "explainer"; scenes: readonly string[]; sceneLabel: string }) {
  const [scene, setScene] = useState(0);
  const total = scenes.length;
  /* Sahne yalnız İLERİ gider: sözlük dizisi yeni kimlikle gelirse (sunucu
     yenilemesi, geliştirmede sıcak yenileme) zamanlayıcılar yeniden kurulur
     ama film geri sarmaz — ölçüldü, 6. saniyede 2. sahneye dönüyordu. */
  useEffect(() => {
    const timers = Array.from({ length: total - 1 }, (_, i) => window.setTimeout(() => setScene((s) => Math.max(s, i + 1)), SCENE_MS * (i + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [total]);

  const pile = kind === "briefing";
  /* Degradeler SVG'de tanımlı, durakları CSS'ten (token); şekiller onları
     CSS değişkeniyle bulur (fill: var(--g-bell)). Kimlik film başına. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const grads = { "--g-bell": `url(#${uid}b)`, "--g-sheen": `url(#${uid}s)`, "--g-chip": `url(#${uid}c)` };
  /* Ekran okuyucudan gizli; yerinde düz bir sr-only "yükleniyor" satırı
     (NewsInsight → Loading; gerekçe MoveFilm ve StockInsightCard'da). */
  return (
    <div className={styles.film} style={vars({ "--count": total, ...grads })} aria-hidden>
      <div className={styles.screen}>
        <span className={styles.perf} />
        <svg key={scene} viewBox="6 18 308 136" className={styles.stage}>
          <defs>
            {/* Marka karosunun ailesi: 150° gök → mavi → lacivert, üst yarıda beyaz parıltı. */}
            <linearGradient id={`${uid}b`} x1="0" y1="0" x2=".62" y2="1">
              <stop offset="0" className={styles.stopSky} />
              <stop offset=".48" className={styles.stopBlue} />
              <stop offset="1" className={styles.stopNavy} />
            </linearGradient>
            <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.stopSheen} />
              <stop offset=".5" className={styles.stopClear} />
            </linearGradient>
            <linearGradient id={`${uid}c`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className={styles.stopSky} />
              <stop offset="1" className={styles.stopBlue} />
            </linearGradient>
          </defs>
          <line x1="12" x2="308" y1={DESK} y2={DESK} className={styles.desk} />
          {scene === 0 && <Arrival pile={pile} />}
          {scene === 1 && <Reading pile={pile} />}
          {scene === 2 && <Translating pile={pile} />}
          {scene === 3 && (pile ? <Sorting /> : <Gist />)}
          {scene >= 4 && <Note pile={pile} />}
        </svg>
        <span className={styles.perf} data-bottom />
      </div>
      <div className={styles.caption}>
        <span className={styles.counter}>{sceneLabel.replace("{n}", String(scene + 1)).replace("{total}", String(total))}</span>
        <span key={scene} className={styles.title}>{scenes[scene] ?? ""}</span>
      </div>
      <div className={styles.progress}>
        {scenes.map((_, i) => (
          <span key={i} className={styles.segment} data-state={i < scene ? "done" : i === scene ? "now" : "next"} style={vars({ "--ms": `${SCENE_MS}ms` })} />
        ))}
      </div>
    </div>
  );
}

/* ---- Yol izleyen küçük öğe (kalem, fosforlu kalem) ----
   Nokta listesi [x, y, ms]; TEMEL konum son nokta. Web Animations CSS
   değişkenini çözmüyor, eğri lib/motion'dan. Hareket azaltılınca hiç
   oynamaz, son noktada durur. */
function Traveler({ path, className, children }: { path: [number, number, number][]; className?: string; children: ReactNode }) {
  const ref = useRef<SVGGElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || typeof el.animate !== "function") return;
    const end = path[path.length - 1][2];
    const animation = el.animate(
      path.map(([x, y, ms]) => ({ transform: `translate(${x}px, ${y}px)`, offset: ms / end, easing: EASE_BRAND })),
      { duration: end, fill: "both" },
    );
    return () => animation.cancel();
  }, [path, reduce]);
  const [x, y] = path[path.length - 1];
  return (
    <g ref={ref} className={className} style={{ transform: `translate(${x}px, ${y}px)` }}>
      {children}
    </g>
  );
}

/* ---- Karakter: gözlüklü zil ----
   Yerel (0, 0) tokmağın masaya değdiği nokta; boy 48 birim. */
const BELL_BODY = "M0 -43c-9 0-14 6-14.5 14l-1 11c-.4 3.5-2.4 5.5-5.5 6.5h42c-3.1-1-5.1-3-5.5-6.5l-1-11c-.5-8-5.5-14-14.5-14z";
type Mood = "rest" | "ring" | "read" | "look" | "nod" | "watch";
function Bell({ x = BELL_X, mood = "rest", glasses = "on", delay = 0 }: { x?: number; mood?: Mood; glasses?: "up" | "slide" | "on"; delay?: number }) {
  return (
    <g style={{ transform: `translate(${x}px, ${DESK}px) scale(1.15)` }}>
      <g className={styles.bell} data-mood={mood} style={vars({ "--rd": `${delay}ms` })}>
        <circle cy="-3.6" r="3.4" className={styles.clapper} />
        <rect x="-3.5" y="-48.5" width="7" height="6.5" rx="3.25" className={styles.bellLine} />
        <path d={BELL_BODY} className={styles.bellBody} />
        <path d={BELL_BODY} className={styles.bellSheen} />
        <rect x="-23" y="-11" width="46" height="4.6" rx="2.3" className={styles.lip} />
        <ellipse cx="-10.2" cy="-22.5" rx="2.6" ry="1.5" className={styles.cheek} />
        <ellipse cx="10.2" cy="-22.5" rx="2.6" ry="1.5" className={styles.cheek} />
        <g className={styles.gaze}>
          <g className={styles.eyes}>
            <ellipse cx="-5" cy="-28" rx="1.8" ry="2.4" />
            <ellipse cx="5" cy="-28" rx="1.8" ry="2.4" />
          </g>
        </g>
        <path d="M-3.4 -21.6 Q0 -19 3.4 -21.6" className={styles.smile} />
        <g className={styles.glasses} data-pos={glasses}>
          <circle cx="-5.2" cy="-28" r="4.6" />
          <circle cx="5.2" cy="-28" r="4.6" />
          <path d="M-.9 -28.6 Q0 -29.8 .9 -28.6 M-9.8 -28.8 L-13.6 -30.4 M9.8 -28.8 L13.6 -30.4" />
          {glasses === "slide" && <path d="M-8.2 -33 l.8 2 2 .8 -2 .8 -.8 2 -.8 -2 -2 -.8 2 -.8z" className={styles.glint} />}
        </g>
        {mood === "ring" && (
          <g className={styles.ding}>
            <path d="M-19 -45 q-3.5 4 0 8 M-24 -47.5 q-6 6.5 0 13 M19 -45 q3.5 4 0 8 M24 -47.5 q6 6.5 0 13" />
          </g>
        )}
      </g>
    </g>
  );
}

/* ---- Kâğıt ---- */
function Glyphs({ word }: { word: "EN" | "TR" }) {
  /* Etiket harfleri çizgiyle (6 birim boy). */
  return word === "EN" ? (
    <path d="M0 0v6M0 0h3.4M0 3h2.8M0 6h3.4 M6 6V0l3.6 6V0" />
  ) : (
    <path d="M0 0h4M2 0v6 M6.4 6V0h2.3q1.9 0 1.9 1.7t-1.9 1.7H6.4M8.6 3.4 10.6 6" />
  );
}

function Tag({ flip = false, word = "EN", pop = false }: { flip?: boolean; word?: "EN" | "TR"; pop?: boolean }) {
  const x = P.x + P.w - 32;
  const y = P.y + 7;
  return (
    <g className={styles.tag} data-flip={flip || undefined} data-pop={pop || undefined} style={{ transformOrigin: `${x + 12}px ${y + 6.5}px` }}>
      <rect x={x} y={y} width="24" height="13" rx="3.5" className={styles.tagBox} />
      <g className={styles.tagInk} transform={`translate(${x + 6.6} ${y + 3.5})`}>
        {flip ? (
          <>
            <g className={styles.tagOut}><Glyphs word="EN" /></g>
            <g className={styles.tagIn}><Glyphs word="TR" /></g>
          </>
        ) : (
          <Glyphs word={word} />
        )}
      </g>
    </g>
  );
}

function Headline({ lang, swap = false }: { lang: "EN" | "TR"; swap?: boolean }) {
  const draw = (set: typeof EN_LETTERS, cls: string | undefined, base: number, step: number) =>
    set.map((l, i) => (
      <rect
        key={i}
        x={l.x}
        y={HEAD_Y - (l.tall ? 2.2 : 0)}
        width={LETTER}
        height={l.tall ? 8.2 : 6}
        rx=".8"
        className={cn(styles.letter, cls)}
        style={vars({ "--d": `${base + i * step}ms` })}
      />
    ));
  const marks = (
    <g>
      {TR_DOTS.map((i, k) => (
        <circle key={`d${i}`} cx={TR_LETTERS[i].x + LETTER / 2} cy={HEAD_Y - 3.6} r=".95" className={cn(styles.mark, swap && styles.markIn)} style={vars({ "--d": `${1850 + k * 110}ms` })} />
      ))}
      {TR_HOOKS.map((i, k) => (
        <path key={`h${i}`} d={`M${TR_LETTERS[i].x + LETTER / 2} ${HEAD_Y + 6.6} q.9 1.2 -.6 1.9`} className={cn(styles.hook, swap && styles.markIn)} style={vars({ "--d": `${1900 + k * 110}ms` })} />
      ))}
    </g>
  );
  if (swap) {
    return (
      <>
        {draw(EN_LETTERS, styles.letterOut, 750, 34)}
        {draw(TR_LETTERS, styles.letterIn, 900, 38)}
        {marks}
      </>
    );
  }
  return lang === "EN" ? <>{draw(EN_LETTERS, undefined, 0, 0)}</> : <>{draw(TR_LETTERS, undefined, 0, 0)}{marks}</>;
}

function cn(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

type LineMode = "plain" | "read" | "rewrite";
function Sheet({ head = "EN", tag, lines = "plain", children, curl = false }: { head?: "EN" | "TR" | "swap"; tag?: ReactNode; lines?: LineMode; children?: ReactNode; curl?: boolean }) {
  const { x, y, w, h, fold } = P;
  return (
    <g>
      <path d={`M${x + 4} ${y}h${w - 8}q4 0 4 4v${h - 4 - fold}l${-fold} ${fold}H${x + 4}q-4 0-4-4V${y + 4}q0-4 4-4z`} className={styles.paper} />
      <path d={`M${x + w} ${y + h - fold}h${-fold + 3}q-3 0-3 3v${fold - 3}z`} className={cn(styles.fold, curl && styles.curl)} style={{ transformOrigin: `${x + w}px ${y + h - fold}px` }} />
      <rect x={x + 10} y={y + 9} width="30" height="4" rx="2" className={styles.inkSoft} />
      {tag}
      {head === "swap" ? <Headline lang="TR" swap /> : <Headline lang={head} />}
      <line x1={x + 10} x2={x + w - 10} y1={y + 38} y2={y + 38} className={styles.rule} />
      {BODY.map((bw, i) => (
        <g key={i}>
          <rect x={x + 10} y={bodyY(i)} width={bw} height="4" rx="2" className={cn(styles.inkSoft, lines === "rewrite" && styles.rewrite)} style={vars({ "--d": `${1700 + i * 170}ms` })} />
          {lines === "read" && <rect x={x + 10} y={bodyY(i)} width={bw} height="4" rx="2" className={styles.readInk} style={vars({ "--d": `${950 + i * 470}ms` })} />}
        </g>
      ))}
      {children}
    </g>
  );
}

/* Gündemde arkadaki iki kâğıt (sade). */
function BackSheet({ dx, rot, className, style }: { dx: number; rot: number; className?: string; style?: CSSProperties }) {
  return (
    <g style={{ transform: `translate(${dx}px, 0) rotate(${rot}deg)`, transformOrigin: `${P.x + P.w / 2}px ${DESK}px` }}>
      <g className={className} style={style}>
        <rect x={P.x} y={P.y} width={P.w} height={P.h} rx="4" className={styles.paper} />
        <rect x={P.x + 10} y={P.y + 22} width="80" height="6" rx="2" className={styles.inkFaint} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={P.x + 10} y={P.y + 44 + i * 12} width={[96, 74, 88][i]} height="4" rx="2" className={styles.inkFaint} />
        ))}
      </g>
    </g>
  );
}
const PILE = [
  { dx: -10, rot: -5 },
  { dx: 9, rot: 3.5 },
];
function Pile({ drop = false }: { drop?: boolean }) {
  return (
    <>
      {PILE.map((p, i) => (
        <BackSheet key={i} {...p} className={drop ? styles.drop : undefined} style={vars({ "--d": `${100 + i * 380}ms` })} />
      ))}
    </>
  );
}

function Dust({ at }: { at: number }) {
  /* Kâğıt değince iki köşeden üçer toz. TEMEL hâl görünmez. */
  const puffs = [
    { x: P.x + 2, dx: -9, dy: -4 },
    { x: P.x - 2, dx: -5, dy: -8 },
    { x: P.x + 6, dx: -13, dy: -2 },
    { x: P.x + P.w - 2, dx: 9, dy: -4 },
    { x: P.x + P.w + 2, dx: 5, dy: -8 },
    { x: P.x + P.w - 6, dx: 13, dy: -2 },
  ];
  return (
    <g>
      {puffs.map((p, i) => (
        <circle key={i} cx={p.x} cy={DESK - 2} r={i % 3 === 1 ? 2.2 : 1.6} className={styles.dust} style={vars({ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--d": `${at + (i % 3) * 40}ms` })} />
      ))}
    </g>
  );
}

/* 1 · Haber Masada */
function Arrival({ pile }: { pile: boolean }) {
  const land = pile ? 860 + 560 : 200 + 560;
  return (
    <>
      {pile && <Pile drop />}
      <g className={styles.drop} style={vars({ "--d": `${pile ? 860 : 200}ms` })}>
        <Sheet curl tag={<Tag pop />} />
      </g>
      {pile && PILE.map((_, i) => <Dust key={i} at={100 + i * 380 + 560} />)}
      <Dust at={land} />
      <Bell mood="ring" glasses="up" delay={land + 120} />
    </>
  );
}

/* 2 · Haber Okunuyor */
function Reading({ pile }: { pile: boolean }) {
  return (
    <>
      {pile && <Pile />}
      <Sheet lines="read" tag={<Tag />} />
      <Bell mood="read" glasses="slide" />
    </>
  );
}

/* 3 · Türkçeye Geçiyor */
function Translating({ pile }: { pile: boolean }) {
  const bx = 216;
  return (
    <>
      {pile && <Pile />}
      <Sheet head="swap" lines="rewrite" tag={<Tag flip />} />
      {/* Sözlük: açık kitap, üç sayfa çırpınır. */}
      <g className={styles.book}>
        <path d={`M${bx - 15} ${DESK} l2-13q6-2 13 0 v13z`} className={styles.bookPage} />
        <path d={`M${bx + 15} ${DESK} l-2-13q-6-2-13 0 v13z`} className={styles.bookPage} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${bx} ${DESK} v-13 q6.5-2 13 0 l2 13z`} className={styles.flip} style={vars({ "--d": `${350 + i * 260}ms`, transformOrigin: `${bx}px ${DESK}px` })} />
        ))}
        <path d={`M${bx - 16} ${DESK} h32`} className={styles.bookSpine} />
      </g>
      <Bell x={262} mood="look" />
    </>
  );
}

/* 4a · Öz Çıkarılıyor (tek haber) */
function Gist() {
  const hl = bodyY(0);
  return (
    <>
      <Sheet head="TR" tag={<Tag word="TR" />}>
        <rect x={P.x + 8} y={hl - 2.6} width={BODY[0] + 4} height="9" rx="3" className={styles.highlight} style={{ transformOrigin: `${P.x + 8}px ${hl}px` }} />
        {[1, 3].map((i) => (
          <rect key={`f${i}`} x={P.x + 10} y={bodyY(i)} width={BODY[i]} height="4" rx="2" className={styles.dim} style={vars({ "--d": `${1700 + i * 60}ms` })} />
        ))}
        <rect x={P.x + 10} y={bodyY(0)} width={BODY[0]} height="4" rx="2" className={styles.keep} />
        <rect x={P.x + 10} y={bodyY(2)} width={BODY[2]} height="4" rx="2" className={styles.keep} />
        <path d={`M${P.x + 10} ${bodyY(2) + 7}h${BODY[2]}`} pathLength={100} className={styles.underline} style={vars({ "--d": "1320ms", "--ms": "480ms" })} />
        <path d={`M${P.x + 10} ${HEAD_Y + 10.5}h86`} pathLength={100} className={styles.underline} style={vars({ "--d": "1950ms", "--ms": "400ms" })} />
      </Sheet>
      <Traveler
        className={styles.tool}
        path={[
          [P.x + 6, hl - 30, 0],
          [P.x + 10, hl + 1, 380],
          [P.x + 10 + BODY[0], hl + 1, 1150],
          [P.x + 10, bodyY(2) + 6, 1320],
          [P.x + 10 + BODY[2], bodyY(2) + 6, 1800],
          [P.x + 10, HEAD_Y + 9.5, 1950],
          [P.x + 96, HEAD_Y + 9.5, 2350],
          [P.x + P.w + 14, HEAD_Y + 2, 2800],
        ]}
      >
        <g transform="rotate(32)">
          <rect x="-3.6" y="-21" width="7.2" height="14" rx="2" className={styles.markerBody} />
          <path d="M-2.6 -7h5.2l-1 5h-3.2z" className={styles.markerTip} />
        </g>
      </Traveler>
      <Bell mood="nod" />
    </>
  );
}

/* 4b · Konular Ayrılıyor (gündem): yedi küçük kâğıt üç yığına uçar. */
const SORT = [0, 1, 2, 0, 2, 1, 0];
const SORT_X = [52, 118, 184];
function Sorting() {
  const level = [0, 0, 0];
  const cards = SORT.map((p, i) => {
    const l = level[p]++;
    const fx = 118 - 17 + ((i * 5) % 7) - 3;
    const fy = 122 - i * 3.4;
    const x = SORT_X[p] - 17;
    const y = 122 - l * 5;
    return { x, y, fromX: fx - x, fromY: fy - y, rot: ((i * 7) % 9) - 4, d: 300 + i * 170 };
  });
  return (
    <>
      {cards.map((c, i) => (
        <g key={i} className={styles.sort} style={vars({ "--fx": `${c.fromX}px`, "--fy": `${c.fromY}px`, "--mx": `${c.fromX / 2}px`, "--my": `${c.fromY / 2 - 26}px`, "--r": `${c.rot}deg`, "--d": `${c.d}ms` })}>
          <rect x={c.x} y={c.y} width="34" height="24" rx="3" className={styles.paper} />
          <rect x={c.x + 5} y={c.y + 6} width="20" height="3.4" rx="1.7" className={styles.ink} />
          <rect x={c.x + 5} y={c.y + 13} width="24" height="3" rx="1.5" className={styles.inkSoft} />
        </g>
      ))}
      {SORT_X.map((x, p) => {
        const top = 122 - (level[p] - 1) * 5;
        return (
          <g key={p} className={styles.tab} style={vars({ "--d": `${1800 + p * 160}ms`, transformOrigin: `${x}px ${top}px` })}>
            <rect x={x - 9} y={top - 9} width="18" height="7" rx="3.5" className={styles.tabBox} />
            {Array.from({ length: p + 1 }, (_, k) => (
              <circle key={k} cx={x - p * 2.2 + k * 4.4} cy={top - 5.5} r="1.3" className={styles.tabDot} />
            ))}
          </g>
        );
      })}
      <Bell mood="watch" />
    </>
  );
}

/* 5 · Claude notu yazar; bekleme sahnesi. */
const GLASS = "M-6 -3c0-3.6-3.2-5-3.2-8.5 0-3.4 2.6-5.6 3.2-10.5h12c.6 4.9 3.2 7.1 3.2 10.5 0 3.5-3.2 4.9-3.2 8.5z";
const NOTE = { x: 84, y: 26, w: 132, h: 120 };
function Note({ pile }: { pile: boolean }) {
  const { x, y, w, h } = NOTE;
  const lx = x + 22;
  const rows: { y: number; w: number; strong: boolean; lead?: "dot" | "tab" }[] = pile
    ? [
        { y: y + 36, w: 58, strong: true, lead: "tab" },
        { y: y + 46, w: 86, strong: false },
        { y: y + 62, w: 66, strong: true, lead: "tab" },
        { y: y + 72, w: 78, strong: false },
        { y: y + 88, w: 52, strong: true, lead: "tab" },
        { y: y + 98, w: 90, strong: false },
      ]
    : [
        { y: y + 32, w: 92, strong: false },
        { y: y + 41, w: 74, strong: false },
        { y: y + 58, w: 64, strong: true, lead: "dot" },
        { y: y + 74, w: 82, strong: true, lead: "dot" },
        { y: y + 90, w: 56, strong: true, lead: "dot" },
        { y: y + 99, w: 76, strong: false },
      ];
  const start = 500;
  const step = 380;
  const path: [number, number, number][] = [[lx, y + 18, 0]];
  rows.forEach((r, i) => {
    const t = start + i * step;
    path.push([lx, r.y + 2, t], [lx + r.w, r.y + 2, t + step - 70]);
  });
  return (
    <>
      <g className={styles.source}>
        <rect x="20" y="106" width="44" height="34" rx="3" className={styles.paper} />
        <rect x="26" y="113" width="26" height="3" rx="1.5" className={styles.inkFaint} />
        <rect x="26" y="121" width="32" height="2.6" rx="1.3" className={styles.inkFaint} />
        <rect x="26" y="128" width="22" height="2.6" rx="1.3" className={styles.inkFaint} />
        <path d="M68 128 q6 -6 12 -2" className={styles.arrow} />
      </g>
      <g className={styles.noteCard}>
        <rect x={x} y={y} width={w} height={h} rx="7" className={styles.paper} />
        {/* Notun başı marka karosu gibi: mavi degrade, beyaz parıltı, beyaz kıvılcım. */}
        <path d={`M${x + 7} ${y}h${w - 14}q7 0 7 7v11H${x}V${y + 7}q0-7 7-7z`} className={styles.band} />
        <path d={`M${x + 7} ${y}h${w - 14}q7 0 7 7v11H${x}V${y + 7}q0-7 7-7z`} className={styles.bellSheen} />
        <path d={`M${x + 12} ${y + 5.4} l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1z`} className={styles.spark} />
        <rect x={x + 22} y={y + 6.5} width="52" height="5" rx="2.5" className={styles.bandInk} />
        {rows.map((r, i) => (
          <g key={i}>
            {r.lead === "dot" && <circle cx={x + 14} cy={r.y + 2} r="2.4" className={styles.bullet} style={vars({ "--d": `${start + i * step}ms` })} />}
            {r.lead === "tab" && <rect x={x + 10} y={r.y - 1.5} width="7" height="7" rx="2" className={styles.bullet} style={vars({ "--d": `${start + i * step}ms` })} />}
            <rect x={lx} y={r.y} width={r.w} height={r.strong ? 4.6 : 3.6} rx="2" className={cn(r.strong ? styles.ink : styles.inkSoft, styles.typed)} style={vars({ "--d": `${start + i * step}ms`, "--ms": `${step - 70}ms` })} />
          </g>
        ))}
      </g>
      <Traveler className={cn(styles.tool, styles.late)} path={path}>
        <g className={styles.pencilTap}>
          <g transform="rotate(34)">
            <path d="M0 0l-2 -5h4z" className={styles.pencilTip} />
            <rect x="-2" y="-17" width="4" height="12" rx=".6" className={styles.pencilBody} />
            <rect x="-2" y="-20" width="4" height="3" rx="1" className={styles.pencilEnd} />
          </g>
        </g>
      </Traveler>
      {[
        [x + w - 10, y + 10, 0],
        [x + w + 6, y + 30, 1],
      ].map(([sx, sy, k]) => (
        <path key={k} d={`M${sx} ${sy - 4} l1.1 2.9 2.9 1.1 -2.9 1.1 -1.1 2.9 -1.1 -2.9 -2.9 -1.1 2.9 -1.1z`} className={styles.twinkle} style={vars({ "--d": `${start + rows.length * step + k * 260}ms`, transformOrigin: `${sx}px ${sy}px` })} />
      ))}
      <Bell x={252} mood="nod" />
      {/* İnce belli çay bardağı, tabağında; buğu döner (tek küçük öğe). */}
      <g transform={`translate(296 ${DESK})`}>
        <path d={GLASS} transform="scale(.9 1)" className={styles.teaGlass} />
        <path d="M-5.5 -3.4c0-3.3-2.8-4.6-2.8-8.1 0-2.6 1.6-4.4 2.4-7.5h11.8c.8 3.1 2.4 4.9 2.4 7.5 0 3.5-2.8 4.8-2.8 8.1z" transform="scale(.9 1)" className={styles.tea} />
        <path d={GLASS} transform="scale(.9 1)" className={styles.teaLine} />
        <rect x="-12" y="-3" width="24" height="3" rx="1.5" className={styles.saucer} />
        {[-3.5, 0.5, 4.5].map((sx, i) => (
          <path key={i} d={`M${sx} -25q2.2-3 0-6t0-6`} className={styles.steam} style={vars({ "--d": `${i * 700}ms` })} />
        ))}
      </g>
    </>
  );
}
