"use client";

import { useSyncExternalStore } from "react";

/**
 * New York + İstanbul duvar saati — dakika hassasiyeti.
 * 15 sn'de bir kontrol edilir; değer ancak dakika değişince yenilenir.
 * Sunucuda "--:--" basılır, hydration uyuşmazlığı olmaz.
 */

const NY_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const IST_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function subscribeClock(onTick: () => void) {
  const id = window.setInterval(onTick, 15000);
  return () => window.clearInterval(id);
}

export function useDualClock(): { ny: string; ist: string } {
  const stamp = useSyncExternalStore(
    subscribeClock,
    () => `${NY_CLOCK.format(new Date())}|${IST_CLOCK.format(new Date())}`,
    () => "--:--|--:--",
  );
  const [ny, ist] = stamp.split("|");
  return { ny, ist };
}
