import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import {
  DataError,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  TimingChip,
  LogoTile,
} from "@/components/ui/primitives";
import { getAnalysisBadges, getEarningsBetweenResult, getHolidays, getSymbolNames } from "@/lib/data";
import { isTradingDay, nextTradingDay, todayEt } from "@/lib/market-hours";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import { ListSkeleton } from "@/components/today/home/ListSkeleton";

/** Başlıksız iskelet — panelin kendi başlığı bileşenin içinde. */
export function EarningsTodaySkeleton({ t }: { t: Dictionary }) {
  return (
    <Panel>
      <PanelHeader
        title={t.today.earningsToday}
        tone="title"
        action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
      />
      <ListSkeleton rows={4} />
    </Panel>
  );
}

/**
 * Bugün bilanço açıklayanlar.
 *
 * PANELİ BİLEŞEN BASIYOR, sayfa değil: başlığın ortasındaki boşluğa listenin
 * BOYU geliyor ("8 şirket") ve o sayı ancak sorgu döndükten sonra biliniyor.
 * Başlık dışarıda, Suspense'in üstünde kalsaydı sayıya erişemezdi.
 */
export async function EarningsToday({ locale, t }: { locale: Locale; t: Dictionary }) {
  /* HAFTA SONU SIRADAKİ İŞLEM GÜNÜ (3 Ekim). Panel cumartesi ve pazar
     "Bu aralıkta bilanço açıklaması yok" diyordu — doğru ama işe yaramaz:
     okuyucunun hafta sonu sorduğu soru "pazartesi kim açıklıyor". İşlem
     günü olmayan bir günde (hafta sonu, tam tatil) liste sıradaki işlem
     gününün listesi ve başlık o günün adını taşıyor ("Pazartesi Bilanço
     Açıklayanlar"); işlem gününde her şey eskisi gibi bugün. */
  const holidays = await getHolidays();
  const calendarToday = todayEt();
  const today = isTradingDay(calendarToday, holidays) ? calendarToday : nextTradingDay(calendarToday, holidays);
  const title =
    today === calendarToday
      ? t.today.earningsToday
      : t.today.earningsOn.replace(
          "{day}",
          new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { weekday: "long", timeZone: "UTC" }).format(
            new Date(`${today}T12:00:00Z`),
          ),
        );
  const result = await getEarningsBetweenResult(today, today);

  /* OKUNAMADI ≠ BOŞ (14 Ekim). `getEarningsBetween` hatayı `[]` olarak
     yutuyordu ve panel veritabanı düştüğünde "Bu aralıkta bilanço
     açıklaması yok" diyordu: yerelde, 14 Ekim'de BAC, MS ve BLK
     açıklarken ölçüldü. Sonuç tipli okuma (lib/data.ts) iki durumu
     ayırıyor; hata dalı boşluk iddia etmiyor. */
  if (!result.ok) {
    return (
      <Panel>
        <PanelHeader
          title={title}
          tone="title"
          action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
        />
        <DataError className="py-6" message={t.data.failed} hint={t.today.calendarFailedHint} />
      </Panel>
    );
  }
  const rows = result.rows;

  if (rows.length === 0) {
    return (
      <Panel>
        <PanelHeader
          title={title}
          tone="title"
          action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
        />
        <EmptyState compact title={t.earnings.empty} />
      </Panel>
    );
  }

  const names = await getSymbolNames(rows.map((row) => row.symbol));

  /* Beş satır, PİYASA DEĞERİNE göre. Sağlayıcı takvimi alfabetik döndürüyor
     ve liste "APC · ATI · ATII · ATLC" diye başlıyordu: bugünün en büyük
     bilançosu 400 satır aşağıdaydı. Takvim ekranı zaten aynı sıralamayı
     kullanıyor.
     SEKİZDEN BEŞE. Panel ana sayfanın ortasında bir ÖZET; sekiz satır onu
     telefonda tek başına bir ekran boyu yapıyor ve altındaki bölümleri
     aşağı itiyordu. Kırpılan geri kalan zaten künyede sayıyla ("43 şirketin
     5 tanesi") ve "Tümünü Gör" ile duruyor. */
  const shown = [...rows]
    .sort(
      (a, b) =>
        (names[b.symbol]?.marketCap ?? 0) - (names[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 5);

  const badges = await getAnalysisBadges(
    shown.map((row) => row.symbol),
    locale,
    { from: today, to: today },
  );

  const hourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel>
      <PanelHeader
        title={title}
        /* PLAKA BAŞLIK — PANOdaki öteki VERİ panelleriyle aynı aile.
           Bu panel başlığın büyük (`title`) tonundaydı ve hemen üstündeki
           "Bugünün Takvimi" ile "Haftaya Bakış" plakayken yan yana iki ayrı
           başlık ailesi okunuyordu. Kural: sitenin KENDİ YAZDIĞI içerik
           (mercek, bilanço analizi, bülten) büyük başlık alıyor, piyasa
           verisi panelleri plaka. Bugün açıklayanlar bir takvim listesi. */
        tone="title"
        /* SAYAÇ YALNIZCA LİSTE KIRPILDIĞINDA. İki sayıyı da söylüyor
           ("47 şirketin 8 tanesi") çünkü önce yalnızca toplam yazıyordu ve
           altında sekiz satır duruyordu: okuyucu ya kırpıldığını fark
           etmiyor ya da sayıyı hatalı sanıyordu. Ama kırpma yoksa sayaç
           "6 şirketin 6 tanesi" diyor — hiçbir şey söylemeyen bir cümle.
           Aynı kalıp /mercek arşivinde de var. */
        meta={
          rows.length > shown.length
            ? t.today.earningsCount
                .replace("{total}", String(rows.length))
                .replace("{n}", String(shown.length))
            : undefined
        }
        action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
      />
      {/* ORTAK SÜTUNLAR, İÇERİKTEN ÖLÇÜLÜ (30 Ekim). Her satır kendi
          ızgarasıydı ve rozet sütunu sabit 7,5rem'di: "TUT · 63 · Analiz →"
          oraya sığmıyor, ok hapın kenarına yapışıyordu. Sabit genişlik ya
          taşırır ya boşluk bırakır. Artık ızgara listede, satırlar
          `subgrid` ile onun sütunlarını paylaşıyor: rozet sütunu en geniş
          rozet kadar (`max-content`) ve beş satırda aynı hatta biter.
          EPS sütunu da `max-content`: subgrid'de satırın yan dolgusu uç
          sütunlardan düşüyor ve sabit 5,5rem'de "EPS Beklentisi" iki
          satıra kırılıyordu (ölçüldü, 1280). Sütun aralığı da burada;
          subgrid onu üstten alıyor. */}
      <ul className="grid grid-cols-[auto_minmax(0,1fr)_max-content] gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_max-content_max-content] sm:gap-x-4">
      {shown.map((row) => {
        const badge = badges[`${row.symbol}:${row.reportDate}`];
        return (
          /* Satır artık bir <a> değil: analiz rozeti kendi bağlantısını
             taşıyor ve iç içe bağlantı geçersiz HTML. Yüzeyi kaplayan
             bağlantı katmanı görünümü aynen koruyor. */
          /* SABİT SÜTUNLAR (23 Eylül). Satır esnek bir diziydi ve EPS
             beklentisi yalnızca değer varsa basılıyordu: beklentisiz
             satırda zaman rozeti sağ uca kayıyor, "Açılış Öncesi" ile
             "Saat Belirsiz" farklı hatlarda duruyordu. Izgarada rozet ve
             EPS sütunu her satırda aynı yerde; değer yoksa sütun boş kalır
             ama yerini tutar. */
          <li
            key={row.id}
            className="relative col-span-full grid grid-cols-subgrid items-center border-t border-line px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
          >
            <Link
              href={`/hisse/${row.symbol}`}
              aria-label={`${row.symbol} ${names[row.symbol]?.name ?? ""}`}
              className="absolute inset-0"
            />
            {/* LOGO VE İKİ SATIRLI KİMLİK. Satır "WMT ......... Walmart Inc"
                diye iki uca yaslanmış iki metinden ibaretti: aradaki boşluk
                satırın yarısıydı ve hemen altındaki "Son Analizler" paneli
                aynı şirketleri logolu, iki satırlı künyeyle gösteriyordu.
                Aynı sayfada aynı bilgi iki farklı ağırlıkta duruyordu. */}
            <LogoTile
              symbol={row.symbol}
              logoUrl={names[row.symbol]?.logoUrl}
              size="md"
            />
            <span className="min-w-0 flex-1">
              <span className="numeral block text-base font-bold leading-tight text-strong">
                {row.symbol}
              </span>
              <span className="block truncate text-tiny leading-tight text-muted">
                {names[row.symbol]?.name ?? ""}
              </span>
            </span>
            {/* BİLİNMEYEN SAAT ROZET DEĞİL, KÜNYE (28 Eylül). 28 Eylül'de beş
                satırın dördü aynı gri "Saat Belirsiz" rozetini taşıyordu ve
                panelde göze ilk çarpan şey bilginin YOKLUĞUYDU; tek gerçek
                bilgi (CCL "Açılış Öncesi") rozet kalabalığında
                kayboluyordu. Rozet bir sınıflama taşıdığında kalıyor;
                saat yoksa aynı sütunda, aynı hizada soluk bir künye.
                Sütun genişliği değişmiyor, hat korunuyor. */}
            {badge ? (
              <AnalysisBadge badge={badge} t={t} size="sm" className="justify-self-stretch" />
            ) : row.hour && hourLabel[row.hour] ? (
              <TimingChip
                className="h-8 justify-center justify-self-stretch sm:h-7"
                tone={row.hour === "bmo" ? "pre" : row.hour === "amc" ? "post" : "neutral"}
              >
                {hourLabel[row.hour]}
              </TimingChip>
            ) : (
              <span className="text-right text-tiny font-semibold text-muted">
                {t.earnings.timeUnknown}
              </span>
            )}
            {row.epsEstimate !== null ? (
              <span className="hidden text-right sm:block">
                <span className="numeral block text-base font-semibold leading-tight text-body">
                  {formatPrice(row.epsEstimate, locale, { currency: true })}
                </span>
                <span className="block whitespace-nowrap text-tiny leading-tight text-muted">
                  {t.earnings.epsEstimate}
                </span>
              </span>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
          </li>
        );
      })}
      </ul>
    </Panel>
  );
}
