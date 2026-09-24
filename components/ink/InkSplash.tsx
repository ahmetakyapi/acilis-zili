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
 * - CSS'te 3,8 saniyelik bir emniyet var: hidrasyon hiç gelmese de katman
 *   kendiliğinden kalkıyor.
 * - GEÇ GELEN HİDRASYON açılışı İPTAL eder (`LATE_MS`). Katman hidrasyona
 *   kadar düz zemin; yavaş bir telefonda o boş ekrana üç saniyelik bir sahne
 *   eklemek, okuyucuyu sayfadan beş saniye uzak tutmaktı. Üstelik emniyet
 *   katmanı gizledikten sonra sahne görünmeden oynuyor, bitişteki kapanış
 *   animasyonu (`ink-splash-out`, yalnızca `to` karesi var) katmanı TAM
 *   OPAK geri getirip öyle söndürüyordu — ölçüldü, 8,6. saniyede sayfanın
 *   üstünde bir parlama.
 */
export const INK_SPLASH_SCRIPT = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("az-ink")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent)){s.setItem("az-ink","1");d.classList.add("ink-splash")}}catch(e){}`;

/* Sıra önemli: önce işaret, sonra sınıf. `setItem` kota yüzünden fırlatırsa
   sınıf hiç eklenmiyor; tersinde açılış her yüklemede gösterilirdi. */

/** Hidrasyon bu andan sonra gelirse (gezinme başlangıcından ms) sahne
 *  oynamaz, katman hemen kalkar. Emniyet 3800 ms (globals.css) ile birlikte
 *  ayarlı: bu eşiğin altındaki her hidrasyonda sahne emniyetten önce biter. */
const LATE_MS = 900;

const noop = () => () => {};
const readActive = () => document.documentElement.classList.contains("ink-splash");

export function InkSplash({ name }: { name: string }) {
  const active = useSyncExternalStore(noop, readActive, () => false);
  const [gone, setGone] = useState(false);

  const close = useCallback(() => {
    const root = document.documentElement;
    if (!root.classList.contains("ink-splash") || root.classList.contains("ink-splash-out")) return;
    // Emniyet katmanı zaten gizlediyse kapanış animasyonu OYNATILMAZ: o
    // animasyon opaklıktan başlıyor ve gizli katmanı bir an geri getirirdi.
    const layer = document.querySelector<HTMLElement>(".ink-splash-layer");
    if (!layer || getComputedStyle(layer).visibility === "hidden") {
      root.classList.remove("ink-splash");
      setGone(true);
      return;
    }
    root.classList.add("ink-splash-out");
    window.setTimeout(() => {
      root.classList.remove("ink-splash", "ink-splash-out");
      setGone(true);
    }, 420);
  }, []);

  // Geç hidrasyon: sahne yok, katman hemen kalkar. Ölçü İLK çizimde bir
  // kez alınıyor; sonraki bir yeniden çizim oynayan sahneyi kesmemeli.
  const [hydratedLate] = useState(() => performance.now() > LATE_MS);
  const late = active && hydratedLate;
  useEffect(() => {
    if (late) document.documentElement.classList.remove("ink-splash");
  }, [late]);

  // Tuş katmana değil pencereye gelir: katman odak almıyor, almamalı da.
  // Açılış kalkınca dinleyici de gidiyor — yoksa sayfadaki ilk tuş
  // (aramaya yazmak) boşuna kapanış denemesi yapardı.
  useEffect(() => {
    if (!active || gone || late) return;
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active, gone, late, close]);

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
      {active && !gone && !late && (
        <>
          <InkCanvas scene="intro" seed={11} className="ink-splash-canvas" onDone={finish} />
          <span className="ink-splash-name">{name}</span>
        </>
      )}
    </div>
  );
}
