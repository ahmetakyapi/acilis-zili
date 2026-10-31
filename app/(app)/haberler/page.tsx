import { PageShare } from "@/components/article/PageShare";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/news/NewsExperience.module.css";
import { Suspense } from "react";
import { headers } from "next/headers";
import { isBot } from "@/lib/analytics";
import { translateMissingLater } from "@/lib/translate";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { NewsImage } from "@/components/news/NewsImage";
import { NewsBriefingCard } from "@/components/news/NewsInsight";
import {
  getGenericImageUrls,
  getLatestNews,
  getNewsForSymbol,
  getSymbolNames,
} from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { insightsConfigured } from "@/lib/stock-insights";
import { headlineMentions, timeAgo, titleCaseLabel } from "@/lib/utils";
import feed from "@/components/news/NewsFeed.module.css";
import { DirectionFigure, HourHead, NewsPulseStrip } from "@/components/news/NewsFeedParts";
import { getStatus } from "@/lib/data";
import { groupByHour, newsPulse, pulseSentence } from "@/lib/feed-visuals";
import type { Locale } from "@/lib/i18n/config";
import { isSessionTrade } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { displayZone, formatInZone } from "@/lib/session-clock";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. OG kartının kısa cümlesi ayrı duruyor (kartta). */
export const generateMetadata = pageMetadata({
  path: "/haberler",
  /* ARAMA NİYETİ (25 Ekim): "Haberler" tek başına aranmıyor; başlık
     sayfanın ne olduğunu söylüyor. Ekrandaki başlık (h1) aynı kalıyor. */
  tr: {
    title: "ABD Borsası Haberleri",
    description:
      "ABD borsalarında işlem gören şirketlerin haberleri, Türkçe başlık ve özetle; her haberde adı geçen hisseler ve kaynağı.",
  },
  en: {
    title: "US Stock Market News",
    description:
      "Headlines on US-listed companies with their sources and the stocks each story mentions.",
  },
});

/**
 * SAYFA İKİ PARÇAYA BÖLÜNDÜ. Başlık ve süzgeç şeridi hemen akıyor, haber
 * listesi kendi `Suspense` sınırının içinde bekliyor.
 *
 * Eskiden sayfanın tamamı tek bir `await` zincirinin arkasındaydı ve rota
 * yükleme iskeleti (`app/(app)/loading.tsx`) jenerik olduğu için gezinme
 * sırasında ekranda sayfanın onda biri kadar bir taslak görünüyor, veri
 * gelince düzen zıplıyordu. Şimdi sınır listeye özel bir iskelet gösteriyor:
 * satır sayısı ve yükseklikler gerçek listeyle aynı, yani yer değişmiyor.
 */
