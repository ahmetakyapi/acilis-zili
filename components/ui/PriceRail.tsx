import styles from "./PriceRail.module.css";

/**
 * FİYAT RAYI — fiyat konumlarının TEK çizimi (23 Eylül).
 *
 * NEDEN VAR: üç ekran fiyatları bir çizgi üzerinde kendi yöntemiyle
 * çiziyordu ve üçü de ayrı bir kusur taşıyordu:
 *   · Teknik kartında risk şeridi ile seviye çizgisi alt alta aynı
 *     geometriyi iki kez basıyordu (1440'ta plan satırının 212 pikselinden
 *     112'si). Teknik `PlanRail`i kendi çözümü olarak koruyor; bu bileşen
 *     aynı görsel dili (LevelTrack'in ölçüleri) öteki ekranlara taşıyor.
 *   · Hisse sayfasında hareketli ortalamalar ±en büyük sapma üzerine
 *     SİMETRİK bir eksende çiziliyordu: NVDA'nın üç ortalaması da artıdaydı
 *     (+6,46 / +7,97 / +15,16) ve her çizginin sol yarısı daima boştu;
 *     52 haftalık bant başka bir kartta, başka bir ölçekteydi.
 *   · Bilanço kapağında canlı fiyat, bilanço günü kapanışı ve hedef üç ayrı
 *     yerde, dayanakları adsız duruyordu.
 * Ray bu üçünü tek eksende gösteriyor: ölçek SIFIRDAN değil değerlerin
 * kendisinden (en küçük ile en büyük arası, iki yanda `pad` kadar pay).
 *
 * Çizim yalnızca görsel (`aria-hidden`): gösterdiği her sayı yanında metin
 * olarak da durmak ZORUNDA. Bu yüzden etiket sığmazsa basılmaz — üst üste
 * binmiş iki etiket hiç etiket olmamasından kötü, sayı zaten metinde.
 *
 * ETİKET YERLEŞİMİ SUNUCUDA, ÜÇ GENİŞLİK İÇİN. Etiketler rayın üstünde ve
 * altında birer satıra diziliyor. Rayın gerçek genişliği sunucuda bilinmiyor;
 * yerleşim üç varsayımla hesaplanıyor — 240 piksel (telefondaki kartın alt
 * sınırı), 340 ve 480 — ve `@container` hangisinin geçerli olduğunu
 * seçiyor. Her etiket için: tercih edilen satır, sığmazsa öteki
 * satır, o da sığmazsa yalnızca sayı, o da sığmazsa hiç. Genişlik karakter
 * sayısından tahmin ediliyor (11 pikselde karakter başına 6,5 piksel,
 * Schibsted Grotesk rakamları 6,2-6,4) — tahmin cömert, yani dar düzen
 * gereğinden erken satır değiştirir ama hiçbir zaman çakıştırmaz.
 *
 * HAREKET ortak sistemden (`MotionExperience`): bant ve bacaklar bir
 * `data-motion-stagger` kabında `data-motion-draw="line"` ile sırayla
 * çiziliyor (verilen sırayla: risk bacağı önce), nokta `spark-dot` ile
 * oturuyor. `travel` işareti varsa canlı nokta hayalet noktadan kalkıp
 * yerine kayıyor (`data-motion-draw="travel"`, `data-delta` yüzde puan).
 * Azaltılmış harekette ve JavaScript'siz son hâl doğrudan basılır.
 */

export type RailBandTone = "entry" | "range" | "up" | "down";
export type RailTone = "up" | "down" | "flat" | "primary";
export type RailLabel = {
  /** Kısa ad — "Hedef", "Bugün", "50G". Dar rayda ilk düşen parça. */
  label?: string;
  /** Sayı — "279,22 $". Etiketin asıl taşıdığı şey. */
  value?: string;
  /** Tercih edilen satır; sığmazsa öteki satıra geçer. */
  side?: "above" | "below";
};

export type RailMark =
  /** Aralık: alım bölgesi (`entry`), 52 hafta (`range`) ya da yönlü yıkama. */
  | { kind: "band"; from: number; to: number; tone?: RailBandTone }
  /** Eksen üstünde kalın bacak; `from` ölçümün başladığı uç (çapa). */
  | { kind: "segment"; from: number; to: number; tone: RailTone }
  /** Eksenin başından `to`ya kadar taralı alan — planın geçersiz olduğu bölge. */
  | { kind: "void"; to: number }
  /** Seviye çentiği. */
  | ({ kind: "tick"; at: number; tone?: RailTone; minor?: boolean } & RailLabel)
  /** Nokta: `live` şimdiki fiyat, `ghost` geçmiş bir an, `target` hedef. */
  | ({ kind: "point"; at: number; variant: "live" | "ghost" | "target" } & RailLabel)
  /** İki fiyat arasında alınan yol — eksen üstünde noktalı çizgi. */
  | { kind: "travel"; from: number; to: number };

type Row = "above" | "below" | "none";
type Anchor = "start" | "center" | "end";
type Placement = { row: Row; anchor: Anchor; name: boolean };

