import { Fragment } from "react";
import { ArrowDownRight, ArrowRight, CalendarBlank, Star } from "@phosphor-icons/react/dist/ssr";
import { MorphTarget } from "@/components/motion/Morph";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { LogoTile } from "@/components/ui/primitives";
import { MetricNote } from "@/components/earnings/MetricCards";
import { PriceRail, type RailMark } from "@/components/ui/PriceRail";
import styles from "@/components/earnings/EarningsReport.module.css";
import { toggleSymbolFavoriteForm } from "@/app/actions/watchlist";
import type { AnalysisIndexRow, SymbolMeta } from "@/lib/data";
import type { Quote } from "@/lib/providers/types";
import type { Dictionary, Locale } from "@/lib/i18n";
import { analysisHref, type VerdictKey } from "@/lib/analysis";
import type { EarningsAnalysisRow } from "@/lib/schema";
import {
  cn,
  formatEtDateCompact,
  formatEtDateLong,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  SIGN_GAP,
  tieCurrency,
  tieFigures,
  titleCaseLabel,
} from "@/lib/utils";
import { FactRail } from "./FactRail";
import { VerdictStrip } from "./VerdictStrip";
import { PLATE_LABEL, type Upside } from "./shared";

/**
 * KAPAK ETİKETİ: AD ÜSTTE, AYRINTI ALTTA (30 Eylül, sahibinin ekran
 * görüntüsü). Etiketleri rutin yazıyor ve kapakta tek satırda duruyordu:
 * "GAAP HBK (İade Hariç 6,60 $)" 390'da iki satıra kırılıyor, okuyucu
 * kısaltmayı çözmek zorunda kalıyordu ("GAAP HBK falan ne"). Veriye
 * dokunulmuyor, yalnızca gösterim bölünüyor:
 *   - sondaki parantez alt satıra iniyor ("Gelir" / "4. Çeyrek"),
 *   - muhasebe niteleyicisi (GAAP, Non-GAAP, Düzeltilmiş) alt satıra geçiyor,
 *   - Türkçede "HBK" açık adıyla yazılıyor ("Hisse Başı Kâr").
 * Sonuç: "Hisse Başı Kâr" · küçük satırda "GAAP · İade Hariç 6,60 $".
 */
const LABEL_QUALIFIER = /^(Non-GAAP|GAAP|Düzeltilmiş|Adjusted)\s+/i;
function coverLabel(label: string, locale: string): { main: string; sub: string | null } {
  let main = label.trim();
  const parts: string[] = [];
  const paren = /\s*\(([^)]+)\)\s*$/.exec(main);
  if (paren) main = main.slice(0, paren.index).trim();
  const qualifier = LABEL_QUALIFIER.exec(main);
  if (qualifier) {
    parts.push(qualifier[1]);
    main = main.slice(qualifier[0].length).trim();
  }
  if (paren) parts.push(paren[1].trim());
  if (locale === "tr") main = main.replace(/\bHBK\b/g, "Hisse Başı Kâr");
  return { main: main || label, sub: parts.length > 0 ? parts.join(" · ") : null };
}

/** Bu uzunluğun üstündeki şirket adı bir kademe küçük manşetle yazılır. */
const LONG_NAME_CHARS = 24;

type Highlight = NonNullable<EarningsAnalysisRow["highlights"]>[number];
type RevenueBar = NonNullable<EarningsAnalysisRow["quarterlyRevenue"]>[number];

/**
 * Kapak — kimlik, "şu an", çeyreğin iki öncü sonucu, görüş şeridi, fiyat
 * merdiveni ve künye rayı.
 *
 * Sayfa dosyasından olduğu gibi taşındı (panel bölmesi): hesapların hepsi
 * sayfada kalıyor, çünkü aynı değerler yapışkan çubukta ve alt panellerde
 * de okunuyor (CLAUDE.md "Veri dürüstlüğü" 3 — aynı sayı tek kaynaktan).
 * Bileşen yalnızca çiziyor.
 */
export function ReportCover({
  row,
  symbol,
  locale,
  t,
  signedIn,
  watched,
  symbolMeta,
  newerAnalysis,
  nextReport,
  nextReportText,
  nextPeriodReported,
  langNote,
  live,
  priceLabel,
  liveText,
  sinceReportPct,
  sinceReportText,
  coverMetrics,
  coverRevenue,
  coverRevenueMax,
  coverGaps,
  revenueScale,
  revenueUnit,
  verdict,
  upside,
  targetText,
  closeText,
  ladderMarks,
  marketCap,
  marketCapNote,
  peRatio,
  epsTtm,
  pegRatio,
  netMarginPct,
}: {
  row: EarningsAnalysisRow;
  symbol: string;
  locale: Locale;
  t: Dictionary;
  signedIn: boolean;
  watched: boolean;
  symbolMeta: SymbolMeta | undefined;
  newerAnalysis: AnalysisIndexRow | null;
  nextReport: { date: string; hour: string | null } | null;
  nextReportText: string | null;
  nextPeriodReported: boolean;
  langNote: string | null;
  live: { quote: Quote; stale?: boolean } | null;
  priceLabel: string | null;
  liveText: string | null;
  sinceReportPct: number | null;
  sinceReportText: string | null;
  coverMetrics: Highlight[];
  coverRevenue: RevenueBar[];
  coverRevenueMax: number;
  coverGaps: boolean[];
  revenueScale: number;
  revenueUnit: string;
  verdict: VerdictKey;
  upside: Upside | null;
  targetText: string | null;
  closeText: string | null;
  ladderMarks: RailMark[];
  marketCap: number | null;
  marketCapNote: string;
  peRatio: number | null;
  epsTtm: number | null;
  pegRatio: number | null;
  netMarginPct: number | null;
}) {
  return (
    <>
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
              data-morph-stage
            >
              {/* Telefonda 44 piksel: 56'lık karo kimlik satırını görüş
                  şeridini ilk ekrandan itecek kadar uzatıyordu. */}
              {/* Listeden gelindiyse logo tıklanan satırdan buraya uçuyor
                  (components/motion/Morph). */}
              <MorphTarget morphKey={`logo:${symbol}`}>
                <LogoTile
                  symbol={symbol}
                  logoUrl={symbolMeta?.logoUrl}
                  size="xl"
                  /* 56 → 72 (26 Eylül, "logo bir tık büyük"): şirket adı 60
                     piksellik bir display başlık ve 56'lık karo onun yanında
                     küçük bir işaret gibi duruyordu. */
                  className="size-[72px] rounded-[18px] max-sm:size-12 max-sm:rounded-xl"
                />
              </MorphTarget>
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
          {(live || signedIn) && (
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
              <div className={styles.liveReading}>
                <span className={cn(PLATE_LABEL, "text-primary")}>
                  {priceLabel}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2.5 sm:mt-1.5 sm:justify-end">
                  <span className={cn(styles.liveValue, "figure font-bold leading-none tracking-[-0.04em] text-strong")}>
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

              {signedIn && (
                <form action={toggleSymbolFavoriteForm}>
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
                    {(() => {
                      const label = coverLabel(metric.label, locale);
                      return (
                        <dt>
                          {tieFigures(label.main)}
                          {label.sub && <small className={styles.coverLabelSub}>{tieFigures(label.sub)}</small>}
                        </dt>
                      );
                    })()}
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
        <div className={styles.assessment}>
        <VerdictStrip
          row={row}
          verdict={verdict}
          upside={upside}
          targetText={targetText}
          locale={locale}
          t={t}
        />
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
        </div>
      </header>
    </>
  );
}
