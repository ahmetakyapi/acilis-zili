import { PageShare } from "@/components/article/PageShare";
import { Suspense } from "react";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { ThemeBoard } from "@/components/themes/ThemeBoard";
import styles from "@/components/themes/ThemeBoard.module.css";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp } from "@/components/ui/primitives";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { loadThemeBoard, themePlaceholders } from "@/lib/theme-board";
import { cn, formatPrice, NO_VALUE } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/temalar",
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
 * (Sabahki not: `ThemeRanking` ve `SpreadStrip` ana sayfanın bandında
 * yaşıyordu. İkisi de aynı gün SİLİNDİ: bant `RankBars`a geçti —
 * components/today/home/MarketTexture.tsx.)
 *
 * AKŞAM, GÖRSEL SIRALAMA (10 Kasım, ikinci tur; sahibi: "Temalar ekranını
 * daha görsel yapmak için…"). Sabahki pano okunaklı ama kuruydu (68
 * piksellik tablo satırı). Satır büyüdü ve üç şey gösteriyor: kim (ad 22,
 * logolar 32), ne kadar (14 piksellik çubuk, sayı ucunda, eksen günün
 * aralığı kadar) ve içeride ne var (üye ısı şeridi + iki uç üye adıyla).
 * Ölçüt çentiği panodan kalktı, kapaktaki "Aradaki Fark" iki noktadan kalın
 * çubuğa döndü. Karar kaydı ThemeBoard.tsx, ölçüm ThemeBoard.module.css.
 *
 * GECE, KAPAK KOMPAKT BANT (10 Kasım, üçüncü tur; ana oturumun kararı).
 * Satırlar 68 → 110 piksele büyüyünce 1440×900 ilk ekrana sığan tema 6'dan
 * 3'e indi: 280 piksellik kapak (başlık, açıklama, Paylaş, yön oranı, iki uç
 * kutusu, fark çubuğu) ekranın üçte birini tutuyordu ve iki uç kutusu
 * panonun ZATEN gösterdiğini (01 ve son satır, yönünün tonunda) ikinci kez
 * yazıyordu. Şimdi kapak Bilançolar'ın kompakt bandı (`DirectoryHeader
 * compact`): başlık, tek cümle ve Paylaş solda; sağda tek özet — temaların
 * yönü (oran çubuğu) ve iki uç arasındaki fark. İki uç kutusu KALKTI.
 * Ölçüm ThemeBoard.module.css → "ÖLÇÜM 3".
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
      <BreadcrumbJsonLd locale={locale} items={[{ name: t.themes.title, path: "/temalar" }]} />
      <DirectoryHeader
        compact
        title={t.themes.title}
        description={t.themes.subtitle}
        share={<PageShare compactOnMobile align="right" path="/temalar" title={t.themes.title} locale={locale} t={t} />}
        visual={
          <Suspense fallback={<HeroSummary summary={null} t={t} locale={locale} />}>
            <LiveHeroSummary locale={locale} t={t} />
          </Suspense>
        }
      />

      <Suspense
        fallback={
          <ThemeBoard
            board={{ cards: placeholders, leader: null, laggard: null, phase: null }}
            basis={null}
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
 * DÖRT KUTU YERİNE TEK YÜZEY (29 Eylül, sahibinin isteği: "görselliği daha
 * üst seviyeye"). Dört eşit kutu sıralamanın sayılarını ikinci kez
 * YAZIYORDU. Özet panonun söylemediğini gösteriyor: yükselen ve düşen tema
 * sayısı tek bir ORAN ÇUBUĞU (pano her temayı ayrı ayrı çiziyor, kaç
 * tanesinin artıda olduğunu okutmuyor), iki uç tema ve (10 Kasım) ikisinin
 * ARASINDAKİ FARK: aynı eksende iki nokta, aralarında çizgi, yanında puan
 * (akşam: noktalar kalktı, en zayıftan en güçlüye 8 piksellik dolu çubuk).
 * Hepsi aynı `comparable` kümesinden. Kutu değil ton.
 *
 * GECE, TEK SIRA (10 Kasım, üçüncü tur). İki uç kutusu (ad, logolar, 36
 * puntoluk medyan) KALKTI: pano aynı iki temayı 01 ve son satırda, yönünün
 * tonunda, adıyla, logolarıyla ve 22 puntoluk medyanıyla zaten gösteriyor;
 * kapakta ikinci kez yazmak 110 piksellik iki satıra mal oluyordu. Kalan
 * iki şey panonun SÖYLEMEDİĞİ: kaç tema artıda (oran çubuğu) ve iki uç
 * arasındaki fark (puan; fark çubuğu da kalktı — tek sayı, pano iki ucu
 * aynı eksende çiziyor). Özet kompakt bandın sağında, başlıkla aynı boyda
 * (iki satır, 48 piksel); 1024'ün altında başlığın altına iner.
 *
 * Son kapanışa kalmış günde künye "Son Kapanış" diyor ve sayılar nötr: dünü
 * bugün diye anlatmıyor. Fark yalnız ortak seans kümesinde iki uç varken
 * (panodaki tonla aynı kural, lib/theme-board.ts); yoksa tire, aynı boyda
 * (veri inince kapak oynamıyor).
 */
type HeroSummaryData = {
  rising: number;
  falling: number;
  /** Ortak kümedeki tema sayısı — medyanı tam sıfır olan tema ikisine de girmiyor. */
  total: number;
  session: boolean;
  preMarket: boolean;
  lastClose: boolean;
  /** En güçlü ile en zayıf temanın medyan farkı, puan; iki uç yoksa `null`. */
  gap: number | null;
};

async function LiveHeroSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis } = await loadThemeBoard();
  const comparable = board.cards.filter((card) => card.basis === scaleBasis && card.median !== null);
  const medianOf = (slug: string | null) => board.cards.find((card) => card.theme.slug === slug)?.median ?? null;
  const lead = medianOf(board.leader);
  const lag = medianOf(board.laggard);
  return (
    <HeroSummary
      summary={{
        rising: comparable.filter((card) => card.median! > 0).length,
        falling: comparable.filter((card) => card.median! < 0).length,
        total: comparable.length,
        session: scaleBasis === "session",
        preMarket: board.phase === "pre-market",
        lastClose: board.phase === "lastClose",
        gap: lead !== null && lag !== null ? lead - lag : null,
      }}
      locale={locale}
      t={t}
    />
  );
}

function HeroSummary({ summary, locale, t }: { summary: HeroSummaryData | null; locale: Locale; t: Dictionary }) {
  const tone = (kind: "up" | "down") =>
    summary === null ? "text-muted" : summary.session ? (kind === "up" ? "text-up" : "text-down") : "text-body";
  const neutral = !summary?.session;
  const total = summary?.total ?? 0;
  const flat = total - (summary?.rising ?? 0) - (summary?.falling ?? 0);
  const gap = summary?.gap ?? null;

  return (
    <div className={styles.pulse}>
      <div className={styles.pulseHead}>
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
          kalıyor — oran son kapanışta da okunur. Çizim globals'ın
          `bar-fill`i (gece: `data-motion-draw` kapısı `data-draw`a geçti). */}
      <span className={styles.bar8} data-draw aria-hidden>
        {total > 0 && (
          <>
            {summary!.rising > 0 && <i className="bar-fill" data-tone={neutral ? "neutral-up" : "up"} style={{ flexGrow: summary!.rising }} />}
            {flat > 0 && <i data-tone="flat" style={{ flexGrow: flat }} />}
            {summary!.falling > 0 && <i className="bar-fill" data-tone={neutral ? "neutral-down" : "down"} style={{ flexGrow: summary!.falling }} />}
          </>
        )}
      </span>
      <p className={styles.pulseGap}>
        <span className={styles.label}>{t.themes.gapLabel}</span>
        <b className={cn("numeral", gap === null && "text-muted")}>
          {gap !== null ? t.themes.gapPoints.replace("{points}", formatPrice(gap, locale)) : NO_VALUE}
        </b>
      </p>
    </div>
  );
}

async function LiveBoard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { board, scaleBasis, quotesResult, names, status } = await loadThemeBoard();
  /* ÖLÇÜT FONU PANODAN KALKTI (10 Kasım akşamı). Sabah şeritte bir çentikti
     (kural: ancak tema ile fon AYNI SEANSI anlatıyorsa); çubuğun üstünde tek
     başına duran çentik okurun çözmesi gereken ikinci bir imdi. Kıyas detay
     kapağında, iki kalın çubukla (`ThemeReading`); gerekçe ThemeBoard.tsx. */
  return (
    <>
      <ThemeBoard board={board} basis={scaleBasis} locale={locale} t={t} />
      {/* Kart kaydı yalnızca GÖRÜNEN logolar için (satır başına en çok yedi:
          altı logo, tam bir fazla üye varsa "+1" yerine onun logosu —
          ThemeBoard → ROW_LOGOS); fiyat panonun kendi paketinden. */}
      <CompanyCards
        symbols={[...new Set(board.cards.flatMap((card) => card.members.slice(0, 7).map((member) => member.symbol)))]}
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
