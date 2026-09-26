"use client";

import { useEffect } from "react";

/* Dar ekranda manşet kartı listenin üstünde, yanında boşluk yok. */
const WIDE_QUERY = "(min-width: 1024px)";
/** Kartın sunucudaki kapsamı (`lg:row-span-6`). Altına inilmiyor: kart az
 *  sayıda satırı kapsarsa ızgara kartın fazla boyunu o satırlara dağıtıp
 *  satır aralarını açardı. */
const BASE_SPAN = 6;
/** Son satırın manşet kartının dibini aşabileceği pay (kıl çizgi, yuvarlama). */
const OVERSHOOT_PX = 2;

/**
 * Manşet kartının yanını YEDEK SATIRLARLA doldurur (ana sayfa, haber bandı).
 *
 * Bant solda uzun bir manşet kartı, sağda satırlar. Kaynak sınırı listeyi
 * çoğu gün dört habere indiriyor ve kartın yanında üç satır kalıyordu:
 * kart ~500, satırlar ~265 piksel, arada bir kart boyu boşluk. Sunucu
 * yedekleri `hidden` basıyor (page.tsx → TopNews); burası kartın boyuna
 * SIĞAN kadarını açıyor. FillColumn'un kuralıyla aynı: boşluk esnetilmez,
 * doldurulur.
 *
 * SIĞMAYAN GERİ KAPANIYOR. Kart ızgarada satırları kapsıyor (`row-span`);
 * satırlar kartın kendi boyunu geçerse ızgara kartı GERİYOR ve kartın
 * içinde bu kez metnin altında boşluk açılıyordu. Hedef bu yüzden kartın
 * DOĞAL dibi: ölçü, hiçbir yedek açılmadan önce alınıyor.
 *
 * Kartın kapsadığı satır sayısı açılan satır sayısına eşitleniyor; yoksa
 * altıncıdan sonraki satır ızgaranın sol sütununa, kartın altına düşerdi.
 *
 * Satırlar listenin SONUNA ekleniyor, yani görünür hiçbir şey kaymıyor;
 * açılan satırlar zaten boş olan alana iniyor. JavaScript kapalıyken ve
 * dar ekranda taban liste kalıyor.
 */
export function NewsFill() {
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>("[data-news-grid]");
    const lead = grid?.querySelector<HTMLElement>("[data-news-lead]");
    if (!grid || !lead) return;
    const wide = window.matchMedia(WIDE_QUERY);
    let frame = 0;

    const apply = () => {
      const extras = [...grid.querySelectorAll<HTMLElement>("[data-news-fill]")];
      // Baştan kur: genişlik değişince sığan satır sayısı da değişiyor.
      extras.forEach((row) => (row.hidden = true));
      lead.style.gridRow = "";
      if (!wide.matches || extras.length === 0) return;

      const rows = () => [...grid.children].filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== lead && !el.hidden,
      );
      const leadBottom = lead.getBoundingClientRect().bottom;
      for (const row of extras) {
        row.hidden = false;
        lead.style.gridRow = `span ${Math.max(BASE_SPAN, rows().length)}`;
        if (row.getBoundingClientRect().bottom > leadBottom + OVERSHOOT_PX) {
          row.hidden = true;
          lead.style.gridRow = `span ${Math.max(BASE_SPAN, rows().length)}`;
          break;
        }
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    schedule();
    // Yazı tipi gelince satır boyları değişiyor.
    void document.fonts?.ready.then(schedule);
    window.addEventListener("resize", schedule);
    wide.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      wide.removeEventListener("change", schedule);
    };
  }, []);
  return null;
}
