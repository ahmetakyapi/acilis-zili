"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { stripLocale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Kartla sayfa arası geçiş — tıklanan kartın logosu yeni sayfanın başlığına
   UÇUYOR.

   NEDEN VIEW TRANSITIONS DEĞİL. Tarayıcının kendi API'si
   (`document.startViewTransition`) güncelleme bitene kadar ekranı DONDURUYOR.
   Detay sayfalarımız sunucudan geliyor ve gezinme yüzlerce milisaniye
   sürüyor: o süre boyunca okuyucu takılmış bir ekran görür, 420 ms'den sonra
   çıkması gereken yükleme kartı (RouteProgress) da donmuş karenin arkasında
   kalırdı. React'in `ViewTransition` bileşeni de bu sürümde yok.

   ONUN YERİNE "VARDIKTAN SONRA UÇUŞ". Tıklamada kaynağın (`data-morph`)
   ekrandaki yeri not ediliyor; yeni sayfa açılınca hedef (`MorphTarget`)
   kendini gizliyor, bir KOPYASI o noktadan kalkıp hedefin yerine uçuyor ve
   iniş anında gerçeğiyle yer değiştiriyor. Ekran hiç donmuyor; yavaş bir
   gezinmede yükleme kartı olağan biçimde çıkıyor ve uçuş sayfa geldiğinde
   başlıyor.

   KOPYA `body`de. Hedef sayfa girişinin (`.page-enter`, 0,35'ten yükselen
   bloklar) içinde; uçan öğe orada kalsaydı yarı saydam kalkardı.

   Kaynak yer EKRAN koordinatı: App Router yeni sayfada en üste kaydırıyor
   ve hedef de ekran koordinatıyla ölçülüyor, yani uçuş okuyucunun gözünün
   gördüğü yoldan gidiyor. Kayıt `FRESH_MS`ten eskiyse uçulmuyor — uzun bir
   bekleyişte okuyucu eski sayfayı kaydırmış olabilir ve logo artık orada
   durmayan bir yerden kalkardı.
   -------------------------------------------------------------------------- */

type Flight = {
  key: string;
  rect: { left: number; top: number; width: number; height: number };
  at: number;
};

/** Son tıklamanın kaynağı — tek bir bekleyen uçuş yeter. */
let pending: Flight | null = null;

/** Kayıt bundan eskiyse uçuş yok (gezinme başlangıcından ms). */
const FRESH_MS = 2500;
/** Uçuş süresi — kavis, kaldırma ve iniş oturması dahil. */
const FLIGHT_MS = 680;
/** Sürenin ne kadarı yolda geçiyor; kalan kısım inişteki oturma. */
const TRAVEL_SHARE = 0.84;
/** Yoldaki örnek kare sayısı — kavis düz parçalara bölünmesin diye sık. */
const PATH_SAMPLES = 16;
/** Kavisin şişkinliği: mesafenin oranı ve üst sınırı (piksel). */
const ARC_RATIO = 0.18;
const ARC_MAX = 120;
/** Uçuş ortasında "kaldırılma" büyümesi (ölçeğe eklenen pay). */
const LIFT_SCALE = 0.1;
/** İnişte küçük oturma: hedefte bir an bu kadar büyük, sonra yerinde. */
const LAND_SCALE = 1.035;
/** Kavisin tepesi başlık çubuğunun altında kalsın (--app-bar-h + pay). */
const BAR_CLEARANCE = 77;

/**
 * Uçuşun kareleri — KAVİSLİ bir yol, kaldırma ve iniş.
 *
 * İLK HÂL DÜZ ÇİZGİYDİ ve şirket sayfasında kötü okunuyordu (26 Eylül,
 * kare kare incelendi): kaynak çoğu zaman sağ üstte (piyasanın devleri
 * kartı), hedef başlığın solunda; düz bir hat başlık satırını yatay
 * kesiyor, logo şirket adının ve fiyatın ÜSTÜNDEN kayıyordu ("NV[logo]Corp").
 * Şimdi yol ikinci dereceden bir Bézier: iki uç arasındaki doğrunun dikmesi
 * boyunca YUKARI doğru şişiyor, yani logo satırın üstünden kavis çizip
 * yerine iniyor. Tepe başlık çubuğunun altında kalacak kadar kısılıyor.
 *
 * Kareler zaman içinde eşit aralıklı, KONUM yumuşatılmış (marka eğrisinin
 * yaklaşığı): WAAPI'nin genel `easing`i kare ofsetlerini de büktüğü için
 * iniş oturmasını sona yavaş çekim olarak yayardı; bu yüzden genel eğri
 * doğrusal, yumuşatma konumda. Ortada ölçek biraz artıyor (kaldırılıyor),
 * sonda hedefte %3,5 büyüyüp yerine oturuyor.
 */
