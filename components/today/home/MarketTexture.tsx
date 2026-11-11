import { ArrowDown, ArrowUp, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/themes/RollingFigure";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, LogoTile, PanelLink, Skeleton } from "@/components/ui/primitives";
import { themeTitle } from "@/content/themes";
import { getStatus } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SECTOR_ETFS, loadBoardQuotes } from "@/lib/market-boards";
import { quoteBasis } from "@/lib/market-hours";
import { loadThemeBoard, themePlaceholders, type ThemeCard } from "@/lib/theme-board";
import type { ThemePhase } from "@/lib/theme-stats";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./MarketTexture.module.css";
import { RankBars, type RankRow } from "./RankBars";

/**
 * Sektörler ve Temalar — ana sayfanın iki kolonunun altındaki tam
 * genişlik bant (28 Eylül).
 *
 * NEDEN BU İKİSİ, NEDEN BİRLİKTE. Sahibi `/temalar`ın sıralamasını ana
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
 * `/temalar`ın AYNI hesabından (`loadThemeBoard`). Yeni bir anahtar yok; iki
 * ekran aynı yüzdeyi yazıyor. İkisi de kendi Suspense sınırında akıyor ve
 * yedekleri gerçek ızgarayla aynı şekli basıyor (CLS 0).
 *
 * 10 KASIM 2026 — BANT TEK DİLDE YENİDEN KURULDU (sahibinin sözü: "ana
 * sayfadaki seans zili ve sektörler temaları da iyileştirebilir misin";
 * aynı gün: "böyle nokta nokta ne anlatıyor anlamıyorum; yatayda uzun
 * KALIN çizgi seviyorum", "logolar az daha büyüyebilir", "AI slop gibi
 * durmasın"). Önce: üstte on bir DİKEY soluk sütun ve üstlerinde dev
 * yüzdeler (10 Ekim silueti), sağında kopuk bir "Son Kapanış" adası; altta
 * 5 piksellik ince çubuklu tema sıralaması ve iki uç kartında ÜYE
 * ÇENTİKLERİ (`SpreadStrip`) — üç ayrı çizim dili. Şimdi:
 *   · SEKTÖRLER ve TEMALAR yan yana iki sıralama, ikisi de `RankBars`: ad,
 *     ortak sıfır ekseninden uzanan 12 piksellik dolu çubuk, yüzde. İki
 *     liste aynı satır ızgarasında, uçlar (en güçlü / en zayıf) tonlu.
 *   · SON KAPANIŞTAKİ FON ayrı bir ada değil: sıralamanın dibinde, çubuğun
 *     yerinde sakin "Son Kapanış" künyesi, yüzdesi soluk.
 *   · İKİ UÇ TEMA sıralamaların altında yan yana iki kart: ad, display
 *     medyan, öne çıkan üyeler (36 piksellik logo + sembol + günlük
 *     yüzdesi, bindirmesiz) ve çentiklerin yerinde KALIN iki renkli şerit:
 *     kaç üye yükseliyor, kaç üye düşüyor.
 * Yerleşim ölçülerek seçildi; ölçüm MarketTexture.module.css → "ÖLÇÜM 10
 * KASIM". Silinen parçalar: `components/themes/ThemeRanking.tsx`,
 * `ThemeVisuals.tsx` → `SpreadStrip`, `Themes.module.css` → `.rank*`,
 * `.spread*`, `.tick*` (yalnız bu bant kullanıyordu; /temalar ekranları
 * `ThemeBoard` ve `ThemeStrip`e geçmişti).
 */

/* ==========================================================================
   Sektörler
   ========================================================================== */

/**
 * ÖLÇEĞİN TABANI (yüzde puan, 10 Ekim). Çubuklar günün en büyük
 * hareketine göre ölçekleniyor; taban olmasa ±%0,2'lik sakin bir günün
 * en uzun çubuğu %3'lük bir günün çubuğuyla aynı boyda dururdu. Bir
 * puanın altındaki günlerde çubuklar kulvarın tamamına uzanmıyor ve şekil
 * günün sakinliğini kendisi söylüyor.
 */
const SECTOR_SCALE_FLOOR = 1;
/** Tema medyanları için aynı gerekçe, aynı taban. */
const THEME_SCALE_FLOOR = 1;

