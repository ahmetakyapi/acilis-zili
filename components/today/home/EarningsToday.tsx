import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import {
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  TimingChip,
  LogoTile,
} from "@/components/ui/primitives";
import { getAnalysisBadges, getSymbolNames, getEarningsBetween } from "@/lib/data";
import { todayEt } from "@/lib/market-hours";
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
  const today = todayEt();
  const rows = await getEarningsBetween(today, today);

  if (rows.length === 0) {
    return (
      <Panel>
        <PanelHeader
          title={t.today.earningsToday}
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
        title={t.today.earningsToday}
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
      <ul>
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
            className="relative grid grid-cols-[auto_minmax(0,1fr)_7.5rem] items-center gap-3 border-t border-line px-4 py-3 transition-colors hover:bg-primary-tint sm:grid-cols-[auto_minmax(0,1fr)_7.5rem_5.5rem] sm:gap-4 sm:px-5"
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
              <AnalysisBadge badge={badge} t={t} size="sm" className="w-full justify-center" />
            ) : row.hour && hourLabel[row.hour] ? (
              <TimingChip
                className="w-full justify-center"
                tone={row.hour === "bmo" ? "pre" : row.hour === "amc" ? "post" : "neutral"}
              >
                {hourLabel[row.hour]}
              </TimingChip>
            ) : (
              <span className="text-center text-tiny font-semibold text-muted">
                {t.earnings.timeUnknown}
              </span>
            )}
            {row.epsEstimate !== null ? (
              <span className="hidden text-right sm:block">
                <span className="numeral block text-base font-semibold leading-tight text-body">
                  {formatPrice(row.epsEstimate, locale, { currency: true })}
                </span>
                <span className="block text-tiny leading-tight text-muted">
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
