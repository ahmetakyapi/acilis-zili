import { PageShare } from "@/components/article/PageShare";
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
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, LogoTile } from "@/components/ui/primitives";
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
        share={<PageShare path="/tema" title={t.themes.title} locale={locale} t={t} />}
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
 *
 * DÖRT KUTU YERİNE TEK YÜZEY (29 Eylül, sahibinin isteği: "görselliği daha
 * üst seviyeye"). Dört eşit kutu sağdaki sıralamanın sayılarını ikinci kez
 * YAZIYORDU. Özet artık sıralamanın söylemediğini gösteriyor: yükselen ve
 * düşen tema sayısı tek bir ORAN ÇUBUĞU (sıralama her temayı ayrı ayrı
 * çiziyor, kaç tanesinin artıda olduğunu okutmuyor) ve iki uç temanın
 * kimlerden oluştuğu (logolar). Hepsi aynı `comparable` kümesinden; çubuk
 * sayılarla aynı üç parçayı (yükselen, yatay, düşen) orantılı çiziyor.
 * Kutu değil ton: tek çukur yüzey, bölümler hairline ile ayrılıyor.
 */
type HeroSummaryData = {
  rising: number;
  falling: number;
  /** Ortak kümedeki tema sayısı — medyanı tam sıfır olan tema ikisine de girmiyor. */
  total: number;
  session: boolean;
  preMarket: boolean;
  lastClose: boolean;
  leader: ThemeCard | null;
  laggard: ThemeCard | null;
};

/** Uç temanın yanında gösterilen logo sayısı. 1440'ta satır 262 piksel:
    dört 22'lik logo (100) + ad + yüzde sığıyor; beşincide "Nükleer,
    Elektrik ve Şebeke" gibi uzun ad iki harfe iniyordu. */
const EXTREME_LOGOS = 4;

async function LiveHeroSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis } = await loadThemeBoard();
  const comparable = board.cards.filter((card) => card.basis === scaleBasis && card.median !== null);
  const bySlug = (slug: string | null) => board.cards.find((card) => card.theme.slug === slug) ?? null;
  return (
    <HeroSummary
      summary={{
        rising: comparable.filter((card) => card.median! > 0).length,
        falling: comparable.filter((card) => card.median! < 0).length,
        total: comparable.length,
        session: scaleBasis === "session",
        preMarket: board.phase === "pre-market",
        lastClose: board.phase === "lastClose",
        leader: bySlug(board.leader),
        laggard: bySlug(board.laggard),
      }}
      locale={locale}
      t={t}
    />
  );
}

function HeroSummary({ summary, locale, t }: { summary: HeroSummaryData | null; locale: Locale; t: Dictionary }) {
  const tone = (kind: "up" | "down") =>
    summary === null ? "text-muted" : summary.session ? (kind === "up" ? "text-up" : "text-down") : "text-body";
  const total = summary?.total ?? 0;
  const flat = total - (summary?.rising ?? 0) - (summary?.falling ?? 0);
  const neutral = !summary?.session;

  const extreme = (card: ThemeCard | null, label: string) =>
    card && card.median !== null ? (
      <Link href={`/tema/${card.theme.slug}`} prefetch={false} className={styles.heroExtreme}>
        <span className={styles.heroExtremeHead}>
          <span className={styles.heroLabel}>{label}</span>
          <b className={cn("numeral", styles.heroExtremePct, directionText(directionOf(card.median)))}>
            {formatPercent(card.median, locale)}
          </b>
        </span>
        <span className={styles.heroExtremeBody}>
          <span className={styles.heroLogos} aria-hidden>
            {card.members.slice(0, EXTREME_LOGOS).map((member) => (
              <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="xs" />
            ))}
          </span>
          <span className={styles.heroExtremeName}>{themeTitle(card.theme, locale)}</span>
        </span>
      </Link>
    ) : (
      /* Yedekte ve seans dışında aynı iki satır: veri inince kapak oynamıyor. */
      <div className={styles.heroExtreme}>
        <span className={styles.heroExtremeHead}>
          <span className={styles.heroLabel}>{label}</span>
          <b className={cn("numeral text-muted", styles.heroExtremePct)}>{NO_VALUE}</b>
        </span>
        <span className={styles.heroExtremeBody}>
          <span className={cn(styles.heroExtremeName, "text-muted")}>{NO_VALUE}</span>
        </span>
      </div>
    );

  return (
    <div className={styles.heroSummary}>
      <div className={styles.heroBreadth}>
        <div className={styles.heroBreadthHead}>
          <span className={styles.heroLabel}>
            {t.themes.themesBreadth}
            {summary && (!summary.session || summary.lastClose)
              ? ` · ${t.themes.medianLastClose}`
              : summary?.preMarket
                ? ` · ${t.themes.medianPreMarket}`
                : ""}
          </span>
          <span className={styles.heroCounts}>
            <b className={cn("numeral", tone("up"))}>{summary ? summary.rising : NO_VALUE}</b>
            {t.themes.up}
            <span aria-hidden className={styles.breadthSep} />
            <b className={cn("numeral", tone("down"))}>{summary ? summary.falling : NO_VALUE}</b>
            {t.themes.down}
          </span>
        </div>
        {/* Oranın çizgisi: yükselen soldan, düşen sağdan; yatay kalan
            ortada. Nötr kümede yön rengi yok ama iki parça iki tonda
            kalıyor — oran son kapanışta da okunur. */}
        <span className={styles.ratio} aria-hidden>
          {total > 0 && (
            <>
              {summary!.rising > 0 && (
                <i
                  data-tone={neutral ? "neutral-up" : "up"}
                  data-motion-draw="line"
                  style={{ flexGrow: summary!.rising, transformOrigin: "left center" }}
                />
              )}
              {flat > 0 && <i data-tone="flat" style={{ flexGrow: flat }} />}
              {summary!.falling > 0 && (
                <i
                  data-tone={neutral ? "neutral-down" : "down"}
                  data-motion-draw="line"
                  style={{ flexGrow: summary!.falling, transformOrigin: "right center" }}
                />
              )}
            </>
          )}
        </span>
      </div>
      <div className={styles.heroExtremes}>
        {extreme(
          summary?.leader ?? null,
          summary?.preMarket ? t.themes.strongestPre : summary?.lastClose ? t.themes.strongestClose : t.themes.strongest,
        )}
        {extreme(
          summary?.laggard ?? null,
          summary?.preMarket ? t.themes.weakestPre : summary?.lastClose ? t.themes.weakestClose : t.themes.weakest,
        )}
      </div>
    </div>
  );
}

