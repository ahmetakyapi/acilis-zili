"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import type { KurRate, KurResponse } from "@/app/api/kur/route";
import type { IndexResponse } from "@/app/api/kur/endeks/route";
import { Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  addDays,
  formatIsoDate,
  formatIsoMonth,
  formatLira,
  formatRate,
  isIsoDate,
  TCMB_MIN_DATE,
} from "@/lib/fx";
import { parseTaxHandoff, TAX_HANDOFF_KEY } from "@/lib/portfolio";
import {
  dividendResult,
  indexMonthsFor,
  lotResult,
  matchFifo,
  progressiveTax,
  TAX_YEAR_LIST,
  TAX_YEARS,
  toCsv,
  US_WITHHOLDING,
  yearTotals,
  type TradeInput,
  type TradeSide,
} from "@/lib/tax";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, directionOf, directionText, formatPrice, isValidSymbol } from "@/lib/utils";

/**
 * YURT DIŞI HİSSE VERGİSİ HESAPLAYICISI — tamamen istemcide.
 *
 * HİÇBİR ŞEY SAKLANMIYOR: girilen işlemler sunucuya gitmiyor, tarayıcı
 * deposuna da yazılmıyor. Sunucuya giden tek şey TARİHLER (kur sorusu,
 * `/api/kur`) ve AY aralığı (Yİ-ÜFE, `/api/kur/endeks`) — adet, fiyat ve
 * sembol değil. Sayfa yenilenince döküm gider; CSV indirmek bunun için var.
 *
 * Kurallar ve aritmetik `lib/tax.ts`te (kaynaklarıyla); bu bileşen girdiyi
 * topluyor, kurları getiriyor ve sonucu çiziyor.
 */

export type TaxLabels = Dictionary["lira"]["tax"];

type TradeRow = {
  id: string;
  side: TradeSide;
  symbol: string;
  date: string;
  quantity: string;
  price: string;
  commission: string;
};

type DividendRow = {
  id: string;
  symbol: string;
  date: string;
  gross: string;
  withholding: "w8ben" | "none";
};

type RateState = Record<string, KurRate | null>;

/** Kur isteğinin bekleme süresi — yazarken her tuşta istek açılmasın. */
const RATE_DEBOUNCE_MS = 500;
/** `/api/kur` toplu istek tavanıyla aynı. */
const RATE_BATCH = 40;

let rowSeq = 0;
function nextId(prefix: string): string {
  rowSeq += 1;
  return `${prefix}${rowSeq}`;
}

/** "12,5" ve "12.5" ikisi de sayı; boş ya da bozuk alan null. */
function num(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(value) ? value : null;
}

