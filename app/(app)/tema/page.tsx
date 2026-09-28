import { Suspense } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { RollingFigure } from "@/components/themes/RollingFigure";
import styles from "@/components/themes/Themes.module.css";
import { LogoGroup, SpreadStrip } from "@/components/themes/ThemeVisuals";
import { ThemeRanking } from "@/components/themes/ThemeRanking";
import { DataStamp } from "@/components/ui/primitives";
import { themeDek, themeTitle } from "@/content/themes";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { loadThemeBoard, themePlaceholders, type ThemeBoard, type ThemeCard } from "@/lib/theme-board";
import { KATILIM_MAX } from "@/lib/themes-data";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/tema",
  tr: {
    title: "Tematik Hisse Listeleri",
    description:
      "Yapay zekâ, yarı iletkenler, siber güvenlik, nükleer enerji, uzay ve daha fazlası: temaya göre gruplanmış ABD hisseleri ve günün medyan hareketi.",
  },
  en: {
    title: "Thematic Stock Lists",
    description:
      "AI, semiconductors, cybersecurity, nuclear power, space and more: US stocks grouped by theme, with the day's median move.",
  },
});

/**
 * Temalar dizini — bir tema galerisi.
 *
 * TEK KOTASYON ÇAĞRISI: bütün temaların üyeleri tek anahtarda soruluyor
 * (`getQuotes` sıralı sembol dizesiyle önbellekli). NVDA üç temada birden
 * duruyor; üç ayrı çağrı üç ayrı fiyat anı demekti ve aynı hisse aynı
 * ekranda üç medyana üç farklı yüzdeyle girebilirdi. Kapaktaki sıralama ve
 * galeri iki ayrı Suspense sınırı ama ikisi de aynı `loadThemeBoard`u okuyor
 * (`cache`, istek içinde tek hesap). Hesap lib/theme-board.ts'te; ana
 * sayfanın temalar bandı da oradan okuyor.
 *
 * GÖRSEL DİL (28 Eylül). Önceki dizin on eşit kutuydu: başlık, bir cümle,
 * köşede küçük bir yüzde. Sahibi "görsel olarak çok zayıf" dedi. Kart artık
 * üç şeyi GÖSTERİYOR, yazmıyor: kimlerden oluştuğunu (logo yığını ya da
 * mozaiği), günün medyanını (büyük rakam) ve medyanın altındaki yayılımı
 * (her üye bir çentik). Kapaktaki sıralama "bugün hangi tema önde" sorusunu
 * uzunlukla cevaplıyor; kartlardaki eski ölçek çubuğu onun yerine geçti.
 *
 * Izgara ASİMETRİK ama VERİDEN BAĞIMSIZ: geniş ve dar kartlar sabit bir
 * ritimle diziliyor (`CARD_SPANS`). Kartların boyu ya da sırası medyana göre
 * değişseydi yedek ile canlı ızgara farklı olur, akışla gelen veri kartları
 * yerinden oynatırdı. Günün öne çıkanı yerini değil KÜNYESİNİ değiştiriyor.
 */
export default async function ThemesIndexPage() {
  const { locale, t } = await getI18n();

  /* SAYFA KOTASYONU BEKLEMİYOR (28 Eylül, ölçüldü). Dizin önce bütün
     temaların medyanını hesaplayıp sonra çiziyordu: soğuk önbellekte
     yaklaşık 150 sembolün kotasyonu ve Katılım havuzunun Finnhub taraması
     bitmeden tek bayt gitmiyordu, ilk bayt 1,5 saniye. Kartların metni ve
     elle seçilmiş temaların logoları durağan (content/themes.ts, depodaki
     logo dosyaları); yalnızca sayılar veriye bağlı. Yedek AYNI ızgarayı
     sayısız basıyor, sayılar akışla iniyor ve kartlar yerinden oynamıyor. */
  const placeholders = themePlaceholders();

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: t.themes.title, path: "/tema" }]} />
      <DirectoryHeader
        eyebrow={t.themes.eyebrow}
        title={t.themes.title}
        description={t.themes.subtitle}
        visual={
          <Suspense fallback={<ThemeRanking cards={placeholders} locale={locale} t={t} />}>
            <LiveRanking locale={locale} t={t} />
          </Suspense>
        }
      >
        <Suspense fallback={<HeroSummary summary={null} locale={locale} t={t} />}>
          <LiveHeroSummary locale={locale} t={t} />
        </Suspense>
      </DirectoryHeader>

      <Suspense
        fallback={
          <ThemeGallery
            board={{ cards: placeholders, scale: null, leader: null, laggard: null, phase: null }}
            locale={locale}
            t={t}
          />
        }
      >
        <LiveGallery locale={locale} t={t} />
      </Suspense>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["sektor-rotasyonu", "cesitlendirme"]}
      />
    </MotionExperience>
  );
}