/**
 * TELEFONDA ALTI SEKTÖR (14 Ekim, sahibinin isteği: "6 tane gözüksün").
 * Sıralamanın bilgisi uçlarda: en güçlü üç ve en zayıf üç fon açık, ortası
 * katlı (tema sıralamasının iki ucuyla aynı dil). Son kapanıştaki fonlar
 * sıralamanın dışında, uç sayılmıyor. 10 Kasım: karolar satıra döndü
 * (`RankBars`), sayı aynı.
 */
const SECTOR_PHONE_ENDS = 3;
/** Telefonda temaların iki ucundan açık satır (9 Ekim: bant 1.217 pikseldi). */
const THEME_PHONE_ENDS = 2;

/**
 * On bir sektör fonu, günün hareketine göre SIRALI (10 Ekim, sahibinin
 * isteği). Ekran kuralı — karşılaştırılan her büyüklük bir de ÇİZGİ olarak
 * okunur — burada kalın yatay çubukla (10 Kasım; önce dikey siluet,
 * gerekçe dosyanın başında ve `RankBars`ta).
 *
 * Bu seansta işlem görmeyen fonun yüzdesi son kapanışı anlatıyor: satır
 * sıralamanın dışında, sonda, çubuksuz ve künyeli (Veri dürüstlüğü 4,
 * `quoteBasis`). Hepsi son kapanıştaysa künye bunu başlıkta söylüyor ve
 * çubuklar çiziliyor (hepsi aynı günü anlatıyor).
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

  const entries = SECTOR_ETFS.map((entry) => {
    const quote = quotes.data[entry.symbol];
    const change = quote?.changePct ?? null;
    return {
      symbol: entry.symbol,
      name: locale === "tr" ? entry.nameTr : entry.nameEn,
      change,
      lastClose: quote ? quoteBasis(quote, status) === "lastClose" : false,
    };
  });

  return <SectorRibbonView entries={entries} locale={locale} t={t} />;
}

export type SectorEntry = { symbol: string; name: string; change: number | null; lastClose: boolean };

/** Sıralamanın saf görünümü — veri `SectorRibbon`da (`olcum` skill'i: yükleyici ile çizim ayrı). */
export function SectorRibbonView({ entries, locale, t }: { entries: readonly SectorEntry[]; locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const sorted = [...entries].sort((a, b) => {
    if (a.change === null || b.change === null) return a.change === null ? 1 : -1;
    /* Son kapanıştaki fon sıralamanın DIŞINDA, sonda (28 Eylül denetimi).
       Sıra bu seansın en güçlüden en zayıfa dizilişi; dünün yüzdesiyle
       araya girmesi, iki ayrı günü tek sıraya koymaktı. Tema sıralaması
       aynı kuralı izliyor. */
    if (a.lastClose !== b.lastClose) return a.lastClose ? 1 : -1;
    return b.change - a.change;
  });
  const allLastClose = sorted.every((row) => row.change === null || row.lastClose);
  /* Ölçek ve sayım aynı kümeden: karışık günde yalnızca bu seansın
     fonları, hepsi son kapanıştaysa hepsi (künye o zaman bunu söylüyor). */
  /* İKİ GRUP, TEK CETVEL DEĞİL (31 Ekim → 10 Kasım). 31 Ekim'de ölçek son
     kapanış grubunu da kapsıyordu; canlıda (10 Kasım, açılış öncesi) bu
     seansın dokuz fonu ±%0,7 içindeyken son kapanıştaki iki fon +%2,45 /
     +%1,45'ti ve ortak ölçekte seansın sütunları çizgiye iniyordu. Önce
     iki ayrı ölçekle (iki sıfır çizgisi, kesik ayraç) çözülmüştü; yatay
     sıralamada aynı kulvarda iki ölçek yalan söylerdi. Son kapanıştaki fon
     artık çubuksuz: başka bir günün hareketi bugünün cetveline konmuyor
     (ekran kuralı), yüzdesi soluk ve yanında künyesi var. */
  const rows: RankRow[] = sorted.map((row) => {
    const stale = row.lastClose && !allLastClose;
    return {
      key: row.symbol,
      href: `/hisse/${row.symbol}`,
      name: row.name,
      sub: row.symbol,
      value: row.change,
      bar: row.change !== null && !stale,
      /* RENK SON KAPANIŞTA DA İŞARETTEN (15 Ekim, sahibinin isteği:
         "eksiyse kırmızı artıysa yeşil olmalı"). Dönemi künye söylüyor
         ("Son Kapanış" başlıkta, karışık günde satırda); renk yalnız yönü
         taşıyor — tazelik iddiası yok. */
      showValue: stale,
      note: stale ? t.market.lastClose : undefined,
    };
  });
  const counted = rows.filter((row) => row.bar);
  const risers = counted.filter((row) => row.value! > 0).length;
  const fallers = counted.filter((row) => row.value! < 0).length;

  return (
    <SectorFrame
      t={t}
      meta={allLastClose ? `${x.sectorsMeta} · ${t.market.lastClose}` : `${x.sectorsMeta} · ${t.today.sectorsWeight}`}
      breadth={
        /* Genişlik künyesi yalnızca METİN (10 Ekim; yanındaki 72 piksellik
           bölünmüş çubuk kalkmıştı: sıralamanın kendisi aynı bilgiyi
           çiziyor). */
        <Breadth
          t={t}
          up={risers}
          down={fallers}
          label={t.today.sectorsBreadthLabel.replace("{up}", String(risers)).replace("{down}", String(fallers))}
        />
      }
    >
      <RankBars
        rows={rows}
        floor={SECTOR_SCALE_FLOOR}
        locale={locale}
        foldId="sektor-siralamasi"
        phoneEnds={SECTOR_PHONE_ENDS}
        more={t.compact.showAll}
        less={t.compact.showLess}
      />
    </SectorFrame>
  );
}

/** "4 Yükselen · 7 Düşen": sayılar yön renginde, kalanı künye. */
function Breadth({ t, up, down, label }: { t: Dictionary; up: number; down: number; label?: string }) {
  return (
    <span className={styles.breadth} role={label ? "img" : undefined} aria-label={label}>
      <span aria-hidden={label ? true : undefined}>
        {t.today.sectorsBreadth.split(/(\{up\}|\{down\})/).map((part, i) =>
          part === "{up}" ? (
            <b key={i} className="numeral text-up">{up}</b>
          ) : part === "{down}" ? (
            <b key={i} className="numeral text-down">{down}</b>
          ) : (
            part
          ),
        )}
      </span>
    </span>
  );
}

/* BÖLÜM BAŞI İKİ SATIR (10 Kasım). Tek satırdı: ad, künye, genişlik ve
   bağlantı yan yana; iki sıralama yan yana gelince 1024'te 451 piksellik
   kolonda dört öğe üç satıra kırılıyordu (ölçüldü). Üstte ad ve bağlantı,
   altında künye ile genişlik: iki kolonda aynı iki hat. */
function PartHead({
  title,
  meta,
  breadth,
  link,
}: {
  title: string;
  meta: string;
  breadth?: React.ReactNode;
  link: React.ReactNode;
}) {
  return (
    <div className={styles.partHead}>
      <h3 data-rise>{title}</h3>
      {link}
      <p className={styles.partMeta}>
        <span>{meta}</span>
        {breadth}
      </p>
    </div>
  );
}

function SectorFrame({
  t,
  meta,
  breadth,
  children,
}: {
  t: Dictionary;
  meta: string;
  breadth?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(styles.part, styles.partSectors)}>
      <PartHead
        title={t.today.sectorsHeading}
        meta={meta}
        breadth={breadth}
        link={
          <PanelLink href="/piyasalar#sektor-performansi" className={styles.partLink}>
            {t.today.sectorsLink}
          </PanelLink>
        }
      />
      {children}
    </div>
  );
}

