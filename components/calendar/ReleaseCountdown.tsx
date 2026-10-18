"use client";

import { useEffect, useState } from "react";
import styles from "@/components/calendar/CalendarExperience.module.css";

type Units = { d: string; h: string; m: string; s: string };

/**
 * Kapak kartındaki geri sayım — "10 gün 04 sa 12 dk".
 *
 * Ana sayfanın `Countdown`ı (components/today) zilin sahnesine bağlı: dev
 * rakam, yuvarlanan hane, sıfırda zil olayı. Burada kartın içinde bir
 * KÜNYE satırı var; o bileşeni küçültmek zil olayını takvime taşırdı
 * (CLAUDE.md: zil animasyonu için ikinci bileşen açılmaz — bu bir zil değil,
 * düz bir okuma).
 *
 * Bir günden uzakta saniye yok: kart sayfanın en üstünde ve on gün sonraki
 * bir karar için saniyede bir değişen rakam bilgi değil gürültü — göz
 * listeden sürekli oraya çekilir. Bir günün altına inince saniye açılıyor
 * ve tik saniyede bir; öncesinde dakika sınırında. Gizli sekmede durur.
 *
 * Sıfırda "Sonuç Bekleniyor": saatin geçmesi yayın kanıtı DEĞİL (veri
 * dürüstlüğü; sayfadaki satır da aynı ifadeyi kullanıyor).
 *
 * Saatsiz olayda bu bileşen hiç çizilmez — dakika bilinmiyorsa geri sayım
 * uydurma kesinlik olurdu.
 */
export function ReleaseCountdown({
  targetIso,
  initialNowMs,
  units,
  dueLabel,
}: {
  targetIso: string;
  /** Sunucunun `now`u: hidratasyonda aynı metin. */
  initialNowMs: number;
  units: Units;
  dueLabel: string;
}) {
  const targetMs = new Date(targetIso).getTime();
  const [nowMs, setNowMs] = useState(initialNowMs);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      const now = Date.now();
      setNowMs(now);
      const left = targetMs - now;
      if (left <= 0) return;
      const step = left < 86_400_000 ? 1000 - (now % 1000) : 60_000 - (now % 60_000);
      timer = window.setTimeout(tick, step + 15);
    };
    timer = window.setTimeout(tick, 0);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [targetMs]);

  const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  if (total === 0) {
    return <span className={styles.countDue}>{dueLabel}</span>;
  }
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: [number, string][] =
    days > 0
      ? [[days, units.d], [hours, units.h], [minutes, units.m]]
      : [[hours, units.h], [minutes, units.m], [seconds, units.s]];

  return (
    <span className={styles.count}>
      {parts.map(([value, unit], index) => (
        <span key={unit} className={styles.countPart}>
          <strong className="numeral">{index === 0 ? value : String(value).padStart(2, "0")}</strong>
          <span>{unit}</span>
        </span>
      ))}
    </span>
  );
}