async function LiveRanking({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis } = await loadThemeBoard();
  return <ThemeRanking cards={board.cards} basis={scaleBasis} phase={board.phase} locale={locale} t={t} />;
}

/**
 * Kapağın sol yarısındaki günün özeti (28 Eylül).
 *
 * Sağdaki on satırlık sıralama kapağı uzatıyordu ve sol yarıda başlık ile
 * tek cümlenin altında büyük bir boşluk kalıyordu (sahibinin geri
 * bildirimi). Boşluk esnetilmiyor, sıralamanın zaten söylediğinin ÖZETİYLE
 * doluyor: kaç tema yükseldi, kaç tema düştü, en güçlü ve en zayıf hangisi.
 * Veri `loadThemeBoard`dan, istek içinde önbellekli; yeni bir istek yok.
 *
 * En güçlü ve en zayıf YALNIZCA canlı seansta (galerideki künyeyle aynı
 * kural); son kapanışa kalmış günde sayılar nötr basılıyor ve "Son Kapanış"
 * diyor: dünü bugün diye anlatmıyor.
 */
type HeroSummaryData = {
  rising: number;
  falling: number;
  session: boolean;
  preMarket: boolean;
  leader: ThemeCard | null;
  laggard: ThemeCard | null;
};

async function LiveHeroSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis } = await loadThemeBoard();
  const comparable = board.cards.filter((card) => card.basis === scaleBasis && card.median !== null);
  const bySlug = (slug: string | null) => board.cards.find((card) => card.theme.slug === slug) ?? null;
  return (
    <HeroSummary
      summary={{
        rising: comparable.filter((card) => card.median! > 0).length,
        falling: comparable.filter((card) => card.median! < 0).length,
        session: scaleBasis === "session",
        preMarket: board.phase === "pre-market",
        leader: bySlug(board.leader),
        laggard: bySlug(board.laggard),
      }}
      locale={locale}
      t={t}
    />
  );
}

function HeroSummary({ summary, locale, t }: { summary: HeroSummaryData | null; locale: Locale; t: Dictionary }) {
  const count = (value: number | undefined, tone: "up" | "down") => (
    <strong
      className={cn(
        "numeral",
        styles.heroStatValue,
        value === undefined ? "text-muted" : summary?.session ? (tone === "up" ? "text-up" : "text-down") : "text-body",
      )}
    >
      {value === undefined ? NO_VALUE : value}
    </strong>
  );
  const extreme = (card: ThemeCard | null, label: string) => (
    <div className={styles.heroStat}>
      <span className={styles.heroStatLabel}>{label}</span>
      {card && card.median !== null ? (
        <span className={styles.heroExtreme}>
          <span className={styles.heroExtremeName}>{themeTitle(card.theme, locale)}</span>
          <b className={cn("numeral", directionText(directionOf(card.median)))}>{formatPercent(card.median, locale)}</b>
        </span>
      ) : (
        <strong className={cn("numeral text-muted", styles.heroStatValue)}>{NO_VALUE}</strong>
      )}
    </div>
  );
  return (
    <div className={styles.heroSummary}>
      <div className={styles.heroStat}>
        <span className={styles.heroStatLabel}>
          {t.themes.themesRising}
          {summary && !summary.session
            ? ` · ${t.themes.medianLastClose}`
            : summary?.preMarket
              ? ` · ${t.themes.medianPreMarket}`
              : ""}
        </span>
        {count(summary?.rising, "up")}
      </div>
      <div className={styles.heroStat}>
        <span className={styles.heroStatLabel}>{t.themes.themesFalling}</span>
        {count(summary?.falling, "down")}
      </div>
      {extreme(summary?.leader ?? null, summary?.preMarket ? t.themes.strongestPre : t.themes.strongest)}
      {extreme(summary?.laggard ?? null, summary?.preMarket ? t.themes.weakestPre : t.themes.weakest)}
    </div>
  );
}

async function LiveGallery({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, quotesResult } = await loadThemeBoard();
  return (
    <>
      <ThemeGallery board={board} locale={locale} t={t} />
      {quotesResult.ok ? (
        <DataStamp
          labels={t.data}
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      ) : (
        <p className="text-small text-muted">{t.themes.quotesUnavailable}</p>
      )}
    </>
  );
}

