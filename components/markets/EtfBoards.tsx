import { AnchorSettle } from "@/components/layout/AnchorSettle";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { getStatus } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { quoteBasis, type MarketStatus } from "@/lib/market-hours";
import {
  COMMODITY_ETFS,
  CRYPTO_ETFS,
  SECTOR_ETFS,
  loadBoardBars,
  loadBoardQuotes,
} from "@/lib/market-boards";
import { periodReturns, type PeriodReturns } from "@/lib/period-returns";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateMedium,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import { heatCeiling, heatShare, sectorLeaders } from "@/lib/macro-visual";
import type { CSSProperties } from "react";
import styles from "./MarketBoards.module.css";

/**
 * Fon panoları — Sektör Performansı ve Emtia (/piyasalar).
 *
 * İki panel aynı iskeleti paylaşıyor: sabit etiket sütunu, sağda yüzde
 * sütunları, her yüzdenin altında ölçek çubuğu (CLAUDE.md: karşılaştırılan
 * her büyüklük bir de çizgi olarak okunur). Sektörler sıralanabiliyor;
 * emtia iki gruplu ve sırası sabit (grup içinde sıralama anlam taşımıyor,
 * gruplar arası da karşılaştırma bir iddia olurdu).
 *
 * 1G SEANSI KANITLAMALI (CLAUDE.md "Veri dürüstlüğü" 4). Yüzde kotasyondan
 * geliyor ve hangi günü anlattığına sağlayıcı karar veriyor; `quoteBasis`
 * bu seansa ait işlem görmeyen satırı `lastClose` diye ayırıyor. O satırda
 * yüzde yön rengini bırakıyor ve altında "Son Kapanış" yazıyor — ana
 * sayfanın dünya piyasaları satırlarıyla aynı kalıp.
 *
 * Dönem sütunları kotasyondan DEĞİL günlük barlardan (lib/period-returns.ts)
 * ve künye son barın gününü yazıyor: iki kaynak iki ayrı an anlatıyor ve
 * bu ekranda hangisinin hangisi olduğu söyleniyor.
 */

const SECTOR_SORTS = ["g1", "h1", "a1", "a3", "ybb", "ad"] as const;
export type SectorSort = (typeof SECTOR_SORTS)[number];
type SortDir = "asc" | "desc";

export function parseSectorSort(
  key: unknown,
  dir: unknown,
): { sort: SectorSort; dir: SortDir } {
  return {
    sort: SECTOR_SORTS.includes(key as SectorSort) ? (key as SectorSort) : "g1",
    dir: dir === "asc" ? "asc" : "desc",
  };
}

type BoardRow = {
  symbol: string;
  name: string;
  quote: Quote | undefined;
  /** 1G bu seansa ait değilse true — yüzde son kapanışı anlatıyor. */
  lastClose: boolean;
  returns: PeriodReturns;
};

type ColumnKey = "g1" | "h1" | "a1" | "a3" | "ybb";

function valueOf(row: BoardRow, key: ColumnKey): number | null {
  switch (key) {
    case "g1":
      return row.quote?.changePct ?? null;
    case "h1":
      return row.returns.w1;
    case "a1":
      return row.returns.m1;
    case "a3":
      return row.returns.m3;
    default:
      return row.returns.ytd;
  }
}

async function loadRows(
  entries: readonly { symbol: string; nameTr: string; nameEn: string }[],
  locale: Locale,
  status: MarketStatus,
) {
  const [quotes, bars] = await Promise.all([loadBoardQuotes(status), loadBoardBars(status)]);
  const rows: BoardRow[] = entries.map((entry) => {
    const quote = quotes.ok ? quotes.data[entry.symbol] : undefined;
    return {
      symbol: entry.symbol,
      name: locale === "tr" ? entry.nameTr : entry.nameEn,
      quote,
      lastClose: quote ? quoteBasis(quote, status) === "lastClose" : false,
      returns: periodReturns(bars[entry.symbol] ?? []),
    };
  });
  /* Künyedeki "{tarih} kapanışına kadar" — satırların EN YENİ son barı.
     Satırlar farklı günde bitiyorsa (önbellekten gelen bir seri) o satırın
     tarihi hücrede değil burada eskir; en yeniyi yazmak, geride kalanı
     gizlemek değil, çünkü önbellek yolu beş günlük yaş tavanıyla sınırlı
     (`cachedBarsUsable`). */
  const lastDate = rows.reduce<string | null>(
    (latest, row) => (row.returns.lastDate && (!latest || row.returns.lastDate > latest) ? row.returns.lastDate : latest),
    null,
  );
  return { rows, quotes, lastDate };
}

