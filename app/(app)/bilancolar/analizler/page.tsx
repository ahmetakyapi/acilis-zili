import { QueryTransition } from "@/components/layout/QueryTransition";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/motion/DirectoryExperience.module.css";
import analysisStyles from "@/components/earnings/AnalysisExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { auth } from "@/auth";
import {
  EmptyState,
  FilterChip,
  Panel,
  PanelHeader,
  PanelLink,
  Segment,
  SegmentItem,
  LogoTile,
} from "@/components/ui/primitives";
import { ArrowDown, ArrowUpRight, Star } from "@phosphor-icons/react/dist/ssr";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { AnalysisTable } from "@/components/earnings/AnalysisTable";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import { FillList } from "@/components/earnings/FillList";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import {
  getAnalyses,
  getUpcomingEarnings,
  getSymbolNames,
  getUserSymbols,
  type AnalysisIndexRow,
  type AnalysisSort,
} from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { readerDayOffset } from "@/lib/session-clock";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* Künye YOKTU ve sayfa site haritasında en yüksek öncelikte (0.9) duruyordu:
   arama sonucunda kökten miras kalan "Açılış Zili — ABD Piyasa Takibi"
   başlığıyla, yani ana sayfayla birebir aynı künyeyle çıkıyordu. */
export const generateMetadata = pageMetadata({
  path: "/bilancolar/analizler",
  tr: {
    title: "Bilanço Analizleri",
    description: "Okunmuş çeyrek sonuçları: skor, görüş ve hedef fiyatla.",
  },
  en: {
    title: "Earnings Analyses",
    description: "Quarters we read: score, verdict and price target.",
  },
});
import {
  analysisHref,
  analysisTableLabels,
  timingLabel,
  toAnalysisRowView,
  verdictLabel,
  verdictOf,
  verdictTextClass,
} from "@/lib/analysis";
import {
  sectorGroupLabel,
  sectorGroupOf,
  type SectorGroup,
} from "@/lib/sectors";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  cn,
  etDateParts,
  formatEtDateLong,
  formatPercent,
  formatPrice,
  plural,
  relativeDayLabel,
} from "@/lib/utils";

/**
 * Bilançolar · Analizler sekmesi.
 *
 * Takvim "ne zaman", bu ekran "ne çıktı" sorusunu yanıtlıyor. Üst sıra tek
 * bakışta günün hikâyesini veriyor, altındaki tablo arşivin tamamı.
 *
 * Sektör filtresi analizin kendi `sector` metninden DEĞİL, sembolün
 * `industry` alanından türeyen mevcut sektör taksonomisinden geliyor
 * (`lib/sectors.ts`): analiz metnindeki serbest tanım ("Yarı İletken · NAND /
 * Flash Depolama") okuyucuya hitap ediyor ama filtre anahtarı olamaz.
 */

const SORTS: readonly AnalysisSort[] = ["tarih", "skor", "tepki"];

/* YAKLAŞAN HAVUZU ON, TABAN BEŞ. Sunucu on satır basıyor, ilk beşi açık;
   geniş ekranda FillList kartın boyuna kaç satır sığıyorsa o kadarını
   açıyor. Beş, JavaScript kapalıyken bile kartın yanına sığan sayı:
   5 × 52 + başlık 74 + kenarlık 2 = 336 piksel. Kartın en kısa hâli
   ARTIK başlık uzunluğuna bağlı değil: öne çıkan analizin özeti iki
   satırda kaldığında (Enerji süzgeci, Chevron) kart 318'e iniyor, bir satır
   kapanıyor ve yan panelde 31–35 piksellik bant geri geliyordu; JS
   kapalıyken beşinci satır yarıdan kesiliyordu. Özet kutusu geniş ekranda
   üç satırlık yeri her zaman ayırıyor (CSS `.featureHeadline`). On, en uzun kartın (1280'de 357) yanına sığabilecek
   satırın üstünde bir tavan — sorgu aynı, yalnızca LIMIT büyüdü; ek tur
   yok. */
const UPCOMING_POOL = 10;
const UPCOMING_BASE = 5;
/* Haftanın analizleri aynı kalıpla: taban beş, sekize kadar doldurma. */
const WEEK_POOL = 8;
const WEEK_BASE = 5;
/* Bir haftanın içindeki gün "yakın": dar panelde göreli gün yalnızca bu
   eşiğin içinde kalıyor. */
