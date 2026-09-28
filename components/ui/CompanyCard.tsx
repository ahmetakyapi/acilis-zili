"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { LogoTile } from "@/components/ui/primitives";
import { cardKey } from "@/lib/company-card-key";
import { cn } from "@/lib/utils";
import styles from "./CompanyCard.module.css";

/* ==========================================================================
   Şirket kartı — sitedeki HER şirket logosunun ve karosunun üstünde açılan
   ortak okuma: logo, sembol, ad, sektör, piyasa değeri, fiyat ve günlük
   değişim.

   TEK KART, OLAY DELEGASYONU (28 Eylül). Eskiden üç ayrı balon vardı:
   /teknik dağılımının şirket balonu (her logo kendi hazır işaretlemesini
   sunucudan taşıyordu, sayfa başına ~2 KB gzip), tema haritasının künye
   kartı (`data-peek` JSON'u + tek istemci kartı) ve /piyasalar ısı
   haritasının hücre başına sunucuda çizilen kartları (30 hücre × tam kart
   işaretlemesi). Sahibinin isteği kartın "olabilecek her yere" gitmesiydi —
   yüzlerce logonun olduğu sayfalarda (ısı haritası, yatırımcı portföyleri)
   logo başına hazır işaretleme bedeli doğrusal büyürdü.

   Karar: SUNUCU VERİYİ, İSTEMCİ ÇİZİMİ taşır.
     - Sunucu her sayfa için sembol başına TEK bir küçük kayıt hazırlar
       (`CompanyCards`, components/ui/CompanyCards.tsx): biçimlenmiş dizeler,
       sektör dahil. Sektör 71 KB'lık endeks tohumundan geliyor ve
       server-only; kayda string olarak giriyor, tohum istemciye inmiyor.
     - Kayıt bir istemci bileşenine (`CompanyCardData`) prop olarak gidiyor
       ve modül düzeyindeki bir sözlüğe yazılıyor. HTML'e tek düğüm
       basılmıyor; veri yalnızca RSC yükünde, sembol başına bir kez.
     - Logo ya da karo yalnızca `data-cc="NVDA"` özniteliği taşır. Aynı
       sembolün sayfadaki beşinci logosu beş bayt ekler, beşinci kart değil.
     - Kabukta (app/(app)/layout.tsx) TEK bir `CompanyCardHost` belgeyi
       `pointerover`/`focusin` ile dinler ve kartı gövdeye portal ile çizer.
   Ölçüm (28 Eylül, üretim derlemesi, gzip -9): bkz. `CompanyCards.tsx`.

   DOKUNMATİKTE KART YOK. Parmak doğrudan bağlantıya gidiyor — logonun işi
   bağlantı olmak, kart imleçli ekranın zenginleştirmesi. Tema haritası bir
   dönem ilk dokunuşta kartı açıp ikincisinde şirkete gidiyordu; ortak kart
   bu davranışı taşımıyor (sahibinin kuralı: "dokunma bağlantıyı açar").
   Klavye odağı da açıyor ama yalnızca `:focus-visible` ise: Android Chrome
   dokunulan bağlantıya odak veriyor ve kapı olmasaydı dokunuşta kart bir an
   yanıp sönerdi.

   KART BİR OKUMA, HEDEF DEĞİL: `pointer-events:none`. İçinde "Şirkete Git"
   gibi bir bağlantı tıklanamaz ama tıklanır gibi dururdu; bağlantı logonun
   kendisi. İmleç kartın üstünden geçerken altındaki komşu logo çalışmaya
   devam ediyor.

   Ekran okuyucu kartı beklemiyor: erişilebilir ad öğenin kendisinde (bağlantı
   metni ya da `aria-label`). Açık kart `role="tooltip"` ve öğeye
   `aria-describedby` ile bağlanıyor.
   ========================================================================== */

/**
 * Bir şirketin kart kaydı — sunucuda biçimlenmiş dizeler.
 *
 * Alan YOKSA satır basılmıyor, tire konmuyor: sektörü bilinmeyen ya da
 * piyasa değeri karşılaştırılamayan (dolar dışı, ör. TSM) bir şirkette boş
 * bir "—" okuyucuya bir şey söylemiyor, yalnızca yer kaplıyor. Alanlar bu
 * yüzden isteğe bağlı ve kayıtta hiç yer almıyor (RSC `undefined`'ı da
 * yazıyor; anahtarın kendisi basılmıyor).
 */
