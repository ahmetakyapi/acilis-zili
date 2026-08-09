import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LevelBadge, LevelDots } from "@/components/article/LevelBadge";
import { GlyphTile } from "@/components/article/GlyphTile";
import { readingMinutes } from "@/components/article/ArticleBody";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import {
  GUIDE_LEVELS,
  GUIDE_TOPICS,
  guideArticles,
  guideLevelLabel,
  guideTopicDesc,
  guideTopicLabel,
  type GuideArticle,
  type GuideLevel,
  type GuideTopicKey,
} from "@/content/guide";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const metadata: Metadata = {
  title: "Rehber",
  description:
    "Borsayı anlatan yazılar — kavramdan stratejiye, kolaydan zora.",
};

/**
 * Rehber — müfredatın vitrini.
 *
 * Sayfanın iki hâli var ve ikisi farklı soruya cevap veriyor:
 *
 * FİLTRESİZ hâl "nereden başlamalıyım" sorusunu cevaplıyor: girişte dört
 * bölmeli müfredat şeridi, altında konu konu bölümlenmiş liste. Bölmeler
 * sayfa içi çapalara gider — filtre değil, içindekiler tablosu.
 *
 * FİLTRELİ hâl (?konu=...) "yalnızca bu konuyu göster" diyor: konunun kendi
 * başlığı ve açıklamasıyla açılır, tek liste görünür.
 *
 * ÜÇ KATMANLI HİYERARŞİ. Sayfa bir süre 31 eş ağırlıklı karttan ibaretti:
 * dört bölüm arasında yalnızca ince bir çizgi vardı, bölüm başlıkları
 * kartlardan pek az büyüktü ve her kartın köşesindeki zorluk rozeti bir
 * bölümün tamamında aynı kelimeyi yazıyordu ("Temel", sekiz kez). Sonuç,
 * neyin nerede bittiğinin okunmadığı tek bir akıştı. Şimdi:
 *
 *   1. Şerit — hangi blok, hangi zorluk aralığında
 *   2. Bölüm başlığı — kalın kural, iri numara, YAPIŞKAN
 *   3. Seviye bandı — blok içinde temel / orta / ileri ayrımı
 *
 * Zorluk rozeti KARTTAN BANDA taşındı: bandın söylediğini kart tekrar
 * ettiğinde rozet bilgi değil doku oluyordu. Bir konunun tamamı tek
 * seviyedeyse bant basılmaz, seviye bölüm başlığına çıkar — bilgi hep
 * yazılı, yalnızca doğru yükseklikte.
 *
 * BÖLÜM BAŞLIKLARI YAPIŞKAN. Ayrımı asıl kuran şey bu: bir konunun
 * kartları arasında ilerlerken o konunun adı üstte asılı kalıyor, sıradaki
 * bölüm gelince onu yukarı itip yerini alıyor. Okuyucu hangi bloğun içinde
 * olduğunu her an görüyor ve blokların nerede bittiği kaydırırken fiziksel
 * olarak hissediliyor — otuz bir kart artık tek bir akış değil, dört bölüm.
 * CSS ile çalışıyor; kaydırma dinleyen bir bileşen yok.
 *
 * RENKLE AYRILMADI, bilerek. Konu başına bir renk vermek en kolay yoldu ama
 * bu sitede renk yalnızca üç şey söylüyor: yukarı, aşağı, etkileşim.
 * Dördüncü bir anlam yüklemek o dili bozardı. Ayrım ölçüden, kuraldan ve
 * boşluktan geliyor.
 */