export default async function NewsPage(props: PageProps<"/haberler">) {
  const search = await props.searchParams;
  const symbolFilter =
    typeof search.sembol === "string" ? search.sembol.toUpperCase() : null;

  const [{ t, locale }, userAgent] = await Promise.all([
    getI18n(),
    headers().then((h) => h.get("user-agent") ?? ""),
  ]);
  /* GÜNÜN GÜNDEMİ (17 Ekim): uzun akışın üstünde "bugün ne konuşuluyor"
     özeti; sembol süzgecinde basılmaz (süzülen liste zaten tek konu).
     Gerekçe lib/news-insights.ts.

     BOTA BASILMAZ (25 Ekim, CLS ölçümü). Kart yüklenirken notun
     ölçülmüş boyunu ayırıyor (`.loading`, 1280'de 780 piksel) ve uç
     (`/api/ai/haber-notu`) botu 403 ile geri çeviriyor: bot, başsız
     Chrome ve Lighthouse kutunun 780'den tek satırlık "alınamadı"ya
     çöktüğünü, altındaki listenin 759 piksel yukarı sıçradığını
     görüyordu. Üretimde 1280'de CLS 0,2634 (her üç ölçümde aynı,
     kaynak liste iskeleti 1180 → 421). Uç zaten vermeyeceği notun
     kutusunu açmıyoruz; kalıp ucun kendi `isBot` denetimi.

     Liste katmanına prop olarak iner: tepe şeridinin altında (25 Ekim,
     ekran düzeni sırası — gerekçe NewsList). */
  const briefing = !symbolFilter && insightsConfigured() && !isBot(userAgent)
    ? <NewsBriefingCard locale={locale} labels={t.newsInsight} />
    : null;

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      {/* KÜNYE VE SÜZGEÇ KAPAĞIN İÇİNDE. Kapak künyesizdi ve künye için
          ayrılan 18 piksellik satır boş basılıyordu, sağ yarısı da tümüyle
          boştu. Sembol süzgeci ise kapağın ALTINDA kendi şeridini açıyordu.
          İkisi kapağa girince bir şerit kalkıyor; yükseklik artmıyor.
          (9 Ekim 2026: üst künye bütün kapaklardan kalktı, boş satırın yer
          tutucusu da onunla — `PageHeader` yorumu.) */}
      <PageHeader
        share={<PageShare compactOnMobile align="right" path="/haberler" title={t.news.title} locale={locale} t={t} />}
        title={t.news.title}
        subtitle={t.news.subtitle}
        action={
          symbolFilter ? (
            <div className="flex items-center gap-2">
              <span className="numeral rounded-full bg-primary-wash px-3 py-1 text-sm font-medium text-primary-ink">
                {symbolFilter}
              </span>
              <Link href="/haberler" className="tap-44 text-xs text-muted hover:text-soft">
                {t.common.all}
              </Link>
            </div>
          ) : (
            /* Süzgeç yokken kapağın sağı boştu: masaüstünde yazılan bir
               gazete yaprağı. Telefonda gizli — orada başlık tek sütun ve
               çizim listeyi bir ekran aşağı itmekten başka iş görmezdi. */
            <InkCanvas scene="press" seed={3} className="hidden h-[84px] w-[134px] md:block" />
          )
        }
      />

      <QueryTransition label={t.common.loading}>
      <Suspense key={symbolFilter ?? "all"} fallback={<LoadingFallback label={t.common.loading}><NewsSkeleton pulse={!symbolFilter} /></LoadingFallback>}>
        <NewsList symbolFilter={symbolFilter} briefing={briefing} />
      </Suspense>
      </QueryTransition>
    </MotionExperience>
  );
}

