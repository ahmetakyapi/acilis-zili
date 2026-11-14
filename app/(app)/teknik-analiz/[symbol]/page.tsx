import { ClaudeCta } from "@/components/ai/ClaudeCta";
import { ChartBar, TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { ShareButton } from "@/components/article/ShareButton";
import { FavoriteSlot } from "@/components/stock/FavoriteSlot";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, Reveal, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { IndicatorPanels } from "@/components/technical/IndicatorPanels";
import { MoreSymbols, type MoreSymbolEntry } from "@/components/technical/MoreSymbols";
import { StanceHistory } from "@/components/technical/StanceHistory";
import { BalanceNotes } from "@/components/technical/BalanceNotes";
import { PriceMapNotes } from "@/components/technical/PriceMap";
import { LevelList } from "@/components/technical/LevelList";
import { PlanPanel } from "@/components/technical/PlanPanel";
import { ScenarioRail } from "@/components/technical/ScenarioRail";
import { SignalStrip } from "@/components/technical/SignalStrip";
import { TechnicalCover } from "@/components/technical/TechnicalCover";
import { STANCE_GUIDE_SLUG, StanceGuide } from "@/components/technical/StanceGuide";
import styles from "@/components/technical/Technical.module.css";
import grid from "@/components/technical/AnalysisGrid.module.css";
import { DataStamp, EmptyState, Panel } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, } from "@/lib/analysis";
import { getHolidays, getStatus, getSymbolNames } from "@/lib/data";
import { getDictionary, getI18n, type Locale } from "@/lib/i18n";
import { articleOpenGraph, fittedTitle, metaDescription, missingMetadata } from "@/lib/page-meta";
import { technicalHeading, technicalTitles } from "@/lib/seo-titles";
import { ogImageUrl } from "@/lib/og-image";
import { getChartBars, getQuotes } from "@/lib/providers";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import {
  TECHNICAL_SYMBOLS,
  isTechnicalSymbol,
  nextEdition,
  technicalHref,
} from "@/lib/technical";
import { getTechnicalBoard, getTechnicalDetail } from "@/lib/technical-data";
import { isSessionTrade } from "@/lib/market-hours";
import {
  cn,
  formatEtDateCompact,
  proseParagraphs,
  tieFigures,
} from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/teknik-analiz/[symbol]">,
): Promise<Metadata> {
  const { symbol } = await props.params;
  const { locale } = await getI18n();
  const upper = symbol.toUpperCase();
  if (!isTechnicalSymbol(upper)) return missingMetadata(locale);
  const detail = await getTechnicalDetail(upper);
  const copy = detail
    ? locale === "en"
      ? (detail.row.copy.en ?? detail.row.copy.tr)
      : detail.row.copy.tr
    : null;
  const t = getDictionary(locale);
  const diller: Locale[] = detail?.row.copy.en ? ["tr", "en"] : ["tr"];
  /* BAŞLIK ŞİRKETİ ADIYLA SÖYLER (14 Kasım SEO denetimi). "nvidia teknik
     analiz", "nvda hisse yorum" aranıyor; sayfa o yorumu taşıyordu ama
     başlık yalnız "NVDA Teknik Analiz" diyordu. Ad sayfanın gövdesiyle aynı
     istek içi önbellekten (`getSymbolNames`, aynı liste = aynı anahtar);
     tüzel ek ("Corporation", "Inc.") başlıkta yer tutmasın diye kırpılır. */
  const names = await getSymbolNames([...TECHNICAL_SYMBOLS]);
  /* 14 Kasım (ikinci tur): kırpma `lib/seo-titles.ts` → `shortCompanyName`e
     çıktı; `h1` (TechnicalCover) ve JSON-LD başlığı aynı kaynağı okur. */
  return {
    title: fittedTitle(technicalTitles(names[upper]?.name, upper, locale), locale),
    /* ANALİZ YOKKEN SAYFA BOŞ BİR KABUK. Açıklaması da yoktu ve arama
       motoruna "başlık var, içerik yok" bir sayfa ilan ediliyordu; o hâlde
       dizine girmiyor, bağlantıları izleniyor. */
    description: copy ? metaDescription(copy.headline) : t.technical.noAnalysisHint,
    ...(detail ? {} : { robots: { index: false, follow: true } }),
    openGraph: detail
      ? articleOpenGraph(locale, {
          modifiedTime: new Date(detail.row.updatedAt).toISOString(),
          availableLocales: diller,
        })
      : undefined,
    /* HREFLANG YALNIZCA VAR OLAN DİLLERİ İLAN EDER — İngilizce metin yoksa
       /en adresi Türkçesini gösteriyor, o adres İngilizce sayfa değil. */
    alternates: pageAlternates(technicalHref(upper), locale, diller),
  };
}

