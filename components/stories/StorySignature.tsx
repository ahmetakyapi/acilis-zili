import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Block } from "@/components/article/parse-blocks";
import { SIGNATURE_MAX_ITEMS, type SignatureBlock } from "@/lib/story-signature";
import { cn, directionOf, directionText, formatPercent, titleCaseLabel } from "@/lib/utils";
import styles from "./StorySignature.module.css";

/* ==========================================================================
   Arşiv kartının imza minyatürü (24 Ekim)

   Hangi bloğun seçildiği ve neden: `lib/story-signature.ts`. Burası yalnız
   çizim: SUNUCU BİLEŞENİ, istemci JS'i yok, görsel düz HTML + bir avuç
   satır içi genişlik. Liste 24-600 kart basıyor; her karta bir grafik
   kütüphanesi ya da hidratasyon bağlamak taramayı yavaşlatırdı.

   Yükseklik SABİT (`.sig`, 96 piksel): ızgara satırındaki kartların
   başlıkları aynı hatta başlasın. Akış dört, çubuk üç, rakam iki öğeye
   kadar; fazlası yazının içinde.

   Dil sitenin grafik diliyle aynı: ince kulvar (`--line-soft`) üstünde
   5 piksellik şerit, renk yalnız işaretten (yükseliş/düşüş), mavi yalnız
   akışın sıra işaretinde. Degrade yok — veri şeridi değil (CLAUDE.md).
   ========================================================================== */

export function StorySignature({
  block,
  locale,
  series,
}: {
  block: SignatureBlock;
  locale: string;
  /** `grafik` imzası için kapanış serisi; yoksa minyatür çizilmez. */
  series?: readonly number[] | null;
}) {
  const body = (() => {
    switch (block.kind) {
      case "flow":
        return <Flow block={block} />;
      case "shift":
        return <Shift block={block} locale={locale} />;
      case "bars":
        return <Bars block={block} />;
      case "stats":
        return <Stats block={block} locale={locale} />;
      case "chart":
        return series && series.length > 1 ? <Line series={series} /> : null;
    }
  })();
  if (!body) return null;
  const caption = block.kind === "chart" ? block.caption ?? block.symbol : block.label;

  return (
    /* `figure` + `figcaption`: kart bir bağlantı ve ekran okuyucu onu tek
       parça okuyor; minyatür künyesiyle birlikte o okumaya katılıyor. */
    <figure className={styles.sig} data-kind={block.kind}>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      {body}
    </figure>
  );
}

/* Akış — halkalar soldan sağa, aralarında ince kulvar. Numara mavi: sıra
   bilgisi etkileşim değil ama okuma yönü; yazıdaki akış bloğu da halkayı
   aynı mavi numarayla açıyor. */
function Flow({ block }: { block: Extract<Block, { kind: "flow" }> }) {
  const items = block.items.slice(0, SIGNATURE_MAX_ITEMS.flow);
  return (
    <ol className={styles.flow}>
      {items.map((item, index) => (
        <li key={index} className={styles.flowStep}>
          <span aria-hidden className={styles.flowRail}>
            <span className={cn("numeral", styles.flowNum)}>{index + 1}</span>
            {index < items.length - 1 && <span className={styles.flowLane} />}
          </span>
          <span className={styles.flowName}>{item.name}</span>
        </li>
      ))}
    </ol>
  );
}

/* Öncesi–sonrası — iki değer ve aradaki değişim. Rozet ancak ayrıştırıcı
   değişimi hesaplayabildiyse (aynı birim); yazıdaki blokla aynı kural. */
function Shift({ block, locale }: { block: Extract<Block, { kind: "shift" }>; locale: string }) {
  const tone = directionOf(block.deltaPct);
  return (
    <div className={styles.shift}>
      <div className={styles.shiftRow}>
        <span className={cn("numeral", styles.shiftValue)}>{block.from.display}</span>
        <ArrowRight aria-hidden weight="bold" size={14} className={styles.shiftArrow} />
        <span className={cn("numeral", styles.shiftValue, directionText(tone))}>{block.to.display}</span>
        {block.deltaPct !== null && (
          <span className={cn("numeral", styles.shiftDelta)} data-tone={tone}>
            {formatPercent(block.deltaPct, locale, 1)}
          </span>
        )}
      </div>
      {(block.from.label || block.to.label) && (
        <p className={styles.shiftLabels}>
          {block.from.label}
          {block.from.label && block.to.label && <span aria-hidden> · </span>}
          {block.to.label}
        </p>
      )}
    </div>
  );
}

/* Çubuk — ad ve değer üstte, 5 piksellik şerit kulvarda. Ölçek grubun en
   büyüğü; yalnız GÖSTERİLEN satırlardan, yazıdakiyle aynı kural. Nötr
   kipte (`::: bar notr`) renk yön söylemez, yazıdaki gibi. */
function Bars({ block }: { block: Extract<Block, { kind: "bars" }> }) {
  const items = block.items.slice(0, SIGNATURE_MAX_ITEMS.bars);
  const peak = Math.max(...items.map((item) => Math.abs(item.value)), 0.01);
  return (
    <ul className={styles.bars}>
      {items.map((item, index) => (
        <li key={index} className={styles.barRow}>
          <span className={styles.barName}>{item.name}</span>
          <span className={cn("numeral", styles.barValue, block.neutral ? "text-strong" : directionText(directionOf(item.value)))}>
            {item.display}
          </span>
          <span aria-hidden className={styles.barLane}>
            <span
              className={styles.barFill}
              data-tone={block.neutral ? "flat" : directionOf(item.value)}
              style={{ width: `${(Math.abs(item.value) / peak) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* Rakam şeridi — iki rakam ve künyeleri; rakam kartın en iri metni değil
   (başlık o), bir kademe altında. */
function Stats({ block, locale }: { block: Extract<Block, { kind: "stats" }>; locale: string }) {
  const items = block.items.slice(0, SIGNATURE_MAX_ITEMS.stats);
  return (
    <dl className={styles.stats} data-count={items.length}>
      {/* Künye `dt`, rakam `dd`: ekran okuyucu "Toplam Tutar, 4,2 Mr $"
          diye okuyor; gözde rakam üstte (`column-reverse`). */}
      {items.map((item, index) => (
        <div key={index} className={styles.stat}>
          <dt className={styles.statNote}>{titleCaseLabel(item.note, locale)}</dt>
          <dd className={cn("numeral", styles.statValue)}>{titleCaseLabel(item.value, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}

/* Grafik — kapanış serisi tek ince çizgi; renk dönemin işaretinden. */
function Line({ series }: { series: readonly number[] }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const width = 100;
  const height = 40;
  const points = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const tone = directionOf(series[series.length - 1] - series[0]);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={styles.line}
      data-tone={tone}
    >
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
