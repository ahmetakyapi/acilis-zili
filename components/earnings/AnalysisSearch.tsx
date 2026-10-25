"use client";

import { createContext, useContext, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { cn, plural } from "@/lib/utils";

/**
 * Analizler sekmesinin araması — kutu sekmenin altında, tablo sayfanın
 * ortasında (25 Ekim).
 *
 * NEDEN AYRILDI. Arama kutusu tablonun içindeydi (`AnalysisTable`) ve
 * tablonun üstünde öne çıkan analiz kartı, haftanın analizleri ve
 * yaklaşanlar duruyor: kutu 390'da y=1048'de, 1280'de 916'da, yani iki
 * genişlikte de ilk ekranın altındaydı. Altmış satırlık arşivin tek arama
 * yolu ekranın asıl işi; kutu sekme çubuğunun hemen altına çıktı.
 *
 * Durum burada, tablo okuyor: kutu ve tablo arasındaki sunucu bileşenleri
 * (kart, paneller) `children` olarak geçiyor, istemciye taşınmıyor.
 *
 * ARARKEN ÖNE ÇIKANLAR KATLANIYOR. Kutu artık tablodan bir kart boyu
 * yukarıda; yazarken sonuçlar o kartın altında kalsaydı okuyucu her harfte
 * aşağı bakmak zorunda kalırdı. `AnalysisSearchScope` aranırken
 * `data-searching` basıyor ve CSS öne çıkan kartı, haftanın panelini ve
 * yaklaşanları gizliyor (`.workspace[data-searching]`); sonuç listesi
 * kutunun hemen altına geliyor. Kutu boşalınca hepsi yerine döner.
 *
 * Bağlam yoksa (takip sekmesi) tablo kendi kutusunu basmaya devam ediyor.
 */
type SearchState = {
  query: string;
  /** Okuyucu süzgeci kullandı mı — satır oturma animasyonu bundan sonra. */
  filtered: boolean;
  search: (value: string) => void;
  /** Tablonun bildirdiği görünen satır sayısı (sonuç künyesi). */
  count: number | null;
  setCount: (count: number | null) => void;
};

const SearchContext = createContext<SearchState | null>(null);

export function useAnalysisSearch() {
  return useContext(SearchContext);
}

export function AnalysisSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const value = useMemo<SearchState>(
    () => ({
      query,
      filtered,
      search: (next: string) => {
        setFiltered(true);
        setQuery(next);
      },
      count,
      setCount,
    }),
    [query, filtered, count],
  );
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

/** Aranırken `data-searching` basan sarmalayıcı (stil sayfada). */
export function AnalysisSearchScope(props: ComponentProps<"div">) {
  const state = useContext(SearchContext);
  const searching = (state?.query.trim().length ?? 0) > 0;
  return <div {...props} data-searching={searching || undefined} />;
}

export function AnalysisSearchField({
  labels,
  className,
}: {
  labels: {
    searchPlaceholder: string;
    searchClear: string;
    resultCountOne: string;
    resultCountMany: string;
  };
  className?: string;
}) {
  const state = useContext(SearchContext);
  if (!state) return null;
  const { query, search, count } = state;
  const searching = query.trim().length > 0;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {/* Kutunun ölçüleri tablodaki eski kutuyla aynı (h-10, tam genişlik
          telefonda); geniş ekranda okunur bir tavanla. */}
      <label className="relative flex w-full min-w-0 items-center sm:max-w-md sm:flex-1">
        <MagnifyingGlass
          weight="duotone"
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          aria-controls="analysis-archive"
          className={cn(
            "h-10 w-full min-w-0 rounded-md border border-line bg-surface pl-9 pr-9 text-base text-strong",
            "placeholder:text-muted focus:border-line-focus focus:outline-none",
            // Safari'nin kendi temizleme düğmesi bizimkiyle üst üste biniyor.
            "[&::-webkit-search-cancel-button]:hidden",
          )}
        />
        {searching && (
          <button
            type="button"
            onClick={() => search("")}
            aria-label={labels.searchClear}
            className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-elevated hover:text-strong"
          >
            <X weight="bold" size={12} />
          </button>
        )}
      </label>
      {searching && count !== null && (
        <span className="numeral shrink-0 text-small text-muted" aria-live="polite">
          {plural(count, labels.resultCountOne, labels.resultCountMany).replace("{count}", String(count))}
        </span>
      )}
    </div>
  );
}
