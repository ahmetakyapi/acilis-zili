import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BellReport } from "@/components/report/BellReport";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { loadBellReport } from "@/lib/report-data";

/* Kişisel ekran — dizine girmez (sayfa + NOINDEX_PATHS). */
export const generateMetadata = pageMetadata({
  path: "/raporum",
  robots: { index: false, follow: false },
  tr: { title: "Zil Raporu", description: "Açılış Zili'ndeki kaydının kişisel özeti." },
  en: { title: "Bell Report", description: "A personal summary of your record on Opening Bell." },
});

/**
 * ZİL RAPORU — yalnız sahibine. Okuma `lib/report-data.ts`, ekranın saf
 * kararları `lib/report-summary.ts`, düzen `components/report/BellReport.tsx`
 * (25 Ekim karne düzeni; neden kaydırmalı anlatıdan vazgeçildiği orada).
 *
 * Portföy rakamı vitrinle AYNI hesaptan gelir — profilde görünen getiri ile
 * burada görünen asla ayrışmaz (aynı sayı aynı kaynaktan). Tutar yok.
 */
export default async function BellReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/raporum");

  const { locale, t } = await getI18n();
  const report = await loadBellReport(session.user.id, locale, t.profile.showcase.otherSector);
  if (!report) redirect("/giris?devam=/raporum");

  return (
    <MotionExperience className={polish.page}>
      <BellReport report={report} locale={locale} t={t} />
    </MotionExperience>
  );
}
