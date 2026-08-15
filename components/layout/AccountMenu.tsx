"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CaretRight,
  Gear,
  Heart,
  SignIn,
  SlidersHorizontal,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import { withLocale } from "@/lib/i18n/routing";
import {
  setLocalePreference,
  setThemePreference,
} from "@/app/actions/preferences";
import { LOCALES, type Locale, type Theme } from "@/lib/i18n/config";
import {
  startRouteProgress,
  stopRouteProgress,
} from "@/components/layout/RouteProgress";
import { ButtonLink } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Hesap menüsü — mobil başlığın sağ ucu.

   Telefonda başlıkta üç ayrı düğme duruyordu: arama, tema, dil. Üçü de aynı
   ağırlıkta ve hangisinin ne yaptığı ancak ikonuna bakıp tahmin edilerek
   anlaşılıyordu; okuyucunun HESABI ise hiçbir yerde görünmüyordu. Dağılım
   tek soruya göre kuruldu: bu düğme İÇERİĞİ mi değiştiriyor yoksa ORTAMI mı?
   Arama içeriktir, başlıkta kalır. Hesap, tema ve dil ortamdır — üçü de bu
   menünün altında.

   PANEL İKİ KEZ YENİDEN YAZILDI, ikisinin de gerekçesi burada:

   (1) İlk hâl 248 piksel genişliğinde bir kutuydu; içinde tam boy bir
       birincil düğme ve iki ikonlu segment vardı. 44 piksellik bir avatarın
       altından açılan panel ekranın üçte birini kaplıyordu.
   (2) Karşılık olarak her şey satıra indirildi ve 216 piksele daraltıldı.
       Bu sefer panel bir sistem menüsü gibi duruyordu: dört gri satır, hiç
       hiyerarşi yok, hangisinin önemli olduğu okunmuyor.

   Şimdiki düzen ÜÇ BÖLGE: kimlik başlığı, gezinme satırları, tercihler.
   Bölgeler ayraç çizgisiyle değil ZEMİNLE ayrılıyor — başlık çok soluk bir
   degrade taşıyor, satırlar düz zeminde, tercihler bir kademe çökük blokta.
   Göz üç bölgeyi tek bakışta ayırıyor ve hiçbir yerde çizgi saymıyor.

   TEMA SEÇİMİ İKİ KÜÇÜK ÖNİZLEME. "Açık/Koyu" yazan iki metin düğmesi
   doğruydu ama sönüktü; oysa seçilen şey görsel bir şey ve karşılığı
   gösterilebilir. İki minik sayfa maketi, seçili olan accent çerçeveyle.

   Tema burada da <html data-theme> üzerinden okunur (ThemeToggle ile aynı
   kaynak): iki bileşen aynı anda ekranda olabilir ve biri değiştirince
   diğeri attribute'u dinlediği için kendiliğinden güncellenir.
   -------------------------------------------------------------------------- */

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/**
 * Tema önizlemesinin renkleri — SABİT, token değil.
 *
 * "Hardcoded renk yasak" kuralının bilinçli tek istisnası. Swatch'ın işi o
 * temanın nasıl göründüğünü göstermek; token kullanılsaydı iki maket de O AN
 * AÇIK OLAN temanın renklerini alır ve "Açık" ile "Koyu" birbirinin aynısı
 * çizilirdi. Değerler `globals.css` içindeki `--page-bg`, kart yüzeyi ve
 * `--primary` ile birebir aynı; orası değişirse burası da değişmeli.
 */
const THEME_SPECIMEN = {
  light: { page: "#f7f9fb", card: "#ffffff", ink: "#d7dee6", accent: "#0d74c4" },
  dark: { page: "#070d16", card: "#141d29", ink: "#2a3542", accent: "#35b8ff" },
} as const;

