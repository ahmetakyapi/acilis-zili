import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { auth } from "@/auth";
import {
  ChangePill,
  DataError,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  LogoTile,
  ButtonLink,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames, getUserSymbols, type SymbolMeta } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import type { Bar, Quote } from "@/lib/providers/types";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import { cn, directionOf, formatPrice } from "@/lib/utils";
import { Sparkline } from "@/components/ui/Sparkline";
import { getChartBarsMulti } from "@/lib/providers";
import { sessionDomain } from "@/components/today/index-feed";
import styles from "./WatchlistSummary.module.css";
import { getUserAlerts, type PriceAlert } from "@/lib/price-alerts";
import { settleAlerts } from "@/lib/alert-settle";
import { BellSimpleRinging, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import alertStyles from "@/components/alerts/PriceAlerts.module.css";
import { WatchlistToday } from "@/components/watchlist/WatchlistToday";
import { insightsConfigured } from "@/lib/stock-insights";
import { WATCH_TODAY_MIN_COVERED } from "@/lib/watchlist-today-core";

/**
 * Hedefe ulaşmış alarmların şeridi — favoriler panelinin başında, yalnızca
 * en az bir alarm tetiklendiyse. Ana sayfa okuyucunun her gün açtığı
 * ekran; alarm burada görünmezse bir sonraki /favoriler ziyaretine kadar
 * fark edilmezdi. Bekleyen alarm şerit basmıyor: sessiz kalmak onların işi.
 */
function AlertHits({ alerts, t }: { alerts: PriceAlert[]; t: Dictionary }) {
  const hits = alerts.filter((alert) => alert.triggeredAt);
  if (hits.length === 0) return null;
  const symbols = [...new Set(hits.map((alert) => alert.symbol))];
  return (
    <Link href="/favoriler#alarmlar" className={cn(alertStyles.homeBanner, "mb-2")}>
      <BellSimpleRinging size={18} weight="fill" aria-hidden />
      <span>
        {t.priceAlerts.hitBanner.replace("{n}", String(hits.length))}
        <span className={alertStyles.homeSymbols}> · {symbols.slice(0, 4).join(", ")}{symbols.length > 4 ? "…" : ""}</span>
      </span>
      <ArrowRight size={16} weight="bold" aria-hidden />
    </Link>
  );
}

/** Favoriler listesinin taban satır sayısı ve yedeklerle birlikte tavanı. */
const WATCHLIST_BASE = 5;
const WATCHLIST_MAX = 10;

export async function WatchlistSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();

  /* GİRİŞ YAPMAMIŞ OKUYUCUYA TEK SATIR (24 Eylül). Panel "Favori Listen
     Boş" diyen tam bir boş durumdu (simge, iki satır metin, düğme — 227
     piksel) ve telefonda bugünün bilançolarından ÖNCE duruyordu: listesi
     olmayan okuyucu, sayfanın asıl içeriğine varmadan bir davetle
     karşılaşıyordu. Üstelik "boş" yanlıştı — giriş yapınca bir listesi
     olabilir. Artık solda ne göreceğini söyleyen tek cümle, sağda giriş;
     telefonda sıra da bilançoların ve analizlerin ardına iniyor
     (TodayExperience.module.css, `:has(a[href$="/giris"])`). */
  if (!session?.user?.id) {
    return (
      <Panel className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="display-ink display-ink-tight w-fit text-read font-bold">{t.today.watchlistSignedOutTitle}</h2>
          <p className="mt-1 text-small leading-[1.3] text-body">{t.today.watchlistSignedOutHint}</p>
        </div>
        <ButtonLink href="/giris" variant="primary" className="shrink-0">
          {t.nav.signIn}
        </ButtonLink>
      </Panel>
    );
  }

  const [userSymbols, alertData] = await Promise.all([
    getUserSymbols(session.user.id),
    getUserAlerts(session.user.id),
  ]);
  const pendingAlertSymbols = alertData.alerts.filter((alert) => !alert.triggeredAt).map((alert) => alert.symbol);

  if (userSymbols.length === 0) {
    const status = await getStatus();
    const quotes = pendingAlertSymbols.length > 0 ? await getQuotes(pendingAlertSymbols, status) : null;
    const alerts = quotes?.ok
      ? await settleAlerts(session.user.id, alertData.alerts, quotes.data, status, !quotes.stale)
      : alertData.alerts;
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} tone="title" />
        <div className="px-4 sm:px-5"><AlertHits alerts={alerts} t={t} /></div>
        <EmptyState
          title={t.today.watchlistEmpty}
          action={<PanelLink href="/favoriler">{t.watchlist.addSymbol}</PanelLink>}
        />
      </Panel>
    );
  }

  const status = await getStatus();
  /* BEŞ SATIR TABAN, ONA KADAR YEDEK.
     Sekiz sabitti ve o sayı hiçbir şeye bakmıyordu: bültenin kısa olduğu bir
     günde sağ kolon sol kolonu aşıyor, uzun olduğu günde altında yüz
     piksellik boşluk kalıyordu. Sunucu on satırın tamamını basıyor ama
     beşten sonrası `hidden`; kaçının açılacağına tarayıcı, iki kolonun
     dibini ölçerek karar veriyor (`FillColumn`). JavaScript kapalıysa beş
     satır kalıyor ve bu da makul bir liste. */
  const shown = userSymbols.slice(0, WATCHLIST_MAX);
  /* LOGO: favori satırı sayfadaki tek çıplak sembol sütunuydu. Aynı sayfada
     yükselenler, günün bilançoları ve son analizler hep logosuyla duruyor;
     okuyucunun EN ÇOK taradığı liste, yani kendi favorileri, iki harflik
     yedeğe düşüyordu. `/favoriler` sayfası bu düzeltmeyi zaten yapmış
     (orada gerekçesi yazılı); ana sayfadaki özet atlanmış.
     Sorgu ücretsiz sayılır: `getSymbolNames` istek içinde önbellekli ve
     anahtarı sıralı sembol dizesi, aynı sayfada beş kez daha çağrılıyor. */
  /* Bekleyen alarmların sembolleri AYNI kotasyon isteğinde: ayrı bir
     istek aynı hissenin iki ayrı paketi demek (CLAUDE.md → getQuotes). */
  const [result, bars, names] = await Promise.all([
    getQuotes([...shown, ...pendingAlertSymbols], status),
    getChartBarsMulti(shown, "1D", status),
    getSymbolNames(shown),
  ]);
  /* Şekil sayıyla aynı seansı anlatmalı — gerekçe `IndexStrip` içinde. */
  const sparkOk = result.ok && !result.stale;
  const alerts = result.ok
    ? await settleAlerts(session.user.id, alertData.alerts, result.data, status, !result.stale)
    : alertData.alerts;

  return (
    <Panel className="px-4 py-4 sm:px-5">
      {/* TAM BOY BAŞLIK (26 Eylül) — ana sayfanın bütün panelleri 11
          piksellik plakadan tam boy başlığa çıktı ("başlık küçük kalmış",
          ekran görüntüsüyle bildirildi). Aşağıdaki not plaka dönemindendir:
          panelin iki boş dalı zaten `PanelHeader` üzerinden plakaya inmişti; dolu dal kendi başlığını elden yazdığı için geride
          kalmıştı ve aynı panel veriye göre iki farklı başlık tipografisi
          basıyordu. */}
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold min-w-0 truncate">{t.today.watchlistSummary}</h2>
        <PanelLink href="/favoriler">{t.common.showAll}</PanelLink>
      </div>
      <AlertHits alerts={alerts} t={t} />
      {result.ok ? (
        <>
          <WatchlistRows
            symbols={shown}
            quotes={result.data}
            bars={bars}
            names={names}
            sparkOk={sparkOk}
            session={sessionDomain(status)}
            locale={locale}
            t={t}
          />
          {/* TAKİP LİSTEM BUGÜN (24 Ekim): listenin son seans okuması, liste
              ile damga arasında — ekran düzeninde ölçüden sonra metin. Not
              istemciden istenir, yazılamazsa blok hiç kalmaz (gerekçe
              components/watchlist/WatchlistToday.tsx). Tek hisselik listede
              basılmaz: "listenin bugünü" iki hisseden başlar. */}
          {insightsConfigured() && userSymbols.length >= WATCH_TODAY_MIN_COVERED && (
            <WatchlistToday locale={locale} labels={t.watchlistToday} variant="compact" />
          )}
          <DataStamp
            labels={t.data}
            source={result.source}
            at={result.fetchedAt}
            stale={result.stale}
            locale={locale}
            className="mt-3 border-t border-line pt-3"
          />
        </>
      ) : (
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      )}
    </Panel>
  );
}

