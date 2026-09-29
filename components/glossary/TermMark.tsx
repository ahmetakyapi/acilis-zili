import type { ReactNode } from "react";
import type { GlossaryMotif } from "@/content/glossary/marks";
import styles from "./Glossary.module.css";

/* ==========================================================================
   Terimin kavram işareti — dizin kartları, günün terimi, terim kapağı,
   ilişki ağı ve komşu bağlantıları aynı çizimi okuyor.

   HOOK YOK, "use client" YOK: sunucu sayfasında HTML olarak basılıyor,
   istemci dizini de aynı modülü içe alıyor. Çizim tuval 64×40 birim.

   HAREKET ORTAK KALIPTAN. `draw` verilince ana çizgi `pathLength=1` ve
   `data-motion-draw="arc"` taşıyor: `MotionExperience` onu görünüme
   girince uçtan uca çiziyor, ilk ekranda kıpırdatmıyor, hareketi azaltan
   okuyucuda hiç hazırlamıyor. JavaScript yoksa kesik (1) çizginin
   tamamını kapsadığı için çizim tam duruyor.

   RENK YALNIZCA MARKANIN MAVİSİ. Artı/eksi yönü olan şekillerde bile
   (ayı piyasası, aşağı eğimli eğri) yeşil ve kırmızı kullanılmıyor: yön
   rengi bu sitede bir fiyat hareketi demek, bir kavramın şekli değil.
   ========================================================================== */

type Draw = { draw: boolean };

/** Ana çizgi — çizilerek gelen. */
function Ink({ d, draw, width }: Draw & { d: string; width?: number }) {
  return (
    <path
      d={d}
      className={styles.mkInk}
      strokeWidth={width}
      pathLength={draw ? 1 : undefined}
      data-motion-draw={draw ? "arc" : undefined}
    />
  );
}

/** İkincil çizgi — eksen, bant, iz. */
function Soft({ d, width }: { d: string; width?: number }) {
  return <path d={d} className={styles.mkSoft} strokeWidth={width} />;
}

type Box = [x: number, y: number, w: number, h: number];

function Blocks({ boxes, tone }: { boxes: Box[]; tone: "wash" | "solid" | "mid" }) {
  const cls = tone === "solid" ? styles.mkSolid : tone === "mid" ? styles.mkMid : styles.mkWash;
  return (
    <>
      {boxes.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={2} className={cls} />
      ))}
    </>
  );
}

function Dot({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} className={styles.mkSolid} />;
}

