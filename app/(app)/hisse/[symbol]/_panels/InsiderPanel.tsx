import { DataError, DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import type { Dictionary, Locale } from "@/lib/i18n";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getStatus } from "@/lib/data";
import { getQuote } from "@/lib/providers";
import { getInsiderSentiment, getInsiderTransactions } from "@/lib/providers/finnhub-depth";
import { getInsiderRoles } from "@/lib/providers/sec-form4";
import { displayInsiderName, roleLine, type InsiderRoleLabels } from "@/lib/insider-people";
import {
  groupInsiderRows,
  isInsiderCode,
  isOpenMarket,
  openMarketSummary,
  sanitizeTradePrices,
  sentimentSeries,
  type InsiderTrade,
} from "@/lib/insider";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatEtDateMedium,
  formatMoneyCompact,
  formatPrice,
  formatVolume,
  NO_VALUE,
  plural,
} from "@/lib/utils";
import styles from "./depth.module.css";
import { ClampProbe } from "./ClampProbe";
import { FoldToggle } from "./FoldToggle";

/** Pencere — Form 4 iki iş günü içinde dosyalanıyor; 90 gün bir çeyrek. */
const INSIDER_WINDOW_DAYS = 90;
/** MSPR serisi kaç ay — bir yıl, çubuklar 390 pikselde 24 piksel kalıyor. */
const SENTIMENT_MONTHS = 12;
/** Serinin başı: bir yıl + bir ay pay (içinde bulunulan ay yarım). */
const SENTIMENT_LOOKBACK_DAYS = 400;
/** Tabloda kaç işlem — gerisi "N İşlem Daha" künyesinde sayılıyor. */
const INSIDER_ROWS = 10;
/** Dar ekranda açık gelen satır — gerisi `FoldToggle` ile açılıyor. */
const INSIDER_FOLD = 5;
/** MSPR'nin mutlak tavanı — çubuk bu değerde dolu. */
const MSPR_MAX = 100;
/** Yüzde tabanı — denge çubuğunun künyesi. */
const PERCENT = 100;

function codeLabel(code: string, t: Dictionary): string {
  const labels = t.stockDepth.insiderCodes;
  return isInsiderCode(code) ? labels[code] : t.stockDepth.insiderCodeOther.replace("{code}", code);
}

function monthLabel(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
}

/**
 * İçeriden işlemler — son 90 günün Form 4 kayıtları ve aylık MSPR serisi.
 *
 * SIRA EKRAN KURALINDA: önce ölçü (açık piyasa alım, satım, net), sonra
 * çizim (MSPR), sonra kayıtlar (tablo), en altta künye ve kaynak. Özet
 * yalnızca açık piyasa işlemlerini sayıyor; gerekçesi lib/insider.ts başında.
 *
 * OKUMA KATMANI (29 Eylül, sahibinin isteği: "çok tek düze ve okuması
 * zor"). Tabloda her satır aynı ağırlıktaydı: bir CEO'nun 300 milyonluk
 * açık piyasa satışı ile maaşın parçası olan vergi kesintisi aynı puntoda,
 * aynı renkte, türü düz metinle yazılıyordu. Ayrım artık görsel:
 *   - Tür bir çip. Açık piyasa kararı yön renginde tonlu ("Satış", "Alım"),
 *     karar olmayan hareket nötr ve sönük; o satırların sayıları da sönük.
 *     Göz önce kararlara gidiyor, ötekiler okunabilir ama geri planda.
 *   - Tutarın altında ince bir büyüklük çubuğu, YALNIZCA açık piyasa
 *     satırlarında ve tablodaki en büyük açık piyasa tutarına göre
 *     (CLAUDE.md: karşılaştırılan büyüklük bir de çizgi olarak okunur).
 *     Vergi kesintisinin tutarı bir karar büyüklüğü değil, çubuğa girmez.
 *   - Tarih kısa ("21 Eyl"; yıl yalnızca bu yıldan değilse) ve aynı günün
 *     ardışık satırlarında bir kez: gün bir grup başlığı gibi okunuyor.
 *   - Görev tek satır, tamamı `title`da; baş harf rozeti aynı kişinin
 *     satırlarını isim okumadan tanıtıyor (geniş ekranda).
 * Sol sütunda alım/satış dengesi tek iki renkli çubuk; üç uzun not bir
 * cümlelik okuma anahtarına ve "Nasıl Okunur" açılır satırına indi —
 * bilgi silinmedi, yalnızca ilk okumada yer tutmuyor. Fiyatı düşürülen
 * işlem uyarısı açık kalıyor: o bir açıklama değil, bu hissenin verisine
 * dair bir uyarı.
 */