/** Sıralamanın yedeği: aynı başlık, aynı on bir satır (adlar durağan), sayısız. */
export function SectorRibbonSkeleton({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <SectorFrame t={t} meta={t.marketExtras.sectorsMeta}>
      <RankBars
        rows={SECTOR_ETFS.map((entry) => ({
          key: entry.symbol,
          href: `/hisse/${entry.symbol}`,
          name: locale === "tr" ? entry.nameTr : entry.nameEn,
          sub: entry.symbol,
          value: null,
          bar: false,
        }))}
        floor={SECTOR_SCALE_FLOOR}
        locale={locale}
        foldId="sektor-siralamasi"
        phoneEnds={SECTOR_PHONE_ENDS}
        more={t.compact.showAll}
        less={t.compact.showLess}
      />
    </SectorFrame>
  );
}

/* ==========================================================================
   Temalar
   ========================================================================== */

/* UÇ KARTININ ÜYELERİ (10 Kasım). Kartta logolar yan yana, altlarında bir
   şey yoktu ve hangi üyenin temayı taşıdığı okunmuyordu; dağılımı çentik
   şeridi söylemeye çalışıyordu. Şimdi her üye bir hücre: 36 piksellik logo
   (sahibinin isteği: "logolar az daha büyüyebilir"; 28 Eylül 26 → 32,
   8 Kasım 32 → 40 ama telefonda 32 ve bindirmeli), sembol ve o günkü
   yüzdesi. En güçlü temada en çok yükselenler, en zayıfta en çok düşenler
   önde: kart "kim taşıdı" sorusunu cevaplıyor. Hücreler tek satır ızgara,
   sığmayan hücre satırın dışında kalır (CSS, bindirme yok); sayılar CSS
   notunda. Sunucu en çok sekiz hücre basar. */
