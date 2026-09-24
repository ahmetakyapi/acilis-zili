import { permanentRedirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";

/* `/bulten/haftalik` bir sayının yolunun yarısı; tek başına bir ekran
   değil. Haftalık arşive gider — yazılabilecek en makul adres bu. */
export default async function WeeklyArchiveRedirect() {
  const { locale } = await getI18n();
  permanentRedirect(withLocale("/bulten?tur=haftalik", locale));
}
