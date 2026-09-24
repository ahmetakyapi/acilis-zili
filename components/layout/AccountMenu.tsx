"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import {
  CaretRight,
  Gear,
  Heart,
  SignIn,
  SlidersHorizontal,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import { withLocale } from "@/lib/i18n/routing";
import type { Locale, Theme } from "@/lib/i18n/config";
import {
  LocaleSegment,
  ThemeChoice,
  useLocalePreference,
  useThemePreference,
} from "@/components/layout/preference-controls";
import { ButtonLink } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Hesap menüsü — İKİ başlığın da sağ ucu.

   Telefonda başlıkta üç ayrı düğme duruyordu: arama, tema, dil. Üçü de aynı
   ağırlıkta ve hangisinin ne yaptığı ancak ikonuna bakıp tahmin edilerek
   anlaşılıyordu; okuyucunun HESABI ise hiçbir yerde görünmüyordu. Dağılım
   tek soruya göre kuruldu: bu düğme İÇERİĞİ mi değiştiriyor yoksa ORTAMI mı?
   Arama içeriktir, başlıkta kalır. Hesap, tema ve dil ortamdır — üçü de bu
   menünün altında.

   MASAÜSTÜ DE AYNI BÖLÜŞÜMÜ ALDI. Masthead'in sağında bir dönem beş ayrı
   denetim duruyordu: arama, tek ikonlu tema düğmesi, TR/EN segmenti,
   oturum çipi ya da Giriş düğmesi — beş kontrol boyu (30-40px), dört köşe
   yarıçapı. Tek ikonlu tema düğmesi telefonda neden kaldırıldıysa orada da
   aynı soruyu cevaplayamıyordu: güneş şu anki temayı mı gösteriyor, basınca
   geleceği mi? Şimdi iki başlık da aynı iki kareyi taşıyor; masaüstünde 36,
   telefonda 44 piksel. Aynı öğe iki başlıkta basıldığı için İKİ örnek var:
   ikisi de temayı aşağıdaki kaynaktan okuyor, biri değiştirince öteki de
   güncelleniyor.

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

   -------------------------------------------------------------------------- */

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
  const pathname = usePathname();
  const open = openedAt !== null && openedAt === pathname;
  const { theme, pickTheme } = useThemePreference(initialTheme);
  const { pickLocale: switchLocale } = useLocalePreference(initialLocale);

  /* ODAK TETİKLEYİCİYE GERİ DÖNER. Panel kapanınca odak hiçbir yere
     konmuyordu: Escape'e basan ya da perdeye tıklayan klavye kullanıcısı
     `<body>`de kalıyor ve Tab'a devam ettiğinde sayfanın en başından
     sıralanıyordu — oysa bulunduğu yer masthead'in sağ ucuydu.
     `aria-haspopup="dialog"` açan düğmenin kuralı bu.

     DİL DEĞİŞİMİNDE ODAK GERİ KONMUYOR: orada tam sayfa gezinmesi var
     (gerekçe aşağıda) ve gidecek olan belgeye odak vermek anlamsız. */
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback((odagiGeriVer = true) => {
    setOpenedAt(null);
    if (odagiGeriVer) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const pickLocale = (next: Locale) => {
    if (next === initialLocale) return;
    // Panel hemen kapanır: dil geçişi arkada sürerken açık kalan menü, yeni
    // dilde yeniden çizilip gözün önünde kendi kendine değişiyordu.
    close(false);
    switchLocale(next);
  };

  const initials = (username ?? "").slice(0, 2);

  return (
    /* Masaüstünde kök başlığın tam boyunu alıyor: panelin `top` değeri
       düğmenin değil başlığın altından ölçülüyor ve panel hairline'ın 8
       piksel altına iniyor — "Daha Fazla" paneliyle aynı üst çizgi. */
    <div className={cn("relative lg:flex lg:h-full lg:items-center", className)}>
      {/* AVATAR, kutu değil. Önce arama düğmesiyle aynı kenarlıklı kareydi ve
          içinde jenerik bir kullanıcı ikonu + aşağı ok duruyordu: üç ayrı
          şekil 44 pikselin içine sıkışıyor, hiçbiri "hesap" demiyordu. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpenedAt(pathname))}
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
           durumu anlatıyor. Masaüstünde 36 piksel ve 9'luk köşe: başlığın
           yarıçapları yalnızca 9 (kontroller) ve 16 (katmanlar). */
        /* DAİRE, ARAMAYLA EŞ (23 Eylül). Giriş yapılmamışken düğme gri
           dolgulu bir kareydi ve devre dışı bir kontrol gibi okunuyordu;
           şimdi aramanın haplı yüzeyinde bir daire. Giriş yapılmışken dolu
           accent ve baş harfler, çevresinde tonla kurulmuş bir halka
           (globals.css → `.masthead-account`) — durum farkı korunuyor. */
        data-signed-in={signedIn || undefined}
        className={cn(
          "masthead-account inline-flex size-11 items-center justify-center rounded-full border text-small font-bold uppercase tracking-[0.02em] transition-colors",
          open && "ring-2 ring-primary/35",
        )}
      >
        {signedIn ? (
          <span aria-hidden>{initials || "?"}</span>
        ) : (
          <UserCircle weight="duotone" size={21} aria-hidden />
        )}
      </button>

      {/* ÇIKIŞ DA ANİMASYONLU. `AnimatePresence` kaldırılan çocuğu çıkış
          animasyonu bitene kadar ağaçta tutar — CSS keyframe yalnızca girişi
          yapabiliyordu, panel kapanırken pat diye yok oluyordu. İki çocuk da
          AYRI anahtarlı motion öğesi: fragment `exit` almaz. Karartma
          saydam, yalnızca kapanış sırasında tıklamayı yakalamak için tutuluyor.
          Giriş eğrisi eski `account-menu-in` ile aynı (−4px, ölçek .97, 160 ms);
          Motion `reducedMotion="user"` ile dönüşümleri kapatır, opaklık kalır. */}
      <AnimatePresence>
        {open && (
          <motion.span
            key="account-scrim"
            aria-hidden
            onClick={() => close()}
            className="fixed inset-0 z-10 cursor-default"
            initial={false}
            exit={{ opacity: 0 }}
          />
        )}
        {open && (
          <motion.div
            key="account-panel"
            role="dialog"
            aria-label={labels.account}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
            /* Zemin `--overlay-surface`, `--surface-solid` DEĞİL: ikincisi koyu
               temada saydam (beyazın %4,5'i) çünkü sayfa üstündeki kartlar için
               tasarlandı — panelin arkasından sayfa başlığı okunuyordu. */
            className="absolute right-0 top-[calc(100%+9px)] z-20 w-[268px] overflow-hidden rounded-xl border border-line bg-overlay-surface shadow-(--shadow-overlay)"
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
                  "relative flex size-11 shrink-0 items-center justify-center rounded-lg text-base font-bold uppercase",
                  signedIn
                    ? "bg-primary text-on-primary"
                    : "border border-line bg-surface-solid text-muted",
                )}
              >
                {signedIn ? initials || "?" : <UserCircle weight="duotone" size={22} />}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-read font-bold tracking-[-0.01em] text-strong">
                  {signedIn ? (username ?? labels.account) : labels.guest}
                </span>
                <span className="mt-0.5 block text-tiny leading-[16px] text-muted">
                  {signedIn ? labels.account : labels.guestHint}
                </span>
              </span>
            </div>

            {/* ===== 2 · Gezinme ===== */}
            <div className="flex flex-col px-2 pb-2">
              {signedIn ? (
                <>
                  <MenuRow
                    href={withLocale("/favoriler", initialLocale)}
                    icon={Heart}
                    label={labels.watchlist}
                  />
                  <MenuRow
                    href={withLocale("/ayarlar", initialLocale)}
                    icon={Gear}
                    label={labels.settings}
                  />
                  {/* Panel yalnızca Türkçe (gerekçe: components/admin/AdminUI.tsx),
                      etiketi de öyle — sözlüğe girmiyor. */}
                  {isAdmin && (
                    <MenuRow
                      href={withLocale("/admin", initialLocale)}
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
                  <ButtonLink
                    href={withLocale("/giris", initialLocale)}
                    variant="primary"
                    className="w-full"
                  >
                    <SignIn weight="bold" size={15} aria-hidden />
                    {labels.signIn}
                  </ButtonLink>
                  <Link
                    href={withLocale("/kayit", initialLocale)}
                    className="flex min-h-10 items-center justify-center rounded-md border border-line text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
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
                <span className="plate text-nano">
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
                <span className="plate text-nano">
                  {labels.language}
                </span>
                <LocaleSegment current={initialLocale} onPick={pickLocale} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary-ink"
      >
        <Icon weight="duotone" size={16} />
      </span>
      <span className="flex-1 text-base font-semibold text-strong">
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
