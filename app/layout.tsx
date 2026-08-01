import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import { getI18n, getTheme } from "@/lib/i18n";
import "./globals.css";

/**
 * Tek aile: Source Serif 4 — başlık, gövde, sayı, arayüz kromu hepsi.
 * Gazete baskısında sans-serif UI kromu yoktur; serif kromun kendisidir.
 * İtalik gerçek italiktir (sentetik eğim değil), 400 ağırlıkta yüklenir.
 *
 * Tuzak: next/font `variable` adı @theme token adıyla aynı olursa CSS'te
 * dairesel referans oluşur ve sessizce çöker. Bu yüzden `-face` soneki.
 */
const serifFace = Source_Serif_4({
  variable: "--font-serif-face",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Açılış Zili — ABD piyasa takibi",
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
  openGraph: {
    type: "website",
    siteName: "Açılış Zili",
    title: "Açılış Zili — Zil çalmadan önce bugünü gör",
    description:
      "Ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin — saatleriyle birlikte.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1622" },
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
      className={`${serifFace.variable} h-full`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
