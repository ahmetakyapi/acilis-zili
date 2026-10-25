"use client";

import { useCallback, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./Probabilities.module.css";

/**
 * Son 30 günün olasılık çizgisi — okuma katmanlı (25 Ekim).
 *
 * Çizim sunucudan gelen hizalı tablodan: her satır bir gün, her seri bir
 * sonuç (ya da sonuç kümesi). Dikey eksen HER ZAMAN 0–100: olasılık
 * çizgisi kendi en düşüğüne göre esnetilirse 2 puanlık kıpırtı bütün kutuyu
 * doldurur ve "büyük değişim" gibi okunur. %50 çizgisi kesik ve künyeli —
 * iki sonuçlu olayda çizginin hangi yarıda olduğu asıl bilgi.
 *
 * OKUMA: imleç ya da dokunuş en yakın günü seçer; dikey çizgi ve o günün
 * değerleri künyede. Klavyede ←/→ gün gün, Esc bırakır (kutu odaklanabilir,
 * dokunma hedefi kutunun tamamı — 44 pikselden büyük). Çizgi metin değil:
 * değerler HTML künyede, SVG esnediği için içinde yazı yok.
 *
 * KOMPAKT (25 Ekim, görsel tur). Okuma künyesi artık çizginin ALTINDA
 * kendi satırını tutmuyor: boştayken ipucu yalnız ekran okuyucuya, okuma
 * sırasında o satır günün değerlerini, boştayken çizginin ilk ve son
 * gününü (eksen) gösteriyor. Dört çizgi dört ayrı "üzerine gelin" cümlesi
 * basıyordu ve tarih ekseni hiç yoktu; kartlar ilk ekrana sığmıyordu
 * (ölçüldü, 1440×900'de seçim kartının dibi 1307). Yükseklik çağıranın.
 */

export type LineSeries = { key: string; label: string; tone: string };
export type LineRow = { label: string; values: Record<string, number> };

/** İki uç künyesi arasında en az bu kadar piksel (künye satırı 16). Yüzde
    sabit 13 iken 76 piksellik çizgide "Artış" ile "İndirim" üst üste
    biniyordu (ölçüldü); aralık artık çizginin boyuna göre. */
const LABEL_MIN_GAP_PX = 16;
/** Künye sütununda adın dışındaki pay: işaret, boşluk ve "%100". */
const END_EXTRA_CH = 7;

/**
 * Uç künyelerini birbirine binmeyecek kadar aralar (saf). Önce yukarıdan
 * aşağı iter; dibe taşan olursa aşağıdan yukarı geri iter — ikisi de
 * %0'a yakın iki seri (indirim ve artış) dipte üst üste biniyordu.
 */
function placeEnds<T extends { y: number }>(items: T[], gap: number): (T & { top: number })[] {
  const tops: number[] = [];
  let floor = -Infinity;
  for (const item of items) {
    const top = Math.max(item.y, floor + gap);
    tops.push(top);
    floor = top;
  }
  let ceiling = 100 + gap;
  for (let i = tops.length - 1; i >= 0; i--) {
    tops[i] = Math.min(tops[i], ceiling - gap);
    ceiling = tops[i];
  }
  return items.map((item, i) => ({ ...item, top: tops[i] }));
}

export function ProbabilityLine({
  series,
  rows,
  ariaLabel,
  percent,
  midLabel,
  hint,
  endText,
  height = 112,
  grow = false,
}: {
  series: LineSeries[];
  rows: LineRow[];
  ariaLabel: string;
  /** Sunucu biçimlendiremez (istemcide değer seçiliyor): tam sayı yüzde, dile göre. */
  percent: "tr" | "en";
  midLabel: string;
  hint: string;
  /** Uç künyesinin metni (sunucu panelin büyük sayısıyla aynı paydan verir). */
  endText?: Record<string, string>;
  /** Çizim yüksekliği (piksel); telefonda %86'sı. */
  height?: number;
  /** Kartın kalan boyunu doldurur (`height` en az boy): satırdaki kartlar
      eşit boyda, kısa kartın boşluğu ortada kalmasın. */
  grow?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const id = useId();
  const n = rows.length;
  const xOf = (i: number) => (n <= 1 ? 100 : (i / (n - 1)) * 100);
  const yOf = (p: number) => (1 - p) * 100;
  const fmt = (p: number) => {
    const value = Math.round(p * 100);
    return percent === "tr" ? `%${value}` : `${value}%`;
  };

  const pick = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      /* Oran ÇİZİM alanına göre: sağdaki uç künyesi sütunu eksen değil. */
      const box = (plot.current ?? event.currentTarget).getBoundingClientRect();
      if (box.width <= 0 || n === 0) return;
      const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      setActive(Math.round(ratio * (n - 1)));
    },
    [n],
  );

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setActive((current) => Math.min(n - 1, Math.max(0, (current ?? n - 1) + step)));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  if (n < 2) return null;

  /* Uç künyeleri: son değerler, çakışmasın diye yukarıdan aşağı aralanır. */
  const last = rows[n - 1];
  const ends = series
    .map((s) => ({ ...s, value: last.values[s.key] }))
    .filter((s): s is LineSeries & { value: number } => typeof s.value === "number")
    .sort((a, b) => b.value - a.value);
  const endWidth = Math.max(...series.map((s) => s.label.length)) + END_EXTRA_CH;
  /* Büyüyen çizgide gerçek boy en az `height`: aralık ona göre güvenli. */
  const placed = placeEnds(ends.map((s) => ({ ...s, y: yOf(s.value) })), (LABEL_MIN_GAP_PX / height) * 100);

  const shown = active ?? null;
  const row = shown !== null ? rows[shown] : null;

  return (
    <figure className={styles.line} data-grow={grow || undefined} style={{ "--plot-h": `${height}px` } as CSSProperties}>
      <div
        className={styles.lineBox}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={`${id}-read`}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <div ref={plot} className={styles.linePlot}>
          <svg className={styles.lineSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="0" x2="100" y1="50" y2="50" className={styles.lineMid} vectorEffect="non-scaling-stroke" />
            <line x1="0" x2="100" y1="100" y2="100" className={styles.lineBase} vectorEffect="non-scaling-stroke" />
            {series.map((s) => {
              const points = rows
                .map((r, i) => (typeof r.values[s.key] === "number" ? `${xOf(i)},${yOf(r.values[s.key])}` : null))
                .filter(Boolean)
                .join(" ");
              return (
                <polyline
                  key={s.key}
                  points={points}
                  data-tone={s.tone}
                  className={`spark-line ${styles.linePath}`}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                />
              );
            })}
          </svg>
          <span className={styles.lineMidLabel} aria-hidden>{midLabel}</span>
          {row && shown !== null && (
            <span className={styles.lineRule} style={{ left: `${xOf(shown)}%` }} aria-hidden />
          )}
        </div>
        {/* Sütun en uzun künye kadar geniş: künyeler mutlak konumlu, kendi
            genişliklerini sütuna veremiyorlar (ölçüldü: "Cumhuriyetçiler %37"
            panelden taşıyordu). */}
        <div className={styles.lineEnds} aria-hidden style={{ width: `${endWidth}ch` }}>
          {placed.map((s) => (
            <span key={s.key} data-tone={s.tone} style={{ top: `${s.top}%` }}>
              <i />
              {s.label} <b className="numeral">{endText?.[s.key] ?? fmt(s.value)}</b>
            </span>
          ))}
        </div>
      </div>
      {/* Alt satır tek yer: boştayken ilk ve son gün (eksen), okurken o
          günün değerleri. İpucu yalnız ekran okuyucuya. Yükseklik sabit,
          okuma başlayınca hiçbir şey kaymıyor. */}
      <figcaption id={`${id}-read`} className={styles.lineRead} aria-live="polite" data-reading={row ? "" : undefined}>
        {row ? (
          <>
            <span className="numeral">{row.label}</span>
            {series.map((s) =>
              typeof row.values[s.key] === "number" ? (
                <span key={s.key} data-tone={s.tone}>
                  <i aria-hidden />
                  {s.label} <b className="numeral">{fmt(row.values[s.key])}</b>
                </span>
              ) : null,
            )}
          </>
        ) : (
          <>
            <span className="sr-only">{hint}</span>
            <span className={styles.lineAxis} aria-hidden style={{ marginRight: `calc(${endWidth}ch + 10px)` }}>
              <span className="numeral">{rows[0].label}</span>
              <span className="numeral">{rows[n - 1].label}</span>
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
