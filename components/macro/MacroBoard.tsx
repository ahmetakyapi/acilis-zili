"use client";

import { animate, motion } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { MACRO_GROUPS, type MacroGroupKey } from "./macro-groups";
import { formatMacroValue, type MacroValueFormat } from "./macro-format";
import styles from "./MacroExperience.module.css";

/* --------------------------------------------------------------------------
   /makro sahnesi: grup sekmeleri + seri çipleri + büyük grafik, altında
   bütün serilerin küçük çoklu ızgarası.

   ESKİ KAPAK (28 Eylül, ölçüldü). Solda başlık ve on bir satırlık dikey
   liste, sağda seçilenin grafiği vardı. Seri sayısı altıdan on bire
   çıkınca liste 570 piksel boy aldı, yanındaki grafik 176 pikselde kaldı:
   1280 ve 1440'ta kapak 862 piksel ve grafiğin altında ~450 piksel boş
   zemin. Sayfanın konusu olan çizgi, seçenek listesinin yanında küçük bir
   ek gibi duruyordu; üstelik aynı on bir seri kapağın hemen altında
   kart olarak BİR DAHA listeleniyordu.

   Şimdi seçim yatay: dört grup sekmesi, seçili grubun serileri çip. Grafik
   çerçevenin tam genişliğinde ve 320 piksel. İkinci liste yok; ızgaranın
   kendisi seçici: karta dokunmak sahneyi o seriye getiriyor.

   DURUM İSTEMCİDE, ADRESTE DEĞİL. Seçili seri hiçbir zaman adreste
   tutulmadı; sığ adres güncellemesi uçuştaki gezinmeyi öldürüyor ve geri
   tuşunda eski ağacı getiriyor (CLAUDE.md "İstemci ile sunucu sınırı").
   Paylaşılabilir bir adres istenmediği sürece o riski almaya değmez.

   VERİ BİR SÖZ (Promise) OLARAK GELİYOR. Sayfa `getMacroBoard`ı beklemeden
   başlığı gönderiyor; sahne ve ızgara aynı sözü `use()` ile okuyup kendi
   Suspense sınırlarında akıyor (ölçüm sayfa dosyasında).
   -------------------------------------------------------------------------- */

export type BoardPoint = {
  /** Gözlemin UTC öğlen anı (ms): x ekseni zamana göre, sıraya göre değil. */
  t: number;
  value: number;
  /** Okuma künyesi: aylık seride ay adı, haftalık ve günlükte tam tarih. */
  date: string;
  /** Eksen künyesi: kısa. */
  axis: string;
};

export type BoardSeries = {
  id: string;
  group: MacroGroupKey;
  title: string;
  /** Son gözlemin dönemi; gecikmeli serilerde okuyucunun gördüğü tarih. */
  period: string;
  format: MacroValueFormat;
  latest: number;
  prev: number | null;
  delta: number | null;
  /** Değişimin mutlak değeri ve birimi ("0,05 Puan", "141 bin"). */
  deltaLabel: string | null;
  next: string | null;
  nextShort: string | null;
  threshold: { value: number; label: string } | null;
  status: string | null;
  note: string | null;
  points: BoardPoint[];
  stamp: ReactNode;
};

export type BoardData = { series: BoardSeries[] };

export type BoardLabels = {
  groups: Record<MacroGroupKey, string>;
  groupsLabel: string;
  seriesLabel: string;
  previous: string;
  nextRelease: string;
  noNextRelease: string;
  unchanged: string;
  history: string;
  historyEmpty: string;
  all: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;
/** Değişim bu kadarın altındaysa "Değişmedi" (FRED en çok iki hane yayımlar). */
const FLAT_DELTA = 0.001;
/** Rakamın sıfırdan yuvarlanma süresi (saniye): grafiğin çizilişiyle aynı. */
const ROLL_SECONDS = 0.7;
/** Sahnenin üstü görüş alanının bu oranından aşağıdaysa karta basınca kaydırılır. */
const STAGE_VISIBLE_RATIO = 0.35;

type Selection = {
  board: Promise<BoardData>;
  labels: BoardLabels;
  selected: string | null;
  /** Okuyucu bir seçim yaptı mı: giriş hareketleri yalnızca o zaman oynar. */
  switched: boolean;
  select: (id: string, fromGrid?: boolean) => void;
};

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("MacroSelection sağlayıcısı eksik");
  return value;
}