/* Yerleşimin varsaydığı üç ray genişliği. Her biri, rayın O KADAR ya da
   daha geniş olduğu her durumda geçerli; CSS'teki `@container` eşikleri
   (340, 480) ikinci ve üçüncüyü seçiyor. Ortadaki 390 piksellik telefonun
   kartı için var: orada ray 316-350 piksel ve 240 varsayımıyla etiketler
   gereğinden erken düşüyordu. */
const LAYOUTS = [
  { key: "n", px: 240 },
  { key: "m", px: 340 },
  { key: "w", px: 480 },
] as const;
/** Etiketin karakter başına tahmini genişliği (cömert): 11 ve 12 piksel. */
const CHAR_PX = { sm: 6.5, md: 7.1 } as const;
/** Aynı satırdaki iki etiket arasında en az bu kadar boşluk. */
const LABEL_GAP_PX = 8;
/** Değerler aynıysa (tek noktalık aralık) eksen değerin ±%2'si kadar açılır. */
const FLAT_DOMAIN_SHARE = 0.02;

function labelChars(mark: RailLabel, withName: boolean): number {
  const name = withName && mark.label ? mark.label.length + 1 : 0;
  return name + (mark.value?.length ?? 0);
}

/* YER KAPMA SIRASI: önce canlı fiyat, sonra hedef ve geçmiş an, sonra
   seviyeler, en son ikincil seviyeler. Soldan sağa yerleşimde sağdaki
   canlı fiyatın etiketi, solundaki ikincil bir seviyeye yer kaptırıyordu
   (NVDA provası, 240 piksel: "Fiyat" düştü, "52H Düşük" kaldı). */
function priorityOf(mark: Extract<RailMark, { kind: "tick" | "point" }>): number {
  if (mark.kind === "point") return mark.variant === "live" ? 0 : mark.variant === "target" ? 1 : 2;
  return mark.minor ? 4 : 3;
}

function place(
  items: { p: number; mark: Extract<RailMark, { kind: "tick" | "point" }> }[],
  width: number,
  charPx: number,
): Placement[] {
  const taken: Record<"above" | "below", [number, number][]> = { above: [], below: [] };
  const gap = LABEL_GAP_PX / width;
  const result: Placement[] = items.map(() => ({ row: "none", anchor: "center", name: false }));
  const order = items.map((item, index) => ({ item, index }))
    .sort((a, b) => priorityOf(a.item.mark) - priorityOf(b.item.mark) || a.item.p - b.item.p);
  for (const { item, index } of order) result[index] = placeOne(item.p, item.mark, width, gap, taken, charPx);
  return result;
}

function placeOne(
  p: number,
  mark: RailLabel,
  width: number,
  gap: number,
  taken: Record<"above" | "below", [number, number][]>,
  charPx: number,
): Placement {
  // Önce ad + sayı, sığmazsa yalnızca sayı; tek parçalı etikette tek deneme.
  const variants = mark.label && mark.value ? [true, false] : [Boolean(mark.label)];
  const rows: ("above" | "below")[] = mark.side === "below" ? ["below", "above"] : ["above", "below"];
  for (const name of variants) {
    const w = (labelChars(mark, name) * charPx) / width;
    const anchor: Anchor = p - w / 2 < 0 ? "start" : p + w / 2 > 1 ? "end" : "center";
    const span: [number, number] = anchor === "start" ? [p, p + w] : anchor === "end" ? [p - w, p] : [p - w / 2, p + w / 2];
    if (span[0] < 0 || span[1] > 1) continue;
    for (const row of rows) {
      const clear = taken[row].every(([a, b]) => span[1] + gap <= a || span[0] >= b + gap);
      if (clear) {
        taken[row].push(span);
        return { row, anchor, name };
      }
    }
  }
  return { row: "none", anchor: "center", name: false };
}

/** Etiket satırı yüksekliği: 11 piksellik satır + 4 piksel boşluk. */
const LABEL_ROW_PX = { sm: 18, md: 20 } as const;

