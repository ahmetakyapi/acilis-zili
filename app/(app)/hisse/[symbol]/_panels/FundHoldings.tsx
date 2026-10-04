import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { EmptyState, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { getSymbolNames } from "@/lib/data";
import { getEtfHoldings, type EtfHoldings, type HoldingsSource } from "@/lib/etf-holdings-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { HoldingRow } from "@/lib/providers/etf-holdings";
import { formatPercentPlain } from "@/lib/utils";

/**
 * FONUN İÇİNDEKİLER — ETF detayında "bu fonda ne var" (4 Ekim 2026,
 * sahibinin isteği: "S&P 500, Nasdaq, Dow Jones, DRAM, NASA gibi fonların
 * içindeki hisseler ve ağırlıkları").
 *
 * Panel yalnızca kaynağı tanımlı fonlarda çiziliyor (lib/etf-holdings-data.ts
 * → `HOLDINGS_SOURCES`); ülke fonlarında ve IWM'de yok. İlk on satır açık,
 * kalanı (en fazla 25'e kadar) katlanmış: SPY'nin 500 kalemini sayfaya
 * basmak okunmuyor, ilk on zaten fonun yarısı.
 *
 * AĞIRLIK BİR DE ÇİZGİ. Satırlar zaten sıralı ama "ikinci, birincinin ne
 * kadarı" sorusu sayı okunarak cevaplanıyordu; ince çubuk ilk satıra göre
 * ölçekli (CompareScale, yargı değil büyüklük).
 *
 * SEMBOL YALNIZ BİLİNİYORSA BAĞLANTI. Yurt dışı hisse (Samsung, SK hynix
 * Kore kotasyonu), swap ya da SpaceX'in özel amaçlı aracı sitede bir sayfa
 * değil: adıyla, bağlantısız duruyor. Bilinen sembolde ad kendi
 * tablomuzdan (State Street adları büyük harfli ve kısaltılmış:
 * "NVIDIA CORP").
 */

const OPEN_ROWS = 10;

const SOURCE_LABEL: Record<HoldingsSource, (t: Dictionary) => string> = {
  ssga: (t) => t.fundHoldings.sourceSsga,
  roundhill: (t) => t.fundHoldings.sourceRoundhill,
  tema: (t) => t.fundHoldings.sourceTema,
  nport: (t) => t.fundHoldings.sourceNport,
};

export async function FundHoldings({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const holdings = await getEtfHoldings(symbol);
  if (holdings === null) return null;
  const H = t.fundHoldings;

  if (holdings === "error") {
    return (
      <Panel>
        <PanelHeader title={H.title} />
        <EmptyState title={H.error} className="px-4 py-6 sm:px-5" />
      </Panel>
    );
  }

  const tickers = holdings.rows.map((row) => row.ticker).filter((ticker): ticker is string => ticker !== null);
  const known = await getSymbolNames(tickers);
  const top = holdings.rows[0]?.weight ?? 1;
  const pct = (value: number) => formatPercentPlain(value, locale, 2);
  const open = holdings.rows.slice(0, OPEN_ROWS);
  const rest = holdings.rows.slice(OPEN_ROWS);

  const row = (holding: HoldingRow, index: number) => {
    const meta = holding.ticker ? known[holding.ticker] : undefined;
    const name = meta?.name ?? holding.name;
    return (
      <li key={`${holding.cusip ?? holding.name}-${index}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 sm:px-5">
        <span className="numeral text-small text-muted">{index + 1}</span>
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Logosuz satırda (yurt dışı hisse, swap) aynı genişlikte boşluk:
              adlar alt alta aynı hattan başlasın. */}
          {holding.ticker && meta ? (
            <LogoTile symbol={holding.ticker} logoUrl={meta.logoUrl} size="sm" />
          ) : (
            <span aria-hidden className="size-[26px] shrink-0" />
          )}
          <div className="min-w-0">
            {holding.ticker && meta ? (
              <Link href={`/hisse/${holding.ticker}`} prefetch={false} className="block truncate text-sm font-semibold text-strong hover:text-primary-ink">
                {holding.ticker}
              </Link>
            ) : null}
            <p className={holding.ticker && meta ? "truncate text-small text-muted" : "line-clamp-2 text-sm font-medium leading-snug text-body"}>
              {name}
            </p>
          </div>
        </div>
        <div className="flex w-[5.5rem] flex-col items-end gap-1 sm:w-28">
          <span className="numeral text-sm font-semibold text-strong">{pct(holding.weight)}</span>
          <ScaleBar ratio={holding.weight / top} signed={false} className="w-full" />
        </div>
      </li>
    );
  };

  return (
    <Panel>
      <PanelHeader
        title={H.title}
        meta={H.meta.replace("{count}", String(holdings.count)).replace("{share}", pct(holdings.topTenShare))}
      />
      <p className="px-4 pb-1 text-small leading-relaxed text-muted sm:px-5">{H.intro}</p>
      <ol className="divide-y divide-line-soft">{open.map((holding, index) => row(holding, index))}</ol>
      {rest.length > 0 && (
        <details className="group border-t border-line-soft">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-primary-ink sm:px-5 [&::-webkit-details-marker]:hidden">
            {H.showRest.replace("{count}", String(rest.length))}
            <span aria-hidden className="group-open:hidden">+</span>
            <span aria-hidden className="hidden group-open:inline">−</span>
          </summary>
          <ol className="divide-y divide-line-soft border-t border-line-soft">
            {rest.map((holding, index) => row(holding, index + OPEN_ROWS))}
          </ol>
        </details>
      )}
      <Footnote holdings={holdings} symbol={symbol} locale={locale} t={t} />
    </Panel>
  );
}

function Footnote({ holdings, symbol, locale, t }: { holdings: EtfHoldings; symbol: string; locale: Locale; t: Dictionary }) {
  const H = t.fundHoldings;
  /* YIL YAZILIYOR: N-PORT beyanı aylarca eski olabiliyor ve yılsız bir
     "30 Haziran" bugünün yılı sanılırdı. */
  const date = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${holdings.asOf}T12:00:00Z`));
  return (
    <div className="space-y-1.5 border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
      <p className="font-medium text-body">
        {SOURCE_LABEL[holdings.source](t)} · {H.asOf.replace("{date}", date)}
      </p>
      <p>{holdings.source === "nport" ? H.noteNport : H.noteDaily}</p>
      {symbol === "DRAM" && <p>{H.noteSwap}</p>}
    </div>
  );
}