export const STAGE_ID = "makro-grafik";

export function MacroSelection({ board, labels, children }: {
  board: Promise<BoardData>;
  labels: BoardLabels;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [switched, setSwitched] = useState(false);
  const reduced = useMotionPreference();
  const select = useCallback((id: string, fromGrid = false) => {
    setSelected(id);
    setSwitched(true);
    if (!fromGrid) return;
    const stage = document.getElementById(STAGE_ID);
    if (!stage) return;
    const top = stage.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * STAGE_VISIBLE_RATIO) {
      stage.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }, [reduced]);
  const value = useMemo(() => ({ board, labels, selected, switched, select }), [board, labels, selected, switched, select]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

function activeOf(series: BoardSeries[], selected: string | null) {
  return series.find((item) => item.id === selected) ?? series[0];
}

/* ---------------------------------------------------------------- Sahne */

export function MacroStage({ empty }: { empty: ReactNode }) {
  const { board, labels, selected, switched, select } = useSelection();
  const { series } = use(board);
  const chips = useId();
  if (series.length === 0) return <>{empty}</>;
  const active = activeOf(series, selected);
  const groups = MACRO_GROUPS.filter((group) => series.some((item) => item.group === group.key));
  const inGroup = series.filter((item) => item.group === active.group);
  const direction = active.delta === null || Math.abs(active.delta) < FLAT_DELTA ? null : active.delta > 0 ? "up" : "down";

  return (
    <section id={STAGE_ID} className={styles.stage} aria-labelledby={`${STAGE_ID}-baslik`}>
      <div className={styles.picker}>
        <div className={styles.tabs} role="group" aria-label={labels.groupsLabel}>
          {groups.map((group) => {
            const on = group.key === active.group;
            return (
              <button
                key={group.key}
                type="button"
                aria-pressed={on}
                aria-controls={chips}
                onClick={() => {
                  if (on) return;
                  const first = series.find((item) => item.group === group.key);
                  if (first) select(first.id);
                }}
              >
                {/* Seçili hap sekmeden sekmeye KAYAR (TabUnderline ile aynı
                    yay): hangi grubun açık olduğu bir konum olarak okunuyor. */}
                {on && <motion.span layoutId="macro-group-pill" className={styles.tabPill} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span>{labels.groups[group.key]}</span>
              </button>
            );
          })}
        </div>
        <div id={chips} className={styles.chips} role="group" aria-label={labels.seriesLabel}>
          {inGroup.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === active.id} onClick={() => item.id !== active.id && select(item.id)}>
              <span>{item.title}</span>
              <b className="numeral">{formatMacroValue(item.latest, item.format)}</b>
            </button>
          ))}
        </div>
      </div>

      <div key={`okuma:${active.id}`} className={styles.reading} data-enter={switched || undefined}>
        <div className={styles.readingMain}>
          <h2 id={`${STAGE_ID}-baslik`} className={styles.inkTight}>{active.title}</h2>
          <p className="numeral">{active.period}</p>
          <div className={styles.figure}>
            <strong className="numeral"><RollingValue value={active.latest} format={active.format} play={switched} /></strong>
            {active.delta !== null && (
              <span className={`${styles.delta} numeral`} data-tone={direction ?? "flat"}>
                {direction ? (
                  <>
                    {/* Ok yalnızca yönü söyler: yükseliş accent mavi, düşüş
                        kırmızı. Yeşil yok; makroda yükselmek iyi haber demek
                        değil (enflasyon). */}
                    <span aria-hidden>{direction === "up" ? "▲" : "▼"}</span>
                    {active.deltaLabel}
                  </>
                ) : labels.unchanged}
              </span>
            )}
            {active.status && <span className={styles.status} data-alert={isAlert(active) ? "" : undefined}>{active.status}</span>}
          </div>
        </div>
        <dl className={styles.readingSide}>
          <div>
            <dt>{labels.previous}</dt>
            <dd className="numeral">{formatMacroValue(active.prev, active.format)}</dd>
          </div>
          <div>
            <dt>{labels.nextRelease}</dt>
            <dd className="numeral" data-muted={active.next ? undefined : ""}>{active.next ?? labels.noNextRelease}</dd>
          </div>
        </dl>
      </div>

      <HistoryChart key={`grafik:${active.id}`} series={active} labels={labels} play={switched} />

      {(active.note || active.stamp) && (
        <div className={styles.stageFoot}>
          {active.note && <p>{active.note}</p>}
          {active.stamp}
        </div>
      )}
    </section>
  );
}

/**
 * Yuvarlanan rakam. Sayfa yüklenirken son değer sunucudan hazır gelir ve
 * kımıldamaz; okuyucu seri değiştirdiğinde sıfırdan yuvarlanır. Ara kareler
 * React durumuna değil doğrudan metne yazılıyor (kare başına yeniden çizim
 * yok); bileşen seri başına anahtarlı olduğundan React'in metni hiç
 * değişmiyor ve çakışma yok. Hareket azaltılmışsa son değer tek seferde.
 */
function RollingValue({ value, format, play }: { value: number; format: MacroValueFormat; play: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useMotionPreference();
  const [initial] = useState(() => formatMacroValue(play && !reduced ? 0 : value, format));
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const final = formatMacroValue(value, format);
    if (!play || reduced) {
      element.textContent = final;
      return;
    }
    const controls = animate(0, value, {
      duration: ROLL_SECONDS,
      ease: EASE,
      onUpdate: (current) => { element.textContent = formatMacroValue(current, format); },
      onComplete: () => { element.textContent = final; },
    });
    return () => {
      controls.stop();
      element.textContent = final;
    };
  }, [value, format, play, reduced]);
  return <span ref={ref} aria-label={formatMacroValue(value, format)}>{initial}</span>;
}