export type CompanyCardRecord = {
  symbol: string;
  name?: string;
  /** Yalnızca depoda logosu OLMAYAN sembolde (uzak adres); gerisini
      `LogoTile` sembolden kendisi buluyor. */
  logo?: string;
  sector?: string;
  cap?: string;
  price?: string;
  pct?: string;
  amount?: string;
  /** Yön rengi — yalnızca işaretten ve yalnızca bu seansı anlatan değişimde. */
  dir?: "up" | "down";
  /** Fiyatın künyesi: "Seans İçi", "Açılış Öncesi", "Son Kapanış"… */
  basis?: string;
  /** Başlıktaki hap (teknik görüş gibi); `tone` hazır sınıf adı. */
  badge?: { text: string; tone: string };
  /** Yüzeye özgü ek satırlar (temadaki pay, hacim, gün aralığı). */
  facts?: [string, string][];
  /** Alt künye — yayın damgası ya da bir cümle. */
  foot?: string;
};

export type CompanyCardLabels = { sector: string; marketCap: string; price: string };

/* ---- Kayıt defteri (modül düzeyi) ---- */

/* ANAHTAR BAŞINA YIĞIN (28 Eylül denetimi). Defter anahtar başına tek kayıt
   tutuyordu: A ve B aynı anahtarı yazdığında B söküldüğünde (Suspense
   yeniden çizimi, koşullu panel) "kayıt hâlâ benimki mi" sorusu doğru
   çıkıyor ve anahtar siliniyordu — A ekranda olduğu hâlde kartı açılmıyordu.
   Artık her yazar yığına ekliyor, sökülen yalnızca kendi kaydını çıkarıyor,
   okuma en son yazılanı alıyor. */
const registry = new Map<string, CompanyCardRecord[]>();

function latest(key: string): CompanyCardRecord | null {
  const stack = registry.get(key);
  return stack && stack.length > 0 ? stack[stack.length - 1] : null;
}

function lookup(key: string): CompanyCardRecord | null {
  const direct = latest(key);
  if (direct) return direct;
  const colon = key.indexOf(":");
  return colon === -1 ? null : latest(key.slice(colon + 1));
}

/**
 * Sayfanın kart kayıtları — hiçbir şey çizmez, yalnızca deftere yazar.
 * Söküldüğünde (istemci gezinmesi) kendi yazdığını geri alır; başka bir
 * yüzey aynı anahtarı o arada yenilediyse ona dokunmaz.
 */
export function CompanyCardData({ cards, set }: { cards: CompanyCardRecord[]; set?: string }) {
  useEffect(() => {
    const written = cards.map((card) => {
      const key = cardKey(card.symbol, set);
      registry.set(key, [...(registry.get(key) ?? []), card]);
      return [key, card] as const;
    });
    return () => {
      for (const [key, card] of written) {
        const rest = (registry.get(key) ?? []).filter((entry) => entry !== card);
        if (rest.length > 0) registry.set(key, rest);
        else registry.delete(key);
      }
    };
  }, [cards, set]);
  return null;
}

/* ---- Yerleşim ---- */

/* Kartın genişliği CSS'te (`min(260px, 100vw - 24px)`); burada yalnızca
   kenar payı ve aralıklar. 320 pikselde 260 + 2×12 = 284, rahat sığıyor. */
const EDGE = 12;
/** Öğe ile kart arası. */
const GAP = 10;
/** Güvenli bandın başlığa ve alt çubuğa uzaklığı. */
const BAND_INSET = 8;
/* NİYET GECİKMESİ 60 ms. İmleç bir logo dizisinin üstünden geçip aşağı
   inerken her logo kart açmasın; 60 ms bir süpürmeyi eliyor ama bilerek
   durulan bir logoda gecikme hissedilmiyor. */
const OPEN_DELAY_MS = 60;
/* ÖĞEDEN ÖĞEYE GEÇİŞ BEKLEMİYOR. Bir kart az önce kapandıysa okuyucu zaten
   okuyor demektir: komşunun kartı gecikmesiz ve giriş hareketi olmadan
   açılıyor, okuma yerinde değişiyor. */
const SWAP_WINDOW_MS = 240;

