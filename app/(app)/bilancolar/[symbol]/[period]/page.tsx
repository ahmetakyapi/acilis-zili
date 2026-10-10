import { PageShare } from "@/components/article/PageShare";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LogoTile } from "@/components/ui/primitives";
import { quarterGaps } from "@/components/earnings/quarter-gaps";
import type { RailMark } from "@/components/ui/PriceRail";
import type { FooterStat } from "@/components/earnings/ChartFooter";
import { articleAutoLinker } from "@/lib/autolink-data";
import { MotionExperience, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import styles from "@/components/earnings/EarningsReport.module.css";
import { CeoStrip } from "@/components/earnings/report/CeoStrip";
import { ReportClosing } from "@/components/earnings/report/ReportClosing";
import { ReportCover } from "@/components/earnings/report/ReportCover";
import { ReportFigures } from "@/components/earnings/report/ReportFigures";
import { ReportFooter } from "@/components/earnings/report/ReportFooter";
import { ReportOutlook } from "@/components/earnings/report/ReportOutlook";
import { ReportReading } from "@/components/earnings/report/ReportReading";
import { ReportSegments } from "@/components/earnings/report/ReportSegments";
import { ReportTakeaways } from "@/components/earnings/report/ReportTakeaways";
import type { Upside } from "@/components/earnings/report/shared";
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
import { estimateIsPast } from "@/lib/earnings-report";
import { getAnalysisExtras } from "@/lib/earnings-extras";
import { getConsensusTarget } from "@/lib/analyst-target-data";
import { addEtDays, etParts, todayEt } from "@/lib/market-hours";
import { getI18n, type Locale } from "@/lib/i18n";
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
} from "@/lib/analysis";
import {
  industryFilterFor,
  sectorGroupLabel,
  sectorGroupOf,
} from "@/lib/sectors";
import {
  cn,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  peRatioOf,
} from "@/lib/utils";

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

/* PANELLER AYRI DOSYALARDA (28 Eylül). Sayfa 2.197 satırdı: kapak, rakamlar,
   okuma, görünüm, kapanış şeridi ve alt bilgi aynı dosyada, üstelik altı
   yardımcı bileşen ve beş saf fonksiyonla birlikte. Her panel artık
   `components/earnings/report/` altında, saf mantık `lib/earnings-report.ts`te.
   Bölme GÖRSEL DEĞİŞİKLİK DEĞİL: DOM ağacı 390 ve 1280'de, TR ve EN, üç
   analizde bölmeden önce ve sonra birebir karşılaştırıldı (sınıf, öznitelik
   ve metin; yalnızca canlı rakamlar maskelendi) — fark sıfır.
   Hesaplar burada kalıyor: aynı değer kapakta, yapışkan çubukta ve alt
   panellerde okunuyor, tek yerde kurulmalı. */

/**
 * Takvimdeki tarihin bu kaydın "sonraki dönem"ine ait sayılabileceği en uzun
 * ara. Çeyrekler ~91 gün arayla açıklanıyor; en geç açıklayanlarda (yıl
 * sonu çeyreği) ara 100-120 güne çıkıyor. Daha uzun bir ara, takvimin
 * gösterdiği tarihin bir SONRAKİ dönemin olduğunu söylüyor.
 */
