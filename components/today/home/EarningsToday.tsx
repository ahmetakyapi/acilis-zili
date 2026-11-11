import { ArrowUp, MoonStars, SunHorizon } from "@phosphor-icons/react/dist/ssr";
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
import { auth } from "@/auth";
import { getAnalysisBadges, getEarningsBetweenResult, getHolidays, getSymbolNames, getUserSymbols } from "@/lib/data";
import { splitEarningsToday } from "@/lib/earnings-today-split";
import { isTradingDay, nextTradingDay, todayEt } from "@/lib/market-hours";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { epsSurprise, revenueSurprise, type Surprise } from "@/lib/earnings-week";
import type { AnalysisBadge as AnalysisBadgeData } from "@/lib/data";
import { cn, formatMoneyCompact, formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./EarningsToday.module.css";
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

  /* Aynı turda: adlar/piyasa değeri, günün BÜTÜN analizleri (dilden
     bağımsız varlık; akış da öyle sayıyor) ve oturumlu okurun takip
     listesi — üçü de akışa kimin girdiğini söylüyor (aşağıda). Takip
     listesi okunamazsa boş küme: panel o şirketi tekrar gösterir ama
     hiçbir şirketi kaybettirmez. */
  const session = await auth();
  const userId = session?.user?.id;
  const [names, badges, watched] = await Promise.all([
    getSymbolNames(rows.map((row) => row.symbol)),
    getAnalysisBadges(null, locale, { from: today, to: today }),
    userId ? getUserSymbols(userId).catch(() => [] as string[]) : Promise.resolve([] as string[]),
  ]);

  /* AKIŞLA BÖLÜŞÜM (11 Kasım, sahibinin kararı: "bilanço tekrarını mantıklı
     şekilde kırp"). Akışta saatiyle duran ve sonucu henüz gelmemiş bilanço
     burada tekrar edilmiyor; panel günün geri kalanını ve sonucu gelenleri
     gösteriyor, sonucu gelenler önde. Kural ve ölçüm
     `lib/earnings-today-split.ts`; akışa girme kuralı `loadDayFlow` ile aynı
     fonksiyon (`inDayFlow`). Hafta sonu panel sıradaki işlem gününü
     gösterdiği için süzme yok (`sameDay`).

     PANEL BOŞALIRSA HİÇ BASILMAZ (düşünülen alternatif: tek satırlık "Bugünün
     bilançoları akışta" bağlantısı). Okur bu panele gelene dek akışı zaten
     geçmiş oluyor; başlığı, sayacı ve "Tümünü Gör"ü olan bir panelin tek
     cümlesi "yukarıda" demek olurdu — bir panel boyu boş çerçeve.
     Kapsayıcı `[data-home-section]:empty` ile ızgaradan düşüyor
     (TodayExperience.module.css). Bütün takvim boşsa eski boş durum
     yukarıda yerinde: o, akışın da söylediği gerçek bir bilgi. */
  const analyzed = new Set(
    Object.keys(badges).filter((key) => key.endsWith(`:${today}`)).map((key) => key.slice(0, key.lastIndexOf(":"))),
  );
  const split = splitEarningsToday(rows, {
    sameDay: today === calendarToday,
    analyzed,
    watched: new Set(watched),
    marketCap: (symbol) => names[symbol]?.marketCap,
  });
  if (split.panel.length === 0) return null;

  /* Beş satır. SIRA: sonucu gelenler önde, sonra PİYASA DEĞERİ
     (`splitEarningsToday`). Sağlayıcı takvimi alfabetik döndürüyor ve
     liste "APC · ATI · ATII · ATLC" diye başlıyordu: bugünün en büyük
     bilançosu 400 satır aşağıdaydı. Takvim ekranı zaten aynı sıralamayı
     kullanıyor.
     SEKİZDEN BEŞE. Panel ana sayfanın ortasında bir ÖZET; sekiz satır onu
     telefonda tek başına bir ekran boyu yapıyor ve altındaki bölümleri
     aşağı itiyordu. Kırpılan geri kalan zaten künyede sayıyla ("43 şirketin
     5 tanesi") ve "Tümünü Gör" ile duruyor. */
  const shown = split.panel.slice(0, 5);

  return (
    <EarningsTodayView
      title={title}
      total={split.panel.length}
      rows={shown.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        reportDate: row.reportDate,
        hour: row.hour,
        epsEstimate: row.epsEstimate,
        epsActual: row.epsActual,
        revenueEstimate: row.revenueEstimate,
        revenueActual: row.revenueActual,
        name: names[row.symbol]?.name ?? "",
        logoUrl: names[row.symbol]?.logoUrl ?? null,
        currency: names[row.symbol]?.currency ?? null,
        marketCap: names[row.symbol]?.marketCap ?? null,
      }))}
      inFlow={split.inFlow.map((row) => ({ symbol: row.symbol, logoUrl: names[row.symbol]?.logoUrl ?? null }))}
      badges={badges}
      locale={locale}
      t={t}
    />
  );
}

