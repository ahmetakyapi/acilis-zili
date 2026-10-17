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
import { MAX_THRESHOLD_PCT, MIN_THRESHOLD_PCT, thresholdDigits, type PercentAlert } from "@/lib/percent-alerts";
import { alertDistancePct, alertProgress, type PriceAlert } from "@/lib/price-alerts";
import { displayZone, formatInZone, zoneDateKey } from "@/lib/session-clock";
import { cn, formatPercent, formatPercentPlain, formatPrice, parseDecimalInput } from "@/lib/utils";
import styles from "./PriceAlerts.module.css";

type Labels = Dictionary["priceAlerts"];

const IDLE: AlertActionState = { status: "idle", at: 0 };

/** Yüzde sayısı şablonun içine — "%{threshold}" zaten işaretli. */
function pctNumber(value: number, locale: Locale): string {
  return formatPercentPlain(value, locale, thresholdDigits(value)).replace("%", "").trim();
}

/**
 * Tetik anı: bugünse yalnız saat, değilse gün + saat (16 Ekim). Favorilerde
 * tetiklenenler üstte duruyor; 10 Ekim'deki tetik 16 Ekim'de yalnız "16:45"
 * yazınca bugünün hareketi gibi okunuyordu.
 */
function seenTime(iso: string, zone: string, dateFormat: Intl.DateTimeFormat, nowMs: number): string {
  const at = new Date(iso);
  const time = formatInZone(at, zone);
  return zoneDateKey(at, zone) === zoneDateKey(new Date(nowMs), zone) ? time : `${dateFormat.format(at)} ${time}`;
}

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
  note,
  locale,
  labels,
  withText = false,
}: {
  /** Tetikte görünür yazı (17 Ekim, hisse başlığı) — etiketin kendisi. */
  withText?: boolean;
  symbol: string;
  /** Sayfanın çizildiği andaki fiyat; sağlayıcı düşükse boş. */
  price: number | null;
  alerts: PriceAlert[];
  /** Yüzde alarmları (15 Ekim) — tablo yoksa sekme hiç basılmıyor. */
  percentAlerts?: PercentAlert[];
  percentAvailable?: boolean;
  /** Levhanın dibindeki not — push kuruluysa "haber gelir" diyen sürüm
      (favorilerdeki kural; levha "bildirim gönderilmez" diye kalmıştı). */
  note?: string;
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
  /* Pirinç nokta görsel; ekran okuyucu tetiği etiketten duyar. */
  const spoken = hits > 0 ? `${label} · ${labels.hitBanner.replace("{n}", String(hits))}` : label;

  return (
    <>
      <button
        type="button"
        aria-label={spoken}
        title={spoken}
        aria-haspopup="dialog"
        data-labeled={withText ? "" : undefined}
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
        {withText && <span data-action-text>{label}</span>}
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
          <AlertComposer symbol={symbol} price={price} alerts={alerts} percentAlerts={percentAlerts} percentAvailable={percentAvailable} note={note ?? labels.note} locale={locale} labels={labels} />
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
  note,
  locale,
  labels,
}: {
  symbol: string;
  price: number | null;
  alerts: PriceAlert[];
  percentAlerts: PercentAlert[];
  percentAvailable: boolean;
  note: string;
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
        <PercentComposer symbol={symbol} locale={locale} labels={labels} />
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

      <p className={styles.note}>{note}</p>
    </div>
  );
}