async function LiveGallery({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, quotesResult, names, status } = await loadThemeBoard();
  return (
    <>
      <ThemeGallery board={board} locale={locale} t={t} />
      {/* Kart kaydı yalnızca GÖRÜNEN logolar için; fiyat galerinin kendi
          paketinden. Görünen sayı `LogoGroup`un kuralıyla: tam bir fazla
          üye varsa "+1" yerine o üyenin logosu basılıyor, yani dokuz
          üyeli temada dokuz logo. Kayıt `MOSAIC_MAX`ta kesildiğinde
          dokuzuncu logo (Uzay'da KTOS) kart açmıyordu (28 Eylül denetimi). */}
      <CompanyCards
        symbols={board.cards.flatMap((card) =>
          card.members
            .slice(0, card.members.length === MOSAIC_MAX + 1 ? MOSAIC_MAX + 1 : MOSAIC_MAX)
            .map((member) => member.symbol),
        )}
        quotes={quotesResult.ok ? quotesResult.data : null}
        stale={quotesResult.ok && Boolean(quotesResult.stale)}
        names={names}
        status={status}
      />
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
        const closed = board.phase === "lastClose";
        const flag =
          card.theme.slug === board.leader
            ? pre ? t.themes.strongestPre : closed ? t.themes.strongestClose : t.themes.strongest
            : card.theme.slug === board.laggard
              ? pre ? t.themes.weakestPre : closed ? t.themes.weakestClose : t.themes.weakest
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
                  card
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

              {/* YÖN ORANI ÇİZGİ OLARAK (29 Eylül). "2 Yükselen · 15 Düşen"
                  yalnızca metindi; iki sayıyı kafada orana çevirmek
                  gerekiyordu. Çubuk aynı iki sayıyı (ve sıfırda kalanları)
                  uzunluk olarak çiziyor, şeridin çentikleriyle AYNI küme
                  (`card.points`). Yedekte ray boş ama yerinde: sayılar inince
                  dip satırı oynamıyor. */}
              <div className={styles.cardFoot}>
                <span>
                  {card.count === null
                    ? NO_VALUE
                    : t.themes.companies.replace("{count}", String(card.count))}
                </span>
                <span className={cn(styles.ratio, styles.cardRatio)} aria-hidden>
                  {card.up !== null && card.points.length > 0 && (
                    <>
                      {card.up > 0 && (
                        <i data-tone={neutral ? "neutral-up" : "up"} style={{ flexGrow: card.up }} />
                      )}
                      {card.points.length - card.up - card.down! > 0 && (
                        <i data-tone="flat" style={{ flexGrow: card.points.length - card.up - card.down! }} />
                      )}
                      {card.down! > 0 && (
                        <i data-tone={neutral ? "neutral-down" : "down"} style={{ flexGrow: card.down! }} />
                      )}
                    </>
                  )}
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
