import Link from "next/link";
import { cn, directionOf, directionWash, formatPercent } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/* --------------------------------------------------------------------------
   Yüzey
   -------------------------------------------------------------------------- */

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("panel", className)} {...props}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5",
        className,
      )}
    >
      <h2 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-strong">
        <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-brass" />
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * Sayfa başlığı — plate üst yazı + başlık + isteğe bağlı alt satır.
 * Tüm sayfalar aynı hiyerarşiyi kullanır; süs işareti yok, okunabilirlik esas.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("flex flex-wrap items-end justify-between gap-3", className)}
    >
      <div className="min-w-0">
        {eyebrow && <p className="plate">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-strong sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-soft">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/* --------------------------------------------------------------------------
   Değişim rozeti — yön rengi ve işareti tek yerden gelir
   -------------------------------------------------------------------------- */

export function ChangePill({
  changePct,
  locale,
  size = "md",
  className,
}: {
  changePct: number | null | undefined;
  locale: Locale;
  size?: "sm" | "md";
  className?: string;
}) {
  const direction = directionOf(changePct);

  return (
    <span
      className={cn(
        "numeral inline-flex items-center gap-1 rounded-full font-medium tabular-nums",
        directionWash(direction),
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      {direction !== "flat" && (
        <span aria-hidden className="text-[0.85em] leading-none">
          {direction === "up" ? "▲" : "▼"}
        </span>
      )}
      {formatPercent(changePct, locale)}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Veri tazeliği damgası — her veri kartının altında görünür
   -------------------------------------------------------------------------- */

const SOURCE_LABEL: Record<string, string> = {
  alpaca: "Alpaca · IEX",
  finnhub: "Finnhub",
  fred: "FRED",
  cache: "önbellek",
  seed: "takvim",
};

export function DataStamp({
  source,
  at,
  stale,
  locale,
  note,
  className,
}: {
  source: string;
  at?: Date | string | null;
  stale?: boolean;
  locale: Locale;
  note?: string;
  className?: string;
}) {
  // Damga saati her zaman Türkiye saatiyle basılır — sunucu UTC'de koşsa da
  // okuyucunun duvar saatiyle örtüşür.
  const time = at
    ? new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
      }).format(typeof at === "string" ? new Date(at) : at)
    : null;

  const updatedWord = locale === "tr" ? "güncellendi" : "updated";

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted",
        className,
      )}
    >
      <span>{SOURCE_LABEL[source] ?? source}</span>
      {time && (
        <>
          <span aria-hidden>·</span>
          <span className="numeral">{time}</span>
          <span>{updatedWord}</span>
        </>
      )}
      {stale && (
        <>
          <span aria-hidden>·</span>
          <span className="text-impact-med">
            {locale === "tr" ? "güncel olmayabilir" : "may be out of date"}
          </span>
        </>
      )}
      {note && (
        <>
          <span aria-hidden>·</span>
          <span>{note}</span>
        </>
      )}
    </p>
  );
}

/* --------------------------------------------------------------------------
   Boş ve hatalı durumlar — ikisi de yön verir, özür dilemez
   -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm text-soft">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function DataError({
  message,
  hint,
  className,
}: {
  message: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-8 text-center", className)}>
      <p className="text-sm text-soft">{message}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Etki seviyesi göstergesi — üç nokta, dolu olan kadar önemli
   -------------------------------------------------------------------------- */

export function ImpactDots({
  importance,
  label,
}: {
  importance: string;
  label: string;
}) {
  const filled = importance === "high" ? 3 : importance === "medium" ? 2 : 1;
  const color =
    importance === "high"
      ? "bg-impact-high"
      : importance === "medium"
        ? "bg-impact-med"
        : "bg-impact-low";

  return (
    <span className="inline-flex items-center gap-0.5" title={label}>
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            i < filled ? color : "bg-line-strong",
          )}
        />
      ))}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Butonlar
   -------------------------------------------------------------------------- */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-md) text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none";

const BUTTON_VARIANTS = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-sm",
  ghost:
    "border border-line text-body hover:bg-surface-elevated hover:text-strong active:scale-[0.98]",
  quiet: "text-soft hover:text-strong hover:bg-surface-elevated",
  danger: "text-down hover:bg-down-wash",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 min-h-[44px] sm:min-h-0 sm:h-10",
  icon: "size-9 p-0",
} as const;

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return (
    <Link
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------------------------------------------------------
   Yükleme iskeleti
   -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
