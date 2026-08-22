import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  StoryBrands,
  StoryCast,
  sinceEventReturn,
  type CastMember,
} from "@/components/stories/StoryVisual";
import {
  EmptyState,
  FilterChip,
  Kicker,
  PageHeader,
  Panel,
  Skeleton,
} from "@/components/ui/primitives";
import {
  countStories,
  countStoriesBySymbol,
  getStatus,
  getStories,
  getStoriesForSymbol,
  getSymbolNames,
  type StoryIndexRow,
} from "@/lib/data";
import { getChartBarsMulti } from "@/lib/providers";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateLong, formatEtDateShort, plural } from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/mercek",
  tr: {
    title: "Mercek",
    description:
      "Piyasada yaşananların uzun anlatımı — olayın arkasındaki mekanizma.",
  },
  en: {
    title: "Close-Up",
    description:
      "The long read on what happened — the mechanism behind the event.",
  },
});

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
/**
 * Bir sayfada gösterilen yazı sayısı ve "daha fazla" adımı.
 *
 * Arşiv 60 yazıda sessizce kesiliyordu: ne bir bağlantı ne bir künye vardı,
 * yani 60'ıncıdan eskisi site içinden HİÇBİR yoldan erişilemiyordu (site
 * haritasında durdukları için arama motorundan gelen okuyucu açabiliyordu).
 * Filtre çipleri de yalnızca o 60 satırdan sayıldığı için sadece eski
 * yazılarda geçen şirketler hiç çip almıyordu.
 */
const PAGE_STEP = 24;

