import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { BrandPlate } from "@/components/stories/StoryVisual";
import {
  EmptyState,
  FilterChip,
  Kicker,
  PageHeader,
  Panel,
  Skeleton,
} from "@/components/ui/primitives";
import { getStatus, getStories, getSymbolNames, type StoryIndexRow } from "@/lib/data";
import { getChartBars } from "@/lib/providers";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";

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
/** "Olaydan bugüne" getirisi hesaplanan farklı sembol sayısı. */
const CURVE_LIMIT = 12;

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

      <IntroLine t={t} />

      <Suspense key={symbolFilter ?? "all"} fallback={<BoardSkeleton />}>
        <StoryBoard locale={locale} t={t} symbolFilter={symbolFilter} />
      </Suspense>
    </div>
  );
}

/**
 * Sayfanın kendini tanıttığı satır — ne, nasıl, ne sıklıkla.
 *
 * ÖNCE BİR KARTTI ve sayfanın en üstünde duruyordu: ekranda ilk karşılaşılan
 * yüzey manşet değil bir açıklama kutusu oluyordu, dikkat de oraya
 * dağılıyordu. Oysa bu metnin işi yol göstermek, sahneyi almak değil.
 *
 * Artık kutu yok: başlığın hemen altında üç kısa madde, nokta ayraçlı tek
 * bir sessiz satır. Bilgi duruyor, ağırlığı kalkıyor — manşet ilk sırada.
 */
