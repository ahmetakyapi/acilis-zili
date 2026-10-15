"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { BellSimpleRinging, CheckCircle, Trash, ArrowCounterClockwise } from "@phosphor-icons/react";
import {
  createPercentAlert,
  createPriceAlert,
  deletePercentAlert,
  deletePriceAlert,
  rearmPercentAlert,
  rearmPriceAlert,
  type AlertActionState,
} from "@/app/actions/alerts";
import { LocaleLink } from "@/components/layout/LocaleLink";
import { PortfolioSheet } from "@/components/portfolio/PortfolioSheet";
import sheet from "@/components/portfolio/Workbench.module.css";
import { buttonClass } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { PercentAlert } from "@/lib/percent-alerts";
import { alertDistancePct, alertProgress, type PriceAlert } from "@/lib/price-alerts";
import { displayZone, formatInZone } from "@/lib/session-clock";
import { cn, formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./PriceAlerts.module.css";

type Labels = Dictionary["priceAlerts"];

const IDLE: AlertActionState = { status: "idle", at: 0 };

/**
 * Hisse sayfasının zil düğmesi — kalbin ve paylaşın yanında, aynı ölçüde.
 *
 * Levha portföyünkü (`PortfolioSheet`): telefonda başparmağın altında alt
 * çekmece, geniş ekranda ortada; odak tuzağı ve Escape tarayıcıdan.
 *
 * Düğme durumu söylüyor: bekleyen alarm varsa dolu zil, hedefe ulaşmış
 * alarm varsa yanında pirinç bir nokta (renk yalnızca yukarı/aşağı/etkileşim
 * söyler kuralı — pirinç "orta önem" tonu, yön değil).
 */
export function PriceAlertButton({
  symbol,
  price,
  alerts,
  percentAlerts = [],
  percentAvailable = false,
  locale,
  labels,
}: {
  symbol: string;
  /** Sayfanın çizildiği andaki fiyat; sağlayıcı düşükse boş. */
  price: number | null;
  alerts: PriceAlert[];
  /** Yüzde alarmları (15 Ekim) — tablo yoksa sekme hiç basılmıyor. */
  percentAlerts?: PercentAlert[];
  percentAvailable?: boolean;
  locale: Locale;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const total = alerts.length + percentAlerts.length;
  const pending =
    alerts.filter((alert) => !alert.triggeredAt).length +
    percentAlerts.filter((alert) => !alert.triggeredAt).length;
  const hits = total - pending;
  const label = total > 0 ? labels.buttonActive.replace("{n}", String(total)) : labels.button;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className={cn(
          "tap-44 relative inline-flex size-8 items-center justify-center rounded-(--radius-sm) transition-colors",
          total > 0
            ? "text-primary-ink hover:bg-primary-wash"
            : "text-muted hover:bg-surface-elevated hover:text-soft",
        )}
      >
        <BellSimpleRinging size={17} weight={pending > 0 ? "fill" : "duotone"} aria-hidden className={styles.bellIcon} />
        {hits > 0 && <span className={styles.hitDot} aria-hidden />}
      </button>
      {/* LEVHA GÖVDEYE TAŞINIYOR. Düğme hisse başlığının künye satırında
          ve o satırın `:is(button, a)` kuralı (stock.module.css →
          identityMeta) levhanın içindeki "Alarm Kur" düğmesinin zeminini
          çukur tona eziyordu — düğme devre dışı gibi okunuyordu (ölçüldü).
          `<dialog>` üst katmanda çiziliyor ama seçiciler DOM'a bakıyor. */}
      {mounted && createPortal(
        <PortfolioSheet
          open={open}
          onClose={() => setOpen(false)}
          onClosed={() => setMounted(false)}
          title={labels.sheetTitle.replace("{symbol}", symbol)}
          closeLabel={labels.close}
        >
          <AlertComposer symbol={symbol} price={price} alerts={alerts} percentAlerts={percentAlerts} percentAvailable={percentAvailable} locale={locale} labels={labels} />
        </PortfolioSheet>,
        document.body,
      )}
    </>
  );
}

function AlertComposer({
  symbol,
  price,
  alerts,
  percentAlerts,
  percentAvailable,
  locale,
  labels,
}: {
  symbol: string;
  price: number | null;
  alerts: PriceAlert[];
  percentAlerts: PercentAlert[];
  percentAvailable: boolean;
  locale: Locale;
  labels: Labels;
}) {
  /* İki tür tek levhada, sekmeyle: fiyat HEDEFİ ve günlük DEĞİŞİM ayrı
     sorular ve tek formda iki soru sormak alanları muğlaklaştırıyordu.
     Sekme yalnızca tablo varken basılıyor (migration 0033). */
  const [mode, setMode] = useState<"price" | "percent">("price");
  const modeTab = (key: "price" | "percent", text: string) => (
    <button
      type="button"
      onClick={() => setMode(key)}
      aria-pressed={mode === key}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3.5 text-small font-semibold transition-colors sm:min-h-8",
        mode === key
          ? "border-transparent bg-primary text-on-primary"
          : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
      )}
    >
      {text}
    </button>
  );

  return (
    <div className={styles.composer}>
      {percentAvailable && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={labels.sheetTitle.replace("{symbol}", symbol)}>
          {modeTab("price", labels.modePrice)}
          {modeTab("percent", labels.modePercent)}
        </div>
      )}

      {mode === "price" ? (
        <PriceComposer symbol={symbol} price={price} locale={locale} labels={labels} />
      ) : (
        <PercentComposer symbol={symbol} labels={labels} />
      )}

      {alerts.length > 0 && (
        <section className={styles.existing} aria-label={labels.existing}>
          <h3 className="plate text-read">{labels.existing}</h3>
          <ul className={styles.list}>
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} price={price} locale={locale} labels={labels} />
            ))}
          </ul>
        </section>
      )}

      {percentAlerts.length > 0 && (
        <section className={styles.existing} aria-label={labels.existingPct}>
          <h3 className="plate text-read">{labels.existingPct}</h3>
          <ul className={styles.list}>
            {percentAlerts.map((alert) => (
              <PercentAlertRow key={alert.id} alert={alert} locale={locale} labels={labels} />
            ))}
          </ul>
        </section>
      )}

      <p className={styles.note}>{labels.note}</p>
    </div>
  );
}

