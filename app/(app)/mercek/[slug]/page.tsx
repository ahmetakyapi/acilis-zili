import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, readingMinutes } from "@/components/article/ArticleBody";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getStories, getStoryBySlug, getSymbolNames } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
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
  if (!story) return {};
  return { title: story.title, description: story.dek };
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
            className="panel-hover flex min-h-10 items-center gap-2 rounded-[11px] border border-line bg-surface py-1.5 pl-1.5 pr-3 transition-colors"
          >
            {logo ? (
              <Image
                src={logo}
                alt=""
                width={26}
                height={26}
                className="size-[26px] shrink-0 rounded-md bg-white object-contain"
              />
            ) : (
              <span
                aria-hidden
                className="numeral flex size-[26px] shrink-0 items-center justify-center rounded-md bg-primary-wash text-[9px] font-bold text-primary"
              >
                {symbol.slice(0, 2)}
              </span>
            )}
            <span className="min-w-0">
              <span className="numeral block text-[12px] font-bold leading-tight text-strong">
                {symbol}
              </span>
              {name && (
                <span className="block max-w-32 truncate text-[10.5px] leading-tight text-muted">
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
      <p className="plate text-[10px] tracking-[0.09em]">
        {t.stories.moreStories}
      </p>
      <ul className="flex flex-col">
        {rows.map((story) => (
          <li key={story.slug}>
            <Link
              href={`/mercek/${story.slug}`}
              className="-mx-3 flex flex-col gap-0.5 rounded-(--radius-lg) px-3 py-3 transition-colors hover:bg-primary-tint sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="numeral shrink-0 text-[11.5px] text-muted sm:w-[124px]">
                {formatEtDateLong(story.eventDate, locale)}
              </span>
              <span className="min-w-0 text-[14.5px] font-semibold leading-snug text-strong">
                {story.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/mercek"
        className="-my-2 inline-flex w-fit min-h-8 items-center py-2 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
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

  if (!story) {
    return (
      <Panel>
        <EmptyState
          title={t.stories.notFound}
          hint={t.stories.notFoundHint}
          action={
            <Link
              href="/mercek"
              className="text-[12.5px] font-semibold text-primary"
            >
              {t.stories.backToList}
            </Link>
          }
        />
      </Panel>
    );
  }

  const minutes = story.readMinutes ?? readingMinutes(story.bodyMd);
  const sources = story.sources ?? [];

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <Link
        href="/mercek"
        className="-my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-[12.5px] font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.stories.backToList}
      </Link>

      <header className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
          <span className="plate text-[10px] tracking-[0.09em] text-primary">
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

        <h1 className="display-ink w-fit text-[30px] font-bold leading-[1.12] tracking-[-0.035em] sm:text-[40px]">
          {story.title}
        </h1>
        <p className="text-[17px] leading-[27px] text-soft">{story.dek}</p>

        {/* Çeviri henüz yoksa orijinal gösterilir — ama bunu söyleyerek.
            Rutin iki dili art arda yazdığı için bu not kısa ömürlüdür. */}
        {story.locale !== locale && (
          <p className="w-fit rounded-full border border-line bg-surface-sunken px-3.5 py-1.5 text-[12px] text-muted">
            {t.stories.fallbackNote}
          </p>
        )}

        {story.symbols && story.symbols.length > 0 && (
          <StorySymbols symbols={story.symbols} />
        )}
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleBody markdown={story.bodyMd} />

      {/* ---- Künye ---- */}
      <footer className="mt-2 flex flex-col gap-3 border-t border-line pt-5">
        {sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="plate text-[10px] tracking-[0.09em]">
              {t.stories.sources}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
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
        <p className="text-[11.5px] leading-relaxed text-muted">
          {t.stories.disclaimer}
        </p>
      </footer>

      <MoreStories slug={slug} locale={locale} t={t} />
    </article>
  );
}
