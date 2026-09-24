import { ArrowUpRight, ChartBar, TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { ShareButton } from "@/components/article/ShareButton";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, Reveal, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { IndicatorPanels } from "@/components/technical/IndicatorPanels";
import { MoreSymbols, type MoreSymbolEntry } from "@/components/technical/MoreSymbols";
import { PlanStrip } from "@/components/technical/PlanStrip";
import { BalanceNotes } from "@/components/technical/BalanceNotes";
import { PriceMap, PriceMapNotes } from "@/components/technical/PriceMap";
import { SignalStrip } from "@/components/technical/SignalStrip";
import {
  changeToneClass,
  planPositionLabel,
  planReadingText,
  planReadingTone,
} from "@/components/technical/TechnicalCard";
import styles from "@/components/technical/Technical.module.css";
import { DataStamp, EmptyState, LogoTile, Panel } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass } from "@/lib/analysis";
import { getHolidays, getStatus, getSymbolNames } from "@/lib/data";
import { getDictionary, getI18n } from "@/lib/i18n";
import { articleOpenGraph, metaDescription, missingMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import {
  TECHNICAL_SYMBOLS,
  editionClock,
  editionTime,
  formatRange,
  isTechnicalSymbol,
  nextEdition,
  planPosition,
  planReading,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
} from "@/lib/technical";
import { getTechnicalBoard, getTechnicalDetail } from "@/lib/technical-data";
import { isSessionTrade, todayEt } from "@/lib/market-hours";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatPercent,
  formatPrice,
  NO_VALUE,
  proseParagraphs,
  tieFigures,
} from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/teknik/[symbol]">,
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
  return {
    title: locale === "en" ? `${upper} Technical Analysis` : `${upper} Teknik Analiz`,
    /* ANALİZ YOKKEN SAYFA BOŞ BİR KABUK. Açıklaması da yoktu ve arama
       motoruna "başlık var, içerik yok" bir sayfa ilan ediliyordu; o hâlde
       dizine girmiyor, bağlantıları izleniyor. */
    description: copy ? metaDescription(copy.headline) : t.technical.noAnalysisHint,
    ...(detail ? {} : { robots: { index: false, follow: true } }),
    openGraph: detail
      ? articleOpenGraph(locale, { modifiedTime: new Date(detail.row.updatedAt).toISOString() })
      : undefined,
    /* HREFLANG YALNIZCA VAR OLAN DİLLERİ İLAN EDER — İngilizce metin yoksa
       /en adresi Türkçesini gösteriyor, o adres İngilizce sayfa değil. */
    alternates: pageAlternates(
      technicalHref(upper),
      locale,
      detail?.row.copy.en ? ["tr", "en"] : ["tr"],
    ),
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
 * Liste dışı sembol 404: `/teknik/aapl` bir analiz sayfası değil, "bu hisse
 * takip edilmiyor" demek. Listede olup henüz analizi olmayan sembol ise
 * sayfanın kendisini açıyor ve boş durumu gösteriyor.
 */
export default async function TechnicalDetailPage(props: PageProps<"/teknik/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = raw.toUpperCase();
  if (!isTechnicalSymbol(symbol)) notFound();

  const { locale, t } = await getI18n();
  const status = await getStatus();
  /* Kotasyon listenin TAMAMIYLA isteniyor, tek sembolle değil: istek içi
     önbellek anahtarı sıralanmış sembol dizesi (bkz. `getQuotes`) ve liste
     sayfasıyla aynı anahtar aynı sayıyı verir. */
  const [detail, meta, quotes, holidays, board] = await Promise.all([
    getTechnicalDetail(symbol),
    /* İsim ve logo da LİSTENİN TAMAMI için isteniyor: sayfanın dibindeki
       çıkış kartları on bir şirketi daha basıyor ve `getSymbolNames` de
       anahtarı sıralanmış sembol dizesi olan bir istek-içi önbellek — tek
       sembol sormak ikinci bir sorgu açardı (bkz. kotasyon yorumu). */
    getSymbolNames([...TECHNICAL_SYMBOLS]),
    getQuotes([...TECHNICAL_SYMBOLS], status),
    getHolidays(),
    getTechnicalBoard(),
  ]);
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

  const breadcrumb = (
    <nav aria-label={t.common.breadcrumb} className="flex flex-wrap items-center gap-2 text-small text-muted">
      <Link href="/teknik" className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
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
        {/* Çıkış kartları BURADA DA duruyor — hatta asıl burada: boş durum
            okuyucuya "bu hissede yayın yok" diyor ve tek başına bıraksa
            sayfanın sonu geri tuşu olurdu. */}
        <MoreSymbols entries={moreEntries} locale={locale} t={t} />
      </MotionExperience>
    );
  }

  const { row, previousStance, history } = detail;
  const verdict = verdictOf(row.stance);
  const change = stanceChangeLabel(verdict, previousStance, t);
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
  const priceBadge = live ? t.technical.now : null;
  const next = nextEdition(new Date(), holidays);
  const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);
  const reading = planReading(verdict, price, row);
  const sectionItems = [
    { id: "technical-levels", label: t.technical.priceMap },
    { id: "technical-reading", label: t.technical.summary },
    { id: "technical-indicators", label: t.technical.indicators },
    { id: "technical-watch", label: t.technical.watch },
    ...(history.length > 1 ? [{ id: "technical-history", label: t.technical.history }] : []),
  ];
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
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.technical.title, path: "/teknik" },
          { name: `${symbol} · ${company}`, path: technicalHref(symbol) },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {breadcrumb}
        {/* Paylaşılan başlık KISA: sayfanın kendi manşeti iki-üç cümle ve
            bir sohbet penceresinde okunmuyor. Sorunun cevabı zaten tek
            kelime — sembol, sayfanın adı ve görüş. Gerisini bağlantının
            kendi önizlemesi taşıyor (`opengraph-image`). */}
        <ShareButton
          url={absoluteUrl(technicalHref(symbol), locale)}
          title={`${symbol} ${t.technical.title} · ${verdictLabel(verdict, t)}`}
          /* Panelin başlığı "Bu Yazıyı Paylaş" değil "Bu Analizi Paylaş":
             ortak sözlük mercek ve rehber yazıları için yazılmış, burada
             paylaşılan şey bir yazı değil bir analiz. Öteki etiketler
             (X'te Paylaş, Bağlantıyı Kopyala) aynı kalıyor. */
          labels={{ ...t.share, title: t.technical.shareTitle }}
        />
      </div>

      {/* ---- Kapak ---- */}
      <header className={styles.cover} data-verdict={verdict}>
        <div className={styles.coverMain} data-motion-intro>
          {/* KİMLİK BLOĞU HİSSE SAYFASINA GİDİYOR.
              Logo ile ad sayfanın en büyük öğesiydi ve hiçbir yere
              gitmiyordu: teknik görüşü okuyan okuyucunun bir sonraki isteği
              şirketin grafiğine bakmak ama künye çubuğu /teknik LİSTESİNE
              çıkıyor, hisseye değil. Bağlantı logo + sembol + adı BİRLİKTE
              sarıyor; üçü aynı şeyi söylüyor, üç ayrı sekme durağı olmaları
              gerekmiyor. Künye satırları (bu yayının saati, sıradaki yayın)
              bağlantının DIŞINDA: onlar şirketin kimliği değil yayının
              damgası — ekran okuyucuya bağlantının adı olarak okunmaları da
              yanlış olurdu. */}
          <div className={styles.coverIdentity}>
            {/* GÖRÜŞ ADIN SAĞINDA, AYNI SATIRDA. Rozet bir dönem künyenin
                altında kendi satırındaydı; telefonda kapak logo, ad, iki
                künye satırı, rozet, başlık cümlesi diye altı kat üst üste
                biniyordu ve okuyucunun ilk sorusu ("bu hissede ne
                görünüyor") dördüncü katta cevaplanıyordu. Ad ile görüş
                artık aynı satırı paylaşıyor: sol uçta kimlik, sağ uçta
                tek kelime. Künye satırları o satırın altında kalıyor. */}
            <div className={styles.coverHead}>
            <Link href={`/hisse/${symbol}`} className={styles.coverNameLink}>
              <LogoTile symbol={symbol} logoUrl={meta[symbol]?.logoUrl} size="lg" />
              <div className="min-w-0">
                <h1>
                  {symbol}
                  {/* Dokunmatikte `:hover` yok: bağlantı olduğunu söyleyen
                      tek şey bu ok. Ölçüsü `em` — sembolün puntosu
                      genişlikle değiştiği için okun da onunla değişmesi
                      gerekiyor. */}
                  <ArrowUpRight className={styles.coverGo} weight="bold" aria-hidden />
                </h1>
                {/* ŞİRKET ADI KENDİ SATIRINDA. Dört parça tek künyeye dizilince
                    ("Micron Technology Inc · Seans İçi · 16 Eylül Çarşamba ·
                    19:45 TR") telefonda sarıp son parçayı tek başına alta
                    atıyordu — "TR" bir satır kaplıyordu. Adın uzunluğu şirkete
                    göre değiştiği için sarmanın nereden olacağı da her sayfada
                    farklıydı. Ad artık kendi satırında ve künyede yalnızca
                    YAYIN bilgisi kalıyor; liste kartı da sembol ile adı ayrı
                    satırda basıyor, kapak onunla aynı dile geldi. */}
                {company && <p className={styles.coverCompany}>{company}</p>}
              </div>
            </Link>
            <div className={styles.stanceRow}>
              {/* Etiket yalnızca ekran okuyucuya: gerekçe `.stancePill` yorumunda. */}
              <span className="sr-only">{t.technical.stanceLabel}</span>
              <span className={cn(styles.stancePill, verdictPillClass(verdict))}>{verdictLabel(verdict, t)}</span>
              {change && <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>}
            </div>
            </div>
            {/* İKİ KÜNYE AYNI IZGARADA (24 Eylül). "Seans İçi · 24 Eylül
                Perşembe · 19:45 TR" ile "Sıradaki Yayın · Kapanış Öncesi ·
                21:45 TR" iki düz satırdı: ilkinin adı yoktu, parçaların
                sırası farklıydı ve saatler alt alta gelmiyordu. Artık bir
                tanım listesi — solda ad, sağda dilim ve saat AYNI SÜTUNLARDA
                (`subgrid`). Tarih yalnızca BUGÜN değilse yazılıyor; iki satır
                aynı kuralla (sıradaki yayının kuralı zaten buydu). */}
            <dl className={styles.coverStamps}>
              <dt>{t.technical.thisEdition}</dt>
              <dd>
                <span>{slotLabel(row.slot, t)}</span>
                <span className="numeral">{editionTime(row.sessionDate, row.slot, locale)}</span>
                {row.sessionDate !== status.etDate && (
                  <span>{formatEtDateCompact(row.sessionDate, locale)}</span>
                )}
              </dd>
              {/* SIRADAKİ YAYIN — okuyucunun ikinci sorusu: elindeki görüş
                  NE KADAR SÜRE geçerli. Cuma akşamı açılan bir sayfada
                  "pazartesi sabaha kadar böyle" bilgisi tek başına sayfanın
                  yarısı kadar iş görüyor. */}
              {next && (
                <>
                  <dt>{t.technical.nextEdition}</dt>
                  <dd>
                    <span>{slotLabel(next.slot, t)}</span>
                    <span className="numeral">{editionClock(next.at, locale)}</span>
                    {todayEt(next.at) !== status.etDate && (
                      <span>{formatEtDateCompact(todayEt(next.at), locale)}</span>
                    )}
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className={styles.coverThesis}>
            <span className={styles.thesisLabel}>{t.technical.thesisLabel}</span>
            <p className={styles.coverHeadline} lang={copyLang}>{tieFigures(copy.headline)}</p>
          </div>

          {locale === "en" && !hasEnglish && (
            <p className="text-small text-muted">{t.technical.langNote}</p>
          )}
        </div>

        <div className={styles.coverSide}>
          <div className={styles.coverQuote}>
            <div className={styles.priceHead}>
              <span className={styles.priceLabel}>{priceLabel}</span>
              {priceBadge && <span className={styles.delayBadge}>{priceBadge}</span>}
            </div>
            <div className={styles.priceRow}>
              <span className={cn(styles.priceNow, "numeral")}>
                {formatPrice(price, locale, { currency: true })}
              </span>
              {changePct !== null && (
                <span className={cn("numeral text-lead font-semibold", directionText(directionOf(changePct)))}>
                  {formatPercent(changePct, locale)}
                </span>
              )}
            </div>
            {/* Analiz anındaki fiyat ancak FARKLIYSA yazılıyor: aynı sayının
                iki etiketle yan yana durması bilgi değil. */}
            <div className={styles.priceContext}>
              {position && (
                <span className={styles.plan} data-kind={position.kind}>
                  {planPositionLabel(position, locale, t)}
                </span>
              )}
              {row.snapshot.price !== null && price !== null && Math.abs(row.snapshot.price - price) >= 0.005 && (
                <span className={styles.priceNote}>
                  {t.technical.atAnalysis}: {formatPrice(row.snapshot.price, locale, { currency: true })}
                </span>
              )}
            </div>
          </div>
          {/* SEVİYE ÇİZGİSİ BURADAN KALKTI — aynı plan sayfada ÜÇ KEZ
              çiziliyordu: plan şeridi sayılarla, çizgi yatay eksende, fiyat
              haritası dikey eksende. Üçünün de kaynağı aynı beş sayı.
              Çizgi `aria-hidden` ve etiketsiz: ekranda soluk bir ray,
              yeşil bir kapsül, mavi bir nokta ve iki çentik duruyordu —
              okuyucunun gördüğü şey bir ölçü değil, bozuk bir sürgü
              denetimi. Aynı bilgiyi harita adlarıyla, fiyatlarıyla ve
              uzaklıklarıyla zaten veriyor.
              Liste kartında DURUYOR: orada harita yok, çizgi planın tek
              geometrisi (`TechnicalCard`). */}
          <div className={styles.reading} data-tone={planReadingTone(reading)}>
            <span className={styles.readingLabel}>{t.technical.readingLabel}</span>
            <p>{planReadingText(reading, locale, t)}</p>
          </div>
          <SignalStrip snapshot={row.snapshot} price={price} locale={locale} t={t} compact />
        </div>

        {/* 21 Eylül: mobil kapak 1045px'ti. Plan tam genişlikte kendi
            bandında; gösterge özeti ayrıntılarını anlattığı bölüme indi.
            Böylece ilk ekran kimliği, görüşü ve planı birlikte okutur.

            ÖZET SONRA KAPAĞA GERİ GELDİ — ama aynı biçimde değil. 9e1c3b6
            kapağa `compact` dalı ekledi: üç sütun, tek satırlık okuma,
            kapak sütununun dibine hizalı (`.signalsCompact`). Bölümdeki
            geniş şerit yerinde duruyor; kapaktaki bir BAKIŞ, oradaki bir
            ÖLÇÜ. Bu not bir süre yalnızca inişi anlatıyordu ve kodla
            çelişiyordu; iki hâl de burada yazılı olsun. */}
        <div className={styles.coverPlan}>
          <PlanStrip verdict={verdict} {...levelProps} size="lg" locale={locale} t={t} />
        </div>
      </header>

      <SectionNav className={styles.sectionNav} label={t.technical.sectionsLabel} items={sectionItems} trackAtNav />

      {/* ---- Fiyat haritası ve değerlendirme ---- */}
      <div className={styles.analysisGrid} data-balance-grid data-notes="full">
        <section id="technical-levels" className={cn(styles.block, styles.mapPanel)} data-balance="map">
          <div className={styles.blockHead}>
            <h2 className={styles.sectionTitle}>{t.technical.priceMap}</h2>
          </div>
          <PriceMap
            presentation="levels"
            price={price}
            {...levelProps}
            verdict={verdict}
            priceLabel={priceLabel}
            priceBadge={priceBadge}
            locale={locale}
            t={t}
          />
          <p className={styles.footHint}>{t.technical.priceLevelsNote}</p>

        </section>

        <div id="technical-reading" className={styles.analysisReading} data-balance="reading">
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
          <section className={styles.block}>
            <h2 className={styles.sectionTitle}>{t.technical.scenarios}</h2>
            <div className={styles.scenarios} data-motion-stagger>
              {/* Başlığın yanındaki ok senaryonun yönünü RENKTEN BAĞIMSIZ
                  söylüyor: renk körlüğünde iki kart yalnızca tonla
                  ayrılıyordu ve ikisi de aynı gri-yeşile düşüyordu. */}
              <div className={styles.scenario} data-tone="up">
                <h3><TrendUp size={15} weight="bold" aria-hidden />{t.technical.bullCase}</h3>
                <p lang={copyLang}>{tieFigures(copy.bull)}</p>
              </div>
              <div className={styles.scenario} data-tone="down">
                <h3><TrendDown size={15} weight="bold" aria-hidden />{t.technical.bearCase}</h3>
                <p lang={copyLang}>{tieFigures(copy.bear)}</p>
              </div>
            </div>
          </section>
        </div>

        {/* SEVİYELERİN DAYANAĞI KENDİ SATIRINDA, İKİ KOLONUN ALTINDA.
            Notlar haritanın panelindeydi ve sol kolonu sağdan 100–270
            piksel uzun yapıyordu; sağ kolon o farkı senaryo kartlarının
            İÇİNE yayıyordu (NVDA'da kart 495 piksel, metni 279 — ölçüldü,
            23 Eylül). Artık hiçbir kart gerilmiyor: iki kolon kendi
            içeriği kadar. Notların yeri VERİYE göre: sunucu tam genişlik
            basıyor, `BalanceNotes` üç yerleşimi ölçüp iki kolonun dibini
            en yakın hizaya getireni seçiyor. */}
        <div className={cn(styles.block, styles.notesPanel)} data-balance="notes">
          <PriceMapNotes {...levelProps} copy={copy} verdict={verdict} lang={copyLang} t={t} />
        </div>
        <BalanceNotes />
      </div>

      {/* ---- Göstergeler ---- */}
      <Reveal>
        <section id="technical-indicators" className="flex flex-col gap-4">
          <div className={styles.blockHead}>
            <h2 className={styles.sectionTitle}>{t.technical.indicators}</h2>
            {row.snapshot.lastSession && (
              <span className={styles.blockNote}>
                {t.technical.snapshotNote.replace("{date}", formatEtDateCompact(row.snapshot.lastSession, locale))}
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
          items form one shared reading strip, rather than mismatched cards. */}
      <section id="technical-watch" className={cn(styles.block, styles.watchPanel)}>
        <h2 className={styles.sectionTitle}>{t.technical.watch}</h2>
        <ul className={styles.watch} lang={copyLang}>
          {copy.watch.map((item) => (
            <li key={item}>{tieFigures(item)}</li>
          ))}
        </ul>
      </section>

      {/* ---- Görüş geçmişi ---- */}
      {history.length > 1 && (
        <section id="technical-history" className={styles.block}>
          <h2 className={styles.sectionTitle}>{t.technical.history}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t.technical.historyDate}</th>
                  <th scope="col">{t.technical.historyEdition}</th>
                  <th scope="col">{t.technical.historyStance}</th>
                  <th scope="col">{t.technical.entryZone}</th>
                  <th scope="col">{t.technical.stop}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => {
                  const stance = verdictOf(entry.stance);
                  const older = history[index + 1];
                  const turned = older ? stanceChangeLabel(stance, verdictOf(older.stance), t) : null;
                  return (
                    <tr key={`${entry.sessionDate}-${entry.slot}`}>
                      <td data-cell="date">{formatEtDateCompact(entry.sessionDate, locale)}</td>
                      <td data-cell="edition">{slotLabel(entry.slot, t)}</td>
                      <td data-cell="stance">
                        <span className={cn("inline-flex rounded-full px-2.5 py-[2px] text-tiny font-bold", verdictPillClass(stance))}>
                          {verdictLabel(stance, t)}
                        </span>
                        {turned && <span className={cn("ml-2 text-tiny font-bold", changeToneClass(stance))}>{turned}</span>}
                      </td>
                      <td className="numeral" data-cell="entry" data-label={t.technical.entryZone}>
                        {entry.entryLow !== null && entry.entryHigh !== null
                          ? formatRange(entry.entryLow, entry.entryHigh, locale)
                          : NO_VALUE /* Değer yok işareti tek: uzun çizgi değil (lib/utils). */}
                      </td>
                      <td className="numeral" data-cell="stop" data-label={t.technical.stop}>{formatPrice(entry.stop, locale, { currency: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sayfanın son bloğu: okuyucunun bir sonraki durağı. Dipnot bunun
          ALTINDA kalıyor — yöntem ve uyarı metni bir çıkış değil, künye. */}
      <MoreSymbols entries={moreEntries} locale={locale} t={t} />

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
          <Link href="/teknik" className="tap-44 font-semibold text-primary hover:text-primary-hover">
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
        slugs={["risk-yonetimi", "emir-tipleri"]}
      />
    </MotionExperience>
  );
}
