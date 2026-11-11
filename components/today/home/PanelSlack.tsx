"use client";

import { useEffect, useRef } from "react";

/** Tabletin çift panel bandı (TodayExperience.module.css → "ÇİFTLER AYNI
    HATTA BİTER"); ≥1280'de kolonları `FillColumn` dengeliyor. */
const PAIR_BAND = "(min-width: 768px) and (max-width: 1279px)";

/**
 * Çift paneldeki boş payı panelin kendisine söyler (11 Kasım, tablet
 * denetimi): `--slack` = panelin boyu − çocuklarının doğal boyları.
 *
 * NEDEN: tablette çiftler satırın boyuna geriliyor (sahibinin kuralı: yan
 * yana kartlar aynı hatta biter) ve kısa panelin içinde ölü pay kalıyordu
 * — Tahvil, Makro'ya gerilince 1024'te 38–50, 768'de 17–29 piksel. Kolon
 * doldurucusu (`FillColumn`) yalnız ≥1280'de çalışıyor ve bu panelin
 * açılacak yedek satırı yok; boşluk esnetilmez, DOLDURULUR: payı panelin
 * kendi çizimi alır (Tahvil'de eğri minyatürünün yüksekliği,
 * PanelPair.module.css). JS yokken taban: pay panelin dibinde kalır.
 *
 * ÖLÇÜ HER SEFERİNDE SIFIRDAN: önce `--slack: 0`, sonra ölç. Pay eklenmiş
 * hâliyle ölçülse panel kendi doğal boyundan uzun sanılır ve satır bir kez
 * uzayınca geri kısalmazdı. Gözlemci paneli izler: çiftin öteki paneli
 * akışla geç gelip satırı uzattığında bu panel de uzar ve yeniden ölçülür.
 * Yalnız tablet bandında; başka genişlikte değişken sıfır.
 */
export function PanelSlack() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const panel = ref.current?.parentElement;
    if (!panel) return;
    const band = window.matchMedia(PAIR_BAND);
    let frame = 0;
    const measure = () => {
      panel.style.setProperty("--slack", "0px");
      if (!band.matches) return;
      const style = getComputedStyle(panel);
      let used =
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth) +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom);
      for (const child of panel.children) used += child.getBoundingClientRect().height;
      const free = Math.max(0, Math.floor(panel.getBoundingClientRect().height - used));
      panel.style.setProperty("--slack", `${free}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    band.addEventListener("change", schedule);
    schedule();
    return () => {
      observer.disconnect();
      band.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      panel.style.removeProperty("--slack");
    };
  }, []);
  return <span ref={ref} hidden />;
}
