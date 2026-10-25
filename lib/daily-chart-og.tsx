import { C, OgFrame, OgTitle, clip } from "@/lib/og";
import type { DailyChartBlock } from "@/lib/daily-chart";
import { barSpan, divergingScale, type DivergingScale } from "@/lib/daily-chart-figure";

/* ==========================================================================
   Günün Grafiği paylaşım görseli (24 Ekim) — `lib/og.tsx` çerçevesiyle.

   GÖRSEL GRAFİĞİN KENDİSİ: başlık + tarih + sayfadaki blokla AYNI veri
   (aynı ayrıştırma, aynı ölçek kuralı: grubun en büyüğü). Satori CSS
   değişkeni okumuyor; renkler `lib/og.tsx` → `C` (açık tema). Eksi işareti
   U+2212 gömülü fontta yok (`/gun/[tarih]/kart` notu) — ASCII tireye iner.
   ========================================================================== */

export const DAILY_CHART_OG_SIZES = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
} as const;

export type DailyChartOgSize = keyof typeof DAILY_CHART_OG_SIZES;

/** Görselde en çok kaç çubuk — yatayda yer dar, dikeyde blok tavanı. */
const MAX_ROWS: Record<DailyChartOgSize, number> = { landscape: 6, portrait: 12 };

/** Pay dilimleri — sitedeki `--share-*` basamaklarının açık tema karşılığı. */
const SHARE_SWATCH = [C.primaryDeep, C.primary, C.primarySoft, C.primaryFaint];

const ascii = (text: string) => text.replace(/−/g, "-");

/** `ink`: değerin rengi; yoksa çubuğunki. Nötr çubuğun sayısı mavi basılmaz (renk anlam taşır). */
type Row = { name: string; value: number; display: string; color: string; ink?: string };

/**
 * Satırlar sığmıyorsa ORTADAN kesilir: baştaki ve sondaki uçlar kalır.
 * Blok çoğunlukla büyükten küçüğe sıralı ve hikâye uçlarda (en çok
 * yükselen, en çok düşen); ilk altıyı almak 23 Ekim önizlemesinde en büyük
 * düşüşü (−2,05) görselden siliyordu. Kesilen yerde üç nokta çizilir.
 */
function headAndTail<T>(items: readonly T[], max: number): { head: T[]; tail: T[] } {
  if (items.length <= max) return { head: [...items], tail: [] };
  const headCount = Math.ceil(max / 2);
  return { head: items.slice(0, headCount), tail: items.slice(items.length - (max - headCount)) };
}

/** Çubuğun kalınlığı (25 Ekim, görsel tur): akışta küçük görünen kartta
 *  10/14 piksel ince kalıyordu; paylaşım görseli bir bakışta okunmalı.
 *  Dikeyde satır aralığı 22'den 14'e indi ki on iki satır yine sığsın:
 *  24 piksellik çubuk ve 22 aralıkla 11 satırlık 23 Ekim kartı alttan
 *  taşıyordu (ölçüldü); 22 + 14 ile eski toplam yükseklikte (~822 piksel). */
const BAR_HEIGHT: Record<DailyChartOgSize, number> = { landscape: 18, portrait: 22 };
const ROW_GAP: Record<DailyChartOgSize, number> = { landscape: 12, portrait: 10 };

/**
 * Dikeyde açıklamanın ilk cümlesi en çok bu kadar satırlı grafikte sığıyor.
 * Ölçüldü (25 Ekim, 23 Ekim kartı): on bir satırda cümle kartın dışına
 * taşıyor ve kesik görünüyordu (canlıdaki eski kartta da). Kalabalık
 * grafikte cümle basılmıyor; grafik ve etiket tam görünüyor.
 */
const PORTRAIT_LEAD_MAX_ROWS = 8;

function rowCount(block: DailyChartBlock): number {
  return block.kind === "shift" ? 2 : block.items.length;
}

/**
 * `scale` verilirse çubuk SIFIRDAN İKİ YÖNE, sayfadaki çizimle aynı ölçekte
 * (`divergingScale`, lib/daily-chart-figure.ts): eksiler sıfırın solunda,
 * artılar sağında, sıfır çizgisi koyu. Verilmezse soldan, `peak`e göre
 * (`oncesi` ve nötr blok — onlarda sıfırın iki yanı yok).
 */
function RowList({ rows, peak, size, scale }: { rows: Row[]; peak: number; size: DailyChartOgSize; scale?: DivergingScale }) {
  const big = size === "portrait";
  const { head, tail } = headAndTail(rows, MAX_ROWS[size]);
  const font = big ? 28 : 22;
  const height = BAR_HEIGHT[size];
  const line = (row: Row, key: string) => (
    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: font, lineHeight: 1.2 }}>
        <span style={{ display: "flex", color: C.strong }}>{clip(row.name, big ? 40 : 30)}</span>
        <span style={{ display: "flex", color: row.ink ?? row.color, fontWeight: 700 }}>{ascii(row.display)}</span>
      </div>
      {scale ? (
        <div style={{ display: "flex", position: "relative", height, borderRadius: 99, background: C.lineSoft }}>
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: `${barSpan(row.value, scale).start}%`,
              width: `${Math.max(barSpan(row.value, scale).size, 0.5)}%`,
              height: "100%",
              borderRadius: 99,
              background: row.color,
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: -5,
              left: `${scale.zero}%`,
              width: 3,
              height: height + 10,
              marginLeft: -1.5,
              borderRadius: 2,
              background: C.strong,
            }}
          />
        </div>
      ) : (
        <div style={{ display: "flex", height, borderRadius: 99, background: C.lineSoft }}>
          <div
            style={{
              display: "flex",
              width: `${Math.max((Math.abs(row.value) / peak) * 100, 1)}%`,
              height: "100%",
              borderRadius: 99,
              background: row.color,
            }}
          />
        </div>
      )}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP[size], width: "100%" }}>
      {head.map((row, i) => line(row, `h${i}`))}
      {tail.length > 0 && (
        <div style={{ display: "flex", gap: 6, paddingLeft: 2 }}>
          {[0, 1, 2].map((dot) => (
            <div key={dot} style={{ display: "flex", width: 6, height: 6, borderRadius: 99, background: C.muted }} />
          ))}
        </div>
      )}
      {tail.map((row, i) => line(row, `t${i}`))}
    </div>
  );
}

