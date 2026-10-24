"use client";

import { useEffect } from "react";

/** Hedefi kapalı bir `<details>`in içindeyse katlamayı aç; açıldıysa true. */
function openFoldOf(hash: string): HTMLElement | null {
  if (!hash || hash === "#") return null;
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
  const fold = target?.closest("details");
  if (!target || !fold || fold.open) return null;
  fold.open = true;
  return target;
}

/**
 * "DAHA ESKİ" KATLAMASINDAKİ AYA GİDEN ÇAPA (25 Ekim).
 *
 * Ay dizini Eylül'e ve Ağustos'a da bağlanıyor ama o aylar varsayılan
 * olarak kapalı `<details>`in içinde. Kapalı katlamanın içindeki çapaya
 * gezinmede her tarayıcı katlamayı kendiliğinden açmıyor; açmayanda
 * bağlantı hiçbir şey yapmıyor gibi durur.
 *
 * Tıklamada katlama, tarayıcının varsayılan çapa gezinmesinden ÖNCE
 * açılıyor: gezinmeyi bileşen değil tarayıcı yapıyor, adres ve geçmiş
 * olağan biçimde değişiyor (sığ adres güncellemesi yok — CLAUDE.md
 * "uçuştaki gezinme"). Dışarıdan `/yenilikler#ay-2026-08` ile gelen okur
 * için ilk açılışta aynı iş, kaydırma elle. JS kapalıyken katlama elle
 * açılıyor, dizin yine çalışıyor.
 */
export function RevealHashTarget() {
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
