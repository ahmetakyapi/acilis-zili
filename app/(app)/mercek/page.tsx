import { storySinceEvent } from "@/lib/story-market";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { Suspense } from "react";
import { SectionMasthead } from "@/components/motion/SectionMasthead";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/motion/EditorialExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { StoryCard } from "@/components/stories/StoryCard";
import { StoryCast, type CastMember } from "@/components/stories/StoryVisual";
import {
  EmptyState,
  FilterChip,
  Kicker,
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
import { formatEtDateLong, plural } from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";
import { ScrollEdges } from "@/components/ui/ScrollEdges";

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
 * burada ne yazılıyor, nasıl yazılıyor, ne sıklıkla yazılıyor. Cevap
 * sayfanın DİBİNDEKİ künyede (`IntroLine`) — "Mercek" adı tek başına bunu
 * söylemiyordu ve liste, haber akışından ayırt edilemiyordu; ama açıklama
 * manşetin önüne ya da arasına da girmiyor.
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

  /* ÇİPLER KAPAĞIN SAĞINA, LİSTENİN ÜSTÜNE DEĞİL. Şerit kapağın hemen
     altında ayrı bir satırdı ve kapağın sağ yarısı boş duruyordu; ikisi
     birleşince ilk ekrana bir şerit kadar daha yazı giriyor.

     Sayım artık SAYFADA yapılıyor ve iki yere değil tek yere gidiyor:
     `countStoriesBySymbol` `cache()` sarmalı olmayan düz bir sorgu (bkz.
     lib/data.ts), yani çipleri ayrı bir bileşende hesaplamak tabloyu iki
     kez okurdu. Filtreye BAĞLI olmayan bir sayım olduğu için Suspense
     sınırının dışında beklenmesi listeyi geciktirmiyor. */
  const tally = await countStoriesBySymbol();
  const chips = [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <SectionMasthead
        eyebrow={t.stories.eyebrow}
        title={t.stories.title}
        description={t.stories.subtitle}
        aside={
          chips.length > 1 ? (
            <StoryFilters chips={chips} active={symbolFilter} t={t} />
          ) : undefined
        }
      />

      <QueryTransition label={t.common.loading}>
      <Suspense
        key={`${symbolFilter ?? "all"}:${limit}`}
        fallback={<LoadingFallback label={t.common.loading}><BoardSkeleton /></LoadingFallback>}
      >
        <StoryBoard
          locale={locale}
          t={t}
          symbolFilter={symbolFilter}
          limit={limit}
        />
      </Suspense>
      </QueryTransition>
    </MotionExperience>
  );
}

/**
 * Sayfanın kendini tanıttığı satır — ne, nasıl, ne sıklıkla.
 *
 * ÖNCE BİR KARTTI ve sayfanın en üstünde duruyordu: ekranda ilk karşılaşılan
 * yüzey manşet değil bir açıklama kutusu oluyordu, dikkat de oraya
 * dağılıyordu. Oysa bu metnin işi yol göstermek, sahneyi almak değil.
 *
 * SONRA MANŞETİN ALTINDA, arşivin üstünde bir satırdı: masaüstünde tek
 * satır, telefonda koyu etiketli üç satırlık bir blok — ve okuyucu
 * manşetten kartlara inerken ona takılıyordu.
 *
 * Artık arşivin dibinde, hairline ile ayrılmış sessiz bir künye paragrafı.
 * Bilgi duruyor, ağırlığı kalkıyor — manşet ilk sırada, kartlar hemen
 * ardından; açıklama son söz.
 */
function IntroLine({ t }: { t: Dictionary }) {
  const items = [
    { title: t.stories.whatTitle, body: t.stories.whatShort },
    { title: t.stories.howTitle, body: t.stories.howShort },
    { title: t.stories.rhythmTitle, body: t.stories.rhythmShort },
  ];

  /* TEK PARAGRAF, MADDE LİSTESİ DEĞİL. Üç madde `li` olarak diziliyordu
     ve telefonda her biri kendi satırına düşüp koyu etiketli üç satırlık
     bir blok kuruyordu — arşivin ortasında, manşetle kartların arasında,
     bir "hakkında" kutusu. Cümleler artık akan tek bir paragraf: geniş
     ekranda tek satır, dar ekranda kelime kelime sarıyor, ayraç hiç
     yetim kalmıyor (satır sonuna gelen ayraç `nowrap` ile önceki cümleye
     bağlı). */
  return (
    <div className={`${styles.intro} flex flex-col gap-2 border-t border-line pt-4`}>
      <p className="text-small leading-[18px] text-muted">
        {items.map((item, index) => (
          <span key={item.title}>
            {index > 0 && (
              <span aria-hidden className="whitespace-nowrap text-line-strong">
                {" "}·{" "}
              </span>
            )}
            <span className="font-semibold text-body">{item.title}:</span>{" "}
            {item.body}
          </span>
        ))}
      </p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-small text-muted">
        {t.stories.bridge}
        <Link
          href="/haberler"
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {t.nav.news}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/rehber"
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {t.nav.guide}
        </Link>
      </p>
    </div>
  );
}

/**
 * Şirkete göre süzme — kapağın sağ sütununda.
 *
 * Çipler arşivin TAMAMINDAN türer, ekrandaki listeden değil: bir sembole
 * süzdükten sonra diğerlerine geçebilmek gerekiyor ve sayının da gerçek
 * toplamı söylemesi lazım.
 *
 * Şerit kapağın altındayken tek satırda yatay kayıyordu. Kapağın sağında
 * yeri dar ama YÜKSEK: sekiz çip iki-üç satıra sarıyor ve kaydırmaya gerek
 * kalmıyor. Dar ekranda ızgara tek kolona indiğinde eski davranış geri
 * geliyor — orada sarmak yerine kaymak doğru, çünkü genişlik yok.
 */