function IntroLine({ t }: { t: Dictionary }) {
  const items = [
    { title: t.stories.whatTitle, body: t.stories.whatShort },
    { title: t.stories.howTitle, body: t.stories.howShort },
    { title: t.stories.rhythmTitle, body: t.stories.rhythmShort },
  ];

  return (
    <div className="-mt-1 flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px] leading-[18px] text-muted">
        {items.map((item, index) => (
          <li key={item.title} className="flex items-center gap-2.5">
            {index > 0 && (
              <span aria-hidden className="text-line-strong">
                ·
              </span>
            )}
            <span>
              <span className="font-semibold text-body">{item.title}:</span>{" "}
              {item.body}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
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
    </div>
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

  /* "Olaydan bugüne" getirisi için bir yıllık günlük barlar: her yazının
     BİRİNCİL sembolü, tekil küme ve sınırlı sayıda. Aynı sembol birkaç
     yazıda geçiyor (MU dört yazıda), o yüzden tekilleştirme gerçek bir
     tasarruf. Günlük barın önbelleği 12 saat ve veritabanına yazılıyor. */
  const curveSymbols = [
    ...new Set(
      rows
        .map((story) => story.symbols?.[0])
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  ].slice(0, CURVE_LIMIT);

  const [meta, ...barResults] = await Promise.all([
    getSymbolNames(shownSymbols),
    ...curveSymbols.map((symbol) => getChartBars(symbol, "1Y", status)),
  ]);

  const seriesOf = new Map<string, { time: number; close: number }[]>();
  curveSymbols.forEach((symbol, index) => {
    const bars = barResults[index];
    if (bars?.ok && bars.data.length > 1) {
      seriesOf.set(
        symbol,
        bars.data.map((bar) => ({ time: bar.time, close: bar.close })),
      );
    }
  });

  /* Olay gününden bugüne getiri: o güne ait (ya da ondan sonraki ilk) günlük
     kapanış ile son kapanış arasındaki fark. Olay barların başladığı tarihten
     eskiyse ya da seri yoksa sayı hiç yazılmaz — uydurulmuş bir taban
     üzerinden yüzde üretmektense boş bırakmak doğru. */
  const sinceEventOf = (
    symbol: string | null | undefined,
    eventDate: string,
  ): number | null => {
    if (!symbol) return null;
    const series = seriesOf.get(symbol);
    if (!series || series.length < 2) return null;
    const eventTs = Date.parse(`${eventDate}T00:00:00Z`) / 1000;
    const at = series.find((point) => point.time >= eventTs);
    const last = series[series.length - 1];
    if (!at || !last || at.close === 0 || at.time === last.time) return null;
    return ((last.close - at.close) / at.close) * 100;
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
              sinceEvent={sinceEventOf(lead.symbols?.[0], lead.eventDate)}
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
                    sinceEvent={sinceEventOf(story.symbols?.[0], story.eventDate)}
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
  sinceEvent,
  locale,
  t,
}: {
  story: StoryIndexRow;
  meta: Awaited<ReturnType<typeof getSymbolNames>>;
  sinceEvent: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const symbols = story.symbols ?? [];

  return (
    <Link href={`/mercek/${story.slug}`} prefetch className="min-w-0">
      <section className="panel-hover overflow-hidden rounded-2xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] p-5 transition-colors sm:p-7">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Kicker tone="primary">{t.stories.latest}</Kicker>
          <span className="numeral ml-auto text-[11.5px] text-muted">
            {formatEtDateLong(story.eventDate, locale)}
          </span>
        </div>

        <h2 className="display-ink mt-3 w-fit max-w-[22ch] text-[26px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px]">
          {story.title}
        </h2>
        <p className="mt-3.5 max-w-[62ch] text-[15px] leading-[25px] text-body">
          {story.dek}
        </p>

        {/* Marka plakası metnin ALTINDA ve tam genişlikte: sağ kolonda
            duran kapak, başlığı dar bir sütuna sıkıştırıyordu ve manşetin
            en güçlü öğesi başlıktır. */}
        {symbols.length > 0 && (
          <div className="mt-5 inline-flex w-fit max-w-full rounded-(--radius-lg) border border-primary-faint bg-surface-solid/60 px-4 py-3">
            <BrandPlate
              symbols={symbols}
              meta={meta}
              sinceEvent={sinceEvent}
              sinceLabel={t.stories.sinceEvent}
              locale={locale}
              size={56}
            />
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-[12.5px] font-semibold text-primary">
          {t.guide.cardCta}
          <ArrowRight weight="bold" size={13} />
          {story.readMinutes && (
            <span className="numeral ml-auto font-normal text-muted">
              {story.readMinutes} {t.stories.readMinutes}
            </span>
          )}
        </p>
      </section>
    </Link>
  );
}

/**
 * Arşiv kartı — marka plakası, künye, başlık, giriş ve kadro.
 *
 * KART NEDEN BÖYLE. Önce kapak bandında logolar ve sembolün günlük değişimi,
 * kartın altında da bir aylık fiyat eğrisi vardı. Eğri gürültüydü: küçük
 * kartta okunmuyor, arşivde sorulan soruyu da cevaplamıyordu. Kart artık tek
 * bir görsel çapa taşıyor — şirketin logosu, büyük ve kırpılmadan — ve tek
 * bir sayı: olayın gününden bugüne getiri. Yazı geçmişte kalmış bir olayı
 * anlatıyor; o rakam "sonra ne oldu" sorusunun ilk cevabı.
 */
function StoryCard({
  story,
  meta,
  sinceEvent,
  locale,
  t,
}: {
  story: StoryIndexRow;
  meta: Awaited<ReturnType<typeof getSymbolNames>>;
  sinceEvent: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const symbols = story.symbols ?? [];

  return (
    <Link href={`/mercek/${story.slug}`} prefetch={false} className="min-w-0">
      <Panel className="panel-hover flex h-full flex-col overflow-hidden">
        {symbols.length > 0 ? (
          <div className="border-b border-line bg-[linear-gradient(135deg,var(--primary-wash),var(--primary-tint))] px-5 py-4">
            <BrandPlate
              symbols={symbols}
              meta={meta}
              sinceEvent={sinceEvent}
              sinceLabel={t.stories.sinceEvent}
              locale={locale}
            />
          </div>
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

          {/* Plaka birincil şirketi gösteriyor; çipler yazının geri kalan
              kadrosunu sayar, birincil sembol orada tekrar edilmez. */}
          {symbols.length > 1 && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
              {symbols.slice(1, 5).map((symbol) => (
                <SymbolPill key={symbol} symbol={symbol} />
              ))}
              {symbols.length > 5 && (
                <span className="numeral inline-flex items-center rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10.5px] font-bold text-muted">
                  +{symbols.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </Panel>
    </Link>
  );
}

function SymbolPill({ symbol }: { symbol: string }) {
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
