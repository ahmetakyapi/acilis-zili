import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { foldForSearch } from "@/lib/search-fold";
import type { PoolOption } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { fill } from "./puzzle-format";
import styles from "./GuessBox.module.css";

/* 8 → 12 (29 Ekim, sahibinin isteği: "orada çıkan şirketlerin sayısı
   artsın"). Liste 22rem'de kayıyor; 12 satır 44 pikselle ~530 piksel. */
const MAX_OPTIONS = 12;

/**
 * Tahmin kutusu — ⌘K paletinin arama kuralı (Türkçe katlama
 * `foldForSearch`, takma adlar `db/seed/aliases.ts`) bu bulmacanın havuzu
 * üzerinde, tarayıcıda. Uç sorulmuyor: havuz 200 şirket ve sayfayla geldi.
 * Seçmek göndermek değil: listeden seçilen şirket kutuya oturur, "Tahmin
 * Et" ya da ikinci Enter gönderir; yanlışlıkla bir hak yanmasın.
 * Joker düğmesi aynı satırda (`extra`): tek ekranlık tahtada ayrı bir
 * satır ve açıklama paragrafı 70 piksel yiyordu (25 Ekim).
 *
 * ADAYLAR (29 Ekim, kolaylaştırma turu): kutu boşken odaklanınca liste
 * açılmış ipuçlarına UYAN şirketleri gösterir (`candidatesFor`, büyükten
 * küçüğe); yazarken uyanlar önce gelir, uymayanlar soluk ve "Uymuyor"
 * künyeli ama seçilebilir — süzgeç bir yardım, yasak değil. Kutunun altında
 * kaç adayın kaldığı yazar.
 *
 * KENDİLİĞİNDEN ODAK (29 Ekim, sahibinin isteği): ince imleçli ekranda kutu
 * açılınca odaklanır, okur doğrudan yazar. Dokunmatikte ODAKLANMAZ: klavye
 * açılıp siluetin üstünü kapatırdı.
 */
export function GuessBox({
  options,
  candidates,
  guessed,
  labels,
  locale,
  disabled,
  pending,
  onGuess,
  extra,
}: {
  options: PoolOption[];
  /** Açılmış ipuçlarına uyan adaylar, sırasıyla (`candidatesFor`). */
  candidates: PoolOption[];
  guessed: ReadonlySet<string>;
  labels: StockPuzzleLabels;
  locale: Locale;
  disabled: boolean;
  pending: boolean;
  onGuess: (symbol: string) => Promise<boolean>;
  /** Gönder düğmesinin yanındaki ikincil denetim (joker) — aynı satırda. */
  extra?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<PoolOption | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fits = useMemo(() => new Set(candidates.map((option) => option.symbol)), [candidates]);
  const matches = useMemo(() => {
    const needle = foldForSearch(query, locale);
    if (picked) return [];
    if (!needle) return candidates.filter((option) => !guessed.has(option.symbol)).slice(0, MAX_OPTIONS);
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
    /* Uyan aday önce, sonra eşleşmenin gücü: "ap" yazana AAPL ile APD'den
       ipuçlarına uyanı üstte. */
    const fit = (option: PoolOption) => (fits.has(option.symbol) ? 0 : 1);
    return scored
      .sort((a, b) => fit(a.option) - fit(b.option) || a.score - b.score || a.option.symbol.localeCompare(b.option.symbol))
      .slice(0, MAX_OPTIONS)
      .map((item) => item.option);
  }, [query, options, candidates, fits, guessed, locale, picked]);

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

  /* Kendiliğinden odak: kutu ilk kez açıldığında (hidratasyon ve geri
     yükleme bitince `disabled` düşer), yalnız ince imleçte, sayfayı
     kaydırmadan. Okur başka bir yere odaklandıysa dokunulmaz. */
  const autoFocused = useRef(false);
  const silentFocus = useRef(false);
  useEffect(() => {
    if (disabled || autoFocused.current) return;
    autoFocused.current = true;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    /* Liste AÇILMAZ: kendiliğinden odak yalnız imleci koyar; aday listesi
       tahmin yuvalarının üstünü kapatıyordu (1440'ta ölçüldü). Liste okur
       yazınca, tıklayınca ya da ↓ ile açılır. */
    silentFocus.current = true;
    inputRef.current?.focus({ preventScroll: true });
    silentFocus.current = false;
  }, [disabled]);

  const browsing = !foldForSearch(query, locale) && !picked;
  const remaining = candidates.filter((option) => !guessed.has(option.symbol)).length;
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
          onFocus={() => {
            if (!silentFocus.current) setOpen(true);
          }}
          onClick={() => setOpen(true)}
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
        <div className={styles.popup} hidden={!listOpen}>
          {browsing && (
            <p className={styles.popupHead} aria-hidden>
              {fill(labels.candidatesHead, { n: remaining })}
            </p>
          )}
          <ul id="bulmaca-secenekler" role="listbox" aria-label={browsing ? fill(labels.candidatesHead, { n: remaining }) : labels.inputLabel} className={styles.listbox}>
            {matches.map((option, index) => {
              const fit = fits.has(option.symbol);
              return (
                <li
                  key={option.symbol}
                  id={`bulmaca-secenek-${option.symbol}`}
                  role="option"
                  aria-selected={index === active}
                  className={cn(styles.option, index === active && styles.optionActive)}
                  data-fit={fit ? undefined : "no"}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <LogoTile symbol={option.symbol} logoUrl={option.logoUrl} size="sm" />
                  <span className={styles.optionSymbol}>{option.symbol}</span>
                  <span className={styles.optionName}>{option.name}</span>
                  {!fit && <span className={styles.optionMiss}>{labels.candidateMiss}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <Button type="submit" size="lg" disabled={disabled} className={styles.submit}>
        {pending ? labels.pending : labels.submit}
      </Button>
      {extra}
      {/* Canlı bölge HEP yerinde: sonradan eklenen bir `aria-live` öğesinin
          ilk içeriği ekran okuyucuda duyurulmuyor. Boşken yer kaplamıyor. */}
      <p aria-live="polite" className={styles.hint}>{hint ?? ""}</p>
      {/* KALAN ADAY — oyunun ilerlediğini sayıyla gösteren künye; dokununca
          liste açılır (kutuya odak). Havuzun tamamı uyuyorsa söylenecek
          bir şey yok, basılmaz. */}
      {remaining > 0 && remaining < options.length && (
        <button
          type="button"
          className={styles.remaining}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          <span className="numeral">{fill(labels.candidatesLeft, { n: remaining })}</span>
          <span className={styles.remainingLink}>{labels.candidatesShow}</span>
        </button>
      )}
    </form>
  );
}