function PercentComposer({ symbol, labels }: { symbol: string; labels: Labels }) {
  const [state, action] = useActionState(createPercentAlert, IDLE);
  const [raw, setRaw] = useState("");
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [cleared, setCleared] = useState(0);
  if (state.status === "ok" && state.at !== cleared) {
    setCleared(state.at);
    setRaw("");
  }
  const parsed = Number(raw.trim().replace(",", "."));
  const threshold = raw.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const errorText = state.status === "error" && state.error ? labels.errors[state.error] : null;

  return (
    <>
      <p className={styles.intro}>{labels.pctIntro}</p>
      <form action={action} className={styles.form}>
        <input type="hidden" name="symbol" value={symbol} />
        <input type="hidden" name="pct-direction" value={direction} />
        <div className={styles.fieldRow}>
          <label className={sheet.fieldBlock}>
            <span className={sheet.label}>{labels.threshold}</span>
            <span className={sheet.moneyField}>
              <span className={sheet.moneyPrefix} aria-hidden>
                %
              </span>
              <input
                name="threshold"
                inputMode="decimal"
                autoComplete="off"
                required
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                placeholder={labels.thresholdPlaceholder}
                aria-invalid={errorText ? true : undefined}
                aria-describedby={`pct-hint-${symbol}`}
                className={cn("numeral", sheet.moneyInput)}
              />
            </span>
          </label>
          <div className="flex gap-1.5 self-end pb-0.5" role="group" aria-label={labels.directionLabel}>
            {(["down", "up"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDirection(key)}
                aria-pressed={direction === key}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3 text-small font-semibold transition-colors sm:min-h-9",
                  direction === key
                    ? "border-transparent bg-primary text-on-primary"
                    : "border-line bg-surface text-body hover:border-line-strong",
                )}
              >
                {key === "down" ? labels.pctDown : labels.pctUp}
              </button>
            ))}
          </div>
        </div>
        <p id={`pct-hint-${symbol}`} className={styles.hint} aria-live="polite">
          {errorText ? (
            <span className={styles.error}>{errorText}</span>
          ) : threshold != null ? (
            <span data-direction={direction === "up" ? "above" : "below"}>
              {(direction === "up" ? labels.pctWillFireUp : labels.pctWillFireDown).replace(
                "{threshold}",
                String(threshold).replace(".", ","),
              )}
            </span>
          ) : state.status === "ok" ? (
            <span className={styles.created}>
              <CheckCircle size={15} weight="fill" aria-hidden /> {labels.created}
            </span>
          ) : null}
        </p>
        <SubmitButton labels={labels} />
      </form>
    </>
  );
}

