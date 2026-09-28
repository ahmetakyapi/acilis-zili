"use client";

import { animate } from "motion/react";
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
import { anchorOf, MACRO_GROUPS, type MacroGroupKey } from "./macro-groups";
import { formatMacroValue, type MacroValueFormat } from "./macro-format";
import styles from "./MacroExperience.module.css";

/* --------------------------------------------------------------------------
   /makro: üstte bütün göstergelerin ÖZETİ, altta grup grup ayrıntı.

   ÖZET ÜSTTE, GRAFİK ALTTA (29 Eylül, sahibinin isteği). Önceki düzende
   kapakta tek bir büyük grafik (grup sekmeleri + seri çipleri) ve onun
   ALTINDA bütün serilerin küçük çoklu ızgarası vardı: on bir göstergenin
   tek bakışta okunduğu yer sayfanın ikinci ekranındaydı (1440'ta 1070.
   piksel, 390'da 1042.) ve ilk ekranı tek bir serinin grafiği tutuyordu.
   Şimdi sıra tersine: kapakta başlığın hemen altında özet ızgarası
   (ad, dönem, değer, değişim, mini çizgi), kapağın dibinde faiz ve
   oynaklık; altta dört grup bölümü, her birinde o grubun büyük grafiği.
   Grup sekmeleri kalktı, çünkü grup artık bir BÖLÜM; seri çipleri bölümün
   içinde kaldı.

   ÖZET KARTI BİR ÇAPA. `<a href="#makro-enflasyon">`: JavaScript yokken
   tarayıcı bölüme iner ve bölüm grubun ilk serisini gösterir. JavaScript
   varken bağlantı o SERİYİ bölümün sahnesinde seçip bölüme kaydırıyor;
   adres değişmiyor (sığ adres güncellemesi uçuştaki gezinmeyi öldürüyor,
   CLAUDE.md "İstemci ile sunucu sınırı").

   ESKİ KAPAK (28 Eylül, ölçüldü). Solda başlık ve on bir satırlık dikey
   liste, sağda seçilenin grafiği vardı; liste 570 piksel boy aldı, yanındaki
   grafik 176 pikselde kaldı. Seçimin yatay (çip) olması o ölçümden.

   DURUM İSTEMCİDE, ADRESTE DEĞİL. Her grubun seçili serisi ayrı tutuluyor;
   bir bölümde seri değiştirmek ötekilerin grafiğini oynatmıyor.

   VERİ BİR SÖZ (Promise) OLARAK GELİYOR. Sayfa `getMacroBoard`ı beklemeden
   başlığı gönderiyor; özet ve bölümler AYNI sözü `use()` ile okuyup kendi
   Suspense sınırlarında akıyor (ölçüm sayfa dosyasında). Özetteki sayı ile
   bölümdeki büyük rakam aynı nesneden okunuyor; iki ayrı istek iki farklı
   değer basamaz.
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

type Selection = {
  board: Promise<BoardData>;
  labels: BoardLabels;
  /** Grup başına seçili seri; yoksa grubun ilk serisi. */
  selected: Partial<Record<MacroGroupKey, string>>;
  /** Okuyucu o grupta bir seçim yaptı mı: giriş hareketleri yalnızca o zaman oynar. */
  switched: Partial<Record<MacroGroupKey, boolean>>;
  select: (group: MacroGroupKey, id: string) => void;
  /** Özet kartından: seriyi bölümünde seç, bölüme kaydır. */
  jump: (series: BoardSeries) => void;
};

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("MacroSelection sağlayıcısı eksik");
  return value;
}