/**
 * Tek hissenin teknik analizi.
 *
 * Sıra okuyucunun sorusunun sırası: ne diyor ve neden (kapak: görüş, başlık,
 * planın okuması), nereden alınır nerede satılır nerede vazgeçilir (kapağın
 * sağı: plan şeridi ve çizgi), göstergeler tek kelimeyle ne diyor (özet
 * şeridi), seviyeler fiyata göre nerede (harita), gerekçe ve senaryolar,
 * göstergelerin ayrıntısı, neye dikkat, daha önce ne demişti.
 *
 * Liste dışı sembol 404: `/teknik-analiz/aapl` bir analiz sayfası değil, "bu hisse
 * takip edilmiyor" demek. Listede olup henüz analizi olmayan sembol ise
 * sayfanın kendisini açıyor ve boş durumu gösteriyor.
 */
export default async function TechnicalDetailPage(props: PageProps<"/teknik-analiz/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = raw.toUpperCase();
  if (!isTechnicalSymbol(symbol)) notFound();

  const { locale, t } = await getI18n();
  const status = await getStatus();
  /* Kotasyon listenin TAMAMIYLA isteniyor, tek sembolle değil: istek içi
     önbellek anahtarı sıralanmış sembol dizesi (bkz. `getQuotes`) ve liste
     sayfasıyla aynı anahtar aynı sayıyı verir. */
  const [detail, meta, quotes, holidays, board, barsResult] = await Promise.all([
    getTechnicalDetail(symbol),
    /* İsim ve logo da LİSTENİN TAMAMI için isteniyor: sayfanın dibindeki
       çıkış kartları on bir şirketi daha basıyor ve `getSymbolNames` de
       anahtarı sıralanmış sembol dizesi olan bir istek-içi önbellek — tek
       sembol sormak ikinci bir sorgu açardı (bkz. kotasyon yorumu). */
    getSymbolNames([...TECHNICAL_SYMBOLS]),
    getQuotes([...TECHNICAL_SYMBOLS], status),
    getHolidays(),
    getTechnicalBoard(),
    /* KAPAĞIN GRAFİĞİ (14 Kasım). Hisse sayfasının "Hareketli Ortalamalar"
       ve "Teknik Fotoğraf" panellerinin çağırdığı AYNI istek ("1Y" günlük
       barlar; 200 günlük ortalamaya yeter): yeni sağlayıcı çağrısı yok,
       `fetch` önbelleği ortak. */
    getChartBars(symbol, "1Y", status),
  ]);
  /* BAYAT SERİ ÇİZİLMEZ. Sağlayıcı düşünce `getChartBars` veritabanındaki
     son barlara düşer ve bunu `stale` ile söyler (`cachedBarsUsable`: beş
     güne kadar eski olabilir). Grafiğin ucu başlıktaki fiyatla aynı sayı
     olmak zorunda ve seviyeler bugünün yayını; günlerce eski bir çizginin
     üstünde bugünün desteği yanlış bir resim olurdu. O hâlde grafik yer
     bırakmaz, kapakta eski etiketli ölçek kalır (`TechnicalCover`). */
  const bars = barsResult.ok && !barsResult.stale && barsResult.data.length > 0 ? barsResult.data : null;
  const company = meta[symbol]?.name ?? symbol;

  /* ÇIKIŞ KARTLARI. Sıra `TECHNICAL_SYMBOLS`in sırası — liste sayfası da
     onu kullanıyor, iki ekran aynı dizilimi gösteriyor. Görüş panodan
     geliyor (beş günden eski yayın orada zaten yok), değişim sayfanın
     kendi kotasyon paketinden: aynı anahtar, aynı sayı. */
  const stanceOf = new Map(board.map((entry) => [entry.row.symbol, verdictOf(entry.row.stance)]));
  const moreEntries: MoreSymbolEntry[] = TECHNICAL_SYMBOLS.filter(
    (other) => other !== symbol,
  ).map((other) => ({
    symbol: other,
    name: meta[other]?.name ?? null,
    logoUrl: meta[other]?.logoUrl ?? null,
    verdict: stanceOf.get(other) ?? null,
    changePct: (quotes.ok ? quotes.data[other]?.changePct : null) ?? null,
  }));

  const moreCards = { quotes: quotes.ok ? quotes.data : null, stale: quotes.ok && Boolean(quotes.stale), names: meta, status };

  const breadcrumb = (
    <nav aria-label={t.common.breadcrumb} className="flex flex-wrap items-center gap-2 text-small text-muted">
      <Link href="/teknik-analiz" className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
        {t.technical.title}
      </Link>
      <span aria-hidden>›</span>
      <span className="font-semibold text-strong">{symbol}</span>
    </nav>
  );

  /* PAYLAŞ DÜĞMESİ KIRINTININ SAĞINDA, KAPAĞIN İÇİNDE DEĞİL.
     Kapak sayfanın cevabını taşıyor (görüş, gerekçe, plan) ve oraya bir
     denetim koymak okumanın önüne bir düğme koymak olurdu — mercek ve
     rehber yazılarında da düğme metnin ÜSTÜNDEKİ sessiz şeritte duruyor,
     aynı kalıp. Şirket sayfasının kırıntı satırı da sağ ucunu bir eyleme
     ("Şirket Dosyası") veriyor; bu satır boştu.

     DÜĞME YALNIZCA ANALİZ VARKEN. Analizi olmayan sembolde sayfa "henüz
     yayın yok" diyor; paylaşılacak bir şey yok, düğme de yok. */

  if (!detail) {
    return (
      <MotionExperience className={directory.page}>
        {breadcrumb}
        <Panel>
          <EmptyState title={t.technical.noAnalysis} hint={t.technical.noAnalysisHint} titleAs="h1" scene="chart" />
        </Panel>
        {/* Yayın yokken Claude'un görüşü sayfanın tek okuması olabilir: boş durumun hemen altında. */}
        <ClaudeCta symbol={symbol} locale={locale} focus="technical" />
        {/* Çıkış kartları BURADA DA duruyor — hatta asıl burada: boş durum
            okuyucuya "bu hissede yayın yok" diyor ve tek başına bıraksa
            sayfanın sonu geri tuşu olurdu. */}
        <MoreSymbols entries={moreEntries} cards={moreCards} locale={locale} t={t} />
      </MotionExperience>
    );
  }

  const { row, previousStance, history } = detail;
  const verdict = verdictOf(row.stance);
  const hasEnglish = row.copy.en !== null && row.copy.en !== undefined;
  const copy = locale === "en" ? (row.copy.en ?? row.copy.tr) : row.copy.tr;
  const copyLang = locale === "en" && !hasEnglish ? "tr" : locale;
  const quote = quotes.ok ? (quotes.data[symbol] ?? null) : null;
  const price = quote?.price ?? row.snapshot.price;
  const changePct = quote ? quote.changePct : row.snapshot.changePct;
  /* ETİKET TEK YERDE: kapak ve harita aynı adı kullanıyor. Kotasyon yoksa
     fiyat fotoğraftan geliyor ve adı "Analiz Anında"; seans dışında "Son
     Fiyat"; yalnızca açık seansta taze kotasyon "15 Dakika Gecikmeli"
     (eski adıyla "Şu An"; gerekçe `livePriceLabel`de). */
  /* "Şu An" burada da SEMBOL BAŞINA kanıtlanıyor; gerekçesi liste
     sayfasında yazılı. */
  const live =
    quote !== null &&
    status.session === "regular" &&
    quotes.ok &&
    !quotes.stale &&
    isSessionTrade(quote.tradedAt, status);
  /* GÜNCEL FİYAT + GECİKME ROZETİ (24 Eylül). Etiket "15 Dakika Gecikmeli"
     idi: okuyucu sayının NE olduğunu değil yalnızca ne kadar geç olduğunu
     okuyordu. Artık ad "Güncel Fiyat", gecikme yanında bir rozet — aynı
     dürüstlük, doğru sırada. Kapak ve harita aynı iki parçayı kullanıyor. */
  const priceLabel = !quote
    ? t.technical.atAnalysis
    : live
      ? t.technical.currentPrice
      : t.market.lastPrice;
  const priceBadge = live ? (quote?.realtime ? t.technical.nowRealtime : t.technical.now) : null;
  const next = nextEdition(new Date(), holidays);
  const sectionItems = [
    { id: "technical-plan", label: t.technicalVisuals.planTitle },
    { id: "technical-levels", label: t.technicalVisuals.levelsTitle },
    { id: "technical-reading", label: t.technical.summary },
    /* 10 Kasım: "Dikkat Edilecekler" haritanın altına çıktı (aşağıda). */
    { id: "technical-watch", label: t.technical.watch },
    { id: "technical-stance", label: t.technical.stanceGuide.detailTitle.replace("{stance}", verdictLabel(verdict, t)) },
    { id: "technical-indicators", label: t.technical.indicators },
    ...(history.length > 1 ? [{ id: "technical-history", label: t.technical.history }] : []),
  ];
  /* Grafik basılacak mı: kapakla AYNI soru (bar var ve çizmeye yetiyor).
     Plan paneli telefondaki kart rayını buna göre basıyor. */
  const hasChart = bars !== null && bars.length >= 30;
  const levelProps = {
    entryLow: row.entryLow,
    entryHigh: row.entryHigh,
    stop: row.stop,
    targets: row.targets,
    supports: row.supports,
    resistances: row.resistances,
  };

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      {/* MAKALE KÜNYESİ METNİN DİLİNDE. Sayfada yazılmış bir yorum var
          (başlık, değerlendirme, senaryolar) ama künyesi yalnızca kırıntıydı;
          mercek ve bilanço analiziyle aynı `Article` bloğu artık burada da.
          İngilizce metni olmayan analizde canonical Türkçe adrese gidiyor
          (`pageAlternates` yukarıda), künye de aynı adresi ve dili söylüyor. */}
      <ArticleJsonLd
        /* `h1` ile aynı metin, aynı yardımcı: "Nvidia (NVDA) Teknik Analiz". */
        headline={technicalHeading(meta[symbol]?.name, symbol, copyLang)}
        description={copy.headline}
        image={ogImageUrl("/(app)/teknik-analiz/[symbol]", technicalHref(symbol))}
        path={technicalHref(symbol)}
        locale={copyLang}
        published={row.publishedAt}
        modified={row.updatedAt}
      />
      <BreadcrumbJsonLd
        locale={copyLang}
        items={[
          { name: getDictionary(copyLang).technical.title, path: "/teknik-analiz" },
          { name: `${symbol} · ${company}`, path: technicalHref(symbol) },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {breadcrumb}
        {/* Paylaşılan başlık KISA: sayfanın kendi manşeti iki-üç cümle ve
            bir sohbet penceresinde okunmuyor. Sorunun cevabı zaten tek
            kelime — sembol, sayfanın adı ve görüş. Gerisini bağlantının
            kendi önizlemesi taşıyor (`opengraph-image`). */}
        <span className="inline-flex items-center gap-3">
        <FavoriteSlot symbol={symbol} back={technicalHref(symbol)} t={t} />
        <ShareButton
          url={absoluteUrl(technicalHref(symbol), locale)}
          title={`${symbol} ${t.technical.title} · ${verdictLabel(verdict, t)}`}
          /* Panelin başlığı "Bu Yazıyı Paylaş" değil "Bu Analizi Paylaş":
             ortak sözlük mercek ve rehber yazıları için yazılmış, burada
             paylaşılan şey bir yazı değil bir analiz. Öteki etiketler
             (X'te Paylaş, Bağlantıyı Kopyala) aynı kalıyor. */
          labels={{ ...t.share, title: t.technical.shareTitle }}
        />
        </span>
      </div>

      <TechnicalCover
        symbol={symbol}
        company={company}
        logoUrl={meta[symbol]?.logoUrl}
        row={row}
        previousStance={previousStance}
        price={price}
        changePct={changePct}
        priceLabel={priceLabel}
        priceBadge={priceBadge}
        bars={bars}
        locale={locale}
        t={t}
      />

      {/* Planın okuması, plan kartları ve yayın şeridi: kapaktan indi
          (14 Kasım; gerekçe `TechnicalCover` → "KAHRAMAN", `PlanPanel`). */}
      <PlanPanel row={row} price={price} priceLabel={priceLabel} next={next} hasChart={hasChart} locale={locale} t={t} />

      <SectionNav className={styles.sectionNav} label={t.technical.sectionsLabel} items={sectionItems} trackAtNav />

      {/* ---- OKUMA IZGARASI (14 Kasım 2026, görsel tur) ----
          Önce: sol kolon harita + dikkat edilecekler, sağ kolon
          değerlendirme + senaryolar, altta gezen "Seviyelerin Dayanağı".
          Merdiven yerini seviye defterine bırakınca sol kolon kısaldı
          (NVDA 1440: 542 → 457, TSLA'da 337 piksel) ve sağdan 63–334 piksel
          erken bitiyordu. Yeni kurgu, içerik türüne göre:
            · SOL: Seviyeler; dayanağı aynı panelin künyesi (ayrı kart değil).
            · SAĞ: Değerlendirme (metin).
            · GEZEN BLOK: Dikkat Edilecekler. Her kayıtta var (rutin en az
              bir madde yazar) ve boyu orta; `BalanceNotes` onu üç yerde
              ölçüp iki kolonun dibini en yakın hizaya getireni seçer
              (eskiden gezen blok notlardı: çoğu kayıtta tek satır, kimi
              kayıtta hiç yok, boşluğu kapatamıyordu).
            · ALTTA TAM GENİŞLİK: Senaryolar. Ray fiyat ekseninde bir çizim,
              genişlik istiyor; iki senaryo metni yanında.
          Ölçüm (1440, iki kolonun dip farkı; "önce" merdiven kalktıktan
          sonraki eski kurgu): NVDA 63 → 36, AAPL 64 → 13, AMD 64 → 13, TSLA
          (notsuz, bölgesiz) 334 → 25 (blok tam genişlikte). 1024'te 64 / 19 /
          19 / 1; 1023 ve altı tek kolon. Yerleşim `AnalysisGrid.module.css`. */}
      <div className={grid.grid} data-balance-grid data-notes="full">
        {/* SOL KOLON: HARİTA + DİKKAT EDİLECEKLER (10 Kasım). SAT planında
            harita kısa (alım bölgesi ve stop yok, üç-dört seviye) ve sol kolon
            sağdan 286 piksel erken bitiyordu (NVDA, 1440, ölçüldü; TUT'ta
            98); notlar tek satır olduğu için `BalanceNotes` de kapatamıyordu.
            "Dikkat Edilecekler" sayfanın dibinde, göstergelerden sonra tam
            genişlikte bir şeritti; oysa içeriği haritadaki seviyelerin
            yakın takvimi ("164,27'deki dip kırılırsa…"). Artık haritanın
            hemen altında, aynı kolonda: boşluk esnetilmedi, dolduruldu ve
            okur seviyeyi gördüğü yerde izleyeceği şeyi okuyor. Kolonun
            dibini `BalanceNotes` bu sarmalayıcıdan ölçüyor (`data-balance`).
            Tek kolonlu düzende sıra: harita, notlar, değerlendirme, dikkat
            edilecekler (CSS `order`). Ölçüm (1440, kolon dip farkı):
            NVDA/SAT 286 → 127 (notu olmayan kayıtta; tek notlu kayıtta not
            da haritanın altına inip ~63), AMD/TUT ve AAPL/AL 98 → 24;
            1024'te 162 / 60. */}
        <div className={grid.left} data-balance="map">
        <section id="technical-levels" className={cn(styles.block, styles.mapPanel)}>
          <div className={styles.blockHead}>
            <h2 className={styles.sectionTitle}>{t.technicalVisuals.levelsTitle}</h2>
          </div>
          {/* SEVİYE TABLOSU YERİNE FİYAT MERDİVENİ (31 Ekim, sahibinin
              isteği: "çok daha görsel"). Tablo (`PriceMap
              presentation="levels"`) eşit aralıklı satırlardı; merdivende
              aralık fiyat mesafesinin kendisi, bölge bant, stopun altı alan.
              Gerekçe `PriceLadder`.
              14 Kasım: merdivenin yerine SEVİYE DEFTERİ. "Çok daha görsel"
              isteğinin cevabı artık kapaktaki fiyat grafiği (seviyeler
              fiyatın geçmişiyle aynı eksende); merdiven aynı geometrinin
              ikinci çizimiydi ve kıvrımlı bağlarıyla sol rayı okurun
              çözmesi gereken bir şekildi. Burada sayılar kaldı: ad, fiyat,
              uzaklık ve uzaklığın kalın çubuğu. Gerekçe `LevelList`. */}
          <LevelList
            price={price}
            {...levelProps}
            verdict={verdict}
            priceLabel={priceLabel}
            priceBadge={priceBadge}
            locale={locale}
            t={t}
          />
          <p className={styles.footHint}>{t.technicalVisuals.levelsHint}</p>
        {/* SEVİYELERİN DAYANAĞI KENDİ SATIRINDA, İKİ KOLONUN ALTINDA.
            Notlar haritanın panelindeydi ve sol kolonu sağdan 100–270
            piksel uzun yapıyordu; sağ kolon o farkı senaryo kartlarının
            İÇİNE yayıyordu (NVDA'da kart 495 piksel, metni 279 — ölçüldü,
            23 Eylül). Artık hiçbir kart gerilmiyor: iki kolon kendi
            içeriği kadar. Notların yeri VERİYE göre: sunucu tam genişlik
            basıyor, `BalanceNotes` üç yerleşimi ölçüp iki kolonun dibini
            en yakın hizaya getireni seçiyor.
            14 Kasım: notlar gezen blok olmaktan çıktı, seviye panelinin
            künyesine indi (okur seviyeyi gördüğü panelde dayanağını okur);
            gezen blok artık "Dikkat Edilecekler". Not yoksa künye basılmaz
            (`PriceMapNotes` null döner, sarmalayıcı `:empty` ile gizli). */}
          <div className={grid.rationale}>
            <PriceMapNotes {...levelProps} copy={copy} verdict={verdict} lang={copyLang} t={t} />
          </div>
        </section>
        </div>

        <div id="technical-reading" className={grid.right} data-balance="reading">
          <section className={styles.block}>
            <h2 className={styles.sectionTitle}>{t.technical.summary}</h2>
            {/* DEĞERLENDİRME TEK BLOK DEĞİL. Rutin metni tek paragraf olarak
                yazıyor ve telefonda sonuç on üç satırlık kesintisiz bir
                duvardı (ölçüldü, 390): okuyucu nerede kaldığını kaybediyor.
                Metne dokunulmuyor, yalnızca cümle sınırlarından gruplanıp
                ayrı paragraflar basılıyor (`proseParagraphs`). İlk paragraf
                bir kademe büyük ve koyu — gazete girişi gibi: göz metne
                oradan giriyor, gerisi gövde ritminde akıyor. */}
            <div className={styles.proseStack} lang={copyLang}>
              {proseParagraphs(copy.summary).map((paragraph, index) => (
                <p key={paragraph.slice(0, 24)} className={index === 0 ? styles.proseLede : styles.prose}>
                  {tieFigures(paragraph)}
                </p>
              ))}
            </div>
            <div className={styles.volumeContext}>
              <h3><ChartBar size={17} aria-hidden />{t.technical.volumeRead}</h3>
              <div className={styles.proseStack} lang={copyLang}>
                {proseParagraphs(copy.volume).map((paragraph) => (
                  <p key={paragraph.slice(0, 24)} className={styles.prose}>
                    {tieFigures(paragraph)}
                  </p>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section id="technical-watch" className={cn(styles.block, grid.watch)} data-balance="notes">
          <h2 className={styles.sectionTitle}>{t.technical.watch}</h2>
          <ul className={grid.watchList} lang={copyLang}>
            {copy.watch.map((item) => (
              <li key={item}>{tieFigures(item)}</li>
            ))}
          </ul>
        </section>
        <BalanceNotes />
      </div>

      <section id="technical-scenarios" className={styles.block}>
            <h2 className={styles.sectionTitle}>{t.technical.scenarios}</h2>
            {/* SENARYOLAR ÖNCE ÇİZGİ, SONRA METİN (25 Ekim). İki kutu metin
                vardı ve tetik seviyelerinin fiyata uzaklığı okuyucunun
                kafasında kuruluyordu; ray aynı sayıları fiyat ekseninde
                gösteriyor. Gerekçe ve eşleşme kuralı `ScenarioRail`de. */}
            <div className={grid.scenarioBody}>
            <ScenarioRail
              bull={copy.bull}
              bear={copy.bear}
              lang={copyLang}
              price={price}
              priceLabel={priceLabel}
              levels={levelProps}
              snapshot={row.snapshot}
              locale={locale}
              t={t}
            />
            <div className={grid.scenarioTexts} data-motion-stagger>
              {/* Başlıklar düz mürekkep (`data-ink="plain"`): rengi yön
                  taşıyor, degrade onu silerdi (globals.css).
                  Başlığın yanındaki ok senaryonun yönünü RENKTEN BAĞIMSIZ
                  söylüyor: renk körlüğünde iki kart yalnızca tonla
                  ayrılıyordu ve ikisi de aynı gri-yeşile düşüyordu. */}
              <div className={styles.scenario} data-tone="up">
                <h3 data-ink="plain"><TrendUp size={15} weight="bold" aria-hidden />{t.technical.bullCase}</h3>
                <p lang={copyLang}>{tieFigures(copy.bull)}</p>
              </div>
              <div className={styles.scenario} data-tone="down">
                <h3 data-ink="plain"><TrendDown size={15} weight="bold" aria-hidden />{t.technical.bearCase}</h3>
                <p lang={copyLang}>{tieFigures(copy.bear)}</p>
              </div>
            </div>
            </div>
      </section>

      {/* ---- Şirket Analizi (Claude): SİTENİN OKUMASINDAN SONRA ----
          11 Ekim'de önce sayfanın en tepesinden (kırıntının üstü) okumanın
          sonuna indi; telefonda 10.641 piksellik sayfanın 6.876'sına düştü
          ve sahibi "çok aşağıda" dedi. Sonra kapağın hemen altına çıktı:
          önce sitenin görüşü ve planı (kapak), hemen ardından ikinci görüş.
          14 Kasım (görsel tur): kapak artık grafik; grafiğin hemen altındaki
          bu satır grafik ile onun okumasının (plan, seviyeler, değerlendirme,
          senaryolar) ARASINA giriyor ve akışı bölüyordu. Yeri şimdi sitenin
          kendi okumasının bittiği yer: değerlendirme ve senaryolardan sonra,
          "ne demek" ve göstergelerden önce. Ölçüm (sahte veri, NVDA): 390'da
          y=3.511 (sayfa 9.559 piksel; 11 Ekim'deki "çok aşağıda" hâli 6.876 /
          10.641, kapağın hemen altındayken 1.321), 1440'ta y=2.260 (önce
          1.000).
          Hisse sayfasındakiyle AYNI bileşen (`components/ai/ClaudeCta`),
          yalnız `focus="technical"`. */}
      <ClaudeCta symbol={symbol} locale={locale} focus="technical" />

      {/* ---- Görüşün anlamı ----
          Planın hemen altında: okuyucu seviyeleri ve gerekçeyi okudu,
          sıradaki soru "bu benim için ne demek". Göstergeler bir ölçü
          ayrıntısı, bu ise planın kullanım kılavuzu; önce o geliyor. */}
      <Reveal>
        <StanceGuide variant="detail" verdict={verdict} t={t} id="technical-stance" />
      </Reveal>

      {/* ---- Göstergeler ---- */}
      <Reveal>
        <section id="technical-indicators" className="flex flex-col gap-4">
          <div className={styles.blockHead}>
            <h2 className={`${styles.sectionTitle} ${styles.sectionLead}`}>{t.technical.indicators}</h2>
            {row.snapshot.lastSession && (
              <span className={styles.blockNote}>
                {(live && quote?.realtime ? t.technical.snapshotNoteRealtime : t.technical.snapshotNote).replace("{date}", formatEtDateCompact(row.snapshot.lastSession, locale))}
              </span>
            )}
          </div>
          <div className={styles.indicatorSummary}>
            <SignalStrip snapshot={row.snapshot} price={price} locale={locale} t={t} />
          </div>
          <IndicatorPanels snapshot={row.snapshot} price={price} locale={locale} t={t} />
        </section>
      </Reveal>

      {/* Volume interpretation now accompanies the main assessment. Watch
          items form one shared reading strip, rather than mismatched cards.
          10 Kasım: izleme listesi haritanın altına, sol kolona çıktı
          (yukarıda, `analysisLeft`); burada bölüm kalmadı. */}
      {/* GİRİŞ RİTMİ TEK KARAR (14 Ekim): StanceGuide ve Göstergeler
          `Reveal` ile girerken aynı derinlikteki bölümler çıplaktı —
          sayfanın alt yarısı iki ayrı lehçe konuşuyordu. Künyeler (dipnot,
          damga, rehber) bilerek çıplak. */}

      {/* ---- Görüş geçmişi ---- */}
      {history.length > 1 && (
        <Reveal>
        <section id="technical-history" className={styles.block}>
          <h2 className={styles.sectionTitle}>{t.technical.history}</h2>
          {/* Tablo `PlanHistory`e taşındı (29 Eylül): aynı planın art arda
              yayınları tek satır ve planın seyri ortak ölçekli bir çizgi.
              Gerekçe ve ölçüm bileşenin üzerinde.
              14 Kasım: önce GÖRÜŞ ŞERİDİ (gün başına dilim), tablo katlı
              ayrıntıda; gerekçe `StanceHistory`. */}
          <StanceHistory history={history} locale={locale} t={t} />
        </section>
        </Reveal>
      )}

      {/* Sayfanın son bloğu: okuyucunun bir sonraki durağı. Dipnot bunun
          ALTINDA kalıyor — yöntem ve uyarı metni bir çıkış değil, künye. */}
      <Reveal>
      <MoreSymbols entries={moreEntries} cards={moreCards} locale={locale} t={t} />
      </Reveal>

      <div className={styles.footNote}>
        <p>{t.technical.method}</p>
        <p>{t.technical.disclaimer}</p>
        {/* `tap-44`: iki bağlantı 19 piksel yüksekliğindeydi (390'da ölçüldü)
            ve parmakla ıskalanıyordu. Sınıf yalnızca dokunma alanını
            büyütüyor, düzen değişmiyor; 640'tan geniş ekranda kapanıyor.
            İkisi 202 piksel, tek satıra sığıyor — alanları üst üste binmiyor. */}
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/hisse/${symbol}`} className="tap-44 font-semibold text-primary hover:text-primary-hover">
            {t.technical.companyPage} ↗
          </Link>
          <Link href="/teknik-analiz" className="tap-44 font-semibold text-primary hover:text-primary-hover">
            {t.technical.allStocks} ↗
          </Link>
        </p>
      </div>

      {/* Damganın gerekçesi liste sayfasında yazılı. Burada ayrıca gerekli:
          kapaktaki fiyat ekranın en büyük sayısı ve "Diğer Şirketler"
          kartlarının yüzdeleri de aynı pakete bağlı — o yüzdeler kendi
          künyesini taşımıyor, bayatlığı bu damga söylüyor. Göstergelerin
          kapanış tarihi ayrı bir künye (`snapshotNote`) ve o bölümün
          içinde kalıyor; kotasyonun yaşını anlatmıyor. */}
      {quotes.ok && (
        <DataStamp
          labels={t.data}
          source={quotes.source}
          at={quotes.fetchedAt}
          stale={quotes.stale}
          locale={locale}
          note={
            status.session === "pre-market" || status.session === "after-hours"
              ? t.data.extendedNote
              : undefined
          }
        />
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={[STANCE_GUIDE_SLUG, "risk-yonetimi"]}
      />
    </MotionExperience>
  );
}
