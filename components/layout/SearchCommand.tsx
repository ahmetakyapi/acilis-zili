"use client";

import { startRouteProgress } from "./RouteProgress";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ClockCounterClockwise, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { LogoTile } from "@/components/ui/primitives";
import type {
  SearchHit,
  SearchResponse,
  WritingHit,
} from "@/app/api/search/route";
import { cn, isValidSymbol } from "@/lib/utils";
import { InkCanvas } from "@/components/ink/InkCanvas";

/**
 * ⌘K sembol arama.
 * Yerel tablodan gelen sonuçlar anında, sağlayıcıdan gelenler gecikmeli
 * görünür; kullanıcı beklerken kutu boş kalmaz.
 */
/**
 * PALET TEK ÖRNEK OLMALI.
 *
 * `AppShell` arama tetikleyicisini İKİ yerde basıyor (masaüstü masthead ve
 * mobil başlık); aynı React elemanı iki yere konunca iki BİLEŞEN ÖRNEĞİ
 * oluşuyor. İkisi de ⌘K dinliyor, ikisi de portalını `document.body`'ye
 * çiziyordu — yani kısayola basınca üst üste İKİ modal açılıyor, `id`ler
 * (`palet-sonuclari`, `palet-secenek-0`) belgede iki kez geçiyor ve iki ayrı
 * odak tuzağı birbiriyle yarışıyordu. Görsel olarak fark edilmiyordu çünkü
 * ikisi birebir aynı ve üst üste duruyor.
 *
 * Çözüm: ilk bağlanan örnek paleti SAHİPLENİR; ötekiler yalnızca tetikleyici
 * düğmeyi çizer ve açma isteğini sahibe iletir. Durum modül seviyesinde
 * tutuluyor, `useSyncExternalStore` ile okunuyor.
 */
let paletteOwner: symbol | null = null;
let paletteOpen = false;
// The portal owner can be the hidden desktop instance on mobile. Return
// focus to the actual opener, not to the owner's responsive trigger.
let paletteReturnFocus: HTMLElement | null = null;
const paletteListeners = new Set<() => void>();

function emitPalette() {
  for (const listener of paletteListeners) listener();
}

function setPaletteOpen(next: boolean) {
  if (paletteOpen === next) return;
  paletteOpen = next;
  emitPalette();
}

/** Modül seviyesinde: hiçbir hook'un bağımlılığı olmuyor. */
function togglePalette(next: boolean | ((value: boolean) => boolean)) {
  setPaletteOpen(typeof next === "function" ? next(paletteOpen) : next);
}

function subscribePalette(listener: () => void) {
  paletteListeners.add(listener);
  return () => paletteListeners.delete(listener);
}

/* SORGU ÖNBELLEĞİ (26 Eylül, "çok performanslı çalışsın"). Aynı oturumda
   sorulmuş bir sorgu ağa bir daha gitmiyor: yazıp silen, geri alan okuyucu
   sonucu anında görüyor. Modül seviyesinde, sayfalar arası gezinmede de
   yaşıyor; tavan 60 sorgu, en eskisi düşüyor. */
const SEARCH_CACHE = new Map<string, SearchResponse>();
const SEARCH_CACHE_MAX = 60;
/** Tuş vuruşu sonrası bekleme — 220'den indi: önbellek ve daha hızlı uç. */
const SEARCH_DEBOUNCE_MS = 120;

/* SON ARAMALAR — yalnızca bu tarayıcıda, gidilen son altı sembol. Tercih
   değil kolaylık (kayıp olursa hiçbir şey bozulmuyor), o yüzden
   localStorage; erişim her yerde try/catch içinde. */
