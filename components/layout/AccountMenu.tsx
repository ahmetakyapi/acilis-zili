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
import { Gear, SignIn, User } from "@phosphor-icons/react/dist/ssr";
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
      {/* AVATAR, kutu değil.
          Önce arama düğmesiyle aynı kenarlıklı kareydi ve içinde jenerik bir
          kullanıcı ikonu + aşağı ok duruyordu: üç ayrı şekil (kare, daire,
          üçgen) 44 pikselin içine sıkışıyor, hiçbiri "hesap" demiyordu.
          Şimdi tek şekil var — dolgulu bir daire. Giriş yapan kullanıcıda
          baş harfleri, yapmayanda tek bir siluet taşıyor; ikisi de aynı
          nesnenin iki hâli gibi okunuyor. Ok kalktı, açıklık zeminden
          belli oluyor. */}
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={labels.account}
        className="inline-flex size-11 items-center justify-center rounded-full transition-colors"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-[34px] items-center justify-center rounded-full text-[12px] font-bold uppercase tracking-[0.02em] transition-colors",
            signedIn
              ? "bg-primary text-on-primary"
              : "bg-primary-wash text-primary",
            open && "ring-2 ring-primary/35",
          )}
        >
          {signedIn ? (
            initials || "?"
          ) : (
            <User weight="fill" size={17} />
          )}
        </span>
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

          {/* PANEL DAR ve SADE.
              248 piksel genişliğinde, içinde tam boy bir birincil düğme ve
              iki ikonlu segment vardı: 44 piksellik bir avatarın altından
              açılan kutu, ekranın üçte birini kaplayan bir sayfa gibi
              duruyordu. Bir hesap menüsünde beklenen şey satırlar, kartlar
              değil — genişlik 216'ya indi, giriş/kayıt birer satır oldu,
              tema ve dil segmentlerinden ikonlar kalktı (adlar zaten
              yazılı, ikon ikinci kez aynı şeyi söylüyordu). */}
          <div
            role="menu"
            aria-label={labels.account}
            /* Zemin `--overlay-surface`, `--surface-solid` DEĞİL: ikincisi koyu
               temada saydam (beyazın %4,5'i) çünkü sayfa üstündeki kartlar için
               tasarlandı — panelin arkasından sayfa başlığı ve endeks kartı
               okunuyordu. Katman üstü yüzey ve gölgesi bu iş için var, ⌘K
               paletiyle aynı ikili. */
            className="absolute right-0 top-[calc(100%+8px)] z-20 flex w-[216px] flex-col overflow-hidden rounded-[13px] border border-line bg-overlay-surface py-1 shadow-(--shadow-overlay)"
          >
            {/* ---- Hesap ---- */}
            {signedIn ? (
              <Link
                href="/ayarlar"
                role="menuitem"
                className="flex min-h-11 items-center gap-2.5 px-3 transition-colors hover:bg-surface"
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10.5px] font-bold uppercase text-on-primary"
                >
                  {initials || "?"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-strong">
                  {username ?? labels.account}
                </span>
                <Gear weight="duotone" size={15} className="shrink-0 text-soft" />
              </Link>
            ) : (
              <>
                <Link
                  href="/giris"
                  role="menuitem"
                  className="flex min-h-11 items-center gap-2.5 px-3 text-[13px] font-semibold text-strong transition-colors hover:bg-surface"
                >
                  <SignIn weight="duotone" size={16} className="shrink-0 text-primary" />
                  {labels.signIn}
                </Link>
                <Link
                  href="/kayit"
                  role="menuitem"
                  className="flex min-h-11 items-center gap-2.5 px-3 text-[13px] text-body transition-colors hover:bg-surface"
                >
                  <span aria-hidden className="w-4" />
                  {labels.signUp}
                </Link>
              </>
            )}

            {/* ---- Tema ve dil ----
                İkon yok: seçenekler zaten adıyla yazılı ve 216 pikselde
                ikon + ad, segmenti satırın tamamına yayıyordu. */}
            <div className="mt-1 flex flex-col gap-1 border-t border-line-soft px-3 pb-1 pt-2">
              <Row label={labels.theme}>
                {(
                  [
                    { key: "light", text: labels.themeLight },
                    { key: "dark", text: labels.themeDark },
                  ] as const
                ).map(({ key, text }) => (
                  <SegmentButton
                    key={key}
                    active={theme === key}
                    onClick={() => pickTheme(key)}
                  >
                    {text}
                  </SegmentButton>
                ))}
              </Row>

              <Row label={labels.language}>
                {LOCALES.map((locale) => (
                  <SegmentButton
                    key={locale}
                    active={locale === initialLocale}
                    onClick={() => pickLocale(locale)}
                    className="uppercase"
                  >
                    {locale}
                  </SegmentButton>
                ))}
              </Row>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Etiket solda, segment sağda — tema ve dil satırlarının ortak iskeleti. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="flex overflow-hidden rounded-lg border border-line">
        {children}
      </span>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-8 px-2.5 text-[11.5px] transition-colors",
        active
          ? "bg-surface-elevated font-semibold text-strong"
          : "text-muted hover:text-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}
