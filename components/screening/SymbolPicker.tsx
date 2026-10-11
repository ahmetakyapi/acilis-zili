"use client";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { LogoTile } from "@/components/ui/primitives";
import { isValidSymbol } from "@/lib/utils";
import styles from "./Screening.module.css";

/** Tuş vuruşları arasında beklenen süre: yazarken her harfe istek gitmesin. */
const DEBOUNCE_MS = 160;
const MAX_HITS = 7;

export type SymbolPickerLabels = {
  placeholder: string; listLabel: string; searching: string; noResults: string; error: string; useTyped: string;
};

/** Türkçe duyarsız katlama — `/api/search` → `fold` ile aynı kural (İ/ı, aksan). */
const fold = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

/** Eşleşen parçayı vurgular: "nv" → **NV**DA, "micr" → **Micr**on Technology. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? fold(text).indexOf(fold(term)) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + term.length)}</mark>{text.slice(at + term.length)}</>;
}

/**
 * Hisse Seçimi'nin sembol alanı: yazdıkça öneren combobox ("mu" → Micron,
 * "nv" → NVIDIA). Arama sitenin arama paletiyle ve portföy formuyla AYNI uç
 * (`/api/search`: birebir sembol → takma ad → sembol ön eki → ad; kademe
 * içinde piyasa değeri), WAI-ARIA kalıbı portföydekiyle aynı
 * (`PositionComposer` → `SymbolField`): ok tuşları, Enter, Escape,
 * `aria-activedescendant`.
 *
 * İLERLEME KATMANI: alan hâlâ formun `sembol` girdisi; JavaScript yoksa
 * yazılan sembol GET ile gider ve sunucu yönlendirir (sayfanın kendi notu:
 * "form JavaScript istemiyor"). Öneri seçilince değer yazılır ve form
 * gönderilir. Ad yazıp düğmeye basan ("micron") en üstteki öneriye gider:
 * ad, sembol deseninden geçip var olmayan bir sayfaya düşüyordu.
 */
export function SymbolPicker({ id, labels }: { id: string; labels: SymbolPickerLabels }) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ term: string; hits: SearchHit[]; failed: boolean } | null>(null);
  const term = query.trim().replace(/^\$/, "");

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = res.ok ? ((await res.json()) as { hits?: SearchHit[] }) : null;
        setResult({ term, hits: (data?.hits ?? []).slice(0, MAX_HITS), failed: !res.ok });
        setActive(0);
      } catch (err) {
        // İptal hata değil: her tuş vuruşu bir öncekini iptal ediyor.
        if ((err as Error)?.name !== "AbortError") setResult({ term, hits: [], failed: true });
      }
    }, DEBOUNCE_MS);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [term]);

  const fresh = !!term && result?.term === term;
  const hits = useMemo(() => (fresh ? result!.hits : []), [fresh, result]);
  const typed = term.toLocaleUpperCase("en-US");
  const offerTyped = fresh && isValidSymbol(typed) && !hits.some(hit => hit.symbol === typed);
  const options = [...hits.map(hit => ({ ...hit, typed: false })), ...(offerTyped ? [{ symbol: typed, name: "", logo: null, typed: true }] : [])];
  const showList = open && !!term && (fresh || !!result);

  // Düğmeyle gönderimde: yazılan birebir bir sembol değilse ve öneri varsa en üstteki
  // öneriye gidilir ("micron" → MU, "nvidia" → NVDA). Dinleyici formda; son öneriler ref'te.
  const topRef = useRef<{ typed: string; hits: SearchHit[] }>({ typed: "", hits: [] });
  useEffect(() => { topRef.current = { typed, hits }; }, [typed, hits]);
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const guard = () => {
      const { typed: now, hits: list } = topRef.current;
      if (list.length && !list.some(hit => hit.symbol === now) && inputRef.current) inputRef.current.value = list[0].symbol;
    };
    form.addEventListener("submit", guard);
    return () => form.removeEventListener("submit", guard);
  }, []);

  const submitWith = (symbol: string) => {
    const input = inputRef.current;
    if (!input) return;
    input.value = symbol;
    setQuery(symbol);
    setOpen(false);
    input.form?.requestSubmit();
  };

  return <div className={styles.combo}>
    <span className={styles.comboField}>
    <input
      ref={inputRef}
      id={id}
      name="sembol"
      type="text"
      role="combobox"
      aria-expanded={showList}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
      inputMode="text"
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      maxLength={40}
      required
      placeholder={labels.placeholder}
      value={query}
      onChange={event => { setQuery(event.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, Math.max(0, options.length - 1))); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(0, i - 1)); }
        else if (event.key === "Enter" && showList && options[active]) { event.preventDefault(); submitWith(options[active].symbol); }
        else if (event.key === "Escape" && showList) { event.preventDefault(); setOpen(false); }
      }}
    />
    {term && !fresh && <span className={styles.comboSpin} role="status" aria-label={labels.searching} />}
    </span>
    {showList && <ul id={listId} role="listbox" aria-label={labels.listLabel} className={styles.comboList}>
      {options.map((option, i) => <li
        key={`${option.symbol}:${option.typed ? "typed" : "hit"}`}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={i === active}
        data-active={i === active || undefined}
        style={{ "--i": i } as CSSProperties}
        className={styles.comboOption}
        // `mousedown` alanın odağını düşürmeden seçer.
        onMouseDown={event => { event.preventDefault(); submitWith(option.symbol); }}
        onMouseEnter={() => setActive(i)}
      >
        {option.typed ? <span className={styles.comboTyped}>{labels.useTyped.replace("{symbol}", option.symbol)}</span> : <>
          <LogoTile symbol={option.symbol} logoUrl={option.logo} size="sm" />
          <span className={styles.comboSymbol}><Highlight text={option.symbol} term={term.toLocaleUpperCase("en-US")} /></span>
          <span className={styles.comboName}><Highlight text={option.name} term={term} /></span>
        </>}
      </li>)}
      {fresh && options.length === 0 && <li role="presentation" className={styles.comboEmpty}>{result?.failed ? labels.error : labels.noResults}</li>}
    </ul>}
  </div>;
}