const RECENT_KEY = "az-search-recent";
const RECENT_MAX = 6;
type Recent = { symbol: string; name: string };
function readRecent(): Recent[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((item): item is Recent => typeof item?.symbol === "string" && typeof item?.name === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}
function pushRecent(item: Recent) {
  try {
    const next = [item, ...readRecent().filter((entry) => entry.symbol !== item.symbol)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Depolama kapalıysa son aramalar yalnızca tutulmuyor.
  }
}

/** Eşleşen kısmı vurgular — büyük/küçük ve Türkçe harf farkı gözetmeden. */
function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return <>{text}</>;
  const at = text.toLocaleLowerCase("tr-TR").indexOf(needle);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="palette-mark">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/** Boş kutuda önerilen semboller — takip evreninin merkezî isimleri. */
const POPULAR_PICKS = [
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "MU", name: "Micron" },
  /* SPY ve QQQ çıktı (26 Eylül): popüler hisseler artık logolu karolar ve
     fonların logosu yok, iki harf kutusu olarak duruyorlardı. Fonlar
     aranınca yine bulunuyor. */
  { symbol: "META", name: "Meta" },
  { symbol: "GOOGL", name: "Alphabet" },
] as const;

export function SearchCommand({
  placeholder,
  placeholderShort,
  label,
  emptyLabel,
  rateLimitedLabel,
  failedLabel,
  popularLabel,
  recentLabel,
  companiesLabel,
  technicalLabel,
  writingsLabel,
  closeLabel,
  hints,
}: {
  placeholder: string;
  /** Masthead alanında görünen kısa çağrı — "Sembol veya olay ara". */
  placeholderShort: string;
  label: string;
  emptyLabel: string;
  /** "{saniye}" yer tutucusu taşıyan 429 mesajı. */
  rateLimitedLabel: string;
  failedLabel: string;
  popularLabel: string;
  /** "Son Aramalar" — bu tarayıcıda gidilen son semboller. */
  recentLabel: string;
  companiesLabel: string;
  /** Teknik analizi olan sembolün altındaki ikinci satır — "Teknik Analiz". */
  technicalLabel: string;
  /** "Yazılar" — rehber ve mercek sonuçlarının başlığı. */
  writingsLabel: string;
  /* Kapat düğmesinin ekran okuyucu adı. Sözlükten gelmiyordu: paletin tek
     düğmesi İngilizce arayüzde de "Kapat" diye okunuyordu. */
  closeLabel: string;
  /** Paletin alt şeridindeki klavye ipuçları. */
  hints: { move: string; open: string };
}) {
  const router = useRouter();

  /* Sahiplik ilk bağlanan örneğe verilir ve bileşen sökülene kadar onda
     kalır. Kimlik `useRef` ile örneğe özel bir sembol. */
  const idRef = useRef<symbol | null>(null);
  if (idRef.current == null) idRef.current = Symbol("palette");
  /* Sahiplik de mağazadan OKUNUYOR, `setState` ile değil: efekt içinden
     `setState` çağırmak fazladan bir çizim turu demek ve React bunu bir
     kural ihlali olarak işaretliyor. Efekt yalnızca modül durumunu
     değiştirip abonelere haber veriyor. */
  useEffect(() => {
    if (paletteOwner === null) {
      paletteOwner = idRef.current;
      emitPalette();
    }
    return () => {
      if (paletteOwner === idRef.current) {
        paletteOwner = null;
        paletteOpen = false;
        paletteReturnFocus = null;
        emitPalette();
      }
    };
  }, []);

  const owns = useSyncExternalStore(
    subscribePalette,
    () => paletteOwner === idRef.current,
    () => false,
  );
  const open = useSyncExternalStore(
    subscribePalette,
    () => paletteOpen,
    () => false,
  );

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [writings, setWritings] = useState<WritingHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  /* Arama HATASI ile SONUÇ YOKLUĞU ayrı şeyler. Uç 429 döndüğünde istemci
     `res.ok`a hiç bakmıyor, gövdedeki `error` alanını okumuyordu; sonuç boş
     liste ve ekranda "sonuç yok" oluyordu. Kullanıcı aradığı şirketin sitede
     olmadığını sanıyordu. */
  const [failure, setFailure] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  /* Paleti açan düğme ve panelin kendisi. İkisi de odak yönetimi için:
     kapanışta odak düğmeye geri döner, açıkken Tab paneli terk edemez. */
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /* Sonuca gidilerek kapandıysa odak düğmeye GERİ DÖNMEZ: sayfa değişti,
     okuyucunun odağı yeni sayfanın başında olmalı. */
  const navigatingRef = useRef(false);

  // Kapanışta durum event handler'da sıfırlanır — effect içinde setState yok.
  const close = useCallback(() => {
    togglePalette(false);
    setQuery("");
    setHits([]);
    setWritings([]);
    setActive(0);
    setLoading(false);
    setFailure(null);
    /* ODAK GERİ VERİLİR. Palet kapanınca odak `document.body`'ye düşüyordu:
       klavyeyle gezen okuyucu sayfanın en başına savruluyor, ekran okuyucu
       da nerede olduğunu kaybediyordu. WCAG 2.4.3 gereği odak, diyaloğu
       açan öğeye döner. */
    if (!navigatingRef.current) {
      const opener = paletteReturnFocus;
      requestAnimationFrame(() => {
        if (opener?.isConnected && opener.getClientRects().length) opener.focus();
      });
    }
    paletteReturnFocus = null;
    navigatingRef.current = false;
  }, []);

  const openPalette = useCallback(() => {
    paletteReturnFocus = triggerRef.current;
    setRecent(readRecent());
    togglePalette(true);
  }, []);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!open) {
          paletteReturnFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          setRecent(readRecent());
        }
        togglePalette((value) => {
          if (value) {
            // Kapanırken alanları da temizle
            queueMicrotask(close);
          }
          return !value;
        });
      }
      /* ESCAPE YALNIZCA PALET AÇIKKEN. Dinleyici pencerede duruyor ve
         koşulsuz `close()` çağırıyordu: palet kapalıyken basılan her Escape
         — tarayıcının otomatik doldurma listesini kapatmak, bir menüden
         çıkmak, alışkanlıktan — odağı sayfanın neresinde olursa olsun arama
         DÜĞMESİNE zıplatıyordu, çünkü `close()` odağı tetikleyiciye geri
         veriyor. Klavyeyle gezen okuyucu için bu, okuduğu yeri kaybetmek
         demek. */
      if (event.key === "Escape" && open) close();
    }
    /* Kısayolu YALNIZCA sahip dinler: iki örnek de dinleseydi ⌘K durumu iki
       kez çevirir ve palet hiç açılmazdı. */
    if (!owns) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, owns, open]);

  // Açılınca odaklan — yalnızca DOM etkisi, setState yok.
  useEffect(() => {
    if (!open || !owns) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open, owns]);

  /* Palet açıkken arkadaki sayfa kaymaz — özellikle mobilde şart — ve
     arkadaki her şey ERİŞİLEBİLİRLİK AĞACINDAN ÇIKAR.

     `aria-modal="true"` tek başına yetmiyordu: bazı ekran okuyucular sanal
     imleçle arkadaki sayfayı okumaya devam ediyor. `inert` hem odağı hem
     okumayı kesiyor ve portal `document.body`'nin çocuğu olduğu için
     kardeşlerini işaretlemek yeterli. Kapanışta yalnızca BİZİM eklediğimiz
     işaret kaldırılıyor — başka bir bileşen aynı öğeyi inert yaptıysa
     onun kararına dokunulmuyor. */
  /* SAHİP DEĞİLSE HİÇ KOŞMAZ. `open` durumu iki örnek arasında paylaşıldığı
     için bu efekt sahip olmayan örnekte de çalışıyordu ve orada
     `panelRef.current` NULL: `child.contains(null)` her zaman false döndüğü
     için portal dahil belgedeki HER ŞEY inert işaretleniyor, paletin kendisi
     de tıklanamaz ve yazılamaz hâle geliyordu. */
  useEffect(() => {
    if (!open || !owns) return;
    /* KİLİT KÖK ELEMANDA, GÖVDEDE DEĞİL. Kaydıran eleman `html`
       (`document.scrollingElement`), gövde değil: `body`ye yazılan
       `overflow: hidden` hiçbir şeyi durdurmuyordu. Ölçüldü — palet açıkken
       `window.scrollTo(0, 600)` sayfayı 600 piksel kaydırıyor, yani okuyucu
       arama kutusunda yazarken arkadaki liste de kayıyordu (telefonda
       parmak paletin dışına taştığında sürekli oluyor). */
    const root = document.documentElement;
    const previous = root.style.overflowY;
    root.style.overflowY = "hidden";

    const marked: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child.contains(panelRef.current)) continue;
      if (child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      marked.push(child);
    }

    return () => {
      root.style.overflowY = previous;
      for (const child of marked) child.removeAttribute("inert");
    };
  }, [open, owns]);

  /* ODAK TUZAĞI. Tab, panelin son odaklanabilir öğesinden sonra arkadaki
     GÖRÜNMEYEN bağlantılara geçiyordu: okuyucu ekranda hiçbir şeyin
     seçilmediği bir turda dolaşıyordu. Tab ve Shift+Tab artık panelin ilk ve
     son öğesi arasında dönüyor. `inert` çoğu tarayıcıda bunu zaten sağlıyor;
     bu, desteklemeyen tarayıcılar için ikinci kilit. */
  useEffect(() => {
    if (!open || !owns) return;
    function onTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;
      if (event.shiftKey && (activeEl === first || !panel.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onTab, true);
    return () => document.removeEventListener("keydown", onTab, true);
  }, [open, owns]);

  /* SEÇİLİ SATIR GÖRÜNÜR ALANA KAYDIRILIYOR.
     Ok tuşları `active` indeksini ilerletiyor ve `aria-activedescendant`
     ekran okuyucuya doğru satırı söylüyordu, ama liste kabı kendi içinde
     kayıyor (`max-h-[60dvh] overflow-y-auto`) ve GÖRSEL olarak hiçbir şey
     kaymıyordu: altıncı satırdan sonra klavye kullanan okuyucunun seçimi
     ekranın dışına çıkıyor, ne seçtiğini göremeden Enter'a basıyordu.
     `block: "nearest"` sayfayı zıplatmıyor — yalnızca gerekiyorsa ve
     yalnızca kabın içinde kaydırıyor.
     Kimlikle arama güvenli: paleti tek örnek sahipleniyor (bkz. dosya
     başındaki "PALET TEK ÖRNEK OLMALI" künyesi), yani bu id belgede tek. */
  useEffect(() => {
    if (!open || !owns) return;
    document
      .getElementById(`palet-secenek-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, owns]);

  // Debounce'lu arama — tüm setState çağrıları zamanlayıcı/ağ callback'inde.
  useEffect(() => {
    if (!open || !owns) return;
    const term = query.trim();
    if (!term) return;

    const controller = new AbortController();
    const key = term.toLocaleLowerCase("tr-TR");
    const cached = SEARCH_CACHE.get(key);
    const id = window.setTimeout(async () => {
      if (cached) {
        setFailure(null);
        setHits(cached.hits ?? []);
        setWritings(cached.writings ?? []);
        setActive(0);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as SearchResponse;
        if (!res.ok || data.error) {
          setHits([]);
          setWritings([]);
          setActive(0);
          setFailure(
            res.status === 429
              ? rateLimitedLabel.replace(
                  "{saniye}",
                  res.headers.get("Retry-After") ?? "60",
                )
              : failedLabel,
          );
          return;
        }
        setFailure(null);
        setHits(data.hits ?? []);
        setWritings(data.writings ?? []);
        setActive(0);
        SEARCH_CACHE.set(key, data);
        if (SEARCH_CACHE.size > SEARCH_CACHE_MAX) {
          SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value as string);
        }
      } catch {
        // İptal edilen istekler sessizce geçilir.
      } finally {
        setLoading(false);
      }
    }, cached ? 0 : SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open, owns, rateLimitedLabel, failedLabel]);

  const go = useCallback(
    (href: string, remember?: Recent) => {
      if (remember) pushRecent(remember);
      navigatingRef.current = true;
      close();
      startRouteProgress(href);
      router.push(href);
    },
    [router, close],
  );

  // Kutu boşaltıldığında eski sonuçlar gösterilmez — türetilmiş görünüm.
  const shownHits = query.trim() ? hits : [];
  const shownWritings = query.trim() ? writings : [];

  /* Klavye gezinmesi TEK bir düz liste üzerinde yürür. İki ayrı bölüm iki
     ayrı indeks tutsaydı ok tuşu sembollerin sonunda takılırdı; okuyucu için
     bunlar tek bir sonuç listesi, başlıklar yalnızca gruplama. */
  /* Teknik analizi olan sembol İKİ satır: şirket sayfası ve hemen altında
     teknik analiz. İkisi de aynı düz listede, ok tuşu ikisinden de geçer. */
  const hitRows = shownHits.flatMap((hit) => [
    { hit, kind: "stock" as const, href: `/hisse/${hit.symbol}` },
    ...(hit.technical ? [{ hit, kind: "technical" as const, href: `/teknik/${hit.symbol}` }] : []),
  ]);
  const navItems = [
    ...hitRows.map((row) => row.href),
    ...shownWritings.map((w) => `/${w.kind}/${w.slug}`),
  ];

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, navItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const href = navItems[active];
      if (href) {
        const row = hitRows[active];
        go(href, row ? { symbol: row.hit.symbol, name: row.hit.name } : undefined);
        return;
      }
      /* SONUÇ YOKKEN ENTER UYDURMA ADRESE GİTMEZ. Eskiden yazılan her şey
         doğrudan `/hisse/<METİN>` adresine çevriliyordu: "tesla motors"
         yazan biri ekranda "sonuç yok" görürken Enter'a bastığında
         `/hisse/TESLA MOTORS` gibi kesin 404 bir adrese düşüyordu. Yalnızca
         gerçekten sembole benzeyen bir metin geçiyor. */
      const typed = query.trim().toUpperCase();
      if (typed && isValidSymbol(typed)) go(`/hisse/${typed}`);
    }
  }

  return (
    <>
      {/* 1280px altında 36'lık kare, üstünde 240px'lik ⌘K alanı.
          Masthead dokuz sekme taşırken alan yalnızca 1536 üstünde
          açılabiliyordu; tek şeride inen düzen 1280'de yer açtı (ölçüm
          nav-items.ts yorumunda). Kısayol her genişlikte çalışıyor. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPalette}
        /* AD GÖRÜNEN METİNLE AYNI. Geniş alanda "Sembol veya Olay Ara"
           yazıyor; erişilebilir ad "Ara" kalınca sesle kumanda eden biri
           gördüğü metni söylediğinde düğme bulunmuyordu (WCAG 2.5.3). */
        aria-label={placeholderShort}
        aria-keyshortcuts="Meta+K Control+K"
        /* KONTRAST. Kutu neredeyse görünmez bir yüzey (`bg-surface`,
           açık temada beyazın üstünde %3) ve ikon en soluk ton
           (`text-muted`) taşıyordu: telefonda düğme bir leke gibi
           duruyor, ikon da bulanık okunuyordu. Yüzey bir kademe yukarı,
           ikon gövde mürekkebine çıktı. */
        /* HAP, KUTU DEĞİL (23 Eylül, sahibinin isteği: "daha premium").
           Arama 11 piksel köşeli bir kutuydu, yanındaki hesap düğmesi gri
           dolgulu bir kare: iki kontrol iki ayrı aileden. İkisi artık aynı
           yükseklikte (masaüstünde 40), tam yuvarlak ve aynı yüzeyde; stil
           globals.css → `.masthead-search`. */
        className="masthead-search inline-flex size-11 items-center justify-center gap-2.5 rounded-full border text-base transition-colors xl:w-64 xl:justify-start"
      >
        <span className="masthead-search-icon" aria-hidden>
          <MagnifyingGlass weight="bold" size={15} className="shrink-0" />
        </span>
        <span className="hidden truncate text-muted xl:inline">{placeholderShort}</span>
        <kbd aria-hidden className="masthead-kbd ml-auto hidden font-sans xl:inline-flex">
          ⌘K
        </kbd>
      </button>

      {/* Portal: sticky/backdrop-filter atalarının stacking bağlamından kaçar —
          Safari'de karartmanın yalnızca üst şeride uygulanma hatasını da çözer. */}
      {/* PORTAL HER ZAMAN, PANEL KOŞULLU. `AnimatePresence` çıkış
          animasyonunu oynatabilmek için kaldırılan çocuğu bir süre daha
          ağaçta tutar; bunun için kendisi kalıcı olmalı, koşul onun İÇİNDE.
          Karartma yalnızca opaklık, panel üstten iner ve ölçeklenir —
          Motion `reducedMotion="user"` ile dönüşümleri kapatır, opaklık kalır. */}
      {owns &&
        createPortal(
          <AnimatePresence>
            {open && (
        <motion.div
          key="search-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          /* Mobilde palet ekranın en tepesinden açılıyor; üst dolgu güvenli
             alanı taşımazsa arama kutusu çentiğin altında kalıyor ve
             dokunulamıyor. Masaüstünde 112px'lik boşluk zaten var. */
          className="fixed inset-0 z-50 flex items-start justify-center bg-scrim pt-[env(safe-area-inset-top)] sm:px-4 sm:pt-[112px]"
          onClick={close}
          role="presentation"
        >
          {/* Mobilde üstten tam genişlik bir sayfa gibi açılır — küçük ekranda
              yüzen kutu yerine ferah, zoom'suz bir arama yüzeyi. */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full overflow-hidden border-b border-line-strong bg-overlay-surface shadow-(--shadow-overlay) sm:max-w-[640px] sm:rounded-xl sm:border"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="flex items-center gap-3 border-b border-line px-5">
              <MagnifyingGlass
                weight="duotone"
                size={18}
                className="shrink-0 text-muted"
              />
              {/* COMBOBOX SEMANTİĞİ. Ok tuşları seçili satırı değiştiriyordu
                  ama bu yalnızca bir zemin rengiyle anlatılıyordu: ekran
                  okuyucu kullanıcısı ↓ tuşuna bastığında HİÇBİR ŞEY duymuyor,
                  hangi sonucun üzerinde olduğunu ve Enter'ın nereye
                  götüreceğini bilmiyordu. `aria-activedescendant` seçili
                  seçeneği input'un odağını bozmadan duyuruyor. */}
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                aria-label={placeholder}
                role="combobox"
                aria-expanded={navItems.length > 0}
                aria-controls="palet-sonuclari"
                aria-autocomplete="list"
                aria-activedescendant={
                  navItems[active] ? `palet-secenek-${active}` : undefined
                }
                className="palette-input h-14 flex-1 bg-transparent text-lead font-semibold text-strong outline-none placeholder:font-normal placeholder:text-muted"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={close}
                className="flex shrink-0 items-center justify-center rounded-xs bg-surface-elevated px-[7px] py-[3px] text-tiny text-muted transition-colors hover:text-strong max-sm:size-11 max-sm:px-0"
                aria-label={closeLabel}
              >
                <span className="max-sm:hidden">ESC</span>
                <X size={16} className="sm:hidden" />
              </button>
            </div>

            {/* ARAMA SÜRERKEN giriş kutusunun altında akan ince bir ışık
                (gezinme göstergesiyle aynı dil). Önbellekten gelen sonuçta hiç
                görünmüyor. */}
            <span aria-hidden className="palette-progress" data-on={loading || undefined} />
            {/* LISTBOX. Kabın kendisi `role="listbox"` ve her sonuç bir
                `option`; input `aria-controls` ile buraya bağlı. Popüler
                semboller ve boş durum metni seçenek DEĞİL — onlar
                `role="presentation"` ile listeden çıkarılıyor, yoksa ekran
                okuyucu "8 seçenekten 1'i" derken sekiz hisse çipini de
                sayıyordu. */}
            <div
              id="palet-sonuclari"
              role="listbox"
              aria-label={label}
              className="max-h-[60dvh] overflow-y-auto py-2.5 sm:max-h-[45vh]"
            >
              {/* KUTU BOŞKEN: önce son aramalar (varsa), sonra popüler semboller.
                  İkisi de logolu karolar — boş bir pencere yerine yön. */}
              {!query.trim() && (
                <div role="presentation" className="flex flex-col gap-4 px-5 pb-2 pt-2">
                  {recent.length > 0 && (
                    <div>
                      <p className="palette-group">
                        <ClockCounterClockwise size={13} weight="bold" aria-hidden />
                        {recentLabel}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {recent.map((item, index) => (
                          <button
                            key={item.symbol}
                            type="button"
                            onClick={() => go(`/hisse/${item.symbol}`, item)}
                            className="palette-chip palette-row"
                            style={{ animationDelay: `${index * 28}ms` }}
                          >
                            <LogoTile symbol={item.symbol} size="xs" />
                            <span className="font-bold text-strong">{item.symbol}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="palette-group">{popularLabel}</p>
                    <div className="palette-popular mt-2.5">
                      {POPULAR_PICKS.map((pick, index) => (
                        <button
                          key={pick.symbol}
                          type="button"
                          onClick={() => go(`/hisse/${pick.symbol}`, pick)}
                          className="palette-tile palette-row"
                          style={{ animationDelay: `${index * 28}ms` }}
                        >
                          <LogoTile symbol={pick.symbol} size="md" />
                          <span className="min-w-0 text-left">
                            <b className="block text-small font-bold text-strong">{pick.symbol}</b>
                            <small className="block truncate text-tiny text-body">{pick.name}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {shownHits.length > 0 && (
                <p
                  id="palet-grup-semboller"
                  className="palette-group px-5 pb-1.5 pt-2"
                >
                  {companiesLabel}
                </p>
              )}

              {hitRows.map(({ hit, kind, href }, index) =>
                kind === "stock" ? (
                  <button
                    key={href}
                    id={`palet-secenek-${index}`}
                    style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}
                    role="option"
                    aria-selected={index === active}
                    type="button"
                    onClick={() => go(href, { symbol: hit.symbol, name: hit.name })}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "palette-row palette-option flex w-full items-center gap-3 px-5 py-2.5 text-left text-base max-sm:py-3",
                      index === active && "is-active",
                    )}
                  >
                    <LogoTile symbol={hit.symbol} logoUrl={hit.logo} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-strong">
                        <Highlight text={hit.symbol} term={query} />
                      </span>
                      <span className={cn("block truncate text-small", index === active ? "text-strong" : "text-body")}>
                        <Highlight text={hit.name} term={query} />
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden size={15} className="palette-go shrink-0" />
                  </button>
                ) : (
                  <button
                    key={href}
                    id={`palet-secenek-${index}`}
                    style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}
                    role="option"
                    aria-selected={index === active}
                    type="button"
                    onClick={() => go(href, { symbol: hit.symbol, name: hit.name })}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      /* Telefonda 44px: hisse satırıyla bitişik ve daha küçük
                         bir hedef parmakla ıskalanıyordu (tap-44 notu). */
                      "palette-row palette-option flex w-full items-center gap-3 py-2 pl-5 pr-5 text-left text-small max-sm:min-h-11",
                      index === active && "is-active",
                    )}
                  >
                    <span aria-hidden className="w-8 shrink-0 text-center text-muted">
                      ↳
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate font-semibold", index === active ? "text-primary-ink" : "text-primary")}>
                      {technicalLabel}
                      <span className="sr-only"> · {hit.symbol}</span>
                    </span>
                  </button>
                ),
              )}

              {/* ---- Yazılar ----
                  Sembolden SONRA: paletin ana işi hâlâ hisseye gitmek ve
                  "NVDA" yazan biri ilk satırda NVDA görmeli. Yazı sonuçları
                  aynı listenin devamı olarak okunuyor, ayrı bir sekme değil. */}
              {shownWritings.length > 0 && (
                <p
                  id="palet-grup-yazilar"
                  className="palette-group px-5 pb-1.5 pt-2"
                >
                  {writingsLabel}
                </p>
              )}

              {shownWritings.map((writing, index) => {
                const position = hitRows.length + index;
                return (
                  <button
                    key={`${writing.kind}-${writing.slug}`}
                    id={`palet-secenek-${position}`}
                    style={{ animationDelay: `${Math.min(position, 8) * 22}ms` }}
                    role="option"
                    aria-selected={position === active}
                    type="button"
                    onClick={() => go(`/${writing.kind}/${writing.slug}`)}
                    onMouseEnter={() => setActive(position)}
                    className={cn(
                      "palette-row palette-option flex w-full items-start gap-3 px-5 py-2.5 text-left max-sm:py-3",
                      position === active && "is-active",
                    )}
                  >
                    <span className="plate w-[60px] shrink-0 pt-[3px] text-nano text-primary">
                      {writing.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-base font-semibold",
                          position === active ? "text-strong" : "text-body",
                        )}
                      >
                        <Highlight text={writing.title} term={query} />
                      </span>
                      <span className="mt-0.5 block truncate text-tiny text-muted">
                        {writing.dek}
                      </span>
                    </span>
                  </button>
                );
              })}

              {!loading && query.trim() && failure && (
                <p
                  role="alert"
                  className="px-5 py-6 text-center text-sm text-down"
                >
                  {failure}
                </p>
              )}

              {!loading &&
                !failure &&
                query.trim() &&
                shownHits.length === 0 &&
                shownWritings.length === 0 && (
                  /* SONUÇ YOK, ZİL ARIYOR. Paletin tüm sonuç alanı boşken
                     tek satırlık bir cümle bekleyişin sonu gibi duruyordu;
                     burası sayfa düzeyinde bir boşluk (sahne kuralı), zil
                     etrafına bakınıp soru işaretini yazıyor. 1,6 hızda:
                     yazan biri 5,6 saniyelik sahnenin sonunu beklemez. Yazmaya
                     devam edildikçe öğe yerinde kalıyor, sahne baştan
                     oynamıyor. */
                  <div className="flex flex-col items-center gap-1 px-5 pb-6 pt-2 text-center">
                    <InkCanvas scene="searching" seed={21} rate={1.6} className="h-[84px] w-[134px]" />
                    <p className="text-sm text-muted">{emptyLabel}</p>
                  </div>
                )}
            </div>

            {/* Klavye ipuçları — palet açıkken ne yapılabileceğini söyler. */}
            <div className="hidden gap-[18px] border-t border-line px-5 py-3 text-tiny text-muted sm:flex">
              <span>↑↓ {hints.move}</span>
              <span>↵ {hints.open}</span>
              {shownHits.length > 0 && (
                <span className="ml-auto numeral">
                  {shownHits.length}
                </span>
              )}
            </div>
          </motion.div>
        </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
