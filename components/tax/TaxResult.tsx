"use client";

import { useLayoutEffect, useRef } from "react";
import { animate } from "motion/react";
import { CheckCircle, Info } from "@phosphor-icons/react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import styles from "./Tax.module.css";

/** Sayının yeni değerine yuvarlanma süresi, saniye. */
const ROLL_SECONDS = 0.65;
/** Marka eğrisi (`--ease-brand`), Motion'a dizi olarak. */
const EASE_BRAND = [0.22, 1, 0.36, 1] as const;

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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