export default async function GuidePage(props: PageProps<"/rehber">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const requested =
    typeof search.konu === "string" ? (search.konu as GuideTopicKey) : null;
  const activeTopic =
    GUIDE_TOPICS.find((topic) => topic.key === requested)?.key ?? null;

  const all = guideArticles(locale);
  const groupOf = (key: GuideTopicKey) =>
    all.filter((article) => article.topic === key);
  const minutesOf = (articles: GuideArticle[]) =>
    articles.reduce((sum, article) => sum + readingMinutes(article.bodyMd), 0);

  return (
    /* Bölümler arası boşluk sayfanın ritmini kuruyor: kartlar arası 16px,
       seviye bantları arası 20px, bölümler arası 40px. Üç ayrı ölçek, üç
       ayrı düzey. */
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow={t.guide.eyebrow}
        title={t.guide.title}
        subtitle={t.guide.subtitle}
      />

      {activeTopic ? (
        <TopicView
          topic={activeTopic}
          articles={groupOf(activeTopic)}
          locale={locale}
          t={t}
        />
      ) : (
        <>
          <CurriculumStrip
            all={all}
            groupOf={groupOf}
            minutesOf={minutesOf}
            locale={locale}
            t={t}
          />

          {GUIDE_TOPICS.map((topic, index) => {
            const group = groupOf(topic.key);
            if (group.length === 0) return null;
            return (
              /* scroll-mt: çapaya atlayınca bölüm başlığı yapışkan üst
                 çubuğun altında kalmasın — çubuk 65px, 80px onu güvenle
                 açıklıyor. */
              <section
                key={topic.key}
                id={`konu-${topic.key}`}
                className="flex scroll-mt-20 flex-col"
              >
                <TopicHeading
                  index={index}
                  topic={topic.key}
                  articles={group}
                  minutes={minutesOf(group)}
                  locale={locale}
                  t={t}
                />
                <LeveledGrid articles={group} locale={locale} t={t} />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** Konudaki seviyeler, kolaydan zora ve yalnızca gerçekten kullanılanlar. */
function levelsIn(articles: GuideArticle[]): GuideLevel[] {
  return GUIDE_LEVELS.filter((level) =>
    articles.some((article) => article.level === level),
  );
}

/**
 * Müfredat şeridi — dört konu, sıra numarası ve zorluk aralığıyla.
 *
 * Karolar filtrelemez, sayfa içinde ilgili bölüme götürür: yeni gelen
 * okuyucunun sorusu "bu konudaki yazıları süz" değil "nereden başlayayım".
 *
 * Karo, bölüm başlığının SÖYLEMEDİĞİNİ söyler. Bir süre ikisi de aynı üç
 * şeyi yazıyordu — ad, yazı sayısı, okuma süresi — ve şerit, hemen altındaki
 * başlığın kırk piksel yukarıdaki kopyası gibi duruyordu. Artık karoda
 * zorluk aralığı var (bu blok nerede başlayıp nerede bitiyor), başlıkta
 * kapsam (kaç yazı, ne kadar okuma). Kapsamın toplamı şeridin künyesinde.
 */
function CurriculumStrip({
  all,
  groupOf,
  minutesOf,
  locale,
  t,
}: {
  all: GuideArticle[];
  groupOf: (key: GuideTopicKey) => GuideArticle[];
  minutesOf: (articles: GuideArticle[]) => number;
  locale: Locale;
  t: Dictionary;
}) {
  const first = all[0];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
          {t.guide.curriculum}
        </h2>
        <span className="numeral text-[11.5px] text-muted">
          {all.length} {t.guide.articlesCount} · ~{minutesOf(all)}{" "}
          {t.guide.readMinutes}
        </span>
        {/* Müfredatın ilk durağına doğrudan giden tek bağlantı. Şeridin
            başlığı "Nereden Başlamalı" diyor ama başlamak, doğru karoyu
            bulup içindeki ilk kartı seçmeyi gerektiriyordu. */}
        {first && (
          <Link
            href={`/rehber/${first.slug}`}
            className="-my-2 ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 py-2 text-[12px] font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            {t.guide.startFirst}
            <ArrowRight weight="bold" size={12} />
          </Link>
        )}
      </div>
      <p className="-mt-1.5 max-w-[72ch] text-[12.5px] leading-[19px] text-muted">
        {t.guide.curriculumHint}
      </p>

      <Panel className="grid grid-cols-2 divide-line-soft overflow-hidden sm:grid-cols-4 sm:divide-x">
        {GUIDE_TOPICS.map((topic, index) => {
          const group = groupOf(topic.key);
          const levels = levelsIn(group);
          return (
            <a
              key={topic.key}
              href={`#konu-${topic.key}`}
              className={cn(
                "group flex min-w-0 flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-primary-tint",
                /* Telefonda şerit 2×2 kırılıyor ve iki sıra arasında hiçbir
                   ayraç kalmıyordu; dörtlü sıraya geçince divide-x devralır. */
                index >= 2 && "border-t border-line-soft sm:border-t-0",
              )}
            >
              <span className="numeral text-[11px] font-bold text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="display-ink display-ink-tight w-fit text-[15px] font-bold tracking-[-0.02em]">
                {guideTopicLabel(topic.key, locale)}
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-muted">
                <LevelDots level={levels[levels.length - 1] ?? "temel"} />
                <span className="min-w-0 truncate">
                  {levelSpan(levels, locale)}
                </span>
                <ArrowRight
                  weight="bold"
                  size={11}
                  className="ml-auto shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </a>
          );
        })}
      </Panel>
    </section>
  );
}

/** "Temel" ya da "Temel → İleri" — bloğun nerede başlayıp nerede bittiği. */
function levelSpan(levels: GuideLevel[], locale: Locale): string {
  if (levels.length === 0) return "";
  const first = guideLevelLabel(levels[0], locale);
  if (levels.length === 1) return first;
  return `${first} → ${guideLevelLabel(levels[levels.length - 1], locale)}`;
}

/**
 * Bölüm başlığı — kalın kural, iri numara, ad, kapsam ve konu bağlantısı.
 *
 * YAPIŞKAN VE İKİ PARÇALI. Üstteki satır (kural + numara + ad + kapsam)
 * bölüm boyunca ekranın üstünde asılı kalıyor, açıklama paragrafı kalmıyor:
 * yapışan şeyin bir SATIR olması gerekiyor, üç satırlık bir blok ekranın
 * altıda birini yiyor. Yapışkan olan kısım kendi zeminini taşıyor
 * (`bg-page`), yoksa altından geçen kartlar metnin içinden görünüyor.
 *
 * `top-16` uygulamanın kendi yapışkan çubuğunun (65-67px) bir tık ALTINDA
 * duruyor: eşit verilseydi iki katman arasında bir piksellik bir yarık
 * kalıyor ve oradan içerik sızıyordu. Çubuk opak olduğu için birkaç piksel
 * altına girmek görünmüyor.
 *
 * Numara eskiden 9px'lik bir karoydu ve kartların köşesindeki sıra
 * numaralarından ayırt edilmiyordu. Şimdi 26px: bölümün çapası o, kartın
 * künyesi değil. Karo kaldırıldı çünkü yapışkan satırda bir kutu daha
 * taşımak satırı kalınlaştırıyordu.
 */
function TopicHeading({
  index,
  topic,
  articles,
  minutes,
  locale,
  t,
}: {
  index: number;
  topic: GuideTopicKey;
  articles: GuideArticle[];
  minutes: number;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = levelsIn(articles);

  return (
    <>
      <div className="sticky top-16 z-10 bg-page pt-1">
        {/* 2px'lik koyu kural — sayfadaki tek kalın çizgi. Bölüm sınırını
            renk kullanmadan işaretleyen şey bu; hairline denendi ve
            kartların kendi kenarlıklarından ayırt edilmiyordu. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-strong pb-3 pt-3">
          <span
            aria-hidden
            className="numeral text-[26px] font-bold leading-none tracking-[-0.03em] text-primary"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="display-ink display-ink-tight w-fit text-[22px] font-bold tracking-[-0.03em]">
            {guideTopicLabel(topic, locale)}
          </h2>
          <span className="numeral text-[12px] text-muted">
            {articles.length} {t.guide.articlesCount} · ~{minutes}{" "}
            {t.guide.readMinutes}
          </span>
          {/* Tek seviyeli konuda bant basılmıyor; seviye buraya çıkıyor. */}
          {levels.length === 1 && (
            <LevelBadge level={levels[0]} locale={locale} />
          )}
          <Link
            href={`/rehber?konu=${topic}`}
            scroll={false}
            /* -my-2 py-2: 12px'lik metin tek başına 18px'lik bir dokunma
               hedefi bırakıyordu; dolgu 32px'e çıkarır, negatif margin satırı
               olduğu yerde tutar. */
            className="-my-2 ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 py-2 text-[12px] font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            {t.guide.onlyThis}
            <ArrowRight weight="bold" size={12} />
          </Link>
        </div>
      </div>
      <p className="mb-5 max-w-[72ch] text-[13px] leading-[20px] text-soft">
        {guideTopicDesc(topic, locale)}
      </p>
    </>
  );
}

/** Filtreli hâl: konunun kendi başlığı, açıklaması ve tek liste. */
function TopicView({
  topic,
  articles,
  locale,
  t,
}: {
  topic: GuideTopicKey;
  articles: GuideArticle[];
  locale: Locale;
  t: Dictionary;
}) {
  const levels = levelsIn(articles);

  return (
    <section className="flex flex-col gap-5">
      {/* Tek konu görünümünde başlık YAPIŞKAN DEĞİL: kaydırırken ayırt
          edilecek ikinci bir bölüm yok, asılı kalan bir satır yalnızca yer
          kaplardı. Kural ve iri numara duruyor — iki görünüm birbirinin
          devamı gibi okunsun. */}
      <div className="flex flex-col gap-2.5">
        <Link
          href="/rehber"
          scroll={false}
          className="-my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft weight="bold" size={12} />
          {t.guide.allTopics}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-strong pt-3">
          <span
            aria-hidden
            className="numeral text-[26px] font-bold leading-none tracking-[-0.03em] text-primary"
          >
            {String(GUIDE_TOPICS.findIndex((entry) => entry.key === topic) + 1).padStart(2, "0")}
          </span>
          <h2 className="display-ink display-ink-tight w-fit text-[22px] font-bold tracking-[-0.03em]">
            {guideTopicLabel(topic, locale)}
          </h2>
          <span className="numeral text-[12px] text-muted">
            {articles.length} {t.guide.articlesCount}
          </span>
          {levels.length === 1 && (
            <LevelBadge level={levels[0]} locale={locale} />
          )}
        </div>
        <p className="max-w-[72ch] text-[13px] leading-[20px] text-soft">
          {guideTopicDesc(topic, locale)}
        </p>
      </div>

      {articles.length === 0 ? (
        <Panel>
          <EmptyState title={t.guide.empty} />
        </Panel>
      ) : (
        <LeveledGrid articles={articles} locale={locale} t={t} />
      )}
    </section>
  );
}

/**
 * Konunun yazıları, seviye bantlarına bölünmüş hâlde.
 *
 * Sıra `content/guide/index.ts`'te zaten kolaydan zora kurulu; burada
 * yapılan iş o sıraya GÖRÜNÜR bir ayraç koymak. Tek bantlı konularda ayraç
 * basılmaz — sekiz kartın üstünde tek bir "Temel" etiketi, bölümün adı
 * zaten "Temel Kavramlar"ken bilgi taşımıyor.
 */
function LeveledGrid({
  articles,
  locale,
  t,
}: {
  articles: GuideArticle[];
  locale: Locale;
  t: Dictionary;
}) {
  const levels = levelsIn(articles);

  if (levels.length <= 1) {
    return <ArticleGrid articles={articles} t={t} />;
  }

  /* Numara BANDIN içinde değil konunun tamamında sayılıyor: okuyucunun
     "bu konunun 5. yazısı" diye tuttuğu sıra bantla kesilmemeli. Bantlar
     çizimden ÖNCE kuruluyor — sayaç `map` içinde artırılsaydı render
     sırasında değişen bir değişken olurdu. */
  const bands = levels.reduce<
    { level: GuideLevel; articles: GuideArticle[]; offset: number }[]
  >((acc, level) => {
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.articles.length : 0;
    return [
      ...acc,
      {
        level,
        offset,
        articles: articles.filter((article) => article.level === level),
      },
    ];
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {bands.map((band) => (
        <div key={band.level} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <LevelBadge level={band.level} locale={locale} />
            <span className="numeral text-[11px] text-muted">
              {band.articles.length} {t.guide.articlesCount}
            </span>
            <span aria-hidden className="h-px min-w-6 flex-1 bg-line" />
          </div>
          <ArticleGrid
            articles={band.articles}
            startIndex={band.offset}
            t={t}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Yazı kartları. Sağ üstteki numara yazının konu içindeki sırası —
 * müfredat hissini kart düzeyine taşır. Konu etiketi ve zorluk rozeti
 * kartlarda yok: ikisini de kartın üstündeki başlık ya da bant söylüyor
 * ve tekrar, otuz bir kartı birbirinin kopyası gibi gösteriyordu.
 */
function ArticleGrid({
  articles,
  startIndex = 0,
  t,
}: {
  articles: GuideArticle[];
  /** Bantlı listede numaralandırma konunun başından devam etsin diye. */
  startIndex?: number;
  t: Dictionary;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {articles.map((article, index) => (
        <Link
          key={article.slug}
          href={`/rehber/${article.slug}`}
          prefetch={false}
          className="min-w-0"
        >
          <Panel className="panel-hover flex h-full flex-col gap-3 p-5">
            {/* KARO BAŞLIĞIN YANINDA, kendi satırında değil. 52px'lik karo
                her kartta tek başına bir satır tutuyordu ve otuz bir kart
                yan yana gelince sayfada mavi kareden bir ızgara oluşuyordu —
                kartları birbirinden ayıran şey karonun İÇİNDEKİ işaret,
                karonun kendisi değil. Yana alınınca başlık kartın en üst
                satırına çıkıyor: okuyucunun taradığı şey o.

                Aynı düzen yazı sayfasının "Bunları da Oku" kartlarında da
                var; iki liste artık aynı dili konuşuyor. */}
            <div className="flex items-start gap-3">
              <GlyphTile glyph={article.glyph} size={40} />
              <h3 className="display-ink display-ink-tight min-w-0 flex-1 text-[17px] font-bold leading-[22px] tracking-[-0.025em] [text-wrap:balance]">
                {article.title}
              </h3>
              <span className="numeral shrink-0 text-[11px] font-bold text-muted">
                {String(startIndex + index + 1).padStart(2, "0")}
              </span>
            </div>

            <p className="flex-1 text-[13.5px] leading-[21px] text-body">
              {article.dek}
            </p>

            <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[12px] font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight weight="bold" size={13} />
              <span className="numeral ml-auto font-normal text-muted">
                {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
              </span>
            </p>
          </Panel>
        </Link>
      ))}
    </div>
  );
}
