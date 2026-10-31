import { PageShare } from "@/components/article/PageShare";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { GuideHeroAction, GuideRoadmap, ReadMark, type RoadmapChapter } from "@/components/guide/GuideRoadmap";
import { ChapterIcon, chapterToneStyle } from "@/components/guide/chapter-tone";
import { levelRange } from "@/lib/guide-progress";
import guideStyles from "@/components/guide/GuideExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/motion/EditorialExperience.module.css";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GlyphTile } from "@/components/article/GlyphTile";
import { readingMinutes } from "@/components/article/ArticleBody";
import { EmptyState, Panel } from "@/components/ui/primitives";
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
import { plural } from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/rehber",
  tr: {
    title: "Rehber",
    description:
      "Borsayı anlatan yazılar — kavramdan stratejiye, kolaydan zora.",
  },
  en: {
    title: "Guide",
    description:
      "Writing that explains the market — from concept to strategy, easy to hard.",
  },
});

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
 * RENKLE AYRILMADI, bilerek — 25 Ekim'e kadar. O gün sitenin renk kararı
 * değişti (sahibi: "renkli olabilir ekranlar, hep renksiz de olmasın;
 * dengesini tutturalım"): renk serbest, yeter ki her yerde AYNI anlamı
 * taşısın. Bölüm artık bir kimlik rengi taşıyor (`chapter-tone.ts`,
 * grafik serileri ve pay tonu, pirinç hariç): yol haritasındaki durak, bölüm
 * başlığının kuralı ve ikonu, kartların seviye noktaları ve yazı
 * sayfasındaki şerit hep aynı tonda. Yön renkleri (yeşil/kırmızı) ve
 * etkileşim mavisi bu dörtlünün dışında; ton yalnız çizimde, metin metin
 * renginde kalıyor. Ölçü, kural ve boşluk ayrımı sürüyor; renk onların
 * üstüne bir tanıma katmanı.
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

  /* MÜFREDATTAKİ KONUM TÜRETİLİYOR, yazılmıyor. Sayfa dört konuyu kolaydan
     zora sıralı bir müfredat olarak sunuyor ama okuyucu bir bölümün o
     dizide nereye düştüğünü bilmiyordu. Konum `content/guide/index.ts`teki
     sıralama kuralının çıktısı — orası değişirse künye de değişir. */
  const chapters = roadmapChapters(groupOf, minutesOf, locale);
  const totalMinutes = chapters.reduce((sum, chapter) => sum + chapter.minutes, 0);

  const konumKunyesi = (key: GuideTopicKey) => {
    const group = groupOf(key);
    if (group.length === 0) return undefined;
    const from = all.findIndex((article) => article.topic === key) + 1;
    return t.guide.curriculumRange
      .replace("{from}", String(from))
      .replace("{to}", String(from + group.length - 1));
  };

  return (
    /* Bölümler arası boşluk sayfanın ritmini kuruyor: kartlar arası 16px,
       seviye bantları arası 20px, bölümler arası 40px. Üç ayrı ölçek, üç
       ayrı düzey. */
    <MotionExperience className={`${styles.guidePage} ${guideStyles.guide}`}>
      <ScrollProgress />
      {/* KAPAK VE YOL HARİTASI TEK KART (25 Ekim, ikinci tur). Kapak
          (~190 px, sağında "Baştan Başla" kartı) ve altındaki "Nereden
          Başlamalı" paneli (~450 px) ayrı iki kutuydu; 1440×900'de ilk
          bölümün başlığı y=759'a, yazıları ilk ekranın dışına düşüyordu.
          Şimdi tek kapak: küçük başlık, tek cümle, sağda birincil eylem
          (degrade, ekosistemin "üç yer"inden biri) ve altında dört durak.
          Panelin başlığı ekran okuyucu için duruyor (`sr-only` h2); görünür
          açıklaması kapağın cümlesine katlandı. Eski kapağın sağındaki
          "23 Eylül" kartının işi (ilk yazı + müfredatın ölçüsü) birincil
          eylemin altındaki satırda. Filtreli hâlde (?konu=) duraklar yok:
          okuyucu tek bölümü seçmiş. */}
      <header className={`page-masthead ${guideStyles.hero}`} data-embedded="false">
        <div className={guideStyles.heroTop}>
          <div className={`page-heading-copy page-title-row ${guideStyles.heroTitle}`}>
            <h1>{t.guide.title}</h1>
            <div className="page-title-actions">
              <PageShare compactOnMobile align="right" path="/rehber" title={t.guide.title} locale={locale} t={t} />
            </div>
          </div>
          <p className={guideStyles.heroLead}>{t.guideVisuals.heroLead}</p>
          <div className={guideStyles.heroAction}>
            <GuideHeroAction
              chapters={chapters}
              totalMinutes={totalMinutes}
              startLabel={t.guide.startFirst}
              labels={t.guideVisuals}
            />
          </div>
        </div>
        {!activeTopic && (
          <section aria-labelledby="rehber-yol" className={guideStyles.heroRoad}>
            <h2 id="rehber-yol" className="sr-only">
              {t.guide.curriculum}
            </h2>
            <GuideRoadmap chapters={chapters} labels={t.guideVisuals} />
          </section>
        )}
      </header>

      <QueryTransition label={t.common.loading}>
      {activeTopic ? (
        <TopicView
          topic={activeTopic}
          articles={groupOf(activeTopic)}
          locale={locale}
          t={t}
        />
      ) : (
        <>
          {GUIDE_TOPICS.map((topic, index) => {
            const group = groupOf(topic.key);
            if (group.length === 0) return null;
            return (
              /* ÇAPA PAYI BURADA VERİLMİYOR. `html { scroll-padding-block }`
                 (app/globals.css) payı zaten veriyor ve o da `--app-bar-h`
                 ile aynı formülü izliyor; buradaki `scroll-mt-20` onun
                 ÜSTÜNE ekleniyordu, yani çentikli bir telefonda bölüm başlığı
                 çubuğun ~87 piksel altına düşüyordu. Tek kaynak: globals. */
              <section
                key={topic.key}
                id={`konu-${topic.key}`}
                data-guide-topic
                className="flex flex-col"
                style={chapterToneStyle(topic.key)}
              >
                <TopicHeading
                  index={index}
                  topic={topic.key}
                  articles={group}
                  minutes={minutesOf(group)}
                  position={konumKunyesi(topic.key)}
                  locale={locale}
                  t={t}
                />
                <LeveledGrid articles={group} locale={locale} t={t} />
              </section>
            );
          })}
        </>
      )}
      </QueryTransition>
    </MotionExperience>
  );
}