function PriceComposer({
  symbol,
  price,
  locale,
  labels,
}: {
  symbol: string;
  price: number | null;
  locale: Locale;
  labels: Labels;
}) {
  const [state, action] = useActionState(createPriceAlert, IDLE);
  const [raw, setRaw] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  /* Kuruldu: alan boşalıyor, odak alana dönüyor — ikinci bir hedef
     yazmak tek hamle. Liste sunucunun tazelediği prop'tan geliyor. */
  const [cleared, setCleared] = useState(0);
  if (state.status === "ok" && state.at !== cleared) {
    setCleared(state.at);
    setRaw("");
  }
  useEffect(() => {
    if (cleared && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [cleared]);

  const parsed = Number(raw.trim().replace(",", "."));
  const target = raw.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const direction = target != null && price != null ? (target > price ? "above" : "below") : null;
  const errorText = state.status === "error" && state.error ? labels.errors[state.error] : null;

  return (
    <>
      <p className={styles.intro}>{labels.intro}</p>

      <form action={action} className={styles.form}>
        <input type="hidden" name="symbol" value={symbol} />
        {/* Sağlayıcı düşükse sunucu yönü buradan alıyor (gerekçe eylemde). */}
        <input type="hidden" name="direction" value={direction ?? "above"} />
        <div className={styles.fieldRow}>
          <label className={sheet.fieldBlock}>
            <span className={sheet.label}>{labels.target}</span>
            <span className={sheet.moneyField}>
              <span className={sheet.moneyPrefix} aria-hidden>$</span>
              <input
                ref={inputRef}
                name="target"
                inputMode="decimal"
                autoComplete="off"
                data-autofocus
                required
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                placeholder={labels.targetPlaceholder}
                aria-invalid={errorText ? true : undefined}
                aria-describedby={`alert-hint-${symbol}`}
                className={cn("numeral", sheet.moneyInput)}
              />
            </span>
          </label>
          {price != null && (
            <div className={styles.now}>
              <span className={sheet.label}>{labels.now}</span>
              <strong className="numeral">{formatPrice(price, locale, { currency: true })}</strong>
            </div>
          )}
        </div>
        <p id={`alert-hint-${symbol}`} className={styles.hint} aria-live="polite">
          {errorText ? (
            <span className={styles.error}>{errorText}</span>
          ) : direction && target != null ? (
            <span data-direction={direction}>
              {labels.willFire
                .replace("{target}", formatPrice(target, locale, { currency: true }))
                .replace("{direction}", direction === "above" ? labels.willFireAbove : labels.willFireBelow)}
            </span>
          ) : state.status === "ok" ? (
            <span className={styles.created}>
              <CheckCircle size={15} weight="fill" aria-hidden /> {labels.created}
            </span>
          ) : null}
        </p>
        <SubmitButton labels={labels} />
      </form>
    </>
  );
}

function SubmitButton({ labels }: { labels: Labels }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={buttonClass({ size: "lg", className: styles.submit })}
    >
      <BellSimpleRinging size={18} weight="bold" aria-hidden />
      {pending ? labels.submitting : labels.submit}
    </button>
  );
}

/**
 * Tek alarm satırı — hisse levhasında ve favorilerdeki panelde aynı.
 * `showSymbol` yalnızca karışık listede (favoriler).
 */
export function AlertRow({
  alert,
  price,
  locale,
  labels,
  showSymbol = false,
}: {
  alert: PriceAlert;
  price: number | null;
  locale: Locale;
  labels: Labels;
  showSymbol?: boolean;
}) {
  const hit = Boolean(alert.triggeredAt);
  const zone = displayZone(locale);
  const progress = !hit && price != null ? alertProgress(alert, price) : hit ? 1 : 0;
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: zone,
    day: "numeric",
    month: "short",
  });

  return (
    <li className={styles.row} data-hit={hit || undefined}>
      <div className={styles.rowMain}>
        <div className={styles.rowHead}>
          {showSymbol && <LocaleLink href={`/hisse/${alert.symbol}`} className={styles.rowSymbol}>{alert.symbol}</LocaleLink>}
          <span className={styles.rowDirection} data-direction={alert.direction}>
            {alert.direction === "above" ? labels.above : labels.below}
          </span>
          <strong className={cn("numeral", styles.rowTarget)}>
            {formatPrice(alert.target, locale, { currency: true })}
          </strong>
        </div>
        <div className={styles.track} aria-hidden>
          <span className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className={styles.rowMeta}>
          {hit ? (
            <>
              <span className={styles.hitBadge}>{labels.hit}</span>
              {alert.triggeredAt && (
                <span className="numeral">
                  {labels.seenAt.replace("{time}", formatInZone(new Date(alert.triggeredAt), zone))}
                  {alert.triggeredPrice != null && ` · ${formatPrice(alert.triggeredPrice, locale, { currency: true })}`}
                </span>
              )}
            </>
          ) : (
            <>
              <span className={styles.pendingBadge}>{labels.pending}</span>
              {price != null && (
                <span className="numeral">
                  {labels.toGo.replace("{pct}", formatPercentPlain(alertDistancePct(alert, price), locale, 1))}
                </span>
              )}
              <span className="numeral">{labels.since.replace("{date}", dateFormat.format(new Date(alert.createdAt)))}</span>
            </>
          )}
        </p>
      </div>
      <div className={styles.rowActions}>
        {hit && (
          <form action={rearmPriceAlert}>
            <input type="hidden" name="id" value={alert.id} />
            <button type="submit" className={styles.iconAction} aria-label={labels.rearm} title={labels.rearm}>
              <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
            </button>
          </form>
        )}
        <form action={deletePriceAlert}>
          <input type="hidden" name="id" value={alert.id} />
          <input type="hidden" name="symbol" value={alert.symbol} />
          <button type="submit" className={cn(styles.iconAction, styles.iconDanger)} aria-label={labels.delete} title={labels.delete}>
            <Trash size={16} weight="bold" aria-hidden />
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Tek yüzde alarmı satırı (15 Ekim) — levhada ve favoriler panelinde aynı.
 * Fiyat satırından farkı: ilerleme rayı yok (günlük değişim her seans
 * sıfırdan başlar, "yolun yüzdesi" diye bir şey yok) ve yeniden kurma yönü
 * çevirmez (gerekçe app/actions/alerts.ts → rearmPercentAlert).
 */
export function PercentAlertRow({
  alert,
  locale,
  labels,
  showSymbol = false,
}: {
  alert: PercentAlert;
  locale: Locale;
  labels: Labels;
  showSymbol?: boolean;
}) {
  const hit = Boolean(alert.triggeredAt);
  const zone = displayZone(locale);
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: zone,
    day: "numeric",
    month: "short",
  });
  const thresholdText = formatPercentPlain(alert.thresholdPct, locale, alert.thresholdPct % 1 === 0 ? 0 : 1)
    .replace("%", "")
    .trim();

  return (
    <li className={styles.row} data-hit={hit || undefined}>
      <div className={styles.rowMain}>
        <div className={styles.rowHead}>
          {showSymbol && (
            <LocaleLink href={`/hisse/${alert.symbol}`} className={styles.rowSymbol}>
              {alert.symbol}
            </LocaleLink>
          )}
          <span
            className={styles.rowDirection}
            data-direction={alert.direction === "up" ? "above" : "below"}
          >
            {(alert.direction === "up" ? labels.pctRowUp : labels.pctRowDown).replace(
              "{threshold}",
              thresholdText,
            )}
          </span>
        </div>
        <p className={styles.rowMeta}>
          {hit ? (
            <>
              <span className={styles.hitBadge}>{labels.hit}</span>
              {alert.triggeredAt && (
                <span className="numeral">
                  {labels.seenAt.replace("{time}", formatInZone(new Date(alert.triggeredAt), zone))}
                  {alert.triggeredPct != null &&
                    ` · ${labels.pctSeen.replace("{pct}", formatPercent(alert.triggeredPct, locale, 2))}`}
                </span>
              )}
            </>
          ) : (
            <>
              <span className={styles.pendingBadge}>{labels.pending}</span>
              <span className="numeral">
                {labels.since.replace("{date}", dateFormat.format(new Date(alert.createdAt)))}
              </span>
            </>
          )}
        </p>
      </div>
      <div className={styles.rowActions}>
        {hit && (
          <form action={rearmPercentAlert}>
            <input type="hidden" name="id" value={alert.id} />
            <button type="submit" className={styles.iconAction} aria-label={labels.rearm} title={labels.rearm}>
              <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
            </button>
          </form>
        )}
        <form action={deletePercentAlert}>
          <input type="hidden" name="id" value={alert.id} />
          <input type="hidden" name="symbol" value={alert.symbol} />
          <button
            type="submit"
            className={cn(styles.iconAction, styles.iconDanger)}
            aria-label={labels.delete}
            title={labels.delete}
          >
            <Trash size={16} weight="bold" aria-hidden />
          </button>
        </form>
      </div>
    </li>
  );
}