/* ---------------------------------------------------------- Ölçek ortak */

/** Grafik ölçeğinin iki ucundaki pay (aralığın oranı). */
const DOMAIN_PAD = 0.1;
/** Hedef ızgara çizgisi sayısı. */
const TARGET_TICKS = 5;

type Domain = { lo: number; hi: number; ticks: number[] };

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Dikey ölçek: noktalar, eşik ve (seri sıfırı kesiyorsa ya da ona yakınsa)
 * sıfır. Eşik ölçeğe girmezse Sahm göstergesi hep eşiğin altında
 * görünürdü ama eşik çizgisi grafiğin DIŞINDA kalırdı; ne kadar uzak
 * olduğu okunmazdı.
 */
function domainOf(points: BoardPoint[], threshold: number | null): Domain {
  const values = points.map((point) => point.value);
  if (threshold !== null) values.push(threshold);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * DOMAIN_PAD;
  lo -= pad;
  hi += pad;
  const step = niceStep((hi - lo) / TARGET_TICKS);
  const ticks: number[] = [];
  for (let tick = Math.ceil(lo / step) * step; tick <= hi; tick += step) ticks.push(Number(tick.toFixed(10)));
  return { lo, hi, ticks };
}

/* --------------------------------------------------------- Büyük grafik */

const CHART_W = 1000;
const CHART_H = 320;

