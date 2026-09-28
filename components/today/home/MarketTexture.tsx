import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/themes/RollingFigure";
import { ThemeRanking } from "@/components/themes/ThemeRanking";
import { SpreadStrip } from "@/components/themes/ThemeVisuals";
import themeStyles from "@/components/themes/Themes.module.css";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, LogoTile, PanelLink, Skeleton } from "@/components/ui/primitives";
import { themeTitle } from "@/content/themes";
import { getStatus } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SECTOR_ETFS, loadBoardQuotes } from "@/lib/market-boards";
import { quoteBasis } from "@/lib/market-hours";
import { loadThemeBoard, themePlaceholders, type ThemeCard } from "@/lib/theme-board";
import { heatOf } from "@/lib/theme-view";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./MarketTexture.module.css";

/**
 * Sektörler ve Temalar — ana sayfanın iki kolonunun altındaki tam
 * genişlik bant (28 Eylül).
 *
 * NEDEN BU İKİSİ, NEDEN BİRLİKTE. Sahibi `/tema`nın sıralamasını ana
 * sayfada da görmek istedi ve "başka gösterebileceğimiz şeyler" sordu.
 * Adaylar tartıldı (Piyasa Nabzı zaten Portföy yuvasında, emtia şeridi ve
 * temettü birer liste daha, haftalık bilanço duvarı sağ kolondaki "Haftaya
 * Bakış" ile aynı soruyu soruyor). Seçilen tek ek, `/piyasalar`ın Sektör
 * Performansı'nın 1G sütunu: ana sayfa endeksleri, dünyayı ve tek tek
 * hisseleri gösteriyordu ama ARADAKİ ölçeği, yani paranın hangi köşeye
 * aktığını hiçbir yerde göstermiyordu. Sektör ile tema aynı sorunun iki
 * çözünürlüğü (geniş, dar), o yüzden tek bantta ve tek başlık altında;
 * iki ayrı panel olsalar sayfaya iki blok eklenirdi.
 *
 * NEDEN TAM GENİŞLİK. İki kolon ölçülü bir denge içinde (1280'de 14,
 * 1440'ta 31, 1024'te 138 piksel fark; page.tsx). 350 piksellik bir panel
 * hangi kolona girse ötekinde aynı boyda bir boşluk açardı ve doldurucunun
 * (`FillColumn`) o kadar yedek satırı yok. Bant ızgaranın kendi satırında,
 * kolonların hiçbirine dokunmuyor.
 *
 * VERİ. Sektörler `/piyasalar`ın AYNI kotasyon anahtarından
 * (`loadBoardQuotes`: sektör + emtia + kripto fonları tek tur), temalar
 * `/tema`nın AYNI hesabından (`loadThemeBoard`). Yeni bir anahtar yok; iki
 * ekran aynı yüzdeyi yazıyor. İkisi de kendi Suspense sınırında akıyor ve
 * yedekleri gerçek ızgarayla aynı şekli basıyor (CLS 0).
 */

/* ==========================================================================
   Sektör şeridi
   ========================================================================== */

/**
 * On bir sektör fonu, günün hareketine göre SIRALI ısı karoları: şerit
 * soldan sağa en güçlüden en zayıfa bir renk geçişi olarak okunuyor,
 * sıralamayı okumak için rakamlara bakmak gerekmiyor. Ton `/piyasalar` ve
 * tema haritasının AYNI eşikleri (`heatOf`).
 *
 * Bu seansta işlem görmeyen fonun yüzdesi son kapanışı anlatıyor: karo
 * nötr tonda kalıyor, yön rengi yalnızca bu seansın hareketinde (Veri
 * dürüstlüğü 4, `quoteBasis`). Hepsi son kapanıştaysa künye bunu söylüyor.
 */
