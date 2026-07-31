import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getI18n, getTheme } from "@/lib/i18n";
import { THEME_COOKIE } from "@/lib/i18n/config";
import "./globals.css";

/**
 * Tuzak: next/font `variable` adı @theme token adıyla aynı olursa CSS'te
 * dairesel referans oluşur ve sessizce çöker. Bu yüzden `-face` soneki.
 */
const bodyFace = Schibsted_Grotesk({
  variable: "--font-body-face",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const monoFace = IBM_Plex_Mono({
  variable: "--font-mono-face",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
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
    { media: "(prefers-color-scheme: light)", color: "#f2ece0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1622" },
  ],
};

/**
 * Tema cookie'de yoksa sistem tercihini React'ten önce yazar.
 * <html suppressHydrationWarning> bu kasıtlı sunucu/istemci farkı için şart.
 */
const ANTI_FOUC = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark)/);if(!m){var d=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',d);}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ locale }, theme] = await Promise.all([getI18n(), getTheme()]);

  return (
    <html
      lang={locale}
      data-theme={theme}
      suppressHydrationWarning
      className={`${bodyFace.variable} ${monoFace.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FOUC }} />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
