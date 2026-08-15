import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, readingMinutes } from "@/components/article/ArticleBody";
import { LogoTile } from "@/components/ui/primitives";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { getStories, getStoryBySlug, getSymbolNames } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { formatEtDateLong, safeExternalUrl } from "@/lib/utils";

/**
 * Mercek yazısı — okuma sayfası.
 *
 * Künye kasten gövdenin ALTINDA: kaynak listesi ve sorumluluk notu okuyanı
 * metne girmeden karşılamamalı, ama yazının bir parçası olarak da mutlaka
 * bulunmalı. Bu metinler isimsiz kaynaklara dayanan haberlerden derleniyor;
 * neye dayandığını saklamak seçenek değil.
 */

export async function generateMetadata(props: PageProps<"/mercek/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const story = await getStoryBySlug(slug, locale);
  if (!story) return missingMetadata(locale);
  return {
    title: story.title,
    description: story.dek,
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    alternates: pageAlternates(`/mercek/${slug}`, locale),
    /* `og:type` kökten "website" miras alınıyordu: uzun okuma metinleri
       sosyal ağlara ve okuyucu uygulamalarına "bu bir web sitesi" diye
       tanıtılıyor, yayın tarihi hiçbir yere çıkmıyordu. */
    openGraph: {
      type: "article",
      publishedTime: story.publishedAt?.toISOString(),
      authors: ["Açılış Zili"],
    },
  };
}

/**
 * Yazıda geçen şirketler — logolu kartlar.
 *
 * Düz sembol rozetleri yerine logo + ad: bir okuyucu "SNDK" ile "NBIS"in
 * hangi şirket olduğunu bilmek zorunda değil. Logolar sağlayıcının şirket
 * profilinden geliyor; gelmezse sembolün ilk iki harfi kutuda durur.
 */
async function StorySymbols({ symbols }: { symbols: string[] }) {
  const meta = await getSymbolNames(symbols);

  return (
    <div className="flex flex-wrap gap-2">
      {symbols.map((symbol) => {
        const logo = meta[symbol]?.logoUrl;
        const name = meta[symbol]?.name;
        return (
          <Link
            key={symbol}
            href={`/hisse/${symbol}`}
            className="panel-hover flex min-h-10 items-center gap-2 rounded-md border border-line bg-surface py-1.5 pl-1.5 pr-3 transition-colors"
          >
            <LogoTile symbol={symbol} logoUrl={logo} size="sm" />
            <span className="min-w-0">
              <span className="numeral block text-small font-bold leading-tight text-strong">
                {symbol}
              </span>
              {name && (
                <span className="block max-w-32 truncate text-nano leading-tight text-muted">
                  {name}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Yazının altındaki arşiv köprüsü.
 *
 * Bir dosyayı bitiren okuyucunun tek çıkışı geri tuşuydu; arşivde ikinci bir
 * yazıya geçmenin yolu yoktu. Üç komşu kayıt burada duruyor — kart değil
 * satır, çünkü sayfanın işi hâlâ okumak, yeni bir vitrin açmak değil.
 */
async function MoreStories({
  slug,
  locale,
  t,
}: {
  slug: string;
  locale: Locale;
  t: Dictionary;
}) {
  const rows = (await getStories(locale, 8))
    .filter((story) => story.slug !== slug)
    .slice(0, 3);

  if (rows.length === 0) return null;

  return (
    <nav className="flex flex-col gap-3 border-t border-line pt-6">
      <p className="plate text-nano tracking-[0.09em]">
        {t.stories.moreStories}
      </p>
      <ul className="flex flex-col">
        {rows.map((story) => (
          <li key={story.slug}>
            <Link
              href={`/mercek/${story.slug}`}
              className="-mx-3 flex flex-col gap-0.5 rounded-(--radius-lg) px-3 py-3 transition-colors hover:bg-primary-tint sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="numeral shrink-0 text-tiny text-muted sm:w-[124px]">
                {formatEtDateLong(story.eventDate, locale)}
              </span>
              <span className="min-w-0 text-read font-semibold leading-snug text-strong">
                {story.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/mercek"
        className="-my-2 inline-flex w-fit min-h-8 items-center py-2 text-small font-semibold text-primary transition-colors hover:text-primary-hover"
      >
        {t.stories.backToList}
      </Link>
    </nav>
  );
}

export default async function StoryPage(props: PageProps<"/mercek/[slug]">) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const story = await getStoryBySlug(slug, locale);

  /* Olmayan yazı 404 DÖNER — ekran `not-found.tsx` dosyasında. */
  if (!story) notFound();

  const minutes = story.readMinutes ?? readingMinutes(story.bodyMd);
  const sources = story.sources ?? [];

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <Link
        href="/mercek"
        className="-my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.stories.backToList}
      </Link>

      <header className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-tiny">
          <span className="plate text-nano tracking-[0.09em] text-primary">
            {t.stories.eyebrow}
          </span>
          <span className="numeral text-muted">
            {formatEtDateLong(story.eventDate, locale)}
          </span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <span className="numeral text-muted">
            {minutes} {t.stories.readMinutes}
          </span>
        </p>

        <h1 className="display-ink w-fit text-subdisplay font-bold leading-[1.12] tracking-[-0.035em] sm:text-display">
          {story.title}
        </h1>
        <p className="text-lead leading-[27px] text-soft">{story.dek}</p>

        {/* Çeviri henüz yoksa orijinal gösterilir — ama bunu söyleyerek.
            Rutin iki dili art arda yazdığı için bu not kısa ömürlüdür. */}
        {story.locale !== locale && (
          <p className="w-fit rounded-full border border-line bg-surface-sunken px-3.5 py-1.5 text-small text-muted">
            {t.stories.fallbackNote}
          </p>
        )}

        {story.symbols && story.symbols.length > 0 && (
          <StorySymbols symbols={story.symbols} />
        )}
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleJsonLd
        headline={story.title}
        description={story.dek}
        path={`/mercek/${story.slug}`}
        locale={locale}
        published={story.publishedAt}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.nav.stories, path: "/mercek" },
          { name: story.title, path: `/mercek/${story.slug}` },
        ]}
      />

      {/* GÖVDE KENDİ DİLİNİ SÖYLÜYOR. Çevirisi olmayan yazı orijinal
          diliyle gösteriliyor (üstteki not bunu yazıyor) ama `lang`
          verilmediği için sayfalarca Türkçe metin `<html lang="en">`
          altında duruyordu: ekran okuyucu onu İngilizce fonetikle okuyor,
          tarayıcının "bu sayfayı çevir" önerisi de devreye girmiyordu. */}
      <div lang={story.locale}>
        <ArticleBody markdown={story.bodyMd} locale={story.locale} />
      </div>

      {/* ---- Künye ---- */}
      <footer className="mt-2 flex flex-col gap-3 border-t border-line pt-5">
        {sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="plate text-nano tracking-[0.09em]">
              {t.stories.sources}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-small">
              {sources.map((source) => {
                /* Adres /api/mercek üzerinden geliyor ve zod'un `.url()`
                   doğrulaması `javascript:` şemasını da geçiriyor; süzgeç
                   burada. Geçmeyen kaynak bağlantısız künye olarak kalır. */
                const href = safeExternalUrl(source.url);
                return (
                  <li key={source.label}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary transition-colors hover:text-primary-hover"
                      >
                        {source.label}
                      </a>
                    ) : (
                      <span className="text-body">{source.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-tiny leading-relaxed text-muted">
          {t.stories.disclaimer}
        </p>
      </footer>

      <MoreStories slug={slug} locale={locale} t={t} />
    </article>
  );
}
