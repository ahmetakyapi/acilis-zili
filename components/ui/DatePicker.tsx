"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import styles from "./DatePicker.module.css";

/**
 * Tarih seçici — tarayıcının yerel takvimi yerine sitenin dili (26 Eylül).
 *
 * NEDEN: yönetimdeki üç tarih alanı `<input type="date">` idi ve açılan
 * pencere tarayıcının kendi takvimiydi: stillenemiyor, sitenin yazısını ve
 * renklerini almıyor, gün adları tek harf, seçili gün gri bir kutu —
 * "demode" bulundu (ekran görüntüsüyle). Bu bileşen aynı işi sitenin
 * görsel diliyle yapıyor.
 *
 * FORMLA UYUM. Değer gizli bir `<input>` ile taşınıyor (`name` verilirse),
 * yani GET süzgeç formları JavaScript'e bağlı değil. `autoSubmit` ile seçim
 * formu kendiliğinden gönderiyor (liste süzgeci); editörde denetimli
 * (`value` + `onChange`).
 *
 * KLAVYE. Izgara `grid` rolünde; oklar gün/hafta, PageUp/PageDown ay,
 * Home/End hafta başı/sonu, Enter/Boşluk seçer, Escape kapatır ve odağı
 * tetikleyiciye geri verir. Aralık (`min`/`max`) dışındaki günler soluk ve
 * seçilemiyor. Hareketi azaltana açılış animasyonu yok.
 *
 * Tarihler "YYYY-AA-GG" dizesi olarak işleniyor, `Date` saat dilimine hiç
 * sokulmuyor: gün hesabı UTC öğlesinde yapılıyor ki yaz saati geçişi bir
 * günü kaydırmasın.
 */

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  /** Seçim yapılınca çevreleyen formu gönder. */
  autoSubmit?: boolean;
  locale?: "tr" | "en";
  id?: string;
  className?: string;
  /** Erişilebilir ad — görünür etiket yoksa. */
  "aria-label"?: string;
  "aria-describedby"?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * 86_400_000);
const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  return fromUtc(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last), 12));
};
const todayIso = () => {
  const now = new Date();
  return fromUtc(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
};

export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required,
  autoSubmit,
  locale = "tr",
  id,
  className,
  ...aria
}: Props) {
  const intl = locale === "tr" ? "tr-TR" : "en-US";
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = controlled ? value : inner;
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(() => (ISO.test(current) ? current : todayIso()));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const popupId = useId();

  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);

  const label = ISO.test(current)
    ? new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(toUtc(current))
    : locale === "tr" ? "Tarih Seç" : "Pick a Date";

  /* Ayın ızgarası: pazartesiden başlayan altı hafta — satır sayısı aya göre
     değişmesin, pencere zıplamasın. */
  const monthStart = `${focus.slice(0, 7)}-01`;
  const days = useMemo(() => {
    const weekday = (new Date(toUtc(monthStart)).getUTCDay() + 6) % 7;
    const start = addDays(monthStart, -weekday);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthStart]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
    /* 2026-09-28 bir pazartesi: yedi günlük başlık oradan. */
    return Array.from({ length: 7 }, (_, i) => f.format(toUtc(addDays("2026-09-28", i))));
  }, [intl]);
  const monthLabel = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(toUtc(monthStart));
  const today = todayIso();

  function commit(iso: string) {
    if (!inRange(iso)) return;
    if (!controlled) setInner(iso);
    onChange?.(iso);
    setOpen(false);
    triggerRef.current?.focus();
    if (autoSubmit) {
      /* Gizli alanın değeri React çizimiyle güncelleniyor; gönderim bir
         kare sonra, yeni değer DOM'a indikten sonra. */
      requestAnimationFrame(() => hiddenRef.current?.form?.requestSubmit());
    }
  }

  function openPicker() {
    setFocus(ISO.test(current) ? current : inRange(today) ? today : (max ?? min ?? today));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [open, focus]);

  function onKey(event: React.KeyboardEvent) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1),
      PageDown: () => addMonths(focus, 1),
      Home: () => addDays(focus, -((new Date(toUtc(focus)).getUTCDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((new Date(toUtc(focus)).getUTCDay() + 6) % 7)),
    };
    if (moves[event.key]) {
      event.preventDefault();
      setFocus(moves[event.key]());
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const canPrev = !min || `${addMonths(monthStart, -1).slice(0, 7)}-31` >= min;
  const canNext = !max || `${addMonths(monthStart, 1).slice(0, 7)}-01` <= max;

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      {name && <input ref={hiddenRef} type="hidden" name={name} value={current} required={required} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.trigger}
        data-empty={!ISO.test(current) || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-label={aria["aria-label"] ? `${aria["aria-label"]}: ${label}` : undefined}
        aria-describedby={aria["aria-describedby"]}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <CalendarBlank weight="duotone" size={17} aria-hidden />
        <span className="numeral">{label}</span>
      </button>

      {open && (
        <div id={popupId} role="dialog" aria-label={monthLabel} className={styles.popup} onKeyDown={onKey}>
          <div className={styles.head}>
            <button type="button" className={styles.nav} disabled={!canPrev} aria-label={locale === "tr" ? "Önceki Ay" : "Previous Month"} onClick={() => setFocus(addMonths(focus, -1))}>
              <CaretLeft weight="bold" size={14} aria-hidden />
            </button>
            <p key={monthStart} className={styles.month}>{monthLabel}</p>
            <button type="button" className={styles.nav} disabled={!canNext} aria-label={locale === "tr" ? "Sonraki Ay" : "Next Month"} onClick={() => setFocus(addMonths(focus, 1))}>
              <CaretRight weight="bold" size={14} aria-hidden />
            </button>
          </div>
          <div className={styles.weekdays} aria-hidden>
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div ref={gridRef} role="grid" key={monthStart} className={styles.grid}>
            {days.map((iso) => {
              const outside = iso.slice(0, 7) !== focus.slice(0, 7);
              const disabled = !inRange(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  data-day={iso}
                  tabIndex={iso === focus ? 0 : -1}
                  disabled={disabled}
                  aria-selected={iso === current}
                  aria-current={iso === today ? "date" : undefined}
                  data-outside={outside || undefined}
                  className={cn("numeral", styles.day)}
                  onClick={() => commit(iso)}
                  onFocus={() => iso !== focus && setFocus(iso)}
                >
                  {Number(iso.slice(8))}
                </button>
              );
            })}
          </div>
          <div className={styles.foot}>
            <button type="button" className={styles.today} disabled={!inRange(today)} onClick={() => commit(today)}>
              {locale === "tr" ? "Bugün" : "Today"}
            </button>
            {ISO.test(current) && !required && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  if (!controlled) setInner("");
                  onChange?.("");
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {locale === "tr" ? "Temizle" : "Clear"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
