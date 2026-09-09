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
 * Başlangıçta dört sabit sütundu. Artık tam gün kalmadığında gün sütunu
 * ve kendi ayıracı hiç basılmaz; kalan üç birim alanı birlikte kullanır.
 * Önceki üç birimli görünüm gün varken saniyeyi gizlediği için dakikada bir
 * yenileniyordu. Saniye artık görünür; tek saniyelik zamanlayıcı yalnızca
 * bu küçük yaprağı yeniler ve gizli sekmede durur. Seansın hedefini yine
 * market-hours belirler, sınırı geçince SessionRefresh yeni hedefi alır.
 */
export function Countdown({
  targetIso,
  initialNowMs,
  units,
  label,
  className,
}: {
  targetIso: string;
  initialNowMs: number;
  units: Units;
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

  return (
    <div
      role="timer"
      aria-label={label}
      aria-live="off"
      data-days={values[0] > 0}
      className={[styles.countdown, className].filter(Boolean).join(" ")}
    >
      {values.map((value, index) => index === 0 && value === 0 ? null : (
        <div className={styles.unit} key={names[index]}>
          <span className={styles.numberWindow}>
            <span key={value} className={styles.number}>
              {String(value).padStart(2, "0")}
            </span>
          </span>
          <span className={styles.label}>{names[index]}</span>
        </div>
      ))}
    </div>
  );
}
