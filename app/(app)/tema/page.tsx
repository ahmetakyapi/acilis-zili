import { cache, Suspense } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { RollingFigure } from "@/components/themes/RollingFigure";
import styles from "@/components/themes/Themes.module.css";
import { LogoGroup, SpreadStrip, type LogoMember, type SpreadPoint } from "@/components/themes/ThemeVisuals";
import { DataStamp } from "@/components/ui/primitives";
import { THEMES, themeDek, themeTitle } from "@/content/themes";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { median, sameSessionMoves } from "@/lib/theme-stats";
import { spreadScale } from "@/lib/theme-view";
import { KATILIM_MAX, katilimMembers, katilimPool, themeRow } from "@/lib/themes-data";
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
 * galeri iki ayrı Suspense sınırı ama ikisi de aynı `loadBoard`u okuyor
 * (`cache`, istek içinde tek hesap).
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
  const placeholders: ThemeCard[] = THEMES.map((theme) => ({
    theme,
    members:
      theme.symbols === "katilim"
        ? []
        : theme.symbols.map((symbol) => ({ symbol, logoUrl: logoSrc(symbol, null) })),
    count: theme.symbols === "katilim" ? null : theme.symbols.length,
    points: [],
    basis: null,
    median: null,
    up: null,
    down: null,
  }));

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
      />

      <Suspense
        fallback={
          <ThemeGallery
            board={{ cards: placeholders, scale: null, leader: null, laggard: null }}
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

type ThemeCard = {
  theme: (typeof THEMES)[number];
  members: LogoMember[];
  /** Katılım listesi taranana kadar üye sayısı bilinmiyor. */
  count: number | null;
  /** Medyana giren (aynı seansı anlatan) üyelerin hareketi. */
  points: SpreadPoint[];
  basis: "session" | "lastClose" | null;
  median: number | null;
  up: number | null;
  down: number | null;
};

type Board = {
  cards: ThemeCard[];
  /** Dağılım şeritlerinin ortak ölçeği; yedekte bilinmiyor. */
  scale: number | null;
  leader: string | null;
  laggard: string | null;
};

const loadBoard = cache(async function loadBoard() {
  const status = await getStatus();
  const pool = await katilimPool();

  const all = [
    ...new Set(THEMES.flatMap((theme) => (theme.symbols === "katilim" ? pool : [...theme.symbols]))),
  ];
  const [quotesResult, names] = await Promise.all([
    getQuotes(all, status),
    getSymbolNames(all),
  ]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const cards: ThemeCard[] = await Promise.all(
    THEMES.map(async (theme) => {
      const members =
        theme.symbols === "katilim"
          ? await katilimMembers(pool, quotes, names)
          : [...theme.symbols];
      const rows = members.map((symbol) => themeRow(symbol, quotes, names, status));
      const moves = sameSessionMoves(rows);
      const values = moves?.values ?? [];
      return {
        theme,
        members: rows.map((row) => ({ symbol: row.symbol, logoUrl: row.logoUrl })),
        count: members.length,
        points: moves
          ? rows.flatMap((row, i) =>
              moves.included[i] ? [{ symbol: row.symbol, change: row.changePct! }] : [],
            )
          : [],
        basis: moves?.basis ?? null,
        median: moves ? median(values) : null,
        up: moves ? values.filter((value) => value > 0).length : null,
        down: moves ? values.filter((value) => value < 0).length : null,
      };
    }),
  );

  /* Sıralama ve ortak ölçek yalnızca AYNI SEANSI anlatan medyanlardan:
     son kapanışa kalmış bir temanın medyanı bu seansın medyanlarıyla aynı
     çizgiye konmuyor. */
  const sessionCount = cards.filter((card) => card.basis === "session").length;
  const scaleBasis: "session" | "lastClose" = sessionCount > 0 ? "session" : "lastClose";
  const comparable = cards.filter((card) => card.basis === scaleBasis && card.median !== null);
  const scale = spreadScale(comparable.flatMap((card) => card.points.map((point) => point.change)));

  /* Günün öne çıkanı yalnızca canlı seansta ve en az iki tema varken:
     son kapanışa "günün en güçlüsü" demek dünü bugün diye anlatmak olurdu. */
  const ranked = scaleBasis === "session" && comparable.length >= 2
    ? [...comparable].sort((a, b) => b.median! - a.median!)
    : [];

  const board: Board = {
    cards,
    scale,
    leader: ranked[0]?.theme.slug ?? null,
    laggard: ranked.length > 1 ? ranked[ranked.length - 1].theme.slug : null,
  };
  return { board, scaleBasis, quotesResult };
});

async function LiveRanking({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis } = await loadBoard();
  return <ThemeRanking cards={board.cards} basis={scaleBasis} locale={locale} t={t} />;
}

async function LiveGallery({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, quotesResult } = await loadBoard();
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

/**
 * Kapaktaki sıralama — temalar medyana göre, sıfırdan iki yana açılan
 * çubuklarla. Ekran kuralı: karşılaştırılan büyüklük bir de ÇİZGİ olarak
 * okunur. Çubuk yalnızca aynı seansı anlatan medyanlara basılıyor; ötekiler
 * listenin dibinde sayısız duruyor.
 *
 * Yedek aynı on satırı editoryal sırayla ve çubuksuz basıyor: veri inince
 * yalnızca satırların sırası ve içi değişiyor, kutu değil.
 */
function ThemeRanking({
  cards,
  basis = null,
  locale,
  t,
}: {
  cards: ThemeCard[];
  basis?: "session" | "lastClose" | null;
  locale: Locale;
  t: Dictionary;
}) {
  const inScale = (card: ThemeCard) => basis !== null && card.basis === basis && card.median !== null;
  const sorted = basis
    ? [...cards].sort((a, b) => {
        if (inScale(a) !== inScale(b)) return inScale(a) ? -1 : 1;
        return (b.median ?? 0) - (a.median ?? 0);
      })
    : cards;
  const peak = Math.max(0, ...sorted.filter(inScale).map((card) => Math.abs(card.median!)));

  return (
    <div className={styles.rank}>
      <div className={styles.rankHead}>
        <h2>{t.themes.rankTitle}</h2>
        <span>
          {t.themes.median}
          {basis === "lastClose" ? ` · ${t.themes.medianLastClose}` : ""}
        </span>
      </div>
      <ol className={styles.rankList}>
        {sorted.map((card) => {
          const ratio = inScale(card) && peak > 0 ? card.median! / peak : null;
          const neutral = card.basis !== "session";
          return (
            <li key={card.theme.slug}>
              <Link href={`/tema/${card.theme.slug}`} prefetch={false} className={styles.rankRow}>
                <span className={styles.rankName}>{themeTitle(card.theme, locale)}</span>
                <span className={styles.rankTrack} aria-hidden>
                  {ratio !== null && ratio !== 0 && (
                    <i
                      className={styles.rankBar}
                      data-tone={neutral ? "flat" : ratio > 0 ? "up" : "down"}
                      data-motion-draw="line"
                      style={
                        ratio > 0
                          ? { left: "50%", width: `${ratio * 50}%`, transformOrigin: "left center" }
                          : { right: "50%", width: `${-ratio * 50}%`, transformOrigin: "right center" }
                      }
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "numeral",
                    styles.rankValue,
                    card.median === null
                      ? "text-muted"
                      : neutral
                        ? "text-body"
                        : directionText(directionOf(card.median)),
                  )}
                >
                  {card.median === null ? NO_VALUE : formatPercent(card.median, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Kart genişlikleri, 12 sütunlu ızgarada (1024 ve üstü). Dar ekranda
    hepsi tek ya da iki sütuna iniyor; sıra her zaman aynı. Yan yana iki
    kart her satırda 12'ye tamamlanıyor, eşit üçlü satır yok. */
const CARD_SPANS = [7, 5, 5, 7, 8, 4, 4, 8, 6, 6] as const;
/** Geniş kartta mozaik, dar kartta yığın — kaç logo sığıyor. */
const MOSAIC_MAX = 8;
const STACK_MAX = 6;
const WIDE_SPAN = 7;

function ThemeGallery({ board, locale, t }: { board: Board; locale: Locale; t: Dictionary }) {
  return (
    <ul className={styles.gallery} data-motion-stagger>
      {board.cards.map((card, index) => {
        const span = CARD_SPANS[index % CARD_SPANS.length];
        const wide = span >= WIDE_SPAN;
        const neutral = card.basis !== "session";
        const flag =
          card.theme.slug === board.leader
            ? t.themes.strongest
            : card.theme.slug === board.laggard
              ? t.themes.weakest
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
                      {t.themes.median}
                      {card.basis === "lastClose" ? ` · ${t.themes.medianLastClose}` : ""}
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
                  variant={wide ? "mosaic" : "stack"}
                  max={wide ? MOSAIC_MAX : STACK_MAX}
                  placeholder={katilim ? (wide ? MOSAIC_MAX : Math.min(STACK_MAX, KATILIM_MAX)) : 0}
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
