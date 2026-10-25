"use client";

import { useEffect } from "react";

/**
 * Hedefi telefonda KATLI bir `FoldToggle`ın içindeyse katlamayı aç; açtıysa
 * hedefi döndür. FoldToggle'ın kökü gizli onay kutusunu DOĞRUDAN çocuk
 * olarak taşıyor: hedeften yukarı yürüyüp o kutuyu taşıyan ilk kabı bul.
 */
function openFoldOf(hash: string): HTMLElement | null {
  if (!hash || hash === "#") return null;
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
  if (!target || !target.closest("[data-fold]")) return null;
  let opened = false;
  for (let node = target.parentElement; node; node = node.parentElement) {
    const box = node.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]');
    if (box && !box.checked) {
      box.checked = true;
      opened = true;
    }
  }
  return opened ? target : null;
}

/**
 * ÇAPA KATLI LİSTEYE GİDİYOR (25 Ekim, telefon kartı). Kartlardaki kaynak
 * numaraları ve "N Kaynak" bağlantısı kaynak listesine gidiyor; o liste
 * telefonda katlı (sayfa boyu). Katlı hedefe gezinmede tarayıcı görünür
 * bir yer bulamıyor ve bağlantı hiçbir şey yapmıyor gibi duruyor.
 *
 * Tıklamada katlama tarayıcının çapa gezinmesinden ÖNCE açılıyor; gezinmeyi
 * tarayıcı yapıyor (sığ adres güncellemesi yok). Dışarıdan çapayla gelen
 * okur için ilk açılışta aynı iş. `RevealHashTarget` (yenilikler) aynı
 * fikrin `<details>` hâli; FoldToggle onay kutusuyla çalıştığı için ayrı.
 */
export function RevealFoldAnchor() {
  useEffect(() => {
    const target = openFoldOf(window.location.hash);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      if (link) openFoldOf(link.getAttribute("href") ?? "");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