/**
 * Favorilerin satırları — veriden bağımsız çizim (8 Kasım, sahibinin
 * isteği: "çok daha görsel, çok daha iyi"). Öncekine göre:
 *  - DÖRT SÜTUN TEK IZGARADA: karo, ad, kıvılcım, fiyat. Fiyat sütunu
 *    74 piksel SABİTTİ; "1.234,56" ile "−%12,34" sığmadığında sayı satırın
 *    sağına taşıyordu. Artık `subgrid` + `max-content`: sütun en geniş
 *    satırın boyunda, bütün satırlarda aynı hatta biter (CLAUDE.md "hap
 *    sabit genişlikli sütuna konmaz").
 *  - YÜZDE HAP: `ChangePill` (yön zemini `up`/`down` wash'ı + ▲/▼), sitenin
 *    öteki değişim rozetleriyle aynı bileşen. Düz renkli küçük yazıydı.
 *  - KIVILCIM SEANS EKSENİNDE: barlar 04:00–uzatılmış kapanış eksenine
 *    zamanlarıyla, önceki kapanış kesik taban çizgisi (`--line-strong`),
 *    açılış zilinden önceki çizgi yarı tonda — kahramanın endeks
 *    kartlarıyla aynı dil (`sessionDomain`, Sparkline başındaki gerekçe).
 *    Sıra eksenindeyken ön seansın üç barı kıvılcımın tamamını kaplıyor ve
 *    çizgi, sayının işaretiyle çelişebiliyordu. Eksen dışındaki (başka
 *    güne ait) barlar düşüyor; şekil yine yalnız `sparkOk` iken.
 *  - LOGOSUZ SEMBOL İÇİN SEMBOL KAROSU: iki harf (DI, QQ, SP) bozuk bir
 *    logo gibi okunuyordu ve mavi `primary-wash` zemini veri panelinde
 *    etkileşim rengiydi. Logo yoksa karo sembolün kendisini (dört harfe
 *    kadar) mono ve nötr çukur zeminde yazıyor; kenarlık yer tutucunun
 *    işareti (CLAUDE.md "kenarlık yalnız yer tutucularda"). Logo adresi
 *    varken görsel düşerse `LogoTile`ın kendi yedeği devrede kalıyor.
 * Ölçüm `WatchlistSummary.module.css` başında.
 */
