"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellMark, BrandWord } from "@/components/brand/BellMark";
import type { Locale } from "@/lib/i18n/config";
import { stripLocale, withLocale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { MastheadNav, type MastheadMoreItem, type MastheadStripItem } from "./MastheadNav";
import { RouteProgress } from "./RouteProgress";
import { NAV_ITEMS, isActive } from "./nav-items";

export type ShellLabels = {
  brandName: string;
  nav: Record<string, string>;
  navShort: Record<string, string>;
  /** Masaüstü şeridinin sekmeleri, dizi sırasıyla. */
  strip: MastheadStripItem[];
  /** "Daha Fazla" panelinin sabit satırları. */
  moreItems: MastheadMoreItem[];
  more: string;
  mainNav: string;
  bottomNav: string;
  skipToContent: string;
  loading: string;
};

type AppShellProps = {
  labels: ShellLabels;
  /** Sunucunun çözdüğü dil — bağlantılar bununla önek alır (aşağıda). */
  locale: Locale;
  searchTrigger: React.ReactNode;
  /** İki başlığın da sağ ucu: hesap + tema + dil tek panelde. */
  accountMenu: React.ReactNode;
  ticker: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
};

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

/**
 * İçerik çerçevesi — main, alt bilgi ve masthead AYNI sabitten okur. Başlık
 * bir dönem tam genişlikte kendi dolgusunu taşıyordu ve 1400 pikselden geniş
 * ekranda logo içeriğin sol kenarından, hesap düğmesi sağ kenarından
 * kopuyordu: başlık sayfanın değil pencerenin hizasında duruyordu. Ölçüldü:
 * 1024-1920 arasında logo ve hesap düğmesi main'in iç kenarlarıyla 0 piksel
 * farkla hizalı.
 */
const CONTENT_FRAME = "mx-auto w-full max-w-[1400px]";

/** İçerik kanalı — 18/24/40px dolgu, çentik daha genişse o kazanır. */
const CONTENT_GUTTER = [
  "pl-[max(env(safe-area-inset-left),18px)] pr-[max(env(safe-area-inset-right),18px)]",
  "sm:pl-[max(env(safe-area-inset-left),24px)] sm:pr-[max(env(safe-area-inset-right),24px)]",
  "xl:pl-[max(env(safe-area-inset-left),40px)] xl:pr-[max(env(safe-area-inset-right),40px)]",
].join(" ");

export function AppShell({
  labels,
  locale,
  searchTrigger,
  accountMenu,
  ticker,
  footer,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  /* Kabuktaki bağlantılar dili taşır: en çok tıklanan yerler bunlar ve
     önekSİZ bir bağlantı proxy'de fazladan bir yönlendirmeye mal oluyor.

     DİL PROP'TAN, ADRESTEN DEĞİL. Bir dönem `useLocaleHref` ile adresten
     okunuyordu ama `/en/...` proxy'de yeniden yazılıyor ve sunucu çiziminde
     `usePathname()` yeniden yazılmış yolu (`/piyasalar`) veriyor: canlı /en
     HTML'inde kabuğun bütün bağlantıları öneksiz geliyordu (curl ile
     görüldü). Hidrasyon öznitelik farkını düzeltmediği için bağlantılar
     tarayıcıda da öyle kalıyordu. */
  const L = (path: string) => withLocale(path, locale);

  /* Alt çubuk: Piyasa · Bilanço · Mercek · Menü.
     Giriş yapmamış kullanıcıda Favoriler sekmesi ÇIKMAZ SOKAKTI — sayfa onu
     doğrudan /giris'e atıyor, yani dört sekmeden biri o kullanıcı için içerik
     değil bir duvardı. Yuvaya bir süre "Giriş Yap" yazıldı ve bu daha da kötü
     çalıştı: gezinme çubuğunun ÜÇÜ ekran, BİRİ formdu; göz her sayfada oraya
     takılıyor ve sekme bir davet gibi durduğu için kapatılamıyordu.

     Yuvada bir süre TAKVİM durdu ve o da doğru seçim değildi: takvimin
     anlattığı iki şey (bugünün olayları, haftaya bakış) zaten ana sayfanın
     iki bölümü, yani sekme ikinci bir kapıydı. Şimdi orada MERCEK var —
     sitenin kendi yazdığı uzun metinler, başka hiçbir yerde olmayan içerik
     ve mobilde başka türlü yalnızca Menü'den açılıyordu. Giriş bağlantısı
     kaybolmuyor: başlıktaki hesap menüsünde, ait olduğu yerde duruyor.

     YUVA GİRİŞ DURUMUNA BAKMIYOR. Bir süre giriş yapan kullanıcıda
     Favoriler'e dönüyordu ama mobilde dört sekmenin biri kişisel bir listeye
     gidiyordu ve o liste zaten iki başlıktaki hesap panelinden ve Menü
     sekmesinden açılıyor. Mercek ise sitenin kendi yazdığı tek
     içerik türü ve mobilde başka türlü yalnızca Menü'nün altında kalıyordu:
     sekme onu herkes için görünür yapıyor. */
  const bottomItems = NAV_ITEMS.filter((item) => item.inBottomBar).map((item) => ({
    key: item.href,
    href: item.href,
    icon: item.icon,
    text: labels.navShort[item.href] ?? labels.nav[item.href],
  }));

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
  /* Karşılaştırma DİLDEN ARINMIŞ yolla: İngilizce tarafta adres `/en`
     olduğu için ham eşitlik tutmuyor ve ana sayfada işaret "Menü"ye
     düşüyordu — okuyucu ana sayfadayken alt çubuk ona "menüdesin"
     diyordu. Aynı tuzağın masthead sürümü `isActive()` içinde yazılı. */
  const barePath = stripLocale(pathname);
  const activeBottomKey =
    barePath === "/" ? null : (matchedBottom?.key ?? "/menu");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Gezinme göstergesi kabuğun EN ÜSTÜNDE: her rota bu kabuğun altında
          yaşıyor, tek bir yerde durması yeter. `useSearchParams` okuduğu için
          Suspense şart — yoksa altındaki bütün rotalar statik ön çizimden
          düşerdi. */}
      <Suspense fallback={null}>
        <RouteProgress label={labels.loading} />
      </Suspense>

      {/* Klavyeyle gezen biri her sayfada yedi sekmeyi geçmek zorunda
          kalmasın. Odaklanana kadar görünmez; odakta masthead'in üstüne
          oturur. */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[calc(env(safe-area-inset-top)+12px)] focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-base focus:font-semibold focus:text-on-primary"
      >
        {labels.skipToContent}
      </a>

      {/* ---- Masaüstü masthead ----
           ÜÇ SÜTUN, TEK SATIR: marka · şerit · araçlar. Eski başlık altı
           ayrı parçaydı (künyeli marka, sekmeler, "Menü" hapı, tema, dil,
           oturum çipi ya da Giriş düğmesi) ve beş farklı kontrol boyu, dört
           farklı köşe yarıçapı taşıyordu. Şimdi sağda iki kare var ve
           ikisi de mobil başlıktaki AYNI iki bileşen: arama ve hesap paneli.
           Tema, dil, Favoriler ve giriş o panelde.

           Dikey dolgu yok: 68 içerik + 1 hairline = 69, `--app-bar-h`.
           Sekmeler başlığın tam boyunu kaplıyor ki konum işareti
           hairline'ın üstüne otursun. Üst güvenli alan masaüstünde 0 döner,
           tablette tam ekran (standalone) açıldığında değil. */}
      <header className="chrome sticky top-0 z-30 hidden min-h-[var(--app-bar-h)] border-b pt-[env(safe-area-inset-top)] lg:flex">
        <div
          className={cn(
            CONTENT_FRAME,
            CONTENT_GUTTER,
            "grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-x-4 xl:gap-x-6",
          )}
        >
          {/* KÜNYE SATIRI YOK. "ABD Piyasa Takibi" 9,5 piksellik bir alt
              satırdı ve yalnızca 1536 üstünde görünüyordu: aynı başlık
              genişliğe göre iki farklı marka bloğu çiziyordu. Tanıtımı sayfa
              başlıkları ve arama motoru künyesi zaten yapıyor. */}
          <Link
            href={L("/")}
            aria-label={labels.brandName}
            aria-current={barePath === "/" ? "page" : undefined}
            className="flex items-center gap-2.5 self-center"
          >
            <BellMark size={38} />
            <BrandWord name={labels.brandName} className="text-title leading-none" />
          </Link>

          <MastheadNav
            locale={locale}
            label={labels.mainNav}
            moreLabel={labels.more}
            strip={labels.strip}
            more={labels.moreItems}
          />

          <div className="flex h-full items-center gap-2">
            {searchTrigger}
            {accountMenu}
          </div>
        </div>
      </header>

      {/* ---- Mobil başlık ----
           Üst dolgu güvenli alanı taşır: çentikli telefonda başlık durum
           çubuğunun altından değil, altındaki güvenli bandın içinden başlar. */}
      <header
        className={cn(
          /* Üstte 14px. Kullanıcı "gerekirse
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
            kalıyor: arama. Masaüstü başlık da artık aynı iki düğmeyi taşıyor. */}
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
          CONTENT_FRAME,
          "flex-1 pt-4 outline-none lg:pt-6",
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
          CONTENT_FRAME,
          "pb-24 pt-10 lg:pb-20",
          CONTENT_GUTTER,
          barePath === "/menu" && "[&_footer_nav]:hidden",
        )}
      >
        {footer}
      </div>

      {ticker}

      {/* ---- Mobil alt gezinme — 4 sekme, dokunma hedefi min 64px ---- */}
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
