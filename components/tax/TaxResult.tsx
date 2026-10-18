"use client";

import { EASE_BRAND_POINTS } from "@/lib/motion";

import { useLayoutEffect, useRef } from "react";
import { animate } from "motion/react";
import { CheckCircle, Info } from "@phosphor-icons/react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import styles from "./Tax.module.css";

/** Sayının yeni değerine yuvarlanma süresi, saniye. */
const ROLL_SECONDS = 0.65;
/** Marka eğrisi (`--ease-brand`), Motion'a dizi olarak. */
const EASE_BRAND = EASE_BRAND_POINTS;

/**
 * YUVARLANAN SAYI — değer değişince eski değerden yenisine sayarak gider.
 *
 * Sonuç kartı her tuşta yeniden hesaplanıyor; sayı bir anda değişince göz
 * neyin değiştiğini kaçırıyordu. Sayma, değişimin YÖNÜNÜ ve büyüklüğünü
 * gösteriyor (komisyon eklenince kazanç birkaç yüz lira aşağı akıyor).
 *
 * React'in kendi metin düğümüne yazılıyor, düğüm DEĞİŞTİRİLMİYOR: React
 * bir sonraki değişiklikte aynı düğümün değerini günceller, yani iki taraf
 * aynı düğüm üzerinde anlaşıyor. Etki yerleşim evresinde: React yeni
 * değeri yazdıktan sonra, boyamadan ÖNCE eski değere geri alınıyor — son
 * değer bir kare bile görünüp geri zıplamıyor. Kare başına React çizimi
 * yok (useState değil). Hareketi azaltan okuyucuya son değer tek seferde.
 */
