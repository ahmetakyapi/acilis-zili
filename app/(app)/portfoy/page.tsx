import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortfolioScreen } from "@/components/portfolio/PortfolioScreen";
import { pageMetadata } from "@/lib/page-meta";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (gerekçe /favoriler'deki notun aynısı). */
export const generateMetadata = pageMetadata({
  path: "/portfoy",
  robots: { index: false, follow: false },
  tr: { title: "Portföy", description: "Pozisyonlarının dolar ve lira kâr/zararı." },
  en: { title: "Portfolio", description: "Dollar and lira profit and loss on your positions." },
});

/** Ekranın tamamı `components/portfolio/PortfolioScreen.tsx`te; sayfa yalnızca oturumu soruyor. */
export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/portfoy");
  return <PortfolioScreen userId={session.user.id} />;
}
