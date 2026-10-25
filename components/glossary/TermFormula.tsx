import type { CSSProperties, ReactNode } from "react";
import { DIAL_THRESHOLDS, type FormulaOp, type GlossaryFormula } from "@/content/glossary/formulas";
import styles from "./Glossary.module.css";

/* ==========================================================================
   Terimin formülü ve kadranı (25 Ekim) — veri `content/glossary/formulas.ts`.

   HOOK YOK, "use client" YOK: TermMark gibi hem sunucu sayfasında hem
   istemci dizininde (GlossaryBrowser) aynı modül. Hareket ortak kalıptan:
   kesir çizgisi `data-motion-draw="line"` ile ortadan iki yana açılıyor,
   kadranın dilimleri `data-motion-draw="arc"` ile uçtan uca çiziliyor;
   ilk ekranda kıpırdamıyor, hareketi azaltanda hiç hazırlanmıyor.

   RENK DENGESİ (site geneli renk kararı, 25 Ekim, güncel hâli): ekran
   canlı kalsın ama renk anlam taşısın. Kesrin zemini ve kadranın dilimleri
   mavi ailenin YUMUŞAK tonları (`--primary-tint/-faint/-soft`); kesir
   çizgisi ve kadranın eşikleri metin rengi. Doygun `--primary` (bağlantı,
   düğme) görselde ve sayıda yok.
   ========================================================================== */

export type FormulaLabels = {
  ops: Record<FormulaOp, string>;
  percent: string;
  formulaAria: string;
  rsi: { low: string; mid: string; high: string };
  pmi: { low: string; high: string };
  dialAria: string;
};

type Formula = Extract<GlossaryFormula, { kind: "formula" }>;
type Dial = Extract<GlossaryFormula, { kind: "dial" }>;

/**
 * Adın sonundaki kısaltma ya da öteki ad ("Aktif Kârlılığı (ROA)",
 * "Halka Açıklık (Free Float)") rozete ayrılıyor: tarayan göz terimi çoğu
 * zaman o adıyla arıyor. Sınır en çok iki kelime ve 18 harf — TR'de 150
 * terimin 43'ü rozet alıyor (EN 36); parantezli kalan dördü bir AÇILIM
 * taşıyor ("ADR (Amerikan Depo Sertifikası)", JOLTS, SEC) ya da üç
 * kelimelik bir açıklama ("Federal Fon Oranı") ve adın parçası kalıyor.
 */
const TRAILING_ALIAS = /^(.+?)\s+\(([^()]{1,18})\)$/u;

export function splitTerm(term: string): { name: string; abbr: string | null } {
  const match = TRAILING_ALIAS.exec(term);
  if (!match || match[2].trim().split(/\s+/).length > 2) return { name: term, abbr: null };
  return { name: match[1], abbr: match[2] };
}

/**
 * Terim kartı (29 Eylül, yedinci tur; sahibinin isteği: "tıklanabilir
 * olduğu gözükmüyor, görsel kart ve ikon olsun"). Altıncı turun sözlük
 * satırları sakindi ama bir bağlantı gibi okunmuyordu: çerçevesiz metin,
 * ok yalnızca üzerine gelince. Kart şimdi üç katlı: solda terimin kavram
 * çizimi (`TermMark`, görünüme girince uçtan uca çiziliyor), yanında ad ve
 * kısaltma rozeti, sağ üstte HEP GÖRÜNEN yuvarlak bir ok, altında tanımın
 * ilk cümlesi. Ok kartın bir düğme olduğunu dokunmatikte de söylüyor;
 * üzerine gelmeyi bekleyen bir ipucu değil. İlk denemede ok dipte
 * "Tanımı Oku" yazılı ayrı bir satırdaydı: kartı 213 pikselden ~160'a
 * çıkarıyordu (1440'ta sayfa 11.181 piksel, ölçüldü) — aynı işareti başlık
 * satırı bedavaya taşıyor.
 *
 * Beşinci turda kaldırılan işaretin gerekçesi (42 piksellik karo tanımdan
 * satır yiyordu) karo AD'ın yanına alınarak karşılandı: ad ile karo aynı
 * satırı paylaşıyor, tanım tam genişlikte.
 *
 * Kartın tamamı detaya giden bağlantı; düz tıklama sayfadan ayrılmadan
 * terim penceresini açıyor (yukarıda, `onPeekClick`). Kısa tanım en çok
 * üç satır; kırpılan kart tam cümlesini `title`da taşıyor.
 */
const OP_GLYPH: Record<FormulaOp, string> = { divide: "÷", multiply: "×", subtract: "−" };

export function formulaText(formula: Formula, lang: "tr" | "en"): string {
  const { a, b } = formula[lang];
  return `${a} ${OP_GLYPH[formula.op]} ${b}`;
}

function formulaAria(formula: Formula, lang: "tr" | "en", labels: FormulaLabels): string {
  const { a, b } = formula[lang];
  return labels.formulaAria.replace("{a}", a).replace("{op}", labels.ops[formula.op]).replace("{b}", b);
}

/**
 * Kesir (ya da tek satırlık çarpma/çıkarma). `card` kartın başlığıyla tanım
 * arasındaki şerit; `plate` terim kapağının ve günün teriminin levhası.
 *
 * Solda terimin kısaltması (F/K =): kısaltma kartın rozetinde zaten var,
 * şeritte "bu eşitlik O terimin" bağını kuruyor. Kısaltması olmayan
 * terimde (Cari Oran) sol taraf basılmıyor.
 */