export function MacroSelection({ board, labels, children }: {
  board: Promise<BoardData>;
  labels: BoardLabels;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Partial<Record<MacroGroupKey, string>>>({});
  const [switched, setSwitched] = useState<Partial<Record<MacroGroupKey, boolean>>>({});
  const reduced = useMotionPreference();
  const select = useCallback((group: MacroGroupKey, id: string) => {
    setSelected((current) => ({ ...current, [group]: id }));
    setSwitched((current) => (current[group] ? current : { ...current, [group]: true }));
  }, []);
  const jump = useCallback((series: BoardSeries) => {
    select(series.group, series.id);
    document.getElementById(anchorOf(series.group))?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [select, reduced]);
  const value = useMemo(
    () => ({ board, labels, selected, switched, select, jump }),
    [board, labels, selected, switched, select, jump],
  );
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

function directionOf(series: BoardSeries): "up" | "down" | null {
  return series.delta === null || Math.abs(series.delta) < FLAT_DELTA ? null : series.delta > 0 ? "up" : "down";
}

/* ---------------------------------------------------------------- Sahne */

function MacroStage({ group, series, extra }: { group: MacroGroupKey; series: BoardSeries[]; extra?: ReactNode }) {
  const { labels, selected, switched, select } = useSelection();
  const chips = useId();
  const active = series.find((item) => item.id === selected[group]) ?? series[0];
  const play = switched[group] ?? false;
  const headingId = `${anchorOf(group)}-seri`;

  return (
    <div className={styles.stage}>
      {/* Tek serili grupta çip basılmaz: seçilecek bir şey yok. Çipte değer
          YOK (29 Eylül): bütün değerler hemen yukarıdaki özette ve seçili
          olanınki bir satır aşağıda büyük puntoyla; üçüncü kez yazmak
          yarım genişlikteki bölümde çip satırını taşırıyordu. */}
      {series.length > 1 && (
        <div id={chips} className={styles.chips} role="group" aria-label={labels.seriesLabel}>
          {series.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === active.id} aria-controls={headingId} onClick={() => item.id !== active.id && select(group, item.id)}>
              {item.title}
            </button>
          ))}
        </div>
      )}

      <div key={`okuma:${active.id}`} className={styles.reading} data-enter={play || undefined}>
        <div className={styles.readingMain}>
          <h3 id={headingId} className={styles.inkTight}>{active.title}</h3>
          <p className="numeral">{active.period}</p>
          <div className={styles.figure}>
            <strong className="numeral"><RollingValue value={active.latest} format={active.format} play={play} /></strong>
            {active.delta !== null && <Delta series={active} labels={labels} />}
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

      <HistoryChart key={`grafik:${active.id}`} series={active} labels={labels} play={play} />

      {extra}

      {(active.note || active.stamp) && (
        <div className={styles.stageFoot}>
          {active.note && <p>{active.note}</p>}
          {active.stamp}
        </div>
      )}
    </div>
  );
}

/**
 * Değişim hapı: ok yalnızca YÖNÜ söyler (yükseliş accent mavi, düşüş
 * kırmızı). Yeşil yok; makroda yükselmek iyi haber demek değil (enflasyon).
 */