/**
 * Kartın sığabileceği dikey bant: yapışkan başlığın dibi ile alttaki sabit
 * çubuğun (masaüstünde borsa şeridi, telefonda sekme çubuğu) tepesi arası.
 *
 * TAHMİN DEĞİL, ÖLÇÜ. Eski ipucu "logo 290 pikselden aşağıdaysa üste aç"
 * diyordu; balonun gerçek boyu 187, başlık 0-69 (z 30), borsa şeridi
 * 863-900 idi ve z-90'daki ipucu ikisinin de üstüne boyanabiliyordu. Bant
 * artık açılış anında `.chrome` çubuklarından okunuyor: görünmeyen çubuk
 * (0 boyut) sayılmıyor, ekranın üst yarısındaki başlık, alt yarısındaki
 * alt çubuk.
 *
 * Ölçüldü (22 Eylül, 900 piksel yükseklik): bant masaüstünde 77-855,
 * telefon genişliğinde 77-812 (sekme çubuğu 820'de başlıyor). /teknik
 * 1440'ta MU logosu 199-231, balon altında 240-447; ana sayfada logo 760'a
 * kaydırılınca balon üstte 542-749. 320'de balon 12-308, iki yanda 12
 * piksel. TR/EN × açık/koyu × 1440/1024/768/390/320 matrisinde her
 * açılışta tek balon, hiçbiri bandın dışında değil.
 */
function safeBand(): { top: number; bottom: number } {
  const height = window.innerHeight;
  let top = 0;
  let bottom = height;
  document.querySelectorAll<HTMLElement>(".chrome").forEach((bar) => {
    const box = bar.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const position = getComputedStyle(bar).position;
    if (position !== "fixed" && position !== "sticky") return;
    if (box.top < height / 2) top = Math.max(top, box.bottom);
    else bottom = Math.min(bottom, box.top);
  });
  return { top: top + BAND_INSET, bottom: bottom - BAND_INSET };
}

/** Olayın hedefinden kartlı öğe: önce kendisi ya da atası; odakta bağlantının
    İÇİNDEKİ tek kartlı logo da sayılıyor (satır bağlantısı + logo). */
function carrierOf(target: EventTarget | null, focus: boolean): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const own = target.closest<HTMLElement>("[data-cc]");
  if (own) return own;
  if (!focus) return null;
  const inner = target.querySelectorAll<HTMLElement>("[data-cc]");
  return inner.length === 1 ? inner[0] : null;
}

/** `x`: imlecin açılış anındaki yatay konumu (odakla açılışta yok). */
type Open = { card: CompanyCardRecord; anchor: HTMLElement; swap: boolean; x: number | null };

/**
 * Kabuğun tek kart sunucusu — belgeyi dinler, kartı çizer ve yerleştirir.
 * Uygulama düzeninde bir kez basılıyor.
 */
