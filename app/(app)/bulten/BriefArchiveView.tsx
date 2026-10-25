import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { Suspense } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { BriefBody } from "@/components/today/BriefBody";
import { BriefPosterLink } from "@/components/day-poster/BriefPosterLink";
import { PageShare } from "@/components/article/PageShare";
import {
  EmptyState,
  PageHeader,
  Panel,
  Segment,
  SegmentItem,
  Skeleton,
} from "@/components/ui/primitives";
import { getBriefArchive, getLatestBrief, weekAnchor } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateCompact, formatEtDateLong } from "@/lib/utils";
import { briefHref, briefSummary, type BriefPeriod } from "@/lib/brief";
import type { DailyBriefRow } from "@/lib/schema";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { TELEGRAM_URL } from "@/lib/site";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getDailyChart } from "@/lib/daily-chart-data";
import { BriefLedger, ledgerRefs } from "@/components/today/BriefLedger";
import { LedgerLinker } from "@/components/today/LedgerLinker";
import { getBriefLedger } from "@/lib/brief-ledger-data";
import { dailyChartHref } from "@/lib/daily-chart";
import { ledgerWindow } from "@/lib/brief-ledger";

/**
 * Bülten arşivi — solda seçili günün/haftanın tam metni, sağda tarih listesi.
 *
 * Üç rota bu görünümü paylaşıyor: `/bulten` (dönemin en yenisi, `?tur=haftalik`
 * haftalığa geçer), `/bulten/[tarih]` ve `/bulten/haftalik/[tarih]` (tek bir
 * sayı). Seçim bir dönem `?tarih=` sorgusuydu — arşivde gezinirken liste
 * yerinde kalsın diye — ama o adresin canonical'ı `/bulten` olduğu için hiçbir
 * sayı arama motorunda kendi başına var olamıyordu. Liste yine yerinde kalıyor:
 * üç rota aynı düzeni basıyor, gezinme yalnızca okuma panelini değiştiriyor.
 *
 * HIZ: sekme değişimi eskiden takılıyordu, iki nedenle. Birincisi sorgular
 * ZİNCİRLİYDİ — önce arşiv listesi çekiliyor, ilk satırından tarih okunuyor,
 * sonra o tarihin metni çekiliyordu; iki tam gidiş-dönüş arka arkaya.
 * `getLatestBrief` bu zinciri kırdı, ikisi artık paralel gidiyor. İkincisi
 * sayfanın tamamı sunucuda bekleniyordu: başlık ve sekmeler bile veri
 * gelmeden boyanmıyordu. Artık kabuk anında geliyor, içerik `<Suspense>` ile
 * akıyor ve `key` dönem/tarih değiştiğinde iskeleti hemen gösteriyor.
 */

/**
 * `issue` verilirse o sayı gösterilir (sayı sayfası, `/bulten/[tarih]`);
 * verilmezse dönemin en yenisi (`/bulten`). Seçim artık adreste bir YOL:
 * arşivdeki her satır sayının kalıcı adresine gidiyor.
 */
export function BriefArchiveView({
  period,
  issue,
  locale,
  t,
}: {
  period: BriefPeriod;
  issue?: DailyBriefRow;
  locale: Locale;
  t: Dictionary;
}) {
  const tabHref = (p: BriefPeriod) => (p === "weekly" ? "/bulten?tur=haftalik" : "/bulten");

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      {/* Kabuk veri beklemez: sekmeler hemen boyanır, tıklama anında tepki
          verir ve altındaki içerik akarak gelir. */}
      <PageHeader
        title={period === "weekly" ? t.brief.weeklyTitle : t.brief.title}
        subtitle={
          period === "weekly" ? t.brief.weeklySubtitle : t.brief.subtitle
        }
        action={
          <Segment>
            <SegmentItem
              href={tabHref("daily")}
              active={period === "daily"}
            >
              {t.brief.periodDaily}
            </SegmentItem>
            <SegmentItem
              href={tabHref("weekly")}
              active={period === "weekly"}
            >
              {t.brief.periodWeekly}
            </SegmentItem>
          </Segment>
        }
      />

      <Suspense
        key={`${period}:${issue?.briefDate ?? ""}`}
        fallback={<ArchiveSkeleton band={ledgerExpected(issue?.briefDate, period)} />}
      >
        <ArchiveBoard period={period} issue={issue} locale={locale} t={t} />
      </Suspense>
    </MotionExperience>
  );
}