function StoryFilters({
  chips,
  active,
  t,
}: {
  chips: [string, number][];
  active: string | null;
  t: Dictionary;
}) {
  return (
    <div className={styles.filterAside}>
      <span className={styles.filterAsideLabel}>{t.stories.filterLabel}</span>
      <ScrollEdges className={`${styles.storyFilters} flex items-center gap-2`}>
        <FilterChip href="/mercek" active={!active}>
          {t.stories.filterAll}
        </FilterChip>
        {chips.map(([symbol, count]) => (
          <FilterChip
            key={symbol}
            href={symbol === active ? "/mercek" : `/mercek?sembol=${symbol}`}
            active={symbol === active}
          >
            <span className="numeral">{symbol}</span>
            <span className="ml-1.5 opacity-70">{count}</span>
          </FilterChip>
        ))}
      </ScrollEdges>
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
  const [rows, total] = await Promise.all([
    symbolFilter
      ? getStoriesForSymbol(symbolFilter, locale, limit)
      : getStories(locale, limit),
    countStories(),
  ]);

  if (rows.length === 0 && !symbolFilter) {
    return (
      <Panel>
        <EmptyState title={t.stories.empty} hint={t.stories.emptyHint} scene="press" />
      </Panel>
    );
  }

  /* LİSTE ÇİZİLENDEN TÜRÜYOR, TAVANDAN DEĞİL.
     Burada bir dönem yazıların BÜTÜN sembolleri toplanıp 40'ta kesiliyordu.
     İki ayrı kusur birden: liste ekranda çizilmeyen sembollere de yer
     ayırıyordu (bir yazı yedi sembol taşıyabiliyor, kapak dördünü çiziyor)
     ve tavanın dışında kalan sembol için `meta[symbol]` boş dönüyordu — kart
     o zaman gerçek logo yerine gri harf karosuna düşüyordu. Varsayılan
     listede bile beş sembol tavanın dışındaydı; `?adet=48`de altı kart
     bütünüyle logosuz çiziliyordu.

     Kapak en çok dört sembol çiziyor (StoryVisual `max = 4`), o yüzden
     yazı başına ilk dördü alınıyor: kota artık görünmeyen sembollere
     harcanmıyor. Tavan gerekmiyor çünkü liste zaten iki kez sınırlı —
     sayfa en çok 600 yazı basıyor ve semboller tekilleştiriliyor, yani
     sonuç sembol evreninden (~800 satır) büyük olamaz. */
  const shownSymbols = [
    ...new Set(rows.flatMap((story) => (story.symbols ?? []).slice(0, 4))),
  ];

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


  /** Yazının kadrosu — logo, ad ve olaydan bugüne getiri. */
  const castOf = (story: StoryIndexRow, limit: number): CastMember[] =>
    (story.symbols ?? []).slice(0, limit).map((symbol) => ({
      symbol,
      name: meta[symbol]?.name ?? null,
      logoUrl: meta[symbol]?.logoUrl ?? null,
      ...(({ pct, close }) => ({ sinceEvent: pct, lastClose: close }))(
        storySinceEvent(barsBySymbol[symbol], story.eventDate, status),
      ),
    }));

  return (
    <div className="flex flex-col gap-6">
      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            scene="searching"
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
              <h2 className={styles.archiveHeading}>
                {t.stories.archive}
              </h2>
              <div className={styles.archiveGrid} data-motion-stagger>
                {rows.slice(1).map((story) => (
                  <StoryCard
                    key={story.slug}
                    className={styles.archiveCard}
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

          {/* EDİTORYAL KÜNYE EN ALTTA. Bir dönem manşetin hemen altında,
              arşivin üstündeydi ("ne yazılır, nasıl yazılır, ne sıklıkla")
              ve telefonda okuyucunun yolunu kesiyordu: manşeti bitirip
              öteki yazılara inmek isteyen göz üç satırlık bir açıklamaya
              takılıyordu. Ekran düzeni kuralında künyeler ve uyarılar en
              sonda; burası da öyle. Haberler/Rehber köprüsü onunla
              birlikte iniyor. */}
          <IntroLine t={t} />
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
    <Link href={`/mercek/${story.slug}`} prefetch className={styles.lead} data-motion-reveal>
      <section className="panel-hover overflow-hidden rounded-xl border border-primary-faint bg-(--premium-surface) p-5 transition-colors sm:p-7">
        {/* İki kolon: solda okunacak metin, sağda yazının kadrosu. Kadro
            manşette bir tabloya dönüşüyor çünkü burada yer var ve bu
            yazıların anlattığı olay çoğu zaman birkaç şirketi birlikte
            vuruyor — "sonra ne oldu" sorusunun cevabı şirket şirket
            değişiyor. Tek logo göstermek yazıyı tek firmalık gibi
            okutuyordu. */}
        <div className={styles.leadLayout}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Kicker tone="primary">{t.stories.latest}</Kicker>
              {/* Yazı henüz bu dile çevrilmediyse orijinal gösterilir ve
                  dili rozetle söylenir — sessizce yanlış dilde metin sunmak
                  seçenek değil. */}
              {story.locale !== locale && (
                <span className="plate text-nano">
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
            <h2 className={styles.leadTitle} lang={story.locale}>
              {story.title}
            </h2>
            <p className={styles.leadDek} lang={story.locale}>
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
            <div className={styles.leadCast}>
              <StoryCast
                cast={cast}
                total={total}
                title={t.stories.relatedSymbols}
                sinceLabel={t.stories.sinceEvent}
                closeLabel={t.stories.lastClose}
                closeOnLabel={t.stories.closeOn}
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
