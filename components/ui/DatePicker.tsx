"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { DayPicker, type CustomComponents, type Matcher } from "react-day-picker";
import { enUS, tr } from "react-day-picker/locale";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import {
  clampIso,
  datePattern,
  formatDateInput,
  isIsoDay,
  isoToUtc,
  nextDateDraft,
  parseDateInput,
  utcToIso,
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
 *   - SEÇMEK: sağdaki düğme (ya da alanda Alt+↓) takvimi açar. Başlıkta ay
 *     ve yıl İKİ AYRI LİSTE: yıllar önceki bir ekstre tarihine yüz kez
 *     "önceki ay"a basmadan iniliyor. Listeler yerli `<select>`, yani
 *     telefonda işletim sisteminin kendi çarkı açılıyor.
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
 * TAKVİMİN GÖVDESİ `react-day-picker` (28 Eylül, ikinci yazım). Elle yazılmış
 * ilk ızgara çalışıyordu ama sahibi görünüşünü "çok kötü" buldu: ay/yıl
 * değiştirmek ayrı bir ızgaraya geçmek demekti, gün hücreleri düz kutulardı.
 * Kütüphane klavyeyi (WAI-ARIA tarih seçici kalıbı: oklar gün/hafta,
 * PageUp/PageDown ay, Shift ile yıl, Home/End hafta başı/sonu), ay kaymasını
 * ve Türkçe ekran okuyucu etiketlerini veriyor; görünüşün tamamı bu modülün
 * CSS'i (kütüphanenin stil dosyası YÜKLENMİYOR). Alan, konum, çekmece ve
 * değer sözleşmesi kütüphaneden bağımsız, önceki sürümle aynı.
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
  /**
   * Sayfanın "bugün"ü (ISO). Verilmezse tarayıcının yerel günü. Vergi ve
   * portföy alanlarının üst sınırı sunucuda İstanbul günüyle hesaplanıyor;
   * takvim bugünü tarayıcıdan okursa İstanbul'un ilerisindeki bir saat
   * diliminde "Bugün" düğmesi kapalı kalıyor, bugün işareti de seçilemeyen
   * bir güne düşüyordu (28 Eylül denetimi). Sınırı veren sayfa bugünü de
   * vermeli.
   */
  today?: string;
};

/** Alan ile pencere arası ve pencerenin ekran kenarından payı. */
const GAP = 8;
const EDGE = 12;
const SHEET_QUERY = "(max-width: 639px)";
/** Sınır verilmemiş alanda ay/yıl listesinin kapsadığı yıl: geriye ve ileriye. */
const YEARS_BACK = 40;
const YEARS_AHEAD = 10;

const todayIso = () => {
  const now = new Date();
  return utcToIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
};

/* Takvim YEREL saatli `Date` ile çalışıyor, site ISO gün dizesiyle. Dönüşüm
   yerel bileşenlerden: UTC'ye çevirmek UTC'nin batısındaki saat diliminde
   seçilen günü bir gün geriye kaydırırdı. */
const isoToDate = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const dateToIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthOf = (iso: string) => isoToDate(`${iso.slice(0, 7)}-01`);

/** Kütüphanenin sınıf adları yerine modülün sınıfları; varsayılan stil hiç yüklenmiyor. */
const CALENDAR_CLASSES = {
  root: styles.calendar,
  months: styles.months,
  month: styles.month,
  month_caption: styles.caption,
  caption_label: styles.captionLabel,
  dropdowns: styles.dropdowns,
  dropdown_root: styles.dropdownRoot,
  dropdown: styles.dropdown,
  months_dropdown: styles.monthsDropdown,
  years_dropdown: styles.yearsDropdown,
  nav: styles.navGroup,
  button_previous: styles.nav,
  button_next: styles.nav,
  chevron: styles.chevron,
  month_grid: styles.grid,
  weekdays: styles.week,
  weekday: styles.weekdayHead,
  weeks: styles.weeks,
  week: styles.week,
  day: styles.cell,
  day_button: styles.day,
  selected: styles.selected,
  today: styles.today,
  outside: styles.outside,
  disabled: styles.disabled,
  hidden: styles.hidden,
  focused: styles.focused,
  weeks_before_enter: styles.weeksBeforeEnter,
  weeks_before_exit: styles.weeksBeforeExit,
  weeks_after_enter: styles.weeksAfterEnter,
  weeks_after_exit: styles.weeksAfterExit,
  caption_after_enter: styles.captionAfterEnter,
  caption_after_exit: styles.captionAfterExit,
  caption_before_enter: styles.captionBeforeEnter,
  caption_before_exit: styles.captionBeforeExit,
};

