"use client";

import { useEffect } from "react";

/** İki kolonlu pano bu genişlikte başlıyor (Analysis.module.css → `.board`). */
const BOARD_WIDE = "(min-width: 1100px)";

/**
 * Pano satırında kısa kalan kartı YEDEK SATIRLARLA doldurur (31 Ekim).
 *
 * NEDEN: 1100 ve üstünde sektör kartı ile yoğunlaşma kartı aynı ızgara
 * satırında; satır ikisini aynı boya geriyor ve kısa olanın dibinde
 * künyeyle içerik arasında boşluk kalıyordu (sahibinin itirazı: "sağ
 * kolonun dibi boş"). Kuralı `components/today/FillColumn.tsx`in aynısı:
 * boşluk esnetilmez, DOLDURULUR. Sunucu yedek satırları `hidden` +
 * `data-fill` ile basar; burası kartın boşluğunu ölçüp sığanı açar.
 *
 * ÖLÇÜ: kart (`[data-fill-host]`) ızgara satırı kadar uzun; künye
 * (`.notes`, son çocuk) `margin-top: auto` ile dipte. Boşluk = künyenin
 * tepesi − gövdenin (künyeden önceki kardeş) dibi. Ölçüm her seferinde
 * taban durumdan: önce bütün yedekler kapanır, sonra sırayla açılıp
 * sığmayan geri kapanır (tek kare, titreme yok).
 *
 * GÖZLEMCİ KARTLARI İZLER, PANOYU DEĞİL: pano kutusu satırın en uzun
 * kartına kilitli; akışla büyüyen kardeş kartı yalnız kendi kutusu
 * söyler (FillColumn'daki dersin aynısı). Dar ekranda tek kolon, yedekler
 * kapalı; JS kapalıyken taban liste kalır.
 */
export function PanelFill() {
  useEffect(() => {
    const wide = window.matchMedia(BOARD_WIDE);
    let frame = 0;

    const apply = () => {
      for (const host of document.querySelectorAll<HTMLElement>("[data-fill-host]")) {
        const extras = [...host.querySelectorAll<HTMLElement>("[data-fill]")];
        for (const row of extras) row.hidden = true;
        if (!wide.matches || extras.length === 0) continue;
        const notes = host.lastElementChild;
        const body = notes?.previousElementSibling;
        if (!notes || !body) continue;
        let slack = notes.getBoundingClientRect().top - body.getBoundingClientRect().bottom;
        for (const row of extras) {
          if (slack <= 0) break;
          row.hidden = false;
          const height = row.getBoundingClientRect().height;
          if (height <= 0 || height > slack) {
            row.hidden = true;
            break;
          }
          slack -= height;
        }
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const observer = new ResizeObserver(schedule);
    for (const host of document.querySelectorAll("[data-fill-host]")) {
      const board = host.parentElement;
      if (!board) continue;
      for (const panel of board.children) observer.observe(panel);
    }
    wide.addEventListener("change", schedule);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wide.removeEventListener("change", schedule);
    };
  }, []);

  return null;
}