const NEAR_DAYS = 7;

function isSort(value: string | undefined): value is AnalysisSort {
  return SORTS.includes(value as AnalysisSort);
}

/**
 * Arşivin aktif sıralaması — `getAnalyses`in SQL sıralamasının bellekteki
 * eşi. Küme artık hep tarihe göre çekiliyor (en son 60); skor ve tepki
 * sıralaması burada, SQL'dekiyle aynı kurallarla: skorda eşitlikte yeni
 * tarih önce; tepkide boş değer en sonda (NULLS LAST), sonra yeni tarih.
 * `tarih` için dizi zaten SQL sırasında (tarih, sonra yayın anı).
 */
function sortAnalyses(rows: AnalysisIndexRow[], sort: AnalysisSort): AnalysisIndexRow[] {
  if (sort === "tarih") return rows;
  const byDate = (a: AnalysisIndexRow, b: AnalysisIndexRow) => b.reportDate.localeCompare(a.reportDate);
  if (sort === "skor") return [...rows].sort((a, b) => b.score - a.score || byDate(a, b));
  return [...rows].sort((a, b) => {
    if (a.reactionPct === null || b.reactionPct === null) {
      if (a.reactionPct === b.reactionPct) return byDate(a, b);
      return a.reactionPct === null ? 1 : -1;
    }
    return b.reactionPct - a.reactionPct || byDate(a, b);
  });
}

