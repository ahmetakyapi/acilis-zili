import { LogoImage } from "@/components/ui/LogoImage";
import { logoSrc } from "@/lib/logos";
import { MorphTarget } from "@/components/motion/Morph";
import Image from "next/image";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { ArrowLeft, Heart, Stack, ChartLineUp, BellSimpleRinging } from "@phosphor-icons/react/dist/ssr";
import { PageShare } from "@/components/article/PageShare";
import styles from "../stock.module.css";
import { FavoriteToggle } from "@/components/stock/FavoriteToggle";
import { PriceAlertButton } from "@/components/alerts/PriceAlertButton";
import { getUserAlerts, settleAlerts } from "@/lib/price-alerts";
import { HeaderReadout } from "@/components/stock/ChartReadingContext";
import { ChangePill, DataStamp, Skeleton } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { watchlistItems, watchlists } from "@/lib/schema";
import { getStatus, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyProfile, getQuote } from "@/lib/providers";
import { companySector } from "@/lib/company-sector";
import { fundMetaOf } from "@/db/seed/symbols";
import { cn, formatPrice } from "@/lib/utils";

export function StockBreadcrumb({ symbol, t, children }: { symbol: string; t: Dictionary; children?: React.ReactNode }) {
  return (
    <div className={styles.breadcrumb}>
      {/* `tap-44`: bağlantı 18 piksel yüksekliğinde ve telefonda parmak ~44
          piksellik bir alana basıyor — künyedeki öteki geri bağlantıları
          (rehber, mercek) bu sınıfı zaten taşıyor, hisse sayfası atlanmıştı.
          Genişletme yalnızca DİKEY ve 13'er piksel; ölçüldü, en yakın
          dokunulabilir komşu yukarıda 34, aşağıda 40 piksel uzakta, yani
          `globals.css`teki "saran listede komşunun hedefini kapar" istisnası
          burada geçerli değil. */}
      <Link href="/sirketler" className={cn("tap-44", styles.backLink)}>
        <ArrowLeft size={15} weight="bold" />
        {t.nav.companies}
      </Link>
      <span aria-hidden className={styles.breadcrumbSlash}>/</span>
      <span className="numeral text-xs font-semibold text-strong">{symbol}</span>
      {children ?? <span className={styles.pageLabel}>{t.stock.experienceEyebrow}</span>}
    </div>
  );
}

/** Yapışkan menünün kimliği: logo, sembol, fiyat ve yüzde. */
export async function NavLead({ symbol, locale }: { symbol: string; locale: Locale }) {
  const status = await getStatus();
  const [quote, meta] = await Promise.all([getQuote(symbol, status), getSymbolNames([symbol])]);
  const logo = meta[symbol]?.logoUrl;
  return (
    <span className={styles.navLead}>
      {logo && (
        <span className={styles.navLeadLogo}>
          <Image src={logo} alt="" width={22} height={22} />
        </span>
      )}
      <span className={cn("numeral", styles.navLeadSymbol)}>{symbol}</span>
      {quote.ok && (
        <>
          <span className="numeral text-[13px] font-semibold text-strong">
            {formatPrice(quote.data.price, locale, { currency: true })}
          </span>
          <ChangePill changePct={quote.data.changePct} locale={locale} size="sm" className={styles.navLeadPill} />
        </>
      )}
    </span>
  );
}

/* ==========================================================================
   Başlık: fiyat + favori yıldızı
   ========================================================================== */

