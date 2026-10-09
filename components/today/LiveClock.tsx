"use client";

import { useDualClock } from "@/components/layout/useDualClock";
import { formatInZone } from "@/lib/session-clock";
import type { Locale } from "@/lib/i18n/config";
import { TickingFigure } from "@/components/ui/TickingFigure";
import styles from "./LiveClock.module.css";

/** The reader's current wall clock leads (TR in Turkish, NY in English).
 * The small dial shows that same time; the secondary market clock stays
 * quiet. The former five inline nodes made zone labels look detached;
 * each time still owns its adjacent zone, now on separate reading lines.
 * The server timestamp avoids an empty clock before hydration. */
export function LiveClock({ locale, initialNowMs }: { locale: Locale; initialNowMs: number }) {
  const clock = useDualClock();
  const ist = clock.ist === "--:--" ? formatInZone(new Date(initialNowMs), "Europe/Istanbul") : clock.ist;
  const ny = clock.ny === "--:--" ? formatInZone(new Date(initialNowMs), "America/New_York") : clock.ny;
  const [first, second] = locale === "tr"
    ? [{ time: ist, tag: "TR" }, { time: ny, tag: "NY" }]
    : [{ time: ny, tag: "NY" }, { time: ist, tag: "TR" }];
  const [hours, minutes] = first.time.split(":").map(Number);
  /* KADRAN SÜPÜRÜYOR (9 Ekim): ibreler dakika değişiminde atlamıyor,
     yeni yerine dönüyor (CSS geçişi). Açı günün başından birikiyor ki
     59 → 00 ibreyi geriye çevirmesin; gece yarısı tek sıçrama — o an
     geçiş kapalı (`data-wrap`), ibre 24 tur geriye dönmesin. */
  const dayMinutes = hours * 60 + minutes;

  return (
    <div className={styles.clock}>
      <svg className={styles.dial} viewBox="0 0 40 40" aria-hidden="true" data-wrap={dayMinutes === 0 || undefined}>
        <circle cx="20" cy="20" r="18" />
        <path className={styles.ticks} d="M20 4v3M36 20h-3M20 36v-3M4 20h3" />
        <path className={styles.hour} d="M20 21V11" style={{ transform: `rotate(${dayMinutes / 2}deg)` }} />
        <path className={styles.minute} d="M20 23V7" style={{ transform: `rotate(${dayMinutes * 6}deg)` }} />
        <circle className={styles.pivot} cx="20" cy="20" r="1.6" />
      </svg>
      <div className={styles.readings}>
        {/* Dakika değişince değişen rakam yukarı dönüyor (ui/TickingFigure)
            — geri sayımın saniyeleriyle aynı dil. Yön hep "yukarı": saat
            geri gitmez, 23:59 → 00:00 da ileri. */}
        <span className={styles.primary}><time><TickingFigure value={first.time} direction="up" /></time><span>{first.tag}</span></span>
        <span className={styles.secondary}><time>{second.time}</time><span>{second.tag}</span></span>
      </div>
    </div>
  );
}