export function CompanyCardHost({ labels }: { labels: CompanyCardLabels }) {
  const id = useId();
  const node = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  /* Belge dinleyicileri bir kez bağlanıyor ve açık kartı bu ref'ten
     okuyor; her açılışta yeniden bağlanmıyorlar. */
  const openRef = useRef<Open | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    let timer: number | null = null;
    let lastClosedAt = Number.NEGATIVE_INFINITY;
    let describedBy: HTMLElement | null = null;

    const cancel = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const unlink = () => {
      if (!describedBy) return;
      describedBy.removeAttribute("aria-describedby");
      describedBy.removeAttribute("data-card-open");
      describedBy = null;
    };
    const close = () => {
      cancel();
      if (openRef.current) lastClosedAt = performance.now();
      unlink();
      openRef.current = null;
      setOpen(null);
    };
    closeRef.current = close;
    const show = (carrier: HTMLElement, anchor: HTMLElement, x: number | null) => {
      cancel();
      const key = carrier.dataset.cc;
      const card = key ? lookup(key) : null;
      if (!card) return;
      const swap = openRef.current !== null || performance.now() - lastClosedAt < SWAP_WINDOW_MS;
      unlink();
      /* Açık kartın sahibi belli: kart ekran kenarına yaslanınca öğenin tam
         üstünde durmayabiliyor, `data-card-open` hangi öğeye ait olduğunu
         stil kancası olarak veriyor. */
      anchor.setAttribute("aria-describedby", id);
      anchor.setAttribute("data-card-open", "");
      describedBy = anchor;
      const next = { card, anchor, swap, x };
      openRef.current = next;
      setOpen(next);
    };

    const over = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const carrier = carrierOf(event.target, false);
      if (!carrier) return;
      if (openRef.current?.anchor === carrier) {
        cancel();
        return;
      }
      const x = event.clientX;
      if (openRef.current !== null || performance.now() - lastClosedAt < SWAP_WINDOW_MS) {
        show(carrier, carrier, x);
        return;
      }
      cancel();
      timer = window.setTimeout(() => show(carrier, carrier, x), OPEN_DELAY_MS);
    };
    const out = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const carrier = carrierOf(event.target, false);
      if (!carrier) return;
      const next = event.relatedTarget;
      if (next instanceof Node && carrier.contains(next)) return;
      /* KLAVYE KARTI İMLEÇLE KAPANMAZ (28 Eylül denetimi): odakla açılmış
         kart, imleç sayfadaki ilgisiz bir logonun üstünden geçip çıkınca
         kapanıyordu. Yalnızca bekleyen imleç açılışı iptal ediliyor. */
      const current = openRef.current;
      if (current && current.x === null && current.anchor !== carrier && !current.anchor.contains(carrier)) {
        cancel();
        return;
      }
      /* Bir iç öğeden (logo) dıştakine (satır bağlantısı, o da kartlı)
         geçiş: kapanıp açılmasın, `over` yeni sahibi zaten seçiyor. */
      close();
    };
    const focusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
      const carrier = carrierOf(target, true);
      if (carrier) show(carrier, target, null);
    };
    const focusOut = () => {
      if (openRef.current && openRef.current.anchor === document.activeElement) return;
      if (openRef.current && openRef.current.anchor.matches(":hover")) return;
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") close();
    };
    /* KAYDIRMA: yalnızca öğeyi taşıyan kaydırma ilgilendiriyor. Belgenin
       kendisi ya da öğenin atası kayarsa kart öğeden kopar; sayfadaki
       ilgisiz bir tablonun ya da şeridin kaydırması karta dokunmuyor.
       İmleçle açılan kart kapanıyor (imleç artık başka bir şeyin üstünde).
       KLAVYEYLE açılan kart KAPANMIYOR, öğeyle birlikte taşınıyor: Tab
       ekran dışındaki bir bağlantıya geçince tarayıcı onu görünüme
       kaydırıyor ve o kaydırma odağın HEMEN ARDINDAN geliyor — kapatmak,
       klavyede kartı hiç göstermemek demekti (ölçüldü: odak açıyordu,
       bir kare sonra kaydırma kapatıyordu). Yumuşak kaydırmanın ilk
       karelerinde öğe henüz bandın dışında olabiliyor; kart o sırada
       kapanmıyor, gizleniyor (`data-away`) ve öğe banda girince geri
       geliyor. */
    const scroll = (event: Event) => {
      const current = openRef.current;
      if (!current) return;
      const target = event.target;
      if (target !== document && !(target instanceof Node && target.contains(current.anchor))) return;
      if (current.x !== null) {
        close();
        return;
      }
      const moved = { ...current, swap: true };
      openRef.current = moved;
      setOpen(moved);
    };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("pagehide", close);
    return () => {
      cancel();
      unlink();
      closeRef.current = null;
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("pagehide", close);
    };
  }, [id]);

  /* Gezinmede kart öğesiyle birlikte gitmeli: kabuk kalıcı, öğe değil. */
  useEffect(() => {
    closeRef.current?.();
  }, [pathname]);

  /* YERLEŞİM ÖLÇÜLEREK. Kart önce görünmez çiziliyor (`data-side` yok →
     `visibility:hidden`), gerçek boyu okunuyor, sonra bant içinde yeri
     seçiliyor: sığıyorsa öğenin altı, sığmıyorsa üstü, ikisi de sığmıyorsa
     geniş olan taraf banda kırpılarak. Yatayda öğenin ortası, kenara yakın
     öğede pencere kenarına yaslanıyor (taşmıyor). KARTTAN GENİŞ ÖĞEDE
     (tablo satırı, satırı kaplayan bağlantı) orta nokta kartı satırın
     ortasına, logodan uzağa atardı: imleçle açılışta kart imlecin
     altında, odakla açılışta satırın sol kenarında (logonun yanında). Konum React durumu değil,
     doğrudan düğüme yazılıyor — ölçüm karesi için ikinci bir çizim turu
     gerekmiyor. */
  useLayoutEffect(() => {
    const card = node.current;
    if (!open || !card) return;
    const rect = open.anchor.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const band = safeBand();
    /* Öğe bandın dışında (klavyeyle açılmış kart, sayfa kayarken): yer
       hesaplanmıyor, kart gizli bekliyor. */
    if (rect.bottom < band.top || rect.top > band.bottom) {
      card.dataset.away = "";
      return;
    }
    delete card.dataset.away;
    const center =
      rect.width <= width
        ? rect.left + rect.width / 2
        : open.x !== null
          ? Math.min(Math.max(open.x, rect.left + width / 2), rect.right - width / 2)
          : rect.left + width / 2;
    const left = Math.min(Math.max(center - width / 2, EDGE), viewport - width - EDGE);
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - height;
    let side: "below" | "above";
    let top: number;
    if (below + height <= band.bottom) {
      side = "below";
      top = below;
    } else if (above >= band.top) {
      side = "above";
      top = above;
    } else {
      side = band.bottom - rect.bottom >= rect.top - band.top ? "below" : "above";
      top = Math.min(Math.max(side === "below" ? below : above, band.top), Math.max(band.top, band.bottom - height));
    }
    card.style.left = `${Math.max(EDGE, left)}px`;
    card.style.top = `${top}px`;
    if (open.swap) card.dataset.swap = "";
    else delete card.dataset.swap;
    card.dataset.side = side;
  }, [open]);

  if (!open) return null;
  return createPortal(
    /* `key`: her açılış yeni düğüm — giriş animasyonu ve `data-side`
       önceki öğeden kalmasın. */
    <div key={`${open.card.symbol}:${open.anchor.dataset.cc}`} ref={node} id={id} role="tooltip" className={styles.card}>
      <CompanyCardView card={open.card} labels={labels} />
    </div>,
    document.body,
  );
}