export async function StockHeader({
  symbol,
  locale,
  t,
  chip,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
  /** Telefonda sektör satırının altındaki araştırma bağlantısı. */
  chip?: React.ReactNode;
}) {
  const status = await getStatus();
  const [quoteResult, profileResult, session] = await Promise.all([
    getQuote(symbol, status),
    getCompanyProfile(symbol),
    auth(),
  ]);

  const profile = profileResult.ok ? profileResult.data : null;
  /* Künyedeki sektör, profil panelindekiyle ve /teknik dağılım balonuyla
     AYNI tercih sırasından geliyor (`companySector`): GICS varsa o, yoksa
     sağlayıcının serbest metinli alanı. */
  const kunyeSektor = companySector(symbol, profile?.industry, locale);
  // Fonlarda sağlayıcı profili boş döner — ad ve künye yerel kayıttan gelir.
  const fund = fundMetaOf(symbol);
  const identityLogo = logoSrc(symbol, profile?.logoUrl);
  const logoFallback = (
    <span aria-hidden className={cn(styles.companyLogo, styles.companyFallback)}>
      {fund ? <ChartLineUp size={40} weight="duotone" /> : <span>{symbol.slice(0, 4)}</span>}
    </span>
  );

  let isFavorite = false;
  if (session?.user?.id) {
    try {
      const rows = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
        .where(
          and(
            eq(watchlists.userId, session.user.id),
            eq(watchlistItems.symbol, symbol),
          ),
        )
        .limit(1);
      isFavorite = rows.length > 0;
    } catch {
      // veri yoksa yıldız pasif kalır
    }
  }

  /* FİYAT ALARMLARI — bu sembolünkiler, başlığın kotasyonuyla
     değerlendiriliyor (aynı sayı, aynı kaynak: veri dürüstlüğü 3). Tablo
     yoksa (`available: false`) düğme hiç basılmıyor. */
  let alertsAvailable = false;
  let symbolAlerts: Awaited<ReturnType<typeof getUserAlerts>>["alerts"] = [];
  if (session?.user?.id) {
    const { available, alerts } = await getUserAlerts(session.user.id);
    alertsAvailable = available;
    const own = alerts.filter((alert) => alert.symbol === symbol);
    symbolAlerts = quoteResult.ok
      ? await settleAlerts(session.user.id, own, { [symbol]: quoteResult.data.price }, !quoteResult.stale)
      : own;
  }

  /* SEANS DIŞINDAKİ FİYAT KENDİNİ SÖYLÜYOR.
     Konsolide tape'e geçtikten sonra açılış öncesi ve kapanış
     sonrası işlemler akıyor (eski IEX beslemesinde hiç akmıyordu),
     yani buradaki sayı artık "dünkü kapanış" değil o dakikanın ön
     seans fiyatı. Ama ekranda bunu söyleyen hiçbir şey yoktu:
     okuyucu seans dışı bir baskıyı normal seans fiyatı sanıyordu.
     Yanındaki önceki kapanış da yüzdenin neye göre hesaplandığını
     görünür kılıyor — aradaki fark elle doğrulanabiliyor. */
  const sessionNote =
    quoteResult.ok &&
    (status.session === "pre-market" || status.session === "after-hours") ? (
      <p className="mt-2 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-tiny">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-wash px-2.5 py-[3px] font-semibold text-primary-ink">
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {status.session === "pre-market" ? t.market.preMarket : t.market.afterHours}
        </span>
        {quoteResult.data.prevClose !== null && (
          <span className="numeral text-muted">
            {t.market.prevClose}{" "}
            {formatPrice(quoteResult.data.prevClose, locale, { currency: true })}
          </span>
        )}
      </p>
    ) : null;

  return (
    <header className={styles.stockHeader}>
      {/* `data-morph-stage`: logo uçarak gelirken ad ve künye bekliyor,
          inince yanından açılıyor (components/motion/Morph). */}
      <div data-motion-reveal data-morph-stage className={styles.identity}>
        {/* Kimlikte de ortak logo yolu: yerel WebP öncelikli, görsel
            yüklenemezse aynı ölçüde sembol karosu. Uçuş hedefi tek.
            Önceki çerçevesiz logo kararı korunuyor: resim kutuyu doldurur,
            iç dolgu ve kenarlık yok; şeffaf logoların koyu harfleri gece
            temasında kaybolmasın diye resmin zemini her iki temada beyaz. */}
        <MorphTarget morphKey={`logo:${symbol}`} className={styles.identityMark}>
          {identityLogo ? (
            <LogoImage key={identityLogo} src={identityLogo} px={96} boxClass={styles.companyLogo} fallback={logoFallback} />
          ) : logoFallback}
        </MorphTarget>
        <div className={styles.identityCopy}>
          {/* SIRA: SEMBOL → AD → KÜNYE.
              Önce künye (borsa · sektör) geliyordu, altında ad ve onun
              yanında sembol ile kalp. Telefonda üçü de sığmıyordu: künye iki
              satıra kırılıyor, 24 puntoluk ad satırı dolduruyor, sembol ve
              kalp üçüncü satıra düşüyordu — kalp adın yanında bir eylem
              olmaktan çıkıp havada asılı bir ikona dönüşüyordu.
              Yeni sıra kimliği yukarı alıyor: sembol ve kalp aynı satırda ve
              her zaman birlikte (ikisi de kısa, hiçbir genişlikte
              ayrılmıyorlar), altında tam ad, en altta künye tek satırda
              kırpılıyor. Künye bir etiket, başlık değil — en alta düşmesi
              okuma sırasını da düzeltiyor. */}
          <div className={styles.identityMeta}>
            <span className={cn("numeral", styles.symbol)}>
              {symbol}
            </span>
            {session?.user ? (
              /* Kalp KENDİ istemci bileşeninde: tıklamanın karşılığını
                 anında vermesi gerekiyor (bkz. FavoriteToggle). */
              <FavoriteToggle
                symbol={symbol}
                isFavorite={isFavorite}
                addLabel={t.stock.addToWatchlist}
                removeLabel={t.stock.removeFromWatchlist}
              />
            ) : (
              /* GİRİŞ YAPMAMIŞA DA GÖRÜNÜYOR. Düğme tamamen gizliydi: ürünün
                 hesap açma gerekçesi tam olarak takip listesi ama bu vaat,
                 dönüşüm ihtimalinin en yüksek olduğu yerde — okuyucu bir
                 şirketin sayfasındayken — hiç gösterilmiyordu. `devam`
                 parametresi `safeRedirectTarget` ile doğrulanıyor, giriş
                 sonrası okuyucu aynı hisseye dönüyor. */
              <Link
                href={`/giris?devam=${encodeURIComponent(`/hisse/${symbol}`)}`}
                aria-label={t.stock.addToWatchlist}
                title={t.stock.addToWatchlist}
                className="tap-44 inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-elevated hover:text-soft"
              >
                <Heart weight="duotone" size={17} />
              </Link>
            )}
            {/* ALARM KALBİN YANINDA — aynı ölçü. Girişsiz okuyucuya da
                görünüyor ve onu girişe, sonra bu hisseye geri götürüyor
                (kalbin gerekçesiyle aynı). */}
            {session?.user ? (
              alertsAvailable && (
                <PriceAlertButton
                  symbol={symbol}
                  price={quoteResult.ok && !quoteResult.stale ? quoteResult.data.price : null}
                  alerts={symbolAlerts}
                  locale={locale}
                  labels={t.priceAlerts}
                />
              )
            ) : (
              <Link
                href={`/giris?devam=${encodeURIComponent(`/hisse/${symbol}`)}`}
                aria-label={t.priceAlerts.loginHint}
                title={t.priceAlerts.loginHint}
                className="tap-44 inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-elevated hover:text-soft"
              >
                <BellSimpleRinging weight="duotone" size={17} />
              </Link>
            )}
            {/* PAYLAŞ KALBİN YANINDA (30 Eylül, sahibinin isteği: "böyle
                ekranlara hep paylaş"). Aynı simge ölçüsü (32, dokunma 44);
                telefonda işletim sisteminin paylaşım sayfası açılıyor. */}
            <PageShare
              path={`/hisse/${symbol}`}
              title={`${symbol} · ${profile?.name || fund?.name || symbol}`}
              locale={locale}
              t={t}
              compact
            />
          </div>
          <h1 data-ink="solid" className={styles.companyName}>
            {profile?.name || fund?.name || symbol}
          </h1>
          {/* Künye şeridi — borsa · sektör.
              SEKTÖR AYNI KAYNAKTAN. Burası sağlayıcının serbest metinli
              alanını yazıyordu, otuz piksel aşağıdaki profil paneli ise
              GICS sınıflandırmasını: /hisse/CSCO'da künye "İletişim",
              panel "Bilgi Teknolojileri" diyordu. /hisse/WMT'de künye
              "Perakende", panel "Temel Tüketim". Tek sayfada iki farklı
              sektör iddiası, üstelik ikisi de aynı ekranda görünüyor.
              Tercih sırası panelinkiyle birebir: GICS varsa o, yoksa
              sağlayıcının alanı. */}
          {kunyeSektor && (
            /* BORSA ADI KÜNYEDEN ÇIKTI. Satır "NASDAQ NMS - GLOBAL MARKET ·
               BİLGİ TEKNOLOJİLERİ" diye kuruluyor ve 390 pikselde 39 piksel
               kırpılıyordu — kesilen yer de sektördü. İkisi de aşağıdaki
               Şirket Profili kartında kendi satırlarında zaten var; künye
               genişliğinin tamamını tekrara harcayıp tekrar olmayan yarısını
               kesiyordu. Sektör tek başına sığıyor. */
            <p className={styles.sector}>
              <Stack size={14} weight="duotone" aria-hidden />
              {kunyeSektor}
            </p>
          )}
          {chip}
          {fund && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-tiny leading-tight text-muted">
              <span className="font-semibold text-soft">
                {locale === "tr" ? fund.labelTr : fund.labelEn}
              </span>
              <span aria-hidden>·</span>
              <span>{locale === "tr" ? fund.tracksTr : fund.tracksEn}</span>
            </p>
          )}
        </div>
      </div>

      {quoteResult.ok ? (
        <div className={styles.priceBlock}>
          {/* FİYAT VE DEĞİŞİM AYNI SATIRDA. Değişim satırı fiyatın altına
              iniyordu ve telefonda başlık dört satıra çıkıyordu; oysa ikisi
              tek bir okuma — "şu fiyat, şu kadar değişmiş". Sığmadığında
              kendiliğinden alt satıra iniyor (`flex-wrap`), sığdığında yan
              yana duruyorlar. `items-baseline`: 28 puntoluk fiyat ile 13
              puntoluk değişim taban çizgisinde hizalı.
              SATIR İSTEMCİ YAPRAĞI (`HeaderReadout`): grafikte bir nokta
              okunurken burası o barın kapanışını yazıyor — gerekçe
              components/stock/ChartReadingContext.tsx. Canlı sayılar ve
              damga yine burada, sunucuda hesaplanıyor. */}
          <HeaderReadout
            price={quoteResult.data.price}
            change={quoteResult.data.change}
            changePct={quoteResult.data.changePct}
            locale={locale}
            classes={{ line: styles.priceLine, price: cn("tote", styles.livePrice), change: styles.priceChange }}
            session={sessionNote}
            stampLabels={t.data}
            stamp={
              <DataStamp
                labels={t.data}
                source={quoteResult.source}
                at={quoteResult.fetchedAt}
                stale={quoteResult.stale}
                locale={locale}
                className="m-0 justify-start"
              />
            }
          />
        </div>
      ) : (
        <div className="text-right">
          <p className="text-sm text-muted">{t.data.failed}</p>
        </div>
      )}
    </header>
  );
}

