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

/* ==========================================================================
   BİLİNÇLİ OLARAK YAZILMAYAN İKİ TİP — bir dahaki denemede buraya bakılsın.

   `Event` (bilanço günü): Google'ın etkinlik yönergesi yalnızca insanların
   katılabileceği gerçek dünya etkinliklerini kapsıyor (konser, konferans,
   çevrim içi yayın) ve "kupon, satış, tanıtım" gibi etkinlik olmayan
   tarihleri açıkça dışlıyor. Bir şirketin sonuçlarını yayımlaması bir basın
   bülteni; katılım yok, bilet yok, yer yok. İşaretlemek yönerge ihlali ve
   el ile işlem riski. Bilanço tarihinin makine okunur hâli zaten `.ics`
   olarak var (`/api/takvim`).

   `FAQPage`: Google Ağustos 2023'ten beri SSS zengin sonucunu yalnızca
   yetkili devlet ve sağlık sitelerine gösteriyor; ayrıca işaretleme ancak
   sayfada GÖRÜNEN soru-cevap çiftleri varsa geçerli. Sitede böyle bir blok
   yok (rehber yazıları anlatı, soru listesi değil). Olmayan bir SSS'yi
   künyeye yazmak görünmeyen içerik işaretlemek olurdu.
   ========================================================================== */

/** Kurucu künyesi — sitenin arkasındaki GERÇEK kişi. Yazar DEĞİL (aşağıda). */
const FOUNDER = {
  "@type": "Person",
  name: "Ahmet Akyapı",
  url: "https://ahmetakyapi.com",
} as const;

/** Açık kaynak depo — kuruluşun `sameAs`i ve Hakkında sayfasının bağlantısı. */
export const REPO_URL = "https://github.com/ahmetakyapi/acilis-zili";

/** Markanın dile göre adı; künyelerin hepsi aynı adı yazsın. */
function brandName(locale: Locale): string {
  return locale === "en" ? "Opening Bell" : "Açılış Zili";
}

/** Öteki dildeki adı — `alternateName`. */
function otherBrandName(locale: Locale): string {
  return brandName(locale === "en" ? "tr" : "en");
}

/**
 * KURULUŞUN TEK KİMLİĞİ. İki dil iki ayrı ad yazıyor ("Açılış Zili",
 * "Opening Bell") ve kimliksiz iki düğüm arama motoruna iki ayrı kuruluş
 * gibi okunuyordu; makalelerin yayıncısı da her seferinde yeni, bağsız bir
 * düğümdü. Aynı `@id` + öteki adın `alternateName` olarak yazılması hepsini
 * tek varlığa bağlıyor. Adres dilsiz: kuruluş dile göre değişmiyor.
 */
const ORG_ID = `${SITE_URL}/#organization`;

/** Yayıncı düğümü — Article ve NewsArticle aynı nesneyi taşıyor. */
function publisherNode(locale: Locale) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: brandName(locale),
    url: `${SITE_URL}${withLocale("/", locale)}`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
  };
}

/** Kök künye — kuruluş, site ve site içi arama. */
export function SiteJsonLd({ locale }: { locale: Locale }) {
  const home = `${SITE_URL}${withLocale("/", locale)}`;
  const name = brandName(locale);

  return (
    <>
      <Block
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": ORG_ID,
          name,
          alternateName: otherBrandName(locale),
          url: home,
          /* PNG, SVG değil: Google'ın logo yönergesi yalnızca raster
             biçimleri kabul ediyor; svg adresli logo sessizce yok sayılıyor. */
          logo: `${SITE_URL}/icon-512.png`,
          /* Kim işletiyor sorusunun makine okunur cevabı: Hakkında sayfası
             aynı bilgiyi okuyucuya yazıyor (`/hakkinda`). Kurucu gerçek bir
             kişi; içerikler onun adına YAZILMIYOR, o yüzden aşağıdaki
             makale künyelerinde yazar kişi değil kuruluş. */
          founder: FOUNDER,
          sameAs: [REPO_URL],
        }}
      />
      <Block
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name,
          /* Google'ın site adı seçimi `alternateName`i de okuyor; marka iki
             dilde iki ad taşıdığı için öteki adı burada. */
          alternateName: otherBrandName(locale),
          url: home,
          inLanguage: locale,
          publisher: { "@id": ORG_ID },
          /* Site içi arama: sonuç ekranı `/sirketler` dizini — palet bir
             adres üretmiyor, dizin üretiyor. Parametre `q`: dizin sayfası
             onu okuyor (`search.q`). Bir dönem burada `ara` yazıyordu ve
             arama kutusundan gelen her ziyaret süzülmemiş dizine iniyordu.
             Google site bağlantıları arama kutusunu Kasım 2024'te kaldırdı;
             blok yine de doğru bir adresi anlatıyor ve öteki arama
             motorları okuyor, o yüzden duruyor. */
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

