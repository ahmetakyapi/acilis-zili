"use client";

import { EASE_BRAND_POINTS } from "@/lib/motion";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleNotch, MagnifyingGlass, NotePencil, Sparkle, Trash } from "@phosphor-icons/react";
import type { SearchHit } from "@/app/api/search/route";
import {
  addPositionAction,
  suggestPriceAction,
  updatePositionAction,
  type PortfolioActionState,
  type PriceSuggestion,
} from "@/app/actions/portfolio";
import { DatePicker } from "@/components/ui/DatePicker";
import { buttonClass, LogoTile } from "@/components/ui/primitives";
import { formatDateInput, isIsoDay } from "@/lib/date-input";
import { formatDecimalInput, isAmbiguous, parseDecimalInput } from "@/lib/decimal-input";
import { formatIsoDate, formatLira, formatRate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatPrice, isValidSymbol } from "@/lib/utils";
import type { PortfolioLabels } from "./PortfolioWorkbench";
import styles from "./Workbench.module.css";

/**
 * POZİSYON FORMU — ekleme ve düzeltme aynı form.
 *
 * Sıra okuyucunun kafasındaki sırayla aynı: HANGİ hisse → KAÇ tane → KAÇA
 * → NE ZAMAN. Zorunlu olan üçü (hisse, adet, fiyat); tarih bugünle dolu
 * gelir, not kapalıdır.
 *
 * SEMBOL ARAMA ad ya da sembolle (`/api/search`, sitenin arama paletiyle
 * aynı uç, logolu). Aramanın bulamadığı ama biçimi geçerli bir sembol
 * "XYZ Sembolünü Kullan" satırıyla yine seçilebilir: listede olmayan bir
 * hisseyi tutan okuyucu kapıda kalmasın.
 *
 * FİYAT İKİ YOLDAN: hisse başı ya da ÖDENEN TOPLAM. Aracı kurum uygulaması
 * çoğu zaman toplamı gösteriyor ("0,4213 adet, 50 $"); okuyucu bölme
 * yapmasın. Kaydedilen her zaman hisse başı fiyat (şema değişmedi).
 *
 * ÖNERİ, DOLDURMA DEĞİL. Seçilen gün için elimizdeki kapanış (ya da seans
 * açıkken son fiyat) alanın altında adıyla ve tarihiyle duruyor; alana
 * ancak "Kullan"a basınca yazılıyor (`suggestPriceAction` gerekçesi).
 *
 * SAYILAR DİLİN KURALIYLA (`lib/decimal-input.ts`): TR'de virgül ondalık,
 * belirsiz girişte ("1.845") alanın altında nasıl okunduğu yazıyor.
 * Sunucuya NOKTALI biçim gidiyor.
 */

export type ComposerPosition = {
  id: string;
  symbol: string;
  quantity: number;
  costUsd: number;
  boughtAt: string;
  note: string | null;
  name?: string | null;
  logoUrl?: string | null;
};

type Picked = { symbol: string; name: string | null; logo: string | null };
type Field = "symbol" | "quantity" | "costUsd" | "boughtAt";

/** Arama tuş vuruşu bekleme süresi — `CompareAdd` ile aynı. */
const SEARCH_DEBOUNCE_MS = 200;
const SUGGEST_DEBOUNCE_MS = 250;
const MAX_HITS = 6;
/** Şema hisse başı fiyatı altı ondalıkla tutuyor. */
const COST_DECIMALS = 6;
const EASE = EASE_BRAND_POINTS;