const MOTIFS: Record<GlossaryMotif, (props: Draw) => ReactNode> = {
  /* Pay bölü payda. */
  ratio: ({ draw }) => (
    <>
      <Blocks boxes={[[22, 5, 20, 9]]} tone="solid" />
      <Ink d="M12 20 H52" draw={draw} />
      <Blocks boxes={[[15, 26, 34, 9]]} tone="wash" />
    </>
  ),
  /* Bütünün dilimi: halka ve payı. */
  /* PASTA, HALKA DEĞİL (29 Eylül, sahibinin notu: "loading gibi duruyor").
     İlk çizim boşluklu bir halkaydı ve dizinde yedi kartta bir yükleme
     simgesi gibi okunuyordu. Şimdi dolu bir pasta, payı dışarı çekilmiş
     dilim: bütünün bir payı olduğu şekilden okunuyor, dönen bir şey gibi
     değil. */
  margin: ({ draw }) => (
    <>
      <path d="M30 21 L30 5 A16 16 0 1 0 43.86 29 Z" className={styles.mkWash} />
      <path d="M32.6 19.5 L32.6 3.5 A16 16 0 0 1 46.46 27.5 Z" className={styles.mkSolid} />
      <Ink d="M32.6 3.5 A16 16 0 0 1 46.46 27.5" draw={draw} width={2} />
    </>
  ),
  /* Bir tabandan (varlıklar, özsermaye) çıkan kazanç: taban bloğu ve
     ondan yükselen ok. ROA ve ROE bir marj değil, bir GETİRİ. */
  returnOn: ({ draw }) => (
    <>
      <Soft d="M5 36.5 H59" width={1.4} />
      <Blocks boxes={[[7, 19, 25, 16]]} tone="wash" />
      <Blocks boxes={[[12, 24, 15, 11]]} tone="solid" />
      <Ink d="M19.5 18 C21 10 33 7 51 7" draw={draw} />
      <Ink d="M45 2.5 L51.5 7 L45.5 12" draw={draw} />
    </>
  ),
  /* Bir büyüklükten kalemler düşülerek varılan sonuç. */
  waterfall: ({ draw }) => (
    <>
      <Blocks boxes={[[7, 7, 9, 27]]} tone="solid" />
      <Blocks boxes={[[20, 7, 9, 10], [33, 17, 9, 7]]} tone="wash" />
      <Blocks boxes={[[46, 24, 9, 10]]} tone="mid" />
      <Soft d="M4 34.5 H60" />
      <Ink d="M16 7 H20 M29 17 H33 M42 24 H46" draw={draw} width={1.4} />
    </>
  ),
  /* Büyüyen seri. */
  bars: ({ draw }) => (
    <>
      <Blocks boxes={[[9, 24, 8, 10], [21, 19, 8, 15], [33, 13, 8, 21]]} tone="wash" />
      <Blocks boxes={[[45, 6, 8, 28]]} tone="solid" />
      <Soft d="M5 34.5 H59" />
      <Ink d="M9 21 L21 16 L33 10 L49 3" draw={draw} width={1.4} />
    </>
  ),
  /* Gelecekteki nakdin bugüne indirilmesi: uzaklaştıkça küçülen çubuklar. */
  discount: ({ draw }) => (
    <>
      <Blocks boxes={[[8, 12, 9, 22]]} tone="solid" />
      <Blocks boxes={[[21, 17, 9, 17]]} tone="mid" />
      <Blocks boxes={[[34, 22, 9, 12], [47, 26, 9, 8]]} tone="wash" />
      <Soft d="M4 34.5 H60" />
      <Ink d="M51 20 C 44 4, 22 2, 14 8 M14 8 L18 3 M14 8 L20 10" draw={draw} width={1.6} />
    </>
  ),
  /* Bir parça dörde bölünüyor. */
  split: ({ draw }) => (
    <>
      <Blocks boxes={[[6, 10, 20, 20]]} tone="solid" />
      <Ink d="M30 20 H37 M34 16.5 L37.5 20 L34 23.5" draw={draw} width={1.6} />
      <Blocks boxes={[[41, 10, 9, 9], [52, 10, 9, 9], [41, 21, 9, 9], [52, 21, 9, 9]]} tone="wash" />
    </>
  ),
  /* Üst üste konan paralar ve dağıtılan pay. */
  stack: ({ draw }) => (
    <>
      <Blocks boxes={[[8, 28, 28, 6], [8, 21, 28, 6], [8, 14, 28, 6]]} tone="wash" />
      <Blocks boxes={[[8, 7, 28, 6]]} tone="solid" />
      <Blocks boxes={[[42, 28, 16, 6], [42, 21, 16, 6]]} tone="mid" />
      <Soft d="M4 35.5 H60" />
      <Ink d="M50 17 V4 M46.5 7.5 L50 4 L53.5 7.5" draw={draw} width={1.8} />
    </>
  ),
  /* İki kefe: borç ile özsermaye, varlık ile yükümlülük. */
  balance: ({ draw }) => (
    <>
      <Soft d="M32 12 V35 M24 35 H40" width={2} />
      <Ink d="M10 17 L54 9" draw={draw} />
      <Blocks boxes={[[5, 17, 12, 8]]} tone="wash" />
      <Blocks boxes={[[46, 9, 14, 12]]} tone="solid" />
      <Dot x={32} y={13} r={2.2} />
    </>
  ),
  /* Emir defteri: ortadaki farkın iki yanında alış ve satış basamakları. */
  book: ({ draw }) => (
    <>
      <Blocks boxes={[[14, 6, 15, 5], [8, 13, 21, 5], [18, 20, 11, 5], [4, 27, 25, 5]]} tone="wash" />
      <Blocks boxes={[[35, 6, 11, 5], [35, 13, 19, 5], [35, 20, 25, 5], [35, 27, 15, 5]]} tone="mid" />
      <Ink d="M32 3 V35" draw={draw} width={1.4} />
    </>
  ),
  /* Günün ya da dönemin içindeki bir pencere. */
  timeline: ({ draw }) => (
    <>
      <Soft d="M5 20 H59 M5 15 V25 M59 15 V25" width={2} />
      <Blocks boxes={[[22, 11, 20, 18]]} tone="wash" />
      <Ink d="M22 20 H42" draw={draw} width={4} />
      <Dot x={42} y={20} r={3.2} />
    </>
  ),
  /* Takvimde işaretli gün. */
  calendar: ({ draw }) => (
    <>
      <rect x={13} y={5} width={38} height={31} rx={5} className={styles.mkFrame} />
      <Soft d="M22 2.5 V8 M42 2.5 V8" width={2} />
      <Ink d="M13 13 H51" draw={draw} width={2} />
      {[20, 29, 38].map((y) =>
        [20, 28, 36, 44].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} className={styles.mkPip} />),
      )}
      <rect x={31.5} y={25} width={9} height={8} rx={2} className={styles.mkSolid} />
    </>
  ),
  /* Resmî belge ve mührü. */
  document: ({ draw }) => (
    <>
      <path d="M17 3 H38 L47 12 V37 H17 Z" className={styles.mkFrame} />
      <Soft d="M38 3 V12 H47" width={1.6} />
      <Ink d="M22 16 H41 M22 22 H38 M22 28 H31" draw={draw} width={2} />
      <circle cx={44} cy={31} r={6} className={styles.mkSolid} />
    </>
  ),
  /* Beklentinin merkezi ve çevresindeki tahminler. */
  target: ({ draw }) => (
    <>
      {/* Halkalar çizgi değil dolu: çevresine serpilmiş beş
          noktayla birlikte karoda ayırt edilemeyen bir leke gibiydi. */}
      <circle cx={30} cy={21} r={15} className={styles.mkWash} />
      <circle cx={30} cy={21} r={9} className={styles.mkMidFill} />
      <Dot x={30} y={21} r={3.6} />
      <Ink d="M52 4 L32.5 19" draw={draw} width={2.2} />
      <Ink d="M46 3.5 L52.5 3.5 L52.5 10" draw={draw} width={2} />
    </>
  ),
  /* Tutardan kesilen pay. */
  tax: ({ draw }) => (
    <>
      <path d="M16 3 H48 V36 L44 33 L40 36 L36 33 L32 36 L28 33 L24 36 L20 33 L16 36 Z" className={styles.mkFrame} />
      <Ink d="M26 26 L38 11" draw={draw} width={2} />
      <circle cx={26.5} cy={13} r={3} className={styles.mkSolid} />
      <circle cx={37.5} cy={24} r={3} className={styles.mkSolid} />
    </>
  ),
  trendUp: ({ draw }) => (
    <>
      <path d="M6 32 L18 26 L28 29 L40 17 L50 20 L58 8 V36 H6 Z" className={styles.mkArea} />
      <Ink d="M6 32 L18 26 L28 29 L40 17 L50 20 L58 8" draw={draw} />
      <Dot x={58} y={8} />
    </>
  ),
  trendDown: ({ draw }) => (
    <>
      <path d="M6 8 L18 14 L28 11 L40 23 L50 20 L58 32 V36 H6 Z" className={styles.mkArea} />
      <Ink d="M6 8 L18 14 L28 11 L40 23 L50 20 L58 32" draw={draw} />
      <Dot x={58} y={32} />
    </>
  ),
  /* Ağırlıklı sepet: büyüğü büyük kare. */
  grid: ({ draw }) => (
    <>
      <Blocks boxes={[[6, 4, 24, 18]]} tone="solid" />
      <Blocks boxes={[[32, 4, 13, 18], [6, 24, 15, 12]]} tone="mid" />
      <Blocks boxes={[[47, 4, 11, 8], [47, 14, 11, 8], [23, 24, 22, 12], [47, 24, 11, 12]]} tone="wash" />
      <Ink d="M6 38.5 H58" draw={draw} width={1.2} />
    </>
  ),
  /* Oynaklık göstergesi: kadran ve ibre. */
  gauge: ({ draw }) => (
    <>
      <path d="M9 33 A23 23 0 0 1 55 33" className={styles.mkTrackArc} />
      <Ink d="M9 33 A23 23 0 0 1 43.5 13" draw={draw} width={4.5} />
      <Soft d="M32 33 L44 19" width={2.2} />
      <Dot x={32} y={33} r={3} />
    </>
  ),
  curveUp: ({ draw }) => (
    <>
      <Soft d="M8 4 V35 H59" />
      <Ink d="M11 31 C 22 16, 34 11, 57 8" draw={draw} />
      {[[11, 31], [23, 18.5], [37, 12.3], [57, 8]].map(([x, y]) => <Dot key={x} x={x} y={y} r={2.2} />)}
    </>
  ),
  curveDown: ({ draw }) => (
    <>
      <Soft d="M8 4 V35 H59" />
      <Ink d="M11 9 C 22 22, 34 27, 57 30" draw={draw} />
      {[[11, 9], [23, 20.3], [37, 25.9], [57, 30]].map(([x, y]) => <Dot key={x} x={x} y={y} r={2.2} />)}
    </>
  ),
  /* Politika faizinin basamakları. */
  steps: ({ draw }) => (
    <>
      <path d="M6 30 H18 V24 H30 V16 H42 V12 H58 V36 H6 Z" className={styles.mkArea} />
      <Ink d="M6 30 H18 V24 H30 V16 H42 V12 H58" draw={draw} />
      <Dot x={42} y={12} />
    </>
  ),
  /* Tahminlerin dağılımı ve ortası. */
  dots: ({ draw }) => (
    <>
      {[[14, 26], [14, 20], [26, 22], [26, 16], [26, 28], [38, 14], [38, 20], [50, 10], [50, 18]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} className={styles.mkMidFill} />
      ))}
      <Soft d="M5 34.5 H59" />
      <Ink d="M8 24 L20 20 L32 20 L44 17 L56 14" draw={draw} width={1.6} />
    </>
  ),
  /* Önceki döneme göre değişim: sıfır çizgisinin iki yanı. */
  delta: ({ draw }) => (
    <>
      <Blocks boxes={[[8, 12, 7, 8], [18, 8, 7, 12], [38, 14, 7, 6], [48, 6, 7, 14]]} tone="mid" />
      <Blocks boxes={[[28, 20, 7, 8]]} tone="wash" />
      <Ink d="M4 20 H60" draw={draw} width={1.6} />
    </>
  ),
  /* İki eşik bandı arasında salınan gösterge. */
  oscillator: ({ draw }) => (
    <>
      <rect x={4} y={4} width={56} height={9} rx={2} className={styles.mkWash} />
      <rect x={4} y={27} width={56} height={9} rx={2} className={styles.mkWash} />
      <Ink d="M5 22 C 12 6, 19 4, 25 17 S 38 40, 46 27 S 55 10, 59 12" draw={draw} />
    </>
  ),
  /* İki ortalamanın kesişmesi. */
  cross: ({ draw }) => (
    <>
      <Soft d="M5 30 C 20 28, 34 20, 59 10" width={2.4} />
      <Ink d="M5 13 C 20 15, 30 24, 59 21" draw={draw} />
      <circle cx={31.5} cy={21.4} r={4} className={styles.mkHalo} />
    </>
  ),
  /* Fiyatın iki sınır arasında gidip gelmesi. */
  channel: ({ draw }) => (
    <>
      <Soft d="M5 9 H59 M5 31 H59" width={2} />
      <Ink d="M6 26 L15 11 L24 28 L34 12 L43 29 L52 13 L58 20" draw={draw} width={2} />
    </>
  ),
  candles: ({ draw }) => (
    <>
      <Soft d="M13 6 V32 M26 10 V34 M39 4 V26 M52 8 V30" width={1.6} />
      <Blocks boxes={[[9, 12, 8, 14], [35, 8, 8, 12]]} tone="solid" />
      <Blocks boxes={[[22, 16, 8, 12], [48, 13, 8, 12]]} tone="wash" />
      <Ink d="M4 37.5 H60" draw={draw} width={1.2} />
    </>
  ),
  /* Opsiyonun vadedeki kâr/zarar şekli: kullanım fiyatında kırılan çizgi. */
  payoffCall: ({ draw }) => (
    <>
      <Soft d="M5 28 H59" />
      <Ink d="M5 28 H31 L57 5" draw={draw} />
      <Dot x={31} y={28} r={3} />
    </>
  ),
  payoffPut: ({ draw }) => (
    <>
      <Soft d="M5 28 H59" />
      <Ink d="M7 5 L33 28 H59" draw={draw} />
      <Dot x={33} y={28} r={3} />
    </>
  ),
  payoffV: ({ draw }) => (
    <>
      <Soft d="M5 22 H59" />
      <Ink d="M8 4 L32 32 L56 4" draw={draw} />
      <Dot x={32} y={32} r={3} />
    </>
  ),
};

export function TermMark({
  motif,
  size = "md",
  draw = false,
  className,
}: {
  motif: GlossaryMotif;
  /** xs 32 · sm 40 · md 52 · lg 72 piksel karo; `plate` kabın genişliğini alan levha. */
  size?: "xs" | "sm" | "md" | "lg" | "plate";
  /** Görünüme girince çizilsin mi — yalnızca kartlarda ve kapakta. */
  draw?: boolean;
  className?: string;
}) {
  const Motif = MOTIFS[motif];
  return (
    <span aria-hidden className={`${styles.mark} ${className ?? ""}`} data-size={size}>
      <svg viewBox="0 0 64 40" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Motif draw={draw} />
      </svg>
    </span>
  );
}
