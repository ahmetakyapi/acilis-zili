import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { AnalysisScreen } from "@/components/portfolio/analysis/AnalysisScreen";
import { pageMetadata } from "@/lib/page-meta";
import { SECTOR_FUND_LIST } from "@/lib/portfolio-analysis";
import { SCENARIO_WEIGHTS } from "@/lib/portfolio-risk";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (/portfoy'un notunun aynısı). */
export const generateMetadata = pageMetadata({
  path: "/portfoy/analiz",
  robots: { index: false, follow: false },
  tr: { title: "Portföy Analizi", description: "Portföyünün sektör dağılımı, yoğunlaşma, oynaklık, beta ve kur etkisi; S&P 500 ile karşılaştırmalı." },
  en: { title: "Portfolio Analysis", description: "Your portfolio's sector mix, concentration, volatility, beta and currency effect, compared with the S&P 500." },
});

/**
 * Ekranın tamamı components/portfolio/analysis/AnalysisScreen.tsx'te
 * (neden ayrı rota: oradaki yorum). Sayfa oturumu ve senaryonun adres
 * seçimini (`?fon=XLV&agirlik=10`) okuyor. Adres herkesin yazabildiği bir
 * girdi: zod yalnız bilinen on bir sektör fonunu ve dört ağırlığı geçirir,
 * geri kalan her şey (dizi, "abc", "%50", "xlv ") yok sayılır ve ekran
 * varsayılan seçime düşer — hata sayfası değil.
 */
const FUND_SYMBOLS = SECTOR_FUND_LIST.map((fund) => fund.symbol);
const ScenarioQuery = z.object({
  fon: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => FUND_SYMBOLS.includes(value))
    .nullable()
    .catch(null),
  agirlik: z.coerce
    .number()
    .refine((value) => (SCENARIO_WEIGHTS as readonly number[]).includes(value))
    .nullable()
    .catch(null),
});

export default async function PortfolioAnalysisPage(props: PageProps<"/portfoy/analiz">) {
  const [session, search] = await Promise.all([auth(), props.searchParams]);
  if (!session?.user?.id) redirect(`/giris?devam=${encodeURIComponent("/portfoy/analiz")}`);
  const query = ScenarioQuery.parse({ fon: search.fon ?? null, agirlik: search.agirlik ?? null });
  return <AnalysisScreen source={{ userId: session.user.id }} fund={query.fon} weight={query.agirlik} />;
}
