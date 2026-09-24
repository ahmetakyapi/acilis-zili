import { Fragment } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Article,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarBlank,
  Scales,
  Star,
  TrendUp,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { GuideHint } from "@/components/article/GuideHint";
import { Panel, LogoTile } from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { MetricCards, MetricNote } from "@/components/earnings/MetricCards";
import { ClampedHeadline } from "@/components/earnings/ClampedHeadline";
import { quarterGaps } from "@/components/earnings/quarter-gaps";
import { PriceRail, type RailMark } from "@/components/ui/PriceRail";
import { RevenueColumns } from "@/components/earnings/RevenueColumns";
import { GuidanceRanges } from "@/components/earnings/GuidanceRanges";
import type { FooterStat } from "@/components/earnings/ChartFooter";
import { RichText } from "@/components/earnings/RichText";
import { MotionExperience, ScrollStage, Reveal, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import styles from "@/components/earnings/EarningsReport.module.css";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { auth } from "@/auth";
import {
  getAnalyses,
  getAnalysis,
  getNextReport,
  getUpcomingEarnings,
  getStatus,
  getSymbolNames,
  getUserSymbols,
  liveMarketCap,
  getAnalysisLocales,
} from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { addEtDays, etParts, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  articleOpenGraph,
  metaDescription,
  missingMetadata,
} from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictTextClass,
  type VerdictKey,
} from "@/lib/analysis";
import {
  industryFilterFor,
  sectorGroupLabel,
  sectorGroupOf,
} from "@/lib/sectors";
import {
  cn,
  formatMoneyCompact,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  peRatioOf,
  safeExternalUrl,
  SIGN_GAP,
  tieCurrency,
  tieFigures,
  titleCaseLabel,
} from "@/lib/utils";
import type { EarningsAnalysisRow } from "@/lib/schema";

/**
 * Bilanço detayı — bir çeyreğin okunmuş hâli.
 *
 * Sıra karnedekiyle aynı ve bilinçli: görüş şeridi → altı metrik kartı →
 * çeyreklik gelir + öngörü aralıkları → CEO şeridi → özet → detaylı
 * değerlendirme → güçlü yönler/riskler/beklenen gelişmeler. Sayfa uzun
 * metinle açılıyordu ve çeyreğin rakamları dokuz paragrafın gölgesinde
 * kalıyordu; rakamı gören okuyucu artık metne inmek zorunda değil.
 *
 * Sağda sabit kalan referans kolonu yalnızca karne ve yaklaşan bilançolar
 * taşır. Metrikler ve CEO alıntısı oradan ANA kolona alındı: ikisi de
 * çeyreğin hikâyesinin parçası, kenarda duran birer referans değil.
 * Mobilde tek kolona düşer ve karne en üste çıkar.
 */

/**
 * Küçük etiket (büyük harfe ÇEVRİLMEZ, 24 Eylül; `.plate` ile aynı gerekçe) — `.plate`'in rengi serbest bırakılmış hâli.
 *
 * Bu sabit, `.plate` KATMANSIZ yazıldığı dönemden kalma: o zaman yanına
 * yazılan `text-primary` hiç uygulanmıyordu, çünkü katmansız bir kural
 * `@layer utilities` içindeki yardımcıyı her zaman eziyor. Tuzağın kanonik
 * anlatımı `app/globals.css` → "KATMAN — @layer components" bloğunda ve
 * sorun ORADA çözüldü: `.plate` artık katmanlı, yani renk yardımcısı
 * geçiyor. Sabit yine de duruyor çünkü punto da farklı (`text-nano`
 * ile `.plate`in 0.6875rem'i aynı şey değil); çağrı yerleri üstüne kendi
 * puntosunu yazıyor. Sadeleştirmek isteyen önce o farkı ölçsün.
 */
const PLATE_LABEL =
  "text-nano font-bold leading-none tracking-[0.02em]";

/**
 * Takvimdeki tarihin bu kaydın "sonraki dönem"ine ait sayılabileceği en uzun
 * ara. Çeyrekler ~91 gün arayla açıklanıyor; en geç açıklayanlarda (yıl
 * sonu çeyreği) ara 100-120 güne çıkıyor. Daha uzun bir ara, takvimin
 * gösterdiği tarihin bir SONRAKİ dönemin olduğunu söylüyor.
 */
const NEXT_REPORT_WINDOW_DAYS = 125;

/** Bu uzunluğun üstündeki şirket adı bir kademe küçük manşetle yazılır. */
const LONG_NAME_CHARS = 24;

/** Hedefe uzaklık ve hangi fiyattan ölçüldüğü. */
type Upside = { pct: number; basis: "today" | "report" };

