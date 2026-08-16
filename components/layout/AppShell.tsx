"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import { CalendarBlank, Gear } from "@phosphor-icons/react/dist/ssr";
import { BellMark, BrandLockup, BrandWord } from "@/components/brand/BellMark";
import { RouteProgress } from "./RouteProgress";
import { NAV_ITEMS } from "./nav-items";
import { stripLocale } from "@/lib/i18n/routing";
import { ButtonLink } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type ShellLabels = {
  brandName: string;
  tagline: string;
  nav: Record<string, string>;
  navShort: Record<string, string>;
  settings: string;
  signIn: string;
  menu: string;
  mainNav: string;
  bottomNav: string;
  skipToContent: string;
  loading: string;
};

type AppShellProps = {
  labels: ShellLabels;
  signedIn: boolean;
  username: string | null;
  themeToggle: React.ReactNode;
  localeToggle: React.ReactNode;
  searchTrigger: React.ReactNode;
  /** Mobil başlığın sağ ucu: hesap + tema + dil tek panelde. */
  accountMenu: React.ReactNode;
  ticker: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Aktif sekme — KARŞILAŞTIRMA DİLDEN ARINDIRILMIŞ yolla yapılır.
 *
 * `usePathname()` tarayıcının adresini veriyor, yani `/en/piyasalar`. Gezinme
 * hedefleri ise dilsiz yazılıyor (`/piyasalar`). İkisi ham hâlde
 * karşılaştırılınca İngilizce tarafta HİÇBİR sekme aktif görünmüyordu —
 * `startsWith` yalnızca "/" ile eşleşiyor ve vurgu "Menü"ye düşüyordu.
 */
function isActive(pathname: string, href: string): boolean {
  const path = stripLocale(pathname);
  if (href === "/") return path === "/";
  return path.startsWith(href);
}

/* --------------------------------------------------------------------------
   Kabuk — masaüstünde masthead, mobilde başlık + alt sekme çubuğu.

   Kenar çubuğu kaldırıldı: yeni tasarımda gezinme sayfanın üstünde yatay
   duruyor ve içerik tam genişliği alıyor.

   GÜVENLİ ALAN. Sayfa artık `viewport-fit=auto` ile açılıyor: görünüm alanı
   çentiğin ve sistem çubuklarının altına UZANMIYOR (gerekçe app/layout.tsx
   içinde — iOS 26'nın cam sistem çubuğu, altında kalan başlığın yazısını
   bulanıklaştırıyordu). Yani `env(safe-area-inset-*)` değerleri çoğu cihazda
   artık 0 dönüyor.

   Dolgular YİNE DE `env()` ile yazılı ve hepsi `max(...)` taban değer
   taşıyor: env 0 olduğunda tasarımın kendi boşluğu duruyor, karar geri
   alınırsa (cover'a dönülürse) katmanlar güvenli alanı yeniden kendileri
   taşıyor. Her sabit/yapışkan katman kendi güvenli alanını kendi taşır.
   -------------------------------------------------------------------------- */

/**
 * Yatay güvenli alan — telefon yan çevrildiğinde çentik SOL kenardan içeri
 * girer ve ilk sekme/marka onun altında kalır. `max()` kullanılıyor çünkü
 * çentiksiz cihazda env değeri 0'dır ve tasarımın kendi dolgusu korunmalı.
 */
const SAFE_X_18 =
  "pl-[max(env(safe-area-inset-left),18px)] pr-[max(env(safe-area-inset-right),18px)]";
const SAFE_X_12 =
  "pl-[max(env(safe-area-inset-left),12px)] pr-[max(env(safe-area-inset-right),12px)]";

/** İçerik kanalı — 18/24/40px dolgu, çentik daha genişse o kazanır. */
const CONTENT_GUTTER = [
  "pl-[max(env(safe-area-inset-left),18px)] pr-[max(env(safe-area-inset-right),18px)]",
  "sm:pl-[max(env(safe-area-inset-left),24px)] sm:pr-[max(env(safe-area-inset-right),24px)]",
  "xl:pl-[max(env(safe-area-inset-left),40px)] xl:pr-[max(env(safe-area-inset-right),40px)]",
].join(" ");

export function AppShell({
  labels,
  signedIn,
  username,
  themeToggle,
  localeToggle,
  searchTrigger,
  accountMenu,
  ticker,
  footer,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  /* Kabuktaki bağlantılar dili taşır: en çok tıklanan yerler bunlar ve
     önekSİZ bir bağlantı proxy'de fazladan bir yönlendirmeye mal oluyor. */
  const { href: L } = useLocaleHref();

  /* Alt çubuk: Piyasa · Bilanço · Favoriler · Menü.
     Giriş yapmamış kullanıcıda Favoriler sekmesi ÇIKMAZ SOKAKTI — sayfa onu
     doğrudan /giris'e atıyor, yani dört sekmeden biri o kullanıcı için içerik
     değil bir duvardı. Yuvaya bir süre "Giriş Yap" yazıldı ve bu daha da kötü
     çalıştı: gezinme çubuğunun ÜÇÜ ekran, BİRİ formdu; göz her sayfada oraya
     takılıyor ve sekme bir davet gibi durduğu için kapatılamıyordu.

     Artık yuvada giriş yapmamış okuyucu için TAKVİM var — gerçek bir ekran,
     duvar değil. Takvim mobil alt çubuktan bilerek çıkarılmıştı (bugünün
     olayları zaten ana sayfada) ama "hiç yoktan" değil "girişten" iyi:
     haftaya bakış ana sayfada yok ve bu ekran mobilde başka türlü yalnızca
     Menü'den açılıyor. Giriş bağlantısı kaybolmuyor — başlıktaki hesap
     menüsünde, ait olduğu yerde duruyor.

     Giriş yapan kullanıcıda yuva Favoriler'e döner: onun için o sekme
     ürünün en sık açılan ekranı. */
  const bottomItems = NAV_ITEMS.filter((item) => item.inBottomBar).map(
    (item) => {
      const swap = item.href === "/favoriler" && !signedIn;
      return {
        key: item.href,
        href: swap ? "/takvim" : item.href,
        icon: swap ? CalendarBlank : item.icon,
        text: swap
          ? labels.nav["/takvim"]
          : (labels.navShort[item.href] ?? labels.nav[item.href]),
      };
    },
  );

  /**
   * Alt çubukta hangi sekme işaretli.
   *
   * Eskiden her sekme kendi yolunu tek başına sınıyordu ve Takvim, Rehber,
   * Mercek, Haberler ya da bir hisse sayfasındayken HİÇBİR sekme işaretli
   * kalmıyordu: dört sekme de sönük duruyor, okuyucu çubuğa göre "hiçbir
   * yerde" oluyordu. O ekranların tamamı mobilde Menü'nün altında yaşıyor,
   * dolayısıyla eşleşme bulunamadığında işaret Menü'ye düşer.
   *
   * Ana sayfa istisna: alt çubukta bilerek sekmesi yok (marka logosu zaten
   * oraya götürüyor), orada hiçbir şey işaretlenmez — yoksa ana sayfa
   * "Menü'deymişsin" gibi görünürdü.
   */
  const matchedBottom = bottomItems.find(
    (item) => item.href !== "/menu" && isActive(pathname, item.href),
  );
  const activeBottomKey =
    pathname === "/" ? null : (matchedBottom?.key ?? "/menu");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Gezinme göstergesi kabuğun EN ÜSTÜNDE: her rota bu kabuğun altında
          yaşıyor, tek bir yerde durması yeter. `useSearchParams` okuduğu için
          Suspense şart — yoksa altındaki bütün rotalar statik ön çizimden
          düşerdi. */}
      <Suspense fallback={null}>
        <RouteProgress label={labels.loading} />
      </Suspense>

      {/* Klavyeyle gezen biri her sayfada sekiz sekmeyi geçmek zorunda
          kalmasın. Odaklanana kadar görünmez; odakta masthead'in üstüne
          oturur. */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[calc(env(safe-area-inset-top)+12px)] focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-base focus:font-semibold focus:text-on-primary"
      >
        {labels.skipToContent}
      </a>

      {/* ---- Masaüstü masthead ----
           Üst güvenli alan burada da eklenir; masaüstünde 0 döner, tablette
           tam ekran (standalone) açıldığında değil. */}
      <header className="chrome sticky top-0 z-30 hidden items-center gap-4 border-b px-5 pb-3.5 pt-[calc(env(safe-area-inset-top)+14px)] lg:flex xl:gap-6 xl:px-10">
        <Link href={L("/")} className="shrink-0" aria-label={labels.brandName}>
          <BrandLockup
            name={labels.brandName}
            tagline={labels.tagline}
            size={38}
            // Alt satır yalnızca çok geniş ekranda: dokuz sekmeyle birlikte
            // masthead 1536px altında sıkışıyor, marka adı zaten yeterli.
            taglineClassName="hidden 2xl:block"
          />
        </Link>

        {/* Her etiket degradesini KENDİ kutusunda çizer; şerit boyunca tek
            bir süpürme denendi ve istenmedi. Bulunulan sayfa dolgulu hap ve
            kalın ağırlıkla ayrışır, renkle değil.
            "Bugün" burada yok — logo zaten oraya götürüyor. */}
        <nav
          aria-label={labels.mainNav}
          className="flex min-w-0 gap-[2px] text-base xl:gap-[3px] xl:text-read"
        >
          {NAV_ITEMS.filter((item) => item.inMasthead).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={L(item.href)}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-[7px] transition-colors duration-150 xl:px-3.5",
                  item.wideOnly && "hidden xl:block",
                  /* Pasif sekmeler de KALIN: `font-medium` ile yazılınca
                     masthead soluk bir bağlantı şeridi gibi duruyordu ve
                     seçili sekme tek başına ağır kalıyordu. İkisi de kalın,
                     ayrım artık ağırlıkta değil zeminde ve mürekkepte. */
                  /* Sekmelerin TAMAMI kalın. Pasifler önce `font-medium`,
                     sonra `font-semibold` idi ve masthead yine soluk bir
                     bağlantı şeridi gibi duruyordu. Ayrım ağırlıkta değil
                     zeminde ve mürekkepte: seçili olan zemin alıyor. */
                  "font-bold",
                  active ? "bg-surface-elevated" : "hover:bg-surface",
                )}
              >
                {/* Gezinme etiketleri de maskesiz: 13-14 pikselde degrade
                    maske metni yumuşatıyor ve bu, sekme adları gibi sürekli
                    okunan metinlerde en çok görülen yer. */}
                <span>{labels.nav[item.href]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {searchTrigger}
          {themeToggle}
          {localeToggle}
          {signedIn ? (
            <Link
              href={L("/ayarlar")}
              title={username ?? labels.settings}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-[7px] text-base text-body transition-colors hover:border-line-strong hover:text-strong"
            >
              <span
                aria-hidden
                className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary-wash text-nano font-bold uppercase text-primary"
              >
                {(username ?? "?").slice(0, 2)}
              </span>
              <span className="max-w-28 truncate">
                {username ?? labels.settings}
              </span>
              <Gear weight="duotone" size={15} className="shrink-0" />
            </Link>
          ) : (
            <ButtonLink href={L("/giris")} variant="primary">
              {labels.signIn}
            </ButtonLink>
          )}
        </div>
      </header>

      {/* ---- Mobil başlık ----
           Üst dolgu güvenli alanı taşır: çentikli telefonda başlık durum
           çubuğunun altından değil, altındaki güvenli bandın içinden başlar. */}
      <header
        className={cn(
          /* Üstte 14px — masaüstü şeridiyle aynı. Kullanıcı "gerekirse
             üstten biraz boşluk bırak" dedi; sistem çubuğunun altına
             girmeyi bıraktıktan sonra da yazının tepeye yapışmaması için
             dört piksel daha ferahlık. */
          "chrome sticky top-0 z-30 flex items-center gap-2.5 border-b pb-2.5 pt-[calc(env(safe-area-inset-top)+14px)] lg:hidden",
          SAFE_X_18,
        )}
      >
        <Link
          href={L("/")}
          className="-my-1 flex items-center gap-2.5 py-1"
          aria-label={labels.brandName}
        >
          <BellMark size={32} />
          {/* DEGRADE MASKE YOK — METİN KESKİN OLSUN. `display-ink`
              `-webkit-background-clip: text` ile çiziyor: harfler bir maske
              hâline geliyor ve maskeli metin alt piksel yumuşatması ALAMIYOR,
              gri tonlamalı çiziliyor. Telefonda bu, çubuğun tamamının
              "hafif bulanık" okunmasının asıl sebebiydi — `backdrop-filter`
              kaldırıldıktan sonra da kalan buydu.

              Marka rengini bell işareti taşıyor (o bir SVG, maskeye ihtiyacı
              yok); yazı düz accent mürekkeple aynı kimliği veriyor. */}
          <BrandWord name={labels.brandName} className="text-lead" />
        </Link>
        {/* İki düğme, üç değil. Tema ve dil ayrı birer kutu olarak duruyordu;
            ikisi de "ortam" ayarı ve ikisi de tek bir ikonla ne yaptığını
            anlatmaya çalışıyordu (güneş mi şu anki tema mı, basınca gelecek
            olan mı?). İkisi de hesap menüsünün içine, adlarıyla yazılı
            seçenekler hâline geldi. Başlıkta içeriği değiştiren tek şey
            kalıyor: arama. */}
        <div className="ml-auto flex items-center gap-2">
          {searchTrigger}
          {accountMenu}
        </div>
      </header>

      {/* Alt şerit sabit durduğu için içerik onun yüksekliği kadar boşluk
          bırakır; mobilde ayrıca sekme çubuğu var. */}
      <main
        id="icerik"
        /* ODAK GERÇEKTEN BURAYA GELİR. `tabIndex={-1}` olmadan atlama
           bağlantısı yalnızca adresi `#icerik` yapıyordu: tarayıcı
           odaklanamayan bir hedefe odağı taşımıyor, `document.activeElement`
           `<body>`de kalıyor ve bir sonraki Tab okuyucuyu yine üst çubuğun
           ilk bağlantısına götürüyordu — yani "İçeriğe Geç" hiçbir şeyi
           atlamıyordu (WCAG 2.4.1). Negatif değer: fare/Tab sırasına
           girmez, yalnızca programla odaklanılır.

           Odak halkası basılmıyor (`outline-none`): burası bir denetim
           değil, bir varış noktası; kutu boyunca çerçeve çizmek okuyucuya
           "buraya tıklanır" diyor. Konumun nereye geldiğini `scroll-padding`
           zaten garantiliyor (globals.css). */
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-[1400px] flex-1 pt-4 outline-none lg:pt-6",
          CONTENT_GUTTER,
        )}
      >
        {children}
      </main>

      {/* Alt bilgi ana akışın parçası; sabit şerit ve mobil sekme çubuğu
          kadar boşluk kendi altında bırakır.

          MENÜ EKRANINDA alt bilginin dizin sütunları gizleniyor: o sayfa
          zaten menünün kendisi ve aynı bağlantıları ikonlu, açıklamalı
          satırlar hâlinde veriyor. Altında bir kez daha düz liste olarak
          tekrarlanınca sayfa iki katına çıkıyor ve okuyucu aynı dizini
          ikinci kez tarıyordu. Marka künyesi ve yasal satır kalıyor —
          onlar tekrar değil. `SiteFooter` sunucu bileşeni olduğu için
          pathname'i göremiyor, karar burada veriliyor. */}
      <div
        className={cn(
          /* pb: telefonda yalnızca sekme çubuğunu (64px + güvenli alan)
             temizlemesi yeter — şerit artık orada basılmıyor, 128px'lik
             eski dolgu sayfanın dibinde ölü boşluk bırakıyordu. */
          "mx-auto w-full max-w-[1400px] pb-24 pt-10 lg:pb-20",
          CONTENT_GUTTER,
          pathname === "/menu" && "[&_footer_nav]:hidden",
        )}
      >
        {footer}
      </div>

      {ticker}

      {/* ---- Mobil alt gezinme — 5 sekme, dokunma hedefi min 64px ---- */}
      <nav
        className={cn(
          /* ALT DOLGU TABAN DEĞERLİ. `viewport-fit=auto`ya geçtikten sonra
             (bkz. app/layout.tsx durum çubuğu notu) `env(safe-area-inset-bottom)`
             her cihazda 0 dönüyor ve şerit ekranın en alt kenarına yapışıyordu:
             etiketler tam kenarda kalınca telefonda "kesilmiş" görünüyor —
             iOS'un alttaki yüzen araç çubuğu ve ev göstergesi tam o bandın
             üstünde duruyor. `max()` ile taban 16px: env geri gelirse
             (cover'a dönülürse) büyük olan kazanır. */
          "chrome fixed inset-x-0 bottom-0 z-30 flex justify-between border-t pb-[max(env(safe-area-inset-bottom),16px)] lg:hidden",
          SAFE_X_12,
        )}
        aria-label={labels.bottomNav}
      >
        {bottomItems.map((item) => {
          const active = item.key === activeBottomKey;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={L(item.href)}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-[5px] px-1 pb-2.5 pt-3 text-nano tracking-[0.03em] transition-colors",
                active ? "font-semibold text-primary" : "text-muted",
              )}
            >
              <Icon weight="duotone" size={21} />
              <span className="truncate">{item.text}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
