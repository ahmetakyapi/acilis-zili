import { useEffect, useState } from "react";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { fill } from "./puzzle-format";

/* Sonraki bulmacanın geri sayımı — oyunun sonuç bloğu (`PuzzleCover`) ve
   ana sayfa girişi (`PuzzleTeaser`) aynı saati okur. Sunucu çiziminde
   `null` (saat istemcide); yer tutan öğe boş kalır, kayma yok. */

export const DAY_MS = 86_400_000;

export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, []);
  return now;
}

export function countdownText(left: number, labels: StockPuzzleLabels): string {
  const total = Math.floor(Math.max(0, left) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return fill(labels.countdown, {
    h: pad(Math.floor(total / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  });
}
