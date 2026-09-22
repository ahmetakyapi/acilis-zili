"use client";

import { useEffect } from "react";

/** Tam genişlik satırı, kazanç bu kadar küçükse bırakılmıyor (titreşmesin). */
const PREFER_FULL_PX = 24;
const PLACEMENTS = ["full", "map", "reading"] as const;
type Placement = (typeof PLACEMENTS)[number];

/**
 * "Seviyelerin Dayanağı" notlarının yerini VERİYE GÖRE seçer.
 *
 * Teknik detayda iki kolon var: solda fiyat haritası, sağda değerlendirme
 * ve senaryolar. İkisinin boyu sembolün seviye sayısına ve yazılan metnin
 * uzunluğuna bağlı; hiçbir sabit yerleşim her sembolde dengeli değil
 * (ölçüldü, 23 Eylül, altı sembol): 1440'ta notlar tam genişlikte en iyisi
 * (kolon farkı -175…+99), 1024'te ise sağ kolon daralıp uzuyor ve aynı
 * yerleşim haritanın altında 300 piksele varan boş zemin bırakıyordu.
 *
 * Eskiden fark senaryo kartlarının İÇİNE gerilerek kapatılıyordu — kartlar
 * içerikten 216 piksel uzundu. Boşluk esnetilmez, doldurulur (CLAUDE.md):
 * notlar paneli üç yerden birine konabiliyor — iki kolonun altında tam
 * genişlik, haritanın altında ya da değerlendirmenin altında — ve burası
 * üçünü de deneyip iki kolonun dibini en yakın hizaya getireni seçiyor.
 * Ölçü kolonların kutusu değil içeriğin dibi (`align-items:start` ile
 * ikisi aynı şey).
 *
 * JavaScript kapalıyken sunucunun yerleşimi (tam genişlik) kalır; hiçbir
 * şey gizlenmez. Tek kolonlu düzende (dar ekran) çalışmaz. Yalnızca
 * GENİŞLİK değişince yeniden ölçer: yerleşimi denemek ızgaranın boyunu
 * değiştiriyor ve boya bakan bir gözlemci kendi kendini tetiklerdi.
 */
export function BalanceNotes() {
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>("[data-balance-grid]");
    const map = grid?.querySelector<HTMLElement>('[data-balance="map"]');
    const reading = grid?.querySelector<HTMLElement>('[data-balance="reading"]');
    const notes = grid?.querySelector<HTMLElement>('[data-balance="notes"]');
    if (!grid || !map || !reading || !notes) return;

    const dead = (placement: Placement) => {
      grid.dataset.notes = placement;
      const left = (placement === "map" ? notes : map).getBoundingClientRect().bottom;
      const right = (placement === "reading" ? notes : reading).getBoundingClientRect().bottom;
      return Math.abs(left - right);
    };

    const balance = () => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      if (columns < 2) {
        grid.dataset.notes = "full";
        return;
      }
      const scores = PLACEMENTS.map((placement) => ({ placement, gap: dead(placement) }));
      const full = scores[0];
      const best = scores.reduce((a, b) => (b.gap < a.gap ? b : a));
      grid.dataset.notes = best.gap + PREFER_FULL_PX < full.gap ? best.placement : "full";
    };

    let frame = 0;
    let width = grid.getBoundingClientRect().width;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(balance);
    };
    const observer = new ResizeObserver(() => {
      const next = grid.getBoundingClientRect().width;
      if (Math.abs(next - width) < 1) return;
      width = next;
      schedule();
    });

    balance();
    observer.observe(grid);
    /* Yazı tipi gelince satırlar yeniden kırılıyor; bir kez daha ölç. */
    document.fonts?.ready.then(schedule).catch(() => undefined);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
