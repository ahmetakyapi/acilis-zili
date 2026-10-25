"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import {
  SWARM_MODES,
  entryTiming,
  noteDelay,
  sizeKeyRow,
  swarmDomain,
  swarmClipped,
  swarmExtremes,
  swarmLayout,
  swarmX,
  type SceneStock,
  type SwarmDot,
  type SwarmLayout,
  type SwarmRow,
} from "@/lib/day-poster-scene";
import type { Dictionary, Locale } from "@/lib/i18n";
import { EASE_BRAND } from "@/lib/motion";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent, formatPercentPlain } from "@/lib/utils";
import styles from "./PosterStage.module.css";

/**
 * POSTERİN SAHNESİ — S&P 500'ün her hissesi bir nokta, sektör sektör
 * (25 Ekim). Yerleşim saf modülde (`lib/day-poster-scene.ts`, gerekçesi
 * orada); bu bileşen onu çiziyor ve okutuyor.
 *
 * NEDEN SVG, TUVAL DEĞİL. ~500 nokta SVG için hafif (ölçüm bileşenin
 * CSS'inde) ve üç şey kazandırıyor: sunucuda basılıyor (ilk karede son
 * hâlinde, JS'siz de okunuyor), satır başına `viewBox` ile kap enine
 * ölçekleniyor (yer tutucu yok, sayfa kaymıyor), renkler CSS token'ından
 * geliyor (tema değişince yeniden çizim yok). Tuval bunların üçünü de elle
 * yapmak zorundaydı.
 *
 * İKİ DÜZEN, İKİSİ DE BASILI: `narrow` (telefon: sektör adı satırın
 * üstünde, yığın tam en) ve `wide` (ad solda, yığın sağda). Hangisinin
 * görüneceğini kabın eni seçiyor (CSS kap sorgusu); sunucu ekranın enini
 * bilmediği için ikisini de basıyor, görünmeyen `display: none`.
 *
 * OKUMA KATMANLARI:
 *   - Bakış: yığının şekli. Sıfır hattının solu kırmızı, sağı yeşil; dev
 *     şirketler büyük; günün üçer uç hissesi adıyla etiketli.
 *   - Keşif: noktaya gel/dokun → ipucu (değer önde, ad, piyasa değeri);
 *     sektörün adına bas → o satır öne çıkar, ötekiler söner, satırın
 *     altında en çok yükselen/düşen üç hisse.
 *   - Klavye: her satır odaklanabilir; ok tuşları hisseleri küçükten büyüğe
 *     geziyor (ipucu ve canlı bölge birlikte), Enter hisse sayfasını açıyor.
 *     Tam liste "Tüm Hisseler"de, sektör sektör tablo (WCAG tablo ikizi).
 *
 * HAREKET: satır ekrana girince noktaları sıfır hattından yerlerine akıyor
 * (`entryTiming`, `--ease-brand`, yay yok), etiketler noktalar oturunca.
 * Kaydırma ele geçirilmiyor; her satır kendi anında bir kez. Hareketi
 * azaltana son kare (CSS gizlemeyi yalnız `no-preference`te yapıyor).
 */

export type StageSector = { symbol: string; name: string; change: number };

type StageText = Dictionary["daySignature"]["stage"];

type Active = { mode: "narrow" | "wide"; row: number; i: number } | null;

/** İşaretçinin noktayı "tuttuğu" pay (piksel): hedef noktadan büyük
 *  (dataviz: en az 24 piksellik isabet alanı → yarıçap + 12). */
const HIT_PX = 12;
/** Yüzde basamağı — posterin geri kalanıyla aynı. */
const PERCENT_DIGITS = 2;
/** Etiket ve ipucu, noktanın kenarından bu kadar uzakta (piksel). */
const TIP_GAP = 8;
/** Ölçek dışı noktanın dış halkasıyla arasındaki boşluk (sahne birimi). */
const CLIP_RING_GAP = 2.2;