function PercentComposer({ symbol, locale, labels }: { symbol: string; locale: Locale; labels: Labels }) {
  const [state, action] = useActionState(createPercentAlert, IDLE);
  const [raw, setRaw] = useState("");
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [cleared, setCleared] = useState(0);
  /* Hata, okuyucu alanı düzeltince kalkar — bir sonraki gönderimi beklemez. */
  const [dismissedAt, setDismissedAt] = useState(0);
  if (state.status === "ok" && state.at !== cleared) {
    setCleared(state.at);
    setRaw("");
  }
  const parsed = parseDecimalInput(raw, locale);
  const threshold = parsed != null && parsed > 0 ? parsed : null;
  /* Önizleme yalnız kurulabilecek eşik için: %0,3 için "haber verilir"
     deyip gönderince reddetmek çelişkiydi. */
  const inRange = threshold != null && threshold >= MIN_THRESHOLD_PCT && threshold <= MAX_THRESHOLD_PCT;
  const errorText =
    state.status === "error" && state.error && state.at !== dismissedAt ? labels.errors[state.error] : null;

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
                onChange={(event) => {
                  setRaw(event.target.value);
                  setDismissedAt(state.at);
                }}
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
          ) : threshold != null && !inRange ? (
            <span>{labels.errors.threshold}</span>
          ) : threshold != null ? (
            <span data-direction={direction === "up" ? "above" : "below"}>
              {(direction === "up" ? labels.pctWillFireUp : labels.pctWillFireDown).replace(
                "{threshold}",
                pctNumber(threshold, locale),
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
  const [dismissedAt, setDismissedAt] = useState(0);
  /* FİYAT YOKKEN YÖN OKUYUCUDAN (16 Ekim). Sayfa güncel fiyatı
     bilmiyorsa (bayat kotasyon, sağlayıcı kesintisi) gizli alan hep
     "above" gönderiyordu: $94'teki hisseye "90" yazan okuyucunun alarmı
     "90'ın üstüne çıkarsa" olarak kuruluyor ve hemen yanlış bildirim
     gidiyordu. Artık iki yön soruluyor, varsayılan yok; sunucu da bildiği
     son fiyattan yönü kendisi türetiyor (app/actions/alerts.ts). */
  const [chosen, setChosen] = useState<"above" | "below" | null>(null);
  if (state.status === "ok" && state.at !== cleared) {
    setCleared(state.at);
    setRaw("");
    setChosen(null);
  }
  useEffect(() => {
    if (cleared && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [cleared]);

  const parsed = parseDecimalInput(raw, locale);
  const target = parsed != null && parsed > 0 ? parsed : null;
  const direction = price != null ? (target != null ? (target > price ? "above" : "below") : null) : chosen;
  const errorText =
    state.status === "error" && state.error && state.at !== dismissedAt ? labels.errors[state.error] : null;

  return (
    <>
      <p className={styles.intro}>{labels.intro}</p>

      <form action={action} className={styles.form}>
        <input type="hidden" name="symbol" value={symbol} />
        {/* Sunucu fiyat bilmiyorsa yönü buradan alıyor (gerekçe eylemde). */}
        <input type="hidden" name="direction" value={direction ?? ""} />
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
                onChange={(event) => {
                  setRaw(event.target.value);
                  setDismissedAt(state.at);
                }}
                placeholder={labels.targetPlaceholder}
                aria-invalid={errorText ? true : undefined}
                aria-describedby={`alert-hint-${symbol}`}
                className={cn("numeral", sheet.moneyInput)}
              />
            </span>
          </label>
          {price != null ? (
            <div className={styles.now}>
              <span className={sheet.label}>{labels.now}</span>
              <strong className="numeral">{formatPrice(price, locale, { currency: true })}</strong>
            </div>
          ) : (
            <div className="flex gap-1.5 self-end pb-0.5" role="group" aria-label={labels.directionLabel}>
              {(["below", "above"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setChosen(key);
                    setDismissedAt(state.at);
                  }}
                  aria-pressed={chosen === key}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-3 text-small font-semibold transition-colors sm:min-h-9",
                    chosen === key
                      ? "border-transparent bg-primary text-on-primary"
                      : "border-line bg-surface text-body hover:border-line-strong",
                  )}
                >
                  {key === "below" ? labels.below : labels.above}
                </button>
              ))}
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
          ) : price == null && target != null && !chosen ? (
            <span>{labels.noPriceHint}</span>
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
  /* "Bugün mü" sorusunun anı ilk çizimde sabit (render saf kalsın). */
  const [nowMs] = useState(() => Date.now());
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
                  {labels.seenAt.replace("{time}", seenTime(alert.triggeredAt, zone, dateFormat, nowMs))}
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
  const thresholdText = pctNumber(alert.thresholdPct, locale);
  const [nowMs] = useState(() => Date.now());
  /* Aynı seansta yeniden kurulan alarm ertesi seansta devreye girer
     (app/actions/alerts.ts → rearmPercentAlert): `createdAt` ileride. */
  const armsLater = !hit && new Date(alert.createdAt).getTime() > nowMs;

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
                  {labels.seenAt.replace("{time}", seenTime(alert.triggeredAt, zone, dateFormat, nowMs))}
                  {alert.triggeredPct != null &&
                    ` · ${labels.pctSeen.replace("{pct}", formatPercent(alert.triggeredPct, locale, 2))}`}
                </span>
              )}
            </>
          ) : (
            <>
              <span className={styles.pendingBadge}>{labels.pending}</span>
              <span className="numeral">
                {armsLater ? labels.pctArmsNext : labels.since.replace("{date}", dateFormat.format(new Date(alert.createdAt)))}
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