/** Sütun başına ölçek: o sütunun en büyük mutlak değeri. */
function peaks(rows: BoardRow[], keys: readonly ColumnKey[]) {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      Math.max(...rows.map((row) => Math.abs(valueOf(row, key) ?? 0)), Number.EPSILON),
    ]),
  ) as Record<ColumnKey, number>;
}

function ReturnCell({
  value,
  peak,
  locale,
  lastClose = false,
  lastCloseLabel,
}: {
  value: number | null;
  peak: number;
  locale: Locale;
  lastClose?: boolean;
  lastCloseLabel?: string;
}) {
  const tone = directionOf(value);
  return (
    <td className={styles.valueCell}>
      <span className={cn("numeral font-bold", lastClose ? "text-body" : directionText(tone))}>
        {formatPercent(value, locale)}
      </span>
      {/* Değer yoksa çubuk yok: sıfır uzunluk "hareket yok" demek olurdu. */}
      {value !== null && <ScaleBar ratio={value / peak} signed tone="signal" className={styles.bar} />}
      {lastClose && lastCloseLabel && <span className={styles.basis}>{lastCloseLabel}</span>}
    </td>
  );
}

/**
 * ISI HÜCRESİ (25 Ekim, sektör matrisi). Sektör panosu 5 dönem × 11 satır
 * sayıydı, her sayının altında ince bir ölçek çubuğu: elli beş ayrı küçük
 * çizgiden "hangi sektör hangi dönemde öne çıktı" okunmuyordu. Artık her
 * hücre bir karo: TON yön (yükseliş yeşil, düşüş kırmızı — hisse
 * fiyatlarının dili; makroda olduğu gibi yargı riski yok, fonun fiyatı),
 * KOYULUK büyüklük, o sütunun en büyük mutlak hareketinin yuvarlak
 * tavanına göre (`heatShare` + `heatCeiling`; sütun başına ölçek ve
 * tavanın lejantta YAZILMASI gerekçesi orada). Sayı karonun içinde
 * metin mürekkebiyle; işaret (+/−) renge ek ikinci kodlama, renk körü
 * okur yönü işaretten alır. Tablo YAPISI aynen duruyor: matris bir
 * `<table>`, satır başlığı, sıralanabilir sütunlar; ekran okuyucu ve
 * klavye için ayrı bir alternatif gerekmiyor, alternatifin kendisi bu.
 *
 * 1G bu seansa ait değilse (son kapanış) karo tonsuz: yön rengi bugünün
 * hareketi gibi okunurdu (veri dürüstlüğü 4).
 */
function HeatCell({
  value,
  peak,
  locale,
  lastClose = false,
  lastCloseLabel,
}: {
  value: number | null;
  peak: number;
  locale: Locale;
  lastClose?: boolean;
  lastCloseLabel?: string;
}) {
  const tone = lastClose ? "flat" : directionOf(value);
  return (
    <td className={styles.heatCell}>
      <span className={styles.heat} data-tone={value === null ? undefined : tone} style={{ "--heat": lastClose ? 0 : heatShare(value, peak) } as CSSProperties}>
        <span className="numeral">{formatPercent(value, locale)}</span>
      </span>
      {lastClose && lastCloseLabel && <span className={styles.basis}>{lastCloseLabel}</span>}
    </td>
  );
}

/** Lejant karoları: iki uçta tam koyuluk, ortada boş (yön yok). */
const LEGEND_STEPS = [
  { tone: "down", share: 1 },
  { tone: "down", share: 0.5 },
  { tone: "flat", share: 0 },
  { tone: "up", share: 0.5 },
  { tone: "up", share: 1 },
] as const;