/** Kart genişlikleri, 12 sütunlu ızgarada (1024 ve üstü). Dar ekranda
    hepsi tek ya da iki sütuna iniyor; sıra her zaman aynı. Yan yana iki
    kart her satırda 12'ye tamamlanıyor, eşit üçlü satır yok. */
const CARD_SPANS = [7, 5, 5, 7, 8, 4, 4, 8, 6, 6] as const;
/** Geniş kartta mozaik, dar kartta yığın — kaç logo sığıyor. */
const MOSAIC_MAX = 8;
/* DAR KARTTA DA IZGARA (28 Eylül). Dar kartlar üst üste binen bir yığın
   kullanıyordu; logoların ayırıcı halkası kart zemininden farklı tondaydı
   ve karolar birbirine karışıp kırpılmış gibi okunuyordu ("+14" komşu
   logonun üstüne biniyordu). Dar kart artık dört sütunlu, iki satırlık
   ızgara: yedi logo ve "+N". */
const NARROW_MOSAIC_MAX = 7;
const WIDE_SPAN = 7;

function ThemeGallery({ board, locale, t }: { board: ThemeBoard; locale: Locale; t: Dictionary }) {
  return (
    <ul className={styles.gallery} data-motion-stagger>
      {board.cards.map((card, index) => {
        const span = CARD_SPANS[index % CARD_SPANS.length];
        const wide = span >= WIDE_SPAN;
        const neutral = card.basis !== "session";
        const pre = board.phase === "pre-market";
        const flag =
          card.theme.slug === board.leader
            ? pre ? t.themes.strongestPre : t.themes.strongest
            : card.theme.slug === board.laggard
              ? pre ? t.themes.weakestPre : t.themes.weakest
              : null;
        const katilim = card.theme.symbols === "katilim";
        return (
          <li key={card.theme.slug} className={styles.galleryItem} data-span={span}>
            <Link
              href={`/tema/${card.theme.slug}`}
              prefetch={false}
              className={styles.card}
              data-wide={wide || undefined}
            >
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{themeTitle(card.theme, locale)}</h2>
                <ArrowUpRight weight="bold" size={16} className={styles.cardArrow} aria-hidden />
              </div>
              <p className={styles.cardDek}>{themeDek(card.theme, locale)}</p>

              <div className={styles.cardBody}>
                <div className={styles.cardFigure}>
                  <span className={styles.figureLabel}>
                    <span>
                      {card.basis === "lastClose"
                        ? t.themes.medianClose
                        : pre
                          ? t.themes.medianPre
                          : t.themes.median}
                    </span>
                    {flag && <span className={styles.flag}>{flag}</span>}
                  </span>
                  <span
                    className={cn(
                      "numeral",
                      styles.figure,
                      card.median === null
                        ? "text-muted"
                        : neutral
                          ? "text-body"
                          : directionText(directionOf(card.median)),
                    )}
                  >
                    {card.median === null ? (
                      NO_VALUE
                    ) : (
                      <RollingFigure value={formatPercent(card.median, locale)} />
                    )}
                  </span>
                </div>
                <LogoGroup
                  members={card.members}
                  variant="mosaic"
                  max={wide ? MOSAIC_MAX : NARROW_MOSAIC_MAX}
                  placeholder={katilim ? (wide ? MOSAIC_MAX : Math.min(NARROW_MOSAIC_MAX, KATILIM_MAX)) : 0}
                />
              </div>

              <SpreadStrip
                points={card.points}
                median={card.median}
                basis={card.basis}
                scale={board.scale}
                locale={locale}
                label={
                  card.up === null
                    ? t.themes.spreadMissing
                    : t.themes.spreadLabel
                        .replace("{count}", String(card.points.length))
                        .replace("{up}", String(card.up))
                        .replace("{down}", String(card.down))
                }
              />

              <div className={styles.cardFoot}>
                <span>
                  {card.count === null
                    ? NO_VALUE
                    : t.themes.companies.replace("{count}", String(card.count))}
                </span>
                <span className={styles.breadth}>
                  {card.up === null ? (
                    NO_VALUE
                  ) : (
                    <>
                      <b className={cn("numeral", neutral ? "text-body" : "text-up")}>{card.up}</b>{" "}
                      {t.themes.up}
                      <span aria-hidden className={styles.breadthSep} />
                      <b className={cn("numeral", neutral ? "text-body" : "text-down")}>{card.down}</b>{" "}
                      {t.themes.down}
                    </>
                  )}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
