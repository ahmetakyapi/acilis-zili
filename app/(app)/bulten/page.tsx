import { permanentRedirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/page-meta";
import { BRIEF_DATE, briefHref, type BriefPeriod } from "@/lib/brief";
import { BriefArchiveView } from "./BriefArchiveView";

/* Künye yoktu; arşivin tamamı ana sayfanın başlığı ve açıklamasıyla
   paylaşılıyordu. Adres `?tur=` taşısa da canonical sorgusuz kalıyor —
   `pageAlternates` onu `path`ten kuruyor. */
export const generateMetadata = pageMetadata({
  path: "/bulten",
  tr: {
    title: "Bülten",
    description: "Günlük ve haftalık piyasa bülteninin arşivi.",
  },
  en: {
    title: "Brief",
    description: "Archive of the daily and weekly market brief.",
  },
});

export default async function BriefArchivePage(props: PageProps<"/bulten">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();
  const period: BriefPeriod = search.tur === "haftalik" ? "weekly" : "daily";

  /* ESKİ SORGULU ADRES KALICI OLARAK SAYININ ADRESİNE GİDER. Besleme
     okuyucularında, paylaşılmış bağlantılarda ve arama motorunun
     belleğinde `/bulten?tarih=` biçimi duruyor; 308 onları kırmadan yeni
     adrese taşıyor ve biriken bağlantı değerini de oraya aktarıyor. */
  if (typeof search.tarih === "string" && BRIEF_DATE.test(search.tarih)) {
    permanentRedirect(withLocale(briefHref(search.tarih, period), locale));
  }

  return <BriefArchiveView period={period} locale={locale} t={t} />;
}
