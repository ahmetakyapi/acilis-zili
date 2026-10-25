"use client";

import { useEffect } from "react";

/**
 * Hedef KATLI bir yerdeyse aç; açtıysa hedefi döndür. İki katlama türü var:
 * `FoldToggle` (kökü gizli onay kutusunu DOĞRUDAN çocuk olarak taşıyor;
 * hedeften yukarı yürüyüp o kutuyu taşıyan kabı bul) ve kompakt turun katlı
 * satırları (`BrokerFold`, yerli `<details>`; hedefin kendisi ya da
 * atalarından biri). Chrome çapa gezinmesinde kapalı `details`i kendisi de
 * açıyor; her tarayıcı açmadığı için burada da açılıyor.
 */
function openFoldOf(hash: string): HTMLElement | null {
  if (!hash || hash === "#") return null;
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
  if (!target || !target.closest("[data-fold], details")) return null;
  let opened = false;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement && !node.open) {
      node.open = true;
      opened = true;
    }
    if (node === target) continue;
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
    /* Aynı belgede yalnız çapa değişirse (adres çubuğu, geri tuşu) sayfa
       yeniden yüklenmiyor; katlama da açılsın. */
    const onHash = () => {
      const next = openFoldOf(window.location.hash);
      if (next) requestAnimationFrame(() => next.scrollIntoView({ block: "start" }));
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  return null;
}