export function PositionComposer({
  labels,
  locale,
  today,
  minDate,
  maxPositions,
  editing,
  preset = null,
  onCancel,
  onDelete,
  onSell,
  sellLabel,
  onSaved,
}: {
  labels: PortfolioLabels;
  locale: Locale;
  today: string;
  minDate: string;
  maxPositions: number;
  editing: ComposerPosition | null;
  /** Hisse sayfasından gelindiyse seçili sembol (`/portfoy?ekle=`). */
  preset?: Picked | null;
  onCancel: () => void;
  /** Yalnızca düzeltmede: silme de burada, telefonda tablonun sonuna gitmesin. */
  onDelete?: () => void;
  /** Yalnızca düzeltmede ve satış kaydı açıksa: telefonda Sat'ın tek yolu. */
  onSell?: () => void;
  sellLabel?: string;
  onSaved: (id: string, symbol: string) => void;
}) {
  const C = labels.composer;
  const formId = useId();
  const listId = useId();
  const [state, action, pending] = useActionState<PortfolioActionState, FormData>(
    editing ? updatePositionAction : addPositionAction,
    { status: "idle" },
  );

  /* ---- Alanlar ---- */
  const [picked, setPicked] = useState<Picked | null>(
    editing ? { symbol: editing.symbol, name: editing.name ?? null, logo: editing.logoUrl ?? null } : preset,
  );
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState(editing ? formatDecimalInput(editing.quantity, locale) : "");
  const [mode, setMode] = useState<"share" | "total">("share");
  const [price, setPrice] = useState(editing ? formatDecimalInput(editing.costUsd, locale, { money: true }) : "");
  const [date, setDate] = useState(editing?.boughtAt ?? today);
  /* Tarih alanına yazılan metin okunamıyorsa seçici eski değeri tutuyor;
     form o hâlde GÖNDERİLMEZ, yoksa okuyucu yazdığını değil eskisini kaydederdi. */
  const [dateTextValid, setDateTextValid] = useState(true);
  const [noteOpen, setNoteOpen] = useState(Boolean(editing?.note));
  const [note, setNote] = useState(editing?.note ?? "");
  const noteRef = useRef<HTMLInputElement>(null);
  const editingNote = Boolean(editing?.note);
  useEffect(() => {
    /* "Not Ekle"ye basınca alan açılır ve odak ona geçer; düzeltmede var
       olan not zaten açık gelir ve odak çalınmaz. */
    if (noteOpen && !editingNote) noteRef.current?.focus({ preventScroll: true });
  }, [noteOpen, editingNote]);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const qty = parseDecimalInput(quantity, locale);
  const amount = parseDecimalInput(price, locale);
  const perShare = amount !== null && amount > 0 ? (mode === "share" ? amount : qty && qty > 0 ? amount / qty : null) : null;
  const totalUsd = perShare !== null && qty !== null && qty > 0 ? perShare * qty : null;

  /* ---- Doğrulama ----
     İstemci hataları alan bırakılınca ya da ilk gönderimde görünür ve
     gönderimi durdurur. Sunucunun işaret ettiği alan (istemcinin geçerli
     sandığı ama şemanın reddettiği) ayrıca gösterilir, gönderimi durdurmaz:
     okuyucu düzeltip yeniden gönderebilsin. */
  const typedSymbol = query.trim().toLocaleUpperCase("en-US");
  const dateError = C.errDate.replace("{min}", formatDateInput(minDate, locale));
  const clientErrors: Partial<Record<Field, string>> = {};
  if (!picked) clientErrors.symbol = typedSymbol && !isValidSymbol(typedSymbol) ? C.errSymbolFormat : C.errSymbol;
  if (!(qty !== null && qty > 0)) clientErrors.quantity = C.errQuantity;
  if (!(amount !== null && amount > 0)) clientErrors.costUsd = C.errPrice;
  if (!isIsoDay(date) || date < minDate || date > today || !dateTextValid) clientErrors.boughtAt = dateError;
  const serverField = state.status === "error" ? state.field : undefined;
  const serverMessage: Record<Field, string> = {
    symbol: C.errSymbolFormat,
    quantity: C.errQuantity,
    costUsd: C.errPrice,
    boughtAt: dateError,
  };
  const visible = (field: Field) => {
    /* Seçici kendi okuma hatasını zaten altında yazıyor; ikinci kez yazılmaz. */
    if (field === "boughtAt" && !dateTextValid) return undefined;
    return ((submitted || touched[field]) && clientErrors[field]) || (serverField === field ? serverMessage[field] : undefined);
  };

  /* ---- Kayıt tamam ---- */
  const savedRef = useRef<PortfolioActionState | null>(null);
  useEffect(() => {
    if (state.status === "saved" && state.id && savedRef.current !== state) {
      savedRef.current = state;
      onSaved(state.id, picked?.symbol ?? "");
    }
  }, [state, onSaved, picked]);

  /* ---- Fiyat önerisi ---- */
  const [suggestion, setSuggestion] = useState<{ key: string; data: PriceSuggestion | null }>({ key: "", data: null });
  const suggestKey = picked && isIsoDay(date) ? `${picked.symbol}|${date}` : "";
  useEffect(() => {
    if (!suggestKey) return;
    let live = true;
    const [symbol, day] = suggestKey.split("|");
    const timer = window.setTimeout(async () => {
      try {
        const data = await suggestPriceAction(symbol, day);
        if (live) setSuggestion({ key: suggestKey, data });
      } catch {
        if (live) setSuggestion({ key: suggestKey, data: { price: null, fx: null } });
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [suggestKey]);
  const suggestReady = suggestion.key === suggestKey && suggestKey !== "";
  const offer = suggestReady ? suggestion.data?.price ?? null : null;
  const fx = suggestReady ? suggestion.data?.fx ?? null : null;

  const offerLabel = offer
    ? offer.kind === "last"
      ? C.suggestLast
      : (offer.kind === "close" ? C.suggestClose : C.suggestPrevious).replace("{date}", formatIsoDate(offer.date, locale))
    : "";

  const money = (value: number) => formatPrice(value, locale, { currency: true });
  /* Önerinin gösterilen ve alana yazılan hâli AYNI sayı: dolar üstünde iki,
     altında dört ondalık (kuruşluk hisselerde iki ondalık fiyatı siler). */
  const offerDigits = offer && offer.value < 1 ? 4 : 2;
  /* Yuvarlama Intl'in: `toFixed` 231,195'i ikili kayan noktada 231,19 yapıyor,
     ekrandaki biçim 231,20 diyordu (ölçüldü). */
  const offerText = offer ? formatDecimalInput(offer.value, locale, { money: true, maxFraction: offerDigits }) : "";
  const offerUsed = offer !== null && mode === "share" && price.trim() === offerText;
  const errorMessage =
    state.status === "error" && state.error && !state.field
      ? state.error === "limit"
        ? labels.errors.limit.replace("{max}", String(maxPositions))
        : labels.errors[state.error]
      : null;

  return (
    <form
      id={formId}
      action={action}
      noValidate
      className={styles.composer}
      onSubmit={(event) => {
        setSubmitted(true);
        const first = (["symbol", "quantity", "costUsd", "boughtAt"] as const).find((field) => clientErrors[field]);
        if (first) {
          event.preventDefault();
          document.getElementById(`${formId}-${first}`)?.focus();
        }
      }}
    >
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <input type="hidden" name="symbol" value={picked?.symbol ?? ""} />
      <input type="hidden" name="quantity" value={qty !== null && qty > 0 ? String(qty) : ""} />
      <input type="hidden" name="costUsd" value={perShare !== null ? perShare.toFixed(COST_DECIMALS) : ""} />
      <input type="hidden" name="note" value={noteOpen ? note : ""} />

      {/* ---- 1. Hisse ---- */}
      <SymbolField
        id={`${formId}-symbol`}
        listId={listId}
        labels={labels}
        picked={picked}
        query={query}
        setQuery={setQuery}
        error={visible("symbol")}
        autoFocus={!editing && !preset}
        onPick={(next) => {
          setPicked(next);
          setTouched((t) => ({ ...t, symbol: true }));
          window.setTimeout(() => document.getElementById(`${formId}-quantity`)?.focus(), 0);
        }}
        onClear={() => {
          setPicked(null);
          setQuery("");
          window.setTimeout(() => document.getElementById(`${formId}-symbol`)?.focus(), 0);
        }}
        onBlur={() => setTouched((t) => ({ ...t, symbol: true }))}
      />

      {/* ---- 2. Adet ve tarih ---- */}
      <div className={styles.pair}>
        <label className={styles.fieldBlock}>
          <span className={styles.label}>{C.quantityLabel}</span>
          <input
            id={`${formId}-quantity`}
            inputMode="decimal"
            autoComplete="off"
            placeholder={C.quantityPlaceholder}
            value={quantity}
            aria-invalid={visible("quantity") ? true : undefined}
            aria-describedby={`${formId}-quantity-help`}
            onChange={(event) => setQuantity(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, quantity: quantity !== "" || t.quantity }))}
            className={cn("numeral", styles.input)}
          />
          <FieldHelp
            id={`${formId}-quantity-help`}
            error={visible("quantity")}
            hint={qty !== null && isAmbiguous(quantity, locale) ? C.readAs.replace("{value}", formatDecimalInput(qty, locale)) : null}
          />
        </label>
        <div className={styles.fieldBlock}>
          <label className={styles.label} htmlFor={`${formId}-boughtAt`}>
            {C.dateLabel}
          </label>
          <DatePicker
            id={`${formId}-boughtAt`}
            name="boughtAt"
            required
            locale={locale}
            value={date}
            min={minDate}
            max={today}
            today={today}
            aria-invalid={visible("boughtAt") ? true : undefined}
            onValidityChange={setDateTextValid}
            onChange={(value) => {
              setDate(value);
              setTouched((t) => ({ ...t, boughtAt: true }));
            }}
          />
          <FieldHelp id={`${formId}-boughtAt-help`} error={visible("boughtAt")} />
        </div>
      </div>

      {/* ---- 3. Fiyat ---- */}
      <div className={styles.fieldBlock}>
        <div className={styles.priceHead}>
          <label className={styles.label} htmlFor={`${formId}-costUsd`}>
            {mode === "share" ? C.priceLabel : C.totalLabel}
          </label>
          <div className={styles.segment} role="radiogroup" aria-label={C.priceModeLabel}>
            {(["share", "total"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                className={styles.segmentItem}
                onClick={() => {
                  if (option === mode) return;
                  /* Tür değişince yazılan sayı yeni türe ÇEVRİLİYOR: 10 adet ×
                     172,50 yazılıysa "Toplam"a geçince 1.725,00 görünür. */
                  if (amount !== null && amount > 0 && qty !== null && qty > 0) {
                    const converted = option === "total" ? amount * qty : amount / qty;
                    setPrice(formatDecimalInput(converted, locale, { money: true, maxFraction: option === "total" ? 2 : 4 }));
                  }
                  setMode(option);
                }}
              >
                {mode === option && (
                  <motion.span layoutId={`${formId}-segment`} className={styles.segmentThumb} transition={{ duration: 0.3, ease: EASE }} />
                )}
                <span className={styles.segmentText}>{option === "share" ? C.perShare : C.total}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.moneyField} data-invalid={visible("costUsd") ? true : undefined}>
          <span className={styles.moneyPrefix} aria-hidden>
            $
          </span>
          <input
            id={`${formId}-costUsd`}
            inputMode="decimal"
            autoComplete="off"
            value={price}
            placeholder={formatDecimalInput(0, locale, { money: true })}
            aria-invalid={visible("costUsd") ? true : undefined}
            aria-describedby={`${formId}-costUsd-help`}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, costUsd: price !== "" || t.costUsd }))}
            className={cn("numeral", styles.moneyInput)}
          />
        </div>
        <FieldHelp
          id={`${formId}-costUsd-help`}
          error={visible("costUsd")}
          hint={
            amount !== null && isAmbiguous(price, locale)
              ? C.readAs.replace("{value}", formatDecimalInput(amount, locale))
              : mode === "total" && perShare !== null
                ? C.perShareIs.replace("{price}", formatPrice(perShare, locale, { currency: true, digits: 4 }))
                : null
          }
        />

        {/* Öneri satırı — yükleniyor / öneri / yok. Yer tutucu yükseklik sabit: satır zıplamasın. */}
        <div className={styles.suggest} data-active={suggestKey ? true : undefined} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {suggestKey && !suggestReady && (
              <motion.span key="loading" className={styles.suggestMuted} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CircleNotch size={14} weight="bold" className={styles.spin} aria-hidden />
                {C.suggestLoading}
              </motion.span>
            )}
            {suggestReady && offer && (
              <motion.div
                key={`offer-${suggestKey}`}
                className={styles.offer}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <Sparkle size={14} weight="duotone" aria-hidden className={styles.offerIcon} />
                <span className={styles.offerText}>
                  {offerLabel}
                  <strong className="numeral">{formatPrice(offer.value, locale, { currency: true, digits: offerDigits })}</strong>
                </span>
                <button
                  type="button"
                  className={styles.offerUse}
                  disabled={offerUsed}
                  onClick={() => {
                    setMode("share");
                    setPrice(offerText);
                    setTouched((t) => ({ ...t, costUsd: true }));
                  }}
                >
                  {offerUsed ? <Check size={14} weight="bold" aria-hidden /> : null}
                  {C.suggestUse}
                </button>
              </motion.div>
            )}
            {suggestReady && !offer && (
              <motion.span key="none" className={styles.suggestMuted} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {C.suggestNone}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ---- Özet: ne kaydedilecek ---- */}
      <AnimatePresence initial={false}>
        {totalUsd !== null && (
          <motion.div
            className={styles.summary}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className={styles.summaryInner}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>{C.summaryCost}</span>
                <span className={cn("numeral", styles.summaryValue)}>{money(totalUsd)}</span>
              </div>
              {suggestReady &&
                (fx ? (
                  <div className={styles.summaryRow}>
                    <span className={cn("numeral", styles.summaryLabel)}>
                      {C.summaryFx.replace("{date}", formatIsoDate(fx.bulletinDate, locale)).replace("{rate}", formatRate(fx.rate, locale))}
                    </span>
                    <span className={cn("numeral", styles.summaryValueSoft)}>{formatLira(totalUsd * fx.rate, locale)}</span>
                  </div>
                ) : (
                  <p className={styles.summaryNote}>{C.summaryFxMissing}</p>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Not ---- */}
      {noteOpen ? (
        <label className={styles.fieldBlock}>
          <span className={styles.label}>{C.noteLabel}</span>
          <input
            maxLength={120}
            value={note}
            placeholder={C.notePlaceholder}
            onChange={(event) => setNote(event.target.value)}
            className={styles.input}
            ref={noteRef}
          />
        </label>
      ) : (
        <button type="button" className={styles.linkButton} onClick={() => setNoteOpen(true)}>
          <NotePencil size={15} weight="duotone" aria-hidden />
          {C.noteToggle}
        </button>
      )}

      {errorMessage && (
        <p role="alert" className={styles.formError}>
          {errorMessage}
        </p>
      )}

      {/* ---- Eylem: çekmecenin dibinde, başparmağın altında ---- */}
      <div className={styles.composerActions}>
        {onDelete ? (
          <button type="button" onClick={onDelete} className={buttonClass({ variant: "danger", size: "lg" })}>
            <Trash size={16} weight="duotone" aria-hidden />
            {labels.remove}
          </button>
        ) : (
          <button type="button" onClick={onCancel} className={buttonClass({ variant: "quiet", size: "lg" })}>
            {C.cancel}
          </button>
        )}
        {onSell && sellLabel && (
          <button type="button" onClick={onSell} className={buttonClass({ variant: "ghost", size: "lg" })}>
            {sellLabel}
          </button>
        )}
        <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: styles.submit })}>
          {pending && <CircleNotch size={16} weight="bold" className={styles.spin} aria-hidden />}
          {pending ? C.saving : editing ? C.submitEdit : C.submitAdd}
        </button>
      </div>
    </form>
  );
}

function FieldHelp({ id, error, hint }: { id: string; error?: string; hint?: string | null }) {
  if (!error && !hint) return <span id={id} hidden />;
  return (
    <span id={id} className={error ? styles.fieldError : styles.fieldHint} role={error ? "alert" : "status"}>
      {error ?? hint}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Sembol alanı — WAI-ARIA combobox (liste kutusu, `aria-activedescendant`)
   -------------------------------------------------------------------------- */

function SymbolField({
  id,
  listId,
  labels,
  picked,
  query,
  setQuery,
  error,
  autoFocus,
  onPick,
  onClear,
  onBlur,
}: {
  id: string;
  listId: string;
  labels: PortfolioLabels;
  picked: Picked | null;
  query: string;
  setQuery: (value: string) => void;
  error?: string;
  autoFocus: boolean;
  onPick: (picked: Picked) => void;
  onClear: () => void;
  onBlur: () => void;
}) {
  const C = labels.composer;
  const [result, setResult] = useState<{ term: string; hits: SearchHit[]; failed: boolean } | null>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (term.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) {
          setResult({ term, hits: [], failed: true });
          return;
        }
        const data = (await res.json()) as { hits?: SearchHit[] };
        setResult({ term, hits: (data.hits ?? []).slice(0, MAX_HITS), failed: false });
        setActive(0);
      } catch (err) {
        /* İptal hata değil: her tuş vuruşu bir öncekini iptal ediyor. */
        if ((err as Error)?.name !== "AbortError") setResult({ term, hits: [], failed: true });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const fresh = result?.term === term;
  const hits = useMemo(() => (fresh ? (result?.hits ?? []) : []), [fresh, result]);
  const typed = term.toLocaleUpperCase("en-US");
  const offerTyped = isValidSymbol(typed) && !hits.some((hit) => hit.symbol === typed);
  const options: Picked[] = [
    ...hits.map((hit) => ({ symbol: hit.symbol, name: hit.name, logo: hit.logo ?? null })),
    ...(offerTyped && fresh ? [{ symbol: typed, name: null, logo: null }] : []),
  ];
  const showList = open && term.length > 0;

  if (picked) {
    return (
      <div className={styles.fieldBlock}>
        <span className={styles.label}>{C.symbolLabel}</span>
        {/* SEÇİLİ HİSSE BİR ALAN, AYRI BİR NESNE DEĞİL (29 Eylül). Gömük gri
            bir kutuydu; formun geri kalanı çerçeveli alanlardan oluşurken o
            başka bir bileşen gibi duruyordu. Şimdi arama alanının kendisi
            DOLMUŞ gibi: aynı çerçeve ve yükseklik, büyütecin yerinde logo,
            kenar marka tonunda ve sembolün yanında seçildiğini söyleyen bir
            onay. Açılış ölçeklenmiyor, yalnızca beliriyor — telefonda bir
            "zoom" gibi okunuyordu. */}
        <motion.div
          className={styles.picked}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <LogoTile symbol={picked.symbol} logoUrl={picked.logo} size="md" />
          <span className={styles.pickedText}>
            <span className={styles.pickedLine}>
              <span className={cn("numeral", styles.pickedSymbol)}>{picked.symbol}</span>
              <Check size={13} weight="bold" aria-hidden className={styles.pickedCheck} />
            </span>
            {picked.name && <span className={styles.pickedName}>{picked.name}</span>}
          </span>
          <button id={id} type="button" className={styles.linkButton} onClick={onClear}>
            {C.change}
          </button>
        </motion.div>
      </div>
    );
  }

  const choose = (option: Picked | undefined) => {
    if (!option) return;
    setOpen(false);
    onPick(option);
  };

  return (
    <div className={styles.fieldBlock}>
      <label className={styles.label} htmlFor={id}>
        {C.symbolLabel}
      </label>
      <div className={styles.searchWrap}>
        <div className={styles.searchField} data-invalid={error ? true : undefined}>
          <MagnifyingGlass size={17} weight="bold" aria-hidden className={styles.searchIcon} />
          <input
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-help` : undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            data-autofocus={autoFocus || undefined}
            placeholder={C.symbolPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              onBlur();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(options[active] ?? (offerTyped ? { symbol: typed, name: null, logo: null } : undefined));
              } else if (event.key === "Escape" && showList) {
                event.preventDefault();
                setOpen(false);
              }
            }}
            className={styles.searchInput}
          />
          {term && !fresh && <CircleNotch size={16} weight="bold" className={cn(styles.spin, styles.searchSpin)} aria-label={C.searching} />}
        </div>
        <AnimatePresence>
          {showList && (fresh || offerTyped) && (
            <motion.ul
              id={listId}
              role="listbox"
              aria-label={C.symbolLabel}
              className={styles.results}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {options.map((option, i) => (
                <li
                  key={`${option.symbol}-${option.name ? "hit" : "typed"}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={styles.result}
                  data-active={i === active || undefined}
                  /* `mousedown` alanın odağını düşürmeden seçer. */
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  {option.name ? (
                    <>
                      <LogoTile symbol={option.symbol} logoUrl={option.logo} size="sm" />
                      <span className={cn("numeral", styles.resultSymbol)}>{option.symbol}</span>
                      <span className={styles.resultName}>{option.name}</span>
                    </>
                  ) : (
                    <span className={styles.resultTyped}>{C.useTyped.replace("{symbol}", option.symbol)}</span>
                  )}
                </li>
              ))}
              {fresh && options.length === 0 && (
                <li className={styles.resultEmpty} role="presentation">
                  {result?.failed ? C.searchError : C.noResults}
                </li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      {error && (
        <span id={`${id}-help`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
