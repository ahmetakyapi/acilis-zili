import styles from "./MacroGauges.module.css";

/* --------------------------------------------------------------------------
   /makro kapağının DÖRT ÖLÇÜSÜ (31 Ekim, sahibinin isteği: "üstteki
   açıklama yazısı net okunmuyor; daha görsel, daha anlaşılabilir").

   Önce başlığın altında iki satırlık kalın bir cümle vardı (TÜFE'nin hedefe
   uzaklığı, işsizliğin son ayı, eğrinin biçimi) ve dönemleri altında 12
   piksellik künyede; 1440'ta 670 piksellik tek paragraf, hiyerarşisiz.
   Olgular aynı, artık her biri bir çizim:

   - Enflasyon: sıfırdan yuvarlak tavana kulvar, %2 hedefi işaretli; hedefin
     üstünde kalan parça pirinç (uyarı tonu, yön değil konum).
   - İşsizlik: son 12 ayın aralığında önceki ay (içi boş halka) ve bu ay
     (dolu nokta); aradaki parça YÖN rengi (sitenin her okundaki kural).
   - Getiri eğrisi: 3 aydan 10 yıla eğim; ters eğride pirinç.
   - Sahm kuralı: sıfırdan eşiğin iki katına kulvar, 0,50 eşiği işaretli.

   Her ölçünün altında tek kısa cümle (şablon + veri, `lib/macro-visual.ts`)
   ve ölçünün kendi dönemi başlığın yanında: dört seri aynı günün verisi
   değil (TÜFE bir ay geriden, faiz farkı günlük). Çizim `aria-hidden`; aynı
   bilgi değerde ve cümlede yazılı.

   Ölçüler dört kolonda AYNI HATTA biter: bant `subgrid` ile dört satırı
   (başlık, değer, çizim, cümle) paylaşıyor; bir ölçünün cümlesi iki satıra
   kırılınca ötekilerin çizimi kaymıyor.

   "use client" DEĞİL: yalnız `MacroSummary` (istemci) içinden çağrılıyor ve
   tipleri sunucu sayfası da okuyor.
   -------------------------------------------------------------------------- */

/** Oranlar 0 (sol) – 1 (sağ); etiketler sunucuda biçimlenmiş. */
export type GaugeVisual =
  | {
      kind: "scale";
      /** Değerin yeri. */
      at: number;
      /** Hedefin/eşiğin yeri ve etiketi ("Hedef %2"). */
      ref: number;
      refLabel: string;
      lo: string;
      hi: string;
    }
  | {
      kind: "move";
      from: number | null;
      to: number;
      fromLabel: string | null;
      tone: "up" | "down" | "flat";
      lo: string;
      hi: string;
      range: string;
    }
  | {
      kind: "slope";
      /** Uzun ucun yüksekliği, −1 – 1 (fark / ölçeğin yarısı). */
      rise: number;
      short: string;
      long: string;
    };

export type GaugeView = {
  key: "inflation" | "unemployment" | "curve" | "sahm";
  title: string;
  period: string;
  value: string;
  text: string;
  /** Hedefin üstü, ters eğri, tetiklenen Sahm: pirinç uyarı tonu. */
  alert: boolean;
  visual: GaugeVisual;
};

export function MacroGauges({ title, gauges }: { title: string; gauges: GaugeView[] }) {
  if (gauges.length === 0) return null;
  return (
    <section className={styles.band} aria-labelledby="makro-olculer" data-macro-lead>
      <h2 id="makro-olculer" className={styles.bandTitle}>{title}</h2>
      <div className={styles.grid} data-count={gauges.length}>
        {gauges.map((gauge) => (
          <div key={gauge.key} className={styles.gauge} data-gauge={gauge.key} data-alert={gauge.alert || undefined}>
            <div className={styles.head}>
              <h3>{gauge.title}</h3>
              <span className="numeral">{gauge.period}</span>
            </div>
            <b className={`${styles.value} numeral`}>{gauge.value}</b>
            <div className={styles.visual} aria-hidden>
              <Visual visual={gauge.visual} alert={gauge.alert} />
            </div>
            <p className={styles.text}>{gauge.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const pct = (ratio: number) => `${(ratio * 100).toFixed(2)}%`;

/** Üstteki etiket kulvarın kenarına yakınsa ortalanmaz, kenara yaslanır (taşmasın). */
function edge(ratio: number): "start" | "end" | undefined {
  return ratio < 0.18 ? "start" : ratio > 0.82 ? "end" : undefined;
}

function Visual({ visual, alert }: { visual: GaugeVisual; alert: boolean }) {
  if (visual.kind === "scale") {
    const below = Math.min(visual.at, visual.ref);
    return (
      <div className={styles.scale}>
        <span className={`${styles.mark} numeral`} data-edge={edge(visual.ref)} style={{ left: pct(visual.ref) }}>{visual.refLabel}</span>
        <div className={styles.track}>
          <span className={styles.fill} style={{ left: 0, width: pct(below) }} />
          {visual.at > visual.ref && (
            <span className={styles.fill} data-tone={alert ? "alert" : undefined} style={{ left: pct(visual.ref), width: pct(visual.at - visual.ref) }} />
          )}
          <span className={styles.tick} style={{ left: pct(visual.ref) }} />
          <span className={styles.dot} data-tone={alert ? "alert" : undefined} style={{ left: pct(visual.at) }} />
        </div>
        <div className={`${styles.ends} numeral`}><span>{visual.lo}</span><span>{visual.hi}</span></div>
      </div>
    );
  }
  if (visual.kind === "move") {
    const { from, to } = visual;
    return (
      <div className={styles.scale}>
        {from !== null && visual.fromLabel && (
          <span className={`${styles.mark} numeral`} data-muted="" data-edge={edge(from)} style={{ left: pct(from) }}>{visual.fromLabel}</span>
        )}
        <div className={styles.track}>
          {from !== null && (
            <span className={styles.fill} data-tone={visual.tone} style={{ left: pct(Math.min(from, to)), width: pct(Math.abs(to - from)) }} />
          )}
          {from !== null && <span className={styles.ring} style={{ left: pct(from) }} />}
          <span className={styles.dot} style={{ left: pct(to) }} />
        </div>
        <div className={`${styles.ends} numeral`}><span>{visual.lo}</span><span className={styles.range}>{visual.range}</span><span>{visual.hi}</span></div>
      </div>
    );
  }
  /* Eğim: sol uç 3 ay (sıfır çizgisi), sağ uç 10 yıl; yükseklik farkın
     ölçeğin yarısına oranı. SVG oranı serbest, noktalar HTML (daire
     elipse dönmesin). */
  const top = 0.5 - visual.rise / 2;
  return (
    <div className={styles.slope}>
      <div className={styles.slopePlot}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" x2="100" y1="50" y2="50" className={styles.zero} vectorEffect="non-scaling-stroke" />
          <line x1="0" x2="100" y1="50" y2={top * 100} className={styles.slopeLine} data-tone={alert ? "alert" : undefined} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={styles.ring} style={{ left: 0, top: "50%" }} />
        <span className={styles.dot} data-tone={alert ? "alert" : undefined} style={{ left: "100%", top: pct(top) }} />
      </div>
      <div className={styles.ends}><span>{visual.short}</span><span>{visual.long}</span></div>
    </div>
  );
}