const MONTHS: Record<string, number> = {
  oca: 1, şub: 2, sub: 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, ağu: 8, agu: 8,
  eyl: 9, eki: 10, kas: 11, ara: 12,
  jan: 1, feb: 2, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Tam ay adları — madde başındaki tarihi bir konu başlığından ayırmak için. */
const MONTH_NAMES = new Set([
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos",
  "eylül", "ekim", "kasım", "aralık",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
]);

/**
 * Kaydın serbest metin tahmini ("~21-22 Eylül 2026", "~Aralık 2026",
 * "Late October 2026") bugünden geride mi?
 *
 * Metnin gösterebileceği EN GEÇ gün alınıyor: gün yoksa ayın sonu, ay da
 * yoksa yılın sonu. Böylece "~Aralık 2026" Aralık bitene kadar geçmiş
 * sayılmıyor. Yıl okunamazsa cevap "hayır" — tarih çözülemiyorsa bir
 * tahmini gizlemek, onu yanlışlıkla geçmiş saymaktan az zararlı değil ama
 * kayıt her zaman yıl yazıyor (rutin şeması).
 */
function estimateIsPast(text: string, today: string): boolean {
  const lower = text.toLocaleLowerCase("tr-TR");
  const year = lower.match(/20\d{2}/)?.[0];
  if (!year) return false;
  const month = lower
    .split(/[^a-zçğıöşü]+/)
    .map((word) => MONTHS[word.slice(0, 3)])
    .find((value) => value !== undefined);
  const days = (lower.replace(year, "").match(/\b\d{1,2}\b/g) ?? [])
    .map(Number)
    .filter((day) => day >= 1 && day <= 31);
  const lastDay = month
    ? days.length > 0
      ? Math.max(...days)
      : new Date(Date.UTC(Number(year), month, 0)).getUTCDate()
    : 31;
  const latest = `${year}-${String(month ?? 12).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return latest < today;
}

/**
 * Künye rayı — manşetin altındaki sakin ölçü şeridi.
 *
 * Çukur zemin ve boşluk ayrımı çiziyor, dikey hairline yok: hücre sayısı
 * kayda göre değiştiği için ray satır atlayabiliyor ve çizgiler o zaman
 * ikinci satırın ilk hücresinin soluna, boşlukta duran bir hairline
 * bırakıyordu.
 *
 * `note` ölçünün PENCERESİ ya da BÖLENİ: "son 12 ay", "$105,61",
 * "ileriye dönük 3 yıl". Bir sayının ne zamana ait olduğu ya da neye
 * bölündüğü bu sayfada asla tahmine bırakılmıyor.
 */
type Fact = {
  label: string;
  value: string;
  note?: string | null;
  tone?: "up" | "down";
};

/* Sütun sayısı hücre sayısını izliyor: sabit bir sütun sayısı, ray dolmadığı
   günlerde satır sonunda boşluk bırakıyordu. En çok beş hücre olur —
   piyasa değeri, yıllık getiri, F/K, PEG, net kâr marjı.

   Sınıflar birebir yazılı; Tailwind kaynağı metin olarak tarıyor ve şablonla
   üretilen sınıf adları derlemeye girmiyor. */
const RAIL_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

function FactRail({ facts }: { facts: (Fact | false | null)[] }) {
  const list = facts.filter((fact): fact is Fact => Boolean(fact));
  if (list.length === 0) return null;

  return (
    /* DAR EKRANDA IZGARA DEĞİL SATIR.
       İki sütunlu ızgarada hücreye ~150 piksel düşüyor ve etiket büyük harf +
       geniş aralıkla yazıldığı için ("1 YILLIK GETİRİ") tek başına o genişliği
       dolduruyordu; parantezli künye ikinci satıra, sayı üçüncü satıra
       düşüyordu. Dört ölçü 400 piksellik bir blok oluyordu.
       Telefonda her ölçü tek satır: solda adı ve koşulu, sağda sayısı. Aynı
       kalıp hisse sayfasının seans haritasında ve karşılaştırmanın şirket
       künyesinde de var — dar ekranda ızgara yerine satır, bu depoda artık
       yerleşik bir çözüm. Geniş ekranda ızgara yerinde duruyor. */
    <dl
      className={cn(
        "rounded-lg bg-surface-sunken px-4 py-3 sm:grid sm:gap-x-5 sm:gap-y-4 sm:px-5 sm:py-3.5",
        "divide-y divide-line-soft sm:divide-y-0",
        RAIL_COLS[Math.min(list.length, 5)],
      )}
    >
      {list.map((fact) => (
        /* SAYILAR AYNI ÇİZGİDE. Hücreler yalnızca bir kutuydu ve etiketi iki
           satıra sarkan ölçünün sayısı, yanındakinden bir satır aşağı
           düşüyordu: telefonda "F/K 46,5" ile "NET KÂR MARJI %30,1" ızgaranın
           aynı satırındayken farklı yüksekliklerde duruyordu. Hücre artık
           sütun ve sayı `mt-auto` ile alta yaslı; ızgara satırı zaten eşit
           yükseklik veriyor. */
        <div
          key={fact.label}
          className="flex min-w-0 items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0 sm:flex-col sm:items-stretch sm:justify-start sm:gap-0 sm:py-0"
        >
          {/* Etiket ve künye 10px'ti ve okunmuyordu — ray zaten sakin bir
              katman, bir de puntoyu kısınca fısıltıya dönüşüyordu. */}
          <dt className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className={cn(PLATE_LABEL, "text-tiny text-muted")}>
              {fact.label}
            </span>
            {/* Künye PARANTEZ İÇİNDE. Etiketin yanında çıplak dururken ikisi
                tek bir uzun etiket gibi okunuyordu ("PİYASA DEĞERİ bugün");
                parantez, ölçünün adı ile o ölçünün koşulunu ayırıyor. */}
            {fact.note && (
              <span className="shrink-0 text-tiny font-medium text-muted">
                ({fact.note})
              </span>
            )}
          </dt>
          <dd
            className={cn(
              /* Satır düzeninde sayı sağ uçta ve bir punto küçük; ızgarada
                 eski yerinde ve eski boyunda. */
              "figure shrink-0 text-lead font-bold leading-none tracking-[-0.03em] sm:mt-auto sm:pt-1.5 sm:text-title",
              fact.tone === "up" && "text-up",
              fact.tone === "down" && "text-down",
              !fact.tone && "text-strong",
            )}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Panel başlığı — ikon karosu, başlık, sağda künye.
 *
 * Güçlü Yönler / Riskler kartlarıyla aynı dil: sayfadaki her panel aynı
 * biçimde açılıyor, çıplak bir `<h2>` kalanın yanında yarım duruyordu.
 */
function PanelHead({
  icon: Icon,
  title,
  meta,
}: {
  icon: typeof Article;
  title: string;
  meta?: string;
}) {
  return (
    /* flex-wrap: künye metni ("Açılış Zili Analiz Ekibi") telefonda başlığı
       iki satıra sıkıştırıyordu — sığmadığında kendi satırına düşer, başlık
       hep tek satır kalır. */
    <div className={cn(styles.panelHead, "mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft pb-3")}>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary-ink"
      >
        <Icon weight="duotone" size={15} />
      </span>
      <h2 className="whitespace-nowrap text-read font-bold tracking-[-0.01em] text-strong">
        {title}
      </h2>
      {meta && (
        <span className="plate ml-auto shrink-0 text-nano">
          {meta}
        </span>
      )}
    </div>
  );
}

export async function generateMetadata(
  props: PageProps<"/bilancolar/[symbol]/[period]">,
): Promise<Metadata> {
  const { symbol, period } = await props.params;
  const { locale } = await getI18n();
  const [row, diller] = await Promise.all([
    getAnalysis(symbol.toUpperCase(), period, locale),
    getAnalysisLocales(symbol.toUpperCase(), period),
  ]);
  if (!row) return missingMetadata(locale);
  return {
    title: `${row.company} ${row.periodLabel} (${row.symbol})`,
    description: metaDescription(row.headline),
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    /* ADRES `analysisHref`TEN — sayfanın canonical'ı ile sitenin bu sayfaya
       giden bütün bağlantıları aynı dizeyi yazsın diye. Burada sembol BÜYÜK
       harfle yazılıyordu; oysa site haritası, ana sayfa, takvim rozeti,
       analiz tablosu ve şerit — hepsi `analysisHref` üzerinden KÜÇÜK harf
       basıyor. Aynı içeriğe giden iki farklı adres, üstelik canonical
       hiçbirinin işaret etmediği üçüncü bir yazım demekti. `symbol`
       değişkeni veri okuması için büyük harf kalıyor; yalnızca adres
       üretenler yardımcıdan geçiyor. */
    /* HREFLANG YALNIZCA VAR OLAN DİLLERİ İLAN EDER — gerekçe
       `lib/data.ts` → `getStoryLocales` künyesinde. */
    alternates: pageAlternates(analysisHref(symbol, period), locale, diller),
    /* Blok `articleOpenGraph`tan: kendi `openGraph`ını veren sayfa kökteki
       `siteName` ve `locale`ı düşürüyordu, gerekçe orada. */
    openGraph: articleOpenGraph(locale, {
      publishedTime: row.publishedAt?.toISOString(),
    }),
  };
}

export default async function AnalysisDetailPage(
  props: PageProps<"/bilancolar/[symbol]/[period]">,
) {
  const params = await props.params;
  const symbol = params.symbol.toUpperCase();
  const period = params.period;

  const { locale, t } = await getI18n();
  const row = await getAnalysis(symbol, period, locale);
  if (!row) notFound();

  const session = await auth();
  const today = todayEt();
  const status = await getStatus();

  /* Rakip listesi yalnızca künyeye (sektör) bağlı; kotasyon ve ölçüler
     dış sağlayıcı turları ve onları beklemesi gerekmiyor. Künye aynı
     `cache()`li anahtarla soruluyor, ek sorgu yok (detay TTFB'si 199–727 ms
     ölçüldü, iki ardışık tur bunun içindeydi). */
  const metaP = getSymbolNames([symbol]);
  const [meta, userSymbols, quotes, keyMetrics, peers, nextReport, siblings] = await Promise.all([
    metaP,
    session?.user?.id ? getUserSymbols(session.user.id) : Promise.resolve([]),
    getQuotes([symbol], status),
    getKeyMetrics(symbol),
    metaP.then((names) =>
      getUpcomingEarnings(today, addEtDays(today, 30), 3, {
        exclude: symbol,
        industries: industryFilterFor(sectorGroupOf(names[symbol]?.industry)),
      }),
    ),
    getNextReport(symbol),
    getAnalyses(locale, { symbols: [symbol], limit: 4 }),
  ]);

  /* ---- Canlı kotasyon ----
     Kayıttaki `price` bilanço GÜNÜNÜN kapanışı ve donuk; okuyucunun bir
     sonraki sorusu "peki şimdi kaçtan işlem görüyor". Kotasyon gelmezse
     (anahtar yok, sağlayıcı düştü) blok hiç basılmaz — sayfa çalışmaya
     devam eder, yerinde boş bir kutu durmaz. */
  const live =
    quotes.ok && quotes.data[symbol]
      ? { quote: quotes.data[symbol], stale: quotes.stale }
      : null;
  /* Bilanço gününden bugüne değişim: iki sayı da elimizde, aradaki oran
     yeni bir iddia değil. Aynı günse anlamsız, o zaman yazılmaz. */
  const sinceReportRaw =
    live && row.price !== null && row.price > 0
      ? ((live.quote.price - row.price) / row.price) * 100
      : null;
  /* Yuvarlandığında sıfıra düşüyorsa hiç yazılmıyor: hisse o kapanıştan beri
     işlem görmediyse "bilanço gününden bugüne %0,0" satırı bilgi değil
     gürültü, üstelik hata gibi okunuyor. */
  const sinceReportPct =
    sinceReportRaw !== null && Math.abs(sinceReportRaw) >= 0.05
      ? sinceReportRaw
      : null;

  /* FİYAT ETİKETİ SEANSA GÖRE. Eskiden iki hâl vardı: normal seans ve taze
     ise "Şu An", gerisi "Son Kapanış". Ama `live.quote.price` son İŞLEM
     (`latestTrade.p`) ve ön/akşam seansında o, o dakikanın uzatılmış seans
     fiyatı — ona "Son Kapanış" demek sayıyı olduğundan eski gösteriyordu:
     TR 17:30'da (ABD ön seansı) 28 puntoyla "SON KAPANIŞ · 181,20 $"
     yazıyordu, oysa o sayı hiçbir kapanış değildi.

     Uzatılmış seans etiketi yalnızca son işlem BUGÜN olduysa basılıyor.
     Likit olmayan bir sembolde ön seansta henüz işlem yoksa son işlem dünkü
     kapanıştır ve etiket doğru olarak "Son Kapanış" kalır. Bayat kotasyon
     (`stale`) her durumda "Son Kapanış": sağlayıcı geriden geliyorsa
     "şu an" iddiası da düşer. */
  const islemBugun =
    live?.quote.tradedAt !== null &&
    live?.quote.tradedAt !== undefined &&
    etParts(live.quote.tradedAt).dateStr === todayEt();
  const priceLabel = !live
    ? null
    : live.stale
      ? t.analysis.lastClose
      : status.session === "regular"
        ? t.analysis.livePrice
        : status.session === "pre-market" && islemBugun
          ? t.market.preMarket
          : status.session === "after-hours" && islemBugun
            ? t.market.afterHours
            : t.analysis.lastClose;

  const symbolMeta = meta[symbol];

  /* ---- Değerleme künyesi ----
     Şeritte şirketin BÜYÜKLÜĞÜ ve YILI vardı, FİYATININ NEYE GÖRE kurulduğu
     yoktu: "187 milyar dolar" tek başına pahalı mı ucuz mu söylemiyor.

     ORANLAR BURADA KURULUYOR, hiçbir yerden hazır alınmıyor. Payı her zaman
     sayfanın kimlik bandında "şu an" diye yazdığı fiyat; bölenler ya
     analizle birlikte yazılıyor ya sağlayıcıdan geliyor. Böylece okuyucu
     üstteki fiyatı yandaki bölene bölüp oranı doğrulayabiliyor — ve oran
     fiyat oynadıkça eskimiyor. Sağlayıcının hazır F/K'si tam bu yüzden
     kullanılmıyor: SNDK'da %5,6 geriden geliyordu (bkz. `peRatioOf`).

     BÖLEN ÖNCE KAYITTAN okunuyor. Analizi yazan, bilançonun kendisinden
     gelen sayıyı `eps_ttm` alanına koyabiliyor; yoksa sağlayıcı devralıyor.
     Kayıt hep önde çünkü o, kaynağı belli ve sürüm geçmişinde duran bir sayı.

     DOĞRULANDI. 8 Ağustos 2026 kapanışında MU ve SNDK için bağımsız bir oran
     tablosuyla karşılaştırıldı: F/K'de 19,87/19,80 ve 16,63/16,43, hisse başı
     kârda %1'in altında fark. Kalan sapma TTM penceresinin nerede
     kapandığından geliyor, fiyattan değil.

     PEG YALNIZCA YAZILDIYSA çıkar, sağlayıcıdan türetilmez: bölünen
     büyümenin tanımı olmadan doğrulanamıyor — aynı gün aynı şirket için iki
     kaynak üç kat farklı veriyordu (MU 0,04 ile 0,12). Kayıt
     `growth_basis`'i zorunlu tutuyor, tanım da ekranda yazılı çıkıyor.

     PD/DD bir süre buradaydı ve KALDIRILDI: sektöre bağlı bir ölçü ve
     "bu şirkette anlamlı mı" kararı her analizde yeniden verilmesi gereken
     bir yargı çağrısıydı. Yanlış yazıldığında sessizce yanlış okunuyor —
     yarı iletkende 11,5 katı görüp "pahalı" demek gibi.

     Sayıların penceresi etiketin yanında yazılı — bir sayının "ne zamanki"
     olduğu sayfada asla tahmine bırakılmıyor. */
  const metrics = keyMetrics.ok ? keyMetrics.data : null;
  const finite = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const epsTtm = finite(row.epsTtm) ?? finite(metrics?.eps);
  const peRatio = peRatioOf(live?.quote.price, epsTtm);
  const netMarginPct = finite(metrics?.netMarginPct);

  /* PEG = F/K ÷ büyüme. F/K'nin kendisi yoksa (zararda ya da kotasyon yok)
     PEG de yok — bölünecek bir şey kalmıyor. */
  const growthPct = finite(row.growthPct);
  const pegRatio =
    peRatio !== null && growthPct !== null && growthPct > 0
      ? peRatio / growthPct
      : null;

  /* ---- Piyasa değeri: BUGÜNKÜ ----
     Kayıttaki `market_cap` bilanço günü kapanışıyla ölçülmüştü ve o sayının
     bugün bir karşılığı yok: şirketin büyüklüğü fiyatla birlikte her gün
     değişiyor, oysa okuyucunun sorusu "bu şirket ŞU AN ne kadar eder".
     Hisse sayısı yalnızca geri alım ve ihraçla, yani çeyreklerde değişiyor;
     bu yüzden değer canlı fiyattan kuruluyor ve sayfanın en üstündeki
     fiyatla aynı andan geliyor. Aynı hesap `/piyasalar`'da da kullanılıyor.

     Hisse sayısı ya da kotasyon yoksa kayıttaki sayıya düşülüyor ve künye
     "bilanço günü"ne dönüyor — hangi sayıya baktığı okuyucuya hep yazılı. */
  const liveCap =
    symbolMeta?.shareOutstanding && live?.quote.price
      ? liveMarketCap(symbolMeta, live.quote.price)
      : null;
  const marketCap = liveCap ?? row.marketCap;
  const marketCapNote =
    liveCap !== null ? t.analysis.asOfToday : t.analysis.asOfReport;

  const watched = userSymbols.includes(symbol);
  const verdict = verdictOf(row.verdict);
  const group = sectorGroupOf(symbolMeta?.industry);

  /* Sağ kolondaki "Yaklaşan Bilançolar": aynı sektörden en büyük üç şirket.
     Rastgele bir liste değil — okuyucu bu şirketin sonucunu okuduktan sonra
     doğal olarak rakiplerine bakıyor.

     SÜZGEÇ SORGUDA. Burada bir dönem 30 günlük takvimin TAMAMI çekilip
     (bilanço sezonunda birkaç bin satır) ardından o satırların tekil
     sembolleriyle `getSymbolNames` çağrılıyordu — binlerce elemanlı bir
     `inArray`, üç satır uğruna. Sektör eşlemesi kodda olduğu için grubun
     alt sektör adları sorguya açılıyor (industryFilterFor). */
  /* Seçim piyasa değerine göre (hangi rakipler önemli), SIRA zamana göre —
     tarih taşıyan liste en yakından başlar ("3 Eyl, 1 Eyl, 26 Ağu" gibi
     geriye akan bir sütun üretiyordu). Sıra artık `getUpcomingEarnings`in
     kendisinden geliyor (`byReportTime`, seans kırılımıyla); burada ayrı
     bir sıralama yok. */

  const langNote = row.locale === locale ? null : t.analysis.fallbackNote;
  const sources = row.sources ?? [];
  const hasColumns = (row.quarterlyRevenue?.length ?? 0) > 0;
  /* Sütun grafiğinin ölçeği: birim BAŞLIKTA bir kez söyleniyor, sütunlarda
     çıplak sayı kalıyor. Eşik en büyük çeyreğe bakıyor — bir şirketin geliri
     milyar bandındaysa hepsi milyar yazılır, milyon bandındaysa hepsi
     milyon; aynı grafikte iki farklı birim olmaz. */
  const revenueMax = Math.max(
    0,
    ...(row.quarterlyRevenue ?? []).map((bar) => bar.value),
  );
  const revenueScale = revenueMax >= 1e9 ? 1e9 : 1e6;
  const revenueUnit =
    revenueScale === 1e9 ? t.analysis.unitBillionUsd : t.analysis.unitMillionUsd;
  const hasGuidance = (row.guidance?.length ?? 0) > 0;

  /* ---- Sonraki bilanço: GEÇMİŞ TARİH "SONRAKİ" DİYE BASILMAZ ----
     Çip, öngörü başlığı ve öngörü künyesi kaydın serbest metninden
     (`nextReportEstimate`) okunuyordu ve kayıt YAZILDIĞI günün tahminini
     taşıyor: 23 Eylül'de /bilancolar/nvda/1c-fy2027 "Sonraki Bilanço: 2Ç
     FY27 · 26 Ağustos 2026" diyordu, oysa o bilanço açıklanmış ve analizi
     yayımlanmıştı (sayfa ona bağlantı bile vermiyordu). MU "~21-22 Eylül"
     diyordu, iki gün geçmişti.

     Sıradaki dönemin AÇIKLANDIĞINI şunlar kanıtlıyor, sırayla:
       1. aynı şirketin daha yeni bir analizi var — açıklandı;
       2. yoksa takvim konuşuyor: bugünden sonraki ilk tarih bu bilançodan
          bir çeyrek içindeyse (`NEXT_REPORT_WINDOW_DAYS`) o tarih kaydın
          adını verdiği dönemin — açıklanmadı, kaydın tahmini geçmiş olsa
          bile (MU "~21-22 Eylül" diyordu, takvim 30 Eylül); daha
          sonraysa bir SONRAKİ dönemin — açıklandı;
       3. takvimde tarih yoksa kaydın tahmini: bugünden geride kaldıysa
          açıklandı.
     Açıklandıysa dönem adı çipten düşüyor; takvimde gelecek bir tarih
     varsa çip yalnızca onu yazıyor, yoksa hiç basılmıyor. */
  const newerAnalysis =
    siblings
      .filter((item) => item.reportDate > row.reportDate)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0] ?? null;
  const calendarFitsRecord =
    nextReport !== null &&
    nextReport.date <= addEtDays(row.reportDate, NEXT_REPORT_WINDOW_DAYS);
  const nextPeriodReported =
    newerAnalysis !== null ||
    (nextReport !== null
      ? !calendarFitsRecord
      : row.nextReportEstimate !== null && estimateIsPast(row.nextReportEstimate, today));
  /* Yazılacak tarih: önce takvim (her gün tazeleniyor), yoksa kaydın
     tahmini — ama yalnızca dönem henüz açıklanmadıysa. */
  const nextReportText = nextPeriodReported
    ? nextReport
      ? formatEtDateLong(nextReport.date, locale)
      : null
    : nextReport
      ? formatEtDateLong(nextReport.date, locale)
      : row.nextReportEstimate;
  const nextReportCompact = nextReport
    ? formatEtDateCompact(nextReport.date, locale)
    : nextPeriodReported
      ? null
      : row.nextReportEstimate;

  /* ---- Kapaktaki üç fiyat: TEK dize, TEK kaynak ----
     Canlı fiyat, bilanço günü kapanışı ve hedef kapakta birer kez metin
     olarak basılıyor ve fiyat merdiveni, yapışkan çubuk aynı dizeleri
     okuyor (CLAUDE.md "Veri dürüstlüğü" 3: aynı sayı iki yerde duruyorsa
     aynı kaynaktan). */
  const liveText = live ? formatPrice(live.quote.price, locale, { currency: true }) : null;
  const closeText = row.price !== null ? formatPrice(row.price, locale, { currency: true }) : null;
  const targetText =
    row.targetPrice !== null ? formatPrice(row.targetPrice, locale, { currency: true }) : null;
  const sinceReportText =
    sinceReportPct !== null ? formatPercent(sinceReportPct, locale, 1) : null;

  /* ---- Potansiyel: KAPAKTAKİ FİYATTAN ----
     "Yükseliş Potansiyeli" bilanço günü kapanışından ölçülüyordu ve
     künyesi bunu söylemiyordu; kapağın manşet fiyatı ise canlı kotasyon.
     BE hedefin ÜSTÜNDE işlem görürken "▲ %64" diyordu (canlı 280,00,
     hedef 274,00), MRK hedefin %9,7 üstündeyken "▲ %6". Oran artık
     okuyucunun gördüğü fiyattan kuruluyor ve dayanağı yazılı; hedefin
     kendisi kaydın, yani bilanço günü ortalaması.
     Bayat kotasyonda ("Son Kapanış", sağlayıcı geriden) ya da kotasyon
     yoksa kayıttaki değere dönülüyor ve künye "Bilanço Günü Kapanışına
     Göre" diyor. */
  const upside: Upside | null =
    row.targetPrice === null
      ? null
      : live && !live.stale && live.quote.price > 0
        ? {
            pct: ((row.targetPrice - live.quote.price) / live.quote.price) * 100,
            basis: "today",
          }
        : (() => {
            const pct =
              row.upsidePct ??
              (row.price !== null && row.price > 0
                ? ((row.targetPrice - row.price) / row.price) * 100
                : null);
            return pct === null ? null : { pct, basis: "report" as const };
          })();

  /* Fiyat merdiveninin işaretleri — gerekçe kapaktaki `reportClose`
     notunda. Bugün ile hedef arası yön renginde bir bant: fiyat hedefin
     altındaysa yukarı (yeşil), üstündeyse aşağı (kırmızı) — potansiyel
     rozetinin rengiyle aynı hesap. Bugün yoksa bant kapanıştan. */
  const ladderBase =
    upside?.basis === "today" && live ? live.quote.price : row.price;
  const ladderMarks: RailMark[] =
    row.price === null
      ? []
      : [
          ...(row.targetPrice !== null && ladderBase !== null
            ? [
                {
                  kind: "band",
                  from: Math.min(ladderBase, row.targetPrice),
                  to: Math.max(ladderBase, row.targetPrice),
                  tone: row.targetPrice >= ladderBase ? "up" : "down",
                } as const,
              ]
            : []),
          ...(live && live.quote.price > 0
            ? [{ kind: "travel", from: row.price, to: live.quote.price } as const]
            : []),
          {
            kind: "point",
            at: row.price,
            variant: "ghost",
            label: t.analysis.asOfReport,
            value: closeText ?? undefined,
            side: "below",
          },
          ...(live && live.quote.price > 0
            ? [
                {
                  kind: "point",
                  at: live.quote.price,
                  variant: "live",
                  label: live.stale ? t.analysis.lastClose : t.analysis.asOfToday,
                  value: liveText ?? undefined,
                  side: "above",
                } as const,
              ]
            : []),
          ...(row.targetPrice !== null
            ? [
                {
                  kind: "point",
                  at: row.targetPrice,
                  variant: "target",
                  label: t.analysis.ogTarget,
                  value: targetText ?? undefined,
                  side: "above",
                } as const,
              ]
            : []),
        ];

  /* Yapışkan çubukta dönem kısa yazılıyor: "3Ç FY2026" → "3Ç FY26". */
  const shortPeriod = row.periodLabel.replace(/FY20(\d{2})/, "FY$1");

  /* 1440px ölçümünde büyük mali dönem satırı tek başına 111px tutuyordu.
     Dönem artık üst künyede; kapağın odağı kayıttaki ilk iki gerçek sonuç.
     Bu ölçüler aşağıdaki ızgaradan taşınır, iki yerde tekrar edilmez.
     Mini grafik yalnızca gerçekleşen gelirleri içerir; öngörüleri gerçek
     sonuç gibi göstermemek için projected öğeler burada yer almaz. */
  const coverMetrics = (row.highlights ?? []).slice(0, 2);
  const detailMetrics = (row.highlights ?? []).slice(2);
  const coverRevenue = (row.quarterlyRevenue ?? [])
    .filter((bar) => !bar.projected && Number.isFinite(bar.value) && bar.value >= 0)
    .slice(-5);
  const coverRevenueMax = Math.max(0, ...coverRevenue.map((bar) => bar.value));
  /* Kapaktaki mini grafikte eksik çeyrek — gerekçe `quarter-gaps.ts`. */
  const coverGaps = quarterGaps(coverRevenue.map((bar) => bar.label));

  /* ---- Grafik künyeleri ----
     Karnede grafiklerin altında üçer mini ölçü duruyor ve kartı tamamlayan
     şey o; onsuz kart "işte bir grafik" diyor. Alanlar sonradan eklendiği
     için analizlerin çoğunda boş — o zaman künye KAYITTAKİ sayılardan
     kuruluyor. Uydurma değil: üçü de gövdede zaten duran, sayfanın başka
     yerinde de basılan ölçüler; burada grafiğin bağlamı olarak
     tekrarlanıyorlar.

     Sütun grafiğinin altına çeyreğin GERÇEKLEŞEN üç ölçüsü, öngörü kartının
     altına GELECEĞE dair üç künye — her kart kendi zamanına bakıyor. */
  const toneOf = (value: number) => (value >= 0 ? "up" : "down");
  const arrow = (value: number) => (value >= 0 ? "▲" : "▼");
  const revenueFooter: FooterStat[] = row.revenueFooter?.length
    ? row.revenueFooter
    : ([
        row.revenueYoyPct !== null && {
          label: t.analysis.revenueGrowthYoy,
          value: `${arrow(row.revenueYoyPct)} ${formatPercentPlain(row.revenueYoyPct, locale, 0)}`,
          tone: toneOf(row.revenueYoyPct),
        },
        row.epsSurprisePct !== null && {
          label: t.analysis.epsSurprise,
          value: `${arrow(row.epsSurprisePct)} ${formatPercentPlain(row.epsSurprisePct, locale, 0)}`,
          tone: toneOf(row.epsSurprisePct),
        },
        row.reactionPct !== null && {
          label: t.analysis.stockReaction,
          value: `${arrow(row.reactionPct)} ${formatPercentPlain(row.reactionPct, locale, 1)}`,
          tone: toneOf(row.reactionPct),
        },
      ].filter(Boolean) as FooterStat[]);
  /* Kayda yazılmış künyede de "Sonraki Bilanço" satırı serbest metin ve
     aynı kuralla ayıklanıyor: değer yukarıdaki hesaptan, yoksa satır hiç. */
  const NEXT_EARNINGS_LABEL = /sonraki bilanço|next (earnings|report)/i;
  const guidanceFooter: FooterStat[] = row.guidanceFooter?.length
    ? row.guidanceFooter.flatMap((stat) =>
        NEXT_EARNINGS_LABEL.test(stat.label)
          ? nextReportCompact
            ? [{ ...stat, value: nextReportCompact }]
            : []
          : [stat],
      )
    : ([
        row.nextPeriodLabel && !nextPeriodReported && {
          label: t.analysis.nextPeriod,
          value: row.nextPeriodLabel,
        },
        nextReportCompact && {
          label: t.analysis.nextEarnings,
          value: nextReportCompact,
        },
        row.targetPrice !== null && {
          label: row.analystCount
            ? t.analysis.analystTargetCount.replace(
                "{count}",
                String(row.analystCount),
              )
            : t.analysis.analystTarget,
          value: formatPrice(row.targetPrice, locale, { currency: true }),
        },
      ].filter(Boolean) as FooterStat[]);

  /* Kapanış şeridinde kaç kart basılacak: rakip takvimi yalnızca aynı
     sektörden yaklaşan bilanço varsa çıkıyor; rehber şeridi her zaman var. */
  const bottomCards = 1 + (peers.length > 0 ? 1 : 0);

  return (
    <MotionExperience className={styles.report}>
      <ScrollProgress />
      <ArticleJsonLd
        headline={`${row.company} ${row.periodLabel}`}
        description={row.headline}
        path={analysisHref(symbol, period)}
        locale={row.locale as Locale}
        published={row.publishedAt}
        modified={row.updatedAt}
      />
      <BreadcrumbJsonLd
        locale={row.locale as Locale}
        items={[
          /* Sektör halkası YOK: adresi süzgeçli dizin (`?filtre=`) ve o
             adresin canonical'ı süzgeçsiz dizin. Kırıntıda canonical olmayan
             bir adres, arama motoruna dizine almayacağı bir sayfayı
             gösteriyordu. Ekrandaki kırıntı sektörü taşımaya devam ediyor. */
          { name: t.analysis.title, path: "/bilancolar/analizler" },
          {
            name: `${row.company} · ${row.periodLabel}`,
            path: analysisHref(symbol, period),
          },
        ]}
      />

      {/* ---- Künye ---- */}
      <nav
        aria-label={t.common.breadcrumb}
        className="flex flex-wrap items-center gap-2 text-small text-muted"
      >
        <Link
          href="/bilancolar/analizler"
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary"
        >
          {t.analysis.title}
        </Link>
        <span aria-hidden>›</span>
        <Link
          href={`/bilancolar/analizler?filtre=${group.key}`}
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary"
        >
          {sectorGroupLabel(group, locale)}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-strong">
          {row.company} · {row.periodLabel}
        </span>
      </nav>

      {/* ---- Şirket başlığı ----
          İKİ SATIR: üstte kimlik, altta ölçüler.

          Bir süre kimlik SOLDA, ölçüler SAĞDA iki sütun hâlindeydi. Ölçü
          sütunu üç katmana çıkınca (bilanço günü → bugün → büyüklük) sol
          sütundan iki kat uzun oldu; kimlik kısa bir bloktur ve altındaki
          çipler `mt-auto` ile tabana yapıştığı için aralarında kocaman bir
          delik kaldı. Sütunları eşit uzunlukta içerikle doldurmanın yolu
          yok — biri iki satır, öteki altı.

          Ölçüler alt satıra alınıp yatay bir şeride dönüşünce delik
          kapanıyor, her ölçü kendi sütununda okunuyor ve şerit kartın
          genişliğini gerçekten kullanıyor.

          TEK IZGARA (24 Eylül). 1440'ta kapakta birbirinden bağımsız on bir
          sol kenar vardı (93, 118, 197, 503, 509, 680, 852, 882, 1024,
          1180, 1195) ve yakın ıskalar hata gibi okunuyordu: ikinci öncü
          ölçü 503'te, altındaki ray 509'da. Geniş ekranda her bant aynı
          12 sütunlu ızgarayı kuruyor (EarningsReport.module.css →
          `COVER_GRID`), kenarlar dört çizgiye iniyor.

          SIRA TELEFONDA GÖRÜŞTEN BAŞLIYOR. DOM sırası kimlik → görüş →
          sonuçlar → ölçüler; 640 ve üstünde CSS `order` sonuçları görüşün
          önüne alıyor. Gerekçe VerdictStrip başında.

          Kapak `SpotlightCard` içindeydi: imleci izleyen bir ışık
          halkası. Derinlik tonla kuruluyor, ışıkla değil — kaldırıldı. */}
      <header id="report-overview" className={cn(styles.cover, "flex flex-col gap-4 rounded-xl border border-line bg-surface-solid p-4 sm:p-5")}>
        {/* SEKME BURAYA İNİYOR ve adı "Genel Bakış"; kapakta o adı taşıyan
            bir başlık yoktu — ilk h2 "Genel Görüş"tü, sekmeyle karışan
            ikinci bir ad. Görünür bir başlık kapakta şirket adıyla
            yarışırdı; ekran okuyucunun başlık listesinde bölüm adı
            sekmeyle aynı (ChapterHeading'in kuralı). */}
        <h2 className="sr-only">{t.analysis.reportOverview}</h2>

        {newerAnalysis && (
          /* DAHA YENİ ANALİZ VAR. Eski çeyreğin sayfası kendi başına doğru
             ama okuyucuyu geçmişte bırakıyordu: NVDA 1Ç FY2027 sayfası 2Ç
             FY2027 analizine hiçbir yerden bağlantı vermiyordu. Kapağın en
             üstünde, tek satır — bir uyarı kutusu değil, bir yönlendirme. */
          <Link
            href={analysisHref(newerAnalysis.symbol, newerAnalysis.period)}
            className={cn(
              styles.coverNotice,
              "flex min-h-11 flex-wrap items-center gap-x-2 rounded-lg border border-primary-faint bg-primary-tint px-3.5 py-2 text-small font-semibold text-primary-ink transition-colors hover:border-primary",
            )}
          >
            <span className="font-bold">{t.analysis.newerAnalysis}:</span>
            <span>
              {newerAnalysis.periodLabel} · {formatEtDateCompact(newerAnalysis.reportDate, locale)}
            </span>
            <ArrowRight aria-hidden size={14} weight="bold" className="ml-auto" />
          </Link>
        )}

        <div className={styles.coverIdentity}>
          {/* Sol kolon: kimlik + künye çipleri.
              Çipler bir süre KENDİ BANDINDAYDI ve solda iki çip, sağında bin
              piksel boşluk bırakıyordu; kart üç gevşek şeride bölünüyordu.
              Çipler bu raporun künyesi — şirket adının altında, ait oldukları
              yerde. Kart artık iki bant: solda kimlik + künye, sağda "şu an". */}
          <div className="flex min-w-0 flex-col gap-3.5">
            {/* KİMLİĞİN TAMAMI HİSSE SAYFASINA GİDİYOR.
                Bağlantı yalnızca sembol ÇİPİNDEYDİ: logo ve şirket adı —
                blokta gözün ilk gittiği iki öğe — tıklanınca hiçbir şey
                yapmıyordu, hedef ise küçük bir çipti. Üçü aynı şirketi
                söylüyor; tek bağlantı olup tek sekme durağı olmaları doğru
                olanı. Çip artık bağlantı değil ama görüntüsü aynı kalıyor:
                borsayı söyleyen bir künye ve bloğun tıklanabilir olduğunu
                anlatan tek görünür işaret. Teknik analiz kapağı da aynı
                kalıbı taşıyor (`components/technical/Technical.module.css`
                → `.coverNameLink`). */}
            <Link
              href={`/hisse/${symbol}`}
              className="group flex min-w-0 items-start gap-3 sm:gap-4"
            >
              {/* Telefonda 44 piksel: 56'lık karo kimlik satırını görüş
                  şeridini ilk ekrandan itecek kadar uzatıyordu. */}
              <LogoTile
                symbol={symbol}
                logoUrl={symbolMeta?.logoUrl}
                size="xl"
                className="max-sm:size-11"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  {/* UZUN AD KENDİ ÖLÇÜSÜNDE. "Space Exploration
                      Technologies" 4,5rem'lik manşet ölçüsünde telefonda
                      dört satır tutuyordu; 24 karakterden uzun adlar bir
                      kademe küçük ve dengeli sarıyor. */}
                  <h1
                    className={cn(styles.companyTitle, "w-fit text-heading font-bold tracking-[-0.035em]")}
                    data-long={row.company.length > LONG_NAME_CHARS || undefined}
                  >
                    {row.company}
                  </h1>
                  <span className="rounded-md border border-primary-faint bg-primary-wash px-2 py-[3px] text-tiny font-bold text-primary-ink transition-colors group-hover:bg-primary-tint">
                    {symbol}
                    {row.exchange ? ` · ${row.exchange}` : ""}
                  </span>
                  {/* DÖNEM ÇİPİ SEMBOLÜN YANINDA. Kapağın üstünde "Bilanço
                      Analizi · 3Ç FY2026" diye ayrı bir bant vardı (1440'ta
                      67 piksel): künye çubuğunun hemen altında aynı şeyi
                      ikinci kez söylüyordu ve ölçü rayını 900 piksellik
                      ekranda sabit şeridin arkasına itiyordu. Bant gitti,
                      dönem kimliğin künyesi oldu. */}
                  {/* Telefonda künye çubuğu dönemi hemen üstte yazıyor
                      ("Adobe · 3Ç FY2026") ve çip ikinci bir satır açıp
                      görüş şeridini aşağı itiyordu. */}
                  <span className="rounded-md border border-line px-2 py-[3px] text-tiny font-bold text-body max-sm:hidden">
                    {row.periodLabel}
                  </span>
                </div>
                {row.sector && (
                  <p className="text-xs font-medium text-muted">{row.sector}</p>
                )}
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:gap-1.5">

              {/* Bu künye bir süre dolu siyah bir kutuydu. Sayfadaki en koyu
                  yüzey oydu ve gözü ilk oraya çekiyordu — oysa taşıdığı bilgi
                  bir tarih, sayfanın en önemli şeyi değil. Komşusuyla aynı
                  aileye alındı: ikisi de kenarlıklı çip, biri nötr (olmuş
                  olan), öteki accent (olacak olan). */}
              {/* DAR EKRANDA KUTU DEĞİL KÜNYE.
                  İki rozet telefonda alt alta, her biri satırın neredeyse
                  tamamını kaplayan birer kutu olarak duruyordu; üstelik
                  birincisi künye çubuğunun ("Bilançolar › Yarı İletken ›
                  NVIDIA · 2Ç FY2027") zaten söylediğini tekrar ediyordu.
                  Telefonda ikisi de çerçevesiz künye metni — bilgi duruyor,
                  kutular gidiyor. Geniş ekranda yer var, rozetler orada. */}
              <span className="inline-flex items-center gap-1.5 text-nano font-bold leading-tight text-body sm:min-h-7 sm:rounded-md sm:border sm:border-line sm:bg-surface-solid sm:px-2.5">
                <CalendarBlank weight="duotone" size={12} className="text-muted" />
                {formatEtDateLong(row.reportDate, locale)}
              </span>
              {/* Sonraki bilanço: dönem adı yalnızca o dönem henüz
                  açıklanmadıysa; tarih takvimden, gerekçe yukarıda
                  (`nextPeriodReported`). Takvimde tarih varsa yanında
                  takvime ekleme düğmesi. */}
              {nextReportText && (
                <span className="inline-flex items-center gap-1 text-nano font-bold leading-tight text-primary-ink sm:min-h-7 sm:rounded-md sm:border sm:border-primary-faint sm:bg-primary-wash sm:pl-2.5 sm:pr-1">
                  {t.analysis.nextEarnings}:{" "}
                  {!nextPeriodReported && row.nextPeriodLabel ? `${row.nextPeriodLabel} · ` : ""}
                  {nextReportText}
                  {nextReport && (
                    <AddToCalendar
                      symbol={symbol}
                      date={nextReport.date}
                      label={t.earnings.addToCalendar}
                      compact
                      className="-my-2"
                    />
                  )}
                </span>
              )}
              {langNote && (
                <span className="inline-flex min-h-7 items-center rounded-md bg-surface-elevated px-2.5 text-nano font-semibold text-muted">
                  {langNote}
                </span>
              )}

            </div>
          </div>

          {/* ---- Şu an ----
              Kimlik bandının sağ yarısı BOŞTU: en dıştaki sarmalayıcı
              `lg:flex-row` idi ama içinde tek çocuk vardı — iki sütunlu eski
              tasarımdan kalan bir kabuk. Sayfanın açılışında okuyucunun ilk
              sorduğu sayı ("şimdi kaçtan işlem görüyor") ölçü şeridinin
              içinde, kapanış fiyatıyla aynı puntoda kaybolmuştu. Yukarı
              alınınca hem o boşluk doluyor hem kart bir odak kazanıyor.
              Kapanış fiyatı aşağıda kendi adıyla duruyor; iki fiyat tanımı
              gereği farklı ve ikisi de nereye ait olduğu yazılı. */}
          {/* Sağ kolon: "şu an" ve favori düğmesi, aynı sağ kenara yaslı.
              Düğme bir süre SOL kolondaki çip satırının sonundaydı ve
              `ml-auto` ile o kolonun sağ ucuna yaslanıyordu — yani fiyat
              bloğunun sol kenarından üç yüz piksel geride duruyordu. İki
              hizasız sağ kenar kartın en görünür yerinde yan yanaydı. */}
          {(live || session?.user) && (
            <div className={cn(styles.coverLive, "flex shrink-0 flex-col gap-3.5 sm:items-end sm:text-right")}>
              {live && (
                <div>
              {/* TEK ETİKET. Yan yana "ŞU AN" ve "Önceki Kapanış" yazıyordu:
                  biri fiyatın şu anki olduğunu, öteki geçen seansın
                  kapanışı olduğunu söylüyor ve ikisi aynı sayının üstünde
                  duruyordu. Borsa kapalıyken ekrandaki sayı zaten kapanış
                  fiyatı; ona "şu an" demek sayıyı olduğundan taze
                  gösteriyor. Etiket artık durumu tek başına söylüyor. */}
              {/* DAR EKRANDA MANŞET DEĞİL, BAĞLAM.
                  İki fiyat mobilde aynı puntoda (28px) üst üste geliyordu:
                  "son kapanış" ile "bilanço günü kapanışı". İkisi de manşet
                  gibi durunca sayfanın konusunun hangisi olduğu okunmuyordu —
                  oysa bu sayfa BİR ÇEYREĞİ anlatıyor ve manşet, o çeyreğin
                  günündeki kapanış. Telefonda bu blok tek satırlık bir bağlam
                  (etiket, fiyat, değişim yan yana); geniş ekranda kimlik
                  bandının sağ yarısını dolduran eski manşet olarak kalıyor. */}
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:flex-col sm:items-end sm:gap-0">
                <span className={cn(PLATE_LABEL, "text-primary")}>
                  {priceLabel}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2.5 sm:mt-1.5 sm:justify-end">
                  <span className="figure text-title font-bold leading-none tracking-[-0.04em] text-strong sm:text-subdisplay">
                    {liveText}
                  </span>
                  {/* Değişim bilinmiyorsa yön rengi de yok: tire nötr basılır. */}
                  <span
                    className={cn(
                      "figure text-small font-bold sm:text-read",
                      live.quote.changePct === null
                        ? "text-muted"
                        : live.quote.changePct >= 0
                          ? "text-up"
                          : "text-down",
                    )}
                  >
                    {formatPercent(live.quote.changePct, locale)}
                  </span>
                </span>
              </div>
              {sinceReportPct !== null && (
                /* 10,5px'ti ve 30px'lik fiyatın yanında künye gibi kalıyordu;
                   oysa bu satır sayfanın ana sorusuna ("bilanço günden bugüne
                   ne oldu") doğrudan cevap veriyor. Etiket 12px gövde
                   mürekkebine, oran 13px'e çıktı. */
                <p className="mt-1 text-tiny text-body sm:mt-2 sm:text-small">
                  {t.analysis.sinceReport}{" "}
                  <span
                    className={cn(
                      "figure text-small font-bold sm:text-base",
                      sinceReportPct >= 0 ? "text-up" : "text-down",
                    )}
                  >
                    {sinceReportText}
                  </span>
                </p>
              )}
                </div>
              )}

              {session?.user && (
                <form action={toggleSymbolFavorite}>
                  <input type="hidden" name="symbol" value={symbol} />
                  <button
                    type="submit"
                    className={cn(
                      "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-nano font-bold transition-colors",
                      watched
                        ? "border-primary-faint bg-primary-wash text-primary-ink"
                        : "border-line bg-surface-solid text-body hover:border-line-strong hover:text-strong",
                    )}
                  >
                    <Star weight={watched ? "fill" : "duotone"} size={12} />
                    {watched ? t.stock.removeFromWatchlist : t.stock.addToWatchlist}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <VerdictStrip
          row={row}
          verdict={verdict}
          upside={upside}
          targetText={targetText}
          locale={locale}
          t={t}
        />

        {/* İlk kapakta dönem büyük bir manşetti; kullanıcı geri bildirimiyle
            görsel ağırlık çeyreğin sonuçlarına geçti. Etiketler ve notlar
            doğrudan analiz kaydından gelir; şirkete özgü ölçü tanımları
            (ürün geliri, düzeltilmiş kâr vb.) genelleştirilmez. */}
        {(coverMetrics.length > 0 || coverRevenueMax > 0) && (
          <div
            className={styles.coverResults}
            data-has-trend={coverRevenueMax > 0}
            data-has-metrics={coverMetrics.length > 0}
          >
            {coverMetrics.length > 0 && (
              <dl data-motion-stagger className={styles.coverLeadFacts}>
                {coverMetrics.map((metric) => (
                  <div key={metric.label}>
                    <dt>{tieFigures(metric.label)}</dt>
                    <dd className="figure">{tieCurrency(metric.value)}</dd>
                    {metric.note && (
                      <dd className={styles.coverMetricNote}>
                        <MetricNote note={metric.note} tone={metric.tone} locale={locale} neutralClass="text-primary-ink" />
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}
            {coverRevenueMax > 0 && (
              <figure className={styles.coverTrend}>
                <figcaption>
                  {/* `tap-44`: bağlantı 17 piksel yüksekliğindeydi (390'da
                      ölçüldü) — sayfadaki en küçük dokunma hedefi. */}
                  <a href="#report-figures" className={`${styles.coverTrendLink} tap-44`}>
                    {t.analysis.quarterlyRevenue}
                    <ArrowDownRight size={14} aria-hidden />
                  </a>
                  <span>{t.analysis.legendActual} · {revenueUnit}</span>
                </figcaption>
                {/* EKSİK ÇEYREK BOŞLUKLA GÖSTERİLİYOR. SPCX'in serisi 2Ç25,
                    1Ç26, 2Ç26 ve üçü eşit aralıkla diziliyordu: ardışık
                    çeyrekler gibi. Arada iki çeyrek yok; etiketlerden
                    çözülen sıra bir adımdan büyükse araya kesikli bir
                    kırılma çiziliyor (`quarterGaps`, RevenueColumns ile
                    ortak). Etiket çözülemezse eski düzen. */}
                <div data-motion-stagger className={styles.coverTrendPlot}>
                  {coverRevenue.map((bar, index) => (
                    <Fragment key={`${bar.label}-${index}`}>
                      {coverGaps[index] && (
                        <div className={styles.coverTrendGap}>
                          <span className="sr-only">{t.analysis.missingQuarter}</span>
                        </div>
                      )}
                      <div className={styles.coverTrendColumn}>
                        <div className={styles.coverTrendTrack}>
                          <div
                            className={styles.coverTrendBar}
                            data-latest={index === coverRevenue.length - 1}
                            style={{ height: `${(bar.value / coverRevenueMax) * 100}%` }}
                          >
                            <span className="figure">
                              {formatPrice(bar.value / revenueScale, locale, { digits: 2 })}
                            </span>
                          </div>
                        </div>
                        <span className={styles.coverTrendPeriod}>{bar.label}</span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </figure>
            )}
          </div>
        )}

        {/* ---- Ölçü katmanı ----
            İKİ KATMAN, tek ızgara değil.

            Altı ölçü bir süre eşit ağırlıklı 2×3 ızgaradaydı ve sonuç bir
            tabloydu: altı büyük harfli etiket, altı sayı, aralarında dikey
            hairline'lar. Hiçbiri ötekinden önemli görünmüyordu, oysa bu sayfa
            BİR ÇEYREĞİ anlatıyor ve o çeyreğin cevabı tek bir sayıda —
            bilanço günü kapanışı ile hissenin o gün verdiği tepki.

            Şimdi manşet o ölçü, tek başına ve büyük. Kalanlar altında sakin
            bir künye rayında: şirket ne büyüklükte, yıl nasıl geçti, fiyat
            neye göre kurulu. Ray çukur zeminde duruyor ve DİKEY ÇİZGİ
            TAŞIMIYOR — çizgiler ızgara satır atladığında ikinci satırın ilk
            hücresinin soluna boşlukta duran bir hairline bırakıyordu; zemin
            ve boşluk aynı ayrımı çizgisiz yapıyor.

            Ray hücre sayısına göre sütunlanıyor: yazılmamış oran hiç
            basılmadığı için sayı 3 ile 6 arasında değişiyor ve sabit bir
            sütun sayısı satır sonunda boşluk bırakırdı. */}
        {row.price !== null && (
          <div className={cn(styles.coverFacts, "flex flex-col gap-4 border-t border-line pt-4")}>
            {/* ---- Fiyat merdiveni ----
                Sayfa üç fiyatı üç ayrı yerde, dayanakları adsız basıyordu:
                sağ üstte bugün, sol altta bilanço günü kapanışı, görüş
                şeridinde hedef. Okuyucu "potansiyel" yüzdesinin hangi
                mesafeyi ölçtüğünü çıkaramıyordu (BE hedefinin ÜSTÜNDEYKEN
                "▲ %64" diyordu). Merdiven üçünü TEK ölçekte gösteriyor:
                bilanço günü (içi boş nokta), bugün (dolu nokta, oradan
                kayarak gelir), hedef (çentik) ve bugünle hedef arası yön
                renginde bir bant. Çizim `aria-hidden`: üç sayının üçü de
                kapakta metin olarak duruyor, etiketler onların birebir
                aynı dizesi. Kotasyon yoksa "Bugün" hiç çizilmiyor. */}
            <div className={styles.reportClose}>
              {/* Tarih etiketin YANINDA, hücrenin öbür ucunda değil.
                  `justify-between` onu geniş hücrede 250px öteye savuruyordu
                  ve hangi etikete ait olduğu okunmuyordu. */}
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={cn(PLATE_LABEL, "text-body")}>
                  {t.analysis.closePrice}
                </span>
                <span className="shrink-0 text-nano font-medium text-muted">
                  {formatEtDateCompact(row.reportDate, locale)}
                </span>
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="figure text-subdisplay font-bold leading-none tracking-[-0.04em] text-strong sm:text-display">
                  {closeText}
                </span>
                {row.reactionPct !== null && (
                  /* Tepki bir süre 11px'lik bir rozetti ve yanındaki büyük
                     fiyatın gölgesinde kalıyordu — oysa "bilanço hisseyi ne
                     yaptı" sorusunun cevabı o. */
                  <span
                    className={cn(
                      "figure inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1 text-read font-bold leading-none",
                      row.reactionPct >= 0
                        ? "bg-up-wash text-up"
                        : "bg-down-wash text-down",
                    )}
                  >
                    {row.reactionPct >= 0 ? "▲" : "▼"}
                    {SIGN_GAP}
                    {formatPercentPlain(row.reactionPct, locale, 1)}
                  </span>
                )}
                {row.reactionPct !== null && (
                  <span className="text-tiny text-muted">
                    {t.analysis.reactionNote}
                  </span>
                )}
              </p>
              {ladderMarks.length >= 2 && (
                <PriceRail marks={ladderMarks} className={styles.priceLadder} />
              )}
            </div>

            <FactRail
              facts={[
                marketCap !== null && {
                  label: t.market.marketCap,
                  note: marketCapNote,
                  value: `≈${SIGN_GAP}${formatMoneyCompact(marketCap, locale)}`,
                },
                /* Getiri kayıttan geliyor ve bilanço gününe kadar ölçülmüş;
                   piyasa değerinin aksine bugüne taşınamıyor, çünkü bir yıl
                   önceki fiyat elimizde yok. Künyesi bunu söylüyor. */
                row.return1yPct !== null && {
                  label: t.analysis.return1y,
                  note: t.analysis.asOfReport,
                  value: formatPercent(row.return1yPct, locale, 0),
                  tone: row.return1yPct >= 0 ? ("up" as const) : ("down" as const),
                },
                /* HER ORANIN KÜNYESİ KENDİ BÖLENİ. Hisse başı kâr bir süre
                   kendi hücresindeydi ve ray tutarsız duruyordu: F/K'nin
                   böleni tam bir ölçü kadar yer kaplarken PEG'inki künyeye
                   sığıyordu. Bölen künyeye inince okuyucu üstteki
                   fiyatı ona bölüp oranı yerinde doğrulayabiliyor — sayının
                   nasıl kurulduğunu göstermek, kesinliğini iddia etmekten
                   daha dürüst.
                   PAY DA YAZILI (24 Eylül): oran kapaktaki GÜNCEL fiyatla
                   kuruluyor, bilanço günü kapanışıyla değil; künye yalnızca
                   böleni söylüyordu ve aynı kapakta bilanço gününe göre
                   kurulmuş bir potansiyel yüzdesi dururken hangi fiyatın
                   bölündüğü tahmine kalıyordu. */
                peRatio !== null && {
                  label: t.analysis.peRatio,
                  note: `${t.analysis.peAtToday} · ${formatPrice(epsTtm, locale, { currency: true })} · ${t.analysis.trailing12m}`,
                  value: formatPrice(peRatio, locale, { digits: 1 }),
                },
                /* PEG'in künyesi hangi büyümenin bölündüğünü söylüyor;
                   `growth_basis` olmadan kayıt zaten reddediliyor. Kayıttan
                   geldiği için yanındaki künyelerle aynı imlaya çekiliyor
                   ("ileriye dönük 3 yıl" → "İleriye Dönük 3 Yıl"). */
                pegRatio !== null && {
                  label: t.analysis.pegRatio,
                  note: row.growthBasis ? titleCaseLabel(row.growthBasis, locale) : null,
                  value: formatPrice(pegRatio, locale, { digits: 2 }),
                },
                /* İŞARET KORUNUYOR (24 Eylül). Değer `formatPercentPlain`
                   ile basılıyordu ve o işlev MUTLAK değer alıyor — yanında
                   ▲/▼ oku duran sayılar için yazılmış. Burada ok yok: zarar
                   eden ASTS "%536,7", ONDS "%96,3" diye KÂRLI görünüyordu.
                   Marj bir düzey, değişim değil; artıda işaret yok, eksi
                   hem işaretle hem yön rengiyle yazılıyor. */
                netMarginPct !== null && {
                  label: t.analysis.netMargin,
                  note: t.analysis.trailing12m,
                  value:
                    netMarginPct < 0
                      ? formatPercent(netMarginPct, locale, 1)
                      : formatPercentPlain(netMarginPct, locale, 1),
                  tone: netMarginPct < 0 ? ("down" as const) : undefined,
                },
              ]}
            />
          </div>
        )}
      </header>

      {/* YAPIŞINCA KİMLİK. Kapaktan sonra gövde 1440'ta 3917, telefonda
          8119 piksel sürüyor; "Detaylı Değerlendirme"yi okuyan hangi
          çeyrekte, hangi görüşte, hangi fiyatta olduğunu artık görmüyordu.
          Çubuk yapışınca solunda sembol · dönem, görüş ve skor, geniş
          ekranda fiyat açılıyor — fiyat kapaktakiyle AYNI kotasyon
          nesnesinden, aynı dizeyle. Telefonda yalnızca sembol ve görüş:
          sekmelere 112 piksel bırakılıyor (PremiumMotion.module.css). */}
      <SectionNav
        className={styles.reportNav}
        label={t.analysis.reportNavigation}
        lead={
          <>
            <span className="max-md:hidden">
              <LogoTile symbol={symbol} logoUrl={symbolMeta?.logoUrl} size="xs" />
            </span>
            <span className="min-w-0 truncate text-small font-bold text-strong">
              {symbol}
              <span className="max-md:hidden"> · {shortPeriod}</span>
            </span>
            <span
              className={cn(
                "figure shrink-0 rounded-md bg-surface-elevated px-1.5 py-0.5 text-tiny font-bold",
                verdictTextClass(verdict),
              )}
            >
              {verdictLabel(verdict, t)} {row.score}
            </span>
            {liveText && (
              <span className="figure shrink-0 text-small font-bold text-strong max-lg:hidden">
                {liveText}
              </span>
            )}
          </>
        }
        items={[
          { id: "report-overview", label: t.analysis.reportOverview },
          { id: "report-figures", label: t.analysis.chapterFigures },
          { id: "report-reading", label: t.analysis.chapterReading },
          { id: "report-outlook", label: t.analysis.reportOutlook },
          ...(sources.length > 0 ? [{ id: "report-sources", label: t.analysis.sourcesLabel }] : []),
        ]}
      />

      {/* ---- Tek kolon ----
          Sağda karne + yaklaşan bilançolar + rehber taşıyan yapışkan bir
          kolon vardı ve içeriğin genişliğini 340px kısıyordu. Grafikler
          asıl anlatan parça; onlara yer açmak için kolon kaldırıldı, oradaki
          üç kart sayfanın altına indi. Metin panellerinde satır uzunluğu
          `max-w` ile sınırlı — 1300px'lik bir paragraf okunmuyor. */}
      <div className={styles.reportBody}>
          {/* ---- Görsel katman ----
              Sayfa uzun metinle açılıyordu ve çeyreğin rakamları dokuz
              paragrafın gölgesinde kalıyordu. Sıra artık karnedekiyle aynı:
              önce ölçüler, sonra grafikler, sonra CEO, en sonda metin.
              Rakamı gören okuyucu metne inmek zorunda değil; inmek isteyen
              için metin zaten altında duruyor. */}
          <section id="report-figures" className={styles.figuresSection}>
            <Reveal>
              {/* BÖLÜM BAŞLIĞI PAYLAŞILAN KALIPTA (23 Eylül): üstünde dönem
                  künyesi ("3Ç FY2026"), sağında hiçbir yere götürmeyen 30
                  piksellik bir ok vardı. Dönem kapakta ve yapışkan çubukta
                  zaten yazılı; ok bir süstü. Başlık, sekme etiketiyle aynı
                  anahtar (gerekçe components/ui/ChapterHeading). */}
              <ChapterHeading title={t.analysis.chapterFigures} className={styles.reportChapter} />
              <MetricCards metrics={detailMetrics} locale={locale} />
            </Reveal>

          {(hasColumns || hasGuidance) && (
            /* YAN YANA KARTLAR AYNI HİZADA BİTER. Izgaranın varsayılanı olan
               gerilme burada bir süre `items-start` ile kapatılmıştı ve
               gerekçesi geçerliydi: gelir sütunlarının yüksekliği SABİTTİ,
               dolayısıyla gerilen alan grafiğe değil, dönem etiketleriyle alt
               künye arasına ölü boşluk olarak dağılıyordu.

               Doğru düzeltme gerilmeyi kapatmak değil, grafiği esnetmekti.
               `RevenueColumns` artık taban yükseklikli ve `flex-1`; fazla
               alanın tamamı çizime gidiyor, sütunlar uzuyor, delik kalmıyor.
               Öngörü kartı da satırlarını kartın boyuna yayıyor. */
            <Reveal>
            <div
              className={cn(
                "grid gap-4",
                hasColumns && hasGuidance
                  ? "lg:grid-cols-[repeat(2,minmax(0,1fr))]"
                  : "grid-cols-1",
              )}
            >
              {hasColumns && (
                <RevenueColumns
                  bars={row.quarterlyRevenue ?? []}
                  title={`${t.analysis.quarterlyRevenue} (${revenueUnit})`}
                  legendActual={t.analysis.legendActual}
                  legendProjected={t.analysis.legendProjected}
                  format={(value) =>
                    formatPrice(value / revenueScale, locale, {
                      digits: value / revenueScale >= 100 ? 0 : 2,
                    })
                  }
                  formatMoney={(value) => formatMoneyCompact(value, locale)}
                  labels={{
                    qoq: t.analysis.quarterOnQuarter,
                    yoy: t.analysis.yearOnYear,
                    missing: t.analysis.missingQuarter,
                  }}
                  footer={revenueFooter}
                  locale={locale}
                />
              )}
              {hasGuidance && (
                <GuidanceRanges
                  rows={row.guidance ?? []}
                  /* Öngörülen dönem artık AÇIKLANDIYSA başlık bunu söylüyor:
                     "2Ç FY27 Şirket Öngörüsü" 2Ç açıklanmışken geçmişi
                     gelecek gibi sunuyordu (gerekçe `nextPeriodReported`). */
                  title={
                    row.nextPeriodLabel
                      ? (nextPeriodReported
                          ? t.analysis.guidanceTitleReported
                          : t.analysis.guidanceTitle
                        ).replace("{period}", row.nextPeriodLabel)
                      : t.analysis.guidanceTitleFallback
                  }
                  legendRange={t.analysis.legendRange}
                  legendConsensus={t.analysis.legendConsensus}
                  axisNote={t.analysis.guidanceAxis}
                  howToRead={t.analysis.howToRead}
                  /* Eksen ucu bir ORAN, fiyat değil: tek ondalık yeter ve
                     işaret yazılmıyor (künye zaten "±" diyor). */
                  formatPercent={(value) =>
                    formatPercentPlain(value, locale, value < 10 ? 1 : 0)
                  }
                  verdictLabels={{
                    above: t.analysis.guidanceAbove,
                    below: t.analysis.guidanceBelow,
                    inline: t.analysis.guidanceInline,
                  }}
                  formatRange={(low, high, unit) =>
                    formatGuidanceRange(low, high, unit ?? undefined, locale)
                  }
                  formatEnds={(low, high, unit) =>
                    guidanceEnds(low, high, unit ?? undefined, locale)
                  }
                  footer={guidanceFooter}
                  locale={locale}
                />
              )}
            </div>
            </Reveal>
          )}
          </section>

          {row.ceoQuote && (
            /* CEO şeridi: solda kim, ortada ne dediği, sağda çağrıda
               vurguladığı başlıklar. Bir ara baş harflerden bir avatar
               halkası denendi ve kaldırıldı — kimsenin tanımadığı iki harf
               bir portre yerine geçmiyor, yalnızca yer kaplıyordu.

               Sağ üstteki dev tırnak kalktı (24 Eylül) — gerekçe modülde
               (`.ceoQuote`); yerini sol çizgi aldı. */
            <Reveal>
            <section className={cn(styles.ceoQuote, "relative p-4 sm:p-5")}>
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                <div className="flex shrink-0 flex-col gap-px lg:w-44">
                  <span className={cn(PLATE_LABEL, "text-primary")}>
                    {t.analysis.ceoMessage}
                  </span>
                  <span className="text-read font-bold tracking-[-0.02em] text-strong">
                    {row.ceoQuote.name}
                  </span>
                  <span className="text-tiny text-muted">
                    {row.ceoQuote.title}
                  </span>
                </div>

                <span
                  aria-hidden
                  className="hidden w-px self-stretch bg-line lg:block"
                />

                <blockquote className="min-w-0 flex-1 border-t border-line pt-3.5 text-base italic leading-[22px] text-body [text-wrap:pretty] lg:border-t-0 lg:pt-0">
                  “{row.ceoQuote.quote}”
                </blockquote>

                {row.ceoQuote.topics && row.ceoQuote.topics.length > 0 && (
                  /* Rozetler karnedeki gibi: dar ekranda yan yana saran
                     hap, genis ekranda alt alta TAM GENISLIK seritler.
                     Yuvarlak haplar sag kolonda farkli genislikte kirpinti
                     gibi duruyordu; ayni genislikteki seritler bir liste
                     olarak okunuyor. */
                  <ul className="flex shrink-0 flex-wrap gap-1.5 lg:w-64 lg:flex-col lg:flex-nowrap lg:gap-2">
                    {/* Rozet metni kayıttan geliyor ve yazıldığı gibi
                        basılıyordu ("Aylık fırlatma temposu"); rozet bir
                        etiket, Title Case kapsamında. */}
                    {row.ceoQuote.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-md border border-primary-faint bg-primary-wash px-3 py-2 text-tiny font-semibold leading-[15px] text-primary-ink lg:text-center"
                      >
                        {titleCaseLabel(topic, row.locale)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            </Reveal>
          )}

          {/* ---- Metin katmanı ----
              İkisi de sayfanın tam genişliğinde bir panelken metin `max-w`
              ile ~92 karaktere kısılıyordu: sol tarafta bir metin bloğu,
              sağ tarafta 400 piksellik boşluk. Sütunlaştırma iki sorunu
              birden çözüyor — genişlik gerçekten kullanılıyor ve satır boyu
              her kırılma noktasında okunur bandın içinde kalıyor (1300px'te
              üç sütun ≈ 58 karakter, tek sütunda 100'ün üstündeydi).

              Bloklar `break-inside-avoid`: bir paragrafın ortasından
              bölünüp iki sütuna yayılması, sayfayı gazete değil bozuk bir
              düzen gibi gösteriyordu. */}
          {/* Çapa kimliği dönüşümsüz dış kapta — gerekçe `ScrollStage`
              başında (sekmeden atlanınca bölüm çubuğun arkasına iniyordu). */}
          <ScrollStage id="report-reading"><section className={styles.readingSection}>
          <ChapterHeading title={t.analysis.chapterReading} />
          <Reveal>
          <Panel className={cn(styles.summaryPanel, "p-5 sm:p-6")}>
            {/* Okuma süresi künyesi kaldırıldı: metin zaten ekranda ve ne
                kadar sürdüğü, okunup okunmayacağına dair bir karar
                değiştirmiyordu — panelin sağ ucunda taşıdığı tek şey
                gürültüydü. */}
            <PanelHead icon={Article} title={t.analysis.summary} />
            {/* İlk paragraf GİRİŞ ölçüsünde: üç sütun eşit puntoda dizilince
                metin duvara dönüyor ve göz nereden başlayacağını yüzeyden
                okuyamıyordu. Bir kademe iri ve koyu bir giriş, sütunun
                başlangıcını işaretliyor — kalan paragraflar gövde ölçüsünde
                kalıyor, yani hiyerarşi bir kademe, iki değil. */}
            {/* GÖVDE KENDİ DİLİNİ SÖYLÜYOR — mercek sayfasındaki kuralın
                aynısı. Çevirisi olmayan analiz orijinal dilinde gösteriliyor
                (üstteki rozet bunu yazıyor) ama `lang` verilmediği için
                Türkçe paragraflar `<html lang="en">` altında kalıyordu:
                ekran okuyucu yanlış fonetikle okuyor, tarayıcının "çevir"
                önerisi devreye girmiyordu. Mercek düzeltilmiş, burası
                atlanmıştı. */}
            {/* GİRİŞ SOLDA, DESTEK SAĞDA (24 Eylül). Giriş 32em'de, kartın
                sol yarısında duruyordu ve sağında boşluk vardı; kalan
                paragraflar altında 15 puntoluk iki dar sütundaydı — kart
                "zayıf" okunuyordu (sahibinin geri bildirimi). Geniş ekranda
                artık iki sütunlu bir ızgara: solda iri giriş (kartın
                ~%55'i, satır ~60 harf), sağda kıl çizgiyle ayrılmış
                destekleyici paragraflar alt alta ve okunur puntoda. Kartın
                bütün genişliği kullanılıyor, satır boyu iki sütunda da
                okunur bantta. Dar ekranda alt alta. */}
            <div className={styles.summaryProse} lang={row.locale}>
              {row.summary.length > 0 && (
                <p className={cn(styles.summaryLead, "[text-wrap:pretty]")}>
                  <RichText text={row.summary[0]} />
                </p>
              )}
              {row.summary.length > 1 && (
                <div className={styles.summaryRest}>
                  {row.summary.slice(1).map((paragraph, index) => (
                    <p key={index} className="[text-wrap:pretty]">
                      <RichText text={paragraph} />
                    </p>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          </Reveal>

          {row.analysis.length > 0 && (
            <Reveal>
            <Panel className={cn(styles.analysisPanel, "p-5 sm:p-6")}>
              {/* Sağ uçtaki "CLAUDE" künyesi fiilsiz bir addı ve başlıkla
                  yarışıyordu; ne yaptığını söyleyen hâli ("Claude ile
                  Hazırlandı") alt bilgideki uyarının yanında. */}
              <PanelHead icon={Scales} title={t.analysis.detailed} />
              {/* ---- Bölümler: ızgara, sütun AKIŞI değil ----
                  Bir süre çok sütunlu (multicol) dizildi ve okuma sırası
                  sütun sütun aşağı iniyordu: soldaki bölüm 1'i okuyup
                  ortadaki 2 ile 3'e, sonra sağdaki 4'e geçmek gerekiyordu.
                  Göz satır satır soldan sağa okumaya çalışınca bölümler
                  birbirinin üstüne biniyor gibi duruyordu — sıra numaraları
                  bile kurtarmıyordu.

                  Izgarada sıra beklenen yönde: soldan sağa, sonra alt satır.
                  Sütun sayısı genişlikle artıyor, böylece satır boyu her
                  kırılmada okunur bantta kalıyor (1300px'te üç sütun ≈ 52
                  karakter). Her hücrenin üstündeki hairline bölümleri
                  birbirinden ayırıyor ve aynı satırdakiler hizalı başlıyor. */}
              {/* ---- Sütun sayısı BÖLÜM SAYISINA göre ----
                  Sabit üç sütunda dört bölüm, son satıra tek başına düşen
                  bir bölüm ve yanında iki sütunluk bomboş bir alan
                  bırakıyordu: panelin altı yarım kalmış gibi duruyordu.
                  Kural artık TEK yerde, modülde (`.analysisGrid`): burada
                  duran üçlü, modülün sonundaki katmansız bir kuralca
                  eziliyordu ve beş bölümlü analizlerde beşinci bölüm yine
                  tek başına kalıyordu. */}
              <div className={styles.analysisGrid} lang={row.locale}>
                {/* Sıra numarası başlığın YANINDA değil ÜSTÜNDE: karo,
                    başlığın ilk satırını içeri itiyor ve iki satıra taşan
                    başlıklarda ikinci satır karonun altından başlayınca
                    blok sola doğru tırtıklı görünüyordu. Numara kendi
                    satırına çıkınca başlık tam genişlikte, sol kenar
                    hizalı — rehberdeki müfredat şeridiyle aynı dil. */}
                {row.analysis.map((section, index) => (
                  <section key={index} data-motion-reveal className={cn(styles.analysisItem, "border-t border-line")}>
                    <span
                      aria-hidden
                      className="numeral mb-1.5 block text-tiny font-bold tracking-[0.04em] text-primary"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mb-2 text-base font-bold leading-[20px] tracking-[-0.015em] text-strong [text-wrap:balance]">
                      {section.title}
                    </h3>
                    <p className="text-base leading-[22px] text-body [text-wrap:pretty]">
                      <RichText text={section.body} />
                    </p>
                  </section>
                ))}
              </div>
            </Panel>
            </Reveal>
          )}
          </section></ScrollStage>

          {/* Maddeler de analizin dilinde; başlıklar arayüz dilinde ama
              kart içindeki metin kayıttan geliyor. */}
          <section id="report-outlook" className="flex min-w-0 flex-col gap-5">
          <ChapterHeading title={t.analysis.reportOutlook} />
          {/* Üç kart yan yana yalnızca 1101 ve üstünde (kapak ızgarasının
              eşiği); altında tek sütun ve liste iki sütun (gerekçe modülde,
              `.pointsCard ol`). 1024'te yan yana üç kart zaman çizgisinin
              altında 107 piksel boşluk bırakıyordu. */}
          <div
            className={cn(styles.pointsGrid, "grid gap-3 min-[1101px]:grid-cols-[repeat(3,minmax(0,1fr))]")}
            lang={row.locale}
          >
            <PointsCard
              title={t.analysis.strengths}
              points={row.strengths ?? []}
              tone="up"
            />
            <PointsCard
              title={t.analysis.risks}
              points={row.risks ?? []}
              tone="down"
            />
            <PointsCard
              title={t.analysis.upcomingDev}
              points={row.upcoming ?? []}
              tone="primary"
              /* Kartın dibinde sonraki bilanço — kapaktaki çiple aynı
                 hesap (`nextReportText`): takvim tarihi, yoksa henüz
                 geçmemiş kayıt tahmini; geçmiş bir tarih hiçbir zaman. */
              footer={
                nextReportText ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-small">
                    <span className="font-bold text-strong" lang={locale}>
                      {t.analysis.nextEarnings}
                    </span>
                    <span className="numeral font-semibold text-primary-ink">
                      {!nextPeriodReported && row.nextPeriodLabel ? `${row.nextPeriodLabel} · ` : ""}
                      {nextReportText}
                    </span>
                    {nextReport && (
                      <AddToCalendar
                        symbol={symbol}
                        date={nextReport.date}
                        label={t.earnings.addToCalendar}
                        compact
                        className="-my-2 ml-auto"
                      />
                    )}
                  </p>
                ) : null
              }
            />
          </div>
          </section>
      </div>

      {/* ---- Kapanış şeridi ----
          Rakip takvimi ve rehber bağlantıları yapışkan yan kolondaydı; o
          kolon içeriğin genişliğini kısıyordu. İkisi de "okudun, şimdi ne
          var" sorusuna ait — metnin sonunda yan yana duruyorlar.

          Izgara SABİT değil, BASILAN kart sayısına göre kuruluyor: rakip
          takvimi yalnızca aynı sektörden yaklaşan bilanço varsa çıkıyor ve
          sabit ızgarada boş kalan göz sayfayı "bir şey yüklenemedi" gibi
          bitiriyordu. */}
      <div
        className={cn(
          /* Yan yana kartlar aynı hizada biter — `items-start` yok. İkisi de
             liste kartı, içlerinde sabit yükseklikli bir çizim olmadığı için
             gerilme boşluğu doğrudan kartın altına gidiyor. */
          "grid gap-4",
          /* EŞİT İKİ YARI (24 Eylül). 360 piksellik referans sütunu ile
             kalan genişlik düzeninde rehber kartları yan yana SATIR
             düzeninde basılıyordu ve kartın içeriği 111 piksel yukarıda
             bitiyordu (1440; 1024'te 82). Rakip listesi varken rehber
             kartları ALT ALTA (`stack`) — ikisi aynı boyda biter.
             `bottomCards === 3` koşulu hiç doğru olamıyordu (sayı 1 ya
             da 2), yani yığma dalı hiç çalışmamıştı. */
          bottomCards === 2 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        {peers.length > 0 && (
          <Panel className="px-4 py-4 sm:px-5">
            <h2 className="mb-3 flex items-center gap-2.5 text-title font-bold text-strong">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary-ink"
              >
                <CalendarBlank weight="duotone" size={15} />
              </span>
              {t.analysis.upcomingEarnings}
            </h2>
            <div className="flex flex-col">
              {peers.map((peer) => (
                /* Satır bir <a> DEĞİL, yüzeyi kaplayan bir <a> TAŞIYAN kutu:
                   takvim düğmesi kendi bağlantısını taşıyor ve iç içe
                   bağlantı geçersiz HTML. Görünüm birebir aynı kalıyor. */
                <div
                  key={peer.id}
                  /* Vurgu, sitedeki diğer listelerle aynı: satırın tamamı
                     panel kenarına kadar boyanıyor. `opacity-75` satırı
                     soldurup geri çekiyordu — tıklanabilir bir satırın
                     tersi. Negatif margin, dolguyu panelin kenarına
                     taşıyor. */
                  className="relative -mx-4 flex items-center gap-2.5 border-b border-line-soft px-4 py-2.5 transition-colors last:border-b-0 hover:bg-primary-tint sm:-mx-5 sm:px-5"
                >
                  <Link
                    href={`/hisse/${peer.symbol}`}
                    prefetch={false}
                    aria-label={peer.symbol}
                    className="absolute inset-0"
                  />
                  {/* Logo, satırı bir sembol listesi olmaktan çıkarıp
                      sayfanın geri kalanıyla aynı dile sokuyor (mercek
                      künyeleri ve analiz tablosu da logodan besleniyor). */}
                  <LogoTile symbol={peer.symbol} logoUrl={peer.logoUrl} size="xs" />
                  <span className="shrink-0 text-small font-bold text-strong">
                    {peer.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-body">
                    {peer.name ?? ""}
                  </span>
                  <span className="numeral shrink-0 text-tiny text-muted">
                    {formatEtDateCompact(peer.reportDate, locale)}
                  </span>
                  <AddToCalendar
                    symbol={peer.symbol}
                    date={peer.reportDate}
                    label={t.earnings.addToCalendar}
                    compact
                    className="-mr-1.5"
                  />
                </div>
              ))}
            </div>
          </Panel>
        )}

        <GuideHint
          label={t.guide.contextLabel}
          locale={locale}
          slugs={["bilanco", "degerleme"]}
          layout={peers.length > 0 ? "stack" : "row"}
        />
      </div>

      {/* ---- Alt bilgi ---- */}
      <footer id="report-sources" className={cn(styles.reportFooter, "flex flex-col gap-2 border-t border-line pt-3.5")}>
        <p className="text-tiny text-muted">
          {t.analysis.preparedWith} · {t.analysis.disclaimer}
        </p>
        {sources.length > 0 && (
          /* KAYNAK KÜNYESİ MERCEK'TEKİYLE AYNI KALIPTA. Burası bir dönem tek
             bir cümleydi: etiket satır başında, bağlantılar " · " ile
             ayrılmış satır içi `<span>`lerde. İki sorun birden çıkarıyordu.

             Bağlantılar 14 piksellik metin kutularıydı. Negatif kenar
             boşluğuyla 32'ye çıkarılmışlardı ama 44'e çıkarılamıyorlardı:
             ölçüldü, satır içi oldukları ve satırlara sardıkları için
             genişletme her seferinde bir alttaki satırın bağlantısını
             kapıyordu — beşinin beşi de.

             Aynı iş mercek yazılarında zaten LİSTE olarak kuruluydu ve orada
             ayraç da gerekmiyordu; aralık zaten ayırıyor. Aynı künye iki
             ekranda iki farklı biçimde yazılıyordu. Liste kalıbına geçince
             üçü birden çözüldü: ayraç öğeleri gitti, negatif kenar boşluğu
             gitti, hedef telefonda gerçekten 44 oldu. */
          <>
            {/* "Kaynaklar" sekmesi buraya iniyor; başlıksız bir alt
                bilgiye iniyordu. Etiket düzeyinde bir h2 — sayfanın üç
                başlık düzeyinin en küçüğü. */}
            <h2 className="plate text-muted">
              {t.analysis.sourcesLabel}
            </h2>
            <ul className="flex flex-wrap gap-x-4 text-tiny text-muted">
              {sources.map((source, index) => {
                /* ADRES SÜZGEÇTEN GEÇER. Kaynak listesi `/api/analiz` POST
                   gövdesinden geliyor ve oradaki `z.string().url()` yetmiyor:
                   doğrulama `new URL()` tabanlı olduğu için
                   `javascript:alert(1)` de geçerli bir adres sayılıyor.
                   React'in JSX kaçışı `href` özniteliğini kapsamaz, yani
                   tıklanan bağlantı çalışan bir betiğe dönüşürdü. Aynı süzgeç
                   mercek sayfasında zaten vardı; burası o düzeltmenin dışında
                   kalmıştı. */
                const href = safeExternalUrl(source.url);
                return (
                  <li key={`${source.label}-${index}`}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex min-h-11 items-center text-primary hover:underline sm:min-h-8"
                      >
                        {source.label}
                        <ArrowUpRight aria-hidden size={14} />
                      </a>
                    ) : (
                      <span className="inline-flex min-h-11 items-center sm:min-h-8">
                        {source.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </footer>
    </MotionExperience>
  );
}

/**
 * Öngörü aralığının tam metni: "10,3 – 10,8 Mr $" · "%83 – %85".
 *
 * İki ayrıntı burada karara bağlanıyor:
 *
 * ONDALIK HANE ölçeğe göre. Aynı kartta gelir (10,3 milyar), hisse başı kâr
 * (44 $) ve marj (%83) yan yana duruyor; hepsine iki hane vermek "10,30 Mr $"
 * gibi sahte bir hassasiyet üretiyor, hepsine sıfır vermek 44 ile 46
 * arasındaki farkı siliyordu.
 *
 * YÜZDE İŞARETİ dile göre yer değiştirir ve aralığın İKİ ucuna da yazılır:
 * Türkçede "%83 – %85", İngilizcede "83% – 85%". Birim ise aralığın yalnızca
 * SONUNDA durur — "10,3 Mr $ – 10,8 Mr $" aynı bilgiyi iki kez söylüyordu.
 */
function formatGuidanceRange(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): string {
  const { a, b, withUnit } = guidanceParts(low, high, unit, locale);
  /* Şirket bant değil tek sayı verdiyse (ya da üç haneye rağmen ikisi aynı
     kalıyorsa) "2,16 – 2,16" yerine tek değer yazılır. */
  if (a === b) return withUnit(a);
  if (unit === "%") return `${withUnit(a)} – ${withUnit(b)}`;
  return `${a} – ${withUnit(b)}`;
}

/**
 * Şeridin iki ucundaki etiketler: başlıktaki aralıkla AYNI hane sayısı,
 * her uçta kendi birimi ("6,80 Mr $" · "6,85 Mr $"). Gerekçe
 * GuidanceRanges → `formatEnds`.
 */
function guidanceEnds(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): [string, string] {
  const { a, b, withUnit } = guidanceParts(low, high, unit, locale);
  return [withUnit(a), withUnit(b)];
}

/** Aralığın iki ucu ortak hane sayısıyla ve birim ekleyici — kural aşağıda. */
function guidanceParts(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): { a: string; b: string; withUnit: (value: string) => string } {
  /* HANE SAYISI ŞİRKETİN VERDİĞİ SAYIDAN ÇIKIYOR — ölçekten değil.
     
     Burada ölçek tabanlı bir kural vardı (100'den büyükse 0, 10'dan
     büyükse 1, değilse 2 hane) ve iki yönde birden bozuyordu. Otuz
     analizin on altı kaleminde ekrandaki bant şirketin açıkladığından
     FARKLI çıkıyordu:

       AMGN  yönetim 15,80–17,08 dedi, ekranda "15,8 – 17,1"
       HWM   yönetim 2,565–2,585 dedi, ekranda "2,56 – 2,58"
       APP   yönetim 2,055–2,085 dedi, ekranda "2,06 – 2,08"
       PLTR  yönetim 1,292–1,296 dedi, ekranda "1,29 – 1,30"

     Yani hem bant daralıyor/kayıyor hem de yanında ayrıca hesaplanan
     "orta nokta" ekrandaki iki ucun ortası olmaktan çıkıyordu: okuyucu
     aritmetiği tutturamıyordu.

     Ters yönde de uyduruyordu: bir uç ondalıklıysa İKİSİNE de iki hane
     veriyordu — "%7,00 – %8,50", oysa yönetim "%7–8,5" dedi.

     Yeni kural: her ucu TAM gösteren en az hane sayısı, ikisinin büyüğü.
     Ortak hane sayısı bilinçli — bir aralığın iki ucunu farklı
     hassasiyetle yazmak ("2,16 – 2,164") sayıyı hatalı gösteriyor.
     Üçte duruluyor; ötesi şirketin verdiği bir şey değil. */
  const gerekliHane = (value: number) => {
    for (let d = 0; d <= 3; d += 1) {
      if (Math.abs(Number(value.toFixed(d)) - value) < 1e-9) return d;
    }
    return 3;
  };
  const d = Math.max(gerekliHane(low), gerekliHane(high));

  const a = formatPrice(low, locale, { digits: d });
  const b = formatPrice(high, locale, { digits: d });

  /* Yüzde işaretinin yeri dile bağlı ve HER İKİ uca da yazılıyor; ötekilerde
     birim yalnızca sonda bir kez geçiyor ("2,160 – 2,164 Mr $"). */
  function withUnit(value: string): string {
    if (unit === "%") return locale === "tr" ? `%${value}` : `${value}%`;
    return unit ? `${value} ${unit}` : value;
  }

  return { a, b, withUnit };
}


/**
 * Genel Görüş şeridi — skor, karar, iki cümlelik gerekçe ve analist hedefi
 * tek satırda. Sayfanın en üstünde duruyor çünkü okuyucunun ilk sorusu bu;
 * altındaki her şey bu satırın gerekçesi.
 *
 * TELEFONDA KAPAĞIN İKİNCİ BANDI (24 Eylül). Sayfa başındaki not ("mobilde
 * karne en üste çıkar") uygulanmamıştı: 390×844'te halka 789'da, sabit
 * sekme çubuğu 764'te başlıyordu — görüş ilk ekranda hiç görünmüyordu.
 * 640'ın altında şerit kimliğin hemen altında: solda 56 piksellik halka ve
 * karar, sağda hedef; gerekçe dört satıra kırpılıp "Devamını Oku" ile
 * açılıyor. Geniş ekranda sonuçlar yine önde (CSS `order`), orada ilk
 * ekrana ikisi de sığıyor.
 *
 * Potansiyelin hangi fiyattan ölçüldüğü artık rozetin altında yazılı ve
 * fiyat hedefin üstündeyse rozet "Hedefin Üzerinde" diyor — gerekçe sayfa
 * gövdesindeki `upside` hesabında.
 */
function VerdictStrip({
  row,
  verdict,
  upside,
  targetText,
  locale,
  t,
}: {
  row: EarningsAnalysisRow;
  verdict: VerdictKey;
  upside: Upside | null;
  targetText: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className={styles.verdictPanel} aria-labelledby="report-verdict" data-has-target={targetText !== null}>
      <div className={styles.verdictScore}>
      <ScoreRing score={row.score} verdict={verdict} size={80} showDenominator />
      <div className={styles.verdictDecision}>
        {/* Etiket, manşet değil — sayfanın üç başlık düzeyinden en küçüğü
            (`.plate`): bölüm başlığı, panel başlığı, etiket. 11 piksellik
            başlık genel `main h2` degradesini alıyordu (globals.css,
            `data-ink` notu); `.plate` o kuralın dışında. */}
        <h2 id="report-verdict" className="plate text-body">
          {t.analysis.verdictLabel}
        </h2>
        <span
          className={cn(
            styles.verdictWord,
            "text-subdisplay font-bold leading-none tracking-[-0.03em]",
            verdictTextClass(verdict),
          )}
        >
          {verdictLabel(verdict, t)}
        </span>
      </div>
      </div>
      {/* ÖLÇÜ SINIRI. Paragraf hüküm bloğunun ortasında ve `flex-1` ile
          kalan yerin tamamını alıyordu: ölçüldü, 1440 pikselde satır başına
          127 karakter — okunabilir aralığın (45-75) çok üstünde ve göz satır
          sonunda yerini kaybediyor. Sınır modülde (`.verdictHeadline`);
          76ch bir dönem yetmedi — Schibsted'in "0"ı geniş olduğu için 709
          piksele, 93 karaktere çözülüyordu. */}
      <ClampedHeadline
        text={row.headline}
        lang={row.locale}
        className={styles.verdictHeadline}
        moreLabel={t.analysis.readMore}
        lessLabel={t.analysis.readLess}
      />
      {targetText !== null && (
        /* Analist hedefi bir ara BEYAZ bir kutuya alınmıştı: serbest akışta
           şeridin sağ ucunda yetim duruyordu, kutu ona yüzey veriyordu. Ama
           kutu bu kez tinted şeridin üstünde parlak bir yama gibi okundu —
           şeridin parçası olmak yerine üstüne yapıştırılmış duruyordu.
           Çözüm kutu değil AYRAÇ: hedef bloğu kendi sol çizgisini taşıyor
           ve ölçü kendi yüzeyi olmadan şeridin bir parçası olarak duruyor.

           İKİ KÜNYE, İKİ DAYANAK. Hedef kaydın, yani bilanço günü
           analistlerin ortalaması; potansiyel ise hangi fiyattan ölçüldüyse
           onu yazıyor. İkisi farklı anlara ait ve ikisi de adıyla. */
        <div className={styles.verdictTarget}>
          <span className={cn(PLATE_LABEL, "text-muted")}>
            {row.analystCount
              ? t.analysis.analystTargetCount.replace(
                  "{count}",
                  String(row.analystCount),
                )
              : t.analysis.analystTarget}
          </span>
          <span className={cn(styles.targetValue, "figure font-bold leading-none tracking-[-0.035em] text-strong")}>
            {targetText}
          </span>
          <span className="text-nano font-medium text-muted">{t.analysis.asOfReport}</span>
          {upside !== null && (
            <span className="flex flex-col items-start gap-1">
              <span
                className={cn(
                  "figure inline-flex items-baseline gap-1 rounded-md px-1.5 py-[2px] text-tiny font-bold",
                  upside.pct >= 0
                    ? "bg-up-wash text-up"
                    : "bg-down-wash text-down",
                )}
              >
                {/* Ok burada ayrı bir flex düğümü değil, dizeye bitişik
                    duruyor — aradaki dar boşluk bu yüzden `gap-*` ile değil
                    SIGN_GAP ile veriliyor. */}
                {upside.pct >= 0 ? "▲" : "▼"}
                {SIGN_GAP}
                {formatPercentPlain(upside.pct, locale, 1)}{" "}
                {upside.pct >= 0 ? t.analysis.upsidePotential : t.analysis.aboveTarget}
              </span>
              <span className="text-nano font-medium text-muted">
                {upside.basis === "today"
                  ? t.analysis.upsideFromToday
                  : t.analysis.upsideFromReport}
              </span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}


/**
 * Güçlü Yönler / Riskler / Beklenen Gelişmeler.
 *
 * Üçü de aynı biçimde altı maddelik bir liste ve düz metin olarak yan yana
 * durduklarında hangisinin ne olduğu ancak başlık okununca anlaşılıyordu.
 * Artık her kart başlıkta bir ikon karosu ve madde sayısı taşıyor, madde
 * numaraları da çıplak rakam değil kendi tonundaki küçük kareler — göz
 * karta bakar bakmaz "bu iyi taraf / bu risk" diyor.
 */
function PointsCard({
  title,
  points,
  tone,
  footer,
}: {
  title: string;
  points: string[];
  tone: "up" | "down" | "primary";
  /** Kartın dibine yapışan satır — Beklenen Gelişmeler'de sonraki bilanço. */
  footer?: React.ReactNode;
}) {
  if (points.length === 0) return null;

  const Icon = tone === "up" ? TrendUp : tone === "down" ? Warning : CalendarBlank;
  /* Mavi ton hem başlıkta hem 8 piksellik sıra numaralarında kullanılıyor ve
     ikisi de `--primary-wash` zemininde duruyor: `--primary` orada 4,26'ya
     iniyor (ölçüldü, gereken 4,5). Mürekkep tonu aynı aileden ve 5,4. */
  const accent =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-primary-ink";

  return (
    <Reveal className={styles.pointReveal}>
    {/* Kart zemini modülde (`.pointsCard`) — düz; ton yalnızca başlıkta
        ve ikon karosunda. Burada yazılı `bg-up-wash/40` gibi yardımcılar
        modülce eziliyordu, kaldırıldı. */}
    <section className={cn(styles.pointsCard, "flex min-w-0 flex-col rounded-xl border p-4")}>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            tone === "up" && "bg-up-wash",
            tone === "down" && "bg-down-wash",
            tone === "primary" && "bg-primary-wash",
            accent,
          )}
        >
          <Icon weight="duotone" size={15} />
        </span>
        {/* h3 DEĞİL h2. Güçlü Yönler / Riskler / Beklenen Gelişmeler,
            sayfada "Özet" ve "Detaylı Değerlendirme" ile aynı düzeyde duran
            üç panel; h3 yazılınca başlıklarda gezinen okuyucuya bir üsttekinin
            ALT BÖLÜMÜ gibi görünüyorlardı. Punto artık da aynı düzeyde
            (panel başlığı, modülde).
            DÜZ MÜREKKEP: başlığın rengi yönü söylüyor (`text-up`,
            `text-down`) ve genel `main h2` degradesi dolguyu saydam yapıp
            onu siliyordu (ölçüldü: rgba(0,0,0,0)). */}
        <h2 data-ink="plain" className={cn("text-base font-bold tracking-[-0.01em]", accent)}>
          {title}
        </h2>
        <span className="figure ml-auto text-tiny font-bold text-muted">
          {points.length}
        </span>
      </div>

      {tone === "primary" ? (
        /* ZAMAN ÇİZGİSİ. Maddeler "Aralık 2026: …" diye tarihle başlıyor;
           tarih metinden ayrılıp çizginin üstünde kalın ve mavi yazılıyor.
           Kart iki komşusundan (altışar madde) kısa kalıyordu ve 1440'ta
           103, 1024'te 169, 768'de 219 piksel boşluk bırakıyordu; alttaki
           sonraki bilanço satırı `mt-auto` ile kartın dibine iniyor. */
        <ol className={styles.timeline}>
          {points.map((point, index) => {
            const dated = splitLeadingDate(point);
            return (
              <li key={index} className="text-small leading-[18px] text-body [text-wrap:pretty]">
                {dated && (
                  <span className="mb-0.5 block text-tiny font-bold text-primary-ink">
                    {dated.date}
                  </span>
                )}
                <RichText text={dated ? dated.text : point} />
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {points.map((point, index) => (
            <li
              key={index}
              className="flex gap-2.5 text-small leading-[18px] text-body [text-wrap:pretty]"
            >
              <span
                aria-hidden
                className={cn(
                  "figure mt-px flex size-5 shrink-0 items-center justify-center rounded-xs text-nano font-bold leading-none",
                  tone === "up" && "bg-up-wash",
                  tone === "down" && "bg-down-wash",
                  accent,
                )}
              >
                {index + 1}
              </span>
              <span>
                <RichText text={point} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {footer && <div className={styles.timelineFooter}>{footer}</div>}
    </section>
    </Reveal>
  );
}

/**
 * "Aralık 2026: Yeni ürün…" → { date: "Aralık 2026", text: "Yeni ürün…" }.
 *
 * Yalnızca iki noktadan önceki parça bir TARİH gibi okunuyorsa (yıl ya da
 * ay adı taşıyor, 40 karakteri geçmiyor) ayrılıyor; "Yapay zekâ: …" gibi
 * bir konu başlığı tarih sayılmıyor ve madde düz kalıyor.
 */
function splitLeadingDate(point: string): { date: string; text: string } | null {
  const match = point.match(/^([^:]{2,40}):\s+([\s\S]+)$/);
  if (!match) return null;
  const head = match[1].trim();
  const lower = head.toLocaleLowerCase("tr-TR");
  const looksLikeDate =
    /20\d{2}/.test(head) ||
    /\b(?:Q[1-4]|[1-4]Ç)\s?(?:FY)?\s?\d{2}/i.test(head) ||
    lower.split(/[^a-zçğıöşü]+/).some((word) => MONTH_NAMES.has(word));
  return looksLikeDate ? { date: head, text: match[2] } : null;
}
