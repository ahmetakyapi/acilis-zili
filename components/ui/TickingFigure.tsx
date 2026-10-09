"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import styles from "./TickingFigure.module.css";

/**
 * CANLI SAYI — değişen rakam, değişimin yönünde yerine yuvarlanır (9 Ekim).
 *
 * Endeks kartları ve hisse başlığı seans içinde dakikada bir tazeleniyor ve
 * yeni fiyat tek karede eskisinin yerine geçiyordu. Göz değişimi ancak
 * rakamları yan yana okuyunca fark ediyordu; kartlardaki zemin parlaması
 * (`data-flash`) "bir şey değişti" diyor ama NEYİN değiştiğini söylemiyordu.
 * Şimdi yalnızca DEĞİŞEN rakamlar hareket ediyor: yükselişte eski rakam
 * yukarı çıkıp gidiyor, yenisi aşağıdan geliyor; düşüşte tersi. Hangi
 * basamağın oynadığı (kuruş mu, onlar mı) okumadan görünüyor.
 *
 * ARA DEĞER YOK. Sayaç gibi eski değerden yenisine sayarak gitmiyor: ekranda
 * hiçbir an sağlayıcının vermediği bir fiyat durmuyor (veri dürüstlüğü 1).
 * Hareket yalnızca iki gerçek değer arasındaki geçişin kendisi.
 *
 * Karşılaştırma SAĞDAN hizalı: "999,99" → "1.000,01" gibi uzunluk
 * değişiminde basamaklar birlerden eşleşiyor. Biçim karakteri (nokta,
 * virgül, $) değişirse dönmeden yerine geçiyor. Yön `direction` ile
 * verilmezse iki sayının karşılaştırmasından çıkıyor.
 *
 * İlk çizimde hiçbir şey dönmüyor (yükleme dönüşü `RollingFigure`ın işi).
 * Ekran okuyucu yalnızca yeni değeri okuyor; giden rakam `aria-hidden`.
 * Hareketi azaltan okuyucu doğrudan yeni değeri görüyor (CSS).
 */

type Direction = "up" | "down";

type Tick = {
  /** Gösterilen değer. */
  value: string;
  /** Bir önceki değer — yalnızca bir değişimden sonra dolu. */
  from: string | null;
  direction: Direction;
  /** Her değişimde artar; dönen rakamların anahtarı, animasyonu yeniden başlatır. */
  n: number;
};

/** "1.234,56 $" → 1234.56 (TR) / "$1,234.56" → 1234.56 (EN). */
function numeric(text: string, decimal: "," | "."): number {
  const cleaned = text.replace(decimal === "," ? /\./g : /,/g, "").replace(decimal, ".").replace(/[^\d.\-−]/g, "").replace("−", "-");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function TickingFigure({
  value,
  initial,
  direction,
  decimal = ",",
  className,
}: {
  value: string;
  /**
   * Bileşen bağlandığında ekranda DURAN değer — başka bir bileşen (sunucu
   * çizimi, `RollingFigure`) basmışsa. Verilirse ilk değişim de dönüyor;
   * yoksa ilk çizim olduğu gibi.
   */
  initial?: string;
  /** Değişimin yönü; yoksa iki değerin karşılaştırmasından. */
  direction?: Direction;
  /** Ondalık ayracı — TR "," EN ".". Yalnızca yön çıkarımı için. */
  decimal?: "," | ".";
  className?: string;
}) {
  const [tick, setTick] = useState<Tick>({ value: initial ?? value, from: null, direction: "up", n: 0 });
  if (tick.value !== value) {
    const before = numeric(tick.value, decimal);
    const after = numeric(value, decimal);
    const inferred: Direction = after < before ? "down" : "up";
    setTick({ value, from: tick.value, direction: direction ?? inferred, n: tick.n + 1 });
  }

  const chars = [...tick.value];
  const prev = tick.from ? [...tick.from] : null;
  const offset = prev ? prev.length - chars.length : 0;
  /* Elde gibi: en sağdaki dönen rakam önce, solundakiler birer adım sonra. */
  let order = prev
    ? chars.filter((char, index) => {
        const old = prev[index + offset];
        return char >= "0" && char <= "9" && old !== undefined && old !== char && old >= "0" && old <= "9";
      }).length
    : 0;

  return (
    <span className={cn(styles.figure, className)} data-dir={tick.direction}>
      {chars.map((char, index) => {
        const old = prev ? prev[index + offset] : undefined;
        const isDigit = char >= "0" && char <= "9";
        const rolls = prev !== null && isDigit && old !== undefined && old !== char && old >= "0" && old <= "9";
        if (!rolls) return <span key={`${index}-${char}`}>{char}</span>;
        return (
          <span key={`${index}-${tick.n}`} className={styles.slot} style={{ "--i": --order } as CSSProperties}>
            <span aria-hidden className={styles.out}>
              {old}
            </span>
            <span className={styles.in}>{char}</span>
          </span>
        );
      })}
    </span>
  );
}
