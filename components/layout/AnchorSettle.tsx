"use client";

import { useEffect } from "react";

/**
 * AKIŞLA GELEN SAYFADA ÇAPA, SAYFA OTURANA KADAR YERİNDE.
 *
 *   <Panel id="sektor-performansi">…<AnchorSettle id="sektor-performansi" /></Panel>
 *
 * NEDEN (4 Ekim 2026, ölçüldü). Ana sayfanın sektör panelindeki bağlantı
 * `/piyasalar#sektor-performansi`e gidiyor. Tarayıcı çapayı buluyor ve
 * kaydırıyor, ama panelin ÜSTÜNDEKİ bölümler (endeks detayı, bileşen
 * tablosu) daha sonra akıyor ve iskeletlerinden kısa çıkıyor: 390×844'te
 * okuyucu sektör tablosunun 2.092 piksel ALTINDA kalıyordu, ekranda
 * sektörlerin olduğu bir yer görünmüyordu ("orada bu sektörlerin
 * listelendiği yer yok"). `AnchorLanding` (yönetim paneli) tek seferlik
 * iniş yapıyor ve bu kaymayı göremiyor.
 *
 * Burada iniş, sayfanın boyu değiştikçe tekrarlanıyor — üç koşuldan biri
 * gerçekleşene kadar: okuyucu kendisi kaydırmaya ya da dokunmaya başladı,
 * boy 600 ms boyunca değişmedi, ya da 5 saniye geçti. Okuyucunun eli
 * değdikten sonra sayfa onu asla geri çekmiyor.
 *
 * Bant payı `html`in `scroll-padding-block`unda (globals.css);
 * `scrollIntoView` onu sayıyor.
 */
const QUIET_MS = 600;
const MAX_MS = 5_000;
/** Okuyucunun eli: bunlardan biri olunca iniş bırakılıyor. */
const HAND = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

export function AnchorSettle({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    const target = document.getElementById(id);
    if (!target) return;

    let quiet: number | undefined;
    let done = false;
    const land = () => target.scrollIntoView({ block: "start" });
    const stop = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      window.clearTimeout(quiet);
      window.clearTimeout(cap);
      for (const type of HAND) window.removeEventListener(type, stop);
    };
    const observer = new ResizeObserver(() => {
      if (done) return;
      land();
      window.clearTimeout(quiet);
      quiet = window.setTimeout(stop, QUIET_MS);
    });
    for (const type of HAND) window.addEventListener(type, stop, { passive: true });
    const cap = window.setTimeout(stop, MAX_MS);

    land();
    observer.observe(document.body);
    quiet = window.setTimeout(stop, QUIET_MS);
    return stop;
  }, [id]);
  return null;
}
