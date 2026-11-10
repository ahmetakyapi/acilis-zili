import { PageShare } from "@/components/article/PageShare";
import { Suspense } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { ThemeBoard } from "@/components/themes/ThemeBoard";
import styles from "@/components/themes/ThemeBoard.module.css";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, LogoTile } from "@/components/ui/primitives";
import { themeTitle } from "@/content/themes";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { loadThemeBoard, themePlaceholders, type ThemeCard } from "@/lib/theme-board";
import { themeRow } from "@/lib/themes-data";
import { cn, directionOf, directionText, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";

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
 * Temalar dizini — günün sıralaması.
 *
 * TEK KOTASYON ÇAĞRISI: bütün temaların üyeleri tek anahtarda soruluyor
 * (`getQuotes` sıralı sembol dizesiyle önbellekli). NVDA üç temada birden
 * duruyor; üç ayrı çağrı üç ayrı fiyat anı demekti ve aynı hisse aynı
 * ekranda üç medyana üç farklı yüzdeyle girebilirdi. Kapaktaki özet ve
 * pano iki ayrı Suspense sınırı ama ikisi de aynı `loadThemeBoard`u okuyor
 * (`cache`, istek içinde tek hesap). Hesap lib/theme-board.ts'te; ana
 * sayfanın temalar bandı da oradan okuyor.
 *
 * GÖRSEL DİL (28 Eylül → 10 Kasım 2026). 28 Eylül'de on eşit kutu, üç şeyi
 * GÖSTEREN kartlara dönmüştü (logolar, büyük medyan, dağılım şeridi) ve
 * kapağa bir sıralama gelmişti. 10 Kasım'da sahibi Temalar'ın da ana sayfa,
 * Piyasalar ve şirket ekranlarının çıtasına çekilmesini istedi ("mercek ve
 * temaları da böyle ele alalım"; "AI slop gibi durmasın"). Bulgular (canlı,
 * 1440/1024/390, iki tema): (1) aynı medyan kapaktaki sıralamada ve kartta
 * iki kez; (2) on kart on ayrı kutu, her şerit kendi kutusunda ve kendi
 * etiketiyle (otuz ölçek etiketi), temalar ARASI fark hiçbir yerde uzunluk
 * olarak okunmuyor; (3) kartlar editoryal sırada, günün hikâyesi (kim önde,
 * kim geride) kartlarda yok; (4) asimetrik ızgarada dar kartın komşusunda
 * 81 piksele varan ölü boşluk; (5) 390'da sayfa 5.787 piksel, on dev rakam
 * alt alta.
 *
 * Şimdi ekran tek bir okuma: KAPAK günün özeti (kaç tema artıda, iki uç ve
 * aralarındaki fark), GÖVDE tek pano (`ThemeBoard`): temalar medyana göre
 * sıralı satırlar, bütün dağılım şeritleri aynı eksende alt alta. Kapaktaki
 * sıralama listesi KALKTI (pano onun kendisi); kartlardaki dev rakam,
 * tekrarlanan ölçek etiketleri ve ayrı oran çubuğu satırın sütunlarına
 * indi. Eski "ızgara veriden bağımsız" kararı (akışla gelen veri kartları
 * oynatmasın) eş boylu satırlarda kendiliğinden sağlanıyor: yedek aynı on
 * satırı editoryal sırayla basıyor (gerekçe ThemeBoard.tsx).
 *
 * `ThemeRanking` ve `SpreadStrip` ana sayfanın "Sektörler ve Temalar"
 * bandında yaşamaya devam ediyor; bu sayfa artık onları kullanmıyor.
 */
export default async function ThemesIndexPage() {
  const { locale, t } = await getI18n();

  /* SAYFA KOTASYONU BEKLEMİYOR (28 Eylül, ölçüldü). Dizin önce bütün
     temaların medyanını hesaplayıp sonra çiziyordu: soğuk önbellekte
     yaklaşık 150 sembolün kotasyonu ve Katılım havuzunun Finnhub taraması
     bitmeden tek bayt gitmiyordu, ilk bayt 1,5 saniye. Satırların metni ve
     elle seçilmiş temaların logoları durağan (content/themes.ts, depodaki
     logo dosyaları); yalnızca sayılar veriye bağlı. Yedek AYNI panoyu
     sayısız basıyor, sayılar akışla iniyor ve pano yerinden oynamıyor. */
  const placeholders = themePlaceholders();

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: t.themes.title, path: "/tema" }]} />
      <DirectoryHeader
        title={t.themes.title}
        description={t.themes.subtitle}
        share={<PageShare path="/tema" title={t.themes.title} locale={locale} t={t} />}
        visual={
          <Suspense fallback={<HeroSummary part="ends" summary={null} locale={locale} t={t} />}>
            <LiveHeroSummary part="ends" locale={locale} t={t} />
          </Suspense>
        }
      >
        <Suspense fallback={<HeroSummary part="breadth" summary={null} locale={locale} t={t} />}>
          <LiveHeroSummary part="breadth" locale={locale} t={t} />
        </Suspense>
      </DirectoryHeader>

      <Suspense
        fallback={
          <ThemeBoard
            board={{ cards: placeholders, scale: null, leader: null, laggard: null, phase: null }}
            basis={null}
            benches={{}}
            locale={locale}
            t={t}
          />
        }
      >
        <LiveBoard locale={locale} t={t} />
      </Suspense>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["sektor-rotasyonu", "cesitlendirme"]}
      />
    </MotionExperience>
  );
}

