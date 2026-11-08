"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { InkLoader } from "@/components/ink/InkLoader";
import { sceneForPath } from "@/lib/ink/route-scenes";
import type { InkSceneName } from "@/lib/ink/scenes";
import {
  ROUTE_PROGRESS_IDLE,
  isPagePath,
  reduceRouteProgress,
  type RouteProgressEvent,
  type RouteProgressState,
} from "./route-progress-state";

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
/** Emniyet freni: hiçbir sinyal gelmezse çubuk sonsuza kadar dönmesin.
 *  10 sn'den 30 sn'ye (31 Ekim): risk masasının günün ilk açılışı ~17 sn,
 *  şirketler tablosu soğukta 5–8 sn sürüyordu (canlıda ölçüldü). Fren
 *  gezinme BİTMEDEN işareti söndürüyor, eski sayfa "hiçbir şey olmadı"
 *  gibi duruyor ve okur yeniden tıklıyordu. Fren yalnız gerçekten
 *  kaybolmuş bir gezinme içindir; yavaş sayfanın ilacı akış (Suspense). */
const MAX_RUN = 30_000;
/** Çıkış sönmesinin süresi — CSS'teki geçişten bir tık uzun (globals.css
 *  `.route-loader[data-leaving]`), geçiş bitmeden katman sökülmesin. */
const EXIT_MS = 170;

/* Modül seviyesinde küçük bir mağaza: göstergeyi hem tıklama dinleyicisi hem
   de sunucu eylemi yakan bileşenler (dil değişimi) tetikleyebilmeli, ikisi de
   bu ağacın herhangi bir yerinden — context sarmalayıcı kurmaya değmez.

   Durum bir bayrak değil KOŞU NUMARASI: 0 boşta, sıfırdan büyük her sayı ayrı
   bir gezinme. Bayrak olsaydı "hap çıktı mı" durumunu ayrı bir state'te
   tutmak ve gezinme bitince effect içinde sıfırlamak gerekirdi; numarayla
   `slow` doğrudan türetiliyor — yeni koşu başladığında eski hap kendiliğinden
   düşüyor, sıfırlayacak effect kalmıyor.

   TEK ANLIK GÖRÜNTÜ (8 Kasım): numara, sorgu işareti, satır içi geri
   bildirim ve sahne artık dört ayrı modül değişkeni değil, tek nesne ve
   saf `reduceRouteProgress` (route-progress-state.ts; gerekçe orada).
   Durdurma hepsini sıfırlıyor. Beklemede oynayan sahne hedef adres
   biliniyorsa ona göre; geri tuşu ve dil değişimi hedef vermiyor, onlar
   açılış sahnesini alıyor. */
let state: RouteProgressState = ROUTE_PROGRESS_IDLE;
const listeners = new Set<() => void>();