export default async function AnalysesPage(
  props: PageProps<"/bilancolar/analizler">,
) {
  const search = await props.searchParams;
  const sortParam =
    typeof search.sirala === "string" ? search.sirala : undefined;
  const sort: AnalysisSort = isSort(sortParam) ? sortParam : "tarih";
  const filter = typeof search.filtre === "string" ? search.filtre : null;

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  /* KÜME TARİHE GÖRE, SIRA BELLEKTE. `getAnalyses` sınırı sıralamadan SONRA
     uyguluyor: `?sirala=skor` ile çipler, "Bu Hafta", kapak sayıları ve
     haftanın paneli en son 60 değil en yüksek skorlu 60 analiz üzerinden
     hesaplanıyordu — sıralamayı değiştiren okuyucu çip ve sayıların da
     değiştiğini görürdü (bugün 41 analiz; sezonda 60'a yaklaşıyor). Küme her
     zaman en son 60; aktif sıralama aşağıda bellekte, SQL'in aynısıyla.

     ÜÇ OKUMA AYNI TURDA. Yaklaşanlar yalnızca takip listesine bağlı ama
     analiz listesini de bekliyordu: anonim okuyucuda kritik yolda gereksiz
     bir Neon turu (yaklaşan sorgusu sıcakken 62–65 ms, ölçüldü). */
  const userSymbolsP: Promise<string[]> = session?.user?.id
    ? getUserSymbols(session.user.id)
    : Promise.resolve([]);
  const [byDate, userSymbols, upcoming] = await Promise.all([
    getAnalyses(locale, { limit: 60, sort: "tarih" }),
    userSymbolsP,
    userSymbolsP.then((preferred) =>
      getUpcomingEarnings(today, addEtDays(today, 30), UPCOMING_POOL, { preferred }),
    ),
  ]);
  const all = sortAnalyses(byDate, sort);
  const watchSet = new Set(userSymbols);

  /* YAKLAŞANLAR SORGUDA SÜZÜLÜYOR. Burada bir dönem 30 günlük takvimin
     TAMAMI çekilip (bilanço sezonunda birkaç bin satır) bellekte
     sıralanıyordu, ardından o satırların tekil sembolleriyle ikinci bir
     `getSymbolNames` çağrılıyordu. Ekrana giden beş satır için. Üstelik
     bu iş yukarıdaki sorgulara HİÇ bağlı olmadığı hâlde onları bekliyordu.

     İKİSİ AYNI TURDA. Yorum bir dönem "artık tek turda geliyor" diyordu ama
     kod öyle yapmıyordu: yaklaşanlar ile künye sorgusu ardışık bekleniyordu.
     İkisi birbirinden bağımsız — biri takvime ve takip listesine, öteki
     yalnızca analiz listesine bakıyor — yani sayfanın kritik yolunda
     gereksiz bir Neon turu duruyordu. Zincir üç kademeden ikiye indi. */
  const meta = await getSymbolNames([...new Set(all.map((row) => row.symbol))]);

  /* Filtre çipleri yalnızca ELDE OLAN sektörleri gösterir: hiçbir analizi
     olmayan bir sektör çipi tıklanınca boş ekran veriyordu. */
  const groups = new Map<string, SectorGroup>();
  for (const row of all) {
    const group = sectorGroupOf(meta[row.symbol]?.industry);
    groups.set(group.key, group);
  }

  const weekAgo = addEtDays(today, -7);

  const rows = all.filter((row) => {
    if (!filter) return true;
    if (filter === "hafta") return row.reportDate >= weekAgo;
    if (filter === "takip") return watchSet.has(row.symbol);
    return sectorGroupOf(meta[row.symbol]?.industry).key === filter;
  });

  /* ÖNE ÇIKAN KART LİSTENİN İLK SATIRI — ve artık öyle olduğunu söylüyor.
     Kart `all[0]`dan geliyordu, yani filtreyi hiç görmüyordu: okuyucu
     "Enerji" çipine bastığında altındaki tablo enerjiye düşerken kart bir
     teknoloji şirketini göstermeye devam ediyordu. Aynı kart rozetinde
     koşulsuz "Günün Analizi" yazıyordu; oysa `all` aktif SIRALAMAYA göre
     çekiliyor, yani `?sirala=skor` ile kart iki ay önceki bir analizi günün
     analizi diye ilan ediyordu. Var olmayan bir kesinlik iddiası.

     Rozet kalktı, kart filtrelenmiş listenin başına bağlandı. Tarih satırı
     kartın ne olduğunu zaten söylüyor ve tablodaki ilk satır vurgusu artık
     her koşulda kartla aynı satırı gösteriyor. */
  const featured = rows[0] ?? null;
  /* Haftanın paneli arşivin sıralamasını İZLEMİYOR: sıralama değişince
     satırlar yer değiştiriyor ama sayfa yeniden bağlanmıyordu; FillList'in
     elle açtığı satırlar DOM'da açık kalıp sırası kayanlar kapanıyordu. */
  const weekAll = byDate.filter((row) => row.reportDate >= weekAgo);
  const thisWeek = weekAll.slice(0, WEEK_POOL);
  const distribution = (["buy", "hold", "sell"] as const).map((key) => ({
    key,
    count: rows.filter((row) => verdictOf(row.verdict) === key).length,
  }));

  const tableRows = rows.map((analysis) =>
    toAnalysisRowView(analysis, meta[analysis.symbol], locale, t),
  );

  const filterHref = (key: string | null) => {
    const params = new URLSearchParams();
    if (key) params.set("filtre", key);
    if (sort !== "tarih") params.set("sirala", sort);
    const query = params.toString();
    return query ? `/bilancolar/analizler?${query}` : "/bilancolar/analizler";
  };
  const sortHref = (key: AnalysisSort) => {
    const params = new URLSearchParams();
    if (filter) params.set("filtre", filter);
    if (key !== "tarih") params.set("sirala", key);
    const query = params.toString();
    return query ? `/bilancolar/analizler?${query}` : "/bilancolar/analizler";
  };

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      {/* ALT BAŞLIK YOK: buradaki metin "detaylı değerlendirme Analizler'de"
          diyordu, yani okuyucuyu ZATEN ÜSTÜNDE DURDUĞU sekmeye yolluyordu.
          Hangi görünümde olunduğunu hemen altındaki sekme çubuğu söylüyor;
          başlık bölümün adı, sekme de görünümün adı. */}
      <DirectoryHeader
        eyebrow={t.directory.earningsEyebrow}
        title={t.analysis.symbolPanelTitle}
        description={t.directory.analysisDescription}
        visual={all.length > 0 && (
          <div className={analysisStyles.overview}>
            <div className={analysisStyles.overviewHeading}>
              <span>{t.analysis.filteredReports}</span>
              <a href="#analysis-archive" className="inline-flex items-center gap-1">{rows.length} {plural(rows.length, t.analysis.colCard, t.analysis.colCardMany)} <ArrowDown size={12} weight="bold" aria-hidden /></a>
            </div>
            <div className={analysisStyles.distribution}>
              {distribution.map(({ key, count }) => (
                <div key={key}>
                  <span className={verdictTextClass(key)}>{verdictLabel(key, t)}</span>
                  <b className="numeral">{count}</b>
                  <span className={analysisStyles.distributionTrack} aria-hidden>
                    <i data-verdict={key} style={{ width: `${rows.length ? count / rows.length * 100 : 0}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      />

      <EarningsTabs active="analyses" t={t} className="-mt-1" />

      {all.length === 0 ? (
        <Panel>
          <EmptyState title={t.analysis.empty} hint={t.analysis.emptyHint} scene="chart" />
        </Panel>
      ) : (
        <div className={analysisStyles.workspace} data-has-week={thisWeek.length > 0} data-has-feature={!!featured}>
          <div data-motion-stagger className={analysisStyles.featureGrid} data-has-week={thisWeek.length > 0} data-has-feature={!!featured}>
            {featured && (
              <FeaturedAnalysis
                row={featured}
                logoUrl={meta[featured.symbol]?.logoUrl ?? null}
                locale={locale}
                t={t}
              />
            )}

            {/* YALNIZCA 1280 PİKSEL ÜSTÜNDE. Telefonda aynı satırlar 250
                piksel aşağıda tekrar geliyordu: bu panel haftanın analizlerini
                gösteriyor, sayfanın asıl tablosu ise varsayılan hâlinde
                (filtresiz, tarihe göre) tam olarak o satırlarla BAŞLIYOR.
                1024-1279 arasında da kapalı: üç kolon öne çıkan kartı ~480
                piksele sıkıştırıyordu (1101'de ölçüldü).

                `justify-between` KALKTI. Satırlar artan boşluğu aralarına
                paylaşıyordu — CLAUDE.md'nin yasakladığı esnetme. Artık taban
                beş satır basılıyor, sığan yedekleri FillList açıyor.

                Yaklaşan Bilançolar paneli her genişlikte kalıyor: o, bu
                sayfada başka hiçbir yerde olmayan veriyi (tarih, HBK
                beklentisi, takvime ekleme) taşıyor — tekrar değil. */}
            {thisWeek.length > 0 && (
              <Panel className={analysisStyles.weekPanel}>
                {/* Künye (haftanın analiz sayısı) başlığı yandaki panelle
                    aynı iki satıra getiriyor: iki başlık da 74 piksel, yani
                    iki listenin 52 piksellik satır çizgileri aynı hatta. */}
                <PanelHeader
                  title={t.analysis.thisWeekAnalyzed}
                  meta={`${weekAll.length} ${plural(weekAll.length, t.analysis.colCard, t.analysis.colCardMany)}`}
                  action={
                    <PanelLink href={filterHref("hafta")}>
                      {t.common.showAll}
                    </PanelLink>
                  }
                  className={analysisStyles.sideHeader}
                />
                <div className={analysisStyles.rows} data-fill-list>
                  {thisWeek.map((row, index) => {
                    const verdict = verdictOf(row.verdict);
                    const spare = index >= WEEK_BASE;
                    return (
                      <Link
                        key={`${row.symbol}-${row.period}`}
                        href={analysisHref(row.symbol, row.period)}
                        prefetch={false}
                        className={analysisStyles.weekRow}
                        hidden={spare || undefined}
                        data-fill={spare || undefined}
                        /* `hidden`ı FillList React dışında değiştiriyor (bkz. ana sayfa). */
                        suppressHydrationWarning
                      >
                        <LogoTile
                          symbol={row.symbol}
                          logoUrl={meta[row.symbol]?.logoUrl}
                          size="xs"
                        />
                        <span className="w-[46px] shrink-0 text-small font-bold text-strong">
                          {row.symbol}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-tiny text-body">
                          {row.periodLabel}
                        </span>
                        <span
                          className={cn(
                            "figure shrink-0 text-tiny font-bold",
                            verdictTextClass(verdict),
                          )}
                        >
                          {verdictLabel(verdict, t)} · {row.score}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            )}

          </div>
          {/* Sunucu durumu değişince yeniden bağlanır: etki her satırı taban
              durumuna döndürüp yeniden ölçer (istemci gezinmesi sayfayı
              yeniden bağlamıyor). */}
          <FillList key={`${sort}|${filter ?? ""}`} />

          {/* Bütün denetimler tablonun üstünde tek bir yerde: filtre çipleri
              sayfa başlığının içinde duruyordu ve on bir çip başlığı ikinci
              satıra itiyordu. Üçü de aynı listeyi daraltıyor, bir arada
              durmaları gerekiyordu. */}
          <section id="analysis-archive" className={analysisStyles.archive}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="display-ink display-ink-tight w-fit text-base font-bold">
                {t.analysis.listTitle}
              </h2>
              {/* Dar ekranda çipler kırılmak yerine kayar. */}
              <ScrollEdges className="no-scrollbar -mx-4 flex max-w-full gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <FilterChip href={filterHref(null)} active={!filter}>
                  {t.analysis.filterAll}
                </FilterChip>
                {/* Sektör çiplerinin kuralı bu ikisinde de: boş sonuç veren
                    çip basılmıyor. "Bu Hafta" son analiz 10 Eylül'deyken
                    ikinci sıradaki çipti ve her tıklamada boş ekrana,
                    kapakta 0/0/0'a götürüyordu. Doğrudan adres (yer imi)
                    boş durumu yine gösteriyor. */}
                {weekAll.length > 0 && (
                  <FilterChip
                    href={filterHref("hafta")}
                    active={filter === "hafta"}
                  >
                    {t.analysis.filterThisWeek}
                  </FilterChip>
                )}
                {session?.user && all.some((row) => watchSet.has(row.symbol)) && (
                  <FilterChip
                    href={filterHref("takip")}
                    active={filter === "takip"}
                  >
                    {t.analysis.filterWatchlist}
                  </FilterChip>
                )}
                {[...groups.values()].map((group) => (
                  <FilterChip
                    key={group.key}
                    href={filterHref(group.key)}
                    active={filter === group.key}
                  >
                    {sectorGroupLabel(group, locale)}
                  </FilterChip>
                ))}
              </ScrollEdges>
            </div>

            <QueryTransition label={t.common.loading}>
            {rows.length === 0 ? (
              <Panel>
                <EmptyState
                  scene="searching"
                  title={t.analysis.emptyFilter}
                  action={
                    <Link
                      href={filterHref(null)}
                      className="text-small font-semibold text-primary"
                    >
                      {t.earnings.clearFilter}
                    </Link>
                  }
                />
              </Panel>
            ) : (
              <AnalysisTable
                rows={tableRows}
                labels={analysisTableLabels(t)}
                highlightFirst
                toolbar={
                  <Segment>
                    <SegmentItem
                      href={sortHref("tarih")}
                      active={sort === "tarih"}
                    >
                      {t.analysis.sortDate}
                    </SegmentItem>
                    <SegmentItem
                      href={sortHref("skor")}
                      active={sort === "skor"}
                    >
                      {t.analysis.sortScore}
                    </SegmentItem>
                    <SegmentItem
                      href={sortHref("tepki")}
                      active={sort === "tepki"}
                    >
                      {t.analysis.sortReaction}
                    </SegmentItem>
                  </Segment>
                }
              />
            )}
            </QueryTransition>
          </section>

          {/* YAKLAŞAN BİLANÇOLAR — kartın boyuna gerilen, SIĞDIĞI KADAR
              satır açan bir zaman çizelgesi.

              Eski hâlinde "Takvime Git" panelin dibine itilmişti ve son
              satırla arasında ölçülmüş bir ölü bant kalıyordu: 1440'ta 75,
              1280'de 67, 1101'de 58 piksel. Bağlantı başlığa çıktı; boşluk
              esnetilmiyor, dolduruluyor: sunucu on satırlık havuzun ilk
              beşini açık, kalanını `hidden` basıyor, FillList kaçının
              sığdığını ölçüp o kadarını açıyor. Panel `contain: size` ile
              ızgara satırının boyuna katkı vermiyor (CSS'te gerekçesi), yani
              iki kolon her zaman aynı hatta bitiyor.

              Liste artık TARİH SIRASINDA. Piyasa değeri sırasıyla geliyordu
              ve tarih sütunu ileri geri akıyordu (20 Eki, 30 Eyl, 13 Eki…);
              seçim hâlâ en büyük şirketler, sıra zamana göre — künye ikisini
              birden söylüyor. */}
          <Panel className={analysisStyles.upcoming}>
            <PanelHeader
              title={t.analysis.upcomingEarnings}
              /* Künye SEÇİM KURALINI söylüyor ve kural veriden okunuyor:
                 oturum açık okuyucuda takip listesi piyasa değerinin
                 önüne geçiyor (getUpcomingEarnings `preferred`). On
                 takipli sembol aynı ay açıklıyorsa liste tamamen
                 takiptekilerden oluşuyor; "En Büyük Şirketler" o
                 okuyucuya yanlış bir kural söylerdi. */
              meta={
                upcoming.some((row) => watchSet.has(row.symbol))
                  ? t.analysis.upcomingOrderNoteWatch
                  : t.analysis.upcomingOrderNote
              }
              action={
                <PanelLink href="/bilancolar" className="gap-1">
                  {t.analysis.goToCalendar}
                  <ArrowUpRight size={12} weight="bold" aria-hidden />
                </PanelLink>
              }
              className={analysisStyles.sideHeader}
            />
            <div className={analysisStyles.rows} data-fill-list>
              {upcoming.length === 0 ? (
                <p className={analysisStyles.upcomingEmpty}>
                  {t.earnings.empty}
                </p>
              ) : (
                upcoming.map((row, index) => {
                  /* Taban SEÇİM sırasından (`rank`): görünen beş, en büyük
                     beş (takip listesi önde). Dizideki yerden seçildiğinde
                     tarih sıralaması onu en ERKEN beşe çeviriyordu ve
                     FillList hiçbir genişlikte yedek açmadığı için TSLA,
                     INTC, MA hiç görünmüyordu (ölçüldü, 390–1920). */
                  const spare = row.rank >= UPCOMING_BASE;
                  /* Soluk karo "aynı gün, devam" demek: tabanda bir önceki
                     TABAN satıra bakılıyor (aradaki gizli yedek
                     sayılmaz); yedek açılırsa hemen önündekiyle. Liste
                     tarih sıralı, yani aradan açılan yedek aynı günde. */
                  const previous = spare
                    ? upcoming[index - 1]
                    : upcoming.slice(0, index).filter((item) => item.rank < UPCOMING_BASE).at(-1);
                  const repeat = previous?.reportDate === row.reportDate;
                  const date = etDateParts(row.reportDate, locale);
                  const away = readerDayOffset(row.reportDate, null, locale);
                  const session = timingLabel(row.hour, t);
                  const optional = session !== null && away > NEAR_DAYS;
                  return (
                    /* Satır kutu, içindeki mutlak bağlantı yüzeyi kaplıyor —
                       takvim düğmesi kendi bağlantısını taşıdığı için iç içe
                       <a> olamaz. */
                    <div
                      key={row.id}
                      className={analysisStyles.upcomingRow}
                      hidden={spare || undefined}
                      data-fill={spare || undefined}
                      /* `hidden`ı FillList React dışında değiştiriyor (bkz. ana sayfa). */
                      suppressHydrationWarning
                      data-repeat={repeat || undefined}
                    >
                      <Link
                        href={`/hisse/${row.symbol}`}
                        prefetch={false}
                        aria-label={row.symbol}
                        className="absolute inset-0"
                      />
                      {/* TARİH KAROSU. Tarih satırın metnine gömülüydü
                          ("20 Eki · Kap. Sonrası") ve liste tarihe göre
                          sıralanınca asıl okunan sütun o oldu: gün sayısı
                          büyük, ay altında. Aynı gün arka arkaya gelirse
                          ikinci karo soluyor — tekrar değil, devam. */}
                      <span className={analysisStyles.dateTile} aria-hidden={repeat || undefined}>
                        <b className="numeral">{date.day}</b>
                        <span>{date.month}</span>
                      </span>
                      <LogoTile
                        symbol={row.symbol}
                        logoUrl={row.logoUrl}
                        size="xs"
                        className={analysisStyles.upcomingLogo}
                      />
                      <span className={analysisStyles.upcomingName}>
                        <b>{row.symbol}</b>
                        {row.name && <span>{row.name}</span>}
                        {watchSet.has(row.symbol) && (
                          <>
                            <Star size={11} weight="fill" aria-hidden />
                            <span className="sr-only">
                              {t.technical.trackedLabel}
                            </span>
                          </>
                        )}
                      </span>
                      {/* ÇIPLAK SAYI YOK. Yuvanın önünde tablonun
                          başlığındaki kısaltma duruyor ("HBK 0,45 $").
                          Beklenti yoksa yuva HİÇ basılmıyor; eskiden "—"
                          yazıyordu. Takip edilen satırda da sayı artık
                          kalıyor — yıldız ada taşındı. */}
                      {row.epsEstimate !== null && (
                        <span className={cn("figure", analysisStyles.upcomingEps)}>
                          <span>{t.earnings.epsEstimateShort}</span>{" "}
                          {formatPrice(row.epsEstimate, locale, {
                            currency: true,
                          })}
                        </span>
                      )}
                      {/* KIRPMA YOK, SARMA VAR. Seans penceresi satırın
                          asıl bilgisi (açılıştan önce mi, kapanıştan
                          sonra mı); kendi `span`ında ve bölünmez. Saati
                          bilinmeyen satırda (22 Eylül'de dörtte üç)
                          pencere hiç yazılmıyor — "Saat Belirsiz" her
                          satırı aynı gürültüyle doldururdu. Göreli gün
                          ise HER satırda: ikinci satırı olan ve olmayan
                          satırlar yan yana düzensiz duruyordu. */}
                      <span className={analysisStyles.upcomingWhen}>
                        {/* Uzak gün + bilinen seans: dar panelde göreli gün
                            düşüyor, seans kalıyor (CSS'te ölçüsü). */}
                        <span
                          data-today={away <= 0 || undefined}
                          data-optional={optional || undefined}
                        >
                          {relativeDayLabel(away, t.calendar)}
                        </span>
                        {session && (
                          <>
                            <span aria-hidden data-optional={optional || undefined}>
                              {" · "}
                            </span>
                            <span className="whitespace-nowrap">{session}</span>
                          </>
                        )}
                      </span>
                      <AddToCalendar
                        symbol={row.symbol}
                        date={row.reportDate}
                        label={t.earnings.addToCalendar}
                        compact
                        className={analysisStyles.upcomingCal}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </div>
      )}

      <p className="border-t border-line pt-3.5 text-tiny text-muted">
        {t.analysis.publishNote}
      </p>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["bilanco", "degerleme"]}
      />
    </MotionExperience>
  );
}

/**
 * Günün Analizi — üst sıranın geniş kartı.
 *
 * Üç mini ölçü tek satırda: gelir büyümesi, beklentiye göre HBK ve hisse
 * tepkisi. Üçü birlikte "iyi çeyrek ama hisse düştü" gibi kartın tek
 * cümlesinin anlattığı gerilimi sayıyla gösteriyor.
 *
 * KART BİR <a> DEĞİL, BİR <article>. Kartın tamamı tek bağlantıydı ve
 * erişilebilir adı kartın bütün metniydi: tarih, şirket, dört satırlık
 * manşet ve üç ölçü — yaklaşık dört yüz karakter tek bağlantı adı olarak
 * okunuyordu. Bağlantı artık şirket adında; `::after` ile kartın yüzeyini
 * kaplıyor, yani kartın her yeri hâlâ tıklanıyor ama adı kısa.
 *
 * "ANALİZİ OKU" ÜSTE ÇIKTI. Metnin altında kendi satırını tutuyordu ve tek
 * bir bağlantı için 16 + 32 + 24 = 72 piksel yükseklik harcıyordu
 * (1440'ta ölçüldü). Şimdi tarih satırının sağında bir hap; kartın
 * tamamı zaten bağlantı olduğu için hap bir DAVET, ayrı bir hedef değil
 * (`aria-hidden`, erişilebilir adı bağlantı taşıyor).
 *
 * SKOR SÜTUNU KALKTI. 119 × 283 piksellik bir sütun ve tam boy bir ayraç
 * vardı; halka o sütunun ortasında boş bir tonun içinde duruyordu. Karar
 * artık kimlik satırının sağında: şirket solda, puanı sağda — bir skor
 * tabelası gibi. Telefonda aynı düğüm ölçü ızgarasının ilk gözüne iniyor;
 * yer ızgara alanlarıyla değişiyor, halka DOM'da tek (çift halka ekran
 * okuyucuya kararı iki kez okuturdu).
 */
function FeaturedAnalysis({
  row,
  logoUrl,
  locale,
  t,
}: {
  row: AnalysisIndexRow;
  logoUrl: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const verdict = verdictOf(row.verdict);
  const session = timingLabel(row.timing, t);
  const figures: { label: string; value: string; tone: "up" | "down" | "flat" }[] = [];

  if (row.revenueYoyPct !== null) {
    const up = row.revenueYoyPct >= 0;
    figures.push({
      label: t.analysis.revenueGrowthYoy,
      value: formatPercent(row.revenueYoyPct, locale, 0),
      tone: up ? "up" : "down",
    });
  }
  if (row.epsSurprisePct !== null) {
    const up = row.epsSurprisePct >= 0;
    figures.push({
      label: t.analysis.epsSurprise,
      value: formatPercent(row.epsSurprisePct, locale, 0),
      tone: up ? "up" : "down",
    });
  }
  if (row.reactionPct !== null) {
    const up = row.reactionPct >= 0;
    figures.push({
      label: t.analysis.stockReaction,
      value: formatPercent(row.reactionPct, locale, 1),
      tone: up ? "up" : "down",
    });
  }

  return (
    <article className={analysisStyles.feature}>
      <div className={analysisStyles.featureMeta}>
        <span className={analysisStyles.featureDate}>
          {formatEtDateLong(row.reportDate, locale)}
          {session && (
            <>
              <span aria-hidden> · </span>
              <span className="whitespace-nowrap">{session}</span>
            </>
          )}
        </span>
        <span className={analysisStyles.featureRead} aria-hidden>
          {t.dayFlow.readAnalysis}
          <ArrowUpRight size={14} weight="bold" />
        </span>
      </div>

      <div className={analysisStyles.featureIdentity}>
        <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="lg" />
        <div className="min-w-0">
          {/* TEK SATIRA SIKIŞTIRMAK YERİNE İKİ SATIR. `truncate` idi ve
              390 pikselde 258 piksellik yere 262 piksellik metin
              giriyordu: dört piksel yüzünden "2. Çeyrek 2026" ekranda
              "2. Çeyrek 20…" oluyor, yani kartın en önemli ikinci
              bilgisi — hangi çeyrek — kayboluyordu. Ad sarıyor; künye
              satırı da sarıyor, dönem bölünmüyor. Sektör bir dönem kırpılıp
              tam hâli `title`a konmuştu ama kartı kaplayan bağlantı
              (`.featureLink::after`) imleci hiç o `span`e ulaştırmıyordu;
              ipucu açılamayan bir ipucuydu (ölçüldü, 126 ölçümün hepsinde). */}
          <h2 className={analysisStyles.featureCompany}>
            <Link
              href={analysisHref(row.symbol, row.period)}
              prefetch={false}
              className={analysisStyles.featureLink}
              aria-label={t.analysis.openAnalysisAria.replace(
                "{company}",
                row.company,
              )}
            >
              {row.company}
            </Link>
          </h2>
          <p className={analysisStyles.featureMetaLine}>
            <span className={analysisStyles.featurePeriod}>
              {row.symbol} · {row.periodLabel}
            </span>
            {row.sector && (
              <span className={analysisStyles.featureSector}>
                <span aria-hidden> · </span>
                {row.sector}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className={analysisStyles.featureVerdict}>
        <ScoreRing score={row.score} verdict={verdict} size={64} showDenominator />
        <span className={analysisStyles.featureVerdictText}>
          <span>{t.analysis.verdictLabel}</span>
          <b className={verdictTextClass(verdict)}>{verdictLabel(verdict, t)}</b>
        </span>
      </div>

      <p className={analysisStyles.featureHeadline}>{row.headline}</p>

      {figures.length > 0 && (
        <dl className={analysisStyles.featureFigures}>
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt>{figure.label}</dt>
              <dd className={cn("numeral", figure.tone === "up" ? "text-up" : "text-down")}>
                {figure.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