export type AccountMenuLabels = {
  account: string;
  settings: string;
  signIn: string;
  signUp: string;
  theme: string;
  themeLight: string;
  themeDark: string;
  language: string;
  /** Giriş yapılmamış kimlik satırının adı — "Misafir". */
  guest: string;
  /** Hesabın ne kazandırdığını söyleyen tek satır. */
  guestHint: string;
  watchlist: string;
};

export function AccountMenu({
  signedIn,
  username,
  isAdmin = false,
  initialTheme,
  initialLocale,
  labels,
  className,
}: {
  signedIn: boolean;
  username: string | null;
  /** Yönetim satırı yalnızca yöneticide çizilir — panelin kapısı ayrıca
      veritabanına soruyor, bu yalnızca görünürlük kararı. */
  isAdmin?: boolean;
  initialTheme: Theme;
  initialLocale: Locale;
  labels: AccountMenuLabels;
  className?: string;
}) {
  /* Açıklık, açıldığı ADRESE bağlı tutuluyor: `openedAt === pathname`.
     Basit bir boolean + "gezinince kapat" effect'i aynı işi görüyordu ama
     effect içinde setState çağırmak bir tur fazladan çizim demek — burada
     kapanış türetiliyor, adres değiştiği anda panel kendiliğinden düşüyor. */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const open = openedAt !== null && openedAt === pathname;
  const theme = useSyncExternalStore(
    subscribeTheme,
    readTheme,
    () => initialTheme,
  );

  /* Dil değişimi bir gezinme DEĞİL — adres aynı kalıyor, çerez yazılıyor ve
     sunucu ağacı yeniden çiziliyor. `RouteProgress` tıklamaları dinleyerek
     çalıştığı için bunu göremiyor; göstergeyi geçişin kendisine bağlıyoruz. */
  useEffect(() => {
    if (pending) startRouteProgress();
    else stopRouteProgress();
  }, [pending]);

  const close = useCallback(() => setOpenedAt(null), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pickTheme = (next: Theme) => {
    if (next === readTheme()) return;
    // Görsel değişim tıklama anında, çerez arka planda — ThemeToggle ile aynı
    // sıra. Sunucuyu beklersek tema geç dönüyor ve düğme donmuş gibi duruyor.
    document.documentElement.setAttribute("data-theme", next);
    void setThemePreference(next);
  };

  const pickLocale = (next: Locale) => {
    if (next === initialLocale) return;
    // Panel hemen kapanır: dil geçişi arkada sürerken açık kalan menü, yeni
    // dilde yeniden çizilip gözün önünde kendi kendine değişiyordu.
    close();
    /* Geçiş gövdesi ASENKRON. `startTransition(() => void action())` yazılırsa
       gövde `undefined` döndürdüğü için React geçişi o anda bitmiş sayıyor:
       `pending` bir kare true olup hemen false'a düşüyor ve gösterge hiç
       görünmüyordu. Söz döndürülünce geçiş sunucu eylemi bitene kadar açık
       kalıyor — React 19'un asenkron geçişleri. */
    startTransition(async () => {
      await setLocalePreference(next);
      /* Dil adreste yaşıyor: tercih yazıldıktan sonra aynı sayfanın öteki
         dildeki adresine gidiliyor. */
      router.push(withLocale(pathname, next));
    });
  };

  const initials = (username ?? "").slice(0, 2);

  return (
    <div className={cn("relative", className)}>
      {/* AVATAR, kutu değil. Önce arama düğmesiyle aynı kenarlıklı kareydi ve
          içinde jenerik bir kullanıcı ikonu + aşağı ok duruyordu: üç ayrı
          şekil 44 pikselin içine sıkışıyor, hiçbiri "hesap" demiyordu. */}
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        aria-expanded={open}
        /* `menu` DEĞİL `dialog`: aşağıdaki panel bir menü değil, içinde
           kimlik başlığı, iki tema düğmesi ve iki dil düğmesi olan küçük bir
           panel. ARIA'da `menu`nün çocukları yalnızca menuitem türleri
           olabilir; başka içerik olduğunda ekran okuyucu öğe sayısını yanlış
           duyuruyor ve ok tuşu yönetimi bekliyordu. */
        aria-haspopup="dialog"
        aria-label={labels.account}
        /* DÜĞME ARAMA DÜĞMESİYLE AYNI DİLİ KONUŞUYOR. Yanındaki arama
           kutusu 44 piksellik yumuşak köşeli bir kare, hairline kenarlıklı
           ve dolgusuz; hesap ise 34 piksellik DOLU bir daireydi. İki farklı
           biçim, iki farklı ağırlık, yan yana.

           Giriş yapılmamışken düğme bir kimlik değil bir DAVET: arama gibi
           dolgusuz ve sakin duruyor. Giriş yapılmışken kimlik var, o yüzden
           dolu accent kutu ve baş harfler — fark artık rastgele değil,
           durumu anlatıyor. */
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-lg border text-[12px] font-bold uppercase tracking-[0.02em] transition-colors",
          signedIn
            ? "border-transparent bg-primary text-on-primary hover:bg-primary-hover"
            : "border-line bg-surface text-muted hover:border-line-strong hover:text-soft",
          open && "ring-2 ring-primary/35",
        )}
      >
        {signedIn ? (
          <span aria-hidden>{initials || "?"}</span>
        ) : (
          <UserCircle weight="duotone" size={20} aria-hidden />
        )}
      </button>

      {open && (
        <>
          {/* Dışarı dokunuş paneli kapatır. Panelin kendisinden ÖNCE basılır,
              yani yığında altında kalır. */}
          <span
            aria-hidden
            onClick={close}
            className="fixed inset-0 z-10 cursor-default"
          />

          <div
            role="dialog"
            aria-label={labels.account}
            /* Zemin `--overlay-surface`, `--surface-solid` DEĞİL: ikincisi koyu
               temada saydam (beyazın %4,5'i) çünkü sayfa üstündeki kartlar için
               tasarlandı — panelin arkasından sayfa başlığı okunuyordu. */
            className="account-menu absolute right-0 top-[calc(100%+9px)] z-20 w-[268px] overflow-hidden rounded-xl border border-line bg-overlay-surface shadow-(--shadow-overlay)"
          >
            {/* ===== 1 · Kimlik ===== */}
            <div className="relative flex items-center gap-3 px-4 py-4">
              {/* Degrade YALNIZCA burada ve çok soluk: bölgeyi zeminden
                  ayırıyor, bir düğme gibi görünmeden. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-wash to-transparent"
              />
              <span
                aria-hidden
                className={cn(
                  /* Panelin künyesi düğmeyle AYNI biçim: düğme yumuşak
                     köşeli kare, künye daireydi ve panel açıldığında iki
                     ayrı şey gibi duruyordu. */
                  "relative flex size-11 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold uppercase",
                  signedIn
                    ? "bg-primary text-on-primary"
                    : "border border-line bg-surface-solid text-muted",
                )}
              >
                {signedIn ? initials || "?" : <UserCircle weight="duotone" size={22} />}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-strong">
                  {signedIn ? (username ?? labels.account) : labels.guest}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-[16px] text-muted">
                  {signedIn ? labels.account : labels.guestHint}
                </span>
              </span>
            </div>

            {/* ===== 2 · Gezinme ===== */}
            <div className="flex flex-col px-2 pb-2">
              {signedIn ? (
                <>
                  <MenuRow
                    href="/favoriler"
                    icon={Heart}
                    label={labels.watchlist}
                  />
                  <MenuRow href="/ayarlar" icon={Gear} label={labels.settings} />
                  {/* Panel yalnızca Türkçe (gerekçe: components/admin/AdminUI.tsx),
                      etiketi de öyle — sözlüğe girmiyor. */}
                  {isAdmin && (
                    <MenuRow
                      href="/admin"
                      icon={SlidersHorizontal}
                      label="Yönetim"
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-1.5 px-1 pb-1">
                  {/* Giriş TEK birincil eylem. İki eşit ağırlıklı düğme
                      konduğunda hangisine basılacağı kararı okuyucuya
                      kalıyordu; kayıt olmak isteyen ikinci satırı zaten
                      okuyor. */}
                  <ButtonLink href="/giris" variant="primary" className="w-full">
                    <SignIn weight="bold" size={15} aria-hidden />
                    {labels.signIn}
                  </ButtonLink>
                  <Link
                    href="/kayit"
                    className="flex min-h-10 items-center justify-center rounded-md border border-line text-[12.5px] font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
                  >
                    {labels.signUp}
                  </Link>
                </div>
              )}
            </div>

            {/* ===== 3 · Tercihler =====
                Çökük zemin bölgeyi ayırıyor; sayılacak ayraç çizgisi yok. */}
            <div className="flex flex-col gap-3 border-t border-line-soft bg-surface px-4 py-3.5">
              <div className="flex flex-col gap-2">
                <span className="plate text-[9.5px] tracking-[0.1em]">
                  {labels.theme}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "light", text: labels.themeLight },
                      { key: "dark", text: labels.themeDark },
                    ] as const
                  ).map(({ key, text }) => (
                    <ThemeChoice
                      key={key}
                      variant={key}
                      label={text}
                      active={theme === key}
                      onClick={() => pickTheme(key)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="plate text-[9.5px] tracking-[0.1em]">
                  {labels.language}
                </span>
                <span className="flex overflow-hidden rounded-md border border-line bg-surface-solid">
                  {LOCALES.map((locale) => (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => pickLocale(locale)}
                      aria-pressed={locale === initialLocale}
                      className={cn(
                        "min-h-8 px-3 text-[11.5px] uppercase transition-colors",
                        locale === initialLocale
                          ? "bg-primary font-bold text-on-primary"
                          : "text-muted hover:text-strong",
                      )}
                    >
                      {locale}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Gezinme satırı — ikon, ad, ok. Yalnızca giriş yapmış kullanıcıda. */
function MenuRow({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Gear;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center gap-3 rounded-md px-2 transition-colors hover:bg-surface"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary"
      >
        <Icon weight="duotone" size={16} />
      </span>
      <span className="flex-1 text-[13.5px] font-semibold text-strong">
        {label}
      </span>
      <CaretRight
        weight="bold"
        size={13}
        aria-hidden
        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/**
 * Tema seçeneği — o temanın minik bir sayfa maketi.
 *
 * Zemin, üstünde bir kart, kartın içinde bir accent şerit ve iki metin
 * satırı. Seçili olan accent çerçeveyle işaretli ve adı altında yazılı —
 * maket tek başına bilmece kalmıyor.
 */
function ThemeChoice({
  variant,
  label,
  active,
  onClick,
}: {
  variant: "light" | "dark";
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const spec = THEME_SPECIMEN[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md border p-1.5 transition-colors",
        active
          ? "border-primary bg-primary-wash"
          : "border-line bg-surface-solid hover:border-line-strong",
      )}
    >
      <span
        aria-hidden
        className="flex h-[40px] w-full items-center rounded-xs px-[7px]"
        style={{ background: spec.page }}
      >
        <span
          className="flex w-full flex-col gap-[3px] rounded-[4px] p-[5px]"
          style={{ background: spec.card }}
        >
          <span
            className="h-[3px] w-[55%] rounded-full"
            style={{ background: spec.accent }}
          />
          <span
            className="h-[3px] w-full rounded-full"
            style={{ background: spec.ink }}
          />
          <span
            className="h-[3px] w-[70%] rounded-full"
            style={{ background: spec.ink }}
          />
        </span>
      </span>
      <span
        className={cn(
          "text-[11.5px] font-semibold",
          active ? "text-primary" : "text-body",
        )}
      >
        {label}
      </span>
    </button>
  );
}