async function ArchiveBoard({
  period,
  issue,
  locale,
  t,
}: {
  period: BriefPeriod;
  issue?: DailyBriefRow;
  locale: Locale;
  t: Dictionary;
}) {
  /* Paralel: liste ile metin birbirini beklemiyor. Sayı sayfası kaydı
     zaten getirdi; arşiv ekranı dönemin en yenisini doğrudan çekiyor. */
  const [archive, brief] = await Promise.all([
    getBriefArchive(locale, period),
    issue ?? getLatestBrief(locale, period),
  ]);
  /* GÜNÜN GRAFİĞİ BAĞLANTISI (24 Ekim): günlük sayının günü için grafik
     yazıldıysa metnin altında. Bülten 16:10'da bugünü, grafik ertesi sabah
     dünkü kapanışı anlatıyor; bağlantı yalnız AYNI GÜNÜN grafiği varsa. */
  /* KAYIT DEFTERİ (25 Ekim görsel zirve): sayının anlattığı tamamlanmış
     seansın (haftalıkta haftanın) bandı — gerekçe lib/brief-ledger.ts.
     Grafikle paralel; bant okunamazsa yalnız bant kalkar. */
  const [dayChart, ledger] = await Promise.all([
    period === "daily" && brief ? getDailyChart(brief.briefDate, locale) : null,
    brief ? getBriefLedger(brief.briefDate, period, brief.bodyMd, true) : null,
  ]);

  if (archive.length === 0) {
    return (
      <Panel>
        <EmptyState title={t.brief.noArchive} hint={t.brief.emptyHint} scene="press" />
      </Panel>
    );
  }

  const selectedDate = brief?.briefDate ?? archive[0]?.briefDate ?? null;

  const today = todayEt();
  const currentAnchor = period === "weekly" ? weekAnchor(today) : today;

  return (
    <LedgerLinker className="grid gap-6">
    {ledger && <BriefLedger data={ledger} locale={locale} t={t} />}
    {/* KOLON TAM GENİŞLİKTE, DARALTILMIYOR.
       Ölçü sınırı iki kez denendi ve ikisi de geri alındı; ikisinin de
       gerekçesi burada dursun ki üçüncü bir deneme yapılmasın.
       Önce paragrafa `max-w-[62ch]` konmuştu: kolon 1050 piksele açılıyor,
       metin 530'da kalıyor ve panelin sağ yarısı boş duruyordu — kutunun
       içinde yarım kalmış bir metin.
       Sonra kolonun kendisi 720'ye çekilip ortalandı (mercek ve rehber
       yazılarının ölçüsü). Bu sefer boşluk panelin içinden çıkıp sayfanın
       iki yanına geçti: okuma paneli ve arşiv ortada bir ada gibi duruyor,
       üstündeki tam genişlik başlıkla hizasız kalıyordu.

       ÜÇÜNCÜ YOL: FARKI ARŞİV ALIYOR (23 Eylül). Tam genişlikte gövde 14
       puntoda satır başına ~130 harf taşıyordu. Makale paneli 50rem'de
       tavan yapıyor ve metin kabı yine dolduruyor (panelin içinde boş yarı
       yok); aradaki fark sayfanın kenarına değil ARŞİV kolonuna gidiyor
       (1440'ta 300 → ~500 piksel). Arşiv o genişlikte her bültenin ilk
       cümlesini de gösteriyor, yani genişleyen kolon boş değil, bir okuma
       dizini. Sayfa yine iki kenarı dolu; gövde 18 puntoda ~90 harf.

       42rem (25 Ekim görsel zirve). ~90 harf rahat ölçünün (50–75) hâlâ
       üstündeydi. Aynı üçüncü yol bir basamak daha: panel 42rem'de tavan
       yapıyor, fark yine arşive gidiyor; gövde 18 puntoda satır başına ~75
       harf (ölçüm commit'te). Panel içinde boş yarı yok, kenarlar dolu. */}
    <div className={`${polish.bulletinGrid} grid gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(300px,1fr)]`}>
      {/* ---- Seçili kayıt ---- */}
      <article className={`${polish.bulletinArticle} order-2 border border-primary-faint p-5 sm:p-8 lg:order-1`} data-motion-article>
        {brief ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* Dönem künyesi ("Günlük"/"Haftalık") burada duruyordu; bölüm
                  künyeleri 9 Ekim 2026'da kalktı. Dönem sayfa başlığında ve
                  sekmede yazıyor. */}
              <span className="text-small text-body">
                {period === "weekly"
                  ? t.brief.weeklyRange
                      .replace(
                        "{start}",
                        formatEtDateCompact(brief.briefDate, locale),
                      )
                      .replace(
                        "{end}",
                        formatEtDateCompact(
                          addEtDays(brief.briefDate, 4),
                          locale,
                        ),
                      )
                  : formatEtDateLong(brief.briefDate, locale)}
              </span>
              {brief.briefDate === currentAnchor && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-nano font-bold text-on-primary">
                  {(period === "weekly"
                    ? t.brief.thisWeek
                    : t.brief.today
                  ).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
                </span>
              )}
              <span className="ml-auto text-tiny text-muted">
                {t.brief.writtenBy}:{" "}
                {brief.generatedBy === "claude"
                  ? t.brief.byClaude
                  : t.brief.byRules}
              </span>
              {/* PAYLAŞ (30 Eylül). Adres sayının KALICI yolu (`briefHref`):
                  paylaşılan bağlantı "bugünün bülteni" değil, bu sayı. */}
              <PageShare
                path={briefHref(brief.briefDate, period)}
                title={brief.headline}
                locale={locale}
                t={t}
                align="right"
                className="-mr-2"
              />
            </div>

            {/* Haftalık kaydın kurgusu başlıktan önce söylenir: kayıt biten
                haftanın adına açılıyor ama önümüzdeki haftanın takvimini de
                taşıyor. Bu satır olmadan okuyucu iki bölümün neden yan yana
                durduğunu anlamıyordu. */}
            {period === "weekly" && (
              <p className="mt-3 text-tiny font-semibold text-primary">
                {t.brief.weeklyFrame}
              </p>
            )}

            {/* Çeviri henüz yoksa orijinal gösterilir — ama bunu söyleyerek. */}
            {brief.locale !== locale && (
              <p className="mt-3 w-fit rounded-full border border-line bg-surface-elevated px-3.5 py-1.5 text-small text-muted">
                {t.brief.fallbackNote}
              </p>
            )}

            {/* Başlık ve gövde kendi dilini söylüyor — gerekçe mercek
                sayfasında; çevirisi olmayan bülten orijinal diliyle
                gösteriliyor. */}
            <div lang={brief.locale}>
              <h2 className="mt-4 text-title font-bold leading-tight tracking-[-0.03em] text-strong sm:text-heading">
                {brief.headline}
              </h2>

              <BriefBody
                markdown={brief.bodyMd}
                collapsible={false}
                size="page"
                refs={ledger ? ledgerRefs(ledger) : undefined}
                tocLabel={t.briefLedger.tocLabel}
              />
            </div>

            {/* GÜNÜN POSTERİ (24 Ekim): günlük sayının günü kapandıysa o
                seansın posteri — gerekçe BriefPosterLink.tsx. */}
            {period === "daily" && (
              <Suspense fallback={null}>
                <BriefPosterLink date={brief.briefDate} t={t} />
              </Suspense>
            )}

            {dayChart && (
              <Link
                href={dailyChartHref(dayChart.row.chartDate)}
                className="mt-6 flex min-h-11 w-fit items-center gap-2 border-t border-primary-faint pt-3 text-small font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                {t.dailyChart.briefLink}: <span className="font-normal text-body">{dayChart.row.title}</span>
                <ArrowRight size={14} weight="bold" aria-hidden />
              </Link>
            )}

            {/* Takvim tahmin değildir — "bu hafta" bölümünün sınırı. */}
            {period === "weekly" && (
              <p className="mt-6 border-t border-primary-faint pt-3 text-tiny leading-relaxed text-muted">
                {t.brief.weeklyNotForecast}
              </p>
            )}

            {/* Telegram kanalı (24 Ekim): bülten her işlem günü açılıştan
                önce kanala da düşüyor. Künye panelin içinde, hairline'la —
                yeni kutu açılmaz. Adres tanımlı değilse hiç basılmaz
                (lib/site.ts → TELEGRAM_URL). */}
            {TELEGRAM_URL && (
              <p className="mt-6 border-t border-primary-faint pt-3 text-small leading-relaxed text-muted">
                {t.telegram.channelHint}{" "}
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-44 inline-flex items-center gap-1 font-semibold text-primary"
                >
                  {t.telegram.channelLink}
                  <ArrowUpRight size={12} weight="bold" aria-hidden />
                </a>
              </p>
            )}
          </>
        ) : (
          <EmptyState title={t.brief.empty} hint={t.brief.emptyHint} />
        )}
      </article>

      {/* ---- Arşiv listesi ----
           MOBİLDE ÜSTTE VE YATAY. Geniş ekranda arşiv sağdaki kolonda,
           bültenle birlikte görünüyor. Telefonda ise tek kolon var ve arşiv
           bültenin ALTINDA kalıyordu: gövde ekranlarca uzun olduğu için
           sayfayı açan okuyucu yalnızca o günün kaydını görüyor, sitede
           başka bülten olduğunu hiç fark etmiyordu.
           İki kopya basmak yerine aynı liste iki düzende çiziliyor: dar
           ekranda kenardan kenara kayan bir şerit, geniş ekranda dikey
           kolon. `order` yalnızca tek kolonda etkili — ızgara iki kolona
           geçince kolon sırası zaten sabit. */}
      <Panel className={`${polish.archive} order-1 lg:order-2`}>
        <div className="px-4 py-4 sm:px-5">
          <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
            {t.brief.archiveTitle}
          </h2>
        </div>
        <ScrollEdges as="ul" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 sm:px-5 lg:max-h-[70dvh] lg:flex-col lg:gap-0 lg:overflow-x-visible lg:overflow-y-auto lg:px-0 lg:pb-0">
          {archive.map((row) => {
            const active = row.briefDate === selectedDate;
            return (
              <li key={row.briefDate} className="w-[15.5rem] shrink-0 lg:w-auto">
                <Link
                  href={briefHref(row.briefDate, period)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "block h-full rounded-lg border border-line px-3 py-2.5 transition-colors lg:h-auto lg:rounded-none lg:border-0 lg:border-t lg:py-3 lg:px-5",
                    active ? "bg-primary-wash" : "hover:bg-primary-tint",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-2 text-tiny",
                      /* Seçili satırın zemini `--primary-wash`: `--primary`
                         orada 11 pikselde 4,26'ya iniyor (gereken 4,5).
                         Mürekkep tonu aynı aileden, 5,4. */
                      active ? "text-primary-ink" : "text-muted",
                    )}
                  >
                    <span className="numeral font-semibold">
                      {period === "weekly"
                        ? t.brief.weeklyRange
                            .replace(
                              "{start}",
                              formatEtDateCompact(row.briefDate, locale),
                            )
                            .replace(
                              "{end}",
                              formatEtDateCompact(
                                addEtDays(row.briefDate, 4),
                                locale,
                              ),
                            )
                        : formatEtDateLong(row.briefDate, locale)}
                    </span>
                    {row.briefDate === currentAnchor && (
                      <span className="font-bold">
                        ·{" "}
                        {period === "weekly" ? t.brief.thisWeek : t.brief.today}
                      </span>
                    )}
                    {/* Kayıt okunan dilde değilse dili rozetle söylenir. */}
                    {row.locale !== locale && (
                      <span className="plate ml-auto text-nano">
                        {row.locale.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "mt-1 line-clamp-2 block text-base leading-snug",
                      active
                        ? "font-semibold text-strong"
                        : "font-medium text-body",
                    )}
                  >
                    {row.headline}
                  </span>
                  {/* İlk cümle yalnızca geniş kolonda: telefonda arşiv
                      yatay bir şerit ve kart iki satırlık başlıkla doluyor. */}
                  {row.lead && (
                    <span className="mt-1.5 hidden text-small leading-relaxed text-muted lg:line-clamp-2">
                      {briefSummary(row.lead)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ScrollEdges>
      </Panel>
    </div>
    </LedgerLinker>
  );
}

/** Sekme değişiminde anında görünen iskelet — boş ekran yerine yapı. */
/**
 * Bülten arşivinin yer tutucusu.
 *
 * İki kolon da 420 piksel ayırıyordu; gerçek içerik geniş ekranda 1094,
 * telefonda 2369 piksel. Bülten metni her gün değiştiği için sabit bir
 * yükseklik zaten eskiyecekti — ölçüldü, sayfanın CLS'i 0,141 çıkıyordu.
 *
 * Çözüm ölçünün kendi tanımından geliyor: düzen kayması yalnızca GÖRÜNÜR
 * ALANDAKİ oynamayı sayıyor. Yer tutucu bir ekran boyu kadar yer ayırınca
 * katlamanın altında kalan metnin uzayıp kısalması ekrandaki hiçbir şeyi
 * itmiyor, dolayısıyla metnin uzunluğu ne olursa olsun kayma olmuyor.
 * `svh` seçildi: mobil tarayıcıların adres çubuğu açıkken/kapalıyken
 * değişen `vh` değeri yer tutucunun boyunu oynatıyordu.
 */
/**
 * İskelette bandın yeri ayrılacak mı. Bant, sayının anlattığı dönem
 * kapandıktan sonra basılıyor (`ledgerComplete`); son seansı henüz bugün ya
 * da ileride olan sayı (bu haftanın haftalığı) bandsız gelir. Tatil
 * listesi istemeden, takvim günüyle bakılıyor — iskelet bir tahmin; tarihi
 * bilinmeyen "en yeni" sayıda bant var sayılıyor (hemen her gün öyle).
 */
function ledgerExpected(briefDate: string | undefined, period: BriefPeriod): boolean {
  if (!briefDate) return true;
  const window = ledgerWindow(briefDate, period, []);
  return window !== null && window.session < todayEt();
}

function ArchiveSkeleton({ band }: { band: boolean }) {
  return (
    <div className="grid gap-6">
      {/* Kayıt Defteri'nin yeri — gerçek bant 390'da 430–468 (telefonda
          ayrıntı katlı), 1440'ta 669–702 piksel (25 Ekim son düzeltme
          ölçümü, günlük ve haftalık). Bant gelmeyecekse yer ayrılmıyor:
          940 piksellik boş blok bandsız sayıda metni ikinci ekrana
          itiyordu. */}
      {band && <Skeleton className="h-[440px] w-full rounded-(--radius-xl) sm:h-[640px]" />}
      <div className={`${polish.bulletinGrid} grid gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(300px,1fr)]`}>
        <Skeleton className="h-[80svh] w-full rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-(--radius-xl) lg:h-[80svh]" />
      </div>
    </div>
  );
}
