import Image from "next/image";
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
 * Panel başlığı — sağda isteğe bağlı accent bağlantı.
 * Süs işareti yok; başlığı başlık yapan ağırlığı, kutusu değil.
 *
 * BAŞLIK PANELİN İŞİNE BAĞLI. Ana sayfada on bir panel vardı ve on biri de
 * aynı başlığı taşıyordu: 14 piksel kalın degrade mürekkep, sağında "Tümünü
 * Gör". Sayfa bu yüzden tek bir kutunun tekrarı gibi okunuyordu — göz
 * nereye bakacağını içerikten değil, sırayla ilerleyerek buluyordu.
 *
 * İki ton var ve ayrım rol ayrımı:
 *
 *   `title` — OKUNACAK ya da TARANACAK panel. Bir manşet, bir liste, bir
 *   kayıt. Başlık metnin parçası, o yüzden metin ağırlığında.
 *
 *   `plate` — BAKILACAK panel. Yan kolondaki gösterge tablosu: dünya
 *   piyasaları, tahvil, makro, takvim. Oradaki başlık okunacak bir şey
 *   değil, bir ETİKET — sayının ne olduğunu söylüyor ve kenara çekiliyor.
 *   Aynı `.plate` künyesi zaten blok etiketlerinde ve veri damgalarında
 *   kullanılıyor, yani yeni bir dil değil.
 */
export function PanelHeader({
  title,
  action,
  meta,
  tone = "title",
  className,
}: {
  title: string;
  /** Sağdaki bağlantı ya da filtre grubu. */
  action?: React.ReactNode;
  /** Başlığın sağındaki sessiz bilgi — "04:00 — 20:00 ET" gibi. */
  meta?: string;
  tone?: "title" | "plate";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 sm:px-5",
        /* Plaka başlık daha kısa: 11 piksellik bir etiketin çevresinde 16
           piksel dolgu, kutuyu başlığın kendisinden büyük gösteriyor. */
        tone === "plate" ? "py-3.5" : "py-4",
        className,
      )}
    >
      {tone === "plate" ? (
        /* `min-w-0` + `truncate`: plaka başlık, yanındaki künye ve bağlantıyla
           birlikte 376 piksellik yan kolonda 46 piksel boşluk bırakıyor
           (ölçüldü). Daha uzun bir başlık ya da yedek yazı tipi devreye
           girdiğinde satır kırılmak yerine kesiliyor — panelin dışına
           taşmıyor. */
        <h2 className="plate min-w-0 truncate">{title}</h2>
      ) : (
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
          {title}
        </h2>
      )}
      {meta && <span className="text-xs text-muted">{meta}</span>}
      {action}
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
        <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
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
        size === "sm" ? "px-1.5 py-0.5 text-tiny" : "px-2 py-0.5 text-xs",
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
        size === "sm" ? "px-2 py-[3px] text-nano" : "px-[9px] py-[3px] text-tiny",
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
          ? "size-8 rounded-md text-tiny"
          : "size-11 rounded-md text-base",
        className,
      )}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Sekme şeridi — alt çizgili gezinme

   İKİ ŞERİT İKİ AYRI DİL KONUŞUYORDU. `EarningsTabs` ve `AdminTabs` aynı
   deseni çiziyor ama hiçbir ölçüsü tutmuyordu: yükseklik 44'e karşı 40
   (ikincisi dokunma eşiğinin altında), aralık 0.5'e karşı 1, aktif sekmenin
   işareti birinde MÜREKKEP RENGİ (accent) öbüründe AĞIRLIK (koyu + yarı
   kalın). Yani "hangi sekmedeyim" sorusunun cevabı iki ekranda iki farklı
   şeye bakılarak veriliyordu.

   Tek kural: aktif = accent kenar + accent mürekkep + kalın, pasif = gövde
   mürekkebi. Yükseklik her yerde 44.
   -------------------------------------------------------------------------- */

export function TabBar({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    /* Dar ekranda sekmeler kırılmak yerine kayar. KAP İLE İÇERİK AYRI
       ELEMAN: `min-w-max` ile `overflow-x-auto` aynı elemandaydı ve
       `min-w-max` kabın KENDİSİNİ içerik kadar genişletiyordu — kap hiçbir
       zaman içerikten dar olmadığı için kaydırma da hiç doğmuyordu. Taşma
       sayfaya çıkıyor, sayfa gövdesi yatay kaydırmaya kilitli olduğu için
       (globals.css) son sekmeler dar ekranda tamamen erişilemez kalıyordu. */
    <nav
      aria-label={label}
      className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul
        className={cn(
          "flex min-w-max gap-0.5 border-b border-line",
          className,
        )}
      >
        {children}
      </ul>
    </nav>
  );
}