function WatchlistRows({
  symbols,
  quotes,
  bars,
  names,
  sparkOk,
  session,
  locale,
  t,
}: {
  symbols: readonly string[];
  quotes: Record<string, Quote | undefined>;
  bars: Record<string, readonly Pick<Bar, "time" | "close">[] | undefined>;
  names: Record<string, Pick<SymbolMeta, "name" | "logoUrl"> | undefined>;
  sparkOk: boolean;
  session: { domain: [number, number]; openAt: number };
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <ul className={styles.list}>
      {symbols.map((symbol, index) => {
        const quote = quotes[symbol];
        const points = (bars[symbol] ?? []).map((bar) => ({ time: bar.time, value: bar.close }));
        const tone = directionOf(quote?.changePct);
        const logo = names[symbol]?.logoUrl ?? logoSrc(symbol, null);
        return (
          <li
            key={symbol}
            /* `data-fill`: açılabilir yedek satır. Boyu `FillColumn`
               satırı açıp ölçerek buluyor, ayrı bir örnek satır
               işaretlemeye gerek yok. */
            data-fill={index >= WATCHLIST_BASE ? "" : undefined}
            hidden={index >= WATCHLIST_BASE}
            suppressHydrationWarning
            className={styles.row}
          >
            {/* Hover sitenin tek diliyle (`--primary-tint`,
                globals.css "SİTENİN TEK HOVER DİLİ"); `opacity-80`
                içeriği soldurup "devre dışı" gibi okutuyordu ve
                `transition-colors` opaklığı geçişlemiyordu. Vurgu panelin
                dolgusuna taşıyor ki kutunun kenarına kadar sürsün (DayMovers
                ile aynı); negatif kenar `subgrid` izlerini kaydırdığı için
                artık satırın `::before` katmanında (CSS notu). */}
            <Link href={`/hisse/${symbol}`} className={styles.link}>
              {logo ? (
                <LogoTile symbol={symbol} logoUrl={names[symbol]?.logoUrl} size="md" />
              ) : (
                <span aria-hidden className={styles.tickerTile} data-len={Math.min(symbol.length, 4)}>
                  {symbol.slice(0, 4)}
                </span>
              )}
              <span className={styles.ident}>
                <span className={styles.symbol}>{symbol}</span>
                {names[symbol]?.name && <span className={styles.name}>{names[symbol]!.name}</span>}
              </span>
              <span className={styles.spark}>
                {sparkOk && points.length > 1 && (
                  <Sparkline
                    points={points}
                    title={`${symbol} · 1D`}
                    tone={tone}
                    width={64}
                    height={28}
                    strokeWidth={1.75}
                    baseline={quote?.prevClose ?? null}
                    domain={session.domain}
                    split={session.openAt}
                    className={styles.sparkSvg}
                  />
                )}
              </span>
              {quote ? (
                <span className={styles.figures}>
                  <span className={cn("numeral", styles.price)}>{formatPrice(quote.price, locale)}</span>
                  <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
                </span>
              ) : (
                <span className={styles.noData}>{t.common.noData}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
