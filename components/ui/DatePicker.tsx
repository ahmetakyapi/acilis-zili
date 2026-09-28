"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CalendarBlank, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import {
  addIsoDays,
  addIsoMonths,
  clampIso,
  datePattern,
  formatDateInput,
  isIsoDay,
  isoToUtc,
  nextDateDraft,
  parseDateInput,
  utcToIso,
  weekdayMon,
  type DateLocale,
} from "@/lib/date-input";
import { datePickerEn, datePickerTr } from "@/lib/i18n/dictionaries/date-picker";
import { cn } from "@/lib/utils";
import styles from "./DatePicker.module.css";

/**
 * TARİH SEÇİCİ — sitenin her tarih alanı bu (28 Eylül yeniden yazımı).
 *
 * İLK SÜRÜM (26 Eylül) yalnızca yönetimdeki üç alanı kapsıyordu; vergi
 * hesaplayıcısı, ekstre önizlemesi ve portföy hâlâ `<input type="date">`
 * idi ve açılan pencere tarayıcının kendisiydi: küçük, stilsiz, gün/ay/yıl
 * parçaları mavi bloklar. Sahibi "kabul edilemez" dedi. Artık depoda tek bir
 * `type="date"` yok; hepsi bu bileşen.
 *
 * İKİ GİRİŞ YOLU, TEK DEĞER.
 *   - YAZMAK: alan bir metin kutusu ("GG.AA.YYYY", EN "MM/DD/YYYY").
 *     Rakam yazana ayraç kendiliğinden gelir; alan bırakılınca ya da Enter'a
 *     basılınca metin çözülür (`lib/date-input.ts`). Okunamayan ya da
 *     aralık dışı metin DEĞERİ DEĞİŞTİRMEZ ve altında nedenini söyler.
 *   - SEÇMEK: sağdaki düğme (ya da alanda Alt+↓) takvimi açar. Ay adına
 *     basınca ay/yıl ızgarası gelir: yıllar önceki bir ekstre tarihine
 *     yüz kez "önceki ay"a basmadan iniliyor.
 *   Değer her zaman ISO "YYYY-AA-GG"; `name` verilirse gizli bir alanla
 *   forma gidiyor, yani gönderilen form alanı değişmedi.
 *
 * ÜST KATMAN. Pencere Popover API ile belge üst katmanına çıkıyor: ekstre
 * önizlemesinin tablosu yatay kaydırma kabında (`overflow`) ve eski sürümün
 * `position: absolute` penceresi orada kırpılırdı; portföyün ekleme
 * penceresi de modal bir `<dialog>` ve onun üstüne yalnızca üst katman
 * çıkabiliyor. Popover desteklemeyen eski tarayıcıda pencere alanın altına
 * mutlak konumla açılıyor (kırpılabilir ama çalışır).
 *
 * TELEFONDA ALT ÇEKMECE (< 640 piksel): pencere ekranın dibine yapışan tam
 * genişlikte bir levha, günler 44 piksel dokunma hedefi, arkası karartılmış.
 *
 * KLAVYE (WAI-ARIA tarih seçici kalıbı): oklar gün/hafta, PageUp/PageDown
 * ay, Shift+PageUp/PageDown yıl, Home/End hafta başı/sonu, Enter/Boşluk
 * seçer, Escape kapatır ve odağı alana geri verir. Ay/yıl ızgarasında oklar
 * hücre gezer, Escape günlere döner.
 *
 * Hareketi azaltan okuyucuda açılış ve ay kayması yok; renk değişimi kalıyor.
 */

type Size = "field" | "cell";

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  /** Seçim yapılınca çevreleyen formu gönder (liste süzgeci). */
  autoSubmit?: boolean;
  /** Verilmezse dil adresten okunur. */
  locale?: DateLocale;
  /** `field` form alanı (46 piksel), `cell` tablo hücresi (36 piksel). */
  size?: Size;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /**
   * Yazılan metin okunamadığında ya da aralık dışında kaldığında `false`.
   * Değer o sırada DEĞİŞMİYOR (eski değer duruyor); bunu dinlemeyen bir form
   * okuyucunun "yazdım" sandığı tarihi değil eskisini gönderirdi.
   */
  onValidityChange?: (valid: boolean) => void;
};

type View = "days" | "months" | "years";

