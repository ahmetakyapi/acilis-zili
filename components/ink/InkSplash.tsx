"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { InkCanvas } from "./InkCanvas";

/**
 * Açılış: sitenin oturumdaki İLK yüklemesinde mürekkeple çizilen zil.
 *
 * Kararı boyamadan ÖNCE `INK_SPLASH_SCRIPT` veriyor ve `<html>`e
 * `ink-splash` sınıfını yazıyor; katman yalnızca o sınıfla görünüyor. Böylece
 * içerik bir kare görünüp sonra örtülmüyor, JavaScript kapalıysa da hiç
 * açılmıyor. Kural:
 *
 * - Oturumda bir kez (`sessionStorage`) — ikinci sekme, yenileme, iç
 *   gezinme açılışı bir daha göstermiyor.
 * - Hareketi azaltan okuyucu ve tarayıcı botları hiç görmüyor: arama motoru
 *   sayfanın üstünde bir katman değil, sayfanın kendisini görmeli.
 * - Tıklama, tuş, tekerlek ya da dokunuşla hemen geçiliyor.
 * - CSS'te 4 saniyelik bir emniyet var: hidrasyon hiç gelmese de katman
 *   kendiliğinden kalkıyor.
 */
export const INK_SPLASH_SCRIPT = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("az-ink")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent)){d.classList.add("ink-splash");s.setItem("az-ink","1")}}catch(e){}`;

const noop = () => () => {};
const readActive = () => document.documentElement.classList.contains("ink-splash");

export function InkSplash({ name }: { name: string }) {
  const active = useSyncExternalStore(noop, readActive, () => false);
  const [gone, setGone] = useState(false);

  const close = useCallback(() => {
    const root = document.documentElement;
    if (!root.classList.contains("ink-splash") || root.classList.contains("ink-splash-out")) return;
    root.classList.add("ink-splash-out");
    window.setTimeout(() => {
      root.classList.remove("ink-splash", "ink-splash-out");
      setGone(true);
    }, 420);
  }, []);

  // Tuş katmana değil pencereye gelir: katman odak almıyor, almamalı da.
  useEffect(() => {
    if (!active) return;
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active, close]);

  // Sahne bitince imza bir an okunsun, sonra kalksın.
  const finish = useCallback(() => window.setTimeout(close, 280), [close]);

  return (
    <div
      className="ink-splash-layer"
      aria-hidden
      onPointerDown={close}
      onWheel={close}
      onTouchMove={close}
    >
      {active && !gone && (
        <>
          <InkCanvas scene="intro" seed={11} className="ink-splash-canvas" onDone={finish} />
          <span className="ink-splash-name">{name}</span>
        </>
      )}
    </div>
  );
}
