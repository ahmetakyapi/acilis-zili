"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";
import {
  sellPositionAction,
  suggestPriceAction,
  type PortfolioActionState,
  type PriceSuggestion,
} from "@/app/actions/portfolio";
import { DatePicker } from "@/components/ui/DatePicker";
import { buttonClass, LogoTile } from "@/components/ui/primitives";
import { isIsoDay } from "@/lib/date-input";
import { formatDecimalInput, parseDecimalInput } from "@/lib/decimal-input";
import { formatIsoDate } from "@/lib/fx";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, directionOf, directionText, formatPercent, formatPrice } from "@/lib/utils";
import type { PortfolioLabels } from "./PortfolioWorkbench";
import styles from "./Workbench.module.css";

export type SellLot = { quantity: number; costUsd: number; boughtAt: string };

const SUGGEST_DEBOUNCE_MS = 250;
const PRICE_DECIMALS = 6;

/**
 * SATIŞ FORMU — gerekçe `lib/schema.ts` → portfolioSales.
 *
 * Satış SEMBOLE yapılıyor (FIFO), o yüzden form sembolün bütün partilerini
 * biliyor: "Eldeki Adet" satış gününde elde olan toplam (o günden sonra
 * alınmış parti sayılmaz) ve "Tümü" onu dolduruyor. Önizleme dolar kârını
 * AYNI FIFO sırasıyla hesaplıyor; lira tarafı kayıttan sonra, iki günün
 * TCMB kuruyla geliyor (önizlemede kur uydurulmuyor).
 *
 * Fiyat önerisi ekleme formuyla aynı uç (`suggestPriceAction`): seçilen
 * günün kapanışı ya da seans açıkken son fiyat, ADIYLA; alana ancak
 * "Kullan"a basınca yazılıyor.
 */
