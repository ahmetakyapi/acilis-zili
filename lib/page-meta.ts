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

/**
 * Olmayan kaydın künyesi — DİZİNE GİRMESİN.
 *
 * `notFound()` doğru ekranı gösteriyor ama HTTP durumu 200 kalıyor:
 * `app/(app)/loading.tsx` tüm rotaları bir yükleme sınırıyla sarıyor, yani
 * yanıt sayfa çözülmeden akmaya başlıyor ve durum kodu o an yazılıyor.
 * Sınır bilinçli bir tercih (gezinme geri bildirimi) ve bir 404 uğruna
 * kaldırılmadı — ölçüldü, `loading.tsx` kaldırıldığında durum 404'e dönüyor,
 * sayfa içinde ya da `generateMetadata` içinde `notFound()` çağırmak fark
 * ettirmiyor.
 *
 * Arama motoru tarafındaki asıl zarar durum kodu değil, ADRESİN DİZİNE
 * GİRMESİ. Haber satırları 90 günde budanıyor (cron), yani bu adresler
 * düzenli olarak ölüyor. `noindex` o zararı doğrudan kesiyor: Google boş
 * sayfayı ne dizine alır ne de "yumuşak 404" diye siteye yazar.
 */
export function missingMetadata(locale: string): Metadata {
  return {
    title: locale === "en" ? "Not found" : "Bulunamadı",
    robots: { index: false, follow: false },
  };
}

/**
 * Arama sonucuna sığan açıklama.
 *
 * Dinamik sayfaların künyesi yazının giriş cümlesinden geliyor ve o cümle
 * ekran için yazılmış, arama sonucu için değil: mercek yazılarında 236
 * karaktere kadar çıkıyor. Google açıklamayı ~155-160 karakterde kesiyor ve
 * kesme noktası kelimenin ortasına düşebiliyor; paylaşım kartlarında da
 * aynısı oluyor.
 *
 * Kesme KELİME SINIRINDA: son boşluktan geriye gidiliyor ve üç nokta
 * konuyor. Metin zaten sığıyorsa hiç dokunulmuyor — kısa bir cümlenin
 * sonuna üç nokta koymak, devamı varmış gibi göstermek olurdu.
 */
const META_DESCRIPTION_LIMIT = 158;

export function metaDescription(
  text: string | null | undefined,
): string | undefined {
  const clean = text?.trim();
  if (!clean) return undefined;
  if (clean.length <= META_DESCRIPTION_LIMIT) return clean;

  const cut = clean.slice(0, META_DESCRIPTION_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  /* Boşluksuz bir dizge gelirse (tek uzun kelime) sert kesmek zorundayız;
     yoksa son kelime tamamen düşer. */
  const trimmed = (lastSpace > META_DESCRIPTION_LIMIT * 0.6
    ? cut.slice(0, lastSpace)
    : cut
  ).replace(/[\s.,;:—–-]+$/, "");
  return `${trimmed}…`;
}