export function TaxCalculator({
  labels,
  locale,
  indexAuto,
  today,
}: {
  labels: TaxLabels;
  locale: Locale;
  /** Yİ-ÜFE kaynağı (EVDS anahtarı) bu kurulumda açık mı. */
  indexAuto: boolean;
  /** İstanbul'un bugünü — tarih alanlarının üst sınırı. */
  today: string;
}) {
  const [year, setYear] = useState<number>(TAX_YEAR_LIST[0]);
  const [rateDay, setRateDay] = useState<"same" | "previous">("same");
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [dividends, setDividends] = useState<DividendRow[]>([]);
  const [rates, setRates] = useState<RateState>({});
  const [ratesFailed, setRatesFailed] = useState(false);
  const [pendingRates, setPendingRates] = useState(false);
  const [imported, setImported] = useState(0);
  const [autoIndex, setAutoIndex] = useState<Record<string, number>>({});
  const [indexMode, setIndexMode] = useState<"auto" | "manual">(indexAuto ? "auto" : "manual");
  const [manualIndex, setManualIndex] = useState<Record<string, string>>({});
  const [thresholdInput, setThresholdInput] = useState<string>("");

  /* ---- Portföyden aktarım: bir kez oku, sonra SİL ---- */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(TAX_HANDOFF_KEY);
      window.sessionStorage.removeItem(TAX_HANDOFF_KEY);
    } catch {
      raw = null;
    }
    const positions = parseTaxHandoff(raw);
    if (positions.length === 0) return;
    /* Depo sunucuda yok, yani aktarım ilk çizimde okunamıyor: etkide ve
       bir kez. Güncelleme bir mikro görevde, etkinin gövdesinde değil —
       etki içinde eşzamanlı `setState` ikinci bir çizimi aynı karede
       zincirliyor (react-hooks/set-state-in-effect). */
    queueMicrotask(() => {
      setTrades((prev) => [
        ...positions.map((p) => ({
          id: nextId("t"),
          side: "buy" as const,
          symbol: p.symbol,
          date: p.boughtAt,
          quantity: String(p.quantity),
          price: String(p.costUsd),
          commission: "",
        })),
        ...prev,
      ]);
      setImported(positions.length);
    });
  }, []);

  const rateDateOf = useCallback(
    (date: string) => (rateDay === "same" ? date : addDays(date, -1)),
    [rateDay],
  );

  /* ---- Girdiden hesap girdisine ---- */
  const parsedTrades: TradeInput[] = useMemo(
    () =>
      trades.flatMap((row) => {
        const quantity = num(row.quantity);
        const price = num(row.price);
        const commission = row.commission.trim() === "" ? 0 : num(row.commission);
        const symbol = row.symbol.trim().toUpperCase();
        if (
          !isValidSymbol(symbol) ||
          !isIsoDate(row.date) ||
          row.date < TCMB_MIN_DATE ||
          row.date > today ||
          quantity === null ||
          quantity <= 0 ||
          price === null ||
          price < 0 ||
          commission === null ||
          commission < 0
        ) {
          return [];
        }
        return [
          {
            id: row.id,
            side: row.side,
            symbol,
            date: row.date,
            quantity,
            priceUsd: price,
            commissionUsd: commission,
          },
        ];
      }),
    [trades, today],
  );

  const { lots, shortfalls } = useMemo(() => matchFifo(parsedTrades), [parsedTrades]);
  const yearPrefix = `${year}-`;
  const yearLots = useMemo(
    () => lots.filter((lot) => lot.sellDate.startsWith(yearPrefix)),
    [lots, yearPrefix],
  );
  const yearShortfalls = shortfalls.filter((s) => s.date.startsWith(yearPrefix));

  const parsedDividends = useMemo(
    () =>
      dividends.flatMap((row) => {
        const gross = num(row.gross);
        const symbol = row.symbol.trim().toUpperCase();
        if (!isValidSymbol(symbol) || !isIsoDate(row.date) || gross === null || gross < 0) return [];
        if (!row.date.startsWith(yearPrefix) || row.date > today) return [];
        return [
          {
            id: row.id,
            symbol,
            date: row.date,
            grossUsd: gross,
            withholdingPct: US_WITHHOLDING[row.withholding],
          },
        ];
      }),
    [dividends, yearPrefix, today],
  );

  /* ---- Kurlar: eksik günler toplu ve gecikmeli ---- */
  const neededDates = useMemo(() => {
    const set = new Set<string>();
    for (const lot of yearLots) {
      set.add(rateDateOf(lot.buyDate));
      set.add(rateDateOf(lot.sellDate));
    }
    for (const dividend of parsedDividends) set.add(rateDateOf(dividend.date));
    return [...set].filter((date) => date >= TCMB_MIN_DATE).sort();
  }, [yearLots, parsedDividends, rateDateOf]);
  const missingKey = neededDates.filter((date) => !(date in rates)).join(",");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!missingKey) return;
    const missing = missingKey.split(",").slice(0, RATE_BATCH);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPendingRates(true);
      fetch(`/api/kur?tarihler=${missing.join(",")}`)
        .then((res) => res.json() as Promise<KurResponse>)
        .then((data) => {
          if (cancelled) return;
          if (!data.ok) {
            setRatesFailed(true);
            return;
          }
          setRatesFailed(Object.values(data.rates).some((rate) => rate === null));
          /* Bulunamayan gün de yazılıyor (null): aynı gün her tuşta yeniden
             sorulmasın. "Tekrar Dene" onları siliyor. */
          setRates((prev) => ({ ...prev, ...data.rates }));
        })
        .catch(() => {
          if (!cancelled) setRatesFailed(true);
        })
        .finally(() => {
          if (!cancelled) setPendingRates(false);
        });
    }, RATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [missingKey, retryTick]);

  const retryRates = () => {
    setRates((prev) => {
      const next: RateState = {};
      for (const [date, rate] of Object.entries(prev)) if (rate) next[date] = rate;
      return next;
    });
    setRatesFailed(false);
    setRetryTick((tick) => tick + 1);
  };

  /* ---- Yİ-ÜFE ---- */
  const indexMonths = useMemo(() => {
    const set = new Set<string>();
    for (const lot of yearLots) {
      const months = indexMonthsFor(lot.buyDate, lot.sellDate);
      set.add(months.buy);
      set.add(months.sell);
    }
    return [...set].sort();
  }, [yearLots]);
  const indexRangeKey =
    indexMonths.length > 0 ? `${indexMonths[0]}:${indexMonths[indexMonths.length - 1]}` : "";
  const fetchedIndexRange = useRef<string>("");

  useEffect(() => {
    if (indexMode !== "auto" || !indexRangeKey || fetchedIndexRange.current === indexRangeKey) return;
    const [from, to] = indexRangeKey.split(":");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchedIndexRange.current = indexRangeKey;
      fetch(`/api/kur/endeks?seri=yiufe&baslangic=${from}&bitis=${to}`)
        .then((res) => res.json() as Promise<IndexResponse>)
        .then((data) => {
          if (cancelled) return;
          if (!data.ok) {
            /* Kaynak kapalı ya da düştü: alanlar okuyucuya açılıyor. */
            setIndexMode("manual");
            return;
          }
          setAutoIndex((prev) => {
            const next = { ...prev };
            for (const entry of data.values) next[entry.month] = entry.value;
            return next;
          });
        })
        .catch(() => {
          if (!cancelled) setIndexMode("manual");
        });
    }, RATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [indexMode, indexRangeKey]);

  const indexOf = useCallback(
    (month: string): number | null => {
      if (indexMode === "auto") return autoIndex[month] ?? null;
      const value = num(manualIndex[month] ?? "");
      return value !== null && value > 0 ? value : null;
    },
    [indexMode, autoIndex, manualIndex],
  );

  /* ---- Sonuç ---- */
  const rules = TAX_YEARS[year];
  const results = useMemo(
    () =>
      yearLots.map((lot) => {
        const months = indexMonthsFor(lot.buyDate, lot.sellDate);
        return lotResult(
          lot,
          rates[rateDateOf(lot.buyDate)]?.buying ?? null,
          rates[rateDateOf(lot.sellDate)]?.buying ?? null,
          indexOf(months.buy),
          indexOf(months.sell),
        );
      }),
    [yearLots, rates, rateDateOf, indexOf],
  );
  const totals = yearTotals(results);
  const estTax = progressiveTax(Math.max(0, totals.gainTl), rules.brackets);

  const dividendResults = parsedDividends.map((d) =>
    dividendResult(d, rates[rateDateOf(d.date)]?.buying ?? null),
  );
  const dividendGrossTl = dividendResults.reduce((sum, d) => sum + (d.grossTl ?? 0), 0);
  const dividendWithheldTl = dividendResults.reduce((sum, d) => sum + (d.withheldTl ?? 0), 0);
  const threshold = num(thresholdInput) ?? rules.dividendThreshold;

  /* ---- Satır düzenleme ---- */
  const addTrade = (side: TradeSide) =>
    setTrades((prev) => [
      ...prev,
      { id: nextId("t"), side, symbol: "", date: "", quantity: "", price: "", commission: "" },
    ]);
  const updateTrade = (id: string, patch: Partial<TradeRow>) =>
    setTrades((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeTrade = (id: string) => setTrades((prev) => prev.filter((row) => row.id !== id));
  const addDividend = () =>
    setDividends((prev) => [
      ...prev,
      { id: nextId("d"), symbol: "", date: "", gross: "", withholding: "w8ben" },
    ]);
  const updateDividend = (id: string, patch: Partial<DividendRow>) =>
    setDividends((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeDividend = (id: string) => setDividends((prev) => prev.filter((row) => row.id !== id));

  /* ---- CSV ---- */
  const downloadCsv = () => {
    const rows: (string | number | null)[][] = [
      [
        labels.symbol,
        labels.buyDate,
        labels.sellDate,
        labels.quantity,
        labels.buyRate,
        labels.sellRate,
        labels.costTl,
        labels.indexRatio,
        labels.taxCostTl,
        labels.proceedsTl,
        labels.gainTl,
      ],
      ...results.map((r) => [
        r.symbol,
        r.buyDate,
        r.sellDate,
        r.quantity,
        r.buyRate,
        r.sellRate,
        r.costTl,
        r.indexed ? r.indexRatio : null,
        r.taxCostTl,
        r.proceedsTl,
        r.gainTl,
      ]),
      [],
      [labels.totalProceeds, totals.proceedsTl],
      [labels.totalCost, totals.costTl],
      [labels.netGain, totals.gainTl],
      [],
      [labels.symbol, labels.date, labels.grossUsd, labels.withholding, labels.grossTl, labels.withheldTl],
      ...dividendResults.map((d) => [
        d.symbol,
        d.date,
        d.grossUsd,
        d.withholdingPct,
        d.grossTl,
        d.withheldTl,
      ]),
      [labels.totalGrossTl, dividendGrossTl],
      [labels.totalWithheldTl, dividendWithheldTl],
    ];
    const blob = new Blob([toCsv(rows, locale)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = labels.csvName.replace("{year}", String(year));
    link.click();
    URL.revokeObjectURL(url);
  };

  const usd = (value: number) => formatPrice(value, locale, { currency: true });
  const rateCell = (date: string) => {
    const rate = rates[rateDateOf(date)];
    if (rate === undefined) return <span className="text-muted">…</span>;
    if (rate === null) return <span className="text-down">{labels.rateMissing}</span>;
    return (
      <>
        {formatRate(rate.buying, locale)}
        {rate.bulletinDate !== date && (
          <span className="block text-nano text-muted">
            {labels.bulletinOf.replace("{date}", formatIsoDate(rate.bulletinDate, locale))}
          </span>
        )}
      </>
    );
  };

  return (
    <>
      {/* ---- Seçim şeridi: yıl, kur günü ve uyarı ---- */}
      <Panel>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          {/* UYARI EKRANIN EN ÜSTÜNDE ve kutusuz: ayrı bir kutu değil, bu
              panelin ilk satırı (ekran düzeni kuralı: uyarı için yeni kutu
              açılmaz). Başlığı Title Case, gövdesi cümle. */}
          <div className="flex items-start gap-3" role="note">
            <WarningCircle size={22} weight="duotone" className="mt-0.5 shrink-0 text-brass" aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 className="text-read font-bold text-strong">{labels.notAdvice}</h2>
              <p className="text-small leading-relaxed text-body">{labels.notAdviceBody}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-line-soft pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-body">{labels.yearLabel}</span>
              <select
                value={year}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  setThresholdInput("");
                }}
                className={cn(FIELD, "pr-8")}
              >
                {TAX_YEAR_LIST.map((y) => (
                  <option key={y} value={y}>
                    {labels.yearOption
                      .replace("{year}", String(y))
                      .replace("{filing}", String(TAX_YEARS[y].filingYear))}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-body" id="rate-day-label">
                {labels.rateDayLabel}
              </span>
              <span
                role="group"
                aria-labelledby="rate-day-label"
                className="inline-flex gap-0.5 rounded-full bg-surface-elevated p-[3px] text-small"
              >
                {(["same", "previous"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={rateDay === option}
                    onClick={() => setRateDay(option)}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-[7px] transition-colors sm:min-h-8",
                      rateDay === option
                        ? "bg-primary font-semibold text-on-primary"
                        : "text-body hover:text-strong",
                    )}
                  >
                    {option === "same" ? labels.rateDaySame : labels.rateDayPrevious}
                  </button>
                ))}
              </span>
            </div>
          </div>
          <p className="text-tiny leading-relaxed text-muted">{labels.rateDayHint}</p>
        </div>
      </Panel>

      {/* ---- İşlemler ---- */}
      <Panel>
        <PanelHeader
          title={labels.tradesTitle}
          action={
            <span className="flex gap-2">
              <button type="button" onClick={() => addTrade("buy")} className={buttonClass({ variant: "ghost", size: "sm" })}>
                <Plus size={14} weight="bold" aria-hidden />
                {labels.addBuy}
              </button>
              <button type="button" onClick={() => addTrade("sell")} className={buttonClass({ variant: "ghost", size: "sm" })}>
                <Plus size={14} weight="bold" aria-hidden />
                {labels.addSell}
              </button>
            </span>
          }
        />
        <p className="px-4 pb-3 text-small leading-relaxed text-muted sm:px-5">{labels.tradesHint}</p>
        {imported > 0 && (
          <p role="status" className="px-4 pb-3 text-small text-primary-ink sm:px-5">
            {labels.imported.replace("{count}", String(imported))}
          </p>
        )}
        {trades.length === 0 ? (
          <p className="border-t border-line-soft px-4 py-6 text-center text-sm text-muted sm:px-5">
            {labels.emptyTrades}
          </p>
        ) : (
          <div className="border-t border-line-soft">
            {/* Sütun başlıkları yalnızca geniş ekranda; telefonda her alan
                kendi etiketini taşıyor (satır iki sütunlu bir karta dönüyor). */}
            <div className={cn(TRADE_GRID, "hidden px-4 pt-3 text-nano text-muted sm:grid sm:px-5")} aria-hidden>
              <span>{labels.side}</span>
              <span>{labels.symbol}</span>
              <span>{labels.date}</span>
              <span>{labels.quantity}</span>
              <span>{labels.priceUsd}</span>
              <span>{labels.commissionUsd}</span>
              <span />
            </div>
            <ul className="divide-y divide-line-soft">
              {trades.map((row, index) => (
                <li key={row.id} className={cn(TRADE_GRID, "grid grid-cols-2 gap-2 px-4 py-3 sm:px-5")}>
                  <Field label={labels.side}>
                    <select
                      value={row.side}
                      onChange={(event) => updateTrade(row.id, { side: event.target.value as TradeSide })}
                      className={cn(FIELD, "pr-8")}
                    >
                      <option value="buy">{labels.sideBuy}</option>
                      <option value="sell">{labels.sideSell}</option>
                    </select>
                  </Field>
                  <Field label={labels.symbol}>
                    <input
                      value={row.symbol}
                      maxLength={10}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => updateTrade(row.id, { symbol: event.target.value.toUpperCase() })}
                      className={cn(FIELD, "uppercase")}
                    />
                  </Field>
                  <Field label={labels.date}>
                    <input
                      type="date"
                      value={row.date}
                      min={TCMB_MIN_DATE}
                      max={today}
                      onChange={(event) => updateTrade(row.id, { date: event.target.value })}
                      className={FIELD}
                    />
                  </Field>
                  <Field label={labels.quantity}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={row.quantity}
                      onChange={(event) => updateTrade(row.id, { quantity: event.target.value })}
                      className={FIELD}
                    />
                  </Field>
                  <Field label={labels.priceUsd}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={row.price}
                      onChange={(event) => updateTrade(row.id, { price: event.target.value })}
                      className={FIELD}
                    />
                  </Field>
                  <Field label={labels.commissionUsd}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={row.commission}
                      onChange={(event) => updateTrade(row.id, { commission: event.target.value })}
                      className={FIELD}
                    />
                  </Field>
                  <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeTrade(row.id)}
                      aria-label={labels.removeAria.replace("{row}", String(index + 1))}
                      className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-down-wash hover:text-down"
                    >
                      <Trash size={16} weight="duotone" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* ---- Satış kazancı ---- */}
      <Panel>
        <PanelHeader
          title={labels.resultsTitle}
          action={
            <button
              type="button"
              onClick={downloadCsv}
              disabled={results.length === 0 && dividendResults.length === 0}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              <DownloadSimple size={14} weight="bold" aria-hidden />
              {labels.exportCsv}
            </button>
          }
        />
        {results.length === 0 ? (
          <p className="border-t border-line-soft px-4 py-6 text-center text-sm text-muted sm:px-5">
            {labels.noSalesInYear}
          </p>
        ) : (
          <>
            <p className="px-4 pb-3 text-small text-muted sm:px-5">{labels.resultsHint}</p>
            <ScrollEdges
              className="scroll-x-hint border-t border-line-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
              tabIndex={0}
              role="region"
              aria-label={labels.resultsTitle}
            >
              {/* Taban genişlik; sıkıştırma yok, sembol sütunu sabit
                  (CLAUDE.md "Kaydırma saklanmaz"). */}
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-nano text-muted">
                    <th scope="col" className="sticky left-0 z-10 bg-(--panel-fixed) px-4 py-2.5 font-medium sm:px-5">
                      {labels.symbol}
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 font-medium">{labels.buyDate}</th>
                    <th scope="col" className="px-2.5 py-2.5 font-medium">{labels.sellDate}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.quantity}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.buyRate}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.sellRate}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.costTl}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.indexRatio}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.taxCostTl}</th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{labels.proceedsTl}</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">{labels.gainTl}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {results.map((r) => (
                    <tr key={`${r.sellId}:${r.buyId}`} className="align-top">
                      <th scope="row" className="numeral sticky left-0 z-10 bg-(--panel-fixed) px-4 py-3 text-left font-bold text-strong sm:px-5">
                        {r.symbol}
                      </th>
                      <td className="numeral px-2.5 py-3">{formatIsoDate(r.buyDate, locale)}</td>
                      <td className="numeral px-2.5 py-3">{formatIsoDate(r.sellDate, locale)}</td>
                      <td className="numeral px-2.5 py-3 text-right">
                        {new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 8 }).format(r.quantity)}
                        <span className="block text-nano text-muted">{usd(r.costUsd)} → {usd(r.proceedsUsd)}</span>
                      </td>
                      <td className="numeral px-2.5 py-3 text-right">{rateCell(r.buyDate)}</td>
                      <td className="numeral px-2.5 py-3 text-right">{rateCell(r.sellDate)}</td>
                      <td className="numeral px-2.5 py-3 text-right">{formatLira(r.costTl, locale)}</td>
                      <td className="numeral px-2.5 py-3 text-right">
                        {r.indexRatio === null ? "–" : r.indexRatio.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 4 })}
                        {r.indexed && (
                          <span className="block text-nano font-semibold text-primary-ink">{labels.indexedBadge}</span>
                        )}
                      </td>
                      <td className="numeral px-2.5 py-3 text-right">{formatLira(r.taxCostTl, locale)}</td>
                      <td className="numeral px-2.5 py-3 text-right">{formatLira(r.proceedsTl, locale)}</td>
                      <td className={cn("numeral px-4 py-3 text-right font-semibold sm:px-5", directionText(directionOf(r.gainTl)))}>
                        {formatLira(r.gainTl, locale, 2, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollEdges>

            {/* Ölçü ızgarası: dört sayı aynı hatta biter. */}
            <dl className="grid grid-cols-2 gap-px border-t border-line bg-line-soft lg:grid-cols-4">
              <Figure label={labels.totalProceeds} value={formatLira(totals.proceedsTl, locale)} />
              <Figure label={labels.totalCost} value={formatLira(totals.costTl, locale)} />
              <Figure
                label={labels.netGain}
                value={formatLira(totals.gainTl, locale, 2, true)}
                tone={totals.gainTl}
              />
              <Figure
                label={labels.estTax}
                value={formatLira(estTax, locale)}
                sub={labels.estTaxHint.replace("{year}", String(year))}
              />
            </dl>
            <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
              <p className="font-semibold text-strong">
                {labels.declare}: {totals.gainTl > 0 ? labels.declareYes : labels.declareNo}
              </p>
              <p>{labels.declareHint}</p>
              {!totals.complete && <p className="text-down">{labels.incomplete}</p>}
            </div>
          </>
        )}
        {(yearShortfalls.length > 0 || pendingRates || ratesFailed) && (
          <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-small leading-relaxed sm:px-5" role="status">
            {yearShortfalls.map((s) => (
              <p key={s.sellId} className="text-down">
                {labels.shortfall
                  .replace("{symbol}", s.symbol)
                  .replace("{date}", formatIsoDate(s.date, locale))
                  .replace("{quantity}", String(s.quantity))}
              </p>
            ))}
            {pendingRates && <p className="text-muted">{labels.loadingRates}</p>}
            {ratesFailed && (
              <p className="flex flex-wrap items-center gap-3 text-down">
                {labels.ratesFailed}
                <button type="button" onClick={retryRates} className={buttonClass({ variant: "ghost", size: "sm" })}>
                  {labels.retry}
                </button>
              </p>
            )}
          </div>
        )}
      </Panel>

      {/* ---- Yİ-ÜFE ---- */}
      {indexMonths.length > 0 && (
        <Panel>
          <PanelHeader title={labels.indexTitle} />
          <p className="px-4 pb-3 text-small leading-relaxed text-muted sm:px-5">{labels.indexHint}</p>
          <div className="border-t border-line-soft px-4 py-3 sm:px-5">
            <p className="pb-3 text-small leading-relaxed text-body">
              {indexMode === "auto" ? labels.indexAuto : labels.indexManual}
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {indexMonths.map((month) => (
                <li key={month}>
                  {indexMode === "auto" ? (
                    <span className="flex flex-col gap-0.5">
                      <span className="text-tiny text-muted">{formatIsoMonth(month, locale)}</span>
                      <span className="numeral font-semibold text-strong">
                        {autoIndex[month]?.toLocaleString(locale === "tr" ? "tr-TR" : "en-US") ?? "–"}
                      </span>
                    </span>
                  ) : (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-tiny text-muted">{formatIsoMonth(month, locale)}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={manualIndex[month] ?? ""}
                        onChange={(event) =>
                          setManualIndex((prev) => ({ ...prev, [month]: event.target.value }))
                        }
                        className={FIELD}
                      />
                    </label>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
            {labels.indexNote}
          </p>
        </Panel>
      )}

      {/* ---- Temettüler ---- */}
      <Panel>
        <PanelHeader
          title={labels.dividendsTitle}
          action={
            <button type="button" onClick={addDividend} className={buttonClass({ variant: "ghost", size: "sm" })}>
              <Plus size={14} weight="bold" aria-hidden />
              {labels.addDividend}
            </button>
          }
        />
        <p className="px-4 pb-3 text-small leading-relaxed text-muted sm:px-5">{labels.dividendsHint}</p>
        {dividends.length === 0 ? (
          <p className="border-t border-line-soft px-4 py-6 text-center text-sm text-muted sm:px-5">
            {labels.emptyDividends}
          </p>
        ) : (
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {dividends.map((row, index) => {
              const result = dividendResults.find((d) => d.id === row.id);
              return (
                <li key={row.id} className={cn(DIVIDEND_GRID, "grid grid-cols-2 gap-2 px-4 py-3 sm:px-5")}>
                  <Field label={labels.symbol} always>
                    <input
                      value={row.symbol}
                      maxLength={10}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => updateDividend(row.id, { symbol: event.target.value.toUpperCase() })}
                      className={cn(FIELD, "uppercase")}
                    />
                  </Field>
                  <Field label={labels.date} always>
                    <input
                      type="date"
                      value={row.date}
                      min={`${year}-01-01`}
                      max={`${year}-12-31` < today ? `${year}-12-31` : today}
                      onChange={(event) => updateDividend(row.id, { date: event.target.value })}
                      className={FIELD}
                    />
                  </Field>
                  <Field label={labels.grossUsd} always>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={row.gross}
                      onChange={(event) => updateDividend(row.id, { gross: event.target.value })}
                      className={FIELD}
                    />
                  </Field>
                  <Field label={labels.withholding} always>
                    <select
                      value={row.withholding}
                      onChange={(event) =>
                        updateDividend(row.id, { withholding: event.target.value as DividendRow["withholding"] })
                      }
                      className={cn(FIELD, "pr-8")}
                    >
                      <option value="w8ben">{labels.withholdingW8}</option>
                      <option value="none">{labels.withholdingNone}</option>
                    </select>
                  </Field>
                  <div className="flex flex-col justify-end gap-0.5 text-right">
                    <span className="text-tiny text-muted">{labels.grossTl}</span>
                    <span className="numeral font-semibold text-strong">{formatLira(result?.grossTl ?? null, locale)}</span>
                    <span className="numeral text-nano text-muted">
                      {labels.withheldTl} {formatLira(result?.withheldTl ?? null, locale)}
                    </span>
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeDividend(row.id)}
                      aria-label={labels.removeAria.replace("{row}", String(index + 1))}
                      className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-down-wash hover:text-down"
                    >
                      <Trash size={16} weight="duotone" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line-soft lg:grid-cols-3">
          <Figure label={labels.totalGrossTl} value={formatLira(dividendGrossTl, locale)} />
          <Figure label={labels.totalWithheldTl} value={formatLira(dividendWithheldTl, locale)} />
          <div className="col-span-2 flex flex-col gap-1.5 bg-(--panel-fixed) px-4 py-3 sm:px-5 lg:col-span-1">
            <label className="flex flex-col gap-1.5">
              <span className="text-tiny font-semibold text-muted">
                {labels.thresholdLabel.replace("{year}", String(year))}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={thresholdInput}
                placeholder={String(rules.dividendThreshold)}
                onChange={(event) => setThresholdInput(event.target.value)}
                className={FIELD}
              />
            </label>
            <span className="text-nano text-muted">
              {labels.thresholdSource.replace("{source}", rules.source[locale === "tr" ? "tr" : "en"])}
            </span>
          </div>
        </dl>
        <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
          {dividendResults.length > 0 && (
            <p className="font-semibold text-strong">
              {dividendGrossTl > threshold ? labels.thresholdOver : labels.thresholdUnder}
            </p>
          )}
          <p>{labels.thresholdHint}</p>
          <p>{labels.creditHint}</p>
        </div>
      </Panel>
    </>
  );
}

const FIELD =
  "h-11 w-full min-w-0 rounded-(--radius-md) border border-line bg-surface-elevated px-3 text-sm text-strong outline-none transition-colors placeholder:text-muted focus:border-line-focus";

/* Satır ızgarası: telefonda iki sütunlu kart, geniş ekranda tek satır. */
const TRADE_GRID =
  "sm:grid-cols-[96px_minmax(0,1fr)_150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_44px] sm:gap-3";
const DIVIDEND_GRID =
  "sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_44px] sm:gap-3";

function Field({
  label,
  always = false,
  children,
}: {
  label: string;
  /** Sütun başlığı olmayan listelerde etiket geniş ekranda da görünür. */
  always?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={cn("text-tiny font-semibold text-muted", !always && "sm:sr-only")}>{label}</span>
      {children}
    </label>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: number | null;
}) {
  return (
    <div className="flex flex-col gap-1 bg-(--panel-fixed) px-4 py-3 sm:px-5">
      <dt className="text-tiny font-semibold text-muted">{label}</dt>
      <dd
        className={cn(
          "numeral text-read font-bold leading-tight",
          tone === undefined ? "text-strong" : directionText(directionOf(tone)),
        )}
      >
        {value}
      </dd>
      {sub && <dd className="text-nano leading-snug text-muted">{sub}</dd>}
    </div>
  );
}
