"use client";

import { useSyncExternalStore } from "react";

/**
 * Geri sayım — gazetenin plaka rakamı (HANDOFF §4).
 *
 * Büyük sayı `.plate-num` ile basılır: düz mürekkep artı tek camgöbeği
 * hayaleti. Koyu zeminde magenta ve sarı plakalar kapalıdır — okunmuyordu.
 *
 * Birim rakamla birlikte değişir: bir saatin altında dakika, üstünde saat.
 * Sunucuda "—" basılır, hydration uyuşmazlığı olmaz.
 */

export type CountdownLabels = {
  /** "Dakika" */
  minutes: string;
  /** "Saat" */
  hours: string;
  /** "Gün" */
  days: string;
  /** "Zil çalana kadar" ya da "Kapanışa kadar" */
  phrase: string;
};

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 20000);
  return () => window.clearInterval(id);
}

function remaining(targetMs: number): { value: number; unit: keyof CountdownLabels } {
  const totalMinutes = Math.max(0, Math.round((targetMs - Date.now()) / 60000));
  if (totalMinutes >= 1440) {
    return { value: Math.floor(totalMinutes / 1440), unit: "days" };
  }
  if (totalMinutes >= 60) {
    return { value: Math.floor(totalMinutes / 60), unit: "hours" };
  }
  return { value: totalMinutes, unit: "minutes" };
}

export function Countdown({
  target,
  labels,
}: {
  target: Date | string;
  labels: CountdownLabels;
}) {
  const targetMs =
    typeof target === "string" ? new Date(target).getTime() : target.getTime();

  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const { value, unit } = remaining(targetMs);
      return `${value}|${unit}`;
    },
    () => "",
  );

  if (!snapshot) {
    // Sunucu basımı: rakam istemcide dolar, yer tutucu boşluk bırakmaz.
    return (
      <div className="flex items-start gap-5">
        <span className="plate-num text-[64px] leading-[0.92] sm:text-[96px]">
          —
        </span>
      </div>
    );
  }

  const [rawValue, unit] = snapshot.split("|");

  return (
    <div className="flex items-start gap-4 sm:gap-5">
      <span
        className="plate-num text-[64px] leading-[0.92] sm:text-[96px]"
        data-num={rawValue}
      >
        {rawValue}
      </span>
      <div className="pt-1.5 sm:pt-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-dim">
          {labels[unit as keyof CountdownLabels]}
        </p>
        <p className="mt-1 max-w-[9ch] text-[17px] font-semibold leading-[1.25] text-ink sm:text-[20px]">
          {labels.phrase}
        </p>
      </div>
    </div>
  );
}
