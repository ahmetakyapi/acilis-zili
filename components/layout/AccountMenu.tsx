"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretDown,
  Gear,
  Moon,
  SignIn,
  Sun,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import {
  setLocalePreference,
  setThemePreference,
} from "@/app/actions/preferences";
import { LOCALES, type Locale, type Theme } from "@/lib/i18n/config";
import {
  startRouteProgress,
  stopRouteProgress,
} from "@/components/layout/RouteProgress";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Hesap menüsü — mobil başlığın sağ ucu.

   Telefonda başlıkta üç ayrı düğme duruyordu: arama, tema, dil. Üçü de aynı
   ağırlıkta, aynı boyda ve aynı kutu içinde; hangisinin ne yaptığı ancak
   ikonuna bakıp tahmin edilerek anlaşılıyordu ve okuyucunun HESABI hiçbir
   yerde görünmüyordu — giriş yalnızca alt çubuktaki bir sekmede vardı.

   Yeni dağılım tek bir soruya göre: bu düğme İÇERİĞİ mi değiştiriyor yoksa
   ORTAMI mı? Arama içeriktir, başlıkta kalır. Tema, dil ve hesap ortamdır —
   üçü de bu menünün altında. Başlık iki düğmeye iniyor, menü açıldığında
   seçenekler ikonla değil ADIYLA yazılı duruyor ("Açık" / "Koyu", "TR" /
   "EN"), yani ilk kez açan biri neyin ne olduğunu tahmin etmiyor.

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

export type AccountMenuLabels = {
  account: string;
  settings: string;
  signIn: string;
  signUp: string;
  theme: string;
  themeLight: string;
  themeDark: string;
  language: string;
};

export function AccountMenu({
  signedIn,
  username,
  initialTheme,
  initialLocale,
  labels,
  className,
}: {
  signedIn: boolean;
  username: string | null;
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
    });
  };

  const initials = (username ?? "").slice(0, 2);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={labels.account}
        className={cn(
          "inline-flex h-11 items-center gap-1 rounded-lg border border-line bg-surface pl-1.5 pr-1 text-body transition-colors hover:border-line-strong hover:text-strong",
          open && "border-line-strong text-strong",
        )}
      >
        {signedIn ? (
          <span
            aria-hidden
            className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary-wash text-[10px] font-bold uppercase text-primary"
          >
            {initials || "?"}
          </span>
        ) : (
          <UserCircle weight="duotone" size={24} className="shrink-0" />
        )}
        <CaretDown
          weight="bold"
          size={11}
          aria-hidden
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
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
            role="menu"
            aria-label={labels.account}
            /* Zemin `--overlay-surface`, `--surface-solid` DEĞİL: ikincisi koyu
               temada saydam (beyazın %4,5'i) çünkü sayfa üstündeki kartlar için
               tasarlandı — panelin arkasından sayfa başlığı ve endeks kartı
               okunuyordu. Katman üstü yüzey ve gölgesi bu iş için var, ⌘K
               paletiyle aynı ikili. */
            className="absolute right-0 top-[calc(100%+9px)] z-20 flex w-[248px] flex-col overflow-hidden rounded-[14px] border border-line bg-overlay-surface shadow-(--shadow-overlay)"
          >
            {/* ---- Hesap ---- */}
            {signedIn ? (
              <Link
                href="/ayarlar"
                role="menuitem"
                className="flex min-h-[52px] items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-surface"
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[11px] font-bold uppercase text-primary"
                >
                  {initials || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-strong">
                    {username ?? labels.account}
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {labels.settings}
                  </span>
                </span>
                <Gear weight="duotone" size={16} className="shrink-0 text-soft" />
              </Link>
            ) : (
              <div className="flex flex-col gap-1.5 p-3">
                <Link
                  href="/giris"
                  role="menuitem"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 text-[13.5px] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
                >
                  <SignIn weight="bold" size={15} aria-hidden />
                  {labels.signIn}
                </Link>
                <Link
                  href="/kayit"
                  role="menuitem"
                  className="flex min-h-10 items-center justify-center rounded-[10px] border border-line px-3 text-[13px] font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
                >
                  {labels.signUp}
                </Link>
              </div>
            )}

            {/* ---- Tema ----
                İkon değil AD: tek bir güneş/ay ikonu "şu an hangisindeyim"
                sorusunu da "basınca ne olacak" sorusunu da cevaplamıyordu. */}
            <div className="flex items-center justify-between gap-3 border-t border-line-soft px-3.5 py-2.5">
              <span className="text-[12.5px] font-semibold text-body">
                {labels.theme}
              </span>
              <span className="flex overflow-hidden rounded-[9px] border border-line">
                {(
                  [
                    { key: "light", text: labels.themeLight, Icon: Sun },
                    { key: "dark", text: labels.themeDark, Icon: Moon },
                  ] as const
                ).map(({ key, text, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickTheme(key)}
                    aria-pressed={theme === key}
                    className={cn(
                      "flex min-h-9 items-center gap-1 px-2.5 text-[11.5px] transition-colors",
                      theme === key
                        ? "bg-surface-elevated font-semibold text-strong"
                        : "text-muted hover:text-strong",
                    )}
                  >
                    <Icon weight="duotone" size={13} aria-hidden />
                    {text}
                  </button>
                ))}
              </span>
            </div>

            {/* ---- Dil ---- */}
            <div className="flex items-center justify-between gap-3 border-t border-line-soft px-3.5 py-2.5">
              <span className="text-[12.5px] font-semibold text-body">
                {labels.language}
              </span>
              <span className="flex overflow-hidden rounded-[9px] border border-line">
                {LOCALES.map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => pickLocale(locale)}
                    aria-pressed={locale === initialLocale}
                    className={cn(
                      "min-h-9 px-3 text-[11.5px] uppercase transition-colors",
                      locale === initialLocale
                        ? "bg-surface-elevated font-semibold text-strong"
                        : "text-muted hover:text-strong",
                    )}
                  >
                    {locale}
                  </button>
                ))}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
