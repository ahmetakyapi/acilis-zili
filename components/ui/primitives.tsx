import Link from "next/link";
import { cn, directionOf, formatPercent } from "@/lib/utils";
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

/**
 * Bölüm başlığı — gazetenin kicker'ı.
 * Kutu çizmez, çerçeve çekmez: küçük büyük harfli etiket ve altındaki
 * boşluk bölümü ayırır. Broadsheet kuralı: bölümler çizgiyle değil
 * boşlukla ayrılır.
 */
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
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3",
        className,
      )}
    >
      <h6 className="kicker">{title}</h6>
      {action}
    </div>
  );
}

/**
 * Nokta liderli satır — gazete fihristi: "Etiket ......... 08:30".
 * Takvim, künye ve fiyat listeleri hep bunu kullanır (HANDOFF §4).
 */
export function DottedLeader({
  label,
  value,
  muted,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Değer ikincil bir okuma ise soluk basılır. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("leader py-1.5", className)}>
      <span className="min-w-0 shrink text-[15px] text-body">{label}</span>
      <span aria-hidden className="leader-fill" />
      <span
        className={cn(
          "numeral shrink-0 text-[15px]",
          muted ? "text-muted" : "font-semibold text-strong",
        )}
      >
        {value}
      </span>
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
        {eyebrow && <p className="kicker mb-2">{eyebrow}</p>}
        <h1 className="text-[2.25rem] leading-[1.06] tracking-[-0.022em] sm:text-[2.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.7] text-body">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/**
 * Bölümlü seçici — Broadsheet `.seg`.
 * Tek kutu, içinde kılcal ayıraçlar; seçili olan dolu mürekkeple basılır.
 * Durum URL'de yaşar, bu yüzden bağlantılardan oluşur (JS gerekmez).
 */
export function Segmented({
  options,
  ariaLabel,
  className,
}: {
  options: { href: string; label: string; active: boolean }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 border border-rule text-[13px]",
        className,
      )}
    >
      {options.map((option) => (
        <Link
          key={option.href}
          href={option.href}
          aria-current={option.active ? "true" : undefined}
          className={cn(
            "min-h-[34px] whitespace-nowrap border-l border-rule px-3 py-1.5 transition-colors first:border-l-0",
            option.active
              ? "bg-btn text-white"
              : "text-dim hover:bg-primary-tint hover:text-ink",
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Çift saat — "09:45 (16:45)".
 * HANDOFF §7: saatler daima çift basılır; ET birincil, TR parantez içinde.
 */
export function DualTime({
  et,
  tr,
  className,
}: {
  et: string;
  tr: string;
  className?: string;
}) {
  return (
    <span className={cn("numeral whitespace-nowrap", className)}>
      {et} <span className="opacity-70">({tr})</span>
    </span>
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

  /* Rozet değil, mürekkep. Gazetede yön bir kutuya konmaz: işaret + yüzde
     doğrudan yön renginde basılır. Renk tek başına anlam taşımadığı için
     ▲/▼ işareti daima yanındadır (HANDOFF §7). */
  return (
    <span
      className={cn(
        "numeral inline-flex items-center gap-1 whitespace-nowrap tabular-nums",
        direction === "up"
          ? "text-up"
          : direction === "down"
            ? "text-down"
            : "text-muted",
        size === "sm" ? "text-[12.5px]" : "text-[13.5px]",
        className,
      )}
    >
      {direction !== "flat" && (
        <span aria-hidden className="text-[0.82em] leading-none">
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