/** Yıl ızgarasının bir sayfası: 4 sütun × 5 satır. */
const YEAR_PAGE = 20;
const YEAR_COLS = 4;
const MONTH_COLS = 3;
const WEEK = 7;
/** Izgaranın sabit hafta sayısı: satır sayısı aya göre değişmesin, pencere zıplamasın. */
const GRID_DAYS = 42;
/** Alan ile pencere arası ve pencerenin ekran kenarından payı. */
const GAP = 8;
const EDGE = 12;
const SHEET_QUERY = "(max-width: 639px)";
/** Başlık satırı için bilinen bir pazartesi. */
const A_MONDAY = "2024-01-01";

const todayIso = () => {
  const now = new Date();
  return utcToIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
};

const supportsPopover = () =>
  typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";

export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required,
  autoSubmit,
  locale: localeProp,
  size = "field",
  id,
  className,
  onValidityChange,
  ...aria
}: Props) {
  const { locale: routeLocale } = useLocaleHref();
  const locale: DateLocale = localeProp ?? routeLocale;
  const L = locale === "tr" ? datePickerTr : datePickerEn;
  const intl = locale === "tr" ? "tr-TR" : "en-US";

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = controlled ? value : inner;
  const valid = isIsoDay(current);

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const setError = useCallback(
    (next: string | null) => {
      setErrorState(next);
      onValidityChange?.(next === null);
    },
    [onValidityChange],
  );
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [focus, setFocus] = useState(() => (valid ? current : todayIso()));
  const [dir, setDir] = useState<"prev" | "next" | null>(null);
  const [sheet, setSheet] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  /* Seçimden sonra odak alana dönüyor ve odaklanma metni yeniliyor; o anda
     denetimli değer henüz eski olabilir. Yeni metin buradan okunuyor. */
  const committedText = useRef<string | null>(null);
  const popupId = useId();
  const errorId = useId();
  const hintId = useId();

  /* Alanda duran metin: okuyucu yazarken ONUN metni, değilken değerin
     biçimi. Dışarıdan gelen değer (denetimli alan, form sıfırlama) böylece
     yazılanı ezmeden görünüyor. */
  const formatted = valid ? formatDateInput(current, locale) : "";
  const shown = editing ? draft : formatted;

  const inRange = useCallback((iso: string) => (!min || iso >= min) && (!max || iso <= max), [min, max]);
  const today = todayIso();
  const fmt = useCallback(
    (iso: string, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(intl, { ...opts, timeZone: "UTC" }).format(isoToUtc(iso)),
    [intl],
  );
  const longDate = (iso: string) => fmt(iso, { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  /* ---- Değer yazma ---- */
  const commit = useCallback(
    (iso: string, { close = true, submit = autoSubmit } = {}) => {
      if (iso !== "" && !inRange(iso)) return;
      if (!controlled) setInner(iso);
      onChange?.(iso);
      const text = iso ? formatDateInput(iso, locale) : "";
      committedText.current = text;
      setDraft(text);
      setError(null);
      if (close) {
        setOpen(false);
        inputRef.current?.focus({ preventScroll: true });
      }
      if (submit) {
        /* Gizli alanın değeri React çizimiyle iniyor; gönderim bir kare sonra. */
        requestAnimationFrame(() => hiddenRef.current?.form?.requestSubmit());
      }
    },
    [autoSubmit, controlled, inRange, locale, onChange, setError],
  );

  /** Yazılan metni çöz. Dönüş: değer yazıldı mı. */
  const commitDraft = useCallback((): boolean => {
    const text = draft.trim();
    if (text === "") {
      if (current !== "") {
        if (!controlled) setInner("");
        onChange?.("");
      }
      setError(null);
      return true;
    }
    const iso = parseDateInput(text, locale);
    if (!iso) {
      setError(L.invalid.replace("{pattern}", datePattern(locale)));
      return false;
    }
    if (min && iso < min) {
      setError(L.beforeMin.replace("{date}", formatDateInput(min, locale)));
      return false;
    }
    if (max && iso > max) {
      setError(L.afterMax.replace("{date}", formatDateInput(max, locale)));
      return false;
    }
    if (iso !== current) commit(iso, { close: false, submit: false });
    else setDraft(formatDateInput(iso, locale));
    setError(null);
    return true;
  }, [L, commit, controlled, current, draft, locale, max, min, onChange, setError]);

  /* ---- Açma / kapama ---- */
  const openPicker = useCallback(() => {
    const typed = parseDateInput(shown, locale);
    const start = typed ?? (valid ? current : today);
    setFocus(clampIso(start, min, max));
    setView("days");
    setDir(null);
    setSheet(window.matchMedia(SHEET_QUERY).matches);
    setOpen(true);
  }, [current, shown, locale, max, min, today, valid]);

  const closePicker = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) inputRef.current?.focus({ preventScroll: true });
  }, []);

  /* Üst katmana çıkar / indir. */
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup || !supportsPopover()) return;
    if (open && !popup.matches(":popover-open")) popup.showPopover();
    return () => {
      if (popup.matches(":popover-open")) popup.hidePopover();
    };
  }, [open]);

  /* Konum: alanın altı, sığmıyorsa üstü; yatayda ekranın içinde. Telefonda
     CSS levhayı dibe yapıştırıyor ve bu değerleri okumuyor. */
  const place = useCallback(() => {
    const popup = popupRef.current;
    const field = fieldRef.current;
    if (!popup || !field || !supportsPopover()) return;
    const anchor = field.getBoundingClientRect();
    const h = popup.offsetHeight;
    const w = popup.offsetWidth;
    let top = anchor.bottom + GAP;
    if (top + h > window.innerHeight - EDGE && anchor.top - GAP - h > EDGE) top = anchor.top - GAP - h;
    /* Alan pencereden darsa ve ekranın sağ yarısındaysa pencere alanın SAĞ
       kenarına hizalanır: formun sağ sütunundaki alanın penceresi formun
       dışına taşmasın. */
    const alignRight = w > anchor.width && anchor.left + anchor.width / 2 > window.innerWidth / 2;
    const preferred = alignRight ? anchor.right - w : anchor.left;
    const left = Math.min(Math.max(EDGE, preferred), window.innerWidth - w - EDGE);
    popup.style.setProperty("--dp-top", `${Math.round(top)}px`);
    popup.style.setProperty("--dp-left", `${Math.round(left)}px`);
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, view, place]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closePicker(false);
    };
    const onMedia = () => setSheet(window.matchMedia(SHEET_QUERY).matches);
    const media = window.matchMedia(SHEET_QUERY);
    /* Konumu kaydırmada tazeleyen dinleyici — yalnızca pencere açıkken ve
       kare başına bir kez; kapanınca sökülüyor. */
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("pointerdown", onDown);
    media.addEventListener("change", onMedia);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      document.removeEventListener("pointerdown", onDown);
      media.removeEventListener("change", onMedia);
    };
  }, [open, place, closePicker]);

  /* Odak: açılınca odaklı güne / seçili aya / yıla. */
  useEffect(() => {
    if (!open) return;
    const selector =
      view === "days" ? `[data-day="${focus}"]` : view === "months" ? `[data-month="${focus.slice(0, 7)}"]` : `[data-year="${focus.slice(0, 4)}"]`;
    popupRef.current?.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
  }, [open, view, focus]);

  /* ---- Günler ---- */
  const monthStart = `${focus.slice(0, 7)}-01`;
  const days = useMemo(() => {
    const start = addIsoDays(monthStart, -weekdayMon(monthStart));
    return Array.from({ length: GRID_DAYS }, (_, i) => addIsoDays(start, i));
  }, [monthStart]);
  const weekdays = useMemo(
    () =>
      Array.from({ length: WEEK }, (_, i) => {
        const iso = addIsoDays(A_MONDAY, i);
        return { short: fmt(iso, { weekday: "short" }), long: fmt(iso, { weekday: "long" }) };
      }),
    [fmt],
  );
  const monthLabel = fmt(monthStart, { month: "long", year: "numeric" });

  const moveFocus = (next: string) => {
    const target = clampIso(next, min, max);
    if (target.slice(0, 7) !== focus.slice(0, 7)) setDir(target < focus ? "prev" : "next");
    setFocus(target);
  };

  const minMonth = min?.slice(0, 7);
  const maxMonth = max?.slice(0, 7);
  const canPrevMonth = !minMonth || addIsoMonths(monthStart, -1).slice(0, 7) >= minMonth;
  const canNextMonth = !maxMonth || addIsoMonths(monthStart, 1).slice(0, 7) <= maxMonth;

  /* ---- Yıllar ve aylar ---- */
  const focusYear = Number(focus.slice(0, 4));
  const maxYear = max ? Number(max.slice(0, 4)) : Number.POSITIVE_INFINITY;
  const minYear = min ? Number(min.slice(0, 4)) : Number.NEGATIVE_INFINITY;
  /* Sayfa, üst sınır yılı son satırda olacak biçimde hizalanıyor: "gelecek
     yok" alanında ızgaranın yarısı soluk yıllarla dolmasın. */
  const anchorYear = Number.isFinite(maxYear) ? maxYear : Number(today.slice(0, 4)) + YEAR_PAGE / 2;
  const pageStart = anchorYear - YEAR_PAGE + 1 - Math.max(0, Math.ceil((anchorYear - YEAR_PAGE + 1 - focusYear) / YEAR_PAGE)) * YEAR_PAGE;
  const years = Array.from({ length: YEAR_PAGE }, (_, i) => pageStart + i);
  const withYear = (year: number) => clampIso(`${year}${focus.slice(4)}`.replace(/-02-29$/, "-02-28"), min, max);
  const withMonth = (month: number) => {
    const target = `${focus.slice(0, 4)}-${String(month).padStart(2, "0")}-01`;
    const last = new Date(Date.UTC(focusYear, month, 0, 12)).getUTCDate();
    return clampIso(`${target.slice(0, 8)}${String(Math.min(Number(focus.slice(8)), last)).padStart(2, "0")}`, min, max);
  };
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => fmt(`2024-${String(i + 1).padStart(2, "0")}-15`, { month: "short" })),
    [fmt],
  );
  const monthDisabled = (month: number) => {
    const key = `${focus.slice(0, 4)}-${String(month).padStart(2, "0")}`;
    return (minMonth !== undefined && key < minMonth) || (maxMonth !== undefined && key > maxMonth);
  };

  function onPopupKey(event: ReactKeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (view !== "days") setView("days");
      else closePicker();
      return;
    }
    if (view === "days") {
      const wd = weekdayMon(focus);
      const moves: Record<string, () => string> = {
        ArrowLeft: () => addIsoDays(focus, -1),
        ArrowRight: () => addIsoDays(focus, 1),
        ArrowUp: () => addIsoDays(focus, -WEEK),
        ArrowDown: () => addIsoDays(focus, WEEK),
        PageUp: () => addIsoMonths(focus, event.shiftKey ? -12 : -1),
        PageDown: () => addIsoMonths(focus, event.shiftKey ? 12 : 1),
        Home: () => addIsoDays(focus, -wd),
        End: () => addIsoDays(focus, WEEK - 1 - wd),
      };
      const target = event.target as HTMLElement;
      if (moves[event.key] && target.dataset.day) {
        event.preventDefault();
        moveFocus(moves[event.key]());
      }
      return;
    }
    const target = event.target as HTMLElement;
    const cols = view === "years" ? YEAR_COLS : MONTH_COLS;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    if (step[event.key] === undefined) return;
    if (view === "years" && target.dataset.year) {
      event.preventDefault();
      const year = Math.min(Math.max(focusYear + step[event.key], minYear), maxYear);
      setFocus(withYear(year));
    } else if (view === "months" && target.dataset.month) {
      event.preventDefault();
      const month = Number(focus.slice(5, 7)) + step[event.key];
      if (month >= 1 && month <= 12 && !monthDisabled(month)) setFocus(withMonth(month));
    }
  }

  const invalid = aria["aria-invalid"] || error !== null;
  const weekday = valid && size === "field" ? fmt(current, { weekday: "short" }) : null;
  const describedBy = [aria["aria-describedby"], error && size === "field" ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={rootRef}
      className={cn(styles.root, className)}
      data-size={size}
      onBlur={(event) => {
        /* Odak bileşenin DIŞINA çıktıysa pencere kapanır. */
        if (rootRef.current?.contains(event.relatedTarget as Node)) return;
        if (open) setOpen(false);
      }}
    >
      {name && <input ref={hiddenRef} type="hidden" name={name} value={valid ? current : ""} />}
      <div ref={fieldRef} className={styles.field} data-invalid={invalid || undefined} data-open={open || undefined}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={datePattern(locale)}
          value={shown}
          required={required}
          aria-label={aria["aria-label"]}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          title={error && size === "cell" ? error : undefined}
          className={cn("numeral", styles.input)}
          onBlur={() => {
            /* Metin, alan bırakıldığı AN çözülür — takvim düğmesine geçerken
               de. Bileşenden çıkışı beklemek, arada görünen her şeyi (fiyat
               önerisi gibi) eski tarihe göre bırakıyordu. */
            if (!editing) return;
            setEditing(false);
            commitDraft();
          }}
          onFocus={() => {
            if (!editing) setDraft(committedText.current ?? formatted);
            committedText.current = null;
            setEditing(true);
          }}
          onChange={(event) => {
            setDraft(nextDateDraft(shown, event.target.value, locale));
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (commitDraft() && autoSubmit) requestAnimationFrame(() => hiddenRef.current?.form?.requestSubmit());
            } else if (event.key === "ArrowDown" && (event.altKey || event.metaKey)) {
              event.preventDefault();
              openPicker();
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              closePicker();
            }
          }}
        />
        {weekday && !editing && <span className={styles.weekday} aria-hidden>{weekday}</span>}
        <button
          type="button"
          className={styles.toggle}
          aria-label={valid ? `${L.openCalendar}, ${L.selected}: ${longDate(current)}` : L.openCalendar}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          onClick={() => (open ? closePicker() : openPicker())}
        >
          <CalendarBlank weight="duotone" size={size === "cell" ? 15 : 18} aria-hidden />
        </button>
      </div>
      {error && size === "field" && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}

      {open && (
        <div
          ref={popupRef}
          id={popupId}
          role="dialog"
          aria-modal={sheet || undefined}
          aria-label={L.dialog}
          aria-describedby={hintId}
          popover="manual"
          className={styles.popup}
          data-sheet={sheet || undefined}
          data-fallback={!supportsPopover() || undefined}
          onKeyDown={onPopupKey}
          onPointerDown={(event) => {
            /* Çekmecenin karartmasına basmak kapatır: karartmaya basışın
               hedefi pencerenin kendisi, nokta ise kutunun dışında. */
            if (event.target !== popupRef.current) return;
            const box = popupRef.current.getBoundingClientRect();
            if (event.clientY < box.top || event.clientX < box.left || event.clientX > box.right) closePicker();
          }}
        >
          <p id={hintId} className="sr-only">{L.keyboardHint}</p>
          {sheet && (
            <div className={styles.sheetHead}>
              <span className={styles.grabber} aria-hidden />
              <p className={cn("numeral", styles.sheetValue)}>{valid ? longDate(current) : L.dialog}</p>
              <button type="button" className={styles.nav} aria-label={L.close} onClick={() => closePicker()}>
                <X weight="bold" size={16} aria-hidden />
              </button>
            </div>
          )}

          <div className={styles.head}>
            <button
              type="button"
              className={styles.nav}
              aria-label={view === "years" ? L.prevYears : view === "months" ? String(focusYear - 1) : L.prevMonth}
              disabled={view === "days" ? !canPrevMonth : view === "years" ? pageStart <= minYear : focusYear - 1 < minYear}
              onClick={() => {
                if (view === "days") moveFocus(addIsoMonths(focus, -1));
                else if (view === "months") setFocus(withYear(focusYear - 1));
                else setFocus(withYear(Math.max(minYear, focusYear - YEAR_PAGE)));
              }}
            >
              <CaretLeft weight="bold" size={14} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.title}
              aria-label={view === "days" ? `${monthLabel}, ${L.chooseMonthYear}` : L.backToDays}
              aria-live="polite"
              onClick={() => setView(view === "days" ? "years" : "days")}
            >
              <span key={`${view}${view === "days" ? monthStart : focusYear}`} className={styles.titleText} data-dir={dir ?? undefined}>
                {view === "days" ? monthLabel : view === "months" ? focusYear : `${years[0]} - ${years[years.length - 1]}`}
              </span>
              <CaretRight weight="bold" size={11} aria-hidden className={styles.titleCaret} data-open={view !== "days" || undefined} />
            </button>
            <button
              type="button"
              className={styles.nav}
              aria-label={view === "years" ? L.nextYears : view === "months" ? String(focusYear + 1) : L.nextMonth}
              disabled={view === "days" ? !canNextMonth : view === "years" ? pageStart + YEAR_PAGE > maxYear : focusYear + 1 > maxYear}
              onClick={() => {
                if (view === "days") moveFocus(addIsoMonths(focus, 1));
                else if (view === "months") setFocus(withYear(focusYear + 1));
                else setFocus(withYear(Math.min(maxYear, focusYear + YEAR_PAGE)));
              }}
            >
              <CaretRight weight="bold" size={14} aria-hidden />
            </button>
          </div>

          {view === "days" && (
            /* `div` IZGARA, `table` DEĞİL: seçici ekstre önizlemesinin
               tablo hücresinin İÇİNDE açılıyor ve oradaki `.preview th/td`
               kuralları takvimin hücrelerine çizgi, zemin ve dolgu basıyordu
               (28 Eylül, ekran görüntüsünde yakalandı). Roller aynı. */
            <div role="grid" aria-label={monthLabel} className={styles.grid} key={monthStart} data-dir={dir ?? undefined}>
              <div role="row" className={styles.week}>
                {weekdays.map((day) => (
                  <span key={day.long} role="columnheader" aria-label={day.long} className={styles.weekdayHead}>
                    {day.short}
                  </span>
                ))}
              </div>
              {Array.from({ length: GRID_DAYS / WEEK }, (_, row) => (
                <div role="row" key={row} className={styles.week}>
                  {days.slice(row * WEEK, row * WEEK + WEEK).map((iso) => {
                    const outside = iso.slice(0, 7) !== monthStart.slice(0, 7);
                    const disabled = !inRange(iso);
                    const selected = iso === current;
                    return (
                      <span key={iso} role="gridcell" aria-selected={selected} className={styles.cell}>
                        <button
                          type="button"
                          data-day={iso}
                          tabIndex={iso === focus ? 0 : -1}
                          disabled={disabled}
                          aria-label={longDate(iso)}
                          aria-current={iso === today ? "date" : undefined}
                          aria-pressed={selected}
                          data-outside={outside || undefined}
                          data-weekend={weekdayMon(iso) >= 5 || undefined}
                          className={cn("numeral", styles.day)}
                          onClick={() => commit(iso)}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {view === "years" && (
            <div role="grid" aria-label={L.chooseMonthYear} className={styles.pickGrid} data-cols={YEAR_COLS}>
              {Array.from({ length: YEAR_PAGE / YEAR_COLS }, (_, row) => (
                <div role="row" key={row} className={styles.pickRow}>
                  {years.slice(row * YEAR_COLS, row * YEAR_COLS + YEAR_COLS).map((year) => (
                    <span role="gridcell" key={year} aria-selected={valid && Number(current.slice(0, 4)) === year}>
                      <button
                        type="button"
                        data-year={year}
                        tabIndex={year === focusYear ? 0 : -1}
                        disabled={year < minYear || year > maxYear}
                        aria-current={year === Number(today.slice(0, 4)) ? "date" : undefined}
                        data-selected={(valid && Number(current.slice(0, 4)) === year) || undefined}
                        className={cn("numeral", styles.pick)}
                        onClick={() => {
                          setFocus(withYear(year));
                          setView("months");
                        }}
                      >
                        {year}
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {view === "months" && (
            <div role="grid" aria-label={String(focusYear)} className={styles.pickGrid} data-cols={MONTH_COLS}>
              {Array.from({ length: 12 / MONTH_COLS }, (_, row) => (
                <div role="row" key={row} className={styles.pickRow}>
                  {monthNames.slice(row * MONTH_COLS, row * MONTH_COLS + MONTH_COLS).map((label, i) => {
                    const month = row * MONTH_COLS + i + 1;
                    const key = `${focus.slice(0, 4)}-${String(month).padStart(2, "0")}`;
                    return (
                      <span role="gridcell" key={key} aria-selected={valid && current.startsWith(key)}>
                        <button
                          type="button"
                          data-month={key}
                          tabIndex={key === focus.slice(0, 7) ? 0 : -1}
                          disabled={monthDisabled(month)}
                          aria-current={today.startsWith(key) ? "date" : undefined}
                          data-selected={(valid && current.startsWith(key)) || undefined}
                          className={styles.pick}
                          onClick={() => {
                            setFocus(withMonth(month));
                            setDir(null);
                            setView("days");
                          }}
                        >
                          {label}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <div className={styles.foot}>
            <button type="button" className={styles.footAction} disabled={!inRange(today)} onClick={() => commit(today)}>
              {L.today}
            </button>
            {valid && !required && (
              <button type="button" className={styles.footQuiet} onClick={() => commit("")}>
                {L.clear}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