export function Rolling({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduced = useMotionPreference();

  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    const from = shown.current;
    if (!node || reduced || from === value) {
      shown.current = value;
      return;
    }
    node.nodeValue = format(from);
    const controls = animate(from, value, {
      duration: ROLL_SECONDS,
      ease: EASE_BRAND,
      onUpdate: (current) => {
        shown.current = current;
        node.nodeValue = format(current);
      },
    });
    return () => controls.stop();
  }, [value, format, reduced]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

export type Verdict = "yes" | "no" | "wait";

/**
 * "Beyan Etmen Gerekiyor / Gerekmiyor" rozeti. Anahtarı karar: karar
 * değişince rozet yeniden doğup yaylanarak girer, aynı kaldıkça kıpırdamaz.
 * Renk yön anlamı taşımıyor (yeşil/kırmızı yalnızca kazanç/zarar): "gerekiyor"
 * bir eylem, marka mavisi; "gerekmiyor" nötr ton.
 */
export function VerdictBadge({ verdict, text }: { verdict: Verdict; text: string }) {
  return (
    <p key={verdict} className={styles.verdict} data-need={verdict}>
      {verdict === "yes" ? (
        <CheckCircle size={20} weight="fill" aria-hidden />
      ) : (
        <Info size={20} weight="duotone" aria-hidden />
      )}
      {text}
    </p>
  );
}

export type FlowStep = {
  name: string;
  value: string;
  note?: string;
  /** Çubuğun başladığı yer ve boyu, ölçeğin oranı olarak (0-1). */
  from: number;
  span: number;
  tone: "cost" | "index" | "proceeds" | "up" | "down";
};

/**
 * KAZANÇ NASIL OLUŞTU — dört çubuk, aynı TL ölçeğinde.
 *
 * Eski ekran aynı bilgiyi on bir sütunlu bir tabloda veriyordu; okuyucu
 * maliyetin nasıl endekslendiğini ve kazancın nereden geldiğini sütun sütun
 * çıkarıyordu. Şelalede her adım bir öncekinin üstüne oturuyor: TL maliyet,
 * endekslemenin eklediği dilim (pirinç), satış bedeli ve aradaki fark
 * (yönüyle yeşil ya da kırmızı). Çubuk bir BÜYÜKLÜK; iz yok, yalnızca bir
 * taban çizgisi.
 */
export function Flow({ title, steps }: { title: string; steps: FlowStep[] }) {
  return (
    <section>
      <h3 className={styles.flowTitle}>{title}</h3>
      <ol className={styles.flow}>
        {steps.map((step) => (
          <li key={step.name} className={styles.flowRow}>
            <span className={styles.flowName}>{step.name}</span>
            <span className={styles.flowValue}>{step.value}</span>
            <span className={styles.track} aria-hidden>
              <span
                className={styles.bar}
                data-tone={step.tone}
                style={{ "--from": clamp01(step.from), "--span": clamp01(step.span) } as React.CSSProperties}
              />
            </span>
            {step.note && <span className={styles.flowNote}>{step.note}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Temettü toplamı ve beyan sınırı aynı ölçekte: çubuk toplam, çentik sınır. */
export function DividendMeter({
  total,
  limit,
  leftLabel,
  rightLabel,
}: {
  total: number;
  limit: number;
  leftLabel: string;
  rightLabel: string;
}) {
  /* Ölçek, büyük olanın bir tık üstü: sınır ve toplam hiçbir zaman ölçeğin
     tam ucuna yapışmıyor, çentik de çubuğun ucu da okunuyor. */
  const scale = Math.max(total, limit) * METER_HEADROOM;
  return (
    <div>
      <div className={styles.meter} aria-hidden>
        <span
          className={styles.bar}
          data-tone="proceeds"
          style={{ "--from": 0, "--span": clamp01(scale > 0 ? total / scale : 0) } as React.CSSProperties}
        />
        <span className={styles.meterTick} style={{ "--at": clamp01(scale > 0 ? limit / scale : 0) } as React.CSSProperties} />
      </div>
      {/* Sınırın adı çentiğin ALTINDA: sağ uca yaslı bir etiket, çentik
          ortadayken ölçeğin sonunu sınır gibi okutuyordu. */}
      <div className={styles.meterScale}>
        <span>{leftLabel}</span>
        <span className={styles.meterLimit} style={{ "--at": clamp01(scale > 0 ? limit / scale : 0) } as React.CSSProperties}>
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

const METER_HEADROOM = 1.15;

/**
 * TAHMİNİ VERGİ ARALIĞI — iki uç, tek ölçekte.
 *
 * Ölçek üst uç: çubuğun sonu en kötü durum. Dolu kısım alt uca kadar
 * (kazanç tek gelirse ödenecek en az vergi), soluk kısım alt uçtan üst uca
 * (başka gelir arttıkça verginin kayabileceği aralık). Sayılar `lib/tax.ts`in
 * verdiği iki sayı; çubuk yeni bir tahmin eklemiyor, iki ucu uzunluk olarak
 * gösteriyor. İz yok, yalnızca taban çizgisi (şelaleyle aynı dil).
 */
export function TaxRange({
  low,
  high,
  lowLabel,
  highLabel,
  ariaLabel,
}: {
  low: number;
  high: number;
  lowLabel: string;
  highLabel: string;
  ariaLabel: string;
}) {
  const scale = high > 0 ? high : 1;
  const sure = clamp01(low / scale);
  return (
    <div role="img" aria-label={ariaLabel} className={styles.range}>
      <div className={styles.rangeTrack}>
        <span className={styles.bar} data-tone="proceeds" style={{ "--from": 0, "--span": sure } as React.CSSProperties} />
        <span
          className={styles.bar}
          data-tone="spread"
          style={{ "--from": sure, "--span": clamp01(1 - sure) } as React.CSSProperties}
        />
      </div>
      <div className={styles.rangeKey} aria-hidden>
        <span>
          <i data-tone="proceeds" />
          {lowLabel}
        </span>
        <span>
          <i data-tone="spread" />
          {highLabel}
        </span>
      </div>
    </div>
  );
}

type PreviewRow = { name: string; size: "big" | "mid" | "range" };

/**
 * SONUCUN ÖNİZLEMESİ — boş kartın yerine, gelecek sonucun iskeleti.
 * Etiketler gerçek (okuyucu neyi göreceğini okuyor), sayıların yerinde
 * soluk bloklar. Sayı uydurulmuyor; ekran okuyucuya kapalı, çünkü üstteki
 * yönlendirme cümlesi aynı şeyi söylüyor.
 */
export function ResultPreview({ rows }: { rows: PreviewRow[] }) {
  return (
    <div className={styles.ghost} aria-hidden>
      {rows.map((row, index) => (
        <div key={row.name} className={styles.ghostRow} data-size={row.size} style={{ "--i": index } as React.CSSProperties}>
          <span className={styles.figureLabel}>{row.name}</span>
          <span className={styles.ghostBlock} />
          {row.size === "range" && <span className={styles.ghostRange} />}
        </div>
      ))}
    </div>
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Gelir vergisi tarifesi — matrahın düştüğü dilim işaretli (28 Eylül).
 *
 * "Dilim %15" tek başına tarifenin geri kalanını söylemiyordu: okuyucu
 * kazancı artsa hangi orana geçeceğini, verginin dilim dilim nasıl
 * biriktiğini göremiyordu. Her satırda aralık, oran ve o dilimden ödenen
 * vergi; satırların toplamı alt uç vergiye (`progressiveTax`) eşit. Tarife
 * koddan ya da GİB'den otomatik okunmuş hâliyle geliyor (lib/tax-data.ts).
 */
export function BracketTable({
  title,
  hint,
  brackets,
  base,
  formatMoney,
  formatRate,
  yoursLabel,
  overLabel,
  sliceLabel,
  rangeLabel,
  rateLabel,
  scale,
}: {
  /** Tarife merdiveni (`BracketScale`) — verilirse tablonun üstünde. */
  scale?: BracketScaleLabels;
  title: string;
  hint: string;
  brackets: readonly { upTo: number | null; ratePct: number }[];
  base: number;
  formatMoney: (value: number) => string;
  formatRate: (value: number) => string;
  yoursLabel: string;
  /** "{amount} Üstü" */
  overLabel: string;
  sliceLabel: string;
  rangeLabel: string;
  rateLabel: string;
}) {
  const rows = brackets.map((bracket, index) => {
    /* Alt sınır bir önceki dilimin üst sınırı (ilk dilimde sıfır). */
    const lower = index === 0 ? 0 : (brackets[index - 1].upTo ?? 0);
    const upper = bracket.upTo;
    const slice = base > lower ? Math.min(base, upper ?? Infinity) - lower : 0;
    const current = base > lower && (upper === null || base <= upper);
    return { index, lower, upper, rate: bracket.ratePct, tax: (slice * bracket.ratePct) / 100, current, reached: slice > 0 };
  });
  return (
    <div className={styles.brackets}>
      {scale && (
        <BracketScale brackets={brackets} base={base} formatMoney={formatMoney} formatRate={formatRate} labels={scale} />
      )}
      <p className={styles.figureLabel}>{title}</p>
      <table className={styles.bracketTable}>
        <thead>
          <tr>
            <th scope="col">{rangeLabel}</th>
            <th scope="col">{rateLabel}</th>
            <th scope="col">{sliceLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index} data-current={row.current || undefined} data-reached={row.reached || undefined}>
              <th scope="row" className="numeral">
                {row.upper === null
                  ? overLabel.replace("{amount}", formatMoney(row.lower))
                  : `${formatMoney(row.lower)} – ${formatMoney(row.upper)}`}
                {row.current && <span className={styles.bracketYours}>{yoursLabel}</span>}
              </th>
              <td className="numeral">{formatRate(row.rate)}</td>
              <td className="numeral">{row.reached ? formatMoney(row.tax) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.figureHint}>{hint}</p>
    </div>
  );
}

type BracketScaleLabels = {
  title: string;
  ariaLabel: string;
  /** "%{rate} Dilimine {amount} Var" */
  next: string;
  top: string;
};

/**
 * TARİFEDEKİ YERİN — beş dilim yan yana, matrah bir iğne (18 Ekim).
 *
 * Tablo dilimi söylüyordu ama okuyucu "bir sonraki dilime ne kadar var"ı
 * iki sayıdan çıkarmak zorundaydı. Merdiven bunu bir bakışta gösteriyor.
 *
 * ÖLÇEK SIRA ÖLÇEĞİ, BÜYÜKLÜK DEĞİL: her dilim eşit genişlikte. Doğrusal
 * ölçekte 2026 tarifesinin ilk dilimi (190.000 TL) 5,3 milyonluk dördüncü
 * dilimin yanında %3,6'lık bir çentik oluyor ve iğne çoğu okuyucuda sıfıra
 * yapışıyordu. Bu yüzden ÇUBUK BASILMIYOR (çubuk büyüklüktür — CLAUDE.md
 * "CompareScale"): geçilen dilimler koyu şerit, içinde bulunulan dilim
 * iğneye kadar dolu, kalanlar kulvar. İğnenin dilim İÇİNDEKİ yeri doğrusal
 * (alt sınırdan üst sınıra); açık uçlu son dilimde alt sınırın iki katı
 * dilimin sonu sayılıyor ve iğne %90'da duruyor. Tutarlar alttaki tabloda.
 */
function BracketScale({
  brackets,
  base,
  formatMoney,
  formatRate,
  labels,
}: {
  brackets: readonly { upTo: number | null; ratePct: number }[];
  base: number;
  formatMoney: (value: number) => string;
  formatRate: (value: number) => string;
  labels: BracketScaleLabels;
}) {
  const count = brackets.length;
  const index = brackets.findIndex((bracket) => bracket.upTo === null || base <= bracket.upTo);
  const current = index === -1 ? count - 1 : index;
  const lower = current === 0 ? 0 : (brackets[current - 1].upTo ?? 0);
  const upper = brackets[current].upTo ?? Math.max(lower * 2, base);
  const ceiling = brackets[current].upTo === null ? TOP_PIN : 1;
  const within = Math.min(ceiling, Math.max(0, upper > lower ? (base - lower) / (upper - lower) : 0));
  const next = brackets[current + 1];
  const currentUpTo = brackets[current].upTo;
  const nextText =
    next && currentUpTo !== null
      ? labels.next
          .replace("{rate}", formatRate(next.ratePct).replace(/%/g, ""))
          .replace("{amount}", formatMoney(currentUpTo - base))
      : labels.top;
  return (
    <div className={styles.ladder}>
      <p className={styles.figureLabel}>{labels.title}</p>
      <div role="img" aria-label={labels.ariaLabel} className={styles.ladderBody}>
        <div className={styles.ladderRates} style={{ "--n": count } as React.CSSProperties} aria-hidden>
          {brackets.map((bracket, i) => (
            <span key={i} data-current={i === current || undefined} data-past={i < current || undefined}>
              {formatRate(bracket.ratePct)}
            </span>
          ))}
        </div>
        <div className={styles.ladderLane} style={{ "--n": count } as React.CSSProperties} aria-hidden>
          {brackets.map((_, i) => (
            <span key={i} className={styles.ladderStep} data-past={i < current || undefined}>
              {i === current && (
                <span className={styles.ladderFill} style={{ "--f": within } as React.CSSProperties} />
              )}
            </span>
          ))}
          <span className={styles.ladderPin} style={{ "--i": current, "--w": within } as React.CSSProperties} />
        </div>
      </div>
      <p className={styles.ladderNext}>{nextText}</p>
    </div>
  );
}

/** Açık uçlu son dilimde iğnenin en sağ yeri (dilim genişliğinin oranı). */
const TOP_PIN = 0.9;
