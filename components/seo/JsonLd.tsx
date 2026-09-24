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
          /* PNG, SVG değil: Google'ın logo yönergesi yalnızca raster
             biçimleri kabul ediyor; svg adresli logo sessizce yok sayılıyor. */
          logo: `${SITE_URL}/icon-512.png`,
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
             adres üretmiyor, dizin üretiyor. Parametre `q`: dizin sayfası
             onu okuyor (`search.q`). Bir dönem burada `ara` yazıyordu ve
             arama kutusundan gelen her ziyaret süzülmemiş dizine iniyordu. */
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}${withLocale("/sirketler", locale)}?q={search_term_string}`,
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
  modified,
}: {
  headline: string;
  description?: string | null;
  /** Dil öneksiz yol; önek burada ekleniyor. */
  path: string;
  locale: Locale;
  published?: Date | string | null;
  modified?: Date | string | null;
}) {
  const url = `${SITE_URL}${withLocale(path, locale)}`;
  const name = locale === "en" ? "Opening Bell" : "Açılış Zili";
  const iso = (d: Date | string) => (typeof d === "string" ? d : d.toISOString());
  return (
    <Block
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline,
        ...(description ? { description } : {}),
        inLanguage: locale,
        mainEntityOfPage: url,
        ...(published ? { datePublished: iso(published) } : {}),
        ...(modified ? { dateModified: iso(modified) } : {}),
        /* Yazar bir kişi değil, yayın: metinler editoryal ekipten değil
           sitenin kendi rutininden çıkıyor ve bir kişi adı uydurmak
           yanıltıcı olurdu. */
        author: { "@type": "Organization", name, url: `${SITE_URL}${withLocale("/", locale)}` },
        publisher: {
          "@type": "Organization",
          name,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
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
        /* Ana sayfa ilk halka: kırıntı sonuçta "site › bölüm › yazı" diye
           okunuyor, bölümle başlayan yol sitenin adını hiç taşımıyordu. */
        itemListElement: [
          { name: locale === "en" ? "Opening Bell" : "Açılış Zili", path: "/" },
          ...items,
        ].map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${SITE_URL}${withLocale(item.path, locale)}`,
        })),
      }}
    />
  );
}
