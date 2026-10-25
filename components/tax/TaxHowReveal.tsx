"use client";

import { useEffect } from "react";

/** Çapa "Nasıl Hesaplanır" paneline (ya da içine) gidiyorsa katlamayı aç. */
function openFor(hash: string, inputId: string): HTMLElement | null {
  if (!hash || hash === "#") return null;
  const input = document.getElementById(inputId);
  if (!(input instanceof HTMLInputElement) || input.checked) return null;
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
  /* Anlatımın paneli: kutunun içinde durduğu `#nasil`. */
  const panel = input.closest("#nasil");
  if (!target || !panel?.contains(target)) return null;
  input.checked = true;
  return target;
}

/**
 * KATLI ANLATIMA GİDEN ÇAPA KATLAMAYI AÇAR (25 Ekim).
 *
 * "Nasıl Hesaplanır" hesaplayıcının altına indi ve ilk iki adımla katlı
 * geliyor (gerekçe `TaxHow.tsx`). Panele çapayla gelen okuyucu (`#nasil`,
 * hesaplayıcının boş sonucundaki "Nasıl Hesaplanır" bağlantısı) anlatımın
 * TAMAMINI okumak istiyor; iki adımda kesilmiş bir panele inmesin.
 *
 * Kalıp /yenilikler'deki `RevealHashTarget`in aynısı: tıklamada katlama,
 * tarayıcının varsayılan çapa gezinmesinden ÖNCE açılıyor; gezinmeyi
 * tarayıcı yapıyor (sığ adres güncellemesi yok). Dışarıdan `/vergi#nasil`
 * ile gelen için ilk açılışta aynı iş, kaydırma elle. Fark: oradaki katlama
 * `<details>`, buradaki sitenin JS'siz onay kutusu (`FoldToggle`), o yüzden
 * açmak kutuyu işaretlemek. JS kapalıyken anahtar elle açılıyor.
 */
export function TaxHowReveal({ inputId }: { inputId: string }) {
  useEffect(() => {
    const target = openFor(window.location.hash, inputId);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      if (link) openFor(link.getAttribute("href") ?? "", inputId);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [inputId]);
  return null;
}
