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
    title: "ABD Borsası Günlük Bülteni ve Arşivi",
    description: "ABD borsasının günlük ve haftalık bülteni: açılış öncesi özet, endeksler, öne çıkan veriler ve bilançolar; geçmiş sayıların tamamı arşivde.",
  },
  en: {
    title: "Daily US Market Brief and Archive",
    description: "The daily and weekly US market brief: a pre-open summary of indices, key data and earnings, with every past issue in the archive.",
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