/**
 * Kapağın günün özeti (28 Eylül; 10 Kasım'da iki sütuna bölündü: yön oranı
 * solda başlığın altında, iki uç ve aralarındaki fark sağda).
 *
 * 28 Eylül'de sağdaki on satırlık sıralama kapağı uzatıyor, sol yarıda
 * başlığın altında boşluk kalıyordu; boşluk sıralamanın ÖZETİYLE dolmuştu
 * (kaç tema yükseldi, kaç tema düştü, en güçlü ve en zayıf hangisi). 10
 * Kasım'da sıralama gövdeye (pano) indi; özetin tamamı önce sağ sütuna
 * kondu ve sol sütunda "Paylaş"ın altında ~110 piksel boş kaldı (1440,
 * ölçüldü). Yön oranı sola alındı: iki sütun aynı boyda bitiyor, kapak
 * 376 → 277 piksel ve pano ilk ekranda.
 * Veri `loadThemeBoard`dan, istek içinde önbellekli; yeni bir istek yok.
 *
 * En güçlü ve en zayıf YALNIZCA ortak seans kümesi varken (panodaki
 * çiplerle aynı kural, lib/theme-board.ts); yoksa iki kutu tireyle, aynı
 * boyda basılıyor (veri inince kapak oynamıyor). Son kapanışa kalmış günde
 * künye "Son Kapanış" diyor ve sayılar nötr: dünü bugün diye anlatmıyor.
 *
 * DÖRT KUTU YERİNE TEK YÜZEY (29 Eylül, sahibinin isteği: "görselliği daha
 * üst seviyeye"). Dört eşit kutu sıralamanın sayılarını ikinci kez
 * YAZIYORDU. Özet panonun söylemediğini gösteriyor: yükselen ve düşen tema
 * sayısı tek bir ORAN ÇUBUĞU (pano her temayı ayrı ayrı çiziyor, kaç
 * tanesinin artıda olduğunu okutmuyor), iki uç tema ve (10 Kasım) ikisinin
 * ARASINDAKİ FARK: aynı eksende iki nokta, aralarında çizgi, yanında puan.
 * Kapağın en büyük puntosu iki ucun medyanında. Hepsi aynı `comparable`
 * kümesinden. Kutu değil ton: tek çukur yüzey, bölümler hairline ile.
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

/** Uç temanın yanında gösterilen logo sayısı. 1440'ta uç kutusu 273 piksel:
    dört 22'lik logo (97) + ad sığıyor; beşincide "Kilo İlaçları (GLP-1)"
    gibi uzun ad kesiliyordu. Telefonda iki logo (ThemeBoard.module.css). */
