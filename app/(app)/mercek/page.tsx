import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { StoryCover } from "@/components/stories/StoryVisual";
import {
  EmptyState,
  FilterChip,
  Kicker,
  PageHeader,
  Panel,
  Skeleton,
} from "@/components/ui/primitives";
import { getStatus, getStories, getSymbolNames, type StoryIndexRow } from "@/lib/data";
import { getChartBars, getQuotes } from "@/lib/providers";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatEtDateLong } from "@/lib/utils";

/**
 * Mercek — arşivin vitrini.
 *
 * ÜÇ SORU. Buraya ilk kez giren biri üç şeyi bilmeden okumaya başlamıyor:
 * burada ne yazılıyor, nasıl yazılıyor, ne sıklıkla yazılıyor. Sayfa bu
 * yüzden bir açıklama bandıyla açılıyor — "Mercek" adı tek başına bunu
 * söylemiyordu ve liste, haber akışından ayırt edilemiyordu.
 *
 * KAPAK GÖRSELLERİ. Yazıların fotoğrafı yok ve olmayacak: haber fotoğrafı
 * telifli ve finans metnine çoğu zaman bir şey katmıyor. Kapaklar telifi
 * bizde olan iki gerçek malzemeden kuruluyor — yazının kahramanı şirketlerin
 * logoları ve o şirketin gerçek fiyat eğrisi. Yani kapak süs değil, yazının
 * konusunu ve piyasadaki karşılığını gösteren bir okuma.
 *
 * FİLTRE. Arşiv büyüdükçe "NVDA hakkında ne yazmıştık" sorusu doğuyor.
 * Sembol filtresi URL'de yaşıyor (?sembol=NVDA), sunucuda çözülüyor;
 * rehberdeki konu filtresiyle aynı desen, istemci JS'i yok.
 */

/** Kapakta ve kartlarda canlı fiyat gösterilen sembol sayısı sınırı. */
const QUOTE_LIMIT = 40;

export default async function StoriesPage(props: PageProps<"/mercek">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const symbolFilter =
    typeof search.sembol === "string"
      ? search.sembol.toUpperCase().slice(0, 12)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.stories.eyebrow}
        title={t.stories.title}
        subtitle={t.stories.subtitle}
      />

      <IntroBand t={t} />

      <Suspense key={symbolFilter ?? "all"} fallback={<BoardSkeleton />}>
        <StoryBoard locale={locale} t={t} symbolFilter={symbolFilter} />
      </Suspense>
    </div>
  );
}

/**
 * Açıklama bandı — ne, nasıl, ne sıklıkla.
 *
 * Veri beklemez, sayfayla birlikte anında gelir: bu sayfanın ilk işi kendini
 * tanıtmak, listeyi göstermek ikinci iş.
 */
