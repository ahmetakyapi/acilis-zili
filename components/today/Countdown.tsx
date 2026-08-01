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

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { days, hours, minutes, seconds } = split(targetMs, nowMs);

  // En anlamlı iki birim gösterilir: gün varken saniye gürültüdür.
  const parts: [number, string][] =
    days > 0
      ? [
          [days, units.d],
          [hours, units.h],
        ]
      : hours > 0
        ? [
            [hours, units.h],
            [minutes, units.m],
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
          <span className="text-[0.41em] font-semibold tracking-[-0.02em] opacity-70">
            {" "}
            {unit}
            {index === 0 ? " " : ""}
          </span>
        </span>
      ))}
    </p>
  );
}