function Delta({ series, labels }: { series: BoardSeries; labels: BoardLabels }) {
  const direction = directionOf(series);
  return (
    <span className={`${styles.delta} numeral`} data-tone={direction ?? "flat"}>
      {direction ? (
        <>
          <span aria-hidden>{direction === "up" ? "▲" : "▼"}</span>
          {series.deltaLabel}
        </>
      ) : labels.unchanged}
    </span>
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
const CHART_H = 240;

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

/* ------------------------------------------------------------- Özet */

const MINI_W = 200;
const MINI_H = 56;

/**
 * Mini çizgi: büyük grafikle aynı ölçek dili (eşik ve sıfır çizgisi,
 * dolgu). Yalnızca serinin kendi gözlemlerinden; iki noktadan azsa hiç
 * basılmaz, düz bir çizgi uydurulmaz.
 */
function Spark({ series }: { series: BoardSeries }) {
  const gradient = useId();
  const points = series.points;
  if (points.length < 2) return <span className={styles.tileSpark} aria-hidden />;
  const domain = domainOf(points, series.threshold?.value ?? null);
  const t0 = points[0].t;
  const span = points[points.length - 1].t - t0 || 1;
  const x = (t: number) => ((t - t0) / span) * MINI_W;
  const y = (value: number) => (1 - (value - domain.lo) / (domain.hi - domain.lo)) * MINI_H;
  const line = points.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)},${y(point.value).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`} preserveAspectRatio="none" aria-hidden className={styles.tileSpark}>
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

/**
 * Özet ızgarası: kapakta, başlığın hemen altında, her gösterge bir kart.
 *
 * AYNI HAT. Kart ızgaranın üç SATIRINI alt ızgara (`subgrid`) olarak
 * kullanıyor: başlık/künye, değer/değişim, mini çizgi. Bir satırdaki
 * kartlardan birinin adı iki satıra kırıldığında o satırın bütün kartları
 * aynı başlık yüksekliğini alıyor ve değerler aynı hatta biter (CLAUDE.md
 * "yan yana duran ölçüler aynı hatta biter").
 *
 * DÖNEM KÜNYESİ HER KARTTA. Seriler aynı günün verisi değil: TÜFE bir ay,
 * çekirdek PCE iki ay geriden yayımlanıyor, işsizlik başvuruları haftalık,
 * faiz farkı günlük. Değerin hangi döneme ait olduğu adın hemen altında;
 * "bugün" izlenimi veren bir sayı yok (veri dürüstlüğü 2. madde).
 */
export function MacroSummary({ empty }: { empty: ReactNode }) {
  const { board, labels, jump } = useSelection();
  const { series } = use(board);
  if (series.length === 0) return <>{empty}</>;
  return (
    <section className={styles.summary} aria-labelledby="makro-ozet">
      <h2 id="makro-ozet" className={styles.summaryTitle}>{labels.all}</h2>
      <div className={styles.summaryGrid} data-motion-stagger>
        {series.map((item) => (
          <a
            key={item.id}
            href={`#${anchorOf(item.group)}`}
            className={styles.tile}
            data-summary-tile={item.id}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              jump(item);
            }}
          >
            <span className={styles.tileHead}>
              <span className={styles.tileTitle}>{item.title}</span>
              <span className={styles.tileMeta}>
                <span className="numeral">{item.period}</span>
                {item.status && <span className={styles.status} data-alert={isAlert(item) ? "" : undefined}>{item.status}</span>}
              </span>
            </span>
            <span className={styles.tileFigure} data-summary-figure>
              <b className="numeral">{formatMacroValue(item.latest, item.format)}</b>
              {item.delta !== null && <Delta series={item} labels={labels} />}
            </span>
            <Spark series={item} />
          </a>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Bölümler */

/**
 * Ayrıntı: her grup bir bölüm, bölümün başlığı grubun adı; geniş ekranda
 * ikişer yan yana (CSS). Para politikası bölümü sonraki FOMC şeridini
 * grafiğin altında taşıyor: politika faizi
 * kartının "Sonraki Açıklama" satırı aylık ortalamanın yayın günü, karar
 * günü değil; kararın kendisi o kartta.
 */
export function MacroSections({ fomc }: { fomc: ReactNode }) {
  const { board, labels } = useSelection();
  const { series } = use(board);
  if (series.length === 0) return null;
  const groups = MACRO_GROUPS.filter((group) => series.some((item) => item.group === group.key));
  return (
    <div className={styles.sections}>
      {groups.map((group) => (
        <section key={group.key} id={group.anchor} className={styles.section} aria-labelledby={`${group.anchor}-baslik`}>
          <h2 id={`${group.anchor}-baslik`} className={styles.sectionTitle}>{labels.groups[group.key]}</h2>
          <MacroStage
            group={group.key}
            series={series.filter((item) => item.group === group.key)}
            extra={group.key === "policy" ? fomc : undefined}
          />
        </section>
      ))}
    </div>
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