const EXTREME_LOGOS = 4;
/** Fark çizgisinde uç noktanın eksenin yarısından aldığı pay, yüzde. */
const GAP_REACH = 44;

type HeroPart = "breadth" | "ends";

async function LiveHeroSummary({ part, locale, t }: { part: HeroPart; locale: Locale; t: Dictionary }) {
  const { board, scaleBasis } = await loadThemeBoard();
  const comparable = board.cards.filter((card) => card.basis === scaleBasis && card.median !== null);
  const bySlug = (slug: string | null) => board.cards.find((card) => card.theme.slug === slug) ?? null;
  return (
    <HeroSummary
      part={part}
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

function HeroSummary({ part, summary, locale, t }: { part: HeroPart; summary: HeroSummaryData | null; locale: Locale; t: Dictionary }) {
  const tone = (kind: "up" | "down") =>
    summary === null ? "text-muted" : summary.session ? (kind === "up" ? "text-up" : "text-down") : "text-body";
  const neutral = !summary?.session;
  const total = summary?.total ?? 0;
  const flat = total - (summary?.rising ?? 0) - (summary?.falling ?? 0);
  const leader = summary?.leader ?? null;
  const laggard = summary?.laggard ?? null;
  const end = (card: ThemeCard | null, label: string) =>
    card && card.median !== null ? (
      <Link href={`/tema/${card.theme.slug}`} prefetch={false} className={styles.end}>
        <span className={styles.endLabel}>
          <span className={styles.label}>{label}</span>
          <ArrowUpRight weight="bold" size={13} className={styles.endArrow} aria-hidden />
        </span>
        <b className={cn("numeral", styles.endFig, directionText(directionOf(card.median)))}>
          {formatPercent(card.median, locale)}
        </b>
        <span className={styles.endBody}>
          <span className={styles.endLogos} aria-hidden>
            {card.members.slice(0, EXTREME_LOGOS).map((member) => (
              <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="xs" />
            ))}
          </span>
          <span className={styles.endName}>{themeTitle(card.theme, locale)}</span>
        </span>
      </Link>
    ) : (
      /* Yedek aynı üç satır: veri inince kapak oynamıyor. */
      <div className={styles.end}>
        <span className={styles.endLabel}>
          <span className={styles.label}>{label}</span>
        </span>
        <b className={cn("numeral text-muted", styles.endFig)}>{NO_VALUE}</b>
        <span className={styles.endBody}>
          <span className={cn(styles.endName, "text-muted")}>{NO_VALUE}</span>
        </span>
      </div>
    );

  const peak = leader?.median != null && laggard?.median != null
    ? Math.max(Math.abs(leader.median), Math.abs(laggard.median))
    : 0;
  const at = (value: number) => 50 + (peak > 0 ? (value / peak) * GAP_REACH : 0);

  if (part === "breadth") return (
    <div className={cn(styles.summary, styles.summaryLead)}>
      <div className={styles.breadth}>
        <div className={styles.breadthHead}>
          <span className={styles.label}>
            {t.themes.themesBreadth}
            {summary && (!summary.session || summary.lastClose)
              ? ` · ${t.themes.medianLastClose}`
              : summary?.preMarket
                ? ` · ${t.themes.medianPreMarket}`
                : ""}
          </span>
          <span className={styles.counts}>
            <b className={cn("numeral", tone("up"))}>{summary ? summary.rising : NO_VALUE}</b>
            {t.themes.up}
            <span aria-hidden className={styles.countSep} />
            <b className={cn("numeral", tone("down"))}>{summary ? summary.falling : NO_VALUE}</b>
            {t.themes.down}
          </span>
        </div>
        {/* Oranın çizgisi: yükselen soldan, düşen sağdan; yatay kalan
            ortada. Nötr kümede yön rengi yok ama iki parça iki tonda
            kalıyor — oran son kapanışta da okunur. */}
        <span className={styles.bar} aria-hidden>
          {total > 0 && (
            <>
              {summary!.rising > 0 && (
                <i data-tone={neutral ? "neutral-up" : "up"} data-motion-draw="line" style={{ flexGrow: summary!.rising, transformOrigin: "left center" }} />
              )}
              {flat > 0 && <i data-tone="flat" style={{ flexGrow: flat }} />}
              {summary!.falling > 0 && (
                <i data-tone={neutral ? "neutral-down" : "down"} data-motion-draw="line" style={{ flexGrow: summary!.falling, transformOrigin: "right center" }} />
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );

  return (
    <div className={styles.summary}>
          <div className={styles.ends}>
            {end(
              leader,
              summary?.preMarket ? t.themes.strongestPre : summary?.lastClose ? t.themes.strongestClose : t.themes.strongest,
            )}
            {end(
              laggard,
              summary?.preMarket ? t.themes.weakestPre : summary?.lastClose ? t.themes.weakestClose : t.themes.weakest,
            )}
          </div>
          {/* ARADAKİ FARK bir de çizgi: iki ucun medyanı aynı eksende iki
              nokta. Çizgi yargı değil, mesafe (nötr ton); renk noktalarda,
              işaretten. */}
          <div className={styles.gap}>
            <span className={styles.label}>{t.themes.gapLabel}</span>
            <span className={styles.gapTrack} aria-hidden>
              {peak > 0 && (
                <>
                  <i
                    className={styles.gapSpan}
                    data-motion-draw="line"
                    style={{ left: `${at(laggard!.median!)}%`, right: `${100 - at(leader!.median!)}%` }}
                  />
                  <i className={styles.gapZero} style={{ left: "50%" }} />
                  <i className={styles.gapDot} data-tone={directionOf(laggard!.median!)} style={{ left: `${at(laggard!.median!)}%` }} />
                  <i className={styles.gapDot} data-tone={directionOf(leader!.median!)} style={{ left: `${at(leader!.median!)}%` }} />
                </>
              )}
            </span>
            <b className={cn("numeral", styles.gapValue, peak > 0 ? undefined : "text-muted")}>
              {peak > 0
                ? t.themes.gapPoints.replace("{points}", formatPrice(leader!.median! - laggard!.median!, locale))
                : NO_VALUE}
            </b>
          </div>
    </div>
  );
}

async function LiveBoard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis, quotesResult, names, status } = await loadThemeBoard();
  /* ÖLÇÜT FONU ŞERİTTE BİR İM. Kotasyonu zaten aynı pakette (`themeUniverse`
     ölçütleri de soruyor); yeni çağrı yok. Kıyas ancak tema ile fon AYNI
     SEANSI anlatıyorsa (detaydaki kıyasla aynı kural, `ThemeReading`): iki
     ayrı günden bir fark üretmek, fark göstermemekten kötü. */
  const quotes = quotesResult.ok ? quotesResult.data : {};
  const benches: Record<string, number> = {};
  for (const card of board.cards) {
    const benchmark = card.theme.benchmark;
    if (!benchmark || !quotesResult.ok || card.basis === null) continue;
    const row = themeRow(benchmark.symbol, quotes, names, status);
    if (row.changePct === null || row.basis === null) continue;
    if ((card.basis === "session") !== (row.basis !== "lastClose")) continue;
    benches[card.theme.slug] = row.changePct;
  }
  return (
    <>
      <ThemeBoard board={board} basis={scaleBasis} benches={benches} locale={locale} t={t} />
      {/* Kart kaydı yalnızca GÖRÜNEN logolar için (satır başına en çok altı:
          beş logo, tam bir fazla üye varsa "+1" yerine onun logosu —
          ThemeBoard → ROW_LOGOS); fiyat panonun kendi paketinden. */}
      <CompanyCards
        symbols={board.cards.flatMap((card) => card.members.slice(0, 6).map((member) => member.symbol))}
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