function HistoryChart({ series, labels, play }: { series: BoardSeries; labels: BoardLabels; play: boolean }) {
  const points = series.points;
  const last = points.length - 1;
  const [index, setIndex] = useState(last);
  const gradient = useId();
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const domain = domainOf(points, series.threshold?.value ?? null);
    const t0 = points[0].t;
    const span = points[last].t - t0 || 1;
    const x = (t: number) => ((t - t0) / span) * CHART_W;
    const y = (value: number) => (1 - (value - domain.lo) / (domain.hi - domain.lo)) * CHART_H;
    const coords = points.map((point) => ({ x: x(point.t), y: y(point.value) }));
    const line = coords.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("");
    return { domain, x, y, coords, line, t0, span };
  }, [points, last, series.threshold]);

  if (!geometry) return <p className={styles.noHistory}>{labels.historyEmpty}</p>;
  const { domain, y, coords, line, t0, span } = geometry;
  const current = points[index];
  const cursor = coords[index];
  const zeroInside = domain.lo < 0 && domain.hi > 0;
  const middle = points[Math.floor(last / 2)];
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  const pick = (clientX: number, bounds: DOMRect) => {
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const target = t0 + ratio * span;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].t - target) < Math.abs(points[nearest].t - target)) nearest = i;
    }
    setIndex(nearest);
  };

  return (
    <div className={styles.history}>
      {/* OLUK: ızgara etiketleri çizim alanının SOLUNDA kendi sütununda.
          Önce çizimin üstündeydiler ve telefonda serinin sol ucu ("%8")
          etiketin üstünden geçiyordu (390, ölçüldü). Etiket birimsiz:
          birim başlıkta ve okuma künyesinde yazıyor; "200 bin" yerine
          "200" oluğu daraltıyor. Yüzde işareti kalıyor, kısa. */}
      <div className={styles.plot}>
        {domain.ticks.map((tick) => (
          <span key={tick} className={`${styles.tick} numeral`} style={{ top: pct(y(tick), CHART_H) }}>
            {formatMacroValue(tick, { ...series.format, unit: "", digits: tickDigits(domain.ticks, series.format.digits) })}
          </span>
        ))}
        <div
          className={styles.canvas}
          onPointerMove={(event) => {
            /* Dokunmatikte grafik sayfayı kaydırır; okuma alttaki kaydırıcıdan. */
            if (event.pointerType === "touch") return;
            pick(event.clientX, event.currentTarget.getBoundingClientRect());
          }}
          onPointerLeave={() => setIndex(last)}
        >
          {series.threshold && (
            <span className={`${styles.thresholdTag} numeral`} style={{ top: pct(y(series.threshold.value), CHART_H) }}>
              {series.threshold.label}
            </span>
          )}
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" role="img" aria-label={`${series.title} · ${points[0].date} - ${points[last].date}`}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity=".2" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {domain.ticks.map((tick) => (
              <line key={tick} x1="0" x2={CHART_W} y1={y(tick)} y2={y(tick)} className={styles.gridLine} data-zero={tick === 0 && zeroInside ? "" : undefined} vectorEffect="non-scaling-stroke" />
            ))}
            {series.threshold && (
              <line x1="0" x2={CHART_W} y1={y(series.threshold.value)} y2={y(series.threshold.value)} className={styles.thresholdLine} vectorEffect="non-scaling-stroke" />
            )}
            {/* ÇİZİM KATMANI: seri değişince soldan sağa kırpmayla açılıyor;
                dolgu da aynı kırpımın içinde. */}
            <g className={styles.draw} data-enter={play || undefined}>
              <path d={`${line}L${coords[last].x},${CHART_H}L${coords[0].x},${CHART_H}Z`} fill={`url(#${gradient})`} />
              <path d={line} className={styles.chartLine} vectorEffect="non-scaling-stroke" />
            </g>
            <line x1={cursor.x} x2={cursor.x} y1="0" y2={CHART_H} className={styles.cursorLine} vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Nokta HTML: SVG'nin oranı serbest (preserveAspectRatio none) ve
              daire orada elipse dönüşürdü. Çizgi oraya varınca beliriyor. */}
          <span className={styles.cursorDot} data-enter={play || undefined} style={{ left: pct(cursor.x, CHART_W), top: pct(cursor.y, CHART_H) }} aria-hidden />
          <span className={`${styles.cursorTag} numeral`} data-side={cursor.x > CHART_W / 2 ? "left" : "right"} style={{ left: pct(cursor.x, CHART_W), top: pct(cursor.y, CHART_H) }} aria-hidden>
            <small>{current.date}</small>
            {formatMacroValue(current.value, series.format)}
          </span>
        </div>
      </div>
      <div className={`${styles.axis} numeral`} aria-hidden>
        <span>{points[0].axis}</span>
        <span>{middle.axis}</span>
        <span>{points[last].axis}</span>
      </div>
      <label className={styles.scrub}>
        <span>{labels.history}</span>
        <input
          type="range"
          min="0"
          max={last}
          step="1"
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-valuetext={`${current.date}: ${formatMacroValue(current.value, series.format)}`}
        />
      </label>
    </div>
  );
}

/** Izgara etiketinin hane sayısı: adım tam sayıysa ondalık basılmaz. */
function tickDigits(ticks: number[], digits: number) {
  return ticks.every((tick) => Number.isInteger(tick)) ? 0 : Math.min(digits, 2);
}

