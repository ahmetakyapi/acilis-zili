import { SITE_URL } from "@/lib/site";
import { withLocale } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/config";

/**
 * Yapılandırılmış veri — arama motoruna makine okunur künye.
 *
 * Depoda tek bir `application/ld+json` bloğu yoktu. Yazılar, analizler ve
 * haber detayları zengin sonuç için gereken her alanı (başlık, spot, tarih,
 * şirket, görsel) zaten elinde tutuyor ama arama motoruna hiçbirini bu
 * biçimde vermiyordu; kırıntı yolu da sonuçlarda görünmüyordu.
 *
 * Sunucuda basılıyor, istemci JS'i gerekmiyor. `dangerouslySetInnerHTML`
 * burada zorunlu — script içeriği React tarafından kaçırılırsa JSON bozulur.
 * Değerler bizim ürettiğimiz verilerden geliyor ama yine de `<` kaçırılıyor:
 * bir başlıkta `</script>` geçerse blok erken kapanırdı.
 */
function Block({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Kök künye — kuruluş, site ve site içi arama. */
export function SiteJsonLd({ locale }: { locale: Locale }) {
  const home = `${SITE_URL}${withLocale("/", locale)}`;
  const name = locale === "en" ? "Opening Bell" : "Açılış Zili";

  return (
    <>
      <Block
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name,
          url: home,
          logo: `${SITE_URL}/icon.svg`,
        }}
      />
      <Block
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name,
          url: home,
          inLanguage: locale,
          /* Site içi arama: sonuç ekranı `/sirketler` dizini — palet bir
             adres üretmiyor, dizin üretiyor. */
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}${withLocale("/sirketler", locale)}?ara={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />
    </>
  );
}

/** Uzun metin sayfaları — mercek, rehber, bilanço analizi. */
export function ArticleJsonLd({
  headline,
  description,
  path,
  locale,
  published,
  image,
}: {
  headline: string;
  description?: string | null;
  /** Dil öneksiz yol; önek burada ekleniyor. */
  path: string;
  locale: Locale;
  published?: Date | string | null;
  image?: string | null;
}) {
  const url = `${SITE_URL}${withLocale(path, locale)}`;
  return (
    <Block
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline,
        ...(description ? { description } : {}),
        inLanguage: locale,
        mainEntityOfPage: url,
        ...(published
          ? {
              datePublished:
                typeof published === "string"
                  ? published
                  : published.toISOString(),
            }
          : {}),
        ...(image ? { image } : {}),
        publisher: {
          "@type": "Organization",
          name: locale === "en" ? "Opening Bell" : "Açılış Zili",
        },
      }}
    />
  );
}

/** Kırıntı yolu — sonuçlarda sayfanın nereye ait olduğunu gösterir. */
export function BreadcrumbJsonLd({
  items,
  locale,
}: {
  /** Dil öneksiz yollar. */
  items: { name: string; path: string }[];
  locale: Locale;
}) {
  return (
    <Block
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${SITE_URL}${withLocale(item.path, locale)}`,
        })),
      }}
    />
  );
}