const EXTREME_MEMBERS = 8;

/** Pencereye göre sıralama künyesi — `ThemeRanking`in başlığıydı (lib/theme-stats.ts → themePhase). */
const rankTitleOf = (phase: ThemePhase | null, t: Dictionary) =>
  phase === "pre-market" ? t.themes.rankTitlePre : phase === "lastClose" ? t.themes.rankTitleClose : t.themes.rankTitle;

/**
 * Temaların sırası — medyana göre, `/temalar`ın AYNI hesabından. Çubuk
 * yalnızca aynı seansı anlatan medyanlara basılıyor; ortak kümenin DIŞINDA
 * kalan tema (bu seansta hiç işlem görmemiş, yüzdesi son kapanışı anlatan)
 * listenin dibinde SAYISIZ duruyor: bir önceki günün medyanını bugünün
 * sıralamasının dibine künyesiz koymak, onu bugünün en zayıfı gibi
 * okutuyordu (28 Eylül denetimi).
 */
function themeRows(cards: readonly ThemeCard[], basis: "session" | "lastClose" | null, locale: Locale): RankRow[] {
  const inScale = (card: ThemeCard) => basis !== null && card.basis === basis && card.median !== null;
  const sorted = basis
    ? [...cards].sort((a, b) => {
        if (inScale(a) !== inScale(b)) return inScale(a) ? -1 : 1;
        return (b.median ?? 0) - (a.median ?? 0);
      })
    : cards;
  return sorted.map((card) => ({
    key: card.theme.slug,
    href: `/temalar/${card.theme.slug}`,
    name: themeTitle(card.theme, locale),
    value: inScale(card) ? card.median : null,
    bar: inScale(card),
  }));
}

/**
 * Temaların günü: sıralama (`RankBars`, sektörlerin yanında) ve iki uç —
 * en güçlü ve en zayıf tema — adıyla, büyük medyanıyla, öne çıkan
 * üyeleriyle ve yükselen/düşen şeridiyle.
 *
 * Açılış öncesinde künye "Açılış Öncesi En Güçlü Tema" (`board.phase`,
 * gerekçesi lib/theme-stats.ts → themePhase).
 *
 * "Günün En Güçlüsü" YALNIZCA canlı seansta (dizindeki kuralın aynısı,
 * `board.leader`). Son kapanışa kalmış bir günde uçlar yine gösteriliyor
 * ama künyesi "Son Kapanışta En Güçlü": dünü bugün diye anlatmıyor, ekran
 * da boş kalmıyor.
 */