/**
 * Hisse başlığının yer tutucusu — gerçek başlığın SARMA DÜZENİYLE aynı.
 *
 * Burada iki blok yan yana sabitti ve iskelet 60 piksel kaplıyordu; gerçek
 * başlık ise dar ekranda fiyat bloğunu alt satıra indirdiği için 167 piksel
 * (320 pikselde 203). Aradaki 107 piksel sayfanın EN ÜSTÜNDE açılıyor ve
 * altındaki her şeyi itiyordu — hisse sayfasının mobil CLS'i 0,185–0,244
 * çıkıyordu, Google'ın "kötü" eşiğinin iki katı.
 *
 * Yükseklik yazılmıyor: aynı `flex-wrap` ve aynı `w-full sm:w-auto` kuralı
 * kullanıldığı için iskelet de gerçek başlıkla aynı genişlikte sarıyor ve
 * içerik değiştikçe onunla birlikte kayıyor.
 */
export function HeaderSkeleton({ sessionRow = false, chip = false }: { sessionRow?: boolean; chip?: boolean }) {
  return (
    <header className={styles.stockHeader}>
      <div className={styles.identity}>
        <Skeleton className={cn(styles.companyLogo, "shrink-0")} />
        <div className={styles.identityCopy}>
          {/* Üç satır gerçeğin ölçüsünde (28 Eylül): sembol + kalp satırı,
              ad, künye — sınıflar stock.module.css "YEDEKLER" notunda. */}
          <Skeleton className={cn("w-20", styles.identityMetaSkeleton)} />
          <Skeleton className={styles.identityNameSkeleton} />
          <Skeleton className={cn("w-36 max-w-full", styles.sectorSkeleton)} />
          {chip && <Skeleton className="mt-2 h-7 w-48 max-w-full md:hidden" />}
        </div>
      </div>
      {/* FİYAT BLOĞU GERÇEĞİN ÖLÇÜLERİYLE (24 Eylül). Yedek 64 + 30 + 28
          piksellik üç blok basıyordu; gerçek blok fiyat satırı (puntosu
          kadar, `line-height:1`) + seans dışında hap satırı + künye. 1440'ta
          122'ye karşı 108, 768'de ise 127'ye karşı 96 piksel: akış gelince
          grafik 31 piksel yukarı kayıyordu (CLS 0,019). Fiyatın yeri artık
          aynı sınıfla (`livePrice`, 1em), hap satırı yalnızca seans
          dışındaysa — sunucu seansı zaten biliyor. */}
      <div className={styles.priceBlock}>
        <div className={styles.priceLine}>
          <span className={cn("skeleton block w-52", styles.livePrice, styles.priceSkeleton)} />
        </div>
        {sessionRow && <Skeleton className="mt-2 h-[26px] w-56" />}
        <Skeleton className="mt-2 h-[19px] w-48" />
      </div>
    </header>
  );
}
