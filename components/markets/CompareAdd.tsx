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
    /** İstek uçarken — "sonuç yok" demeden önce. */
    searching: string;
    /** Arama ucu düştüğünde; "sembol yok" DEĞİL. */
    searchFailed: string;
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
  /* ARAMA DURUMU TÜRETİLİYOR, SAKLANMIYOR.
     "Sonuç yok" ile "henüz bakmadık" ayrı şeyler. `hits` boş başlıyor ve
     liste yalnızca uzunluğa bakıyordu: kutuya bir harf yazan okuyucu,
     200 ms'lik gecikme artı ağ turu boyunca "Bu sembol bulunamadı" cümlesini
     okuyordu — daha hiçbir yere sorulmamışken. İstek DÜŞTÜĞÜNDE de aynı
     cümle çıkıyordu (`!res.ok` sessizce dönüyordu), yani sağlayıcı hatası
     "böyle bir sembol yok" diye yazılıyordu. Aynı sınıf hata halka arz
     takviminde ve şirket haberlerinde de vardı; oradaki düzeltmenin emsali.

     Ayrı bir `durum` state'i denendi ve LİNT REDDETTİ: "aranıyor"u yazmanın
     tek yeri efekt gövdesiydi, o da `react-hooks/set-state-in-effect`e
     takılıyor. Kural yerinde — bu dosyanın kendi künyesi de "setState
     yalnızca zamanlayıcı/ağ callback'inde" diyor. Bilgi zaten elimizde:
     sonucu HANGİ TERİM için tuttuğumuzu saklarsak, "aranıyor" bunun
     yokluğundan çıkıyor. */
  const [sonuc, setSonuc] = useState<{ term: string; hits: SearchHit[] } | null>(
    null,
  );
  const [hataliTerim, setHataliTerim] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSonuc(null);
    setHataliTerim(null);
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
        if (!res.ok) {
          setHataliTerim(term);
          return;
        }
        const data = (await res.json()) as { hits?: SearchHit[] };
        setSonuc({ term, hits: data.hits ?? [] });
      } catch (error) {
        /* İPTAL HATA DEĞİL. Her tuş vuruşu bir öncekini iptal ediyor;
           onu "hata" saymak yazarken kutuyu kırmızıya boyardı. */
        if ((error as Error)?.name !== "AbortError") setHataliTerim(term);
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

  const term = query.trim();
  /* Sonucu hangi terim için tuttuğumuz belli; "aranıyor" onun yokluğu. */
  const durum: "bos" | "araniyor" | "hazir" | "hata" = !term
    ? "bos"
    : hataliTerim === term
      ? "hata"
      : sonuc?.term === term
        ? "hazir"
        : "araniyor";
  /* Zaten seçili olan sembol sonuçlarda GÖRÜNMEZ: tıklanınca aynı listeyi
     üreteceği için hiçbir şey olmuyormuş gibi görünürdü. */
  const shown = (sonuc?.hits ?? [])
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
          /* YER TUTUCU ERİŞİLEBİLİR AD DEĞİL. Kutunun görünen tek açıklaması
             `placeholder`dı ve o, yazmaya başlayınca KAYBOLUYOR; ekran
             okuyucu desteği de tutarsız. Sonuç, alanın adsız duyurulmasıydı
             ("düzenleme, boş"). Aynı yerde ⌘K paleti bunu doğru yapıyor
             (`SearchCommand` → `aria-label={placeholder}`); bu kutu ve
             favorilerdeki eşi atlanmış. Görünür etiket EKLENMİYOR: kutu bir
             büyüteç ikonuyla birlikte tek satırlık bir çip ve üstüne etiket
             koymak düzeni bozardı — ad erişilebilirlik ağacında duruyor. */
          aria-label={labels.placeholder}
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
              {durum === "araniyor"
                ? labels.searching
                : durum === "hata"
                  ? labels.searchFailed
                  : labels.noResults}
            </li>
          ) : (
            shown.map((hit) => (
              <li key={hit.symbol}>
                <button
                  type="button"
                  onClick={() => pick(hit.symbol)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-primary-wash"
                >
                  {/* Rozet satırın yüksekliğini o belirliyor: `h-5` ile
                      satır 10+20+10 = 40 piksel kalıyordu. `h-6` onu 44'e
                      çıkarıyor ve aynı listeyi kuran kardeşiyle hizalıyor
                      (WatchlistBoard, `h-6 w-14`). Burada `.tap-44`
                      ÇALIŞMAZ: kapsayıcı liste `overflow-hidden` taşıyor
                      (ortak yuvarlak köşe onu gerektiriyor) ve sözde öğeyle
                      yapılan genişletme kırpılır. */}
                  <span className="numeral flex h-6 w-12 shrink-0 items-center justify-center rounded bg-primary-tint text-tiny font-semibold text-primary">
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