/** Liste iskeleti — gerçek satırla aynı yükseklik, düzen zıplamasın. */
function NewsSkeleton({ pulse }: { pulse: boolean }) {
  return (
    <div className={feed.feed}>
      {/* Tepe şeridinin yeri (ölçüldü: 1440'ta ~250, 390'da ~290 piksel). */}
      {pulse && <span className="skeleton block h-[250px] rounded-(--radius-panel) max-md:h-[290px]" />}
      <ul className={styles.list}>
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index} className={styles.row}>
            <span className="min-w-0 flex-1">
              <span className="skeleton block h-4 w-[85%] rounded-md" />
              <span className="skeleton mt-2 block h-3 w-[60%] rounded-md" />
              <span className="skeleton mt-2.5 block h-3 w-32 rounded-md" />
            </span>
            <span className="skeleton size-14 shrink-0 rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

type NewsRow = Awaited<ReturnType<typeof getLatestNews>>[number];
type Names = Awaited<ReturnType<typeof getSymbolNames>>;

/**
 * AKIŞ ZAMAN ÇİZGİSİ (25 Ekim, sahibinin isteği: "liste hâlindeki yazılar
 * görsel olarak eksik ve okunamıyor"). Liste üç katmana ayrıldı:
 *
 *   1. Tepe cümlesi + "En Çok Konuşulan Şirketler" şeridi — akışın kaç
 *      haberi ve ne kadar zamanı kapsadığı, en çok hangi şirketlerin geçtiği
 *      (sayım `headlineMentions` süzgecinden geçen sembollerle; besleme
 *      üyeliği bir şirketten bahsetmek sayılmıyor, rozetle aynı ölçü).
 *   2. Öne çıkan haber — en yenisi, kendi bandında.
 *   3. Saat durakları — kalan haberler okurun dilimindeki saat başlıklarının
 *      altında (TR'de İstanbul, EN'de New York: `displayZone`).
 *
 * Kart künyesi: kaynak · saat (göreli "3 Saat Önce" yalnız öne çıkan
 * haberde; saat başlığı zaten zamanı söylüyor). Sembol rozeti son seansın
 * yüzdesini taşır — YALNIZ kotasyon bu seansa aitse ve paket tazeyse
 * (CLAUDE.md "Veri dürüstlüğü" 4: `isSessionTrade`; bayat paket hiç
 * yüzde basmaz). Sembol süzgecinde şerit ve cümle basılmaz: süzülen liste
 * zaten tek konu.
 *
 * Briefing (Claude'un "Günün Gündemi" notu) şeridin ALTINA indi: ekran
 * düzeni sırası başlık → künye şeridi → … → metin.
 */
async function NewsList({ symbolFilter, briefing }: { symbolFilter: string | null; briefing?: React.ReactNode }) {
  const { locale, t } = await getI18n();
  const F = t.feedVisuals.news;

  /* Sembol süzgeci VERİTABANINDA. Bir dönem en yeni 60 haber çekilip bellekte
     süzülüyordu ve sembol o pencerede geçmiyorsa sayfa "haber yok" diyordu —
     tabloda dünden kalan haberler dururken. Gerekçenin tamamı
     `getNewsForSymbol` yorumunda. */
  const items = symbolFilter
    ? await getNewsForSymbol(symbolFilter, 60)
    : await getLatestNews(60);

  /* Çevirisiz manşet yanıttan sonra çevrilir — gerekçe `translateMissingLater`. */
  translateMissingLater(items, locale);

  /* Kaynak logoları elenir; kalan makale görselleri küçük resim olarak durur.
     Görseli olmayan habere şirketin logosu konuyor — künye kutusunda sembol
     yazmaktansa haberin konusu olan şirketi göstermek listeyi taranabilir
     kılıyor. */
  const [genericImages, logos, status] = await Promise.all([
    getGenericImageUrls(items.map((item) => item.imageUrl)),
    getSymbolNames([...new Set(items.flatMap((item) => item.symbols ?? []))]),
    getStatus(),
  ]);

  /* Feed membership alone is not a company mention. Apply the same textual
     subject check already used for company logos. */
  const mentions = new Map(
    items.map((item) => [
      item.id,
      (item.symbols ?? []).filter((symbol) => headlineMentions(`${item.headline} ${item.summary ?? ""}`, symbol, logos[symbol]?.name)),
    ]),
  );
  const pulse = newsPulse(items.map((item) => ({ publishedAt: item.publishedAt, mentions: mentions.get(item.id) ?? [] })));
  const quoted = [...new Set([...mentions.values()].flatMap((list) => list.slice(0, 4)))];
  const quotes = quoted.length ? await getQuotes(quoted, status).catch(() => null) : null;
  const dayChange: Record<string, number> = {};
  if (quotes?.ok && !quotes.stale) {
    for (const [symbol, quote] of Object.entries(quotes.data)) {
      if (quote && quote.changePct !== null && isSessionTrade(quote.tradedAt, status)) dayChange[symbol] = quote.changePct;
    }
  }

  if (items.length === 0) {
    return <div className={feed.feed}>{briefing}<EmptyState title={t.news.empty} scene="press" /></div>;
  }

  const zone = displayZone(locale);
  const [lead, ...rest] = items;
  const groups = groupByHour(rest, zone);
  const dayLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { timeZone: "UTC", day: "numeric", month: "short" });
  const card = { locale, logos, genericImages, mentions, dayChange, zone };

  return (
    <div className={feed.feed}>
      {!symbolFilter && (
        <NewsPulseStrip
          pulse={pulse}
          sentence={pulseSentence(pulse, F)}
          names={logos}
          dayChange={dayChange}
          labels={F}
          locale={locale}
        />
      )}
      {briefing}
      <ul className={styles.list}>
        <NewsCard item={lead} lead {...card} />
      </ul>
      {groups.length > 0 && (
        <div className={feed.timeline} aria-label={F.timelineLabel} role="group" data-motion-stagger>
          {groups.map((group) => {
            const id = `saat-${group.key.replace(/[^0-9T]/g, "")}`;
            return (
              <section key={group.key} aria-labelledby={id} className={feed.hour}>
                <HourHead
                  id={id}
                  from={group.from}
                  to={group.to}
                  dayOffset={group.dayOffset}
                  dayLabel={dayLabel.format(new Date(`${group.day}T12:00:00Z`))}
                  count={group.items.length}
                  labels={F}
                />
                <ul className={styles.list}>
                  {group.items.map((item) => <NewsCard key={item.id} item={item} {...card} />)}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewsCard({
  item,
  lead = false,
  locale,
  logos,
  genericImages,
  mentions,
  dayChange,
  zone,
}: {
  item: NewsRow;
  lead?: boolean;
  locale: Locale;
  logos: Names;
  genericImages: Set<string>;
  mentions: Map<string, string[]>;
  dayChange: Record<string, number>;
  zone: string;
}) {
  const shownSymbols = mentions.get(item.id) ?? [];
  const symbol = item.symbols?.[0];
  const company = symbol ? logos[symbol] : null;
  /* Logo yalnızca haber gerçekten o şirketle ilgiliyse: `symbols` alanı
     bazen haberin konusunu değil, çekildiği beslemeyi söylüyor. */
  const logoUrl = symbol && company?.logoUrl && headlineMentions(item.headline, symbol, company.name) ? company.logoUrl : null;
  const imageUrl = item.imageUrl && !genericImages.has(item.imageUrl) ? item.imageUrl : null;
  const hasVisual = Boolean(imageUrl || logoUrl);
  const Title = lead ? "h2" : "h3";
  return (
    <li className={lead ? `${styles.cell} ${styles.lead}` : styles.cell}>
      <Link href={`/haberler/${item.id}`} prefetch={false} className={styles.row}>
        <div className={styles.copy}>
          {/* ÇEVRİLMEMİŞ SATIR KENDİ DİLİNİ TAŞIR. Türkçe sayfada çevirisi
              henüz gelmemiş haber orijinal İngilizce başlığıyla görünüyor
              (çeviri cron'da ve sağlayıcı anahtarı yoksa atlanıyor —
              lib/translate.ts). `lang` olmadan ekran okuyucu İngilizce
              cümleyi Türkçe sesletmeye çalışıyordu. */}
          {/* DEGRADE YALNIZ MANŞETTE (31 Ekim, görsel denetim: sayfada 70
              degrade başlık, 54'ü çok satırlı). Kural "kısa display başlık";
              akışın kart başlıkları düz mürekkep. */}
          <Title lang={locale === "tr" && !item.headlineTr ? "en" : undefined} className={styles.title} data-ink={lead ? "lines" : "plain"}>
            {locale === "tr" && item.headlineTr ? item.headlineTr : item.headline}
          </Title>
          {/* ÖZET SATIRI HER ZAMAN BASILIYOR — özeti olmayan haberde boş.
              Liste iki sütunlu bir ızgara ve satırlar kardeş haberle
              paylaşılıyor (CSS `.list`/`.cell` alt ızgarası); bir haberde
              özet hiç basılmazsa onun künye satırı bir satır yukarı çıkar ve
              yan yana duran iki haber aynı hattı paylaşmaz. */}
          <p lang={locale === "tr" && !item.summaryTr ? "en" : undefined} className={styles.summary}>
            {locale === "tr" && item.summaryTr ? item.summaryTr : item.summary}
          </p>
          <p className={styles.meta}>
            {item.source && <span className={feed.source}>{item.source}</span>}
            {item.source && <span aria-hidden>·</span>}
            <time dateTime={item.publishedAt.toISOString()} className={feed.clock}>
              {formatInZone(item.publishedAt, zone)}
            </time>
            {lead && (
              <>
                <span aria-hidden>·</span>
                <span>{titleCaseLabel(timeAgo(item.publishedAt, locale), locale)}</span>
              </>
            )}
            {shownSymbols.length > 0 && (
              <span className={feed.symbols}>
                {shownSymbols.slice(0, 4).map((sym) => (
                  <span key={sym} className={feed.sym}>
                    <span className={feed.symName}>{sym}</span>
                    <DirectionFigure pct={dayChange[sym]} locale={locale} />
                  </span>
                ))}
              </span>
            )}
          </p>
        </div>
        {/* Mobilde de görünür: küçük resim listeyi taranabilir yapan asıl
            şey. Görseli ya da doğrulanmış konu logosu olmayan haber düz
            metin düzeninde kalır (tekrarlanan boş karo yok). */}
        {hasVisual && <NewsImage className={styles.thumb} src={imageUrl} logoUrl={logoUrl} sizeClass="" />}
      </Link>
    </li>
  );
}