export function TabItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          /* -mb-px: alt çizgi çubuğun hairline'ının üstüne otursun, altına
             inip 1px kalınlık farkı yaratmasın. */
          "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3.5 text-base transition-colors sm:px-[18px]",
          active
            ? "border-primary font-bold text-primary"
            : "border-transparent font-medium text-body hover:text-strong",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Şirket logosu karosu

   TEK YERDE, ÇÜNKÜ ON İKİ YERDE FARKLIYDI. Doğru davranan bir karo vardı ama
   `StoryVisual.tsx`e özeldi ve dışa açılmamıştı; aynı karo on iki ayrı yerde
   elden yazılmıştı — 22/26/30/32/44/56 piksel, 6/7/9/11/13 piksel yarıçap,
   bir yerde tam yuvarlak. Aynı logo bir ekranda köşeli, öbüründe yuvarlak
   görünüyordu.

   DAHA KÖTÜSÜ ÇERÇEVE. CLAUDE.md'deki kural açık: "görselin etrafında
   çerçeve ve iç dolgu yok — kenarlık ve dolgu, resmi kutunun ortasında duran
   ayrı bir nesne gibi gösteriyor; görsel kutunun kendisi olmalı". Altı çağrı
   yeri bunu çiğniyordu (biri hem `border` hem `p-1` taşıyordu). Karo artık
   kuralı kendi taşıyor: `overflow-hidden` + kendi köşe yarıçapı, kenarlık
   yok.

   Logo yoksa `SymbolBadge`e düşer — o düşüş de her yerde ayrı yazılıyordu.
   -------------------------------------------------------------------------- */

const LOGO_TILE_SIZE = {
  xs: { box: "size-[22px] rounded-xs", px: 22 },
  sm: { box: "size-[26px] rounded-sm", px: 26 },
  md: { box: "size-8 rounded-md", px: 32 },
  lg: { box: "size-11 rounded-lg", px: 44 },
  xl: { box: "size-14 rounded-lg", px: 56 },
} as const;

export type LogoTileSize = keyof typeof LOGO_TILE_SIZE;

export function LogoTile({
  symbol,
  logoUrl,
  size = "md",
  className,
}: {
  symbol: string;
  logoUrl?: string | null;
  size?: LogoTileSize;
  className?: string;
}) {
  const step = LOGO_TILE_SIZE[size];

  if (!logoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          "numeral flex shrink-0 items-center justify-center bg-primary-wash font-bold tracking-[-0.02em] text-primary",
          step.box,
          size === "xs" || size === "sm" ? "text-micro" : "text-tiny",
          className,
        )}
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    /* Zemin BEYAZ: logoların çoğu şeffaf PNG ve koyu mürekkeple çizilmiş —
       koyu temada zeminsiz bırakılırsa görünmüyorlar. */
    <span
      className={cn(
        "block shrink-0 overflow-hidden bg-white",
        step.box,
        className,
      )}
    >
      <Image
        src={logoUrl}
        alt=""
        width={step.px}
        height={step.px}
        className="size-full object-contain"
      />
    </span>
  );
}

/* --------------------------------------------------------------------------
   Veri tazeliği damgası — her veri kartının altında görünür
   -------------------------------------------------------------------------- */

export type DataStampLabels = {
  sourceCache: string;
  sourceSeed: string;
  updatedAt: string;
  mayBeStale: string;
  /** "15 dk gecikmeli" — yayını gecikmeli sağlayıcılarda damgaya eklenir. */
  delayed: string;
};

/* Sağlayıcı adları çevrilmez — marka. "önbellek" ve "takvim" ise sözlükten
   geliyor: sabit tabloda dururken İngilizce sitede de Türkçe basılıyorlardı. */
const PROVIDER_LABEL: Record<string, string> = {
  alpaca: "Alpaca · SIP",
  finnhub: "Finnhub",
  fred: "FRED",
};

/* GECİKME DAMGAYA YAZILIYOR. Damgadaki saat verinin YAŞI değil, bizim onu
   ÇEKTİĞİMİZ an. Konsolide tape ücretsiz katmanda 15 dakika geriden
   yayımlandığı için "güncellendi 12:00" satırı, 11:45'in fiyatını 12:00'nin
   fiyatı gibi gösteriyordu — projenin "bayat veriyi taze gibi gösterme"
   kuralının küçük ama gerçek bir ihlali. Gecikme sağlayıcının bir özelliği,
   o yüzden tablo burada. */
const DELAYED_PROVIDERS = new Set(["alpaca"]);