export function PosterStage({
  stocks,
  sectors,
  locale,
  text,
  sized,
}: {
  stocks: SceneStock[];
  /** Satırlar bu sırayla (güçlüden zayıfa) ve fon değişimleriyle. */
  sectors: StageSector[];
  locale: Locale;
  text: StageText;
  /** Boylar piyasa değerinden mi (sembol tablosu okunabildi mi). */
  sized: boolean;
}) {
  const router = useRouter();
  const { href } = useLocaleHref();
  const stageRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [active, setActive] = useState<Active>(null);
  const [listOpen, setListOpen] = useState(false);

  const pct = useCallback((value: number) => formatPercent(value, locale, PERCENT_DIGITS), [locale]);
  const sectorName = useMemo(() => new Map(sectors.map((s) => [s.symbol, s.name] as const)), [sectors]);

  const scene = useMemo(() => {
    const domain = swarmDomain(stocks.map((stock) => stock.change));
    const extremes = swarmExtremes(stocks);
    /* Etiketli: günün üçer ucu VE ölçek dışındaki her hisse (halkalının
       gerçek değeri yalnız etiketinde okunuyor). */
    const notes = [...new Set([...extremes.up, ...extremes.down, ...swarmClipped(stocks, domain)])];
    const funds = new Map(sectors.map((s) => [s.symbol, s.change] as const));
    const order = sectors.map((s) => s.symbol);
    const args = {
      stocks,
      sectorOrder: order,
      fundChange: (sector: string) => funds.get(sector) ?? null,
      domain,
      notes,
    };
    const capMax = Math.max(0, ...stocks.map((stock) => stock.cap ?? 0));
    return {
      domain,
      extremes,
      capMax,
      layouts: {
        narrow: swarmLayout({ ...args, mode: "narrow" }),
        wide: swarmLayout({ ...args, mode: "wide" }),
      },
    };
  }, [stocks, sectors]);

  /* GİRİŞ — satır ekrana girince, görünen düzenin noktaları sıfır
     hattından yerlerine. Aynı geri çağrıda birden çok satır girerse
     aralarında kısa bir sıra (`batch`). */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rows = [...stage.querySelectorAll<HTMLElement>("[data-row]")];
    const reveal = (el: HTMLElement) => el.setAttribute("data-in", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      rows.forEach(reveal);
      return;
    }
    const play = (el: HTMLElement, batch: number) => {
      const lane = [...el.querySelectorAll<HTMLElement>("[data-lane]")].find((node) => node.offsetParent !== null);
      const k = Number(el.dataset.row);
      if (lane) {
        const layout = scene.layouts[lane.dataset.lane === "wide" ? "wide" : "narrow"];
        const row = layout.rows[k];
        const maxDist = Math.max(layout.zeroX, layout.width - layout.zeroX);
        const byI = new Map(row.dots.map((dot) => [dot.i, dot] as const));
        lane.querySelectorAll<SVGCircleElement>("circle[data-i]").forEach((circle) => {
          const dot = byI.get(Number(circle.dataset.i));
          if (!dot) return;
          const { delay, duration } = entryTiming(dot, layout.zeroX, maxDist, batch);
          circle.animate(
            [
              { transform: `translateX(${(layout.zeroX - dot.x).toFixed(1)}px)`, opacity: 0 },
              { transform: "translateX(0)", opacity: 1 },
            ],
            { duration: duration * 1000, delay: delay * 1000, easing: EASE_BRAND, fill: "backwards" },
          );
        });
        el.style.setProperty("--note-delay", `${noteDelay(row, layout.zeroX, maxDist, batch).toFixed(2)}s`);
      }
      reveal(el);
    };
    const io = new IntersectionObserver(
      (entries) => {
        let batch = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          play(entry.target as HTMLElement, batch);
          batch += 1;
        }
      },
      { threshold: 0.2 },
    );
    rows.forEach((row) => io.observe(row));
    return () => io.disconnect();
  }, [scene]);

  /* Dokunmatikte ipucu, sahnenin dışına dokununca kapanıyor. */
  useEffect(() => {
    if (!active) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node) || !stageRef.current?.contains(event.target)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const announce = useCallback(
    (i: number | null) => {
      if (!liveRef.current) return;
      if (i === null) {
        liveRef.current.textContent = "";
        return;
      }
      const stock = stocks[i];
      liveRef.current.textContent = `${stock.symbol}, ${stock.name}: ${pct(stock.change)}`;
    },
    [stocks, pct],
  );

  const onActive = useCallback(
    (mode: "narrow" | "wide", row: number, i: number | null, speak = false) => {
      setActive(i === null ? null : { mode, row, i });
      if (speak) announce(i);
    },
    [announce],
  );
  const onOpen = useCallback((symbol: string) => router.push(href(`/hisse/${symbol}`)), [router, href]);

  const tip = useCallback(
    (i: number) => {
      const stock = stocks[i];
      return {
        value: pct(stock.change),
        dir: directionOf(stock.change),
        title: `${stock.symbol} · ${stock.name}`,
        sector: sectorName.get(stock.sector) ?? stock.sector,
        cap: stock.cap !== null && sized ? text.tipCap.replace("{cap}", formatMoneyCompact(stock.cap, locale)) : null,
      };
    },
    [stocks, pct, sectorName, sized, text.tipCap, locale],
  );

  const noteText = useCallback((i: number) => ({ symbol: stocks[i].symbol, value: pct(stocks[i].change) }), [stocks, pct]);

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-poster-stage=""
      data-focus={focus ?? undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && focus) setFocus(null);
      }}
    >
      <div className={styles.axisBar} aria-hidden>
        <span className={styles.axisSpacer} />
        <Axis layout={scene.layouts.narrow} className={styles.onlyNarrow} text={text} locale={locale} />
        <Axis layout={scene.layouts.wide} className={styles.onlyWide} text={text} locale={locale} />
      </div>

      <ol className={styles.rows}>
        {sectors.map((sector, k) => {
          const isFocus = focus === sector.symbol;
          const narrowRow = scene.layouts.narrow.rows[k];
          const wideRow = scene.layouts.wide.rows[k];
          const meta = text.rowMeta
            .replace("{adv}", String(wideRow.advancing))
            .replace("{dec}", String(wideRow.declining));
          const label = text.laneLabel
            .replace("{sector}", sector.name)
            .replace("{n}", String(wideRow.dots.length))
            .replace("{adv}", String(wideRow.advancing))
            .replace("{dec}", String(wideRow.declining));
          return (
            <li key={sector.symbol} className={styles.row} data-row={k} data-active={isFocus ? "" : undefined}>
              <div className={styles.rowHead}>
                <button
                  type="button"
                  className={styles.rowName}
                  aria-pressed={isFocus}
                  onClick={() => setFocus((current) => (current === sector.symbol ? null : sector.symbol))}
                >
                  {sector.name}
                </button>
                <span className={styles.rowFigures}>
                  <span className={cn(styles.rowValue, directionText(directionOf(sector.change)))}>{pct(sector.change)}</span>
                  <span className={styles.rowMeta}>{meta}</span>
                </span>
              </div>
              {(["narrow", "wide"] as const).map((mode) => (
                <Lane
                  key={mode}
                  mode={mode}
                  layout={scene.layouts[mode]}
                  row={mode === "narrow" ? narrowRow : wideRow}
                  rowIndex={k}
                  stocks={stocks}
                  activeI={active && active.mode === mode && active.row === k ? active.i : null}
                  label={label}
                  onActive={onActive}
                  onOpen={onOpen}
                  tip={tip}
                  noteText={noteText}
                  clipText={text.tipClip}
                />
              ))}
              {isFocus && (
                <FocusLine stocks={stocks} row={wideRow} text={text} pct={pct} onClear={() => setFocus(null)} />
              )}
            </li>
          );
        })}
      </ol>
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className={styles.keyBar}>
        <span className={styles.axisSpacer} />
        <div className={styles.key}>
          {sized && scene.capMax > 0 && (
            <>
              <SizeKey capMax={scene.capMax} mode="narrow" locale={locale} label={text.legendSize} className={styles.onlyNarrow} />
              <SizeKey capMax={scene.capMax} mode="wide" locale={locale} label={text.legendSize} className={styles.onlyWide} />
            </>
          )}
          <ul className={styles.keyList}>
            <li>
              <span aria-hidden className={cn(styles.keyMark, styles.keyColor)} />
              {text.axisDown} / {text.axisUp}
            </li>
            <li>
              <span aria-hidden className={cn(styles.keyMark, styles.keyFund)} />
              {text.legendFund}
            </li>
            <li>
              <span aria-hidden className={cn(styles.keyMark, styles.keyClip)} />
              {text.legendClip}
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.listWrap}>
        <button
          type="button"
          className={styles.listToggle}
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
        >
          {listOpen ? text.allStocksClose : `${text.allStocks} (${stocks.length})`}
        </button>
        {listOpen && (
          <StockList stocks={stocks} sectors={sectors} text={text} pct={pct} locale={locale} sized={sized} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ EKSEN */

function Axis({ layout, className, text, locale }: { layout: SwarmLayout; className: string; text: StageText; locale: Locale }) {
  const mode = SWARM_MODES[layout.mode];
  const frac = (value: number) => swarmX(value, layout.domain, mode).x / layout.width;
  const at = (value: number) => `${(frac(value) * 100).toFixed(2)}%`;
  const zero = at(0);
  /* Uçtaki künye kutudan taşmasın: içeri yaslanıyor. */
  const edge = (value: number) => (frac(value) < 0.06 ? "start" : frac(value) > 0.94 ? "end" : undefined);
  const tickText = (value: number) =>
    value === 0 ? "0" : `${value > 0 ? "+" : "−"}${formatPercentPlain(value, locale, value % 1 === 0 ? 0 : 1)}`;
  return (
    <div className={cn(styles.axis, className)}>
      <span className={styles.dirDown} style={{ right: `calc(100% - ${zero})` }}>
        ← {text.axisDown}
      </span>
      <span className={styles.dirUp} style={{ left: zero }}>
        {text.axisUp} →
      </span>
      {layout.domain.ticks.map((value) => (
        <span
          key={value}
          className={cn(styles.tick, value === 0 && styles.tickZero)}
          data-edge={edge(value)}
          style={{ left: at(value) }}
        >
          {tickText(value)}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ SATIR */

type TipData = {
  value: string;
  dir: "up" | "down" | "flat";
  title: string;
  sector: string;
  cap: string | null;
};

const Lane = memo(function Lane({
  mode,
  layout,
  row,
  rowIndex,
  stocks,
  activeI,
  label,
  onActive,
  onOpen,
  tip,
  noteText,
  clipText,
}: {
  mode: "narrow" | "wide";
  layout: SwarmLayout;
  row: SwarmRow;
  rowIndex: number;
  stocks: SceneStock[];
  activeI: number | null;
  label: string;
  onActive: (mode: "narrow" | "wide", row: number, i: number | null, speak?: boolean) => void;
  onOpen: (symbol: string) => void;
  tip: (i: number) => TipData;
  noteText: (i: number) => { symbol: string; value: string };
  clipText: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = layout.width;
  const H = Number(row.height.toFixed(2));
  const mode$ = SWARM_MODES[mode];
  const ticks = layout.domain.ticks.map((value) => ({ value, x: swarmX(value, layout.domain, mode$).x }));
  /* Noktalar bir kez: ipucu değişince yalnız halka yeniden çiziliyor. */
  const dots = useMemo(
    () =>
      row.dots.map((dot) => {
        const change = stocks[dot.i].change;
        const tone = change > 0 ? styles.up : change < 0 ? styles.down : styles.flat;
        const cx = dot.x.toFixed(1);
        const cy = dot.y.toFixed(1);
        /* Ölçek dışı: tam opak nokta + dış halka (halka da `data-i` taşıyor,
           girişte noktasıyla birlikte akıyor). */
        return dot.clip === 0 ? (
          <circle key={dot.i} data-i={dot.i} cx={cx} cy={cy} r={dot.r.toFixed(2)} className={tone} />
        ) : (
          <g key={dot.i}>
            <circle data-i={dot.i} cx={cx} cy={cy} r={dot.r.toFixed(2)} className={cn(tone, styles.clip)} />
            <circle data-i={dot.i} cx={cx} cy={cy} r={(dot.r + CLIP_RING_GAP).toFixed(2)} className={styles.clipRing} />
          </g>
        );
      }),
    [row, stocks],
  );
  /* Klavye sırası: soldan sağa, yani en çok düşenden en çok yükselene. */
  const order = useMemo(() => [...row.dots].sort((a, b) => a.x - b.x || a.i - b.i), [row]);
  const activeDot = activeI === null ? null : (row.dots.find((dot) => dot.i === activeI) ?? null);

  const pick = (event: PointerEvent<HTMLDivElement>): SwarmDot | null => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const k = box.width / W;
    const ux = (event.clientX - box.left) / k;
    const uy = (event.clientY - box.top) / k;
    let best: SwarmDot | null = null;
    let bestD = Infinity;
    for (const dot of row.dots) {
      const d = Math.hypot(dot.x - ux, dot.y - uy);
      if (d < bestD) {
        bestD = d;
        best = dot;
      }
    }
    return best && bestD * k <= best.r * k + HIT_PX ? best : null;
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = activeI === null ? -1 : order.findIndex((dot) => dot.i === activeI);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(order.length - 1, at + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = at < 0 ? order.length - 1 : Math.max(0, at - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = order.length - 1;
    else if (event.key === "Enter" && activeI !== null) {
      event.preventDefault();
      onOpen(stocks[activeI].symbol);
      return;
    } else if (event.key === "Escape" && activeI !== null) {
      event.stopPropagation();
      onActive(mode, rowIndex, null, true);
      return;
    }
    if (next === null || order.length === 0) return;
    event.preventDefault();
    onActive(mode, rowIndex, order[next].i, true);
  };

  const pos = (x: number, y: number): CSSProperties => ({
    left: `${((x / W) * 100).toFixed(2)}%`,
    top: `${((y / H) * 100).toFixed(2)}%`,
  });
  const alignOf = (x: number) => (x < W * 0.16 ? "start" : x > W * 0.84 ? "end" : "middle");

  return (
    <div
      ref={ref}
      className={cn(styles.lane, mode === "narrow" ? styles.onlyNarrow : styles.onlyWide)}
      style={{ aspectRatio: `${W} / ${H}` }}
      data-lane={mode}
      tabIndex={0}
      role="group"
      aria-label={label}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const dot = pick(event);
        if ((dot?.i ?? null) !== activeI) onActive(mode, rowIndex, dot?.i ?? null);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch" && activeI !== null) onActive(mode, rowIndex, null);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        const dot = pick(event);
        onActive(mode, rowIndex, dot && dot.i !== activeI ? dot.i : null);
      }}
      onKeyDown={onKey}
      onBlur={() => {
        if (activeI !== null) onActive(mode, rowIndex, null);
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-hidden focusable="false">
        {ticks.map((tick) =>
          tick.value === 0 ? null : (
            <line key={tick.value} className={styles.grid} x1={tick.x} x2={tick.x} y1={0} y2={H} />
          ),
        )}
        <line className={styles.zero} x1={layout.zeroX} x2={layout.zeroX} y1={0} y2={H} />
        {row.fundX !== null && (
          <g className={styles.fund}>
            <line x1={row.fundX} x2={row.fundX} y1={row.mid - mode$.minHalf * 1.4} y2={row.mid + mode$.minHalf * 1.4} />
            <path
              d={`M${row.fundX} ${row.mid - mode$.minHalf * 1.4 - 4.5} l3.5 3.5 l-3.5 3.5 l-3.5 -3.5 z`}
            />
          </g>
        )}
        <g className={styles.dots}>{dots}</g>
        {activeDot && (
          <circle className={styles.ring} cx={activeDot.x} cy={activeDot.y} r={activeDot.r + 2.4} />
        )}
      </svg>
      {row.notes.map((note) => {
        const t = noteText(note.i);
        const change = stocks[note.i].change;
        return (
          <span
            key={note.i}
            aria-hidden
            className={styles.note}
            data-align={note.align}
            style={{ ...pos(note.x, note.labelY) }}
          >
            {t.symbol} <b className={directionText(directionOf(change))}>{t.value}</b>
          </span>
        );
      })}
      {activeDot &&
        (() => {
          const data = tip(activeDot.i);
          const below = activeDot.y < H * 0.4;
          return (
            <span
              className={styles.tip}
              data-side={below ? "below" : "above"}
              data-align={alignOf(activeDot.x)}
              style={{
                ...pos(activeDot.x, below ? activeDot.y + activeDot.r : activeDot.y - activeDot.r),
                "--gap": `${TIP_GAP}px`,
              } as CSSProperties}
              aria-hidden
            >
              <b className={cn(styles.tipValue, directionText(data.dir))}>{data.value}</b>
              <span className={styles.tipTitle}>{data.title}</span>
              <span className={styles.tipMeta}>{data.sector}</span>
              {data.cap && <span className={styles.tipMeta}>{data.cap}</span>}
              {activeDot.clip !== 0 && <span className={styles.tipMeta}>{clipText}</span>}
            </span>
          );
        })()}
    </div>
  );
});

/* ------------------------------------------------------------ ÖNE ÇIKAN */

const FOCUS_COUNT = 3;

function FocusLine({
  stocks,
  row,
  text,
  pct,
  onClear,
}: {
  stocks: SceneStock[];
  row: SwarmRow;
  text: StageText;
  pct: (value: number) => string;
  onClear: () => void;
}) {
  const ranked = row.dots.map((dot) => stocks[dot.i]).sort((a, b) => b.change - a.change);
  const top = ranked.filter((s) => s.change > 0).slice(0, FOCUS_COUNT);
  const bottom = ranked
    .filter((s) => s.change < 0)
    .reverse()
    .slice(0, FOCUS_COUNT);
  const chip = (stock: SceneStock) => (
    <li key={stock.symbol}>
      <Link href={`/hisse/${stock.symbol}`} className={styles.chip}>
        <span className={styles.chipSymbol}>{stock.symbol}</span>
        <span className={directionText(directionOf(stock.change))}>{pct(stock.change)}</span>
      </Link>
    </li>
  );
  return (
    <div className={styles.focusLine}>
      {top.length > 0 && (
        <div className={styles.focusGroup}>
          <span className={styles.focusLabel}>{text.focusTop}</span>
          <ul>{top.map(chip)}</ul>
        </div>
      )}
      {bottom.length > 0 && (
        <div className={styles.focusGroup}>
          <span className={styles.focusLabel}>{text.focusBottom}</span>
          <ul>{bottom.map(chip)}</ul>
        </div>
      )}
      <button type="button" className={styles.focusClear} onClick={onClear}>
        {text.focusClear}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ BOY ANAHTARI */

/** Anahtarın künye puntosu, sahne biriminde: şerit ~0,85-0,95 ölçekte
 *  basıldığı için ekranda ~12 piksel. */
const KEY_FONT = 13;
/** Künyenin kabaca genişliği için karakter başına birim (puntonun oranı). */
const KEY_CHAR = 0.58;

/** "5,00 T $" → "5 T $": anahtarın değerleri tek anlamlı basamak. */
function keyMoney(cap: number, locale: Locale) {
  return formatMoneyCompact(cap, locale).replace(/[.,]0+(?=\D|$)/u, "");
}

function SizeKey({
  capMax,
  mode,
  locale,
  label,
  className,
}: {
  capMax: number;
  mode: "narrow" | "wide";
  locale: Locale;
  label: string;
  className: string;
}) {
  const m = SWARM_MODES[mode];
  /* Anahtar şeridin ölçeğinde: aynı viewBox eni, aynı birim — daire
     sahnedeki noktayla aynı boyda basılıyor. Künyeler de SVG'de, ki
     daireyle birlikte ölçeklensin ve hiç üst üste binmesin. */
  const h = m.rMax * 2 + 4;
  const items = sizeKeyRow(capMax, m, (cap) => keyMoney(cap, locale), KEY_FONT * KEY_CHAR);
  return (
    <div className={cn(styles.sizeKey, className)}>
      <span className={styles.sizeLabel}>{label}</span>
      <svg viewBox={`0 0 ${m.width} ${h}`} className={styles.sizeSvg} role="img" aria-label={`${label}: ${items.map((i) => i.text).join(", ")}`}>
        {items.map((item) => (
          <g key={item.cap}>
            <circle cx={item.cx} cy={h / 2} r={item.r} className={styles.sizeDot} />
            <text x={item.tx} y={h / 2} dominantBaseline="central" className={styles.sizeValue} fontSize={KEY_FONT}>
              {item.text}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------ TAM LİSTE */

function StockList({
  stocks,
  sectors,
  text,
  pct,
  locale,
  sized,
}: {
  stocks: SceneStock[];
  sectors: StageSector[];
  text: StageText;
  pct: (value: number) => string;
  locale: Locale;
  sized: boolean;
}) {
  return (
    <div className={styles.list}>
      {sectors.map((sector) => {
        const rows = stocks.filter((stock) => stock.sector === sector.symbol).sort((a, b) => b.change - a.change);
        return (
          <section key={sector.symbol} className={styles.listGroup}>
            <h4>
              {sector.name}{" "}
              <span className={directionText(directionOf(sector.change))}>{pct(sector.change)}</span>
            </h4>
            <table>
              <thead>
                <tr>
                  <th scope="col">{text.colStock}</th>
                  <th scope="col">{text.colChange}</th>
                  {sized && <th scope="col">{text.colCap}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((stock) => (
                  <tr key={stock.symbol}>
                    <th scope="row">
                      <Link href={`/hisse/${stock.symbol}`}>
                        <span className={styles.listSymbol}>{stock.symbol}</span> {stock.name}
                      </Link>
                    </th>
                    <td className={directionText(directionOf(stock.change))}>{pct(stock.change)}</td>
                    {sized && <td>{formatMoneyCompact(stock.cap, locale)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
