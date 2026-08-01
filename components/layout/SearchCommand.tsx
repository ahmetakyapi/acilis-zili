"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";

/**
 * ⌘K sembol arama.
 * Yerel tablodan gelen sonuçlar anında, sağlayıcıdan gelenler gecikmeli
 * görünür; kullanıcı beklerken kutu boş kalmaz.
 */
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
  popularLabel,
  companiesLabel,
  hints,
}: {
  placeholder: string;
  /** Masthead alanında görünen kısa çağrı — "Sembol veya olay ara". */
  placeholderShort: string;
  label: string;
  emptyLabel: string;
  popularLabel: string;
  companiesLabel: string;
  /** Paletin alt şeridindeki klavye ipuçları. */
  hints: { move: string; open: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Kapanışta durum event handler'da sıfırlanır — effect içinde setState yok.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
    setLoading(false);
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => {
          if (value) {
            // Kapanırken alanları da temizle
            queueMicrotask(close);
          }
          return !value;
        });
      }
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Açılınca odaklan — yalnızca DOM etkisi, setState yok.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  // Palet açıkken arkadaki sayfa kaymaz — özellikle mobilde şart.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Debounce'lu arama — tüm setState çağrıları zamanlayıcı/ağ callback'inde.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) return;

    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits ?? []);
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
  }, [query, open]);

  const go = useCallback(
    (symbol: string) => {
      close();
      router.push(`/hisse/${symbol}`);
    },
    [router, close],
  );

  // Kutu boşaltıldığında eski sonuçlar gösterilmez — türetilmiş görünüm.
  const shownHits = query.trim() ? hits : [];

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, shownHits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = shownHits[active];
      if (hit) go(hit.symbol);
      else if (query.trim()) go(query.trim().toUpperCase());
    }
  }

  return (
    <>
      {/* Mobilde 30px kare, masaüstünde 248px'lik ⌘K alanı — mockup 4a/4b. */}
      <button
        type="button"
        onClick={openPalette}
        aria-label={label}
        className="inline-flex size-[30px] items-center justify-center gap-2.5 rounded-lg border border-line bg-surface text-[13px] text-muted transition-colors hover:border-line-strong hover:text-soft lg:size-auto lg:w-[248px] lg:justify-start lg:rounded-[9px] lg:px-3 lg:py-2"
      >
        <MagnifyingGlass weight="duotone" size={15} className="shrink-0" />
        <span className="hidden lg:inline">{placeholderShort}</span>
        <kbd className="ml-auto hidden rounded bg-surface-elevated px-[5px] py-0.5 text-[10.5px] lg:inline">
          ⌘K
        </kbd>
      </button>

      {/* Portal: sticky/backdrop-filter atalarının stacking bağlamından kaçar —
          Safari'de karartmanın yalnızca üst şeride uygulanma hatasını da çözer. */}
      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-scrim sm:px-4 sm:pt-[112px]"
          onClick={close}
          role="presentation"
        >
          {/* Mobilde üstten tam genişlik bir sayfa gibi açılır — küçük ekranda
              yüzen kutu yerine ferah, zoom'suz bir arama yüzeyi. */}
          <div
            className="w-full overflow-hidden border-b border-line-strong bg-overlay-surface shadow-(--shadow-overlay) sm:max-w-[640px] sm:rounded-2xl sm:border"
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
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                className="palette-input h-14 flex-1 bg-transparent text-[17px] font-semibold text-strong outline-none placeholder:font-normal placeholder:text-muted"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={close}
                className="flex shrink-0 items-center justify-center rounded-[5px] bg-surface-elevated px-[7px] py-[3px] text-[11px] text-muted transition-colors hover:text-strong max-sm:size-8 max-sm:px-0"
                aria-label="Kapat"
              >
                <span className="max-sm:hidden">ESC</span>
                <X size={16} className="sm:hidden" />
              </button>
            </div>

            <div className="max-h-[60dvh] overflow-y-auto py-2.5 sm:max-h-[45vh]">
              {/* Kutu boşken popüler semboller — boş bir pencere yerine yön */}
              {!query.trim() && (
                <div className="px-5 pb-2 pt-2">
                  <p className="plate text-[10.5px] tracking-[0.08em]">
                    {popularLabel}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {POPULAR_PICKS.map((pick) => (
                      <button
                        key={pick.symbol}
                        type="button"
                        onClick={() => go(pick.symbol)}
                        className="flex min-h-[34px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs transition-colors hover:border-line-strong hover:bg-primary-tint"
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
                <p className="plate px-5 pb-1.5 pt-2 text-[10.5px] tracking-[0.08em]">
                  {companiesLabel}
                </p>
              )}

              {shownHits.map((hit, index) => (
                <button
                  key={hit.symbol}
                  type="button"
                  onClick={() => go(hit.symbol)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-3.5 px-5 py-2.5 text-left text-[13.5px] transition-colors max-sm:py-3",
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

              {!loading && query.trim() && shownHits.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-muted">
                  {emptyLabel}
                </p>
              )}
            </div>

            {/* Klavye ipuçları — palet açıkken ne yapılabileceğini söyler. */}
            <div className="hidden gap-[18px] border-t border-line px-5 py-3 text-[11.5px] text-muted sm:flex">
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