function CompanyCardView({ card, labels }: { card: CompanyCardRecord; labels: CompanyCardLabels }) {
  /* DÜZEN (28 Eylül, "bir tık daha güzel"): kimlik → fiyat → künye. Kart
     dört eşit satırlık bir tabloydu; uzun sektör adı ("Bilgi Teknolojileri ·
     Yarı İletkenler") sağa yaslı iki satıra kırılıyor, fiyat da künyelerle
     aynı ağırlıkta kalıyordu. Sektör artık kimliğin altında soluk tek satır,
     fiyat kendi tonlu alanında büyük ve değişim yön renginde bir hap. */
  const facts = card.cap !== undefined || !!card.facts?.length;
  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <LogoTile symbol={card.symbol} logoUrl={card.logo ?? null} size="md" />
        <span className={styles.who}>
          <strong className="numeral">{card.symbol}</strong>
          {card.name && card.name !== card.symbol && <span>{card.name}</span>}
        </span>
        {card.badge && <span className={cn(styles.pill, card.badge.tone)}>{card.badge.text}</span>}
      </div>
      {card.sector !== undefined && (
        <p className={styles.sector}>
          <span className="sr-only">{labels.sector}: </span>
          {card.sector}
        </p>
      )}

      {card.price !== undefined && (
        <div className={styles.quote}>
          <span className={styles.quoteMain}>
            {/* Künye fiyatın üstünde: değişim bu seansı anlatmıyorsa
                ("Son Kapanış", "Açılış Öncesi") adıyla söylüyor. */}
            <small>{card.basis ?? labels.price}</small>
            <b className="numeral">{card.price}</b>
          </span>
          {card.pct !== undefined && (
            <span className={styles.move} data-dir={card.dir}>
              <em className="numeral">{card.pct}</em>
              {card.amount !== undefined && <small className="numeral">{card.amount}</small>}
            </span>
          )}
        </div>
      )}

      {facts && (
        <dl className={styles.facts}>
          {card.cap !== undefined && (
            <div>
              <dt>{labels.marketCap}</dt>
              <dd className="numeral">{card.cap}</dd>
            </div>
          )}
          {card.facts?.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="numeral">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {card.foot && <p className={styles.foot}>{card.foot}</p>}
    </div>
  );
}