export function TermFormula({
  formula,
  lang,
  labels,
  abbr,
  size,
}: {
  formula: Formula;
  lang: "tr" | "en";
  labels: FormulaLabels;
  abbr?: string | null;
  size: "card" | "plate";
}) {
  const { a, b } = formula[lang];
  const stacked = formula.op === "divide";
  return (
    <span role="img" aria-label={formulaAria(formula, lang, labels)} className={styles.formula} data-size={size}>
      {abbr && (
        <span aria-hidden className={styles.formulaLhs}>
          {abbr}
          <span className={styles.formulaEq}>=</span>
        </span>
      )}
      {stacked ? (
        <span aria-hidden className={styles.fraction}>
          <span className={styles.fractionTerm}>{a}</span>
          <span className={styles.fractionBar} data-motion-draw="line" style={{ transformOrigin: "center" }} />
          <span className={styles.fractionTerm}>{b}</span>
        </span>
      ) : (
        <span aria-hidden className={styles.formulaInline}>
          <span className={styles.fractionTerm}>{a}</span>
          <span className={styles.formulaOp}>{OP_GLYPH[formula.op]}</span>
          <span className={styles.fractionTerm}>{b}</span>
        </span>
      )}
      {formula.percent && (
        <span aria-hidden className={styles.formulaPercent} title={labels.percent}>
          × 100
        </span>
      )}
    </span>
  );
}

/* ---- Kadran ----------------------------------------------------------------
   Yarım daire: 0 solda, 100 sağda. Dilim sınırları tanımdaki eşikler. */
const CX = 60;
const CY = 58;
const R = 44;
const FULL = 100;

function point(value: number, radius = R): [number, number] {
  const angle = Math.PI * (1 - value / FULL);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Dilimler arası boşluk (ölçek birimi) — dilimler birbirine yapışmasın. */
const GAP = 1.6;

export function TermDial({
  dial,
  labels,
  size,
  className,
}: {
  dial: Dial;
  labels: FormulaLabels;
  /** `md` kart karosu (yalnız şekil), `xs` ağ düğümü, `plate` kapak levhası (eşikler ve adlarıyla). */
  size: "xs" | "md" | "plate";
  className?: string;
}) {
  const cuts = DIAL_THRESHOLDS[dial.scale];
  const edges = [0, ...cuts, FULL];
  const names =
    dial.scale === "rsi" ? [labels.rsi.low, labels.rsi.mid, labels.rsi.high] : [labels.pmi.low, labels.pmi.high];
  const bands = edges.slice(0, -1).map((from, index) => {
    const to = edges[index + 1];
    const extreme = dial.scale === "rsi" && !dial.focus && index !== 1;
    const on =
      (dial.focus === "low" && index === 0) || (dial.focus === "high" && index === edges.length - 2);
    return { from, to, name: names[index], tone: on ? "on" : extreme ? "edge" : "base" };
  });
  const plate = size === "plate";
  const aria = labels.dialAria.replace("{cuts}", cuts.join(" / "));
  return (
    <span
      role={plate ? "img" : undefined}
      aria-label={plate ? aria : undefined}
      aria-hidden={plate ? undefined : true}
      className={`${styles.mark} ${styles.dial} ${className ?? ""}`}
      data-size={size}
    >
      <svg viewBox={plate ? "0 -2 120 66" : "8 8 104 58"} fill="none">
        {bands.map((band, index) => (
          <path
            key={band.from}
            d={arc(band.from + (index === 0 ? 0 : GAP / 2), band.to - (index === bands.length - 1 ? 0 : GAP / 2))}
            className={styles.dialBand}
            data-tone={band.tone}
            pathLength={1}
            data-motion-draw="arc"
            style={{ "--i": index } as CSSProperties}
          />
        ))}
        {plate && (
          <>
            {edges.map((value) => {
              const [x, y] = point(value, R + 12);
              return (
                <text key={value} x={x} y={y + 3} textAnchor="middle" className={styles.dialTick}>
                  {value}
                </text>
              );
            })}
          </>
        )}
        {cuts.map((cut) => {
          const [x1, y1] = point(cut, R - 7);
          const [x2, y2] = point(cut, R + 7);
          return <line key={cut} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.dialCut} />;
        })}
        {/* Göbek yalnız karoda: levhada eşik sayıları ölçeği zaten okutuyor,
            iğnesiz bir göbek orada boşta duran bir nokta gibiydi. */}
        {!plate && <circle cx={CX} cy={CY} r={4.5} className={styles.dialHub} />}
      </svg>
      {plate && (
        <span aria-hidden className={styles.dialLegend}>
          {bands.map((band) => (
            <span key={band.name} data-tone={band.tone}>
              <i />
              {band.name}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * Kapak levhası: formül varsa formül, kadran varsa kadran, yoksa verilen
 * kavram işareti. Terim sayfası ve günün terimi aynı kararı veriyor.
 */
export function TermPlateVisual({
  formula,
  lang,
  labels,
  term,
  fallback,
}: {
  formula: GlossaryFormula | undefined;
  lang: "tr" | "en";
  labels: FormulaLabels;
  term: string;
  fallback: ReactNode;
}) {
  if (formula?.kind === "dial") return <TermDial dial={formula} labels={labels} size="plate" />;
  if (formula?.kind === "formula")
    return <TermFormula formula={formula} lang={lang} labels={labels} abbr={splitTerm(term).abbr} size="plate" />;
  return <>{fallback}</>;
}