export async function InsiderPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const d = t.stockDepth;
  const today = todayEt();
  const status = await getStatus();
  const [txResult, sentimentResult, quote] = await Promise.all([
    getInsiderTransactions(symbol, addEtDays(today, -INSIDER_WINDOW_DAYS)),
    getInsiderSentiment(symbol, addEtDays(today, -SENTIMENT_LOOKBACK_DAYS), today),
    /* Fiyat denetimi için — başlıkla aynı istek-içi anahtar, ek tur yok. */
    getQuote(symbol, status),
  ]);

  const header = <PanelHeader title={d.insiderTitle} meta={d.insiderWindow} />;
  if (!txResult.ok) {
    return (
      <Panel className={styles.panel}>
        {header}
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  const trades = sanitizeTradePrices(groupInsiderRows(txResult.data), quote.ok ? quote.data.price : null);
  const dropped = trades.filter((trade) => trade.priceDropped).length;
  const summary = openMarketSummary(trades);
  const hasOpenMarket = summary.buyers + summary.sellers > 0;
  const series = sentimentResult.ok ? sentimentSeries(sentimentResult.data, today.slice(0, 7), SENTIMENT_MONTHS) : [];
  const hasSentiment = series.some((month) => month !== null);

  if (trades.length === 0 && !hasSentiment) {
    return (
      <Panel className={styles.panel}>
        {header}
        <EmptyState compact title={d.insiderEmpty} hint={d.insiderEmptyHint} />
      </Panel>
    );
  }

  const people = (n: number) => plural(n, d.insiderPersonOne, d.insiderPersonMany).replace("{n}", String(n));
  const shown = trades.slice(0, INSIDER_ROWS);
  /* Görev SEC'in kendi dosyasından (Finnhub satırı taşımıyor); düşerse boş
     eşleme ve satırlar yalnızca isimle kalır. Gerekçe lib/insider-people.ts. */
  const roles = await getInsiderRoles(symbol, shown);
  const roleLabels: InsiderRoleLabels = {
    director: d.insiderRoleDirector,
    tenPercent: d.insiderRoleTenPercent,
    officer: d.insiderRoleOfficer,
  };
  const roleOf = (name: string): string | null => {
    const owner = roles.get(name);
    return owner ? roleLine(owner, locale, roleLabels) : null;
  };
  const hasRoles = shown.some((trade) => roleOf(trade.name) !== null);
  /* Geniş ekranda iki sütun ancak iki taraf da doluysa: kayıt yoksa (yalnız
     MSPR) sol sütun tek başına kalır, sağı boş bir yarım panel olurdu. */
  const split = shown.length > 0;
  const tradeTotal = summary.buyValue + summary.sellValue;
  const balance =
    hasOpenMarket && summary.buyUnpriced + summary.sellUnpriced === 0 && tradeTotal > 0
      ? (() => {
          const buy = Math.round((summary.buyValue / tradeTotal) * PERCENT);
          return { buy, sell: PERCENT - buy };
        })()
      : null;
  const latest = [...series].reverse().find((month) => month !== null) ?? null;
  /* Tutar çubuğunun tavanı: tablodaki en büyük AÇIK PİYASA tutarı. */
  const maxOpenValue = Math.max(
    0,
    ...shown.filter((trade) => !trade.derivative && isOpenMarket(trade.code)).map((trade) => trade.value ?? 0),
  );

  return (
    <Panel className={styles.panel}>
      {header}
      <div className={cn(styles.body, styles.insiderBody)} data-split={split ? "" : undefined}>
        <div className={styles.insiderAside}>
        {hasOpenMarket ? (
          <dl className={styles.readings}>
            <div className={styles.reading}>
              <dt>{d.insiderBuy}</dt>
              <dd className={cn("numeral", styles.readingValue)}>
                {summary.buyPriced > 0 || summary.buyUnpriced === 0 ? formatMoneyCompact(summary.buyValue, locale) : NO_VALUE}
              </dd>
              <dd className={styles.readingMeta}>{people(summary.buyers)}</dd>
            </div>
            <div className={styles.reading}>
              <dt>{d.insiderSell}</dt>
              <dd className={cn("numeral", styles.readingValue)}>
                {summary.sellPriced > 0 || summary.sellUnpriced === 0 ? formatMoneyCompact(summary.sellValue, locale) : NO_VALUE}
              </dd>
              <dd className={styles.readingMeta}>{people(summary.sellers)}</dd>
            </div>
            {/* Net ancak iki taraf da tam fiyatlıysa: fiyatı düşen bir işlem
                varken fark, eksik bir toplamdan kurulmuş olurdu. */}
            {summary.buyUnpriced + summary.sellUnpriced === 0 && (
            <div className={styles.reading}>
              <dt>{d.insiderNet}</dt>
              {/* Renk yalnızca işaretten: net alım artı, net satım eksi. */}
              <dd className={cn("numeral", styles.readingValue, directionText(directionOf(summary.netValue)))}>
                {summary.netValue > 0 ? "+" : summary.netValue < 0 ? "−" : ""}
                {formatMoneyCompact(Math.abs(summary.netValue), locale)}
              </dd>
            </div>
            )}
          </dl>
        ) : (
          trades.length > 0 && <p className="pb-3 text-small leading-relaxed text-body">{d.insiderNoOpenMarket}</p>
        )}

        {/* DENGE ÇUBUĞU: alım tutarı ile satış tutarı tek şeritte. Ancak iki
            taraf da tam fiyatlıysa (Net ile aynı koşul): fiyatı düşen bir
            işlem varken oran eksik bir toplamdan kurulurdu. Oran künyede
            metin olarak da var; çizim ARIA'dan gizli. */}
        {balance && (
          <div className={styles.balance}>
            <div className={styles.balanceHead}>
              <span>{d.insiderBalance}</span>
              <span className="numeral">
                {d.insiderBalanceShare.replace("{buy}", String(balance.buy)).replace("{sell}", String(balance.sell))}
              </span>
            </div>
            <div aria-hidden className={styles.balanceBar}>
              {summary.buyValue > 0 && <i data-sign="up" style={{ flexGrow: summary.buyValue }} />}
              {summary.sellValue > 0 && <i data-sign="down" style={{ flexGrow: summary.sellValue }} />}
            </div>
          </div>
        )}

        {hasSentiment && (
          <div className={styles.sentiment}>
            <div className={styles.sentimentHead}>
              <p className={styles.sentimentLabel}>{d.sentimentTitle}</p>
              {latest && (
                <p className={cn("numeral", styles.sentimentLatest)}>
                  {d.sentimentLatest.replace("{month}", monthLabel(latest.month, locale)).replace("{value}", "")}
                  <span className={directionText(directionOf(latest.mspr))}>{formatMspr(latest.mspr)}</span>
                </p>
              )}
            </div>
            {/* Çizim ARIA'dan gizli; en yeni ayın değeri başlıkta metin.
                Sağdaki iki etiket sıfır çizgisinin iki yanının ne anlattığını
                söylüyor: çubuk yukarıdaysa o ay alım ağır basmış. */}
            <div className={styles.sentimentPlot}>
            <div aria-hidden className={styles.bars}>
              {series.map((month, index) => (
                <span key={month?.month ?? `bos-${index}`} className={styles.bar}>
                  {month ? (
                    <i
                      data-sign={month.mspr >= 0 ? "up" : "down"}
                      style={{ height: `${(Math.min(MSPR_MAX, Math.abs(month.mspr)) / MSPR_MAX) * 50}%` }}
                    />
                  ) : (
                    <b />
                  )}
                </span>
              ))}
            </div>
            <div aria-hidden className={styles.sentimentScale}>
              <span>{d.insiderChipBuy}</span>
              <span>{d.insiderChipSell}</span>
            </div>
            </div>
            <div className={cn("numeral", styles.barAxis)}>
              <span>{monthLabel(addMonths(today.slice(0, 7), 1 - SENTIMENT_MONTHS), locale)}</span>
              <span>{monthLabel(today.slice(0, 7), locale)}</span>
            </div>
          </div>
        )}
        </div>

        {split && (
          <div className={styles.insiderRecords}>
          {/* GENİŞ EKRANDA SOL SÜTUNUN BOYUNDA (28 Eylül, sahibinin
              isteği: "başta aynı hizada aç, tümünü gör derse uzatırsın").
              Tablo sol sütundan ~140 piksel uzun bitiyordu. Kutu sol
              sütunun boyunda kesiliyor, altı soluyor; onay kutusu açınca
              tam boyuna uzuyor. Dar ekranda katlamayı `FoldToggle`
              yapıyor, bu kutu orada devre dışı. */}
          <input
            type="checkbox"
            id={`insider-all-${symbol}`}
            data-clamp-input
            className={cn("sr-only", styles.clampInput)}
          />
          <div data-clamp-box className={styles.clampBox}>
          <FoldToggle
            id={`insider-fold-${symbol}`}
            hiddenCount={shown.length - INSIDER_FOLD}
            more={d.insiderShowMore.replace("{n}", String(shown.length - INSIDER_FOLD))}
            less={t.common.less}
          >
          <ScrollEdges
            className="scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
            tabIndex={0}
            role="region"
            aria-label={d.insiderTitle}
          >
            <table className={cn(styles.table, styles.insiderTable)}>
              <thead>
                <tr>
                  <th scope="col">{d.insiderColName}</th>
                  <th scope="col">{d.insiderColDate}</th>
                  <th scope="col">{d.insiderColType}</th>
                  <th scope="col">{d.insiderColShares}</th>
                  <th scope="col">{d.insiderColPrice}</th>
                  <th scope="col">{d.insiderColValue}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((trade, index) => (
                  <InsiderRow
                    key={trade.key}
                    trade={trade}
                    role={roleOf(trade.name)}
                    folded={index >= INSIDER_FOLD}
                    sameDay={index > 0 && shown[index - 1]!.date === trade.date}
                    thisYear={today.slice(0, 4)}
                    maxValue={maxOpenValue}
                    locale={locale}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </ScrollEdges>
          </FoldToggle>
        {trades.length > shown.length && (
          <p className="numeral mt-2 text-tiny text-muted">
            {/* CÜMLE, SAYAÇ DEĞİL (28 Eylül). "10 İşlem Daha" künyesi dar
                ekranda katlama düğmesinin ("5 İşlem Daha Göster") hemen
                altına düşüyordu; biri katlanan satırları, öteki hiç
                basılmayanları sayıyordu ve yan yana aynı şeyi söylüyor
                gibi okunuyordu. */}
            {d.insiderMore
              .replace("{shown}", String(shown.length))
              .replace("{n}", String(trades.length - shown.length))}
          </p>
        )}
          </div>
          <label htmlFor={`insider-all-${symbol}`} className={styles.clampButton}>
            <span className={styles.clampMore}>{t.common.showAll}</span>
            <span className={styles.clampLess}>{t.common.less}</span>
          </label>
          <ClampProbe />
          </div>
        )}

        <div className={styles.insiderNotes}>

        {/* Okuma anahtarı tek cümle ve açık; yöntem notları "Nasıl Okunur"
            altında. Fiyat uyarısı bu hisseye özgü, açık kalıyor. */}
        {split && <p className={styles.note}>{d.insiderLegend}</p>}
        {dropped > 0 && (
          <p className={styles.note}>{d.insiderPriceDropped.replace("{n}", String(dropped))}</p>
        )}
        <details className={styles.how}>
          <summary>{d.insiderHowTitle}</summary>
          <p>{d.insiderNote}</p>
          {hasRoles && <p>{d.insiderRolesNote}</p>}
          {hasSentiment && <p>{d.sentimentNote}</p>}
        </details>
        <DataStamp
          labels={t.data}
          source={txResult.source}
          at={txResult.fetchedAt}
          stale={txResult.stale}
          locale={locale}
          className={styles.stamp}
        />
        </div>
      </div>
    </Panel>
  );
}

function InsiderRow({
  trade,
  role,
  folded,
  sameDay,
  thisYear,
  maxValue,
  locale,
  t,
}: {
  trade: InsiderTrade;
  role: string | null;
  /** Dar ekranda katlı gelen satır (`FoldToggle`). */
  folded: boolean;
  /** Bir önceki satırla aynı gün — tarih yalnızca ekran okuyucuya. */
  sameDay: boolean;
  /** "2026" — tarih bu yıldansa yıl yazılmıyor. */
  thisYear: string;
  /** Tablodaki en büyük açık piyasa tutarı (çubuğun tavanı). */
  maxValue: number;
  locale: Locale;
  t: Dictionary;
}) {
  const open = !trade.derivative && isOpenMarket(trade.code);
  const name = displayInsiderName(trade.name);
  const label = codeLabel(trade.code, t);
  const date = trade.date.startsWith(thisYear)
    ? formatEtDateCompact(trade.date, locale)
    : formatEtDateMedium(trade.date, locale);
  const side = trade.code === "P" ? "up" : "down";
  const barPct = open && trade.value !== null && maxValue > 0 ? (trade.value / maxValue) * PERCENT : null;
  return (
    <tr data-fold={folded ? "" : undefined} data-open={open ? "" : undefined}>
      {/* Özgün SEC adı `title`da: okunuş için sıra çevrilmiş olabilir. */}
      <td>
        <span className={styles.person}>
          <span aria-hidden className={styles.initials}>{initialsOf(name)}</span>
          <span className={styles.personText}>
            <span className={styles.nameCell} title={trade.name}>{name}</span>
            {role && (
              <span className={styles.roleCell} title={role}>
                {role}
              </span>
            )}
          </span>
        </span>
      </td>
      <td className={cn("numeral", styles.dateCell)}>
        {sameDay ? <span className="sr-only">{date}</span> : date}
      </td>
      <td>
        {/* Açık piyasa kararı yön renginde kısa çip, tam adı `title`da;
            karar olmayan hareket nötr çip, kodunun adıyla. */}
        {open ? (
          <span className={styles.chip} data-side={side} title={label}>
            {side === "up" ? t.stockDepth.insiderChipBuy : t.stockDepth.insiderChipSell}
          </span>
        ) : (
          <span className={styles.chip}>{label}</span>
        )}
        {trade.derivative && <span className={styles.tag}>{t.stockDepth.insiderDerivative}</span>}
      </td>
      {/* Pay işaretli: eksi elden çıkan. Renk yalnızca açık piyasada — ödülün
          "artısı" bir alım kararı değil, yeşil boyanmamalı. */}
      <td className={cn("numeral", open ? directionText(directionOf(trade.shares)) : "text-muted")}>
        {trade.shares > 0 ? "+" : "−"}
        {formatVolume(Math.abs(trade.shares), locale)}
      </td>
      <td className={cn("numeral", open ? "text-body" : "text-muted")}>
        {trade.price !== null ? formatPrice(trade.price, locale, { currency: true }) : NO_VALUE}
      </td>
      <td className={cn("numeral", open ? "font-semibold text-strong" : "text-muted")}>
        {trade.value !== null ? formatMoneyCompact(trade.value, locale) : NO_VALUE}
        {barPct !== null && (
          <span aria-hidden className={styles.valueBar} data-side={side}>
            <i style={{ width: `${barPct}%` }} />
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Baş harf rozeti: ilk ve son kelimenin ilk harfi ("Jen Hsun Huang" → "JH").
 * Tek harflik göbek baş harfi atlanır; tüzel kişide de aynı kural.
 */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /\p{L}{2,}/u.test(word));
  const first = words[0]?.match(/\p{L}/u)?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]!.match(/\p{L}/u)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("en-US");
}

/** MSPR işaretli ve tam sayı: "+42", "−100". */
function formatMspr(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}`;
}

/** "2026-09" + n ay. */
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y! * 12 + (m! - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
