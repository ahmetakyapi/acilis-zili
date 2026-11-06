"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";
import styles from "./Tax.module.css";

/** Tuş vuruşları arasında beklenen süre: her harfe istek gitmesin. */
const DEBOUNCE_MS = 160;
const MAX_HITS = 6;
/** Liste ile alan arası ve ekran kenarı payı (DatePicker ile aynı). */
const GAP = 6;
const EDGE = 12;
const MIN_WIDTH = 260;
const MAX_HEIGHT = 288;

const supportsPopover = () =>
  typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";

/**
 * VERGİ HESAPLAYICISININ SEMBOL ALANI (6 Kasım, sahibinin sözü: "sembol
 * alanı arama/otomatik tamamlama gibi değil"). Düz metin alanıydı; okuyucu
 * şirket adını yazınca ("apple") sembol desenine takılıp hata görüyordu.
 * Şimdi yazdıkça öneren combobox — arama paletiyle, portföy ve Hisse
 * Seçimi'yle AYNI uç (`/api/search`) ve aynı WAI-ARIA kalıbı
 * (`components/screening/SymbolPicker.tsx`): ok tuşları, Enter, Escape,
 * `aria-activedescendant`.
 *
 * Alan hâlâ SERBEST: öneri yoksa (veritabanı kapalı, listede olmayan bir
 * sembol) yazılan sembol olduğu gibi kalır, hesap sembolü yalnız etiket
 * olarak kullanıyor. Sunucuya giden tek şey yazılan arama terimi; adet,
 * fiyat ve tarih değil (hesaplayıcının gizlilik notu, `TaxCalculator`).
 */
export function SymbolField({
  value,
  onChange,
  invalid,
  placeholder,
  listLabel,
  searchingLabel,
  className,
  labelledBy,
  describedBy,
}: {
  value: string;
  onChange: (symbol: string) => void;
  invalid?: boolean;
  placeholder: string;
  listLabel: string;
  searchingLabel: string;
  className?: string;
  /** Alanın adı: dıştaki etiketin kimliği. Liste ve "Aranıyor" durumu
   *  `<label>`in içinde kaldığı için ad etiketten türetilince onları da
   *  topluyordu (6 Kasım, inceleme). */
  labelledBy?: string;
  describedBy?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ term: string; hits: SearchHit[] } | null>(null);
  const term = value.trim().replace(/^\$/, "");

  useEffect(() => {
    if (!term || !open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = res.ok ? ((await res.json()) as { hits?: SearchHit[] }) : null;
        setResult({ term, hits: (data?.hits ?? []).slice(0, MAX_HITS) });
        setActive(0);
      } catch (err) {
        // İptal hata değil: her tuş vuruşu bir öncekini iptal ediyor.
        if ((err as Error)?.name !== "AbortError") setResult({ term, hits: [] });
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, open]);

  const fresh = !!term && result?.term === term;
  const hits = useMemo(() => (fresh && result ? result.hits : []), [fresh, result]);
  /* Tek öneri yazılanın kendisiyse liste açılmaz: seçilecek bir şey yok. */
  const settled = hits.length === 1 && hits[0].symbol === term.toUpperCase();
  const showList = open && hits.length > 0 && !settled;

  const pick = (symbol: string) => {
    onChange(symbol.toUpperCase());
    setOpen(false);
  };

  /* LİSTE ÜST KATMANDA (6 Kasım, inceleme). Hesaplayıcı paneli
     `overflow-hidden` (köşe yarıçapı); mutlak konumlu liste son satırdaki
     alanda panelin dibinde kırpılıyordu. Tarih seçicinin kalıbı
     (`components/ui/DatePicker.tsx` → `popover="manual"`): liste üst
     katmana çıkıyor, alanın altına (sığmıyorsa üstüne) sabit konumla
     yerleşiyor; kaydırmada kare başına bir kez tazeleniyor. Popover'ı
     bilmeyen tarayıcıda eski mutlak konum kalır. */
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const place = useCallback(() => {
    const list = listRef.current;
    const field = inputRef.current;
    if (!list || !field || !supportsPopover()) return;
    const anchor = field.getBoundingClientRect();
    const width = Math.min(Math.max(anchor.width, MIN_WIDTH), window.innerWidth - EDGE * 2);
    const below = window.innerHeight - anchor.bottom - GAP - EDGE;
    const above = anchor.top - GAP - EDGE;
    const up = below < Math.min(list.scrollHeight, 160) && above > below;
    const height = Math.max(0, Math.min(MAX_HEIGHT, up ? above : below));
    const top = up ? anchor.top - GAP - Math.min(height, list.scrollHeight) : anchor.bottom + GAP;
    const left = Math.min(Math.max(EDGE, anchor.left), window.innerWidth - width - EDGE);
    list.style.setProperty("--cb-top", `${Math.round(top)}px`);
    list.style.setProperty("--cb-left", `${Math.round(left)}px`);
    list.style.setProperty("--cb-width", `${Math.round(width)}px`);
    list.style.setProperty("--cb-max-h", `${Math.round(height)}px`);
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!showList || !list || !supportsPopover()) return;
    if (!list.matches(":popover-open")) list.showPopover();
    place();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (list.matches(":popover-open")) list.hidePopover();
    };
  }, [showList, hits.length, place]);

  return (
    <span className={styles.combo}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-expanded={showList}
        /* Liste yalnız açıkken DOM'da; kapalıyken olmayan bir kimliğe
           işaret etmesin (6 Kasım, inceleme). */
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-busy={(open && !!term && !fresh) || undefined}
        value={value}
        /* Ad da yazılabilsin ("berkshire"); sembol deseni hatayı alan söyler. */
        maxLength={24}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          /* Oklar yalnız liste açıkken yakalanır; liste yokken imleç
             alanın başına/sonuna gidebilsin (6 Kasım, inceleme). Kapalı
             listeyi ArrowDown yine açar. IME bileşimindeki Enter bileşimi
             bitirir, öneri seçmez. */
          if (event.key === "ArrowDown") {
            if (showList) {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
            } else setOpen(true);
          } else if (event.key === "ArrowUp") {
            if (!showList) return;
            event.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (event.key === "Enter" && !event.nativeEvent.isComposing && showList && hits[active]) {
            /* Seçer; sonraki alana geçişi formun Enter akışı yapıyor. */
            pick(hits[active].symbol);
          } else if (event.key === "Escape" && showList) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className={cn(className, styles.upper)}
      />
      {open && !!term && !fresh && <span className={styles.comboSpin} role="status" aria-label={searchingLabel} />}
      {showList && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={listLabel} popover="manual" className={styles.comboList}>
          {hits.map((hit, i) => (
            <li
              key={hit.symbol}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active || undefined}
              className={styles.comboOption}
              // `mousedown` alanın odağını düşürmeden seçer.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(hit.symbol);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <b className={styles.comboSymbol}>{hit.symbol}</b>
              <span className={styles.comboName}>{hit.name}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