export default async function StoriesPage(props: PageProps<"/mercek">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const symbolFilter =
    typeof search.sembol === "string"
      ? search.sembol.toUpperCase().slice(0, 12)
      : null;

  /* Derinlik adreste yaşıyor (/sirketler ve /piyasalar ile aynı desen):
     okuyucu bağlantıyı paylaşırsa karşı taraf aynı derinliği görüyor. */
  const requested = Number(
    typeof search.adet === "string" ? search.adet : PAGE_STEP,
  );
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.ceil(requested / PAGE_STEP) * PAGE_STEP, 600)
      : PAGE_STEP;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.stories.eyebrow}
        title={t.stories.title}
        subtitle={t.stories.subtitle}
      />

      <IntroLine t={t} />

      <Suspense
        key={`${symbolFilter ?? "all"}:${limit}`}
        fallback={<BoardSkeleton />}
      >
        <StoryBoard
          locale={locale}
          t={t}
          symbolFilter={symbolFilter}
          limit={limit}
        />
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
      <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small leading-[18px] text-muted">
        {items.map((item, index) => (
          <li key={item.title} className="flex items-center gap-2.5">
            {/* Ayraç dar ekranda gizlenir: maddeler zaten alt alta düşüyor ve
                nokta, satır başına kayıp yetim bir işaret olarak kalıyordu. */}
            {index > 0 && (
              <span aria-hidden className="hidden text-line-strong sm:inline">
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
      <p className="flex flex-wrap items-center gap-x-1.5 text-small text-muted">
        {t.stories.bridge}
        <Link
          href="/haberler"
          className="-my-2 inline-flex min-h-8 items-center py-2 font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {t.nav.news}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/rehber"
          className="-my-2 inline-flex min-h-8 items-center py-2 font-semibold text-primary transition-colors hover:text-primary-hover"
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
  limit,
}: {
  locale: Locale;
  t: Dictionary;
  symbolFilter: string | null;
  limit: number;
}) {
  /* SÜZME VERİTABANINDA. Sembol filtresi bir dönem yüklenen listeyi bellekte
     tarıyordu: arşiv 41 yazıya çıkıp ekranda 24'ü dururken, yalnızca eski
     17'de geçen bir şirkete süzülmek BOŞ sayfa veriyordu — yazı vardı, sorgu
     onu hiç görmüyordu. `getStoriesForSymbol` aynı aramayı Postgres'in
     `jsonb` içi aramasıyla, arşivin tamamında yapıyor. */
  const [rows, total, tally] = await Promise.all([
    symbolFilter
      ? getStoriesForSymbol(symbolFilter, locale, limit)
      : getStories(locale, limit),
    countStories(),
    countStoriesBySymbol(),
  ]);

  if (rows.length === 0 && !symbolFilter) {
    return (
      <Panel>
        <EmptyState title={t.stories.empty} hint={t.stories.emptyHint} />
      </Panel>
    );
  }

  /* Filtre çipleri arşivin TAMAMINDAN türer, ekrandaki listeden değil: bir
     sembole süzdükten sonra diğerlerine geçebilmek gerekiyor ve sayının da
     gerçek toplamı söylemesi lazım. */
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
  /* Manşette kadro tablosu var, kartlarda tek rakam: o yüzden manşetin ilk
     dört sembolü ve diğer yazıların birincil sembolü için bar çekiliyor. */
  const curveSymbols = [
    ...new Set([
      ...(lead?.symbols ?? []).slice(0, 3),
      ...rows
        .map((story) => story.symbols?.[0])
        .filter((symbol): symbol is string => Boolean(symbol)),
    ]),
  ].slice(0, CURVE_LIMIT);

  /* On iki sembole kadar çıkabilen bu liste sembol başına ayrı istek
     atıyordu; tek çağrıda çıkıyor. */
  const [meta, barsBySymbol] = await Promise.all([
    getSymbolNames(shownSymbols),
    getChartBarsMulti(curveSymbols, "1Y", status),
  ]);

  /* Kural StoryVisual'da: olay çekilen barlardan eskiyse taban bulunamıyor
     ve hiçbir şey dönmüyor. Bu sürüm bir dönem serinin EN ESKİ barını taban
     alıp sonucu yine "olaydan bugüne" diye yazıyordu. */
  const sinceEventOf = (
    symbol: string | null | undefined,
    eventDate: string,
  ): number | null => {
    if (!symbol) return null;
    return sinceEventReturn(barsBySymbol[symbol], eventDate);
  };

  /** Yazının kadrosu — logo, ad ve olaydan bugüne getiri. */
  const castOf = (story: StoryIndexRow, limit: number): CastMember[] =>
    (story.symbols ?? []).slice(0, limit).map((symbol) => ({
      symbol,
      name: meta[symbol]?.name ?? null,
      logoUrl: meta[symbol]?.logoUrl ?? null,
      sinceEvent: sinceEventOf(symbol, story.eventDate),
    }));

  return (
    <div className="flex flex-col gap-6">
      {chips.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="plate mr-0.5 text-nano tracking-[0.09em]">
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
                className="text-small font-semibold text-primary"
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
              cast={castOf(lead, 3)}
              locale={locale}
              t={t}
            />
          )}

          {rows.length > 1 && (
            <div className="flex flex-col gap-3">
              <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
                {t.stories.archive}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.slice(1).map((story) => (
                  <StoryCard
                    key={story.slug}
                    story={story}
                    cast={castOf(story, 4)}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* "Daha Fazla" — künyesiyle birlikte. `scroll={false}`: okuyucu
              listenin dibinde, sayfanın başına fırlatılmamalı. */}
          {total > rows.length && !symbolFilter && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="numeral text-small text-muted">
                {t.stories.showing
                  .replace("{n}", String(rows.length))
                  .replace("{total}", String(total))}
              </p>
              <Link
                href={`/mercek?adet=${limit + PAGE_STEP}`}
                scroll={false}
                /* 44px: arşivin dibindeki tek eylem, mobilde dokunma
                   eşiğinin altındaydı — aynı düzeltme /sirketler ve
                   /piyasalar'daki ikizlerinde de var. */
                className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-10"
              >
                {t.stories.showMore}
              </Link>
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
  cast,
  locale,
  t,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  locale: Locale;
  t: Dictionary;
}) {
  const total = story.symbols?.length ?? 0;

  return (
    <Link href={`/mercek/${story.slug}`} prefetch className="min-w-0">
      <section className="panel-hover overflow-hidden rounded-xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] p-5 transition-colors sm:p-7">
        {/* İki kolon: solda okunacak metin, sağda yazının kadrosu. Kadro
            manşette bir tabloya dönüşüyor çünkü burada yer var ve bu
            yazıların anlattığı olay çoğu zaman birkaç şirketi birlikte
            vuruyor — "sonra ne oldu" sorusunun cevabı şirket şirket
            değişiyor. Tek logo göstermek yazıyı tek firmalık gibi
            okutuyordu. */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Kicker tone="primary">{t.stories.latest}</Kicker>
              {/* Yazı henüz bu dile çevrilmediyse orijinal gösterilir ve
                  dili rozetle söylenir — sessizce yanlış dilde metin sunmak
                  seçenek değil. */}
              {story.locale !== locale && (
                <span className="plate text-nano tracking-[0.09em]">
                  {story.locale.toUpperCase()}
                </span>
              )}
              {/* Arşiv kartındaki künyeyle aynı ağırlık — manşet yazının
                  tarihi orada okunur, burada okunmaz olamaz. */}
              <span className="numeral ml-auto text-base font-semibold text-body">
                {formatEtDateLong(story.eventDate, locale)}
              </span>
            </div>

            {/* MANŞET BİR BASAMAK KÜÇÜK VE ÖLÇÜLÜ GENİŞLİKTE.
                32 punto + `w-fit` ile başlık doğal genişliğini alıyordu:
                mercek başlıkları ortalama 59 karakter ("iddia: nitelik"
                kalıbı) ve geniş ekranda tek satırda 930 piksele uzuyordu.
                Uzun görünmesinin sebebi metnin kendisi değil, satırın hiç
                kırılmamasıydı.
                28 punto sitenin kendi ölçeğinde bir basamak aşağısı ve ana
                sayfadaki mercek manşetiyle aynı; `max-w-[34ch]` başlığı iki
                satıra indiriyor, `text-balance` da iki satırı eşitliyor —
                tek kelimelik yetim satır kalmıyor. */}
            <h2 className="display-ink mt-3 w-fit max-w-[34ch] text-balance text-heading font-bold leading-[1.14] tracking-[-0.03em] sm:text-subdisplay">
              {story.title}
            </h2>
            <p className="mt-3.5 max-w-[58ch] text-read leading-[25px] text-body">
              {story.dek}
            </p>

            <p className="mt-5 flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-small font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight weight="bold" size={13} />
              {story.readMinutes && (
                <span className="numeral ml-auto font-normal text-muted">
                  {story.readMinutes} {t.stories.readMinutes}
                </span>
              )}
            </p>
          </div>

          {cast.length > 0 && (
            <div className="lg:w-[300px] lg:shrink-0">
              <StoryCast
                cast={cast}
                total={total}
                title={t.stories.relatedSymbols}
                sinceLabel={t.stories.sinceEvent}
                eventDate={formatEtDateShort(story.eventDate, locale)}
                moreLabel={plural(
                  Math.max(0, total - cast.length),
                  t.stories.moreCompaniesOne,
                  t.stories.moreCompaniesMany,
                )}
                locale={locale}
              />
            </div>
          )}
        </div>
      </section>
    </Link>
  );
}

/**
 * Arşiv kartı — marka şeridi, künye, başlık, giriş.
 *
 * Şerit yazının KADROSUNU gösteriyor: logolar yan yana, altında semboller.
 * Tek büyük logo denendi ve yazı tek bir firmayla ilgiliymiş gibi
 * okunuyordu; bu metinler çoğu zaman bir zinciri anlatıyor. Sağdaki tek
 * rakam ilk şirketin olay gününden bugüne getirisi — arşivde sorulan soru
 * "bu ay fiyat nasıl seyretti" değil, "bu olaydan sonra ne oldu".
 */
function StoryCard({
  story,
  cast,
  locale,
  t,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  locale: Locale;
  t: Dictionary;
}) {
  const total = story.symbols?.length ?? 0;

  return (
    <Link href={`/mercek/${story.slug}`} prefetch={false} className="min-w-0">
      <Panel className="panel-hover flex h-full flex-col overflow-hidden">
        {cast.length > 0 ? (
          <StoryBrands
            cast={cast}
            total={total}
            sinceLabel={t.stories.sinceEvent}
            eventDate={formatEtDateShort(story.eventDate, locale)}
            locale={locale}
          />
        ) : (
          <span className="block h-1.5 bg-[linear-gradient(90deg,var(--primary-wash),var(--primary-tint))]" />
        )}

        <div className="flex flex-1 flex-col p-5">
          {/* Tarih künyenin en görünür parçası. Üçü de 11,5px ve aynı soluk
              mürekkepteyken satır tek bir gri şerit gibi okunuyordu; oysa bu
              yazılarda tarih başlıktan sonra gelen ikinci bilgi — metin bir
              OLAYI anlatıyor ve olayın ne zaman olduğu hikâyenin parçası.
              Okuma süresi geride kalıyor: o bir künye, tarih değil. */}
          <p className="numeral flex items-baseline gap-1.5 text-tiny text-muted">
            <span className="text-base font-semibold text-body">
              {formatEtDateLong(story.eventDate, locale)}
            </span>
            {story.readMinutes && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {story.readMinutes} {t.stories.readMinutes}
                </span>
              </>
            )}
            {story.locale !== locale && (
              <span className="plate ml-auto text-micro tracking-[0.09em]">
                {story.locale.toUpperCase()}
              </span>
            )}
          </p>

          <h3 className="display-ink display-ink-tight mt-1.5 w-fit text-lead font-bold leading-[1.2] tracking-[-0.025em]">
            {story.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-base leading-[20px] text-body">
            {story.dek}
          </p>
        </div>
      </Panel>
    </Link>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64 rounded-full" />
      <Skeleton className="h-[236px] w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[280px] w-full rounded-(--radius-xl)" />
        ))}
      </div>
    </div>
  );
}