/** Konudaki seviyeler, kolaydan zora ve yalnızca gerçekten kullanılanlar. */
function levelsIn(articles: GuideArticle[]): GuideLevel[] {
  return GUIDE_LEVELS.filter((level) =>
    articles.some((article) => article.level === level),
  );
}

/**
 * Yol haritasının bölümleri (25 Ekim). Dört konu bir patika üzerinde,
 * okunan yazılar tarayıcıdan (`components/guide/GuideRoadmap.tsx`).
 *
 * Eski şerit dört eş karoydu: sıra yalnız köşedeki numaradan, ilerleme hiç
 * okunmuyordu. Durak yine bölüm başlığının SÖYLEMEDİĞİNİ söylüyor — zorluk
 * aralığı ve okuma durumu; kapsam (yazı, süre) iki yerde de var ama burada
 * ölçek, başlıkta künye olarak. Duraklar hâlâ sayfa içi çapalara gidiyor:
 * yeni gelen okuyucunun sorusu "nereden başlayayım", süzgeç değil.
 */
function roadmapChapters(
  groupOf: (key: GuideTopicKey) => GuideArticle[],
  minutesOf: (articles: GuideArticle[]) => number,
  locale: Locale,
): RoadmapChapter[] {
  return GUIDE_TOPICS.map((topic) => {
    const group = groupOf(topic.key);
    const levels = levelsIn(group);
    return {
      key: topic.key,
      label: guideTopicLabel(topic.key, locale),
      minutes: minutesOf(group),
      levelSpan: levelSpan(levels, locale),
      levelRange: levelRange(levels, GUIDE_LEVELS),
      articles: group.map((article) => ({ slug: article.slug, title: article.title })),
    };
  }).filter((chapter) => chapter.articles.length > 0);
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
 * taşımak satırı kalınlaştırıyordu. 25 Ekim'de 28 piksellik bir İKON
 * karosu geri geldi: numaranın değil bölümün işareti (durak kartındaki
 * ikonun aynısı) ve satır yüksekliğini aşmıyor — 25 piksellik başlık
 * satırı zaten 30 piksel.
 */
function TopicHeading({
  index,
  topic,
  articles,
  minutes,
  position,
  locale,
  t,
}: {
  index: number;
  topic: GuideTopicKey;
  articles: GuideArticle[];
  minutes: number;
  /** "müfredatın 9–17. yazısı" — türetilmiş konum künyesi. */
  position?: string;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = levelsIn(articles);

  return (
    <>
      {/* z-20: gerekçe EarningsCalendar.tsx içinde — eşit z-index'te
          sonraki eleman kazanıyor ve kart içeriği başlığın üstüne çıkıyor. */}
      <div className={`${styles.topicHeading} ${guideStyles.topicSticky} sticky top-(--app-bar-h) z-20 bg-page pt-1`}>
        {/* 2px'lik kural — sayfadaki tek kalın çizgi; hairline denendi ve
            kartların kendi kenarlıklarından ayırt edilmiyordu. 25 Ekim'den
            beri BÖLÜMÜN TONUNDA (`--ch`): yapışkan satır kaydırırken hangi
            bölümde olduğunu renkle de söylüyor, durak kartıyla aynı renk. */}
        {/* YAPIŞKAN SATIRDA YALNIZCA ÜÇ ÖĞE. Beş öğe vardı — numara,
            başlık, sayaç, seviye rozeti ve "Konuyu Aç" — ve `flex-wrap` ile
            telefonda üç satıra kırılıyordu: 320 pikselde bütçe 325 piksel
            istiyordu, kanal 284. Yapışkan bir başlığın kırılması ekranın
            tepesini yiyor. İkon karosu (28 px, durak kartındaki ikon),
            numara ve ad; satır kırılmıyor (ölçüm raporda). */}
        <div className={guideStyles.topicRow}>
          <span aria-hidden className={guideStyles.topicIcon}>
            <ChapterIcon chapter={topic} size={17} weight="duotone" />
          </span>
          <span aria-hidden className={`numeral ${guideStyles.topicNo}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="display-ink display-ink-tight min-w-0 text-title font-bold tracking-[-0.03em]">
            {guideTopicLabel(topic, locale)}
          </h2>
        </div>
      </div>
      {/* Künye satırı YAPIŞKAN DEĞİL: sayaç, süre, müfredattaki konum,
          seviye ve konuya giden bağlantı. Konum türetiliyor — hangi yazının
          kaçıncı olduğu `content/guide/index.ts`teki sıralama kuralının
          çıktısı, elle yazılmış bir sayı değil. Açıklama hemen altında;
          künye ile açıklama arası 4, açıklama ile kartlar arası 14 piksel
          (önceki 12 + 20): ilk bölümün yazıları ilk ekrana bu payla
          giriyor. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-1">
        <span className="numeral text-tiny text-muted">
          {articles.length}{" "}
          {plural(articles.length, t.guide.articleOne, t.guide.articleMany)} · ~
          {minutes} {t.guide.readMinutes}
          {position && (
            <>
              <span aria-hidden className="mx-1">
                ·
              </span>
              {position}
            </>
          )}
        </span>
        <span className="flex items-center gap-3">
          {/* Tek seviyeli konuda bant basılmıyor; seviye buraya çıkıyor. */}
          {levels.length === 1 && <LevelTag level={levels[0]} locale={locale} />}
          <Link
            href={`/rehber?konu=${topic}`}
            scroll={false}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-small font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-8"
          >
            {t.guide.onlyThis}
            <ArrowRight weight="bold" size={12} aria-hidden />
          </Link>
        </span>
      </div>
      {/* Geniş ekranda 96ch (25 Ekim, doğrulama turu): tek cümle; 72ch
          tavanında EN açıklama iki satıra kırılıp ilk sıra kartları 1280×800'de
          ilk ekranın dışına itiyordu (ölçüm GuideRoadmap.module.css →
          "1024–1439"). */}
      <p className="mb-3.5 max-w-[72ch] text-base leading-[20px] text-soft lg:max-w-[96ch]">
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
    <section className="flex flex-col gap-5" style={chapterToneStyle(topic)}>
      {/* Tek konu görünümünde başlık YAPIŞKAN DEĞİL: kaydırırken ayırt
          edilecek ikinci bir bölüm yok, asılı kalan bir satır yalnızca yer
          kaplardı. Kural ve iri numara duruyor — iki görünüm birbirinin
          devamı gibi okunsun. */}
      <div className="flex flex-col gap-2.5">
        <Link
          href="/rehber"
          scroll={false}
          className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft weight="bold" size={12} />
          {t.guide.allTopics}
        </Link>
        <div className={`${guideStyles.topicRow} flex-wrap gap-y-1`}>
          <span aria-hidden className={guideStyles.topicIcon}>
            <ChapterIcon chapter={topic} size={17} weight="duotone" />
          </span>
          <span aria-hidden className={`numeral ${guideStyles.topicNo}`}>
            {String(GUIDE_TOPICS.findIndex((entry) => entry.key === topic) + 1).padStart(2, "0")}
          </span>
          <h2 className="display-ink display-ink-tight w-fit text-title font-bold tracking-[-0.03em]">
            {guideTopicLabel(topic, locale)}
          </h2>
          <span className="numeral text-small text-muted">
            {articles.length}{" "}
            {plural(articles.length, t.guide.articleOne, t.guide.articleMany)}
          </span>
          {levels.length === 1 && <LevelTag level={levels[0]} locale={locale} />}
        </div>
        <p className="max-w-[72ch] text-base leading-[20px] text-soft">
          {guideTopicDesc(topic, locale)}
        </p>
      </div>

      {articles.length === 0 ? (
        <Panel>
          <EmptyState title={t.guide.empty} scene="lens" />
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
    <div className="flex flex-col gap-4">
      {bands.map((band) => (
        <div key={band.level} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <LevelTag level={band.level} locale={locale} />
            <span className="numeral text-tiny text-muted">
              {band.articles.length}{" "}
              {plural(band.articles.length, t.guide.articleOne, t.guide.articleMany)}
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
    <>
      {/* ---- Telefon: TEK PANEL, SATIRLAR ----
          Kart ızgarası 640 pikselden önce bağlamıyor, yani telefonda otuz
          bir kart tek sütunda alt alta diziliyordu: her biri 20 piksel
          dolgulu, kendi kenarlıklı ve altında "Oku →" satırı olan bir kutu.
          O satır bilgi taşımıyor — kartın tamamı zaten bağlantı — ve otuz
          bir kutu, listeyi bir müfredat olmaktan çıkarıp bir kart denizine
          çeviriyordu. Satır düzeni sırayı da gösteriyor: solda sıra numarası
          ve onları birbirine bağlayan ince bir dikey çizgi.

          İKİ AYRI DOM, bilerek: `.panel` bir utility değil bir bileşen
          sınıfı, yani `sm:panel` yazılamıyor ve tek ağaçla iki düzen
          kurulamıyor. `hidden` = `display:none` olduğu için erişilebilirlik
          ağacında yalnızca biri kalıyor ve ikisi de sunucuda çiziliyor —
          istemciye fazladan JS gitmiyor.

          GLİF TELEFONDA DÜŞÜYOR: tek sütunda otuz bir karo, kart
          düzeninin şikâyet ettiği "mavi kare ızgarası"nın dikey hâli
          olurdu. Dizin ekranında sıra numarası glifden çok iş yapıyor. */}
      <Panel className={`${styles.guideMobile} flex flex-col divide-y divide-line-soft overflow-hidden sm:hidden`} data-motion-stagger>
        {articles.map((article, index) => (
          <Link
            key={article.slug}
            href={`/rehber/${article.slug}`}
            prefetch={false}
            className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-primary-tint"
          >
            {/* Numara bölüm tonunda bir pulun içinde, pulları bağlayan
                çizgi de o tonda (25 Ekim): telefonda durak kartıyla aynı
                rengi taşıyan tek öğe bu. Rakam metin renginde. */}
            <span className={`relative flex w-7 shrink-0 justify-center ${guideStyles.rowRail}`}>
              <span className={`numeral relative ${guideStyles.rowNo}`}>
                {String(startIndex + index + 1).padStart(2, "0")}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              {/* Süre başlığın sağında: dipte ayrı bir satır tutuyordu. */}
              <span className="flex items-baseline justify-between gap-3">
                <span className="block min-w-0 text-read font-bold leading-[19px] text-strong">
                  {article.title}
                </span>
                <span className="numeral flex shrink-0 items-center gap-1.5 text-tiny text-muted">
                  <ReadMark slug={article.slug} label={t.guideVisuals.readMark} />
                  {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
                </span>
              </span>
              <span className="mt-1 line-clamp-2 block text-tiny leading-[15px] text-muted">
                {article.dek}
              </span>
            </span>
          </Link>
        ))}
      </Panel>

      {/* ---- Masaüstü: kart ızgarası ----
          KOMPAKT, 1280'den itibaren DÖRT SÜTUN (25 Ekim). Kart 24 piksel
          dolgulu, 40 piksellik karolu ve tam açıklamalıydı; 1440'ta üç
          sütunda bir satır ~170 piksel tutuyordu ve ilk bölümün ilk satırı
          ilk ekrana girmiyordu. Şimdi 16 piksel dolgu, 36 piksellik karo,
          iki satırla sınırlı açıklama ve dipte tek künye satırı: sıra
          numarası, bölüm tonunda seviye noktaları, süre, okundu işareti.

          YETİM KART YOK (31 Ekim, rehber ve sözlüğün görsel turu). Bant
          kendi ızgarası olduğu için dokuz yazılık bir bantta son kart dört
          sütunun birinde yalnız kalıyor, iki yazılık bantta satırın yarısı
          boş duruyordu (1440'ta yedi bantın beşinde). Sütunlar artık on iki
          izli bir ızgara ve son satır her zaman dolu: tek kalan kart satırı
          boydan kaplayıp yatay düzene geçiyor, iki kalan yarı yarıya, üç
          kalan üçte bir. Kurallar GuideExperience.module.css → "Son satır". */}
      <div className={`${styles.articleGrid} ${guideStyles.cardGrid} hidden gap-3 sm:grid`} data-motion-stagger>
      {articles.map((article, index) => (
        <Link
          key={article.slug}
          href={`/rehber/${article.slug}`}
          prefetch={false}
          data-guide-card
          /* ÜÇ BLOK, ÜÇ PAYLAŞILAN SATIR. Kart dikey bir yığındı: başlık,
             açıklama, okuma süresi. Başlık kimi kartta tek kimi kartta iki
             satır ve yan yana duran kartların açıklamaları 26 piksel
             kayıyordu (1024'te ölçüldü); okuma süresi `mt-auto` ile dibe
             yapıştığı için yalnızca O hizalıydı. Alt ızgara blokları
             kardeş kartlarla aynı satıra bağlıyor — iki satırlık bir başlık
             satırdaki bütün açıklamaları birlikte aşağı indiriyor.
             Bağlantı ile panel iki ayrı katman, o yüzden alt ızgara İKİSİNDE
             de bildiriliyor: zincir kırılırsa satırlar yine kart içinde
             kalır. 25 Ekim'den beri üç satır: künye dibe döndü, çünkü
             açıklama iki satırla sınırlı ve künye artık dört öğe taşıyor. */
          className={`${styles.guideCard} ${guideStyles.card} row-span-3 grid min-w-0 grid-rows-subgrid`}
        >
          <Panel className="panel-hover row-span-3 grid grid-rows-subgrid">
            {/* KARO BAŞLIĞIN YANINDA, kendi satırında değil. 52px'lik karo
                her kartta tek başına bir satır tutuyordu ve otuz bir kart
                yan yana gelince sayfada mavi kareden bir ızgara oluşuyordu —
                kartları birbirinden ayıran şey karonun İÇİNDEKİ işaret,
                karonun kendisi değil. Yana alınınca başlık kartın en üst
                satırına çıkıyor: okuyucunun taradığı şey o.

                Aynı düzen yazı sayfasının "Bunları da Oku" kartlarında da
                var; iki liste artık aynı dili konuşuyor. */}
            <div className="flex items-start gap-3">
              <GlyphTile glyph={article.glyph} size={36} />
              <h3 className="display-ink display-ink-tight min-w-0 flex-1 text-read font-bold leading-[20px] tracking-[-0.02em] [text-wrap:balance]">
                {article.title}
              </h3>
            </div>

            {/* Açıklama iki satırla sınırlı: dört sütunda tam metin kartı
                yarı yarıya uzatıyordu. Kesilen metnin tamamı yazının kapağında. */}
            <p className="line-clamp-2 text-small leading-[18px] text-body">
              {article.dek}
            </p>

            {/* Künye: sıra, seviye, süre, okundu. Seviye bandı varken de
                nokta duruyor — dört sütunlu ızgarada bant başlığı çoğu
                kartın iki satır yukarısında kalıyor. */}
            <div className={guideStyles.cardFoot}>
              <span className="numeral font-bold text-strong">
                {String(startIndex + index + 1).padStart(2, "0")}
              </span>
              <LevelPips level={article.level} />
              <span className="numeral">
                {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
              </span>
              <span className="ml-auto inline-flex">
                <ReadMark slug={article.slug} label={t.guideVisuals.readMark} />
              </span>
            </div>
          </Panel>
        </Link>
      ))}
      </div>
    </>
  );
}

/**
 * Seviye noktaları bölüm tonunda (25 Ekim). `LevelBadge`in noktaları
 * sitenin mavisinde; bölümler renk kimliği alınca mavi nokta mor bir
 * bölümün içinde yabancı duruyordu. Basamak aynı: kaç nokta dolu.
 */
function LevelPips({ level }: { level: GuideLevel }) {
  const filled = GUIDE_LEVELS.indexOf(level) + 1;
  return (
    <span aria-hidden className={guideStyles.pips}>
      {GUIDE_LEVELS.map((step, index) => (
        <i key={step} data-on={index < filled ? "" : undefined} />
      ))}
    </span>
  );
}

/** Bant ve tek seviyeli bölümün etiketi: noktalar + seviye adı. */
function LevelTag({ level, locale }: { level: GuideLevel; locale: Locale }) {
  return (
    <span className={guideStyles.levelTag}>
      <LevelPips level={level} />
      {guideLevelLabel(level, locale)}
    </span>
  );
}
