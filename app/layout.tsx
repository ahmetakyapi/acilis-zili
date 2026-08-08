import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { getI18n, getTheme } from "@/lib/i18n";
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
const bodyFace = Schibsted_Grotesk({
  variable: "--font-body-face",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Açılış Zili — ABD Piyasa Takibi",
    template: "%s · Açılış Zili",
  },
  description:
    "ABD borsalarında bugün ne var: ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin tek ekranda — saatleriyle birlikte.",
  applicationName: "Açılış Zili",
  appleWebApp: {
    capable: true,
    title: "Açılış Zili",
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
    siteName: "Açılış Zili",
    locale: "tr_TR",
  },
  twitter: { card: "summary_large_image" },
  /* Uzun süre `index: false` idi ve bu bir geliştirme kalıntısıydı: site
     canlı ve rehber yazılarının amacı zaten okunmak. Anahtar tek yerde —
     lib/site.ts → INDEXABLE. */
  robots: INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070d16" },
  ],
};

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
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
