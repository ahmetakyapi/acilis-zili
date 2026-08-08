"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* --------------------------------------------------------------------------
   Gezinme göstergesi — üstte ince çubuk, gecikirse "Yükleniyor" hapı.

   Tıklama ile yeni ekranın belirmesi arasında hiçbir işaret yoktu. Sayfa
   iskeleti (`app/(app)/loading.tsx`) yalnızca yeni segment ASKIYA ALINDIĞINDA
   giriyor; sunucu bileşenleri hızlı çözülünce arada birkaç yüz milisaniyelik
   sessiz bir boşluk kalıyor ve okuyucu dokunuşunun kaydedilip kaydedilmediğini
   bilemiyor — çoğu insan ikinci kez basıyor. Dil değişiminde durum daha kötü:
   o bir gezinme bile değil, çerez yazan bir sunucu eylemi; adres değişmiyor,
   iskelet çıkmıyor, ekran birkaç yüz milisaniye eski dilde duruyor.

   Çubuk YÜZDE GÖSTERMEZ. Ne kadar kaldığını bilmiyoruz; bilmediğimiz bir şeyi
   ilerleme yüzdesi gibi çizmek sitenin geri kalanındaki veri dürüstlüğüyle
   çelişirdi. Gösterge süresiz bir salınım: "çalışıyor" der, "%70" demez.

   "Yükleniyor" hapı hemen değil, GECİKİNCE çıkar (SLOW_AFTER). Ön yüklenmiş
   bağlantılar 100ms'de açılıyor ve her birinde ekrana bir kutu düşseydi
   arayüz kendi kendine seğiriyor gibi görünürdü.
   -------------------------------------------------------------------------- */

/** Hapın çıkması için gereken bekleme — altındaki gezinmeler sessiz geçer. */
const SLOW_AFTER = 420;
/** Emniyet freni: hiçbir sinyal gelmezse çubuk sonsuza kadar dönmesin. */
const MAX_RUN = 10_000;

/* Modül seviyesinde küçük bir mağaza: göstergeyi hem tıklama dinleyicisi hem
   de sunucu eylemi yakan bileşenler (dil değişimi) tetikleyebilmeli, ikisi de
   bu ağacın herhangi bir yerinden — context sarmalayıcı kurmaya değmez.

   Durum bir bayrak değil KOŞU NUMARASI: 0 boşta, sıfırdan büyük her sayı ayrı
   bir gezinme. Bayrak olsaydı "hap çıktı mı" durumunu ayrı bir state'te
   tutmak ve gezinme bitince effect içinde sıfırlamak gerekirdi; numarayla
   `slow` doğrudan türetiliyor — yeni koşu başladığında eski hap kendiliğinden
   düşüyor, sıfırlayacak effect kalmıyor. */
let runId = 0;
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function startRouteProgress() {
  if (runId !== 0) return;
  runId = ++counter;
  emit();
}

export function stopRouteProgress() {
  if (runId === 0) return;
  runId = 0;
  emit();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * `useSearchParams` okuduğu için ÇAĞIRAN taraf bunu `<Suspense>` içine almalı;
 * aksi halde altındaki bütün rota statik ön çizimden düşer.
 */
export function RouteProgress({ label }: { label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const run = useSyncExternalStore(
    subscribe,
    () => runId,
    () => 0,
  );
  const running = run !== 0;
  const [slowRun, setSlowRun] = useState(0);
  // Hap yalnızca ŞU ANKİ koşu için çıkar; sonraki gezinmede eşleşme bozulur.
  const slow = running && slowRun === run;
  const settled = useRef(`${pathname}?${search}`);

  /* Bağlantı tıklamaları. Her `<Link>`e prop geçmek yerine belgeyi yakalama
     evresinde dinliyoruz: gezinme bağlantıları sunucu bileşenlerinin içinde,
     onlarca dosyaya dağılmış durumda ve hepsine dokunmak bu göstergeyi
     kaldırmayı da imkânsız kılardı. */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Aynı adrese basmak gezinme değil: çubuk yanar ve hiç sönmezdi.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      startRouteProgress();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  /* Hedef ekran bağlandı — adres ya da sorgu değiştiyse iş bitmiştir.
     İlk bağlanmada mevcut adres `settled` içinde durduğu için tetiklenmez. */
  useEffect(() => {
    const key = `${pathname}?${search}`;
    if (key === settled.current) return;
    settled.current = key;
    stopRouteProgress();
  }, [pathname, search]);

  useEffect(() => {
    if (run === 0) return;
    const slowTimer = window.setTimeout(() => setSlowRun(run), SLOW_AFTER);
    const brake = window.setTimeout(stopRouteProgress, MAX_RUN);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(brake);
    };
  }, [run]);

  if (!running) return null;

  return (
    <>
      <span aria-hidden className="route-progress" />
      {slow && (
        <span role="status" className="route-progress-pill">
          <span aria-hidden className="route-progress-spinner" />
          {label}
        </span>
      )}
    </>
  );
}
