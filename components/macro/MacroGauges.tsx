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
   - İşsizlik: son 12 ayın aralığında önceki aydan bu aya uzanan çubuk;
     rengi YÖN (sitenin her okundaki kural), önceki ay ince çentik.
   - Getiri eğrisi: sıfır ortada, 10 yıl ile 3 ay arasındaki fark kadar
     sağa (normal) ya da sola (ters, pirinç) uzanan çubuk.
   - Sahm kuralı: sıfırdan eşiğin iki katına kulvar, 0,50 eşiği işaretli.

   KALIN ÇUBUK, NOKTA YOK (10 Kasım 2026, sahibinin sözü: "böyle nokta nokta
   ne anlatıyor anlamıyorum; çizgi grafiği yerine yatayda uzun KALIN çizgi
   seviyorum"; "başka buna uyarlanacak ekran varsa onları da yapalım").
   Dört çizimin dördünde de değerin yeri 13 piksellik bir noktaydı: 5
   piksellik ince dolgunun ucunda (enflasyon, Sahm), içi boş halkadan dolu
   noktaya (işsizlik), iki uçlu eğim çizgisinin ucunda (getiri eğrisi; iki
   noktalı bir çizgi grafiği). Sahm 0,00 iken kulvarın başında tek başına
   bir nokta duruyordu. Şimdi dördü de aynı dil: 5 piksellik kulvar, 8
   piksellik dolu çubuk (dış ucu yuvarlak), tek kıyas imi koyu ince çentik
   (hedef, eşik, önceki ay, sıfır). Değerin kendisi üstte 32 punto.

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
      kind: "spread";
      /** Farkın ölçeğin yarısına oranı, −1 – 1 (eksi: ters eğri). */
      rise: number;
      /** Sıfırın etiketi ve iki ucun adı ("Ters", "Normal"). */
      zeroLabel: string;
      lo: string;
      hi: string;
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
    const over = visual.at > visual.ref;
    return (
      <div className={styles.scale}>
        <span className={`${styles.mark} numeral`} data-edge={edge(visual.ref)} style={{ left: pct(visual.ref) }}>{visual.refLabel}</span>
        <div className={styles.track} data-draw>
          {/* Sıfırdan değere tek çubuk; hedefi/eşiği aşan parça uyarı tonunda.
              En az %1,5: sıfırdaki değerde (Sahm 0,00) çubuğun başı görünsün. */}
          <span className={`bar-fill ${styles.fill}`} data-end={over ? "start" : undefined} style={{ left: 0, width: pct(Math.max(below, 0.015)) }} />
          {over && (
            <span className={`bar-fill ${styles.fill}`} data-end="end" data-tone={alert ? "alert" : undefined} style={{ left: pct(visual.ref), width: pct(visual.at - visual.ref) }} />
          )}
          <span className={styles.tick} style={{ left: pct(visual.ref) }} />
        </div>
        <div className={`${styles.ends} numeral`}><span>{visual.lo}</span><span>{visual.hi}</span></div>
      </div>
    );
  }
  if (visual.kind === "move") {
    const { from, to } = visual;
    const left = from !== null && to < from;
    return (
      <div className={styles.scale}>
        {from !== null && visual.fromLabel && (
          <span className={`${styles.mark} numeral`} data-muted="" data-edge={edge(from)} style={{ left: pct(from) }}>{visual.fromLabel}</span>
        )}
        <div className={styles.track} data-draw>
          {from !== null ? (
            <>
              {/* Önceki aydan bu aya: çubuğun yuvarlak ucu bu ay. */}
              <span
                className={`bar-fill ${styles.fill}`}
                data-end={left ? "start" : "end"}
                data-grow={left ? "left" : undefined}
                data-tone={visual.tone}
                style={{ left: pct(Math.min(from, to)), width: pct(Math.max(Math.abs(to - from), 0.015)) }}
              />
              <span className={styles.tick} style={{ left: pct(from) }} />
            </>
          ) : (
            /* Değişmedi: aralığın başından bu aya nötr çubuk (yön yok). */
            <span className={`bar-fill ${styles.fill}`} style={{ left: 0, width: pct(Math.max(to, 0.015)) }} />
          )}
        </div>
        <div className={`${styles.ends} numeral`}><span>{visual.lo}</span><span className={styles.range}>{visual.range}</span><span>{visual.hi}</span></div>
      </div>
    );
  }
  /* Fark: sıfır ortada; artı (normal eğri) sağa, eksi (ters eğri) sola.
     Önceki hâl 3 aydan 10 yıla çizilen iki noktalı bir eğim çizgisiydi. */
  const half = Math.min(1, Math.abs(visual.rise)) * 50;
  const negative = visual.rise < 0;
  return (
    <div className={styles.scale}>
      <span className={`${styles.mark} numeral`} data-muted="" style={{ left: "50%" }}>{visual.zeroLabel}</span>
      <div className={styles.track} data-draw>
        <span
          className={`bar-fill ${styles.fill}`}
          data-end={negative ? "start" : "end"}
          data-grow={negative ? "left" : undefined}
          data-tone={alert ? "alert" : undefined}
          style={negative ? { right: "50%", width: pct(Math.max(half, 1.5) / 100) } : { left: "50%", width: pct(Math.max(half, 1.5) / 100) }}
        />
        <span className={styles.tick} style={{ left: "50%" }} />
      </div>
      <div className={styles.ends}><span>{visual.lo}</span><span>{visual.hi}</span></div>
    </div>
  );
}
