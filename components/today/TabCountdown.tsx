"use client";

import { useEffect } from "react";
import { durationOf, type BellText } from "@/components/figures/session-bell/model";

/**
 * SEKME BAŞLIĞINDA GERİ SAYIM — yalnızca sekme GİZLİYKEN (14 Ekim).
 *
 * Ana sayfanın tek sorusu "zile ne kadar var" ve okuyucu çoğu zaman sekmeyi
 * açık bırakıp başka bir sekmede bekliyor: aracı kurumun ekranı, haber,
 * iş. Dönüp bakmadan bilmenin tek yeri sekme başlığı. Sekme arka plana
 * geçince başlık "Açılışa 12 dk · Açılış Zili" olur, dakika döndükçe
 * yenilenir; zil çaldığında "Açılış Zili Çaldı" der. Okuyucu geri dönünce
 * sayfanın kendi başlığı aynen geri gelir.
 *
 * NEDEN YALNIZCA GİZLİYKEN: görünür sekmede sayaç zaten ekranın ortasında;
 * başlığı orada da değiştirmek, arama motorunun ve paylaşım önizlemesinin
 * okuduğu başlığa dokunmak demek olurdu. Sayfayı tarayan botlar ve önizleme
 * araçları sekmeyi hiç gizlemiyor; başlığı hep asıl hâliyle görüyorlar.
 *
 * DAKİKADA BİR, SANİYEDE DEĞİL: süre `durationOf` ile yazılıyor (Seans
 * Zili'nin biçimi, saniyesiz; birimler sekmede açık yazılır — "1 Saat 28
 * Dakika", `today.tabUnits`, 17 Ekim); zamanlayıcı yalnızca yazılan
 * dakika değişince uyanıyor. Arka plan sekmesinde tarayıcılar
 * zamanlayıcıları zaten dakikada bire kadar kısıyor; daha sık yazmanın
 * karşılığı yok. Hiçbir şey çizmez.
 */
export function TabCountdown({
  targetIso,
  phrase,
  rang,
  units,
  brand,
}: {
  targetIso: string;
  /** "Açılışa {d}" / "Kapanışa {d}" — Seans Zili'nin kalıbı. */
  phrase: string;
  /** Hedef geçtiğinde: "Açılış Zili Çaldı". */
  rang: string;
  units: BellText["units"];
  brand: string;
}) {
  const { day, hour, minute } = units;

  useEffect(() => {
    const targetMs = new Date(targetIso).getTime();
    if (!Number.isFinite(targetMs)) return;

    let saved: string | null = null;
    let written = "";
    let timer = 0;

    const write = () => {
      window.clearTimeout(timer);
      const left = targetMs - Date.now();
      document.title =
        left > 0
          ? `${phrase.replace("{d}", durationOf(left, { day, hour, minute }))} · ${brand}`
          : `${rang} · ${brand}`;
      // Geri okunuyor: `document.title` boşlukları sadeleştirerek döndürür.
      written = document.title;
      /* Bir sonraki yazım, görünen dakikanın değiştiği an: `durationOf`
         yukarı yuvarlıyor, yani kalan süre 60 saniyenin katına indiğinde. */
      if (left > 0) timer = window.setTimeout(write, (left % 60_000 || 60_000) + 50);
    };

    /* ARKA PLANDA AÇILAN SEKME (14 Ekim, ölçüldü). Sayfa gizli sekmede
       açılınca sayaç başlığa yazılıyor, ama hemen ardından Next'in akan
       künyesi `<title>`ı sayfanın kendi başlığına geri yazıyordu (iki dilde
       de: "" → başlık → sayaç → başlık); sayaç ancak bir sonraki dakikada
       görünüyordu. Gizliyken başlığı BİZDEN SONRA değiştiren olursa yeni
       hâli asıl başlık sayılıyor (dönüşte o geri gelir) ve sayaç hemen geri
       yazılıyor. Kendi yazımımız `written`a eşit, döngü yok. */
    const observer = new MutationObserver(() => {
      if (saved === null || document.title === written) return;
      saved = document.title;
      write();
    });

    const onVisibility = () => {
      if (document.hidden) {
        saved ??= document.title;
        write();
        observer.observe(document.head, { subtree: true, childList: true, characterData: true });
      } else {
        window.clearTimeout(timer);
        observer.disconnect();
        if (saved !== null) document.title = saved;
        saved = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (document.hidden) onVisibility();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (saved !== null) document.title = saved;
    };
  }, [targetIso, phrase, rang, day, hour, minute, brand]);

  return null;
}