/* ------------------------------------------------------- Küçük çoklular */

const MINI_W = 200;
const MINI_H = 56;

export function MacroGrid({ fomc }: { fomc: ReactNode }) {
  const { board, labels, selected, select } = useSelection();
  const { series } = use(board);
  if (series.length === 0) return null;
  const active = activeOf(series, selected);
  return (
    <section className={styles.multiples} aria-labelledby="makro-tumu">
      <h2 id="makro-tumu" className={styles.multiplesTitle}>{labels.all}</h2>
      <div className={styles.grid} data-motion-stagger>
        {fomc}
        {series.map((item) => (
          <MiniCard key={item.id} series={item} active={item.id === active.id} labels={labels} onSelect={() => select(item.id, true)} />
        ))}
      </div>
    </section>
  );
}

function MiniCard({ series, active, labels, onSelect }: {
  series: BoardSeries;
  active: boolean;
  labels: BoardLabels;
  onSelect: () => void;
}) {
  const gradient = useId();
  const points = series.points;
  const direction = series.delta === null || Math.abs(series.delta) < FLAT_DELTA ? null : series.delta > 0 ? "up" : "down";
  let spark: ReactNode = null;
  if (points.length >= 2) {
    const domain = domainOf(points, series.threshold?.value ?? null);
    const t0 = points[0].t;
    const span = points.at(-1)!.t - t0 || 1;
    const x = (t: number) => ((t - t0) / span) * MINI_W;
    const y = (value: number) => (1 - (value - domain.lo) / (domain.hi - domain.lo)) * MINI_H;
    const line = points.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)},${y(point.value).toFixed(1)}`).join("");
    spark = (
      <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`} preserveAspectRatio="none" aria-hidden className={styles.mini}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {domain.lo < 0 && domain.hi > 0 && (
          <line x1="0" x2={MINI_W} y1={y(0)} y2={y(0)} className={styles.gridLine} data-zero="" vectorEffect="non-scaling-stroke" />
        )}
        {series.threshold && (
          <line x1="0" x2={MINI_W} y1={y(series.threshold.value)} y2={y(series.threshold.value)} className={styles.thresholdLine} vectorEffect="non-scaling-stroke" />
        )}
        {/* `spark-*` sınıfları: görünüme girince MotionExperience çiziyor
            (çizgi, sonra dolgu), sitenin bütün mini grafikleri gibi. */}
        <path className="spark-area" d={`${line}L${MINI_W},${MINI_H}L0,${MINI_H}Z`} fill={`url(#${gradient})`} />
        <path className={`spark-line ${styles.chartLine}`} d={line} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  return (
    <button type="button" className={styles.card} aria-pressed={active} aria-controls={STAGE_ID} onClick={onSelect}>
      <span className={styles.cardHead}>
        <span className={styles.cardTitle}>{series.title}</span>
        <span className={`${styles.cardPeriod} numeral`}>{series.period}</span>
      </span>
      <span className={styles.cardFigure}>
        <b className="numeral">{formatMacroValue(series.latest, series.format)}</b>
        {series.delta !== null && (
          <span className={`${styles.delta} numeral`} data-tone={direction ?? "flat"}>
            {direction ? <><span aria-hidden>{direction === "up" ? "▲" : "▼"}</span>{series.deltaLabel}</> : labels.unchanged}
          </span>
        )}
      </span>
      {series.status && <span className={styles.status} data-alert={isAlert(series) ? "" : undefined}>{series.status}</span>}
      {spark}
      <span className={styles.cardFoot}>
        <span>{labels.nextRelease}</span>
        <span className="numeral" data-muted={series.nextShort ? undefined : ""}>{series.nextShort ?? labels.noNextRelease}</span>
      </span>
    </button>
  );
}

/**
 * Durum rozeti ne zaman uyarı tonunda (pirinç): Sahm eşiği aşıldığında ya
 * da eğri ters döndüğünde. Yeşil/kırmızı değil: rozet bir yön değil bir
 * eşiğe göre konum söylüyor.
 */
function isAlert(series: BoardSeries) {
  if (!series.threshold) return false;
  return series.id === "T10Y3M" ? series.latest < series.threshold.value : series.latest >= series.threshold.value;
}