function BoardStamp({
  quotes,
  lastDate,
  locale,
  t,
}: {
  quotes: Awaited<ReturnType<typeof loadBoardQuotes>>;
  lastDate: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <div className={styles.stamp}>
      {quotes.ok && (
        <DataStamp
          labels={t.data}
          source={quotes.source}
          at={quotes.fetchedAt}
          stale={Boolean(quotes.stale)}
          locale={locale}
        />
      )}
      {lastDate && (
        <p className={styles.stampLine}>
          {t.marketExtras.returnsThrough.replace("{date}", formatEtDateMedium(lastDate, locale))}
        </p>
      )}
    </div>
  );
}

/* ==========================================================================
   Sektör Performansı
   ========================================================================== */

const SECTOR_COLUMNS: readonly ColumnKey[] = ["g1", "h1", "a1", "a3", "ybb"];

export async function SectorPerformance({
  locale,
  t,
  sort,
  dir,
  hrefFor,
}: {
  locale: Locale;
  t: Dictionary;
  sort: SectorSort;
  dir: SortDir;
  /** Sayfanın öteki parametrelerini koruyan adres kurucu (endeks sekmesi, sıralama). */
  hrefFor: (params: { sektor: SectorSort; sektorYon: SortDir }) => string;
}) {
  const x = t.marketExtras;
  const status = await getStatus();
  const { rows, quotes, lastDate } = await loadRows(SECTOR_ETFS, locale, status);
  const hasData = rows.some((row) => row.quote || row.returns.lastDate);

  const labels: Record<ColumnKey, { short: string; long: string }> = {
    g1: { short: x.colDay, long: x.colDayLong },
    h1: { short: x.colWeek, long: x.colWeekLong },
    a1: { short: x.colMonth, long: x.colMonthLong },
    a3: { short: x.colQuarter, long: x.colQuarterLong },
    ybb: { short: x.colYtd, long: x.colYtdLong },
  };

  /* Boşlar iki yönde de sonda — bileşen tablosunun kuralı (bkz.
     /piyasalar `MembersTable`): eksik veri bir uç değer değil. */
  const ordered = [...rows].sort((a, b) => {
    if (sort === "ad") {
      const cmp = a.name.localeCompare(b.name, locale === "tr" ? "tr" : "en");
      return dir === "asc" ? cmp : -cmp;
    }
    const va = valueOf(a, sort);
    const vb = valueOf(b, sort);
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });
  /* Tam ton sütunun yuvarlak tavanı; lejant aynı sayıyı yazıyor
     ("1G ±%3 · 1A ±%20"), okur koyuluğu sayıya bağlayabilsin. */
  const raw = peaks(rows, SECTOR_COLUMNS);
  const peak = Object.fromEntries(SECTOR_COLUMNS.map((key) => [key, heatCeiling(raw[key])])) as Record<ColumnKey, number>;
  /* MATRİSİN CÜMLESİ: son bir ayın (1A sütunu) en iyisi, en kötüsü ve
     artıdakilerin sayısı; şablon + veri (`sectorLeaders`, testli). Dönem
     barlardan, künyesi panelin dibinde ("{tarih} kapanışına kadar"). */
  const leaders = sectorLeaders(rows.map((row) => ({ name: row.name, value: row.returns.m1 })));
  const v = t.macroVisual;
  const nextDir = (key: SectorSort): SortDir => (sort === key && dir === "desc" ? "asc" : "desc");

  const head = (key: SectorSort, label: string, long: string | null, className?: string) => (
    <th
      key={key}
      scope="col"
      aria-sort={sort === key ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={className}
    >
      {/* scroll={false}: sıralama bir gezinme değil (bkz. SortHead yorumu). */}
      <Link
        href={hrefFor({ sektor: key, sektorYon: nextDir(key) })}
        scroll={false}
        className={styles.sortLink}
        data-active={sort === key || undefined}
      >
        {label}
        {long && <span className="sr-only"> {long}</span>}
        <span aria-hidden className="numeral text-micro">
          {sort === key ? (dir === "desc" ? "▼" : "▲") : "▽"}
        </span>
      </Link>
    </th>
  );

  return (
    <Panel id="sektor-performansi" className={styles.board}>
      {/* Ana sayfanın sektör bağlantısı buraya iniyor; üstteki bölümler
          sonradan akıp kısaldığı için iniş sayfa oturana kadar tutuluyor
          (gerekçe ve ölçüm AnchorSettle'da). */}
      <AnchorSettle id="sektor-performansi" />
      <PanelHeader title={x.sectorsTitle} meta={x.sectorsMeta} />
      {!hasData ? (
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      ) : (
        <>
          <div className={styles.heatHead}>
            {leaders && (
              <p className={styles.heatLead}>
                {v.sectorLead
                  .replace("{best}", leaders.best.name)
                  .replace("{bestValue}", formatPercent(leaders.best.value, locale))
                  .replace("{worst}", leaders.worst.name)
                  .replace("{worstValue}", formatPercent(leaders.worst.value, locale))
                  .replace("{total}", String(leaders.total))
                  .replace("{up}", String(leaders.up))}
              </p>
            )}
            <div className={styles.heatKey}>
              <p className={styles.heatLegend} aria-hidden>
                <span>{v.heatLegendDown}</span>
                {LEGEND_STEPS.map((step, i) => (
                  <i key={i} className={styles.heat} data-tone={step.tone} style={{ "--heat": step.share } as CSSProperties} />
                ))}
                <span>{v.heatLegendUp}</span>
              </p>
              <p className={cn("numeral", styles.heatScale)}>
                <span>{v.heatScale}</span>{" "}
                {SECTOR_COLUMNS.map((key) => `${labels[key].short} ±${formatPercentPlain(peak[key], locale, 0)}`).join(" · ")}
              </p>
            </div>
          </div>
          {/* Sabit etiket sütunu + kaydırma (CLAUDE.md "Kaydırma saklanmaz"):
              beş yüzde sütunu 390 pikselde sığmıyor. Tablo `table-fixed` ile
              kaba zorlanmıyor, tabana genişlik veriliyor ve kap kayıyor. */}
          <ScrollEdges
            fixedStart
            className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
            tabIndex={0}
            role="region"
            aria-label={x.sectorsTitle}
          >
            <table className={cn(styles.table, styles.heatTable)}>
              <caption className="sr-only">{x.sectorsTitle}</caption>
              <thead>
                <tr>
                  {head("ad", x.sectorColumn, null, styles.labelHead)}
                  {SECTOR_COLUMNS.map((key) => head(key, labels[key].short, labels[key].long, styles.valueHead))}
                </tr>
              </thead>
              <tbody data-motion-stagger>
                {ordered.map((row) => (
                  <tr key={row.symbol}>
                    <th scope="row" className={styles.labelCell}>
                      <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.labelLink}>
                        <span className={styles.labelName}>{row.name}</span>
                        <span className={cn("numeral", styles.labelSymbol)}>{row.symbol}</span>
                      </Link>
                    </th>
                    {SECTOR_COLUMNS.map((key) => (
                      <HeatCell
                        key={key}
                        value={valueOf(row, key)}
                        peak={peak[key]}
                        locale={locale}
                        lastClose={key === "g1" && row.lastClose}
                        lastCloseLabel={t.market.lastClose}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollEdges>
          <div className={styles.notes}>
            <p>{v.heatNote}</p>
            <p>{x.sectorsProxyNote}</p>
            <p>{x.dayNote}</p>
            <p>{x.periodNote}</p>
          </div>
        </>
      )}
      <BoardStamp quotes={quotes} lastDate={lastDate} locale={locale} t={t} />
    </Panel>
  );
}

/* ==========================================================================
   Emtia — fon vekilleri, iki grup
   ========================================================================== */

const COMMODITY_COLUMNS: readonly ColumnKey[] = ["g1", "a1", "ybb"];

export async function CommodityBoard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const status = await getStatus();
  const [commodities, crypto] = await Promise.all([
    loadRows(COMMODITY_ETFS, locale, status),
    loadRows(CRYPTO_ETFS, locale, status),
  ]);
  const all = [...commodities.rows, ...crypto.rows];
  const hasData = all.some((row) => row.quote || row.returns.lastDate);
  /* Ölçek İKİ GRUBUN TOPLAMINDAN: kripto fonları emtianın birkaç katı
     oynuyor ve grup başına ölçek, IBIT'in %6'sını GLD'nin %1'iyle aynı
     uzunlukta çizerdi. Tek ölçekte kripto satırları doğal olarak uzun. */
  const peak = peaks(all, COMMODITY_COLUMNS);
  const labels: Record<ColumnKey, { short: string; long: string }> = {
    g1: { short: x.colDay, long: x.colDayLong },
    h1: { short: x.colWeek, long: x.colWeekLong },
    a1: { short: x.colMonth, long: x.colMonthLong },
    a3: { short: x.colQuarter, long: x.colQuarterLong },
    ybb: { short: x.colYtd, long: x.colYtdLong },
  };

  const group = (title: string, rows: BoardRow[]) => (
    <tbody key={title}>
      <tr className={styles.groupRow}>
        <th scope="colgroup" colSpan={2 + COMMODITY_COLUMNS.length}>
          <span className={styles.groupLabel}>{title}</span>
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.symbol}>
          <th scope="row" className={styles.labelCell}>
            <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.labelLink}>
              {/* Satırın adı FONUN adı: "GLD · Altın ETF". Emtianın adı
                  tek başına yazılsaydı yanındaki fiyat emtianın fiyatı
                  gibi okunurdu (gerekçe lib/market-boards.ts). */}
              <span className={styles.labelName}>
                <span className="numeral">{row.symbol}</span>
                <span aria-hidden> · </span>
                {x.etfLabel.replace("{name}", row.name)}
              </span>
            </Link>
          </th>
          {/* Fiyat çubuksuz: farklı fonların fiyatları karşılaştırılabilir
              bir ölçü değil (CompareScale yorumu). */}
          <td className={styles.valueCell}>
            <span className="numeral font-semibold text-strong">
              {row.quote ? formatPrice(row.quote.price, locale) : NO_VALUE}
            </span>
          </td>
          {COMMODITY_COLUMNS.map((key) => (
            <ReturnCell
              key={key}
              value={valueOf(row, key)}
              peak={peak[key]}
              locale={locale}
              lastClose={key === "g1" && row.lastClose}
              lastCloseLabel={t.market.lastClose}
            />
          ))}
        </tr>
      ))}
    </tbody>
  );

  return (
    <Panel id="emtia" className={styles.board}>
      <PanelHeader title={x.commoditiesTitle} meta={x.commoditiesMeta} />
      {!hasData ? (
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      ) : (
        <>
          <ScrollEdges
            fixedStart
            className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
            tabIndex={0}
            role="region"
            aria-label={x.commoditiesTitle}
          >
            <table className={cn(styles.table, styles.tableCompact)}>
              <caption className="sr-only">{x.commoditiesTitle}</caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.labelHead}>{x.fundColumn}</th>
                  <th scope="col" className={styles.valueHead}>{x.priceColumn}</th>
                  {COMMODITY_COLUMNS.map((key) => (
                    <th key={key} scope="col" className={styles.valueHead}>
                      {labels[key].short}
                      <span className="sr-only"> {labels[key].long}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              {group(x.commodityGroup, commodities.rows)}
              {group(x.cryptoGroup, crypto.rows)}
            </table>
          </ScrollEdges>
          <div className={styles.notes}>
            <p>{x.commoditiesNote}</p>
            <p>{x.cryptoNote}</p>
            <p>{x.dayNote}</p>
          </div>
        </>
      )}
      <BoardStamp
        quotes={commodities.quotes}
        lastDate={[commodities.lastDate, crypto.lastDate].filter((date): date is string => Boolean(date)).sort().at(-1) ?? null}
        locale={locale}
        t={t}
      />
    </Panel>
  );
}