function dispatch(event: RouteProgressEvent) {
  const next = reduceRouteProgress(state, event);
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

export function startRouteProgress(href?: string) {
  if (state.run !== 0 && !href) return;
  const target = href ? new URL(href, window.location.href) : null;
  if (!target) {
    dispatch({ type: "start", target: null });
    return;
  }
  const regions = [...document.querySelectorAll("[data-query-transition]")];
  const query = target.pathname === window.location.pathname && regions.length > 0;
  // A result below the fold cannot acknowledge a tap on a header control.
  // In that case the existing global mark remains visible as well.
  const inline = query && regions.some((region) => {
    const rect = region.getBoundingClientRect();
    return rect.top < window.innerHeight - 160 && rect.bottom > 180;
  });
  dispatch({ type: "start", target: { query, inline, scene: sceneForPath(target.pathname) } });
}

export function stopRouteProgress() {
  dispatch({ type: "stop" });
}

const getState = () => state;
const getServerState = () => ROUTE_PROGRESS_IDLE;

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Only query navigation uses the inline result skeleton; page navigation
 * retains the global mark. Consecutive filters share the same active wait
 * so the previous result does not flash between rapid selections. */
export function useQueryNavigationRun(): number {
  return useSyncExternalStore(subscribe, () => state.query ? state.run : 0, () => 0);
}

/**
 * Gezinme SÜRÜYOR MU — göstergeyi çizmeyen bileşenler için.
 *
 * Karşılaştırma ekranının aralık denetimi adresi `history.replaceState` ile
 * sığ güncelliyor ve Next'in yamalı `replaceState`i O SIRADA UÇUŞTA OLAN bir
 * gezinmeyi iptal ediyor — geri gelmiyor, yeniden denenmiyor, hata da
 * vermiyor. Şeritten bir sembol çıkarıp yanıt inmeden aralığa basan okuyucu,
 * çarpı tıklamasının sessizce yok olduğunu görüyordu. Denetim bu yüzden
 * gezinme sürerken kendini kapatıyor; koşu numarası zaten burada.
 */
export function useRouteNavigating(): boolean {
  return (
    useSyncExternalStore(
      subscribe,
      () => state.run,
      () => 0,
    ) !== 0
  );
}

/**
 * `useSearchParams` okuduğu için ÇAĞIRAN taraf bunu `<Suspense>` içine almalı;
 * aksi halde altındaki bütün rota statik ön çizimden düşer.
 */
export function RouteProgress({ label, phases, brand }: { label: string; phases?: readonly string[]; brand: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const snap = useSyncExternalStore(subscribe, getState, getServerState);
  const { run } = snap;
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
      /* AÇIK MUAFİYET (8 Kasım). Gezinme olmayan bağlantı (dosya indiren uç,
         aynı adrese dönen akış) `data-no-progress` taşıyabilir; gösterge
         yalnız adres değişince söndüğü için böyle bir tık 30 sn frene kadar
         "yükleniyor" bırakıyordu. */
      if (anchor.hasAttribute("data-no-progress")) return;
      /* SIĞ BAĞLANTI GEZİNME DEĞİL. Karşılaştırma ekranının aralık denetimi
         gerçek bir adres taşıyor (JavaScript kapalıyken çalışsın diye) ama
         tıklamayı kendisi karşılayıp `history.replaceState` ile yalnızca
         adresi tazeliyor. Bu dinleyici YAKALAMA evresinde olduğu için
         `preventDefault` çağrılmadan önce koşuyor: `defaultPrevented`
         denetimi burada işe yaramıyor, işaret bağlantının kendisinde
         durmak zorunda. */
      if (anchor.hasAttribute("data-shallow")) return;
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
      // API ucu sayfa değil: adres değişmez, gösterge sönmezdi (isPagePath).
      if (!isPagePath(url.pathname)) return;
      // Aynı adrese basmak gezinme değil: çubuk yanar ve hiç sönmezdi.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      startRouteProgress(url.href);
    };

    const onHistory = () => {
      if (`${window.location.pathname}?${window.location.search.slice(1)}` !== settled.current) startRouteProgress();
    };
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onHistory);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onHistory);
    };
  }, []);

  /* Hedef ekran bağlandı — adres ya da sorgu değiştiyse iş bitmiştir.
     İlk bağlanmada mevcut adres `settled` içinde durduğu için tetiklenmez. */
  useEffect(() => {
    const key = `${pathname}?${search}`;
    if (key === settled.current) return;
    settled.current = key;
    stopRouteProgress();
  }, [pathname, search]);

  /* BAŞLIKTAKİ ZİL DE BEKLİYOR. Üstteki ray gözün kenarında kalıyor ve
     420 ms'nin altındaki gezinmelerde ortadaki kart hiç çıkmıyor; o kısa
     aralıkta tek işaret iki piksellik bir çizgiydi. Markanın kendi zili
     gezinme sürdükçe hafifçe sallanıyor — kısa gezinmede tek bir salınım,
     uzunda nefes gibi bir ritim. Öznitelik kökte çünkü işaret AppShell'de,
     bu bileşenin ağacında değil; stil globals.css → `data-navigating`. */
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-navigating", running);
    return () => root.removeAttribute("data-navigating");
  }, [running]);

  /* ESKİ SAYFA GERİ ÇEKİLİYOR (9 Ekim). Yeni sayfa yükselerek geliyordu
     (`.page-enter`) ama tıklama anında eskisi kıpırdamıyordu: geçişin
     yalnızca ikinci yarısı vardı. Şimdi gezinme sürerken eski sayfa
     sönüyor, yenisi onun yerinden yükseliyor.

     İşaret ÖĞENİN KENDİSİNDE, kökte değil: `template.tsx` her gezinmede
     YENİ bir `.page-enter` bağlıyor ve kökteki bir kural onu da sönük
     doğururdu (girişinin 0,35'i ile çarpılıp ~0,2'ye inerdi). Yalnızca
     o an ekranda olan öğe işaretleniyor; yenisi işaretsiz geliyor.
     Sayfa içi sorgu (filtre, sıralama) gezinme değil: kendi bölgesinin
     beklemesi var (`data-query-transition`), sayfanın tamamı sönmüyor.
     Süre ve gecikme globals.css → "geri çekilme". */
  const query = snap.query;
  useEffect(() => {
    if (!running || query) return;
    const leaving = [...document.querySelectorAll<HTMLElement>(".page-enter")];
    for (const el of leaving) el.dataset.leaving = "";
    return () => {
      for (const el of leaving) delete el.dataset.leaving;
    };
  }, [running, query]);

  useEffect(() => {
    if (run === 0) return;
    const slowTimer = window.setTimeout(() => setSlowRun(run), SLOW_AFTER);
    const brake = window.setTimeout(stopRouteProgress, MAX_RUN);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(brake);
    };
  }, [run]);

  /* ÇIKIŞ DA OYNUYOR (14 Ekim). Gezinme bitince perde + kart tek karede
     sökülüyordu: giriş 180/260 ms özenle kuruluyken ekranın yarısını
     karartan en büyük katman, projenin kendi çıkış kuralını (lib/motion.ts
     `exitOf`: "giden şey hızlanarak gider") uygulamayan tek katmandı.
     Gösterge şimdi `data-leaving` ile ~150 ms sönerek iniyor ve yeni
     sayfanın `.page-enter` yükselişi perdenin altından beliriyor; süre
     girişin ~%55'i, eğri `--ease-brand-in` (stil globals.css). Azaltılmış
     harekette global kural geçişi zaten kapatıyor.

     Koşunun düşüşü RENDER SIRASINDA yakalanıyor (RollingDigit'in "önceki
     prop" kalıbı): efekt yalnızca süre dolunca katmanı söküyor. Kartın
     çıkışta da görünmesi gerektiği o anki `slowRun`dan okunuyor — koşu
     bittiğinde `slow` çoktan false, ama numarası duruyor.

     Durdurma artık anlık görüntünün tamamını sıfırladığı için (8 Kasım)
     biten koşunun satır içi işareti ve sahnesi ÖNCEKİ görüntüden okunuyor:
     sönen kart son kareye kadar kendi sahnesini oynar, "intro"ya atlamaz. */
  const [exit, setExit] = useState<{ run: number; card: boolean; scene: InkSceneName } | null>(null);
  const [last, setLast] = useState(snap);
  if (snap.run !== last.run) {
    setLast(snap);
    if (snap.run === 0) setExit({ run: last.run, card: slowRun === last.run && !last.inline, scene: last.scene });
    else if (exit) setExit(null);
  }
  const scene = running ? snap.scene : (exit?.scene ?? snap.scene);
  useEffect(() => {
    if (!exit) return;
    const timer = window.setTimeout(() => setExit(null), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [exit]);

  if (!running && !exit) return null;
  const leaving = running ? undefined : "";

  return (
    <>
      <span aria-hidden className="route-progress" data-leaving={leaving} />
      {/* Gecikirse EKRANIN ORTASINDA marka işareti. Köşedeki küçük hap
          "bir şeyler oluyor" diyordu ama gözün gitmediği bir yerde
          duruyordu; ortadaki kart bekleyişi ürünün kendi işaretine
          bağlıyor. Katman tıklamayı ENGELLEMEZ (`pointer-events: none`):
          gösterge takılırsa ekranı kilitlemesin.

          KART ARTIK HEDEFİ ANLATIYOR (26 Eylül). Her gezinmede aynı çalan
          zil vardı; şimdi gidilen ekrana göre bir mürekkep sahnesi oynuyor
          (harita `lib/ink/route-scenes.ts`). Sayfa içi yükleme işaretleri
          (filtre, grafik) küçük zil olarak kaldı: dar bir panelin içinde
          sahne, bekleyişin kendisinden büyük bir olay olurdu. */}
      {(running ? slow && !snap.inline : exit?.card) && (
        <div className="route-loader" data-leaving={leaving}><InkLoader scene={scene} label={label} phases={phases} brand={brand} /></div>
      )}
    </>
  );
}
