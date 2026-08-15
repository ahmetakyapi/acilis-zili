import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteJsonLd } from "@/components/seo/JsonLd";
import { getI18n, getTheme } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { INDEXABLE, SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * Tuzak: next/font `variable` adı @theme token adıyla aynı olursa CSS'te
 * dairesel referans oluşur ve sessizce çöker. Bu yüzden `-face` soneki.
 */
/**
 * Tek aile — Schibsted Grotesk. Manşetten kicker'a kadar her rol bu ailenin
 * ağırlık basamaklarıyla ayrışır; ikinci bir aile yok. SAYILAR DA aynı aile:
 * gövdede açık `tnum` sütunları hizalar, ayrı bir mono yüklenmez.
 *
 * Önce Archivo vardı. Haber-editoryal kökenli bu grotesk sıkı başlıkta daha
 * karakterli, 400'de gövde metni olarak daha sessiz; ekosistemde Mimio da
 * aynı aileye geçmişti (`~/dev-starter/knowledge/themes/mimio.md`).
 *
 * 800 de yükleniyor: manşet ve geri sayım 700'de yeterince ayrışmıyordu.
 *
 * Tuzak (yukarıdaki not): `variable` adı @theme token adıyla aynı olamaz.
 */
/* `weight` VERİLMİYOR — aile değişken (variable) ve ağırlık ekseni 400-900.
   Bir dönem `weight: ["400","500","600","700","800"]` yazıyordu; ölçüldü,
   üretilen dosya sayısını ve boyutunu DEĞİŞTİRMİYOR: next/font değişken
   sürüm varken onu çekiyor ve build çıktısı iki dosyada kalıyor (latin,
   latin-ext · 20 KB + 46 KB). Liste yalnızca "beş ayrı ağırlık iniyor" gibi
   okunuyordu, o yüzden kaldırıldı. Tailwind'in font-medium/semibold/bold
   sınıfları ekseni kullanıyor, görsel çıktı aynı. */
const bodyFace = Schibsted_Grotesk({
  variable: "--font-body-face",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/**
 * Kök künye DİLE GÖRE üretilir.
 *
 * Sabit bir nesne dili okuyamıyordu: başlık şablonu ("%s · Açılış Zili"),
 * açıklama ve `openGraph.locale` her istemcide Türkçeydi. İngilizce bir
 * sayfanın sekmesinde "Markets · Açılış Zili" yazıyor, paylaşım kartı
 * `tr_TR` diyordu. Şablon artık markanın o dildeki adını kullanıyor.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const brand = t.brand.name;

  return {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${brand} — ${t.brand.marketTagline}`,
    template: `%s · ${brand}`,
  },
  description: t.brand.description,
  applicationName: brand,
  appleWebApp: {
    capable: true,
    title: brand,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  /* Burada BAŞLIK VE AÇIKLAMA YOK — bilerek.
     İkisi sabit yazılıyken her sayfanın paylaşım künyesi aynı çıkıyordu:
     WhatsApp'a bir bilanço analizi linki atınca da "Zil çalmadan önce
     bugünü gör" görünüyordu, çünkü alt sayfalar yalnızca `title` ve
     `description` veriyor, `openGraph.*` vermiyor ve Next üst katmandakini
     miras alıyor. Boş bırakılınca Next og:title'ı sayfanın kendi
     başlığından, og:description'ı kendi açıklamasından türetiyor. */
  openGraph: {
    type: "website",
    siteName: brand,
    locale: INTL_LOCALE[locale].replace("-", "_"),
  },
  twitter: { card: "summary_large_image" },
  /* Uzun süre `index: false` idi ve bu bir geliştirme kalıntısıydı: site
     canlı ve rehber yazılarının amacı zaten okunmak. Anahtar tek yerde —
     lib/site.ts → INDEXABLE. */
  robots: INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false },
  /* `types` ile besleme keşfedilebilir oluyor: okuyucular sayfayı bu
     etiketten buluyor, adresi elle yazmak zorunda kalmıyorlar.

     CANONICAL BURADA YOK, bilerek. Bir süre `canonical: "/"` yazıyordu ve
     alt sayfalar `alternates` vermediği için Next bu değeri onlara MİRAS
     bırakıyordu: her hisse, her analiz, her rehber yazısı arama motoruna
     "asıl adresim ana sayfa" diyordu. Yani sitenin tamamı tek bir sayfa
     olarak dizine giriyor, alt sayfaların hiçbiri kendi başına
     sıralanmıyordu — sitemap'te listelenmiş olmalarına rağmen.

     Ana sayfanın kendi canonical'ı `app/(app)/page.tsx` içinde duruyor;
     bir sayfanın canonical'ı ancak o sayfada yazılabilir. */
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
  };
}

/**
 * Tarayıcı çubuğunun rengi — ÜRÜNÜN temasından, işletim sisteminden değil.
 *
 * `themeColor` iki değeri `prefers-color-scheme` medya sorgusuna bağlıyordu.
 * Oysa bu üründe tema next-themes değil `az-theme` çerezi + `data-theme` ile
 * belirleniyor ve varsayılan AÇIK. İşletim sistemi koyu ayarlı ama çerezi
 * olmayan ziyaretçi — yani mobilde ilk açılışların çoğu — açık temalı bir
 * sayfayı koyu bir tarayıcı çubuğuyla görüyordu: sayfanın üstünde ürünle
 * uyumsuz bir bant. Tersi de oluyordu.
 *
 * Renkler `app/globals.css` içindeki `--page-bg` değerleri; iki yerde
 * yaşadıkları için değiştirilirse ikisi birlikte değişmeli.
 */
const PAGE_BG = { light: "#f7f9fb", dark: "#070d16" } as const;

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: PAGE_BG[theme === "dark" ? "dark" : "light"],
  };
}

/**
 * Varsayılan tema açık: cookie yoksa sunucu light basar, script gerekmez.
 * <html suppressHydrationWarning> — ThemeToggle data-theme'i DOM'a yazar.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ locale }, theme] = await Promise.all([getI18n(), getTheme()]);

  return (
    <html
      lang={locale}
      data-theme={theme}
      suppressHydrationWarning
      className={`${bodyFace.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        {/* Kuruluş + site künyesi; sayfa bazlı künyeler kendi rotalarında. */}
        <SiteJsonLd locale={locale} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
