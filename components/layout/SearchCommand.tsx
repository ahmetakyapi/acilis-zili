"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";

/**
 * ⌘K sembol arama.
 * Yerel tablodan gelen sonuçlar anında, sağlayıcıdan gelenler gecikmeli
 * görünür; kullanıcı beklerken kutu boş kalmaz.
 */
export function SearchCommand({
  placeholder,
  label,
  emptyLabel,
}: {
  placeholder: string;
  label: string;
  emptyLabel: string;
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
      <button
        type="button"
        onClick={openPalette}
        aria-label={label}
        className="inline-flex items-center gap-2 rounded-(--radius-md) border border-line px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-soft lg:w-64 lg:justify-between"
      >
        <span className="flex items-center gap-2">
          <Search size={16} strokeWidth={1.8} />
          <span className="hidden lg:inline">{label}</span>
        </span>
        <kbd className="numeral hidden rounded border border-line px-1.5 py-0.5 text-[10px] lg:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px]"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-(--radius-xl) border border-line bg-surface-elevated shadow-(--shadow-overlay)"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="flex items-center gap-3 border-b border-line-soft px-4">
              <Search size={17} className="shrink-0 text-muted" strokeWidth={1.8} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                className="h-12 flex-1 bg-transparent text-sm text-strong outline-none placeholder:text-muted"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={close}
                className="shrink-0 text-muted transition-colors hover:text-strong"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto py-1">
              {shownHits.map((hit, index) => (
                <button
                  key={hit.symbol}
                  type="button"
                  onClick={() => go(hit.symbol)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    index === active ? "bg-primary-wash" : "hover:bg-surface",
                  )}
                >
                  <span className="numeral w-16 shrink-0 text-sm font-semibold text-strong">
                    {hit.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-soft">
                    {hit.name}
                  </span>
                </button>
              ))}

              {!loading && query.trim() && shownHits.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  {emptyLabel}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
