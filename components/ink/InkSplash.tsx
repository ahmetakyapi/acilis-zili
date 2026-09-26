"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
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
 * - CSS'te bir emniyet var: hidrasyon hiç gelmezse katman kendiliğinden
 *   kalkıyor (`--ink-safety`, globals.css).
 *
 * AÇILIŞ EŞİĞE DEĞİL SON TARİHE BAĞLI (26 Eylül). Önceki kural şuydu:
 * hidrasyon 900 ms'yi geçtiyse sahne HİÇ oynamaz. Gerekçesi doğruydu —
 * yavaş bir telefonda boş ekrana üç saniye eklemek okuyucuyu sayfadan
 * uzak tutuyor — ama eşik yanlış yere düşmüştü: üretimde hidrasyon
 * 0,7-1,1 saniye arasında ölçüldü (aciliszili.com, masaüstü, 6 koşum),
 * yani eşik dağılımın TAM ORTASINDAYDI ve sahne yazı tura oynuyordu.
 * Aynı yüklemeyi iki kez ölçtüm: birinde 939. ms'de katman açılıp 1020'de
 * iptal edildi (tuval hiç boyanmadı), ötekinde sahne baştan sona oynadı.
 *
 * Şimdi soru "geç mi kaldı" değil, "kalan süreye sığar mı": sahnenin
 * SAATİ hızlandırılıp açılış her hâlde `DEADLINE_MS`te bitiriliyor. Geç
 * hidrasyonda sahne kısalıyor, çok geçse hiç oynamıyor. Okuyucu sayfaya
 * her koşulda aynı anda kavuşuyor; eskiden bitiş hidrasyona bağlıydı ve
 * 3,8 saniyeyi buluyordu.
 *
 * Emniyet katmanı sahneyi ORTASINDAN kesmiyor: oynamaya karar verildiği
 * an `ink-splash-live` sınıfı emniyeti kapatıyor ve kapanışı React
 * yürütüyor. Kesilirse kapanış animasyonu (`ink-splash-out`, yalnızca
 * `to` karesi var) katmanı TAM OPAK geri getirip söndürüyordu — ölçüldü,
 * 8,6. saniyede sayfanın üstünde bir parlama.
 */
export const INK_SPLASH_SCRIPT = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("az-ink")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent)){s.setItem("az-ink","1");d.classList.add("ink-splash")}}catch(e){}`;

/* Sıra önemli: önce işaret, sonra sınıf. `setItem` kota yüzünden fırlatırsa
   sınıf hiç eklenmiyor; tersinde açılış her yüklemede gösterilirdi. */

/** Açılış, gezinmenin başlangıcından bu ana kadar BİTER. */
const DEADLINE_MS = 3400;
/** Sahnenin yazıldığı süre — `lib/ink/scenes.ts` → `intro.end` (2,3 sn). */
const SCENE_MS = 2300;
/** Sahneden sonra geçen süre: imza okunsun diye 280, kapanış 420. */
const TAIL_MS = 700;
/** Sahne saati bundan hızlı oynatılmaz; üstünde çizim okunmuyor, mürekkep
 *  akmıyor gibi duruyor. 1,9 hızda sahne 1,2 saniye sürüyor, yani hidrasyon
 *  1,5 saniyeye kadar gecikse bile açılış oynuyor (ölçülen bant 0,7-1,1). */
const MAX_RATE = 1.9;
/** İmza sahnenin sonuna yakın beliriyor (2,3 saniyelik sahnede 1,75). */
const NAME_AT = 1750;
/** Sahne hiç bitmezse (tuval hatası) katmanı kaldıran son çare payı. */
const FAILSAFE_MS = 600;

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

  /* Sahnenin hızı İLK çizimde bir kez hesaplanıyor; sonraki bir yeniden
     çizim oynayan sahneyi hızlandırmamalı. `performance.now()` gezinmenin
     başlangıcından beri geçen süre, yani hidrasyonun gecikmesi. */
  const [rate] = useState(() => {
    const budget = DEADLINE_MS - performance.now() - TAIL_MS;
    return budget > 0 ? Math.max(1, SCENE_MS / budget) : Number.POSITIVE_INFINITY;
  });
  const late = active && rate > MAX_RATE;
  useEffect(() => {
    if (late) document.documentElement.classList.remove("ink-splash");
  }, [late]);

  /* OYNAYACAKSA EMNİYET KAPANIR. Katmanı artık React kaldırıyor; CSS'teki
     emniyet yalnızca hidrasyonun hiç gelmediği durum için duruyor. */
  const playing = active && !late && !gone;
  useEffect(() => {
    if (!playing) return;
    const root = document.documentElement;
    root.classList.add("ink-splash-live");
    /* Sahne bir şekilde bitmezse (tuval hatası, sekme arka planda) katman
       yine de kalkar: son tarihe kadar bekler, sonra kapatır. */
    const timer = window.setTimeout(close, SCENE_MS / rate + TAIL_MS + FAILSAFE_MS);
    return () => {
      root.classList.remove("ink-splash-live");
      window.clearTimeout(timer);
    };
  }, [playing, rate, close]);

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
      /* İmza sahneyle birlikte hızlanır: sabit gecikme, hızlandırılmış bir
         sahnede zilin çalmasından ÖNCE beliriyordu.

         DEĞER YALNIZCA OYNARKEN, YANİ YALNIZCA İSTEMCİDE. `performance.now()`
         sunucuda da çalışıyor ve orada "gezinmeden beri geçen süre" değil
         "süreç başlayalı geçen süre"; sunucu HTML'ine bu yüzden hep
         `0ms` gömülüyordu (imza sahnenin başında beliriyordu, ölçüldü).
         Hidrasyon öznitelik farkını düzeltmiyor, sonraki çizim de aynı
         prop'u gördüğü için DOM'a hiç yazmıyordu. Sunucuda stil yok;
         değeri ilk kez, oynamaya karar verildiğinde React yazıyor. */
      style={playing ? ({ "--ink-name-delay": `${Math.round(NAME_AT / rate)}ms` } as CSSProperties) : undefined}
    >
      {playing && (
        <>
          <InkCanvas scene="intro" seed={11} rate={rate} className="ink-splash-canvas" onDone={finish} />
          <span className="ink-splash-name">{name}</span>
        </>
      )}
    </div>
  );
}
