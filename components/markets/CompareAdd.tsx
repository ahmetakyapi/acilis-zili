"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import type { SearchHit } from "@/app/api/search/route";
import { startRouteProgress } from "@/components/layout/RouteProgress";
import { useCompareOptional } from "@/components/markets/CompareLive";
import { compareHref } from "@/lib/compare";
import { cn } from "@/lib/utils";

/**
 * Karşılaştırma ekranına sembol EKLEME yolu.
 *
 * Hazır setler yalnızca liste boşken çiziliyordu; bir sembol seçildikten
 * sonra ekranda yalnızca ÇIKARMA vardı ve ekleme için tek yönlendirme bir
 * cümleydi: "bir hisse sayfasından Karşılaştır'a bas". Yani kullanıcı
 * sayfayı terk edip başka bir ekrana gidip geri gelmek zorundaydı. Dörtten
 * üçe düşen dördüncüyü geri koyamıyor, ikiden bire düşen tek sembolle
 * karşılaştırma ekranında sıkışıp kalıyordu.
 *
 * SEÇİM URL'DE YAŞIYOR, istemci durumunda değil: sonuç tıklanınca yeni
 * adrese gidiliyor ve sunucu geri kalanını yapıyor. Buradaki tek istemci
 * durumu arama kutusunun kendisi.
 */
export function CompareAdd({
  symbols,
  rangeParam,
  defaultOpen = false,
  wide = false,
  labels,
}: {
  symbols: string[];
  /** Boş ekranda kutu AÇIK başlar — orada eklemekten başka yapılacak yok. */
  defaultOpen?: boolean;
  /**
   * Kutu kabının TAMAMINI kaplar — boş ekranın kahraman bloğunda.
   *
   * Sabit `w-40 sm:w-48` giriş, şeritteki satır içi çip için doğru ölçü ama
   * ortalanmış bir kahraman bloğunun içinde minik bir kutu olarak duruyordu:
   * ekranın tek eylemi, ekranın en küçük öğesiydi.
   */
  wide?: boolean;
  /* Adres SUNUCUDAN GELEN FONKSİYONLA değil, veriyle kuruluyor: sunucu
     bileşeninden istemci bileşenine fonksiyon geçilemiyor. Seçili aralık
     varsayılan değilse korunuyor, değilse parametre hiç yazılmıyor. */
  rangeParam: string | null;
  labels: {
    add: string;
    placeholder: string;
    cancel: string;
    noResults: string;
  };
}) {
  const router = useRouter();
  /* ARALIK CANLI OKUNUYOR. `rangeParam` sunucudan gelen bir fotoğraf ve
     aralık artık istemcide değişiyor (`CompareLive`): 1Y'ye geçip sembol
     ekleyen okuyucu 6A'ya geri düşüyordu. Sağlayıcı yoksa (boş ekran) prop
     geçerli kalır. */
  const compare = useCompareOptional();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
  }, []);

  // Debounce'lu arama — setState yalnızca zamanlayıcı/ağ callback'inde.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { hits?: SearchHit[] };
        setHits(data.hits ?? []);
      } catch {
        // iptal edilen istekler sessizce geçilir
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open]);

  const pick = useCallback(
    (symbol: string) => {
      reset();
      const next = [...symbols, symbol];
      /* GEZİNME ÇUBUĞU ELLE YAKILIYOR. `RouteProgress` yalnızca `<a>`
         tıklamalarını yakalıyor; buradaki `router.push` onun göremediği bir
         gezinme ve okuyucu sonucu seçtikten sonra hiçbir işaret almadan
         bekliyordu. Aralık denetimi de bu bayrağa bakıp kendini kapatıyor —
         sığ adres güncellemesi uçuştaki bu gezinmeyi iptal ediyor. */
      startRouteProgress();
      router.push(
        compare
          ? compareHref(next, compare.range)
          : `/karsilastir?semboller=${next.join(",")}${
              rangeParam ? `&aralik=${rangeParam}` : ""
            }`,
      );
    },
    [compare, rangeParam, reset, router, symbols],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 20);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-small font-semibold text-soft transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary sm:min-h-9"
      >
        <Plus weight="bold" size={13} />
        {labels.add}
      </button>
    );
  }

  /* Zaten seçili olan sembol sonuçlarda GÖRÜNMEZ: tıklanınca aynı listeyi
     üreteceği için hiçbir şey olmuyormuş gibi görünürdü. */
  const shown = hits
    .filter((hit) => !symbols.includes(hit.symbol))
    .slice(0, 6);

  return (
    <div className={cn("relative", wide && "w-full")}>
      <div className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 sm:min-h-9">
        <MagnifyingGlass weight="duotone" size={14} className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") reset();
            if (event.key === "Enter") {
              event.preventDefault();
              /* Yalnızca listeden seçilen eklenir — yazılan metin sembol
                 sayılmaz; olmayan bir sembol tabloya "—" olarak girerdi. */
              if (shown[0]) pick(shown[0].symbol);
            }
          }}
          placeholder={labels.placeholder}
          className={cn(
            "h-8 bg-transparent text-sm text-strong outline-none placeholder:text-muted",
            wide ? "w-full min-w-0 flex-1" : "w-40 sm:w-48",
          )}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={reset}
          aria-label={labels.cancel}
          className="tap-44 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-strong"
        >
          <X size={13} />
        </button>
      </div>

      {query.trim() && (
        /* LİSTE MOBİLDE KIRPILMIYOR. `left-0 w-64` sabitti: düğme satırın
            sağ yarısındayken 256 piksellik liste sayfanın dışına taşıyor ve
            `html { overflow-x: clip }` yüzünden kaydırılamıyordu — sonuçlar
            görünmez oluyordu. Dar ekranda liste iki kenara yaslanıyor,
            geniş ekranda eski davranış.
            Zemin `--overlay-surface`: katman üstü için tanımlı ve iki temada
            da OPAK; `--surface-elevated` saydam ve altındaki grafik
            sonuçların içinden okunuyordu. */
        <ul
          className={cn(
            "absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-(--radius-md) border border-line bg-overlay-surface",
            /* Geniş kutuda liste de kutu kadar: kahraman bloğunda 256
               piksellik bir liste, altında durduğu alanın yarısı kadardı. */
            !wide && "sm:left-0 sm:right-auto sm:w-64",
          )}
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2.5 text-small text-muted">
              {labels.noResults}
            </li>
          ) : (
            shown.map((hit) => (
              <li key={hit.symbol}>
                <button
                  type="button"
                  onClick={() => pick(hit.symbol)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-primary-wash"
                >
                  <span className="numeral flex h-5 w-12 shrink-0 items-center justify-center rounded bg-primary-tint text-tiny font-semibold text-primary">
                    {hit.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-small text-body">
                    {hit.name}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
