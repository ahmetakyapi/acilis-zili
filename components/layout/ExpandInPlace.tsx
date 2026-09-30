"use client";

import { useEffect } from "react";

/**
 * AÇILAN İÇERİK OLDUĞUN YERDE UZAR (30 Eylül).
 *
 * Ana sayfadaki bülten kartında "Tümünü Gör"e basan okuyucu metnin dibine
 * fırlatılıyordu (sahibinin bildirimi, telefonda). Sebep kaydırma
 * çapalaması (scroll anchoring): tarayıcı ekrandaki bir öğeyi "çapa" seçip
 * içerik değiştiğinde onu yerinde tutmak için sayfayı kaydırıyor. Katlama
 * açılınca düğme metnin SONUNA taşınıyor (kapatma yolu orada, gerekçe
 * `BriefBody.module.css`); çapa o düğme seçilmişse sayfa da onunla birlikte
 * aşağı iniyor ve açılan metnin tamamı ekranın üstünde kalıyor.
 *
 * Chrome bunu yapmıyor: çapanın `position` değeri değişince düzeltmeyi
 * askıya alıyor (ölçüldü, başsız Chromium'da sıçrama yok). Safari 27 ise
 * çapalamayı bu sürümde ilk kez getirdi ve düğmeyi izliyor. Tarayıcıların
 * çapa seçimi birbirini tutmadığı için CSS'te tek tek öğe dışlamak yetmiyor:
 * düğme dışlanınca çapa onun ALTINDAKİ bir öğeye düşebiliyor ve o da açılan
 * içerikle birlikte aşağı itiliyor — aynı sıçrama.
 *
 * Kural bu yüzden etkileşim düzeyinde: bir aç/kapa denetimine basıldığı an
 * çapalama belge genelinde kısa süre kapanıyor, içerik bastığın yerden
 * aşağı doğru uzuyor, sonra çapalama geri geliyor (akışla inen paneller
 * yine yerinde tutulsun diye). Süre `details` açılış geçişinin (280 ms,
 * globals.css) üstünde.
 *
 * Denetim sayılanlar: `summary`, `aria-expanded` taşıyan düğmeler ve bir
 * onay kutusuna bağlı `label` (JS'siz katlamalar, `FoldToggle`). JavaScript
 * gelmeden de katlamalar çalışıyor; bu yalnızca üstüne bir güvence.
 */
const HOLD_MS = 450;
const TOGGLES = "summary, [aria-expanded], label[for]";

export function ExpandInPlace() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: number | undefined;

    const release = () => {
      root.style.removeProperty("overflow-anchor");
      document.body.style.removeProperty("overflow-anchor");
    };

    const onClick = (event: MouseEvent) => {
      const control = event.target instanceof Element ? event.target.closest(TOGGLES) : null;
      if (!control) return;
      if (control instanceof HTMLLabelElement) {
        const input = control.control;
        if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
      }
      /* Kök VE gövde: tarayıcılar görünüm alanının değerini ikisinden
         birinden okuyor; ikisine birden yazmak her uygulamada kapatıyor. */
      root.style.setProperty("overflow-anchor", "none");
      document.body.style.setProperty("overflow-anchor", "none");
      window.clearTimeout(timer);
      timer = window.setTimeout(release, HOLD_MS);
    };

    /* Yakalama evresi: `summary`nin varsayılan eylemi (aç/kapa) tıklama
       olayından SONRA işliyor; çapalama o değişiklikten önce kapanmış olur. */
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
      release();
    };
  }, []);

  return null;
}