function IntroBand({ t }: { t: Dictionary }) {
  const columns = [
    { title: t.stories.whatTitle, body: t.stories.whatBody },
    { title: t.stories.howTitle, body: t.stories.howBody },
    { title: t.stories.rhythmTitle, body: t.stories.rhythmBody },
  ];

  return (
    <Panel className="px-5 py-5 sm:px-6">
      <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
        {columns.map((column, index) => (
          <div
            key={column.title}
            className={cn(
              "flex flex-col gap-1.5",
              index > 0 && "sm:border-l sm:border-line sm:pl-6",
            )}
          >
            <p className="plate text-[10px] tracking-[0.09em] text-primary">
              {column.title}
            </p>
            <p className="text-[13px] leading-[20px] text-body">{column.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-line pt-3.5 text-[12.5px] text-muted">
        {t.stories.bridge}
        <Link
          href="/haberler"
          className="font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {t.nav.news}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/rehber"
          className="font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {t.nav.guide}
        </Link>
      </p>
    </Panel>
  );
}

async function StoryBoard({
  locale,
  t,
  symbolFilter,
}: {
  locale: Locale;
  t: Dictionary;
  symbolFilter: string | null;
}) {
  const all = await getStories(locale);

  if (all.length === 0) {
    return (
      <Panel>
        <EmptyState title={t.stories.empty} hint={t.stories.emptyHint} />
      </Panel>
    );
  }

  const rows = symbolFilter
    ? all.filter((story) => story.symbols?.includes(symbolFilter))
    : all;

  /* Filtre çipleri arşivin TAMAMINDAN türer, süzülmüş listeden değil: bir
     sembole süzdükten sonra diğerlerine geçebilmek gerekiyor. */
  const tally = new Map<string, number>();
  for (const story of all) {
    for (const symbol of story.symbols ?? []) {
      tally.set(symbol, (tally.get(symbol) ?? 0) + 1);
    }
  }
  const chips = [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);

  const shownSymbols = [
    ...new Set(rows.flatMap((story) => story.symbols ?? [])),
  ].slice(0, QUOTE_LIMIT);

  const status = await getStatus();
  const lead = rows[0] ?? null;
  const leadPrimary = lead?.symbols?.[0] ?? null;

  /* Üç sorgu paralel: künye (logo + ad), canlı fiyatlar ve manşetin eğrisi.
     Eğri yalnızca MANŞET için çekiliyor — her kart için bar çekmek sağlayıcı
     kotasını yazı sayısıyla çarpardı. */
  const [meta, quotes, leadBars] = await Promise.all([
    getSymbolNames(shownSymbols),
    getQuotes(shownSymbols, status),
    leadPrimary
      ? getChartBars(leadPrimary, "1M", status)
      : Promise.resolve(null),
  ]);

  const quoteOf = (symbol: string | null | undefined) => {
    if (!symbol || !quotes.ok) return null;
    const quote = quotes.data[symbol];
    return quote ? { symbol, changePct: quote.changePct } : null;
  };

  return (
    <div className="flex flex-col gap-6">
      {chips.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="plate mr-0.5 text-[10px] tracking-[0.09em]">
            {t.stories.filterLabel}
          </span>
          <FilterChip href="/mercek" active={!symbolFilter}>
            {t.stories.filterAll}
          </FilterChip>
          {chips.map(([symbol, count]) => (
            <FilterChip
              key={symbol}
              href={symbol === symbolFilter ? "/mercek" : `/mercek?sembol=${symbol}`}
              active={symbol === symbolFilter}
            >
              <span className="numeral">{symbol}</span>
              <span className="ml-1.5 opacity-70">{count}</span>
            </FilterChip>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title={t.stories.emptyFilter}
            action={
              <Link
                href="/mercek"
                className="text-[12.5px] font-semibold text-primary"
              >
                {t.stories.filterAll}
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          {lead && (
            <LeadStory
              story={lead}
              meta={meta}
              quote={quoteOf(leadPrimary)}
              points={
                leadBars?.ok ? leadBars.data.map((bar) => ({ value: bar.close })) : undefined
              }
              locale={locale}
              t={t}
            />
          )}

          {rows.length > 1 && (
            <div className="flex flex-col gap-3">
              <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
                {t.stories.archive}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.slice(1).map((story) => (
                  <StoryCard
                    key={story.slug}
                    story={story}
                    meta={meta}
                    quote={quoteOf(story.symbols?.[0])}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Manşet — arşivin en yeni yazısı.
 *
 * İki kolon: solda okunacak metin, sağda kapak. Kapak geniş ekranda yanda
 * durur çünkü manşet başlığı dar kolonda üç satıra kırılıyor; mobilde
 * metnin ÜSTÜNE geçer, orada kapak bir giriş görseli gibi okunuyor.
 */
function LeadStory({
  story,
  meta,
  quote,
  points,
  locale,
  t,
}: {
  story: StoryIndexRow;
  meta: Awaited<ReturnType<typeof getSymbolNames>>;
  quote: { symbol: string; changePct: number | null } | null;
  points?: { value: number }[];
  locale: Locale;
  t: Dictionary;
}) {
  const symbols = story.symbols ?? [];

  return (
    <Link href={`/mercek/${story.slug}`} prefetch className="min-w-0">
      <section className="panel-hover overflow-hidden rounded-2xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] transition-colors">
        <div className="flex flex-col lg:flex-row-reverse lg:items-stretch">
          {symbols.length > 0 && (
            <StoryCover
              symbols={symbols}
              meta={meta}
              quote={quote}
              points={points}
              locale={locale}
              height={132}
              logoSize={48}
              className="border-b lg:w-[320px] lg:shrink-0 lg:border-b-0 lg:border-l"
            />
          )}

          <div className="min-w-0 flex-1 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Kicker tone="primary">{t.stories.latest}</Kicker>
              <span className="numeral ml-auto text-[11.5px] text-muted">
                {formatEtDateLong(story.eventDate, locale)}
              </span>
            </div>

            <h2 className="display-ink mt-3 w-fit text-[24px] font-bold leading-[1.15] tracking-[-0.03em] sm:text-[30px]">
              {story.title}
            </h2>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-[25px] text-body">
              {story.dek}
            </p>

            <p className="mt-4 flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-[12.5px] font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight weight="bold" size={13} />
              {story.readMinutes && (
                <span className="numeral ml-auto font-normal text-muted">
                  {story.readMinutes} {t.stories.readMinutes}
                </span>
              )}
            </p>
          </div>
        </div>
      </section>
    </Link>
  );
}

/**
 * Arşiv kartı — kapak bandı, künye, başlık, giriş ve semboller.
 *
 * Sembol çipleri artık ölü metin değil: yanlarında o şirketin bugünkü
 * değişimi duruyor. Yazı geçmişte kalmış bir olayı anlatıyor, çip ise o
 * şirketin bugün nerede olduğunu söylüyor — ikisi birlikte "sonra ne oldu"
 * sorusunun ilk cevabı.
 */
function StoryCard({
  story,
  meta,
  quote,
  locale,
  t,
}: {
  story: StoryIndexRow;
  meta: Awaited<ReturnType<typeof getSymbolNames>>;
  quote: { symbol: string; changePct: number | null } | null;
  locale: Locale;
  t: Dictionary;
}) {
  const symbols = story.symbols ?? [];

  return (
    <Link href={`/mercek/${story.slug}`} prefetch={false} className="min-w-0">
      <Panel className="panel-hover flex h-full flex-col">
        {symbols.length > 0 ? (
          <StoryCover
            symbols={symbols}
            meta={meta}
            quote={quote}
            locale={locale}
          />
        ) : (
          <span className="block h-1.5 bg-[linear-gradient(90deg,var(--primary-wash),var(--primary-tint))]" />
        )}

        <div className="flex flex-1 flex-col p-5">
          <p className="numeral flex items-center gap-1.5 text-[11.5px] text-muted">
            {formatEtDateLong(story.eventDate, locale)}
            {story.readMinutes && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {story.readMinutes} {t.stories.readMinutes}
                </span>
              </>
            )}
          </p>

          <h3 className="display-ink display-ink-tight mt-1.5 w-fit text-[17px] font-bold leading-[1.2] tracking-[-0.025em]">
            {story.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-[13px] leading-[20px] text-body">
            {story.dek}
          </p>

          {/* Kapak zaten birincil sembolün canlı okumasını taşıyor; çipler
              yazının geri kalan kadrosunu sayar. Aynı yüzde iki kez
              yazılmasın diye çiplerde değişim tekrar edilmiyor. */}
          {symbols.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
              {symbols.slice(0, 4).map((symbol) => (
                <SymbolPill key={symbol} symbol={symbol} locale={locale} />
              ))}
              {symbols.length > 4 && (
                <span className="numeral inline-flex items-center rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10.5px] font-bold text-muted">
                  +{symbols.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </Panel>
    </Link>
  );
}

function SymbolPill({ symbol }: { symbol: string; locale: Locale }) {
  return (
    <span className="numeral inline-flex items-center rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10.5px] font-bold text-body">
      {symbol}
    </span>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64 rounded-full" />
      <Skeleton className="h-[236px] w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[280px] w-full rounded-(--radius-xl)" />
        ))}
      </div>
    </div>
  );
}