const NEXT_REPORT_WINDOW_DAYS = 125;

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
      availableLocales: diller,
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
  /* Metindeki sözlük terimleri ve "(AMD)" gibi semboller bağlanıyor; tek
     nesne bütün alanlara geçiyor ki her hedef analiz boyunca bir kez
     bağlansın (gerekçe `lib/autolink.ts`). Dil metnin dili. */
  const linker = await articleAutoLinker(row.locale);

  const session = await auth();
  const today = todayEt();
  const status = await getStatus();

  /* Rakip listesi yalnızca künyeye (sektör) bağlı; kotasyon ve ölçüler
     dış sağlayıcı turları ve onları beklemesi gerekmiyor. Künye aynı
     `cache()`li anahtarla soruluyor, ek sorgu yok (detay TTFB'si 199–727 ms
     ölçüldü, iki ardışık tur bunun içindeydi). */
  const metaP = getSymbolNames([symbol]);
  /* Ekler (özet, segmentler, KPI'lar) ayrı tabloda ve satırın kimliğiyle
     okunuyor; tablo yoksa `null` döner ve sayfa eski hâliyle çizilir
     (gerekçe lib/earnings-extras.ts). Öteki okumalarla aynı turda. */
  const [meta, userSymbols, quotes, keyMetrics, peers, nextReport, siblings, extras, consensus] = await Promise.all([
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
    getAnalysisExtras(row.id),
    getConsensusTarget(symbol),
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
  /* GÜNCEL ORTALAMA (2 Ekim): kapaktaki hedef bilanço gününün ortalaması
     ve potansiyel ona göre (karar yukarıda). Rutinin kaynaklı yazdığı güncel
     ortalama analizden SONRA kaydedildiyse ayrı bir ölçü olarak, tarihiyle —
     künyeyi kayıt da yazsa varsayılan da kursa sona ekleniyor; aynı günse
     tekrar etmiyor. */
  const consensusStat: FooterStat | null =
    consensus && consensus.asOf > row.reportDate
      ? {
          label: `${t.analystTarget.current} · ${formatEtDateCompact(consensus.asOf, locale)}`,
          value: formatPrice(consensus.mean, locale, { currency: true }),
        }
      : null;
  const baseFooter: FooterStat[] = row.guidanceFooter?.length
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
  const guidanceFooter: FooterStat[] = consensusStat ? [...baseFooter, consensusStat] : baseFooter;

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

      {/* ---- Künye ----
          PAYLAŞ KIRINTININ SAĞINDA (30 Eylül) — teknik analiz sayfasının
          kalıbı: kırıntı ve paylaş tek satır, sığmayınca paylaş alta iner. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
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
      <PageShare
        path={analysisHref(symbol, period)}
        title={`${row.company} ${row.periodLabel} · ${t.analysis.ogEyebrow}`}
        locale={row.locale as Locale}
        t={t}
        align="right"
      />
      </div>

      <ReportCover
        row={row}
        symbol={symbol}
        locale={locale}
        t={t}
        signedIn={Boolean(session?.user)}
        watched={watched}
        symbolMeta={symbolMeta}
        newerAnalysis={newerAnalysis}
        nextReport={nextReport}
        nextReportText={nextReportText}
        nextPeriodReported={nextPeriodReported}
        langNote={langNote}
        live={live}
        priceLabel={priceLabel}
        liveText={liveText}
        sinceReportPct={sinceReportPct}
        sinceReportText={sinceReportText}
        coverMetrics={coverMetrics}
        coverRevenue={coverRevenue}
        coverRevenueMax={coverRevenueMax}
        coverGaps={coverGaps}
        revenueScale={revenueScale}
        revenueUnit={revenueUnit}
        verdict={verdict}
        upside={upside}
        targetText={targetText}
        closeText={closeText}
        ladderMarks={ladderMarks}
        marketCap={marketCap}
        marketCapNote={marketCapNote}
        peRatio={peRatio}
        epsTtm={epsTtm}
        pegRatio={pegRatio}
        netMarginPct={netMarginPct}
      />

      <ReportTakeaways takeaways={extras?.takeaways ?? []} lang={row.locale} t={t} linker={linker} />

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
          <ReportFigures
            row={row}
            locale={locale}
            t={t}
            detailMetrics={detailMetrics}
            hasColumns={hasColumns}
            hasGuidance={hasGuidance}
            revenueScale={revenueScale}
            revenueUnit={revenueUnit}
            revenueFooter={revenueFooter}
            guidanceFooter={guidanceFooter}
            nextPeriodReported={nextPeriodReported}
          >
            {extras && (
              <ReportSegments
                extras={extras}
                revenue={row.revenue}
                lang={row.locale}
                locale={locale}
                t={t}
              />
            )}
          </ReportFigures>

          <CeoStrip row={row} t={t} />

          <ReportReading row={row} t={t} linker={linker} />

          <ReportOutlook
            linker={linker}
            row={row}
            symbol={symbol}
            locale={locale}
            t={t}
            nextReport={nextReport}
            nextReportText={nextReportText}
            nextPeriodReported={nextPeriodReported}
          />
      </div>

      <ReportClosing locale={locale} t={t} peers={peers} bottomCards={bottomCards} />

      <ReportFooter t={t} sources={sources} />
    </MotionExperience>
  );
}
