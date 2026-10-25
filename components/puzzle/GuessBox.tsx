import { useMemo, useRef, useState } from "react";
import { Button, LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { foldForSearch } from "@/lib/search-fold";
import type { PoolOption } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import styles from "./GuessBox.module.css";

const MAX_OPTIONS = 8;

/**
 * Tahmin kutusu — ⌘K paletinin arama kuralı (Türkçe katlama
 * `foldForSearch`, takma adlar `db/seed/aliases.ts`) bu bulmacanın havuzu
 * üzerinde, tarayıcıda. Uç sorulmuyor: havuz 200 şirket ve sayfayla geldi.
 * Seçmek göndermek değil: listeden seçilen şirket kutuya oturur, "Tahmin
 * Et" ya da ikinci Enter gönderir; yanlışlıkla bir hak yanmasın.
 */
export function GuessBox({
  options,
  guessed,
  labels,
  locale,
  disabled,
  pending,
  onGuess,
}: {
  options: PoolOption[];
  guessed: ReadonlySet<string>;
  labels: StockPuzzleLabels;
  locale: Locale;
  disabled: boolean;
  pending: boolean;
  onGuess: (symbol: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<PoolOption | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const needle = foldForSearch(query, locale);
    if (!needle || picked) return [];
    const scored: { option: PoolOption; score: number }[] = [];
    for (const option of options) {
      if (guessed.has(option.symbol)) continue;
      const symbol = option.symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
      const tokens = option.haystack.split(" ");
      const score =
        symbol === needle ? 0
          : symbol.startsWith(needle) ? 1
            : tokens.some((token) => token.startsWith(needle)) ? 2
              : option.haystack.includes(needle) ? 3
                : -1;
      if (score >= 0) scored.push({ option, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || a.option.symbol.localeCompare(b.option.symbol))
      .slice(0, MAX_OPTIONS)
      .map((item) => item.option);
  }, [query, options, guessed, locale, picked]);

  const choose = (option: PoolOption) => {
    setPicked(option);
    setQuery(`${option.name} (${option.symbol})`);
    setOpen(false);
    setHint(null);
    inputRef.current?.focus();
  };

  const send = () => {
    if (disabled) return;
    let target = picked;
    if (!target && matches.length === 1) target = matches[0];
    if (!target) {
      setHint(query.trim() && matches.length === 0 ? labels.noMatch : labels.pickFirst);
      return;
    }
    if (guessed.has(target.symbol)) {
      setHint(labels.alreadyGuessed);
      return;
    }
    setHint(null);
    const sent = target;
    const sentQuery = query;
    void onGuess(sent.symbol).then((accepted) => {
      /* Kutu YANIT GELİNCE boşalır, yalnız tahmin işlendiyse. Arada okur
         başka bir şey yazdıysa ona dokunulmaz. */
      if (!accepted) return;
      setPicked((current) => (current?.symbol === sent.symbol ? null : current));
      setQuery((current) => (current === sentQuery ? "" : current));
    });
  };

  const listOpen = open && matches.length > 0;
  const activeId = listOpen ? `bulmaca-secenek-${matches[Math.min(active, matches.length - 1)]?.symbol}` : undefined;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor="bulmaca-tahmin" className="sr-only">{labels.inputLabel}</label>
      <div className={styles.combo}>
        <input
          ref={inputRef}
          id="bulmaca-tahmin"
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls="bulmaca-secenekler"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={labels.placeholder}
          value={query}
          disabled={disabled && !pending}
          className={styles.input}
          onChange={(event) => {
            setQuery(event.target.value);
            setPicked(null);
            setOpen(true);
            setActive(0);
            setHint(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && matches.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActive((value) => (value + 1) % matches.length);
            } else if (event.key === "ArrowUp" && matches.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActive((value) => (value - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter" && listOpen) {
              event.preventDefault();
              choose(matches[Math.min(active, matches.length - 1)]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ul id="bulmaca-secenekler" role="listbox" aria-label={labels.inputLabel} hidden={!listOpen} className={styles.listbox}>
          {matches.map((option, index) => (
            <li
              key={option.symbol}
              id={`bulmaca-secenek-${option.symbol}`}
              role="option"
              aria-selected={index === active}
              className={cn(styles.option, index === active && styles.optionActive)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <LogoTile symbol={option.symbol} logoUrl={option.logoUrl} size="sm" />
              <span className={styles.optionSymbol}>{option.symbol}</span>
              <span className={styles.optionName}>{option.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button type="submit" size="lg" disabled={disabled} className={styles.submit}>
        {pending ? labels.pending : labels.submit}
      </Button>
      {/* Canlı bölge HEP yerinde: sonradan eklenen bir `aria-live` öğesinin
          ilk içeriği ekran okuyucuda duyurulmuyor. Boşken yer kaplamıyor. */}
      <p aria-live="polite" className={styles.hint}>{hint ?? ""}</p>
    </form>
  );
}
