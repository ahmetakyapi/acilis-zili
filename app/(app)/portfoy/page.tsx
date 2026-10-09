import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortfolioScreen } from "@/components/portfolio/PortfolioScreen";
import { pageMetadata } from "@/lib/page-meta";
import { isValidSymbol } from "@/lib/utils";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (gerekçe /favoriler'deki notun aynısı). */
export const generateMetadata = pageMetadata({
  path: "/portfoy",
  robots: { index: false, follow: false },
  tr: { title: "Portföy", description: "Pozisyonlarının dolar ve lira kâr/zararı." },
  en: { title: "Portfolio", description: "Dollar and lira profit and loss on your positions." },
});

/** Ekranın tamamı `components/portfolio/PortfolioScreen.tsx`te; sayfa yalnızca oturumu soruyor. */
export default async function PortfolioPage(props: PageProps<"/portfoy">) {
  /* `?ekle=NVDA` — hisse sayfasındaki "Portföye Ekle" (9 Ekim). Ekleme
     penceresi o sembol seçili açılıyor; okuyucu sembolü yeniden aramıyor.
     Biçimi geçmeyen değer yok sayılıyor. Girişsiz okuyucu girişten sonra
     AYNI adrese dönüyor (parametre `devam`ın içinde). */
  const [session, search] = await Promise.all([auth(), props.searchParams]);
  const raw = typeof search.ekle === "string" ? search.ekle.trim().toUpperCase() : "";
  const preset = isValidSymbol(raw) ? raw : null;
  if (!session?.user?.id) {
    redirect(`/giris?devam=${encodeURIComponent(preset ? `/portfoy?ekle=${preset}` : "/portfoy")}`);
  }
  return <PortfolioScreen userId={session.user.id} preset={preset} />;
}
