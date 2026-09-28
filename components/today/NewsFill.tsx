"use client";

import { useEffect } from "react";

/* Dar ekranda manşet kartı listenin üstünde, yanında boşluk yok. */
const WIDE_QUERY = "(min-width: 1024px)";
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
 * SIĞMAYAN GERİ KAPANIYOR. Hedef manşetin DOĞAL dibi: son açılan satır
 * onu geçerse kapanıyor.
 *
 * 28 EYLÜL: manşet ve liste artık iki bağımsız sütun (gerekçe TopNews).
 * Manşet eskiden ızgarada satırları kapsıyordu ve bu bileşen kapsamı
 * (`row-span`) açılan satır sayısına eşitliyordu; sütunlar ayrılınca o
 * hesap düştü, yalnızca listenin dibi ile manşetin dibi karşılaştırılıyor.
 *
 * Satırlar listenin SONUNA ekleniyor, yani görünür hiçbir şey kaymıyor;
 * açılan satırlar zaten boş olan alana iniyor. JavaScript kapalıyken ve
 * dar ekranda taban liste kalıyor.
 */
export function NewsFill() {
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>("[data-news-grid]");
    const lead = grid?.querySelector<HTMLElement>("[data-news-lead]");
    const list = grid?.querySelector<HTMLElement>("[data-news-list]");
    if (!grid || !lead || !list) return;
    const wide = window.matchMedia(WIDE_QUERY);
    let frame = 0;

    const apply = () => {
      const extras = [...list.querySelectorAll<HTMLElement>("[data-news-fill]")];
      // Baştan kur: genişlik değişince sığan satır sayısı da değişiyor.
      extras.forEach((row) => (row.hidden = true));
      if (!wide.matches || extras.length === 0) return;

      /* DÜZEN ÖLÇÜSÜ, BOYANMIŞ KUTU DEĞİL. Manşet ve satırlar giriş
         hareketiyle geliyor (`data-motion-reveal`, stagger) ve ekranın
         altındayken başlangıç pozunda, yani kaydırılmış duruyorlar;
         `getBoundingClientRect` o kaymayı da ölçerdi. `offsetTop` dönüşümü
         saymıyor. İkisinin de ofset atası ızgara (`position:relative`). */
      const bottom = (element: HTMLElement) => element.offsetTop + element.offsetHeight;
      const leadBottom = bottom(lead);
      for (const row of extras) {
        row.hidden = false;
        if (bottom(row) > leadBottom + OVERSHOOT_PX) {
          row.hidden = true;
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
