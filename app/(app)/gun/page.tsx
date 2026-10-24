import { PosterArchive } from "@/components/day-poster/PosterArchive";
import { getI18n } from "@/lib/i18n";
import { daySignatureEn, daySignatureTr } from "@/lib/i18n/dictionaries/day-signature";
import { pageMetadata } from "@/lib/page-meta";

/**
 * GÜNÜN POSTERİ — `/gun` (24 Ekim). En son seansın posteri ve arşiv; her
 * kart o günün posterine (`/gun/[tarih]`) açılıyor. Gövde
 * `components/day-poster/PosterArchive.tsx`.
 *
 * AD TEK (25 Ekim): menü, sayfa başlığı ve sekme adı aynı ("Günün
 * Posteri"); ilk sürümde menü "Günün Posteri", sayfa "Posterler" diyordu.
 */
export const generateMetadata = pageMetadata({
  path: "/gun",
  tr: { title: daySignatureTr.poster.title, description: daySignatureTr.archive.subtitle },
  en: { title: daySignatureEn.poster.title, description: daySignatureEn.archive.subtitle },
});

export default async function PosterArchivePage() {
  const { locale, t } = await getI18n();
  return <PosterArchive locale={locale} t={t} />;
}
