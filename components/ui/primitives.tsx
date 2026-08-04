import Link from "next/link";
import { cn, directionOf, directionWash, formatPercent } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/* --------------------------------------------------------------------------
   Yüzey

   Gölge yok: kartlar zeminden saydamlık + tek hairline ile ayrılır. Panel
   içindeki satırlar da aynı hairline'ı üstlerinde taşır, kendi kutuları yok.
   -------------------------------------------------------------------------- */

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("panel overflow-hidden", className)} {...props}>
      {children}
    </section>
  );
}

/**
 * Panel başlığı — 15px/700, sağda isteğe bağlı accent bağlantı.
 * Süs işareti yok; başlığı başlık yapan ağırlığı, kutusu değil.
 */
export function PanelHeader({
  title,
  action,
  meta,
  className,
}: {
  title: string;
  /** Sağdaki bağlantı ya da filtre grubu. */
  action?: React.ReactNode;
  /** Başlığın sağındaki sessiz bilgi — "04:00 — 20:00 ET" gibi. */
  meta?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-4 sm:px-5",
        className,
      )}
    >
      <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
        {title}
      </h2>
      {meta && <span className="text-xs text-muted">{meta}</span>}
      {action}
    </div>
  );
}

/** Panel içi satır — üstündeki hairline ayırır. */
export function PanelRow({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-t border-line px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Panel başlığındaki "Tümü →" tipi sessiz bağlantı. */
export function PanelLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        /* -my-2 py-2: metnin kendisi 16px yüksekliğinde bir dokunma hedefi
           bırakıyordu. Dolgu tıklama alanını 32px'e çıkarır, negatif margin
           de satır yüksekliğini olduğu gibi bırakır — düzen kaymaz. */
        "-my-2 inline-flex min-h-8 items-center py-2 text-xs text-primary transition-colors hover:text-primary-hover",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Sayfa başlığı — 34px/700, altında 14px açıklama.
 * Serif display rolü kaldırıldı: tek aile, ayrım ağırlıkla kuruluyor.
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
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className="min-w-0">
        {eyebrow && <p className="plate mb-2">{eyebrow}</p>}
        <h1 className="display-ink w-fit text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-[7px] max-w-3xl text-sm leading-relaxed text-body">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/** Küçük bölüm başlığı — accent kicker, 10.5–11px. */
export function Kicker({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "plate tracking-[0.1em]",
        tone === "primary" && "text-primary",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* --------------------------------------------------------------------------
   Değişim rozeti — yön rengi ve işareti tek yerden gelir.
   Renk tek başına anlam taşımaz: ▲/▼ işareti daima var.
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
        "numeral inline-flex items-center gap-1 rounded-full font-semibold",
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
   Bilanço zamanlama çipi

   Açılış öncesi `up` tinti, kapanış sonrası accent tinti (hero) ya da nötr
   `srf2` (mini kart). Zamanlama bir yön değil ama gün içindeki yerini renkle
   ayırmak listeyi taranabilir kılıyor.
   -------------------------------------------------------------------------- */

export type TimingTone = "pre" | "post" | "neutral";

export function TimingChip({
  tone,
  children,
  size = "md",
  className,
}: {
  tone: TimingTone;
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold",
        size === "sm" ? "px-2 py-[3px] text-[10px]" : "px-[9px] py-[3px] text-[11px]",
        tone === "pre" && "bg-up-wash text-up",
        tone === "post" && "bg-primary-wash text-primary",
        tone === "neutral" && "bg-surface-elevated text-body",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Sembol kutusu — gerçek logo geldiğinde aynı kutuya oturur, şimdilik
 * sembolün ilk iki harfi duruyor.
 */
export function SymbolBadge({
  symbol,
  size = "md",
  className,
}: {
  symbol: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-line bg-primary-wash font-bold tracking-[-0.02em] text-primary",
        size === "sm"
          ? "size-8 rounded-[9px] text-[11px]"
          : "size-11 rounded-[11px] text-[13px]",
        className,
      )}
    >
      {symbol.slice(0, 2)}
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
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted",
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
      <p className="text-sm text-body">{title}</p>
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
      <p className="text-sm text-body">{message}</p>
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

/**
 * Tek nokta — takvim satırında olayın etkisini renkle söyler.
 *
 * Nokta 8px, yanındaki başlık satırı ~19px. `items-start` bir satırda ikisi
 * üst üste hizalanınca nokta metnin ilk satırının üstünde kalıyor ve kaymış
 * görünüyor. Bu yüzden nokta, kendi yüksekliğinde değil METNİN SATIR
 * YÜKSEKLİĞİNDE bir kutuya oturuyor ve o kutunun içinde dikey ortalanıyor —
 * başlık kaç satıra kırılırsa kırılsın ilk satırla hizalı kalır.
 */
export function ImpactDot({
  importance,
  label,
  /** Hizalanacağı metnin satır yüksekliği (px). */
  lineHeight = 19,
}: {
  importance: string;
  label: string;
  lineHeight?: number;
}) {
  return (
    <span
      title={label}
      className="flex shrink-0 items-center"
      style={{ height: lineHeight }}
    >
      <span
        aria-hidden
        className={cn(
          "block size-2 rounded-full",
          importance === "high"
            ? "bg-down"
            : importance === "medium"
              ? "bg-impact-med"
              : "bg-muted",
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* --------------------------------------------------------------------------
   Butonlar
   -------------------------------------------------------------------------- */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[9px] font-semibold transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none";

const BUTTON_VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  ghost:
    "border border-line bg-surface text-body hover:border-line-strong hover:text-strong",
  quiet: "text-body hover:bg-surface-elevated hover:text-strong",
  danger: "text-down hover:bg-down-wash",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-[13.5px] min-h-11 sm:min-h-0 sm:h-10",
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
   Filtre çipi ve segment — mockup'ta panel başlıklarında ve sayfa üstünde
   -------------------------------------------------------------------------- */

/* SAYFA BAŞA ATLAMASIN. Bu bağlantılar bir gezinme değil, aynı sayfanın
   filtresi: App Router varsayılan olarak her gezinmede en üste kaydırıyor ve
   tablonun ortasında sıralamayı değiştiren okuyucu kendini sayfanın başında
   buluyordu. `scroll={false}` konumu olduğu yerde bırakır. Aynı gerekçe
   SegmentItem ve sayfalardaki sıralama başlıkları için de geçerli. */
export function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-8 items-center whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11.5px] transition-colors",
        active
          ? "bg-primary font-semibold text-on-primary"
          : "bg-surface-elevated text-body hover:text-strong",
      )}
    >
      {children}
    </Link>
  );
}

/** İki–üç seçenekli segment — Hafta/Ay, 1G/1H/1A gibi. */
export function Segment({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex overflow-hidden rounded-[9px] border border-line text-[12.5px]">
      {children}
    </span>
  );
}

export function SegmentItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "px-[13px] py-[7px] transition-colors",
        active
          ? "bg-primary font-semibold text-on-primary"
          : "text-body hover:text-strong",
      )}
    >
      {children}
    </Link>
  );
}

/* --------------------------------------------------------------------------
   Yükleme iskeleti
   -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