/* IZGARA `div`, `table` DEĞİL: seçici ekstre önizlemesinin tablo hücresinin
   İÇİNDE açılıyor ve oradaki `.preview thead th` / `tbody > tr` kuralları
   (yapışkan başlık, satır animasyonu, çizgi ve dolgu) takvimin hücrelerine
   iniyordu (28 Eylül, ilk sürümde ekran görüntüsünde yakalandı). Roller
   kütüphanenin verdiği gibi kalıyor; yalnızca etiketler değişiyor. */
const CALENDAR_PARTS: Partial<CustomComponents> = {
  MonthGrid: ({ className, children, ...props }) => (
    <div className={className} role="grid" aria-label={props["aria-label"]} aria-multiselectable={props["aria-multiselectable"]}>
      {children}
    </div>
  ),
  Weekdays: ({ className, children }) => (
    <div className={className} role="row" aria-hidden>
      {children}
    </div>
  ),
  Weekday: ({ className, children, ...props }) => (
    <div className={className} role="columnheader" aria-label={props["aria-label"]}>
      {children}
    </div>
  ),
  Weeks: ({ className, children }) => (
    <div className={className} role="rowgroup">
      {children}
    </div>
  ),
  Week: ({ className, children }) => (
    <div className={className} role="row">
      {children}
    </div>
  ),
  Day: ({ className, style, children, ...props }) => (
    <div className={className} style={style} role="gridcell" aria-selected={props["aria-selected"]} data-day={props["data-day" as keyof typeof props] as string}>
      {children}
    </div>
  ),
  Chevron: ({ orientation, className }) => {
    const Icon = orientation === "left" ? CaretLeft : orientation === "right" ? CaretRight : CaretDown;
    return <Icon weight="bold" size={orientation === "down" ? 11 : 14} className={className} aria-hidden />;
  },
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
  today: todayProp,
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
  const [month, setMonth] = useState(() => monthOf(valid ? current : todayProp && isIsoDay(todayProp) ? todayProp : todayIso()));
  const [sheet, setSheet] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
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
  /* HATALI METİN ALANDA KALIR (28 Eylül denetimi). Alan bırakılınca
     `editing` düşüyor ve alan eski değerin biçimine dönüyordu: yazılan
     kayboluyor, altında "Tarih okunamadı" yazıyor, okuyucu eski tarihin
     geçerli olduğunu sanıyordu (tablo hücresinde hata yalnızca `title`da). */
  const shown = editing || error ? draft : formatted;

  const inRange = useCallback((iso: string) => (!min || iso >= min) && (!max || iso <= max), [min, max]);
  const today = todayProp && isIsoDay(todayProp) ? todayProp : todayIso();
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intl, { ...opts, timeZone: "UTC" }).format(isoToUtc(iso));
  const thisYear = Number(today.slice(0, 4));
  const startMonth = min ? monthOf(min) : new Date(thisYear - YEARS_BACK, 0, 1);
  const endMonth = max ? monthOf(max) : new Date(thisYear + YEARS_AHEAD, 11, 1);
  const disabledDays: Matcher[] = [
    ...(min ? [{ before: isoToDate(min) }] : []),
    ...(max ? [{ after: isoToDate(max) }] : []),
  ];
  const longDate = (iso: string) => fmt(iso, { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  /* ODAK DÖNÜŞÜ. Masaüstünde alana; telefonun alt çekmecesinde TAKVİM
     DÜĞMESİNE (28 Eylül denetimi): dokunuşla seçilen günün ardından metin
     alanına verilen odak `inputMode="numeric"` klavyesini açıyor ve alanı
     düzenleme kipine sokuyordu. */
  const returnFocus = useCallback(() => {
    (sheet ? toggleRef : inputRef).current?.focus({ preventScroll: true });
  }, [sheet]);

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
        returnFocus();
      }
      if (submit) {
        /* Gizli alanın değeri React çizimiyle iniyor; gönderim bir kare sonra. */
        requestAnimationFrame(() => hiddenRef.current?.form?.requestSubmit());
      }
    },
    [autoSubmit, controlled, inRange, locale, onChange, returnFocus, setError],
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
    setMonth(monthOf(clampIso(start, min, max)));
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setSheet(window.matchMedia(SHEET_QUERY).matches);
    setOpen(true);
  }, [current, shown, locale, max, min, today, valid]);

  const closePicker = useCallback(
    (restoreFocus = true) => {
      setOpen(false);
      if (restoreFocus) returnFocus();
    },
    [returnFocus],
  );

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

  /* AÇILIŞTA ALTA YER AÇ. Pencere alanın altına az farkla sığmıyorsa (alanı
     ekranın ortasına getiren okuyucuda 900 piksel yükseklikte 19 piksel)
     yukarı çevrilip başlığın üstüne biniyordu; oysa sayfayı o kadar kaydırmak
     hem daha az şey örtüyor hem göz alanın altında kalıyor. Eksik pencerenin
     yarısından büyükse ya da sayfa o kadar kayamıyorsa çevirme yine devrede.
     Yalnızca AÇILIŞTA: açıkken kaydıran okuyucunun sayfası geri çekilmez. */
  useLayoutEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    const field = fieldRef.current;
    if (popup && field && supportsPopover() && !window.matchMedia(SHEET_QUERY).matches) {
      const deficit = field.getBoundingClientRect().bottom + GAP + popup.offsetHeight - (window.innerHeight - EDGE);
      const room = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (deficit > 0 && deficit < popup.offsetHeight / 2 && room >= deficit) {
        window.scrollBy({ top: Math.ceil(deficit), behavior: "instant" });
      }
    }
    place();
  }, [open, place]);

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
            /* Hatalı metin varsa üstüne yazılmıyor: okuyucu düzeltmeye döndü. */
            if (!editing && !error) setDraft(committedText.current ?? formatted);
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
          ref={toggleRef}
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
          onKeyDown={(event) => {
            /* Oklar, PageUp/PageDown (Shift ile yıl), Home/End takvimin
               kendisinde; burada yalnızca kapatma. */
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            closePicker();
          }}
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

          <DayPicker
            mode="single"
            required={false}
            autoFocus
            locale={locale === "tr" ? tr : enUS}
            weekStartsOn={1}
            showOutsideDays
            fixedWeeks
            animate={!reducedMotion}
            captionLayout="dropdown"
            navLayout="after"
            month={month}
            onMonthChange={setMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            today={isoToDate(today)}
            selected={valid ? isoToDate(current) : undefined}
            onSelect={(date) => {
              if (date) commit(dateToIso(date));
            }}
            disabled={disabledDays}
            modifiers={{ weekend: { dayOfWeek: [0, 6] } }}
            classNames={CALENDAR_CLASSES}
            modifiersClassNames={{ weekend: styles.weekend }}
            formatters={{
              formatWeekdayName: (date) => new Intl.DateTimeFormat(intl, { weekday: "short" }).format(date),
              formatMonthDropdown: (date) => new Intl.DateTimeFormat(intl, { month: "long" }).format(date),
            }}
            components={CALENDAR_PARTS}
          />

          <div className={styles.foot}>
            {!sheet && (
              <p className={cn("numeral", styles.footValue)} data-empty={!valid || undefined}>
                {valid ? longDate(current) : L.empty}
              </p>
            )}
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