export type EarningsTodayRow = {
  id: string;
  symbol: string;
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  name: string;
  logoUrl: string | null;
  currency: string | null;
  /** USD piyasa değeri; yabancı para biriminde null (`SymbolMeta`). */
  marketCap: number | null;
};

/**
 * Bugün bilanço açıklayanlar — saf görünüm (veri `EarningsToday`de;
 * `olcum` skill'i: yükleyici ile çizim ayrı).
 *
 * İKİ ÖLÇÜ VE KARNE (10 Kasım, görsel tur). Satırın sağında tek bir sayı
 * ("12,33 $ / EPS Beklentisi") duruyordu ve satır açıklamadan SONRA da aynı
 * kalıyordu: takvim satırı gelir beklentisini, açıklanan HBK'yı ve
 * açıklanan geliri zaten taşıyor (`earnings_calendar`), ana sayfa hiçbirini
 * göstermiyordu. Artık iki ölçü yan yana, haftalık bilanço panosunun ve
 * gün akışının diliyle (`epsSurprise` / `revenueSurprise`, aynı eşikler):
 *  - AÇIKLANMADIYSA beklenti gövde tonunda, künyesi "HBK" / "Gelir".
 *  - AÇIKLANDIYSA sayı açıklanan değer, güçlü mürekkeple; yanında karne
 *    imi (▲ aştı, ▼ kaçırdı, = hizada; biçim + renk, yalnız renk değil) ve
 *    sapma yüzdesi. Renk yalnız bu imde: yön.
 *  - Değer hiç yoksa hücre boş kalır ama sütun yerini tutar (hat bozulmaz).
 * Yeni veri çağrısı yok; sütunlar `max-content`, beş satırda aynı hatta.
 * Ölçüm EarningsToday.module.css başında.
 */