function flightFrames(
  from: { left: number; top: number; width: number; height: number },
  to: { left: number; top: number; width: number; height: number },
): Keyframe[] {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  const dist = Math.hypot(dx, dy) || 1;
  // Dikme: yolun yukarı bakan yanı (ekranda y aşağı doğru artıyor).
  let nx = dy / dist;
  let ny = -dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const point = (u: number, bulge: number) => {
    const cx = dx / 2 + nx * bulge;
    const cy = dy / 2 + ny * bulge;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    return { x: a * dx + b * cx, y: a * dy + b * cy };
  };
  // Tepe başlık çubuğunun altına insin diye şişkinlik gerekirse kısılıyor.
  let bulge = Math.min(ARC_MAX, dist * ARC_RATIO);
  for (let tries = 0; tries < 8; tries++) {
    let minTop = Infinity;
    // `to` merkez noktası: logonun üst kenarı yarım boy yukarıda.
    for (let i = 0; i <= PATH_SAMPLES; i++) minTop = Math.min(minTop, to.top - to.height / 2 + point(i / PATH_SAMPLES, bulge).y);
    if (minTop >= BAR_CLEARANCE || bulge < 4) break;
    bulge *= 0.6;
  }
  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const time = i / PATH_SAMPLES;
    const u = easeOut(time);
    const { x, y } = point(u, bulge);
    const lift = 1 + LIFT_SCALE * Math.sin(Math.PI * u);
    const scaleX = (sx + (1 - sx) * u) * lift;
    const scaleY = (sy + (1 - sy) * u) * lift;
    frames.push({ offset: time * TRAVEL_SHARE, transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` });
  }
  frames.push({ offset: TRAVEL_SHARE + (1 - TRAVEL_SHARE) / 2, transform: `scale(${LAND_SCALE})` });
  frames.push({ offset: 1, transform: "none" });
  return frames;
}

/**
 * Hedefin VARACAĞI yer — atalarında süren giriş animasyonlarının kaydırması
 * çıkarılarak.
 *
 * Ölçü anında sayfanın kendi girişi (`.page-enter`, 0,36 sn) kapağı 8 piksel
 * aşağıda tutuyordu; kopya oraya iniyor, gerçeği 8 piksel yukarıda
 * duruyordu ve inişte logo sıçrıyordu (ölçüldü, /teknik → /teknik/MU: kopya
 * y=186, hedef y=178). Uçuş o girişten uzun sürdüğü için iniş anında atalar
 * yerine oturmuş oluyor; yalnızca ölçünün düzeltilmesi yeterli.
 */
function settledRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.getAnimations().length === 0) continue;
    const m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
    dx += m.e;
    dy += m.f;
  }
  return { left: r.left - dx, top: r.top - dy, width: r.width, height: r.height };
}

/** Sembol taşıyan hedefler: hisse, teknik detay, bilanço detayı. */
const SYMBOL_ROUTE = /^\/(?:hisse|teknik|bilancolar)\/([^/?#]+)/;
/** Kaynak aranırken bağlantıdan en fazla kaç ata yukarı çıkılır. */
const SOURCE_REACH = 5;

/**
 * Tıklanan bağlantının KAYNAĞI — hedefin sembolüne ait logo.
 *
 * İlk hâlde kaynak bağlantının içinde ya da `data-morph-scope` işaretli
 * kartta aranıyordu. Sitede sık bir kalıp bunu kaçırıyordu: satırı örten
 * BOŞ bir bağlantı ve kardeş hücrede logo (analiz tablosu, bazı ana sayfa
 * listeleri — ana sayfada 34 bağlantının 9'u kaynaksızdı). Artık sembol
 * bağlantının hedefinden okunuyor ve bağlantıdan yukarı doğru O SEMBOLÜN
 * logosu aranıyor: satırın kendisi bulunuyor, komşu satırın başka bir
 * logosu asla seçilmiyor. Sembolsüz hedeflerde eski yol (içerik ya da
 * kart) geçerli.
 */
function findSource(anchor: Element): HTMLElement | null {
  let symbol: string | null = null;
  try {
    const path = stripLocale(new URL((anchor as HTMLAnchorElement).href, window.location.href).pathname);
    const match = SYMBOL_ROUTE.exec(path);
    symbol = match ? decodeURIComponent(match[1]).toUpperCase() : null;
  } catch {
    symbol = null;
  }
  if (symbol) {
    const selector = `[data-morph="logo:${CSS.escape(symbol)}"]`;
    let node: Element | null = anchor;
    for (let i = 0; i < SOURCE_REACH && node; i++, node = node.parentElement) {
      const found = node.matches(selector) ? node : node.querySelector(selector);
      if (found instanceof HTMLElement) return found;
    }
    return null;
  }
  const scope = anchor.closest("[data-morph-scope]") ?? anchor;
  return scope.querySelector<HTMLElement>("[data-morph]");
}

/** Kabukta bir kez: bağlantı tıklamalarında kaynağın yerini not eder. */
export function MorphRecorder() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!anchor) return;
      const source = findSource(anchor);
      const key = source?.dataset.morph;
      if (!source || !key) return;
      const r = source.getBoundingClientRect();
      /* Kaynak ekranda değilse uçuş yok: ekranın dışından kalkan bir logo
         bir hata gibi okunur. (Aynı adrese giden iki bağlantı olabiliyor —
         analizler sayfasında üstteki "son analiz" kartı ile tablodaki
         satırı — ve yalnızca tıklananın kartı kaynak.) */
      if (r.bottom <= 0 || r.top >= window.innerHeight || r.width === 0) {
        pending = null;
        return;
      }
      pending = { key, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, at: performance.now() };
    };
    /* Geri ve ileri tuşları tıklama değil: bekleyen bir kayıt kalmışsa
       silinir, yoksa geri dönülen sayfada eski bir yerden uçuş başlardı. */
    const onHistory = () => {
      pending = null;
    };
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onHistory);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onHistory);
    };
  }, []);
  return null;
}

/** Uçuşun hedefi — içindeki öğe, eşleşen bir kayıt varsa oradan gelir. */
export function MorphTarget({
  morphKey,
  className,
  children,
}: {
  morphKey: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const flight = pending;
    if (!el || !flight || flight.key !== morphKey) return;
    pending = null;
    if (performance.now() - flight.at > FRESH_MS) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof el.animate !== "function") return;

    /* Hedef ÖNCE gizleniyor, ölçü bir sonraki karede: App Router en üste
       kaydırmayı bu çizimin ardından yapıyor ve erken bir ölçü, sayfanın
       eski kaydırma konumuna göre olurdu. */
    el.style.visibility = "hidden";
    /* KOREOGRAFİ: uçuş sürerken kimliğin geri kalanı (ad, künye) bekliyor,
       logo indiği an yanından kayarak açılıyor (globals.css → "uçuş
       sahnesi"). Logo geçişin kahramanı; ad baştan görünür olunca logo
       onun üstünden kayıyor ve dağınık okunuyordu. */
    const stage = el.closest<HTMLElement>("[data-morph-stage]");
    if (stage) stage.dataset.morphState = "flying";
    let clone: HTMLElement | null = null;
    let animation: Animation | null = null;
    const restore = () => {
      clone?.remove();
      clone = null;
      el.style.visibility = "";
      if (stage) delete stage.dataset.morphState;
    };
    const frame = requestAnimationFrame(() => {
      const to = settledRect(el);
      if (!to.width || !to.height) return restore();
      clone = el.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, {
        position: "fixed",
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        margin: "0",
        zIndex: "40",
        pointerEvents: "none",
        transformOrigin: "center",
        visibility: "visible",
      });
      /* KOPYANIN İÇİ ASLINA KİLİTLENİYOR. Logo kutusunun ölçüsü çoğu zaman
         bir ATA seçicisine bağlı (şirket sayfasında `.companyOverview
         .companyLogo` 48 piksel); kopya `body`ye taşınınca o kural tutmuyor
         ve kutu taban ölçüsüne (66 piksel) açılıyordu — logo uçarken
         hedefinden büyük görünüyor, inişte küçülerek sıçrıyordu (kare kare
         görüldü). Hesaplanmış boy ve köşe yarıçapı kopyaya yazılıyor. */
      const inner = el.firstElementChild;
      const cloneInner = clone.firstElementChild;
      if (inner instanceof HTMLElement && cloneInner instanceof HTMLElement) {
        const cs = getComputedStyle(inner);
        Object.assign(cloneInner.style, {
          width: cs.width,
          height: cs.height,
          borderRadius: cs.borderRadius,
          flexShrink: "0",
        });
      }
      document.body.appendChild(clone);
      /* Dönüşüm merkezden: kaynak ve hedefin MERKEZLERİ arasında uçuluyor,
         yoksa ölçek sol üst köşeden büyüyüp logo yolun yanına kayardı. */
      const { rect } = flight;
      const center = (r: { left: number; top: number; width: number; height: number }) => ({
        left: r.left + r.width / 2,
        top: r.top + r.height / 2,
        width: r.width,
        height: r.height,
      });
      animation = clone.animate(flightFrames(center(rect), center(to)), {
        duration: FLIGHT_MS,
        easing: "linear",
      });
      animation.onfinish = restore;
      animation.oncancel = restore;
    });
    return () => {
      cancelAnimationFrame(frame);
      animation?.cancel();
      restore();
    };
  }, [morphKey]);

  return (
    <span ref={ref} data-morph-target className={cn("inline-flex shrink-0", className)}>
      {children}
    </span>
  );
}
