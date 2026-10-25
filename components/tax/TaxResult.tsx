"use client";

import { EASE_BRAND_POINTS } from "@/lib/motion";

import { useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { CheckCircle, Info } from "@phosphor-icons/react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { bracketBand, type Waterfall as WaterfallGeometry } from "@/lib/tax-waterfall";
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

export type WaterfallStep = { name: string; value: string; note?: string };

/**
 * KAZANÇTAN MATRAHA — beş sütunlu şelale ve altında numaralı döküm (25
 * Ekim, görsel tur).
 *
 * Önceki `Flow` dört yatay şeritti: okuyucu maliyetin endekslemeyle nasıl
 * büyüdüğünü ve kazancın satış bedelinin hangi parçası olduğunu şeritlerin
 * başlangıç noktalarını karşılaştırarak çıkarıyordu, matrah ise ayrı bir
 * sayıydı. Şelalede her sütun bir öncekinin bıraktığı yerden başlıyor:
 * maliyetin tepesi endekslemenin tabanı, endeksli maliyetle satış bedeli
 * arasındaki boşluk kazancın kendisi, ve kesik çizgiler aynı tutardaki
 * uçları birbirine bağlıyor (geometri `lib/tax-waterfall.ts`, testli).
 *
 * RENK (site geneli renk kararı, güncel hâli): büyüklükler mavi ailenin
 * YUMUŞAK tonlarında, yoğunluk sırayla artıyor (maliyet en açık, satış
 * orta, matrah en dolu: sonucun kendisi); doygun etkileşim mavisi veri
 * çiziminde ve sayı metninde yok. Endeksleme payı sayfanın pirinci (aynı
 * anlam "Nasıl Hesaplanır"daki örnekte de), kazanç ya da zarar yön rengiyle.
 *
 * Sütun ile satır birbirini vurgular (üzerine gelince ötekiler söner);
 * döküm satırları sayıların tamamını yazılı taşıdığı için çizim ekran
 * okuyucuya tek cümlelik bir özetle açılıyor, klavyede ayrıca odak durağı
 * açılmıyor (hesaplayıcıdaki sekme sırası kalabalıklaşmasın).
 */
export function Waterfall({
  title,
  steps,
  geometry,
  ariaLabel,
  scaleNote,
  sketch = false,
}: {
  title: string;
  steps: WaterfallStep[];
  geometry: WaterfallGeometry;
  ariaLabel?: string;
  scaleNote?: string;
  /** Boş sonuçtaki taslak: sayısız, soluk, okuyucuya kapalı. */
  sketch?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const count = geometry.columns.length;
  return (
    <section className={styles.wf} data-sketch={sketch || undefined} data-active={active ?? undefined}>
      <h3 className={styles.flowTitle}>{title}</h3>
      <div
        className={styles.wfChart}
        role={sketch ? undefined : "img"}
        aria-label={sketch ? undefined : ariaLabel}
        aria-hidden={sketch || undefined}
        style={{ "--n": count } as React.CSSProperties}
        onPointerLeave={() => setActive(null)}
      >
        {geometry.connectors.map((line) => (
          <span
            key={`${line.from}-${line.to}`}
            className={styles.wfLink}
            style={{ "--a": line.from, "--b": line.to, "--level": line.level } as React.CSSProperties}
          />
        ))}
        {geometry.columns.map((column, index) => (
          <span
            key={column.key}
            className={styles.wfCol}
            data-on={active === index || undefined}
            style={{ "--i": index } as React.CSSProperties}
            onPointerEnter={() => setActive(index)}
          >
            <span
              className={styles.wfBar}
              data-tone={column.tone}
              style={{ "--from": column.from, "--span": column.span } as React.CSSProperties}
            />
            {!sketch && steps[index] && column.span > 0 && (
              <span
                className={`numeral ${styles.wfTop}`}
                style={{ "--top": Math.min(1, column.from + column.span) } as React.CSSProperties}
              >
                {steps[index].value}
              </span>
            )}
          </span>
        ))}
      </div>
      <ol className={styles.wfAxis} aria-hidden style={{ "--n": count } as React.CSSProperties}>
        {geometry.columns.map((column, index) => (
          <li key={column.key} data-on={active === index || undefined}>
            <span className={styles.wfNum}>{index + 1}</span>
          </li>
        ))}
      </ol>
      <ol className={styles.wfList} aria-hidden={sketch || undefined}>
        {steps.map((step, index) => (
          <li
            key={step.name}
            className={styles.wfRow}
            data-on={active === index || undefined}
            data-tone={geometry.columns[index]?.tone}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
          >
            <span className={styles.wfNum} aria-hidden>
              {index + 1}
            </span>
            <span className={styles.wfSwatch} data-tone={geometry.columns[index]?.tone} aria-hidden />
            <span className={styles.flowName}>{step.name}</span>
            <span className={`numeral ${styles.flowValue}`}>{sketch ? "" : step.value}</span>
            {step.note && !sketch && <span className={styles.wfNote}>{step.note}</span>}
          </li>
        ))}
      </ol>
      {scaleNote && !sketch && <p className={styles.figureHint}>{scaleNote}</p>}
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
  /** "{base}; {count} dilime yayılıyor, son dilim %{rate}" */
  ariaLabel: string;
  /** "%{rate} Dilimine {amount} Var" */
  next: string;
  top: string;
  /** Dar dilimlerin birleşik oranı: "%{from}-%{to}" */
  merged: string;
  hint: string;
};

/**
 * MATRAHIN DİLİMLERE DAĞILIMI — tek şerit, dilim dilim (25 Ekim; 18 Ekim'in
 * eşit basamaklı "Tarifedeki Yerin" merdiveninin yerine).
 *
 * Merdiven matrahın HANGİ dilimde olduğunu söylüyordu ama verginin nasıl
 * biriktiğini değil: okuyucu "%15'lik dilimden ne ödedim, %20'likten ne"
 * sorusunu tablodan satır satır topluyordu. Bant bunu tek bakışta gösteriyor:
 * her geçilen dilim kendi TL genişliğinde dolu bir parça, üstünde oranı,
 * altında o dilimden ödenen vergi; içinde bulunulan dilim matraha kadar
 * dolu, kalanı kesik çizgili hayalet (sonraki dilime kalan yol). "%20
 * Dilimine X Var" cümlesi hayaletin altında kaldı.
 *
 * ÖLÇEK BÜYÜKLÜK: genişlik TL aralığıyla orantılı, o yüzden ulaşılmamış
 * dilimler çizilmiyor (açık uçlu son dilim bandı sonsuza uzatırdı). Dar
 * dilimin etiketi sığmıyorsa basılmıyor; dar dilimler bir arada sığıyorsa
 * tek etikette birleşiyor ("%15-%27"). Tutarların tamamı alttaki tabloda.
 * Ton yumuşak mavide oranla yoğunlaşıyor: oran bir büyüklük, yön değil.
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
  const band = bracketBand(brackets, base);
  if (!band) return null;
  const current = band.slices[band.slices.length - 1];
  const rateDigits = (rate: number) => formatRate(rate).replace(/%/g, "");
  const nextText =
    band.toNext !== null && band.nextRate !== null
      ? labels.next.replace("{rate}", rateDigits(band.nextRate)).replace("{amount}", formatMoney(band.toNext))
      : labels.top;
  const top = Math.max(1, ...brackets.map((bracket) => bracket.ratePct));
  return (
    <div className={styles.band}>
      <p className={styles.figureLabel}>{labels.title}</p>
      <div
        role="img"
        aria-label={labels.ariaLabel
          .replace("{base}", formatMoney(base))
          .replace("{count}", String(band.slices.length))
          .replace("{rate}", rateDigits(current.ratePct))}
        className={styles.bandBody}
      >
        {/* Üst satır oranlar, orta şerit, alt satır dilim vergisi: üçü aynı
            ızgara sütunlarında, yani etiket hep kendi diliminin üstünde. */}
        <div className={styles.bandGrid} style={{ gridTemplateColumns: band.slices.map((slice) => `${slice.width}fr`).join(" ") }} aria-hidden>
          {band.merged && (
            <span className={styles.bandMerged} style={{ gridColumn: `1 / span ${band.slices.filter((x) => !x.labeled && x.state === "past").length}`, gridRow: 1 }}>
              <b>
                {labels.merged
                  .replace("{from}", rateDigits(band.merged.fromRate))
                  .replace("{to}", rateDigits(band.merged.toRate))}
              </b>
              <span className={`numeral ${styles.bandMergedTax}`}>{formatMoney(band.merged.tax)}</span>
            </span>
          )}
          {band.slices.map((slice, i) => (
            <span
              key={slice.index}
              className={styles.bandSlice}
              data-state={slice.state}
              data-labeled={slice.labeled || undefined}
              data-merged={(band.merged && !slice.labeled && slice.state === "past") || undefined}
              style={{ "--i": i, "--tone": slice.ratePct / top, "--fill": slice.fill, gridColumn: i + 1, gridRow: 1 } as React.CSSProperties}
            >
              <span className={styles.bandRate}>{formatRate(slice.ratePct)}</span>
              <span className={styles.bandStrip}>
                <span className={styles.bandFill} />
              </span>
              <span className={`numeral ${styles.bandTax}`}>{formatMoney(slice.tax)}</span>
            </span>
          ))}
        </div>
      </div>
      <p className={styles.ladderNext}>
        {band.toNext !== null && <span className={styles.bandGhostKey} aria-hidden />}
        {nextText}
      </p>
      <p className={styles.figureHint}>{labels.hint}</p>
    </div>
  );
}
