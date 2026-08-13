import type { Metadata } from "next";
import { getLocale } from "./i18n";
import { pageAlternates } from "./site";

/**
 * Sayfa künyesi — İKİ DİLLİ ve kendi adresine bağlı.
 *
 * İKİ SORUNU BİRDEN ÇÖZÜYOR:
 *
 * 1. Künye tek dilliydi. On bir sayfa `export const metadata` ile sabit
 *    Türkçe başlık ve açıklama veriyordu; İngilizce arayüzde sekme başlığı,
 *    arama sonucu ve paylaşım kartı Türkçe çıkıyordu. Sabit bir nesne dili
 *    okuyamaz — `generateMetadata` okuyabilir.
 *
 * 2. Canonical ve hreflang yoktu. Kök `alternates` yalnızca RSS taşıyordu ve
 *    sayfalar kendi `alternates`ini vermediği için hiçbirinde canonical ya da
 *    "bu sayfanın öteki dildeki karşılığı şu" bilgisi basılmıyordu. Arama
 *    motoru iki dili birbirinin çevirisi olarak değil, ayrı (hatta mükerrer)
 *    sayfalar olarak görüyordu.
 *
 * Kullanım — sayfa dosyasında:
 *
 *   export const generateMetadata = pageMetadata({
 *     path: "/piyasalar",
 *     tr: { title: "Piyasalar", description: "…" },
 *     en: { title: "Markets", description: "…" },
 *   });
 *
 * `path` DİLSİZ yazılır; canonical ve hreflang o yoldan türetilir.
 */
export type PageCopy = {
  title: string;
  description: string;
};

export function pageMetadata({
  path,
  tr,
  en,
  robots,
  absoluteTitle,
}: {
  path: string;
  tr: PageCopy;
  en: PageCopy;
  robots?: Metadata["robots"];
  /** Başlık şablonundan MUAF — ana sayfa gibi markayı zaten taşıyanlar için. */
  absoluteTitle?: boolean;
}): () => Promise<Metadata> {
  return async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const copy = locale === "en" ? en : tr;
    return {
      /* Kök şablon her başlığa "· Marka" ekliyor. Ana sayfanın başlığı zaten
         markayla başladığı için sonuç "Açılış Zili — … · Açılış Zili"
         oluyordu; `absolute` şablonu atlıyor. */
      title: absoluteTitle ? { absolute: copy.title } : copy.title,
      description: copy.description,
      alternates: pageAlternates(path, locale),
      ...(robots ? { robots } : {}),
    };
  };
}