export async function SectorRibbon({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const quotes = await loadBoardQuotes(status);
  const x = t.marketExtras;

  if (!quotes.ok) {
    return (
      <SectorFrame t={t} meta={x.sectorsMeta}>
        <p className={styles.ribbonError}>{t.data.failed}</p>
      </SectorFrame>
    );
  }

  const rows = SECTOR_ETFS.map((entry) => {
    const quote = quotes.data[entry.symbol];
    const change = quote?.changePct ?? null;
    return {
      symbol: entry.symbol,
      name: locale === "tr" ? entry.nameTr : entry.nameEn,
      change,
      lastClose: quote ? quoteBasis(quote, status) === "lastClose" : false,
    };
  }).sort((a, b) => {
    if (a.change === null || b.change === null) return a.change === null ? 1 : -1;
    /* Son kapanıştaki karo sıralamanın DIŞINDA, sonda (28 Eylül denetimi).
       Şerit soldan sağa bu seansın en güçlüden en zayıfa dizilişi; dünün
       yüzdesiyle araya girmesi, iki ayrı günü tek sıraya koymaktı. Tema
       sıralaması aynı kuralı izliyor (ThemeRanking). */
    if (a.lastClose !== b.lastClose) return a.lastClose ? 1 : -1;
    return b.change - a.change;
  });
  const allLastClose = rows.every((row) => row.change === null || row.lastClose);

  return (
    <SectorFrame t={t} meta={allLastClose ? `${x.sectorsMeta} · ${t.market.lastClose}` : `${x.sectorsMeta} · ${t.today.sectorsWeight}`}>
      <ol className={styles.ribbon} data-motion-stagger>
        {rows.map((row) => {
          const heat = row.change === null || row.lastClose ? { tone: "flat", level: 0 } : heatOf(row.change);
          /* Karışık günde son kapanıştaki karo künyesini kendi taşıyor: nötr
             tonu tek başına "hareket yok" gibi okunuyordu (koyu temada
             şeritte bir delik gibi duruyordu). Hepsi son kapanıştaysa künye
             başlıkta, karolarda tekrar yok. */
          const marked = row.lastClose && !allLastClose;
          return (
            <li key={row.symbol} className={styles.tileItem}>
              <Link
                href={`/hisse/${row.symbol}`}
                prefetch={false}
                className={cn(themeStyles.heat, styles.tile)}
                data-heat-tone={heat.tone}
                data-heat-level={heat.level}
              >
                <span className={styles.tileHead}>
                  <span className={styles.tileName} data-short={marked || undefined}>{row.name}</span>
                  {marked && <span className={styles.tileBasis}>{t.market.lastClose}</span>}
                </span>
                <b className={cn("numeral", styles.tilePct)}>
                  {row.change === null ? NO_VALUE : formatPercent(row.change, locale)}
                </b>
              </Link>
            </li>
          );
        })}
      </ol>
    </SectorFrame>
  );
}

function SectorFrame({ t, meta, children }: { t: Dictionary; meta: string; children: React.ReactNode }) {
  return (
    <div className={styles.part}>
      <div className={styles.partHead}>
        <h3>{t.today.sectorsHeading}</h3>
        <span className={styles.partMeta}>{meta}</span>
        <PanelLink href="/piyasalar#sektor-performansi" className={styles.partLink}>
          {t.today.sectorsLink}
        </PanelLink>
      </div>
      {children}
    </div>
  );
}

/** Sektör şeridinin yedeği: aynı başlık, aynı on bir karo. */
export function SectorRibbonSkeleton({ t }: { t: Dictionary }) {
  return (
    <SectorFrame t={t} meta={t.marketExtras.sectorsMeta}>
      <div aria-hidden className={styles.ribbon}>
        {SECTOR_ETFS.map((entry) => (
          <Skeleton key={entry.symbol} className={styles.tileSkeleton} />
        ))}
      </div>
    </SectorFrame>
  );
}

/* ==========================================================================
   Temalar
   ========================================================================== */

/* UÇ KARTININ LOGOLARI BİR KADEME BÜYÜDÜ (28 Eylül, sahibinin isteği):
   `sm` (26) → `md` (32), "+N" çipi de 32. Logo başına 36 piksel (karo +
   4 boşluk), çip ~32. Satırın sığacağı yer ölçüldü (başsız Chrome, kart
   içi eksi rakam ve 14'lük aralık, zayıf tema kartı — rakamı daha geniş):
   - 1440: 418, 1280: 373, 1024: 284 → altı logo + çip = 248. Yedi logo
     284 eder ve 1024'te sıfır pay bırakır; rakam "−10,25 %" gibi
     uzadığında taşardı.
   - 768: 175, 900: 241 → üç logo + çip = 140.
   - 390: satır kartın iç genişliği, 147 → üç logo + çip = 140; dört 176.
   - 640–767: 119–131 piksel kalıyordu, üç logo bile sığmıyor; bu aralık
     telefon düzenine geçti (rakam başlığın altında, CSS notu).
   Ölçüm aynı zamanda eski bir hatayı gösterdi: 26 piksellik sekiz logo
   640–900 arasında 14–147 piksel TAŞIYOR ve "+N" çipi `overflow:hidden`
   altında görünmüyordu. */
/** Geniş ekranda (≥1024) uç kartındaki logo sayısı. */
const EXTREME_LOGOS = 6;
/** 1024'ün altında kalan logo sayısı (MarketTexture.module.css). */
const EXTREME_LOGOS_NARROW = 3;

/**
 * Temaların günü: solda `/tema`nın kapağındaki sıralamanın AYNISI
 * (`ThemeRanking`), sağda iki uç — en güçlü ve en zayıf tema — logolarıyla,
 * büyük medyanıyla ve üyelerin dağılım şeridiyle.
 *
 * Açılış öncesinde künye "Açılış Öncesi En Güçlü Tema" (`board.phase`,
 * gerekçesi lib/theme-stats.ts → themePhase).
 *
 * "Günün En Güçlüsü" YALNIZCA canlı seansta (dizindeki kuralın aynısı,
 * `board.leader`). Son kapanışa kalmış bir günde uçlar yine gösteriliyor
 * ama künyesi "Son Kapanışta En Güçlü" ve rakam nötr: dünü bugün diye
 * anlatmıyor, ekran da boş kalmıyor.
 */
export async function ThemeSpotlight({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [{ board, scaleBasis, comparable, quotesResult, names, status }, sectorQuotes] = await Promise.all([
    loadThemeBoard(),
    getStatus().then(loadBoardQuotes),
  ]);
  /* BANDIN TEK DAMGASI. Şerit ve temalar ayrı iki kotasyon turundan
     geliyor ama ikisi de aynı sağlayıcıdan; iki özdeş damga alt alta
     duruyordu. Damga ESKİ olanın anını ve iki turdan birinin bayatlığını
     yazıyor: tazeyi yazmak geride kalanı gizlemek olurdu. Şeridin
     kotasyonu burada yeniden istenmiyor, `getQuotes` istek içinde aynı
     anahtarla önbellekli. */
  const stamps = [quotesResult, sectorQuotes].filter((result) => result.ok);
  const oldest = stamps.reduce<(typeof stamps)[number] | null>(
    (older, result) =>
      !older || new Date(result.fetchedAt ?? 0).getTime() < new Date(older.fetchedAt ?? 0).getTime()
        ? result
        : older,
    null,
  );
  const session = scaleBasis === "session";
  const bySlug = (slug: string | null) => board.cards.find((card) => card.theme.slug === slug) ?? null;
  const sorted = [...comparable].sort((a, b) => b.median! - a.median!);
  const top = session ? bySlug(board.leader) : sorted.length >= 2 ? sorted[0] : null;
  const bottom = session ? bySlug(board.laggard) : sorted.length >= 2 ? sorted[sorted.length - 1] : null;

  return (
    <ThemeFrame
      ranking={<ThemeRanking cards={board.cards} basis={scaleBasis} phase={board.phase} locale={locale} t={t} heading="h4" />}
      extremes={
        <>
          {/* Logoların üzerine gelince açılan şirket kartı (components/ui/
              CompanyCards) — bandın kendi kotasyon paketiyle, ek istek yok. */}
          <CompanyCards
            symbols={[top, bottom].flatMap((c) => c?.members.slice(0, EXTREME_LOGOS + 1).map((m) => m.symbol) ?? [])}
            quotes={quotesResult.ok ? quotesResult.data : null}
            stale={quotesResult.ok && Boolean(quotesResult.stale)}
            names={names}
            status={status}
          />
          <ExtremeCard
            card={top}
            label={
              !session
                ? t.today.strongestLastClose
                : board.phase === "pre-market"
                  ? t.today.strongestPreMarket
                  : t.today.strongestTheme
            }
            session={session}
            scale={board.scale}
            locale={locale}
            t={t}
          />
          <ExtremeCard
            card={bottom}
            label={
              !session
                ? t.today.weakestLastClose
                : board.phase === "pre-market"
                  ? t.today.weakestPreMarket
                  : t.today.weakestTheme
            }
            session={session}
            scale={board.scale}
            locale={locale}
            t={t}
          />
        </>
      }
      stamp={
        oldest ? (
          <DataStamp
            labels={t.data}
            source={oldest.source}
            at={oldest.fetchedAt}
            stale={stamps.some((result) => result.stale)}
            locale={locale}
            className={styles.stamp}
          />
        ) : (
          <p className={styles.stampNote}>{t.themes.quotesUnavailable}</p>
        )
      }
      t={t}
    />
  );
}

function ThemeFrame({
  ranking,
  extremes,
  stamp,
  t,
}: {
  ranking: React.ReactNode;
  extremes: React.ReactNode;
  stamp: React.ReactNode;
  t: Dictionary;
}) {
  return (
    <div className={styles.part}>
      <div className={styles.partHead}>
        <h3>{t.today.themesHeading}</h3>
        <span className={styles.partMeta}>{t.today.themesMeta}</span>
        <PanelLink href="/tema" className={styles.partLink}>
          {t.today.themesLink}
        </PanelLink>
      </div>
      <div className={styles.themes}>
        <div className={styles.rankCol}>{ranking}</div>
        <div className={styles.extremes}>{extremes}</div>
      </div>
      {stamp}
    </div>
  );
}

function ExtremeCard({
  card,
  label,
  session,
  scale,
  locale,
  t,
}: {
  card: ThemeCard | null;
  label: string;
  session: boolean;
  scale: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  if (!card || card.median === null) {
    return (
      <div className={cn(styles.extreme, styles.extremeEmpty)}>
        <span className={styles.extremeLabel}>{label}</span>
        <strong className={cn("numeral text-muted", styles.extremeFigure)}>{NO_VALUE}</strong>
      </div>
    );
  }
  /* TEK ARTAN ÜYE ÇİP DEĞİL LOGO (28 Eylül): "+1" çipi bir logo kadar yer
     (32 piksel) kaplıyor; yedinci logo satırı büyütmüyor, çip yerine
     üyenin kendisi görünüyor. */
  const members = card.members.slice(
    0,
    card.members.length === EXTREME_LOGOS + 1 ? EXTREME_LOGOS + 1 : EXTREME_LOGOS,
  );
  const rest = card.members.length - members.length;
  const tone = session ? directionOf(card.median) : null;
  return (
    <Link
      href={`/tema/${card.theme.slug}`}
      prefetch={false}
      className={styles.extreme}
      data-tone={tone ?? "flat"}
    >
      <span className={styles.extremeTop}>
        <span className={styles.extremeLabel}>{label}</span>
        <ArrowUpRight weight="bold" size={15} className={styles.extremeArrow} aria-hidden />
      </span>
      <span className={styles.extremeMain}>
        <span className={styles.extremeText}>
          <h3 className={styles.extremeTitle}>{themeTitle(card.theme, locale)}</h3>
          <span aria-hidden className={styles.extremeLogos}>
            {members.map((member, i) => (
              <span key={member.symbol} className={styles.extremeLogo} style={{ "--i": i } as CSSProperties}>
                <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="md" card />
              </span>
            ))}
            {/* "+N" ekranda GÖRÜNMEYEN üye sayısı: 1024'ün altında üç logo
                kalıyor ve orada aynı sayı yanlış olurdu, iki rozet var. */}
            {rest > 0 && <span className={styles.extremeRest} data-at="wide">+{rest}</span>}
            {card.members.length > EXTREME_LOGOS_NARROW && (
              <span className={styles.extremeRest} data-at="narrow">
                +{card.members.length - EXTREME_LOGOS_NARROW}
              </span>
            )}
          </span>
        </span>
        <span className={cn("numeral", styles.extremeFigure, tone ? directionText(tone) : "text-body")}>
          <RollingFigure value={formatPercent(card.median, locale)} />
        </span>
      </span>
      <SpreadStrip
        points={card.points}
        median={card.median}
        basis={card.basis}
        scale={scale}
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
    </Link>
  );
}

/**
 * Temaların yedeği: sıralama on satırıyla ve editoryal sırayla (dizinin
 * kapağındaki yedekle aynı), uç kartları gerçek kartın sabit boyunda.
 */
export function ThemeSpotlightSkeleton({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <ThemeFrame
      ranking={<ThemeRanking cards={themePlaceholders()} locale={locale} t={t} heading="h4" />}
      extremes={
        <>
          <Skeleton className={styles.extremeSkeleton} />
          <Skeleton className={styles.extremeSkeleton} />
        </>
      }
      stamp={<Skeleton className={styles.stampSkeleton} />}
      t={t}
    />
  );
}
