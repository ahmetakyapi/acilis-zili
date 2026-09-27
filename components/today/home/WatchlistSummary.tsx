import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { auth } from "@/auth";
import {
  DataError,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  LogoTile,
  ButtonLink,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames, getUserSymbols } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatPercent, formatPrice } from "@/lib/utils";
import { Sparkline } from "@/components/ui/Sparkline";
import { getChartBarsMulti } from "@/lib/providers";

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

  const userSymbols = await getUserSymbols(session.user.id);

  if (userSymbols.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} tone="title" />
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
  const [result, bars, names] = await Promise.all([
    getQuotes(shown, status),
    getChartBarsMulti(shown, "1D", status),
    getSymbolNames(shown),
  ]);
  /* Şekil sayıyla aynı seansı anlatmalı — gerekçe `IndexStrip` içinde. */
  const sparkOk = result.ok && !result.stale;

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
      {result.ok ? (
        <>
          <ul>
            {shown.map((symbol, index) => {
              const quote = result.data[symbol];
              const points = (bars[symbol] ?? []).map((bar) => ({
                value: bar.close,
              }));
              const tone = directionOf(quote?.changePct);
              return (
                <li
                  key={symbol}
                  /* `data-fill`: açılabilir yedek satır. Boyu `FillColumn`
                     satırı açıp ölçerek buluyor, ayrı bir örnek satır
                     işaretlemeye gerek yok. */
                  data-fill={index >= WATCHLIST_BASE ? "" : undefined}
                  hidden={index >= WATCHLIST_BASE}
                  suppressHydrationWarning
                  className="border-t border-line first:border-t-0"
                >
                  <Link
                    href={`/hisse/${symbol}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                  >
                    <LogoTile symbol={symbol} logoUrl={names[symbol]?.logoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-strong">
                        {symbol}
                      </span>
                      {names[symbol]?.name && (
                        <span className="block truncate text-tiny text-muted">{names[symbol]!.name}</span>
                      )}
                    </span>
                    {sparkOk && points.length > 1 && (
                      <Sparkline
                        points={points}
                        title={`${symbol} · 1D`}
                        tone={tone}
                        width={56}
                        height={24}
                        showArea={false}
                        className="h-6 w-14 shrink-0"
                      />
                    )}
                    {quote ? (
                      <span className="w-[74px] shrink-0 text-right">
                        <span className="numeral block text-base font-bold text-strong">
                          {formatPrice(quote.price, locale)}
                        </span>
                        <span
                          className={cn(
                            "numeral block text-tiny",
                            directionText(tone),
                          )}
                        >
                          {formatPercent(quote.changePct, locale)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">{t.common.noData}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
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