export function EarningsTodayView({
  title,
  total,
  rows: shown,
  inFlow = [],
  badges,
  locale,
  t,
}: {
  title: string;
  /** Günün toplam şirket sayısı — liste kırpıldıysa künyede. */
  total: number;
  rows: readonly EarningsTodayRow[];
  /** Akışta duran, sonucu bekleyen bilançolar — satır olarak basılmaz,
      panelin dibindeki künye onları adıyla akışa bağlar. */
  inFlow?: readonly { symbol: string; logoUrl: string | null }[];
  badges: Record<string, AnalysisBadgeData | undefined>;
  locale: Locale;
  t: Dictionary;
}) {
  const maxCap = Math.max(0, ...shown.map((row) => row.marketCap ?? 0));
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
          total > shown.length
            ? t.today.earningsCount
                .replace("{total}", String(total))
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
      {/* GENİŞ DÜZEN KAP SORGUSUYLA (11 Kasım) — gerekçe ve ölçüm
          EarningsToday.module.css → "GENİŞ KAP". Izgara şablonu modülde:
          kırılım ekran değil panelin kendi eni (720 tablet, 976 ara,
          826/946 rayın sol kolonu). */}
      <div className={styles.frame}>
      <ul className={styles.list}>
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
              aria-label={`${row.symbol} ${row.name}`}
              className="absolute inset-0"
            />
            {/* LOGO VE İKİ SATIRLI KİMLİK. Satır "WMT ......... Walmart Inc"
                diye iki uca yaslanmış iki metinden ibaretti: aradaki boşluk
                satırın yarısıydı ve hemen altındaki "Son Analizler" paneli
                aynı şirketleri logolu, iki satırlı künyeyle gösteriyordu.
                Aynı sayfada aynı bilgi iki farklı ağırlıkta duruyordu. */}
            <LogoTile
              symbol={row.symbol}
              logoUrl={row.logoUrl}
              size="md"
            />
            <span className="min-w-0 flex-1">
              <span className="numeral block text-base font-bold leading-tight text-strong">
                {row.symbol}
              </span>
              <span className="block truncate text-tiny leading-tight text-muted">
                {row.name}
              </span>
            </span>
            <CapCell value={row.marketCap} max={maxCap} label={t.homeEarnings.marketCap} locale={locale} />
            {/* BİLİNMEYEN SAAT ROZET DEĞİL, KÜNYE (28 Eylül). 28 Eylül'de beş
                satırın dördü aynı gri "Saat Belirsiz" rozetini taşıyordu ve
                panelde göze ilk çarpan şey bilginin YOKLUĞUYDU; tek gerçek
                bilgi (CCL "Açılış Öncesi") rozet kalabalığında
                kayboluyordu. Rozet bir sınıflama taşıdığında kalıyor;
                saat yoksa aynı sütunda, aynı hizada soluk bir künye.
                Sütun genişliği değişmiyor, hat korunuyor. */}
            {/* TELEFONDA TEK ÖLÇÜ: HBK (10 Kasım, ikinci tur). Ölçü hücreleri
                640'ın altında gizliydi; telefondaki okuyucu satırda yalnız
                saat rozetini görüyordu. Satır uzamadan sığan düzen: sağ
                hücre, soldaki kimlikle AYNI kalıpta iki satır — üstte sayı
                (HBK), altta künye ("HBK" + saat penceresi, ikonuyla).
                Rozetin 32 piksellik hapı yerine 31 piksellik iki satır;
                satır 57 pikselde kalıyor (ölçüm modülün başında). Saat
                penceresi hap olmaktan çıkıp künyeye iniyor: aynı bilgi,
                aynı ikon, daha az mürekkep — sayı öne geçiyor. HBK yoksa
                ya da analiz rozeti varsa (görüş, sayıdan değerli) hücre
                eskisi gibi; ≥640'ta hiçbir şey değişmiyor. */}
            {phoneFigure(row, badge) && (
              <span className={styles.phoneFigure} data-reported={row.epsActual !== null || undefined}>
                <span className={cn("numeral", styles.figureValue)}>
                  {formatPrice((row.epsActual ?? row.epsEstimate)!, locale, { currency: row.currency ?? true })}
                </span>
                <span className={styles.figureNote}>
                  {t.earnings.epsEstimateShort}
                  {row.epsActual !== null ? (
                    <SurpriseMark surprise={epsSurprise(row.epsActual, row.epsEstimate)} locale={locale} />
                  ) : row.hour && hourLabel[row.hour] ? (
                    <span className={styles.phoneTiming}>
                      {row.hour === "bmo" ? <SunHorizon aria-hidden size={12} weight="bold" /> : row.hour === "amc" ? <MoonStars aria-hidden size={12} weight="bold" /> : null}
                      {hourLabel[row.hour]}
                    </span>
                  ) : null}
                </span>
              </span>
            )}
            <span className={phoneFigure(row, badge) ? styles.wideOnly : "contents"}>
            {badge ? (
              <AnalysisBadge badge={badge} t={t} size="sm" className="justify-self-stretch" />
            ) : row.hour && hourLabel[row.hour] ? (
              <TimingChip
                className="h-6 justify-center justify-self-stretch px-2.5"
                tone={row.hour === "bmo" ? "pre" : row.hour === "amc" ? "post" : "neutral"}
              >
                {hourLabel[row.hour]}
              </TimingChip>
            ) : (
              <span className="text-right text-tiny font-semibold text-muted">
                {t.earnings.timeUnknown}
              </span>
            )}
            </span>
            <Figure
              label={t.earnings.epsEstimateShort}
              estimate={row.epsEstimate}
              actual={row.epsActual}
              surprise={epsSurprise(row.epsActual, row.epsEstimate)}
              format={(value) => formatPrice(value, locale, { currency: row.currency ?? true })}
              locale={locale}
              t={t}
            />
            <Figure
              label={t.earnings.revenueShort}
              estimate={row.revenueEstimate}
              actual={row.revenueActual}
              surprise={revenueSurprise(row.revenueActual, row.revenueEstimate)}
              format={(value) => formatMoneyCompact(value, locale, row.currency)}
              locale={locale}
              t={t}
            />
          </li>
        );
      })}
      </ul>
      </div>
      {/* AKIŞA BAĞLAYAN KÜNYE (11 Kasım). Panel akıştaki ve sonucu bekleyen
          bilançoları tekrar etmiyor; okur "TDG nerede?" diye sormasın diye
          onları logosu ve sembolüyle tek satırda adlandırıp akışa
          bağlıyor. Ayrı kutu değil, panelin içinde hairline'la ayrılmış
          künye (`arayuz.md` → ekran sırası 6). */}
      {inFlow.length > 0 && (
        <a
          href="#gunun-akisi"
          className={styles.flowNote}
          data-flow-note
          aria-label={t.homeEarnings.inFlowAria.replace("{list}", inFlow.map((row) => row.symbol).join(", "))}
        >
          <span className={styles.flowLogos} aria-hidden>
            {inFlow.slice(0, FLOW_NOTE_SYMBOLS).map((row) => (
              <LogoTile key={row.symbol} symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
            ))}
          </span>
          <span className={cn("numeral", styles.flowSymbols)} aria-hidden>
            {inFlow.slice(0, FLOW_NOTE_SYMBOLS).map((row) => row.symbol).join(" · ")}
            {inFlow.length > FLOW_NOTE_SYMBOLS && ` +${inFlow.length - FLOW_NOTE_SYMBOLS}`}
          </span>
          <span className={styles.flowText} aria-hidden>{t.homeEarnings.inFlow}</span>
          <ArrowUp aria-hidden size={14} weight="bold" className={styles.flowArrow} />
        </a>
      )}
    </Panel>
  );
}