export function PriceRail({
  marks,
  size = "sm",
  pad = 0.06,
  className,
}: {
  marks: readonly RailMark[];
  size?: "sm" | "md";
  /** Eksenin iki ucuna eklenen pay, aralığın oranı olarak. */
  pad?: number;
  className?: string;
}) {
  const values = marks
    .flatMap((mark) =>
      mark.kind === "tick" || mark.kind === "point"
        ? [mark.at]
        : mark.kind === "void"
          ? [mark.to]
          : [mark.from, mark.to],
    )
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = (max - min) * pad || Math.abs(max) * FLAT_DOMAIN_SHARE || 1;
  const lo = min - margin;
  const hi = max + margin;
  const frac = (value: number) => (value - lo) / (hi - lo);
  const pct = (value: number) => `${frac(value) * 100}%`;
  const span = (a: number, b: number, floor: number) =>
    ({ left: pct(Math.min(a, b)), width: `max(${floor}px, calc(${pct(Math.max(a, b))} - ${pct(Math.min(a, b))}))` });

  /* Etiketler soldan sağa dizilip yerleştiriliyor; iki genişlik için ayrı. */
  const labelled = marks
    .map((mark, index) => ({ mark, index }))
    .filter((item): item is { mark: Extract<RailMark, { kind: "tick" | "point" }>; index: number } =>
      (item.mark.kind === "tick" || item.mark.kind === "point") && Boolean(item.mark.label || item.mark.value))
    .sort((a, b) => a.mark.at - b.mark.at);
  const items = labelled.map(({ mark }) => ({ p: frac(mark.at), mark }));
  const layouts = LAYOUTS.map(({ key, px }) => ({ key, placed: place(items, px, CHAR_PX[size]) }));
  const rowPx = LABEL_ROW_PX[size];
  const reserve = (layout: Placement[], row: "above" | "below") =>
    layout.some((item) => item.row === row) ? `${rowPx}px` : "0px";
  const frameVars = Object.fromEntries(
    layouts.flatMap(({ key, placed }) => [
      [`--rail-pad-top-${key}`, reserve(placed, "above")],
      [`--rail-pad-bottom-${key}`, reserve(placed, "below")],
    ]),
  ) as React.CSSProperties;

  const bands = marks.filter((mark) => mark.kind === "band");
  const segments = marks.filter((mark) => mark.kind === "segment");
  const live = marks.find((mark): mark is Extract<RailMark, { kind: "point" }> => mark.kind === "point" && mark.variant === "live");
  const travel = marks.find((mark): mark is Extract<RailMark, { kind: "travel" }> => mark.kind === "travel");
  /* Yolculuk canlı noktaya bitiyorsa nokta başlangıçtan kalkar. */
  const travelDelta =
    travel && live && Math.abs(travel.to - live.at) < 1e-9 ? (frac(travel.from) - frac(travel.to)) * 100 : null;

  return (
    <div className={[styles.rail, className].filter(Boolean).join(" ")} data-size={size} aria-hidden>
      <div
        className={styles.frame}
        style={frameVars}
      >
        <div className={styles.track}>
          <span className={styles.axis} />
          {marks.map((mark, index) =>
            mark.kind === "void" ? (
              <span key={`void-${index}`} className={styles.void} style={{ width: pct(mark.to) }} />
            ) : null,
          )}
          {(bands.length > 0 || segments.length > 0) && (
            <span className={styles.legs} data-motion-stagger>
              {bands.map((mark, index) => (
                <span
                  key={`band-${index}`}
                  className={styles.band}
                  data-tone={mark.tone ?? "range"}
                  data-motion-draw="line"
                  style={span(mark.from, mark.to, 6)}
                />
              ))}
              {segments.map((mark, index) => (
                <span
                  key={`seg-${index}`}
                  className={styles.segment}
                  data-tone={mark.tone}
                  data-motion-draw="line"
                  style={{
                    ...span(mark.from, mark.to, 4),
                    transformOrigin: mark.from <= mark.to ? "left center" : "right center",
                  }}
                />
              ))}
            </span>
          )}
          {travel && <span className={styles.travel} style={span(travel.from, travel.to, 0)} />}
          {marks.map((mark, index) => {
            if (mark.kind === "tick") {
              return (
                <span
                  key={`tick-${index}`}
                  className={styles.tick}
                  data-tone={mark.tone ?? "flat"}
                  data-minor={mark.minor || undefined}
                  style={{ left: pct(mark.at) }}
                />
              );
            }
            if (mark.kind !== "point") return null;
            if (mark.variant === "target") {
              return <span key={`pt-${index}`} className={styles.tick} data-tone="primary" data-target style={{ left: pct(mark.at) }} />;
            }
            if (mark.variant === "ghost") {
              return <span key={`pt-${index}`} className={styles.ghost} style={{ left: pct(mark.at) }} />;
            }
            return (
              <span
                key={`pt-${index}`}
                className={travelDelta !== null ? styles.live : `${styles.live} spark-dot`}
                style={{ left: pct(mark.at) }}
                data-motion-draw={travelDelta !== null ? "travel" : undefined}
                data-delta={travelDelta !== null ? travelDelta.toFixed(2) : undefined}
              />
            );
          })}
          {labelled.map(({ mark, index }, order) => {
            /* Her düzen için üç öznitelik: satır (`r`), hiza (`a`), ad (`n`). */
            const placement = Object.fromEntries(
              layouts.flatMap(({ key, placed }) => {
                const at = placed[order]!;
                return [
                  [`data-r${key}`, at.row],
                  [`data-a${key}`, at.anchor],
                  [`data-n${key}`, at.name ? "" : undefined],
                ];
              }),
            );
            return (
              <span
                key={`label-${index}`}
                className={styles.label}
                style={{ left: pct(mark.at) }}
                {...placement}
              >
                {mark.label && <span className={styles.labelName}>{mark.label}</span>}
                {mark.value && <b className={`numeral ${styles.labelValue}`}>{mark.value}</b>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
