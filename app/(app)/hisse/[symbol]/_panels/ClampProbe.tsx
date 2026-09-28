"use client";

import { useEffect, useRef } from "react";

/**
 * Kesilmiş sütunun ölçücüsü (28 Eylül). İçeriden işlemler tablosu geniş
 * ekranda sol sütunun boyunda kesiliyor ve altında "Tümünü Gör" duruyor
 * (gerekçe depth.module.css → `.clampBox`). Sunucu tablonun o boya sığıp
 * sığmadığını bilemiyor: işlemi az olan bir hissede solma ve düğme boşa
 * çıkardı. Bu bileşen kutuyu ölçüp sığıyorsa kabına `data-fits` yazıyor;
 * JavaScript'siz okuyucuda düğme yine görünür ve çalışır.
 *
 * Açıkken ölçmüyor: açılmış kutu her zaman "sığar" ve "Daha Az" kaybolurdu.
 */
export function ClampProbe() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    const box = host?.querySelector<HTMLElement>("[data-clamp-box]");
    const input = host?.querySelector<HTMLInputElement>("input[type=checkbox][data-clamp-input]");
    if (!host || !box || !input) return;
    const measure = () => {
      if (input.checked) return;
      const fits = box.scrollHeight <= box.clientHeight + 1;
      host.toggleAttribute("data-fits", fits);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(host);
    input.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      input.removeEventListener("change", measure);
    };
  }, []);
  return <span ref={ref} hidden />;
}
