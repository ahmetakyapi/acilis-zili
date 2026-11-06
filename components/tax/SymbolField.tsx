"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";
import styles from "./Tax.module.css";

/** Tuş vuruşları arasında beklenen süre: her harfe istek gitmesin. */
const DEBOUNCE_MS = 160;
const MAX_HITS = 6;

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
}: {
  value: string;
  onChange: (symbol: string) => void;
  invalid?: boolean;
  placeholder: string;
  listLabel: string;
  searchingLabel: string;
  className?: string;
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

  return (
    <span className={styles.combo}>
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
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
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (event.key === "Enter" && showList && hits[active]) {
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
        <ul id={listId} role="listbox" aria-label={listLabel} className={styles.comboList}>
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
