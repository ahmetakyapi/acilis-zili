"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ACTS, CURTAIN_S, FILM_HEADLINES, FILM_SESSIONS, filmPalette, filmStory, renderFilm, type FilmData, type FilmPalette, type FilmStory, type FilmText } from "@/lib/ink/analysis-film";
import type { Point } from "@/lib/ink/engine";
import { formatPercent, formatPrice } from "@/lib/utils";
import { EASE_BRAND } from "@/lib/motion";
import styles from "./AnalysisFilm.module.css";

export type FilmBar = { o: number; h: number; l: number; c: number };
type T = Dictionary["aiAnalysis"];

/** Perde bitince rapor sekmesine geçilir (ClaudeWorkbench). */
export const CURTAIN_MS = CURTAIN_S * 1000;
/** Hareketi azaltana her perdenin SON karesi (sn): film değil, o adımın resmi. I: çizgi ve
 *  künyeleri; II: ortalamalar ve kesişme; III: manşet kartları; IV: duruk özet (zaman
 *  `renderFilm`in içinde okuma turunun sonuna kıstırılır, büyük sayı oraya düşer). */
const STILL_AT = [ACTS[1] - 0.05, ACTS[2] - 0.6, ACTS[3] - 0.6, ACTS[3] + 60];
const NUMERALS = ["I", "II", "III", "IV"] as const;
/** I–III'ün süresi (ms): çizgi gerçek süreyle dolar. IV'ün süresi YOK — Claude
 *  bitene kadar sürer ve ne kadar süreceğini bilmiyoruz. Eskiden 5 sn'de dolup
 *  dolu kalıyordu; dolu çizgi "bitti" diye okunur (anatomy: bilmediğin şeyin
 *  ilerlemesini uydurma). IV açık uçlu: çizgide gidip gelen bir parça, sayı
 *  künyedeki "Geçen" süresinde. */
const ACT_MS = ACTS.slice(1).map((end, i) => (end - ACTS[i]) * 1000);
const OPEN_ACT = ACTS.length - 1;
const MAX_DPR = 2;
/** Ekran dışını erken sezmek için kenar payı (anatomy: rootMargin 120px). */
const VIEW_MARGIN = "120px 0px";
/** Film masanın boyundan kendi oranına bu sürede büyür (ms). */
const GROW_MS = 560;
/** Duruk karede "Geçen" künyesinin yazılma aralığı (ms): kare çizilmiyor, yalnız saniye. */
const IDLE_TICK_MS = 1000;

function rsi14(closes: number[]) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/**
 * CANLI KÜNYE (11 Ekim; anatomy skill'inin "readout" kuralı: kartın köşesinde,
 * çizimin kendisini çizen veriden gerçek sayılar). I tuvaldeki seans sayısı, II
 * RSI (tuvaldeki mumların kapanışlarından), III tuvale yazılan manşet sayısı, IV
 * gerçekten geçen süre. Uydurma bir ilerleme yüzdesi yok: Claude'un ne kadar
 * sürdüğünü bilmiyoruz, ne kadar geçtiğini biliyoruz. 25 Ekim: I'deki son kapanış
 * ve II'deki 20 günlük künyeden çıktı — ikisi artık tuvalde ve altyazıda yazıyor;
 * üçüncü kez yazmak gürültüydü.
 */
