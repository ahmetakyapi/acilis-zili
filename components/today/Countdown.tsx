"use client";

import { useEffect, useState } from "react";

/**
 * Zil geri sayımı — sayfanın en büyük sayısı (66px), saniye saniye akar.
 *
 * Sunucu ilk değeri basar, istemci devralır: JS gelmeden önce de doğru bir
 * sayı görünür. `suppressHydrationWarning` şart — sunucunun bastığı saniye
 * ile istemcinin ilk okuduğu saniye arasında bir tik fark olabilir.
 */

type Units = { d: string; h: string; m: string; s: string };

function split(targetMs: number, nowMs: number) {
  const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function Countdown({
  targetIso,
  units,
  className,
}: {
  targetIso: string;
  units: Units;
  className?: string;
}) {
  const targetMs = new Date(targetIso).getTime();
  const [nowMs, setNowMs] = useState(() => Date.now());

  /* TİK, GÖSTERİLEN EN KÜÇÜK BİRİME BAĞLI. Aralık her durumda 1 saniyeydi;
     oysa zil bir günden uzaksa ekranda gün/saat/dakika var, saniye yok —
     yani saniyede bir çizim aynı çıktıyı üretiyordu. Ana sayfa açık
     bırakıldığında saatlerce süren, karşılığı olmayan bir döngü. Hedef bir
     günün altına indiğinde bağımlılık değişiyor ve saniyelik tike kendi
     kendine geçiliyor. */
  const coarse = split(targetMs, nowMs).days > 0;

  useEffect(() => {
    const step = coarse ? 60_000 : 1_000;
    const id = window.setInterval(() => setNowMs(Date.now()), step);
    return () => window.clearInterval(id);
  }, [coarse]);

  const { days, hours, minutes, seconds } = split(targetMs, nowMs);

  // En anlamlı üç birim gösterilir. Dakika her zaman listede: "1g 16sa"
  // kalan sürenin bir saatlik penceresini gizliyordu. Gün varken saniye
  // gürültü olduğu için en küçük birim kaydırılarak düşer.
  const parts: [number, string][] =
    days > 0
      ? [
          [days, units.d],
          [hours, units.h],
          [minutes, units.m],
        ]
      : hours > 0
        ? [
            [hours, units.h],
            [minutes, units.m],
            [seconds, units.s],
          ]
        : [
            [minutes, units.m],
            [seconds, units.s],
          ];

  return (
    <p
      suppressHydrationWarning
      className={className}
      style={{ letterSpacing: "-0.05em" }}
    >
      {parts.map(([value, unit], index) => (
        <span key={unit}>
          {value}
          {/* Opaklık VERME: kapsayıcı `.display-ink` degradesini metne
              kırpıyor, opaklık bu çocuğu ayrı katmana taşıyıp bölgeden
              çıkarıyor ve birim tamamen kayboluyor. Ayrım puntoyla kurulur. */}
          <span className="text-[0.41em] font-semibold tracking-[-0.02em]">
            {" "}
            {unit}
            {index < parts.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </p>
  );
}
