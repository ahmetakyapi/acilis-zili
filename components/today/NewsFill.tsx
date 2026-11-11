"use client";

import { useEffect } from "react";

/* Dar ekranda manşet kartı listenin üstünde, yanında boşluk yok. */
const WIDE_QUERY = "(min-width: 1024px)";
/** Son satırın manşet kartının dibini aşabileceği pay (kıl çizgi, yuvarlama). */
const OVERSHOOT_PX = 2;
/** Fotoğraf çerçevesinin doğal (16:9) boyundan en çok ne kadar kısalıp
 *  uzayabileceği. Fark en çok yarım satır (~40 px) olduğu için 1440'ta
 *  ~380 piksellik çerçevede sınıra pratikte varılmıyor; sınır, taban liste
 *  manşetten çok uzun kaldığı günde görselin şerit gibi uzamasını ya da
 *  kibrit kutusuna dönmesini engelliyor. */
const PHOTO_SHRINK = 0.2;
const PHOTO_GROW = 0.25;

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
 *
 * 11 KASIM: İKİ SÜTUN AYNI HATTA (gerekçe TopNews.tsx). Satır doldurma
 * boşluğu bir satır boyunun altına indiriyor ama kapatamıyordu (1440'ta 59,
 * 1024'te 77 piksel basamak). Kalanı:
 *   - fotoğraflı manşette görselin çerçevesi alıyor: bir yedek daha açmak
 *     (manşet uzar) ile açmamak (manşet kısalır) arasından farkı küçük
 *     olan seçiliyor, çerçeveye o kadar `height` yazılıyor;
 *   - metin manşetinde kutu CSS ile liste boyuna geriliyor; burası yalnız
 *     liste manşetten kısa kalırsa bir yedek daha açıyor.
 * Manşetin DOĞAL dibi `align-self:start` ile ölçülüyor (ızgara onu satır
 * boyuna geriyor). Görsel düşüp manşet metin düzenine dönerse (CDN,
 * `NewsImage` dalı değişir) DOM gözlemcisi yeniden kuruyor. Bileşen artık
 * yedek olmasa da basılıyor: hizalama yedeğe bağlı değil.
 */
export function NewsFill() {
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>("[data-news-grid]");
    const lead = grid?.querySelector<HTMLElement>("[data-news-lead]");
    const list = grid?.querySelector<HTMLElement>("[data-news-list]");
    if (!grid || !lead || !list) return;
    const wide = window.matchMedia(WIDE_QUERY);
    let frame = 0;
    let photoFrame: HTMLElement | null = null;

    const resetPhoto = () => {
      if (!photoFrame) return;
      photoFrame.style.removeProperty("height");
      photoFrame.style.removeProperty("aspect-ratio");
      photoFrame = null;
    };

    const apply = () => {
      const extras = [...list.querySelectorAll<HTMLElement>("[data-news-fill]")];
      // Baştan kur: genişlik değişince sığan satır sayısı da değişiyor.
      extras.forEach((row) => (row.hidden = true));
      resetPhoto();
      if (!wide.matches) return;

      /* DÜZEN ÖLÇÜSÜ, BOYANMIŞ KUTU DEĞİL. Manşet ve satırlar giriş
         hareketiyle geliyor (`data-motion-reveal`, stagger) ve ekranın
         altındayken başlangıç pozunda, yani kaydırılmış duruyorlar;
         `getBoundingClientRect` o kaymayı da ölçerdi. `offsetTop` dönüşümü
         saymıyor. İkisinin de ofset atası ızgara (`position:relative`). */
      const bottom = (element: HTMLElement) => element.offsetTop + element.offsetHeight;
      const listBottom = () => {
        const rows = [...list.children].filter(
          (row): row is HTMLElement => row instanceof HTMLElement && !row.hidden && row.offsetHeight > 0,
        );
        return rows.length ? bottom(rows[rows.length - 1]) : list.offsetTop;
      };

      // Manşetin doğal boyu: ızgaranın germesi ölçüm süresince kapalı.
      lead.style.alignSelf = "start";
      const leadBottom = bottom(lead);
      let next: HTMLElement | null = null;
      for (const row of extras) {
        row.hidden = false;
        if (bottom(row) > leadBottom + OVERSHOOT_PX) {
          row.hidden = true;
          next = row;
          break;
        }
      }

      const photo = lead.querySelector<HTMLElement>("img.object-cover")?.parentElement ?? null;
      if (photo) {
        const natural = photo.offsetHeight;
        let delta = listBottom() - leadBottom;
        if (next) {
          next.hidden = false;
          const alt = bottom(next) - leadBottom;
          if (Math.abs(alt) < Math.abs(delta) && alt <= natural * PHOTO_GROW) delta = alt;
          else next.hidden = true;
        }
        delta = Math.max(-natural * PHOTO_SHRINK, Math.min(natural * PHOTO_GROW, delta));
        if (Math.abs(delta) >= 1) {
          photoFrame = photo;
          photo.style.aspectRatio = "auto";
          photo.style.height = `${Math.round(natural + delta)}px`;
        }
      } else if (next && listBottom() < leadBottom - OVERSHOOT_PX) {
        /* Metin manşeti kısalamıyor; liste onu geçsin ki kutu (CSS)
           listenin dibine gerilsin. */
        next.hidden = false;
      }
      lead.style.removeProperty("align-self");
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
    /* Görsel inince ya da düşünce (NewsImage dalı değişir) manşetin boyu
       değişiyor. `load`/`error` kabarcıklanmıyor: yakalama evresi. Gözlemci
       yalnız alt ağaç değişimini izliyor, bizim yazdığımız `style`ı değil. */
    lead.addEventListener("load", schedule, true);
    lead.addEventListener("error", schedule, true);
    const observer = new MutationObserver(schedule);
    observer.observe(lead, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      wide.removeEventListener("change", schedule);
      lead.removeEventListener("load", schedule, true);
      lead.removeEventListener("error", schedule, true);
      observer.disconnect();
      resetPhoto();
      lead.style.removeProperty("align-self");
    };
  }, []);
  return null;
}