function readoutOf(act: number, story: FilmStory, closes: number[], headlines: string[], seconds: number, R: T["claude"]["film"]["readout"], locale: Locale) {
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  if (act === 0) return R.sessions.replace("{n}", String(story.n));
  if (act === 1) {
    const rsi = rsi14(closes);
    return rsi !== null ? `RSI ${rsi.toLocaleString(tag, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}` : "";
  }
  if (act === 2) return R.headlines.replace("{n}", String(Math.min(FILM_HEADLINES, headlines.length)));
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
  return R.elapsed.replace("{t}", `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
}

/**
 * Perdenin altyazısı (25 Ekim, kısa film): I'de öykünün kendisi (nereden nereye), II'de
 * ortalamaların söylediği. Sayılar `filmStory`den — tuvaldeki künyelerle AYNI kaynak.
 * Veri yetmezse (ortalama yok) sahnenin sabit cümlesi kalır.
 */
function storyLine(act: number, story: FilmStory, F: T["claude"]["film"], fallback: string, locale: Locale) {
  const money = (v: number) => formatPrice(v, locale, { currency: true });
  if (act === 0 && story.n >= 2) return F.story.journey.replace("{n}", String(story.n)).replace("{from}", money(story.first)).replace("{to}", money(story.last)).replace("{pct}", formatPercent(story.change, locale));
  if (act === 1 && story.vs20 && story.vs50) return F.story.trend.replace("{a}", F.story[story.vs20]).replace("{b}", F.story[story.vs50]);
  return fallback;
}

/** Palet token'lardan, `filmPalette`in tek okuyucusuyla (analysis-film.ts; tema değişince yeniden okunur). */
function readPalette(): FilmPalette {
  const css = getComputedStyle(document.documentElement);
  return filmPalette(name => css.getPropertyValue(name).trim(), getComputedStyle(document.body).fontFamily || "sans-serif");
}

/**
 * Bekleme filmi: tek mürekkep çizgisinin kesilmeyen planı (`lib/ink/analysis-film.ts`).
 * Tuval süs (`aria-hidden`); ne olduğu altyazıda ve `role="status"` ile söylenir.
 * Son perdede "Rapor Hazır" tuvalde dev yazıyla çizildiği için altyazı yalnız
 * ekran okuyucuda kalır. Sel ekranı kaplarken altyazı rengini ÇEVİRMEZ (21 Ekim):
 * sel artık temanın kendi ailesinde bir mavi dalga (açıkta açık, koyuda koyu);
 * eski `data-inverted` hâli açık temada sayfanın içinde koyu bir film açıyordu.
 */
export function AnalysisFilm({ bars: allBars, headlines, symbol, name, logoUrl, logoImage, done, t, locale, fromHeight, origin }: {
  /** Son `FILM_SESSIONS` seans çizilir; öncesindeki (en fazla `MA_LEAD`) yalnız ortalamaların gerçek penceresi. */
  bars: FilmBar[]; headlines: string[]; symbol: string; name: string; logoUrl: string | null; done: boolean; t: T; locale: Locale;
  /** Analiz masasının boyu (ClaudeWorkbench): film o boydan KENDİ oranına büyür.
   *  25 Ekim'e kadar film masanın boyunda açılıp oranını kapatıyordu (`minHeight`);
   *  masa artık kısa bir eylem kartı (1280'de ~300 px) ve film o boyda sıkışırdı. */
  fromHeight?: number | null;
  /** Düğmenin büzüldüğü damlanın sahnedeki yeri: film o damlayla açılır. */
  origin?: Point | null;
  /** Açılış sahnesinin önceden çözdüğü logo (ClaudeWorkbench); yoksa film kendisi indirir. */
  logoImage?: HTMLImageElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<number | null>(null);
  /** Filmin başladığı an (performance.now); bitiş anı buna göre saniye. */
  const startedRef = useRef(0);
  const [act, setAct] = useState(0);
  /** Geçen tam saniye: IV. perdenin künyesi (saniyede bir yazılır, her karede değil). */
  const [seconds, setSeconds] = useState(0);
  /** Duruk karede duran döngüyü yeniden başlatır (sonuç gelince); efektin içinde kurulur. */
  const wakeRef = useRef<(() => void) | null>(null);
  const S = t.claude.scenes;
  const bars = useMemo(() => allBars.slice(-FILM_SESSIONS), [allBars]);
  const lead = useMemo(() => allBars.slice(0, -FILM_SESSIONS).map(b => b.c), [allBars]);
  const story = useMemo(() => filmStory({ closes: bars.map(b => b.c), highs: bars.map(b => b.h), lows: bars.map(b => b.l), lead }), [bars, lead]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Logo tuvale çizilir; inmeden önce yerine harfli karo durur (render her karede `complete`a bakar).
    const logo = logoImage ?? (logoUrl ? Object.assign(new Image(), { decoding: "async", src: logoUrl }) : null);
    const data: FilmData = { opens: bars.map(b => b.o), closes: bars.map(b => b.c), highs: bars.map(b => b.h), lows: bars.map(b => b.l), lead, headlines, logo, origin };
    const F = t.claude.film;
    // Sayılar sitenin biçiminde (lib/utils): "212,21 $", "+%8,80"; ekrandaki künyelerle aynı.
    const text: FilmText = {
      symbol, name, locale: locale === "tr" ? "tr-TR" : "en-US",
      last: F.last, first: F.first, high: F.high, low: F.low, ma20: F.ma20, ma50: F.ma50, strongest: F.strongest, cross: F.cross,
      ready: t.claude.ready, noNews: t.noNewsShort,
      money: v => formatPrice(v, locale, { currency: true }), percent: v => formatPercent(v, locale),
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
    /** Okuma turu bitince kare duruktur (`idle`): sonuç gelene ya da boyut/tema değişene
     *  kadar yeniden çizilmez — telefonda CPU boşa yanmasın. */
    let frozen = false;
    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const doneAt = doneRef.current;
      frozen = renderFilm(ctx, { t: time, doneAt: doneAt === null ? null : Math.min(doneAt, time) }, pal, data, text, { w, h }).idle;
    };
    const actOf = (time: number) => doneRef.current !== null ? 4 : ACTS.findLastIndex(start => time >= start);
    /* EKRAN DIŞINDA DURUR (anatomy, motion.md). Film zamana bağlı bir öykü:
       geri gelince kaldığı yerden değil GEÇEN zamandan sürer. Gözlemcinin EN
       YENİ kaydı okunur — ekrandan çıkıp dönen kutu tek çağrıda iki kayıt
       getirir, ilki okunursa film ekrandayken donar. */
    let visible = true, running = false, idleTimer = 0, cancelled = false;
    /* DURUK KAREDE DÖNGÜ DE DURUR (25 Ekim). Tuval duruk karede çizilmiyordu
       ama rAF her karede dönüp iki `setState` çağırıyordu (perde ve saniye;
       React aynı değerde vazgeçse de çağrı ve zamanlayıcı her karede). Şimdi
       okuma turu bitince döngü kapanır; "Geçen" künyesi saniyede bir
       aralıkla yazılır. Sonuç gelince (`wakeRef`), boyut ya da tema değişince
       döngü yeniden başlar. Ölçüm (390, NVDA, istek askıda, 55. saniye, 5 sn
       örnek): önce 60 rAF/sn ve 20,4 ms/sn ana iş parçacığı; sonra 0 rAF/sn ve
       7–9 ms/sn (geliştirme kipi). Sonuç gelince döngü 60 rAF/sn'ye döndü. */
    const sleep = () => {
      raf = 0;
      if (idleTimer) return;
      idleTimer = window.setInterval(() => { if (visible) setSeconds(Math.floor(clock())); }, IDLE_TICK_MS);
    };
    const wake = () => {
      if (!running || cancelled || media.matches || !visible || raf) return;
      clearInterval(idleTimer); idleTimer = 0;
      raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      if (!visible) { raf = 0; return; }
      const time = clock();
      if (!frozen || doneRef.current !== null) draw(time);
      setAct(actOf(time));
      setSeconds(Math.floor(time));
      if (frozen && doneRef.current === null) { sleep(); return; }
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
      // Hareketi azaltılmışta da ekran dışında çizilmez: aralık sürer (perde ve
      // geçen süre doğru kalsın) ama görünmezken tuvale dokunmaz.
      if (media.matches) { still(); stillTimer = window.setInterval(() => { if (!visible) return; still(); setSeconds(Math.floor(clock())); }, 500); } else raf = requestAnimationFrame(tick);
    });
    const observer = new ResizeObserver(() => { resize(); frozen = false; if (media.matches) still(); else wake(); });
    observer.observe(canvas);
    const view = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (!visible || !running || cancelled) return;
      if (media.matches) { still(); setSeconds(Math.floor(clock())); } else if (!raf && !idleTimer) raf = requestAnimationFrame(tick);
    }, { rootMargin: VIEW_MARGIN });
    view.observe(canvas);
    const themeWatch = new MutationObserver(() => { pal = readPalette(); frozen = false; if (media.matches) still(); else wake(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    wakeRef.current = wake;
    return () => { cancelled = true; wakeRef.current = null; cancelAnimationFrame(raf); clearInterval(stillTimer); clearInterval(idleTimer); observer.disconnect(); view.disconnect(); themeWatch.disconnect(); };
  }, [bars, lead, headlines, symbol, name, logoUrl, logoImage, locale, t.claude, t.noNewsShort, origin]);

  // Büyüme yalnız ilk açılışta, Web Animations ile (CSS değişkeni `element.animate`ta
  // çözülmüyor: eğri lib/motion.ts → EASE_BRAND). Hareketi azaltana anında tam boy.
  const grownRef = useRef(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || grownRef.current || !fromHeight) return;
    grownRef.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.offsetHeight;
    if (Math.abs(to - fromHeight) < 4) return;
    el.animate([{ height: `${fromHeight}px` }, { height: `${to}px` }], { duration: GROW_MS, easing: EASE_BRAND });
  }, [fromHeight]);

  useEffect(() => {
    if (done && doneRef.current === null) {
      doneRef.current = (performance.now() - startedRef.current) / 1000;
      wakeRef.current?.();
    }
  }, [done]);

  const caption = act === 4 ? { title: t.claude.ready, line: "" } : { title: S[act].title, line: storyLine(act, story, t.claude.film, S[act].line, locale) };
  const readout = act < 4 ? readoutOf(act, story, bars.map(b => b.c), headlines, seconds, t.claude.film.readout, locale) : "";
  return <div className={styles.stage} role="status" aria-live="polite" aria-label={`${t.claude.stage}: ${caption.title}`}
    data-final={act === 4 ? "" : undefined} ref={stageRef}>
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    <div className={styles.caption} key={act}>
      {act < 4 && <span className={styles.sceneNo}>{NUMERALS[act]}</span>}
      <strong>{caption.title}</strong>
      {caption.line && <span className={styles.line}>{caption.line}</span>}
      {/* Künye ekran okuyucuya okunmaz: canlı bölge yalnız perde değişince konuşur, saniyeyi saymaz. */}
      {readout && <span className={styles.readout} aria-hidden>{readout}</span>}
    </div>
    {/* ADLI PERDE ÇİPLERİ (anatomy'deki sahne sekmeleri): filmin dört perdesi bir
        bakışta, etkin olanın çizgisi gerçek süreyle dolar. Telefonda yalnız numara. */}
    <ol className={styles.progress} aria-hidden>{S.map((s, i) => <li key={s.title} style={i < OPEN_ACT ? { "--act-ms": `${ACT_MS[i]}ms` } as CSSProperties : undefined}
      data-state={act === 4 || i < act ? "done" : i === act ? (i === OPEN_ACT ? "open" : "active") : "next"}>
      <span className={styles.chip}><b>{NUMERALS[i]}</b><em>{s.title}</em></span>
      <i className={styles.bar} />
    </li>)}</ol>
  </div>;
}