/** Uzun metin sayfaları — mercek, rehber, bülten, bilanço ve teknik analiz. */
export function ArticleJsonLd({
  headline,
  description,
  path,
  locale,
  published,
  modified,
  type = "Article",
}: {
  /**
   * `NewsArticle` yalnızca TARİHE BAĞLI yayın için: bülten sayısı bir günün
   * haberidir. Mercek bir mekanizmayı, rehber bir kavramı anlatıyor; onlar
   * zamansız metin, `Article`.
   */
  type?: "Article" | "NewsArticle";
  headline: string;
  description?: string | null;
  /** Dil öneksiz yol; önek burada ekleniyor. */
  path: string;
  locale: Locale;
  published?: Date | string | null;
  modified?: Date | string | null;
}) {
  const url = `${SITE_URL}${withLocale(path, locale)}`;
  const iso = (d: Date | string) => (typeof d === "string" ? d : d.toISOString());
  return (
    <Block
      data={{
        "@context": "https://schema.org",
        "@type": type,
        /* Google başlığı 110 karakterde kesiyor; fazlası "headline too
           long" uyarısı. Kesme kelime sınırında. */
        headline: fitHeadline(headline),
        ...(description ? { description } : {}),
        inLanguage: locale,
        mainEntityOfPage: url,
        ...(published ? { datePublished: iso(published) } : {}),
        ...(modified ? { dateModified: iso(modified) } : {}),
        /* Yazar bir kişi değil, yayın: metinler editoryal ekipten değil
           sitenin zamanlanmış Claude rutinlerinden çıkıyor, sayıları site
           hesaplıyor, sahibi panelden düzeltiyor. Bir kişi adı uydurmak
           yanıltıcı olurdu; sahibini yazar yapmak da — metni o yazmıyor.
           Üretim yolunun açık anlatımı `/hakkinda`da. */
        author: publisherNode(locale),
        publisher: publisherNode(locale),
      }}
    />
  );
}

/** Google'ın `headline` sınırı (karakter). */
const HEADLINE_LIMIT = 110;

function fitHeadline(text: string): string {
  if (text.length <= HEADLINE_LIMIT) return text;
  const cut = text.slice(0, HEADLINE_LIMIT - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > HEADLINE_LIMIT / 2 ? cut.slice(0, at) : cut).trimEnd()}…`;
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
          { name: brandName(locale), path: "/" },
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

/**
 * Sözlük terimi — `DefinedTerm`, bağlı olduğu `DefinedTermSet` ile.
 *
 * Tanım sayfasının arama sonucundaki karşılığı "bu sayfa bir terimin
 * tanımıdır" bilgisi; `Article` burada yanlış tür olurdu (yazı değil, künye).
 * Küme sözlüğün dizin sayfası: aynı terimin iki dildeki sayfası iki ayrı
 * kümeye (TR ve EN sözlük) ait.
 */
export function DefinedTermJsonLd({
  name,
  description,
  path,
  setName,
  setPath,
  locale,
}: {
  name: string;
  description: string;
  /** Dil öneksiz yol; önek burada ekleniyor. */
  path: string;
  setName: string;
  setPath: string;
  locale: Locale;
}) {
  return (
    <Block
      data={{
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name,
        description,
        inLanguage: locale,
        url: `${SITE_URL}${withLocale(path, locale)}`,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: setName,
          url: `${SITE_URL}${withLocale(setPath, locale)}`,
        },
      }}
    />
  );
}

/**
 * Şirket künyesi — hisse sayfası (28 Eylül).
 *
 * `Corporation` ve `tickerSymbol`: arama motoru sayfayı bir şirketle ve
 * borsa koduyla eşleyebilsin. Yalnızca ELİMİZDE OLAN alanlar: sağlayıcının
 * verdiği resmî site (`sameAs`, şeması süzülmüş) ve logo; kuruluş yılı,
 * genel merkez gibi alanlar uydurulmuyor. Fiyat da YOK — künye önbelleğe
 * giriyor ve eski bir fiyatı güncel gibi taşırdı (generateMetadata ile aynı
 * gerekçe).
 */
export function CorporationJsonLd({
  name,
  symbol,
  exchange,
  description,
  website,
  logo,
  path,
  locale,
}: {
  name: string;
  symbol: string;
  /** "NASDAQ", "NYSE"… — `tickerSymbol` önekine giriyor; yoksa yalnız kod. */
  exchange?: string | null;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  /** Dil öneksiz yol. */
  path: string;
  locale: Locale;
}) {
  const url = `${SITE_URL}${withLocale(path, locale)}`;
  const absoluteLogo = logo ? (logo.startsWith("/") ? `${SITE_URL}${logo}` : logo) : null;
  return (
    <Block
      data={{
        "@context": "https://schema.org",
        "@type": "Corporation",
        name,
        tickerSymbol: exchange ? `${exchange} ${symbol}` : symbol,
        url,
        mainEntityOfPage: url,
        ...(description ? { description } : {}),
        ...(website ? { sameAs: [website] } : {}),
        ...(absoluteLogo ? { logo: absoluteLogo } : {}),
      }}
    />
  );
}
