"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import type {
  SearchHit,
  SearchResponse,
  WritingHit,
} from "@/app/api/search/route";
import { cn, isValidSymbol } from "@/lib/utils";

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

/** Boş kutuda önerilen semboller — takip evreninin merkezî isimleri. */
const POPULAR_PICKS = [
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "MU", name: "Micron" },
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
] as const;

export function SearchCommand({
  placeholder,
  placeholderShort,
  label,
  emptyLabel,
  rateLimitedLabel,
  failedLabel,
  popularLabel,
  companiesLabel,
  writingsLabel,
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
  companiesLabel: string;
  /** "Yazılar" — rehber ve mercek sonuçlarının başlığı. */
  writingsLabel: string;
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
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
    navigatingRef.current = false;
  }, []);

  const openPalette = useCallback(() => togglePalette(true), []);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        togglePalette((value) => {
          if (value) {
            // Kapanırken alanları da temizle
            queueMicrotask(close);
          }
          return !value;
        });
      }
      if (event.key === "Escape") close();
    }
    /* Kısayolu YALNIZCA sahip dinler: iki örnek de dinleseydi ⌘K durumu iki
       kez çevirir ve palet hiç açılmazdı. */
    if (!owns) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, owns]);

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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const marked: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child.contains(panelRef.current)) continue;
      if (child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      marked.push(child);
    }

    return () => {
      document.body.style.overflow = previous;
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

  // Debounce'lu arama — tüm setState çağrıları zamanlayıcı/ağ callback'inde.
  useEffect(() => {
    if (!open || !owns) return;
    const term = query.trim();
    if (!term) return;

    const controller = new AbortController();
    const id = window.setTimeout(async () => {
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
      } catch {
        // İptal edilen istekler sessizce geçilir.
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open, owns, rateLimitedLabel, failedLabel]);

  const go = useCallback(
    (href: string) => {
      navigatingRef.current = true;
      close();
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
  const navItems = [
    ...shownHits.map((hit) => `/hisse/${hit.symbol}`),
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
        go(href);
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
      {/* 1536px altında kare düğme, üstünde 248px'lik ⌘K alanı.
          Gezinme dokuz sekmeye çıkınca geniş arama kutusu masthead'i
          taşırıyordu; kısayol yine çalışıyor, ikon da yerinde. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPalette}
        aria-label={label}
        /* KONTRAST. Kutu neredeyse görünmez bir yüzey (`bg-surface`,
           açık temada beyazın üstünde %3) ve ikon en soluk ton
           (`text-muted`) taşıyordu: telefonda düğme bir leke gibi
           duruyor, ikon da bulanık okunuyordu. Yüzey bir kademe yukarı,
           ikon gövde mürekkebine çıktı. */
        className="inline-flex size-11 items-center justify-center gap-2.5 rounded-lg border border-line bg-surface-elevated text-base text-body transition-colors hover:border-line-strong hover:text-strong lg:size-9 2xl:size-auto 2xl:w-[248px] 2xl:justify-start 2xl:rounded-md 2xl:px-3 2xl:py-2"
      >
        {/* `bold`, `duotone` değil: 15 pikselde duotone büyütecin sapını
            neredeyse görünmez yapıyordu. */}
        <MagnifyingGlass weight="bold" size={16} className="shrink-0" />
        <span className="hidden 2xl:inline">{placeholderShort}</span>
        <kbd className="ml-auto hidden rounded bg-surface-elevated px-[5px] py-0.5 text-nano 2xl:inline">
          ⌘K
        </kbd>
      </button>

      {/* Portal: sticky/backdrop-filter atalarının stacking bağlamından kaçar —
          Safari'de karartmanın yalnızca üst şeride uygulanma hatasını da çözer. */}
      {open &&
        owns &&
        createPortal(
        <div
          /* Mobilde palet ekranın en tepesinden açılıyor; üst dolgu güvenli
             alanı taşımazsa arama kutusu çentiğin altında kalıyor ve
             dokunulamıyor. Masaüstünde 112px'lik boşluk zaten var. */
          className="fixed inset-0 z-50 flex items-start justify-center bg-scrim pt-[env(safe-area-inset-top)] sm:px-4 sm:pt-[112px]"
          onClick={close}
          role="presentation"
        >
          {/* Mobilde üstten tam genişlik bir sayfa gibi açılır — küçük ekranda
              yüzen kutu yerine ferah, zoom'suz bir arama yüzeyi. */}
          <div
            ref={panelRef}
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
                aria-label="Kapat"
              >
                <span className="max-sm:hidden">ESC</span>
                <X size={16} className="sm:hidden" />
              </button>
            </div>

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
              {/* Kutu boşken popüler semboller — boş bir pencere yerine yön */}
              {!query.trim() && (
                <div role="presentation" className="px-5 pb-2 pt-2">
                  <p className="plate text-nano tracking-[0.08em]">
                    {popularLabel}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {POPULAR_PICKS.map((pick) => (
                      <button
                        key={pick.symbol}
                        type="button"
                        onClick={() => go(`/hisse/${pick.symbol}`)}
                        className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 sm:min-h-[34px] text-xs transition-colors hover:border-line-strong hover:bg-primary-tint"
                      >
                        <span className="font-bold text-strong">
                          {pick.symbol}
                        </span>
                        <span className="text-muted">{pick.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {shownHits.length > 0 && (
                <p
                  id="palet-grup-semboller"
                  className="plate px-5 pb-1.5 pt-2 text-nano tracking-[0.08em]"
                >
                  {companiesLabel}
                </p>
              )}

              {shownHits.map((hit, index) => (
                <button
                  key={hit.symbol}
                  id={`palet-secenek-${index}`}
                  role="option"
                  aria-selected={index === active}
                  type="button"
                  onClick={() => go(`/hisse/${hit.symbol}`)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-3.5 px-5 py-2.5 text-left text-base transition-colors max-sm:py-3",
                    index === active ? "bg-primary-wash" : "hover:bg-surface",
                  )}
                >
                  <span className="w-[60px] shrink-0 font-bold text-strong">
                    {hit.symbol}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      index === active ? "text-strong" : "text-body",
                    )}
                  >
                    {hit.name}
                  </span>
                </button>
              ))}

              {/* ---- Yazılar ----
                  Sembolden SONRA: paletin ana işi hâlâ hisseye gitmek ve
                  "NVDA" yazan biri ilk satırda NVDA görmeli. Yazı sonuçları
                  aynı listenin devamı olarak okunuyor, ayrı bir sekme değil. */}
              {shownWritings.length > 0 && (
                <p
                  id="palet-grup-yazilar"
                  className="plate px-5 pb-1.5 pt-2 text-nano tracking-[0.08em]"
                >
                  {writingsLabel}
                </p>
              )}

              {shownWritings.map((writing, index) => {
                const position = shownHits.length + index;
                return (
                  <button
                    key={`${writing.kind}-${writing.slug}`}
                    id={`palet-secenek-${position}`}
                    role="option"
                    aria-selected={position === active}
                    type="button"
                    onClick={() => go(`/${writing.kind}/${writing.slug}`)}
                    onMouseEnter={() => setActive(position)}
                    className={cn(
                      "flex w-full items-start gap-3.5 px-5 py-2.5 text-left transition-colors max-sm:py-3",
                      position === active ? "bg-primary-wash" : "hover:bg-surface",
                    )}
                  >
                    <span className="plate w-[60px] shrink-0 pt-[3px] text-micro tracking-[0.08em] text-primary">
                      {writing.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-base font-semibold",
                          position === active ? "text-strong" : "text-body",
                        )}
                      >
                        {writing.title}
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
                  <p className="px-5 py-6 text-center text-sm text-muted">
                    {emptyLabel}
                  </p>
                )}
            </div>

            {/* Klavye ipuçları — palet açıkken ne yapılabileceğini söyler. */}
            <div className="hidden gap-[18px] border-t border-line px-5 py-3 text-tiny text-muted sm:flex">
              <span>↑↓ {hints.move}</span>
              <span>↵ {hints.open}</span>
              {shownHits.length > 0 && (
                <span className="ml-auto numeral">
                  {shownHits.length} · Finnhub
                </span>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