export async function ThemeSpotlight({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [{ board, scaleBasis, comparable, quotesResult, names, status }, sectorQuotes] = await Promise.all([
    loadThemeBoard(),
    getStatus().then(loadBoardQuotes),
  ]);
  /* BANDIN TEK DAMGASI. Sektörler ve temalar ayrı iki kotasyon turundan
     geliyor ama ikisi de aynı sağlayıcıdan; iki özdeş damga alt alta
     duruyordu. Damga ESKİ olanın anını ve iki turdan birinin bayatlığını
     yazıyor: tazeyi yazmak geride kalanı gizlemek olurdu. Sektörlerin
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
  const rows = themeRows(board.cards, scaleBasis, locale);
  const counted = rows.filter((row) => row.bar);
  const topMembers = extremeMembers(top ?? null, "top");
  const bottomMembers = extremeMembers(bottom ?? null, "bottom");

  return (
    <ThemeFrame
      meta={`${rankTitleOf(board.phase, t)} · ${t.themes.rankMeta}`}
      breadth={
        counted.length > 0 ? (
          <Breadth
            t={t}
            up={counted.filter((row) => row.value! > 0).length}
            down={counted.filter((row) => row.value! < 0).length}
          />
        ) : undefined
      }
      ranking={
        <RankBars
          rows={rows}
          floor={THEME_SCALE_FLOOR}
          locale={locale}
          foldId="tema-siralamasi"
          phoneEnds={THEME_PHONE_ENDS}
          more={t.compact.showAll}
          less={t.compact.showLess}
        />
      }
      extremes={
        <>
          {/* Logoların üzerine gelince açılan şirket kartı (components/ui/
              CompanyCards) — bandın kendi kotasyon paketiyle, ek istek yok. */}
          <CompanyCards
            symbols={[...topMembers, ...bottomMembers].map((member) => member.symbol)}
            quotes={quotesResult.ok ? quotesResult.data : null}
            stale={quotesResult.ok && Boolean(quotesResult.stale)}
            names={names}
            status={status}
          />
          <ExtremeCard
            card={top ?? null}
            members={topMembers}
            label={
              !session || board.phase === "lastClose"
                ? t.today.strongestLastClose
                : board.phase === "pre-market"
                  ? t.today.strongestPreMarket
                  : t.today.strongestTheme
            }
            locale={locale}
            t={t}
          />
          <ExtremeCard
            card={bottom ?? null}
            members={bottomMembers}
            label={
              !session || board.phase === "lastClose"
                ? t.today.weakestLastClose
                : board.phase === "pre-market"
                  ? t.today.weakestPreMarket
                  : t.today.weakestTheme
            }
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

type ExtremeMember = { symbol: string; logoUrl: string | null; change: number | null };

/**
 * Kartın üyeleri: medyana giren (aynı seansı anlatan) üyeler, en güçlü
 * temada en çok yükselenden, en zayıfta en çok düşenden başlayarak. Hareketi
 * bilinmeyen tema üyelerini editoryal sırayla ve yüzdesiz basar: eksik veri
 * "–" duvarı olmaz, satır sessizleşir.
 */
function extremeMembers(card: ThemeCard | null, end: "top" | "bottom"): ExtremeMember[] {
  if (!card) return [];
  const logos = new Map(card.members.map((member) => [member.symbol, member.logoUrl]));
  if (card.points.length === 0) {
    return card.members.slice(0, EXTREME_MEMBERS).map((member) => ({ ...member, change: null }));
  }
  return [...card.points]
    .sort((a, b) => (end === "top" ? b.change - a.change : a.change - b.change))
    .slice(0, EXTREME_MEMBERS)
    .map((point) => ({ symbol: point.symbol, logoUrl: logos.get(point.symbol) ?? null, change: point.change }));
}

function ThemeFrame({
  meta,
  breadth,
  ranking,
  extremes,
  stamp,
  t,
}: {
  meta: string;
  breadth?: React.ReactNode;
  ranking: React.ReactNode;
  extremes: React.ReactNode;
  stamp: React.ReactNode;
  t: Dictionary;
}) {
  /* `display: contents` (CSS): sıralama sektörlerin YANINA, uç kartları ve
     damga iki kolonun altına tam genişlikte iner. Temalar tek Suspense
     sınırı (tek `loadThemeBoard`), bant ızgarası üç öğe görür. */
  return (
    <div className={styles.themesPart}>
      <div className={cn(styles.part, styles.partThemes)}>
        <PartHead
          title={t.today.themesHeading}
          meta={meta}
          breadth={breadth}
          link={
            <PanelLink href="/temalar" className={styles.partLink}>
              {t.today.themesLink}
            </PanelLink>
          }
        />
        {ranking}
      </div>
      <div className={styles.extremes}>{extremes}</div>
      <div className={styles.stampRow}>{stamp}</div>
    </div>
  );
}

function ExtremeCard({
  card,
  members,
  label,
  locale,
  t,
}: {
  card: ThemeCard | null;
  members: readonly ExtremeMember[];
  label: string;
  locale: Locale;
  t: Dictionary;
}) {
  if (!card || card.median === null) {
    return (
      <div className={cn(styles.extreme, styles.extremeEmpty)} data-tone="flat">
        <span className={styles.extremeLabel}>{label}</span>
        <strong className={cn("numeral text-muted", styles.extremeFigure)}>{NO_VALUE}</strong>
      </div>
    );
  }
  /* Renk son kapanışta da işaretten — gerekçe yukarıda (SectorRibbonView).
     Kartın başlığı dönemi zaten söylüyor ("Son Kapanışta En Güçlü Tema"). */
  const tone = directionOf(card.median);
  const up = card.up ?? 0;
  const down = card.down ?? 0;
  const flat = Math.max(0, card.points.length - up - down);
  const split = card.up !== null && card.points.length > 0;
  return (
    <Link href={`/temalar/${card.theme.slug}`} prefetch={false} className={styles.extreme} data-tone={tone}>
      <span className={styles.extremeHead}>
        <span className={styles.extremeId}>
          <span className={styles.extremeTop}>
            <span className={styles.extremeLabel}>{label}</span>
            <ArrowUpRight weight="bold" size={13} className={styles.extremeArrow} aria-hidden />
          </span>
          <h3 className={styles.extremeTitle}>{themeTitle(card.theme, locale)}</h3>
        </span>
        <span className={cn("numeral", styles.extremeFigure, directionText(tone))}>
          <RollingFigure value={formatPercent(card.median, locale)} />
        </span>
      </span>
      {members.length > 0 && (
        <span className={styles.members} aria-hidden>
          {members.map((member) => (
            <span key={member.symbol} className={styles.member}>
              {/* `lg` (44) kaynak, CSS 36'ya indiriyor (büyütülmüş değil). */}
              <span className={styles.memberLogo}>
                <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="lg" card />
              </span>
              <span className={styles.memberSym}>{member.symbol}</span>
              {member.change !== null && (
                <b className={cn("numeral", styles.memberPct, directionText(directionOf(member.change)))}>
                  {formatPercent(member.change, locale, 1)}
                </b>
              )}
            </span>
          ))}
        </span>
      )}
      {/* YÜKSELEN / DÜŞEN ŞERİDİ. Çentik şeridinin (`SpreadStrip`) yerinde:
          her üye tek tek bir çentik değil, iki dolu parça — yeşil kaç üye
          yükseliyor, kırmızı kaç üye düşüyor (parça eni üye sayısıyla
          orantılı, 12 piksel). Medyan tek sayı olarak "tema ne yaptı" diyor
          ama yayılımı söylemiyor; şerit "kaçı aynı yöne gitti"yi tek bakışta
          veriyor. Ölçek, eksen, im yok: okurun çözeceği bir şey yok. */}
      {split && (
        <span
          className={styles.split}
          role="img"
          aria-label={t.themes.spreadLabel
            .replace("{count}", String(card.points.length))
            .replace("{up}", String(up))
            .replace("{down}", String(down))}
        >
          <span className={styles.splitBar} data-draw aria-hidden>
            {up > 0 && <i className="bar-fill" data-part="up" style={{ flexGrow: up }} />}
            {flat > 0 && <i data-part="flat" style={{ flexGrow: flat }} />}
            {down > 0 && <i className="bar-fill" data-part="down" style={{ flexGrow: down }} />}
          </span>
          <span className={styles.splitLegend} aria-hidden>
            {/* Telefonda yarım kart (130 piksel): "10 Üye Yükseliyor" iki
                satıra kırılıyordu (ölçüldü, kart 263). Kısa söz denendi
                ("10 Yükselen"): TR sığdı, EN ("10 Advancers · 7 Decliners")
                yine kırıldı. Telefonda söz yerine yön OKU — /temalar panosunun
                satırındaki "↑ 10 · ↓ 7" ile aynı im, iki dilde tek satır. */}
            <span className="text-up">
              <ArrowUp weight="bold" size={12} className={styles.splitIcon} />
              <b className="numeral">{up}</b> <span className={styles.splitLong}>{t.today.membersUp}</span>
            </span>
            <span className="text-down">
              <ArrowDown weight="bold" size={12} className={styles.splitIcon} />
              <b className="numeral">{down}</b> <span className={styles.splitLong}>{t.today.membersDown}</span>
            </span>
          </span>
        </span>
      )}
    </Link>
  );
}

/**
 * Temaların yedeği: sıralama on iki satırıyla ve editoryal sırayla (adlar
 * durağan), uç kartları gerçek kartın taban boyunda.
 */
export function ThemeSpotlightSkeleton({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <ThemeFrame
      meta={`${t.themes.rankTitle} · ${t.themes.rankMeta}`}
      ranking={
        <RankBars
          rows={themeRows(themePlaceholders(), null, locale)}
          floor={THEME_SCALE_FLOOR}
          locale={locale}
          foldId="tema-siralamasi"
          phoneEnds={THEME_PHONE_ENDS}
          more={t.compact.showAll}
          less={t.compact.showLess}
        />
      }
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