export function DataStamp({
  source,
  at,
  stale,
  locale,
  labels,
  note,
  className,
}: {
  source: string;
  at?: Date | string | null;
  stale?: boolean;
  locale: Locale;
  /** Sözlüğün `data` bloğu — çağıran sunucu bileşeni onu zaten okuyor. */
  labels: DataStampLabels;
  note?: string;
  className?: string;
}) {
  /* Damga saati her zaman Türkiye saatiyle basılır — sunucu UTC'de koşsa da
     okuyucunun duvar saatiyle örtüşür.

     24 SAAT, İKİ DİLDE DE. `en-US` varsayılanı 12 saatlik biçim veriyor ve
     aynı ekranda sitenin geri kalanıyla (lib/session-clock.ts, iki dilde de
     24 saat) iki farklı saat biçimi yan yana duruyordu. */
  const time = at
    ? new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(typeof at === "string" ? new Date(at) : at)
    : null;

  const delayed = DELAYED_PROVIDERS.has(source);
  const sourceLabel =
    PROVIDER_LABEL[source] ??
    (source === "cache"
      ? labels.sourceCache
      : source === "seed"
        ? labels.sourceSeed
        : source);

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-tiny text-muted",
        className,
      )}
    >
      <span>{sourceLabel}</span>
      {time && (
        <>
          <span aria-hidden>·</span>
          {/* Cümle TEK PARÇA: sözcük sırası sözlükten geliyor. Parça parça
              birleştirilince İngilizcede "5:05 PM updated" çıkıyordu. */}
          <span className="numeral">
            {labels.updatedAt.replace("{time}", time)}
          </span>
        </>
      )}
      {delayed && (
        <>
          <span aria-hidden>·</span>
          <span>{labels.delayed}</span>
        </>
      )}
      {stale && (
        <>
          <span aria-hidden>·</span>
          <span className="text-impact-med">{labels.mayBeStale}</span>
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

/* Yarıçap TOKEN'DAN (`--radius-md` = 9px), elle yazılmış `rounded-md`
   değil: token değişirse buton da değişsin. */
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none";

const BUTTON_VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  ghost:
    "border border-line bg-surface text-body hover:border-line-strong hover:text-strong",
  quiet: "text-body hover:bg-surface-elevated hover:text-strong",
  danger: "text-down hover:bg-down-wash",
} as const;

/* `lg` BASAMAĞI FORMLAR İÇİN. Aynı mavi buton sekiz yerde elden yazılmıştı ve
   hiçbiri birbirini tutmuyordu: beş farklı yükseklik, dört yarıçap, dört
   punto. Aynı ekranda iki farklı yarıçaplı buton yan yana gelebiliyor ve
   dokunma hedefi 36px ile 44px arasında değişiyordu. Form gönderme
   düğmelerinin girdi alanlarıyla aynı yükseklikte (44px) olması gerekiyor;
   o ölçü artık `md`nin yanında kendi basamağı. */
const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-base min-h-11 sm:min-h-0 sm:h-10",
  lg: "h-11 px-4 text-read",
  icon: "size-9 p-0",
} as const;

/**
 * Buton görünümünün sınıf dizesi — `<button>`/`<Link>` OLMAYAN yerler için.
 *
 * Dış bağlantılar (`<a target="_blank">`) ve atlama bağlantısı gibi birkaç
 * yer bileşeni kullanamıyor ama görünüm aynı olmalı. Sınıfları elle yeniden
 * yazmak yerine aynı kaynaktan alıyorlar.
 */
export function buttonClass(options?: {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
}) {
  return cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[options?.variant ?? "primary"],
    BUTTON_SIZES[options?.size ?? "md"],
    options?.className,
  );
}

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
        /* Telefonda 44px, masaüstünde 32px: çipler 32px yüksekliğindeydi ve
           dokunma eşiğinin altında kalıyordu — sektör süzgeci gibi yan yana
           dizilen çiplerde yanlış çipe basmak kolaydı. İmleç hassas olduğu
           için geniş ekranda ölçü değişmiyor, çip şeridi orada aynı
           sıkılıkta kalıyor. */
        "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-[11px] py-[5px] text-tiny transition-colors sm:min-h-8",
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
    <span className="inline-flex overflow-hidden rounded-md border border-line text-small">
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
        /* Dokunma hedefi 33px'ti. `FilterChip` bir denetimde 44px'e
           çıkarılmıştı ama aynı satırın öteki denetimi olan bu segment
           atlanmıştı — Hafta/Ay gibi en çok basılan seçicilerin hepsi bu. */
        "inline-flex min-h-11 items-center px-[13px] py-[7px] transition-colors sm:min-h-9",
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