/** Künyede adı yazılan en çok sembol — fazlası "+N" (akıştaki logo
    şeridiyle aynı sınır mantığı, `MemberMarks`). */
const FLOW_NOTE_SYMBOLS = 3;

/** Geniş kapta piyasa değeri: yazılı değer + listenin en büyüğüne göre
    kalın şerit (büyüklük, yargı değil — ton `--bar-soft`). */
function CapCell({ value, max, label, locale }: { value: number | null; max: number; label: string; locale: Locale }) {
  if (value === null || !(max > 0)) return <span aria-hidden className={styles.capEmpty} />;
  const share = Math.max(0.02, Math.min(1, value / max));
  return (
    <span className={styles.cap}>
      <span className={styles.capHead}>
        <span className={cn("numeral", styles.capValue)}>{formatMoneyCompact(value, locale, "USD")}</span>
        <span className={styles.figureNote}>{label}</span>
      </span>
      <span className="value-lane" data-draw>
        <i className="value-bar bar-fill" data-end="end" style={{ left: 0, width: `${(share * 100).toFixed(1)}%` }} />
      </span>
    </span>
  );
}

/** Telefonda sağ hücre HBK'yı gösterir mi: sayı var ve analiz rozeti yok. */
function phoneFigure(row: EarningsTodayRow, badge: AnalysisBadgeData | undefined) {
  return !badge && (row.epsActual ?? row.epsEstimate) !== null;
}

/** Karne imi: ▲ aştı, ▼ kaçırdı, = hizada; yanında sapma yüzdesi. */
function SurpriseMark({ surprise, locale }: { surprise: Surprise | null; locale: Locale }) {
  if (!surprise) return null;
  return (
    <b className={cn("numeral", styles.figureMark)} data-dir={surprise.direction}>
      {surprise.direction === "beat" ? "▲" : surprise.direction === "miss" ? "▼" : "="}
      {surprise.ratio !== null && ` ${formatPercentPlain(Math.abs(surprise.ratio) * 100, locale, 0)}`}
    </b>
  );
}

/** Tek ölçü hücresi: beklenti ya da açıklanan değer + karne imi. */
function Figure({
  label,
  estimate,
  actual,
  surprise,
  format,
  locale,
  t,
}: {
  label: string;
  estimate: number | null;
  actual: number | null;
  surprise: Surprise | null;
  format: (value: number) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const value = actual ?? estimate;
  if (value === null) return <span aria-hidden className="hidden sm:block" />;
  const reported = actual !== null;
  return (
    <span className={cn("hidden sm:grid", styles.figure)} data-reported={reported || undefined}>
      <span className={cn("numeral", styles.figureValue)}>{format(value)}</span>
      <span className={styles.figureNote}>
        {label}
        {!reported && <span className="sr-only"> · {t.calendar.forecast}</span>}
        <SurpriseMark surprise={surprise} locale={locale} />
      </span>
    </span>
  );
}