export function SellComposer({
  symbol,
  name,
  logoUrl,
  lots,
  labels,
  sales,
  locale,
  today,
  minDate,
  onCancel,
  onSaved,
}: {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  lots: SellLot[];
  labels: PortfolioLabels;
  sales: Dictionary["portfolioSales"];
  locale: Locale;
  today: string;
  minDate: string;
  onCancel: () => void;
  onSaved: (saleId: string, symbol: string) => void;
}) {
  const S = sales;
  const C = labels.composer;
  const formId = useId();
  const [state, action, pending] = useActionState<PortfolioActionState, FormData>(sellPositionAction, { status: "idle" });
  const [date, setDate] = useState(today);
  const [dateTextValid, setDateTextValid] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const held = lots.filter((lot) => lot.boughtAt <= date).reduce((sum, lot) => sum + lot.quantity, 0);
  const qty = parseDecimalInput(quantity, locale);
  const perShare = parseDecimalInput(price, locale);

  useEffect(() => {
    if (state.status === "saved" && state.id) onSaved(state.id, symbol);
  }, [state, onSaved, symbol]);

  /* ---- Fiyat önerisi (ekleme formuyla aynı) ---- */
  const [suggestion, setSuggestion] = useState<{ key: string; data: PriceSuggestion | null }>({ key: "", data: null });
  const suggestKey = isIsoDay(date) ? `${symbol}|${date}` : "";
  useEffect(() => {
    if (!suggestKey) return;
    let live = true;
    const [sym, day] = suggestKey.split("|");
    const timer = window.setTimeout(async () => {
      try {
        const data = await suggestPriceAction(sym, day);
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
  const offerDigits = offer && offer.value < 1 ? 4 : 2;
  const offerText = offer ? formatDecimalInput(offer.value, locale, { money: true, maxFraction: offerDigits }) : "";
  const offerLabel = offer
    ? offer.kind === "last"
      ? C.suggestLast
      : (offer.kind === "close" ? C.suggestClose : C.suggestPrevious).replace("{date}", formatIsoDate(offer.date, locale))
    : "";

  /* ---- Doğrulama ---- */
  const quantityText = (value: number) =>
    new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 8 }).format(value);
  const clientErrors: Partial<Record<"quantity" | "priceUsd" | "soldAt", string>> = {};
  if (!(qty !== null && qty > 0)) clientErrors.quantity = S.errQuantity;
  else if (qty > held + 1e-8) clientErrors.quantity = held > 0 ? S.errTooMany.replace("{qty}", quantityText(held)) : S.errNoLots;
  if (!(perShare !== null && perShare > 0)) clientErrors.priceUsd = S.errPrice;
  if (!isIsoDay(date) || !dateTextValid) clientErrors.soldAt = S.errDate;
  else if (held <= 0) clientErrors.soldAt = S.errNoLots;

  const serverError =
    state.status === "error"
      ? state.field === "quantity" && state.available !== undefined
        ? { field: "quantity" as const, text: S.errTooMany.replace("{qty}", quantityText(state.available)) }
        : state.field === "soldAt"
          ? { field: "soldAt" as const, text: S.errNoLots }
          : state.field === "priceUsd"
            ? { field: "priceUsd" as const, text: S.errPrice }
            : null
      : null;
  const visible = (field: "quantity" | "priceUsd" | "soldAt") =>
    (submitted ? clientErrors[field] : undefined) ?? (serverError?.field === field ? serverError.text : undefined);
  const generalError =
    state.status === "error" && !serverError && state.error
      ? state.error === "limit"
        ? labels.errors.limit.replace("{max}", "200")
        : labels.errors[state.error]
      : null;

  /* ---- Önizleme: FIFO sırasıyla dolar kârı ---- */
  let preview: { cost: number; proceeds: number } | null = null;
  if (qty !== null && qty > 0 && qty <= held + 1e-8 && perShare !== null && perShare > 0) {
    let left = qty;
    let cost = 0;
    for (const lot of [...lots].filter((l) => l.boughtAt <= date).sort((a, b) => (a.boughtAt < b.boughtAt ? -1 : a.boughtAt > b.boughtAt ? 1 : 0))) {
      if (left <= 1e-8) break;
      const take = Math.min(lot.quantity, left);
      cost += take * lot.costUsd;
      left -= take;
    }
    preview = { cost, proceeds: qty * perShare };
  }
  const pnl = preview ? preview.proceeds - preview.cost : null;
  const money = (value: number, signed = false) =>
    `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true })}`;

  return (
    <form
      action={action}
      noValidate
      className={styles.composer}
      onSubmit={(event) => {
        setSubmitted(true);
        const first = (["quantity", "soldAt", "priceUsd"] as const).find((field) => clientErrors[field]);
        if (first) {
          event.preventDefault();
          document.getElementById(`${formId}-${first}`)?.focus();
        }
      }}
    >
      <input type="hidden" name="symbol" value={symbol} />
      <input type="hidden" name="quantity" value={qty !== null && qty > 0 ? String(qty) : ""} />
      <input type="hidden" name="priceUsd" value={perShare !== null && perShare > 0 ? perShare.toFixed(PRICE_DECIMALS) : ""} />

      {/* ---- Hisse ve eldeki adet ---- */}
      <div className={styles.picked}>
        <LogoTile symbol={symbol} logoUrl={logoUrl} size="md" />
        <span className={styles.pickedText}>
          <span className={styles.pickedLine}>
            <span className={styles.pickedSymbol}>{symbol}</span>
          </span>
          {name && <span className={styles.pickedName}>{name}</span>}
        </span>
        <span className="ml-auto text-right">
          <span className="block text-tiny text-muted">{S.held}</span>
          <strong className="numeral block text-read text-strong">{quantityText(held)}</strong>
          {lots.length > 1 && <span className="block text-nano text-muted">{S.heldLots.replace("{n}", String(lots.length))}</span>}
        </span>
      </div>

      {/* ---- Adet ve tarih ---- */}
      <div className={styles.pair}>
        <div className={styles.fieldBlock}>
          <span className="flex items-center justify-between gap-2">
            <label className={styles.label} htmlFor={`${formId}-quantity`}>
              {S.quantity}
            </label>
            <button
              type="button"
              className="text-small font-semibold text-primary-ink hover:text-primary-hover disabled:opacity-45"
              disabled={held <= 0}
              onClick={() => setQuantity(formatDecimalInput(held, locale, { maxFraction: 8 }))}
            >
              {S.all}
            </button>
          </span>
          <input
            id={`${formId}-quantity`}
            inputMode="decimal"
            autoComplete="off"
            data-autofocus
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-invalid={visible("quantity") ? true : undefined}
            aria-describedby={`${formId}-quantity-help`}
            className={cn("numeral", styles.input)}
          />
          <Help id={`${formId}-quantity-help`} error={visible("quantity")} />
        </div>
        <div className={styles.fieldBlock}>
          <label className={styles.label} htmlFor={`${formId}-soldAt`}>
            {S.date}
          </label>
          <DatePicker
            id={`${formId}-soldAt`}
            name="soldAt"
            required
            locale={locale}
            value={date}
            min={minDate}
            max={today}
            today={today}
            aria-invalid={visible("soldAt") ? true : undefined}
            onValidityChange={setDateTextValid}
            onChange={setDate}
          />
          <Help id={`${formId}-soldAt-help`} error={visible("soldAt")} />
        </div>
      </div>

      {/* ---- Fiyat ---- */}
      <div className={styles.fieldBlock}>
        <label className={styles.label} htmlFor={`${formId}-priceUsd`}>
          {S.price}
        </label>
        <div className={styles.moneyField} data-invalid={visible("priceUsd") ? true : undefined}>
          <span className={styles.moneyPrefix} aria-hidden>
            $
          </span>
          <input
            id={`${formId}-priceUsd`}
            inputMode="decimal"
            autoComplete="off"
            value={price}
            placeholder={formatDecimalInput(0, locale, { money: true })}
            aria-invalid={visible("priceUsd") ? true : undefined}
            aria-describedby={`${formId}-priceUsd-help`}
            onChange={(event) => setPrice(event.target.value)}
            className={cn("numeral", styles.moneyInput)}
          />
        </div>
        <Help id={`${formId}-priceUsd-help`} error={visible("priceUsd")} />
        <div className={styles.suggest} aria-live="polite">
          {suggestKey && !suggestReady && (
            <span className={styles.suggestMuted}>
              <CircleNotch size={14} weight="bold" className={styles.spin} aria-hidden />
              {C.suggestLoading}
            </span>
          )}
          {suggestReady && offer && (
            <div className={styles.offer}>
              <Sparkle size={14} weight="duotone" aria-hidden className={styles.offerIcon} />
              <span className={styles.offerText}>
                {offerLabel}
                <strong className="numeral">{formatPrice(offer.value, locale, { currency: true, digits: offerDigits })}</strong>
              </span>
              <button
                type="button"
                className={styles.offerUse}
                disabled={price.trim() === offerText}
                onClick={() => setPrice(offerText)}
              >
                {C.suggestUse}
              </button>
            </div>
          )}
          {suggestReady && !offer && <span className={styles.suggestMuted}>{C.suggestNone}</span>}
        </div>
      </div>

      {/* ---- Önizleme ---- */}
      {preview && pnl !== null && (
        <div className={styles.summaryInner}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{S.previewTitle}</span>
            <span className={cn("numeral", styles.summaryValue, directionText(directionOf(pnl)))}>
              {money(pnl, true)}
              <span className="ml-2 text-small font-semibold">{formatPercent(preview.cost > 0 ? (pnl / preview.cost) * 100 : null, locale)}</span>
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{S.previewCost}</span>
            <span className={cn("numeral", styles.summaryValueSoft)}>{money(preview.cost)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{S.previewProceeds}</span>
            <span className={cn("numeral", styles.summaryValueSoft)}>{money(preview.proceeds)}</span>
          </div>
          <p className="text-tiny leading-relaxed text-muted">{S.previewNote}</p>
        </div>
      )}

      <p className="text-small leading-relaxed text-body">{S.fifoNote}</p>

      {generalError && (
        <p role="alert" className={styles.formError}>
          {generalError}
        </p>
      )}

      <div className={styles.composerActions}>
        <button type="button" onClick={onCancel} className={buttonClass({ variant: "quiet", size: "lg" })}>
          {S.cancel}
        </button>
        <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: styles.submit })}>
          {pending && <CircleNotch size={16} weight="bold" className={styles.spin} aria-hidden />}
          {pending ? S.saving : S.submit}
        </button>
      </div>
    </form>
  );
}

function Help({ id, error }: { id: string; error?: string }) {
  if (!error) return <span id={id} hidden />;
  return (
    <span id={id} className={styles.fieldError} role="alert">
      {error}
    </span>
  );
}
