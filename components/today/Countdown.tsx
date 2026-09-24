"use client";

import { useEffect, useState } from "react";
import styles from "./Countdown.module.css";

type Units = { d: string; h: string; m: string; s: string };

function split(targetMs: number, nowMs: number) {
  const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return [
    Math.floor(total / 86400),
    Math.floor((total % 86400) / 3600),
    Math.floor((total % 3600) / 60),
    total % 60,
  ];
}

/**
 * Geri sayım kahramanın ana okuması; saniye her zaman görünür.
 * Başlangıçta dört sabit sütundu. Artık tam gün kalmadığında gün grubu hiç
 * basılmaz; kalan üç birim satırı birlikte kullanır.
 * Önceki üç birimli görünüm gün varken saniyeyi gizlediği için dakikada bir
 * yenileniyordu. Saniye artık görünür; tek saniyelik zamanlayıcı yalnızca
 * bu küçük yaprağı yeniler ve gizli sekmede durur. Seansın hedefini yine
 * market-hours belirler, sınırı geçince SessionRefresh yeni hedefi alır.
 *
 * KUTU YOK, İKİ NOKTA YOK (22 Eylül). Üç kutulu görünüm bir form alanı gibi
 * okunuyordu ve rakamı 59 punto ile sınırlıyordu. Şimdi tek bir rakam
 * satırı: dev rakamın yanında küçük harfli birim ("02 sa 11 dk 29 sn") —
 * CLAUDE.md'deki bilinçli tipografik karar. Birim `aria-hidden`; ekran
 * okuyucu için tam ad (`units`) görünmez bir metin olarak grubun içinde.
 */
export function Countdown({
  targetIso,
  initialNowMs,
  units,
  unitsShort,
  label,
  className,
}: {
  targetIso: string;
  initialNowMs: number;
  /** Ekran okuyucunun duyduğu tam ad: "Saat". */
  units: Units;
  /** Rakamın yanında görünen kısa birim: "sa". */
  unitsShort: Units;
  label: string;
  className?: string;
}) {
  const targetMs = new Date(targetIso).getTime();
  // Aynı sunucu damgası hidratasyonda da kullanılır; saniye sınırında
  // farklı düğüm ağacı veya metin oluşmaz. JS yokken ilk okuma görünürdür.
  const [nowMs, setNowMs] = useState(initialNowMs);

  useEffect(() => {
    let timer = 0;
    function tick() {
      if (document.hidden) return;
      setNowMs(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
    }
    function resume() {
      window.clearTimeout(timer);
      if (!document.hidden) tick();
    }
    timer = window.setTimeout(tick, 0);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  const values = split(targetMs, nowMs);
  const names = [units.d, units.h, units.m, units.s];
  const shorts = [unitsShort.d, unitsShort.h, unitsShort.m, unitsShort.s];

  return (
    <div
      role="timer"
      aria-label={label}
      aria-live="off"
      data-days={values[0] > 0}
      className={[styles.countdown, className].filter(Boolean).join(" ")}
    >
      {values.map((value, index) => index === 0 && value === 0 ? null : (
        <span className={styles.group} key={names[index]}>
          <span className={styles.numberWindow}>
            {String(value)
              .padStart(2, "0")
              .split("")
              .map((digit, place) => (
                <RollingDigit key={place} digit={digit} />
              ))}
          </span>
          <span className={styles.suffix} aria-hidden="true">{shorts[index]}</span>
          <span className="sr-only">{names[index]}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * KİLOMETRE SAYACI — yalnızca DEĞİŞEN rakam yuvarlanır.
 *
 * Bütün sayı her saniye yeniden doğuyordu (`key={value}`): "11"den "10"a
 * geçerken değişmeyen onlar basamağı da solup yeniden geliyordu ve göz
 * saniyede bir tüm grubu kıpırdarken görüyordu. Şimdi her basamak kendi
 * penceresinde: eski rakam yukarı çıkıp giderken yenisi alttan gelip
 * oturuyor, sayfa bir sayaç gibi dönüyor. Dakika döndüğünde saniye
 * basamaklarıyla birlikte dakika da yuvarlanıyor — zamanın "tıkladığı"
 * an görünür oluyor.
 *
 * Önceki rakam render sırasında türetiliyor (React'in "önceki prop'u
 * saklama" kalıbı): efekt yok, fazladan çizim turu yok. Giden rakam
 * `aria-hidden`; ekran okuyucu grubun tam adını ve yalnızca güncel rakamı
 * duyuyor.
 */
function RollingDigit({ digit }: { digit: string }) {
  const [current, setCurrent] = useState(digit);
  const [previous, setPrevious] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  if (digit !== current) {
    setPrevious(current);
    setCurrent(digit);
    setTurn((value) => value + 1);
  }
  return (
    <span className={styles.digit}>
      {previous !== null && (
        <span key={`out-${turn}`} className={styles.digitOut} aria-hidden="true">
          {previous}
        </span>
      )}
      <span key={`in-${turn}`} className={turn ? styles.digitIn : undefined}>
        {current}
      </span>
    </span>
  );
}