function Bars({ block, size }: { block: Extract<DailyChartBlock, { kind: "bars" }>; size: DailyChartOgSize }) {
  const peak = Math.max(...block.items.map((item) => Math.abs(item.value)), 0.01);
  /* `::: bar notr`: büyüklük, yön değil — `oncesi`nin nötr tonu. */
  const rows = block.items.map((item) => ({
    ...item,
    color: block.neutral ? C.primary : item.value < 0 ? C.down : C.up,
  }));
  return (
    <RowList
      rows={rows}
      peak={peak}
      size={size}
      scale={block.neutral || block.unscaled ? undefined : divergingScale(block.items.map((item) => item.value))}
    />
  );
}

function Share({ block, size }: { block: Extract<DailyChartBlock, { kind: "share" }>; size: DailyChartOgSize }) {
  const big = size === "portrait";
  const total = block.items.reduce((sum, item) => sum + item.value, 0) || 1;
  const swatch = (index: number) => SHARE_SWATCH[index] ?? C.line;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: big ? 24 : 14, width: "100%" }}>
      <div style={{ display: "flex", gap: 3, height: big ? 26 : 18, borderRadius: 99, overflow: "hidden" }}>
        {block.items.map((item, index) => (
          <div key={index} style={{ display: "flex", width: `${(item.value / total) * 100}%`, height: "100%", background: swatch(index) }} />
        ))}
      </div>
      {block.items.map((item, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: big ? 28 : 22 }}>
          <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: swatch(index) }} />
          <span style={{ display: "flex", flex: 1, color: C.strong }}>{clip(item.name, big ? 40 : 30)}</span>
          <span style={{ display: "flex", fontWeight: 700, color: C.strong }}>{ascii(item.display)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Öncesi–sonrası: iki çubuk, aynı ölçekte (büyüğe göre). Satori'de iki
 * dev rakamı yan yana dizmek etiketleri rakamın üstüne bindiriyordu
 * (önizlemede ölçüldü); çubuk dili hem sağlam hem sayfadaki grafikle akraba.
 * Önceki hâl nötr, sonraki yönüne göre renkli.
 */
function Shift({ block, size }: { block: Extract<DailyChartBlock, { kind: "shift" }>; size: DailyChartOgSize }) {
  const from = block.from.value ?? 0;
  const to = block.to.value ?? 0;
  const tone = block.deltaPct === null || block.deltaPct === 0 ? C.primary : block.deltaPct > 0 ? C.up : C.down;
  const peak = Math.max(Math.abs(from), Math.abs(to), 0.01);
  const rows: Row[] = [
    { name: block.from.label || " ", value: from, display: block.from.display, color: C.primarySoft, ink: C.strong },
    { name: block.to.label || " ", value: to, display: block.to.display, color: tone },
  ];
  return <RowList rows={rows} peak={peak} size={size} />;
}

function Figure({ block, size }: { block: DailyChartBlock; size: DailyChartOgSize }) {
  if (block.kind === "bars") return <Bars block={block} size={size} />;
  if (block.kind === "share") return <Share block={block} size={size} />;
  return <Shift block={block} size={size} />;
}

export function DailyChartOgCard({
  block,
  title,
  dateLine,
  lead,
  eyebrow,
  size,
}: {
  block: DailyChartBlock;
  title: string;
  dateLine: string;
  /** Açıklamanın ilk cümlesi — yalnız dikeyde yer var. */
  lead: string;
  eyebrow: string;
  size: DailyChartOgSize;
}) {
  const portrait = size === "portrait";
  const head = (
    <div style={{ display: "flex", flexDirection: "column", gap: portrait ? 14 : 10 }}>
      <OgTitle size={portrait ? (title.length > 60 ? 54 : 62) : title.length > 70 ? 36 : title.length > 44 ? 42 : 48}>
        {clip(title, portrait ? 110 : 90)}
      </OgTitle>
      <div style={{ display: "flex", fontSize: portrait ? 28 : 22, fontWeight: 700, color: C.primary }}>{dateLine}</div>
      {!portrait && block.label && (
        <div style={{ display: "flex", fontSize: 20, color: C.muted }}>{clip(block.label, 50)}</div>
      )}
    </div>
  );

  if (portrait) {
    return (
      <OgFrame eyebrow={eyebrow}>
        {head}
        <div style={{ display: "flex", marginTop: 30 }}>
          <Figure block={block} size={size} />
        </div>
        {block.label && (
          <div style={{ display: "flex", fontSize: 22, color: C.muted, marginTop: 6 }}>{clip(block.label, 60)}</div>
        )}
        {rowCount(block) <= PORTRAIT_LEAD_MAX_ROWS && (
          <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: C.body, marginTop: 20 }}>{clip(lead, 220)}</div>
        )}
      </OgFrame>
    );
  }

  return (
    <OgFrame eyebrow={eyebrow}>
      <div style={{ display: "flex", gap: 44, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 440 }}>{head}</div>
        <div style={{ display: "flex", flex: 1 }}>
          <Figure block={block} size={size} />
        </div>
      </div>
    </OgFrame>
  );
}
