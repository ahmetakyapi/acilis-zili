"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ChartLineUp,
  Coins,
  DownloadSimple,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type { KurRate, KurResponse } from "@/app/api/kur/route";
import type { IndexResponse } from "@/app/api/kur/endeks/route";
import { buttonClass } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  addDays,
  formatIsoDate,
  formatIsoMonth,
  formatLira,
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
  type LotResult,
  type TradeInput,
  type TradeSide,
} from "@/lib/tax";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, directionOf, directionText, formatPrice, isValidSymbol } from "@/lib/utils";
import { DividendMeter, Flow, Rolling, VerdictBadge, type FlowStep, type Verdict } from "./TaxResult";
import { PANEL_TITLE } from "./tax-ui";
import styles from "./Tax.module.css";

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
 *
 * AKIŞ (28 Eylül). Eski hâli boş bir işlem tablosuyla açılıyordu: okuyucu
 * önce "Alış Ekle", sonra "Satış Ekle" demeli, altı sütunu doldurmalı ve
 * cevabı on bir sütunlu bir sonuç tablosunun altında aramalıydı. Şimdi
 * varsayılan en sık durum: TEK alış, TEK satış. Alanlar ilk ekranda açık,
 * tarih girilince kur kendi satırında beliriyor, sonuç sağda canlı. Birden
 * fazla lot (ilk giren ilk çıkar) "Birden Fazla İşlem" anahtarının
 * arkasında; iki görünüm AYNI satır listesini düzenliyor, yani geçişte
 * girilen hiçbir şey kaybolmuyor.
 */

export type TaxLabels = Dictionary["lira"]["tax"];

type Tab = "sale" | "dividend";

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
/** Kur dört basamak: TCMB'nin yayımladığı hassasiyet (`formatRate` ile aynı). */
const RATE_DIGITS = 4;
/** Hisse adedinde gösterilen en fazla ondalık (kesirli hisse). */
const QUANTITY_DIGITS = 8;

let rowSeq = 0;
function nextId(prefix: string): string {
  rowSeq += 1;
  return `${prefix}${rowSeq}`;
}

const emptyTrade = (id: string, side: TradeSide): TradeRow => ({
  id,
  side,
  symbol: "",
  date: "",
  quantity: "",
  price: "",
  commission: "",
});
const emptyDividend = (id: string): DividendRow => ({
  id,
  symbol: "",
  date: "",
  gross: "",
  withholding: "w8ben",
});

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
  const [tab, setTab] = useState<Tab>("sale");
  const [year, setYear] = useState<number>(TAX_YEAR_LIST[0]);
  const [yearNote, setYearNote] = useState<number | null>(null);
  const [rateDay, setRateDay] = useState<"same" | "previous">("same");
  const [advanced, setAdvanced] = useState(false);
  /* Başlangıç satırlarının kimliği sabit: sunucu ve istemci aynı anahtarla
     çizsin. Sayaçla üretilen kimlikler yalnızca etkileşimde doğuyor. */
  const [trades, setTrades] = useState<TradeRow[]>(() => [emptyTrade("b0", "buy"), emptyTrade("s0", "sell")]);
  /* Tek satışta "Satılan Adet" alış adedini izler — okuyucu kendisi
     değiştirene kadar. Kısmi satış bir alan uzakta, ama çoğu satış
     tamamını satmak ve orada ikinci kez adet yazdırmak gereksiz. */
  const [sellQtyLinked, setSellQtyLinked] = useState(true);
  const [dividends, setDividends] = useState<DividendRow[]>(() => [emptyDividend("d0")]);
  const [rates, setRates] = useState<RateState>({});
  const [ratesFailed, setRatesFailed] = useState(false);
  const [pendingRates, setPendingRates] = useState(false);
  const [imported, setImported] = useState(0);
  const [autoIndex, setAutoIndex] = useState<Record<string, number>>({});
  const [indexMode, setIndexMode] = useState<"auto" | "manual">(indexAuto ? "auto" : "manual");
  const [manualIndex, setManualIndex] = useState<Record<string, string>>({});
  /* null: yılın kendi sınırı. Boş dize de sınıra düşer ama alan boş kalır —
     okuyucu kendi tutarını baştan yazabilsin. */
  const [thresholdInput, setThresholdInput] = useState<string | null>(null);

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
       zincirliyor (react-hooks/set-state-in-effect).
       Tek pozisyon tek alış görünümüne oturuyor; birden fazlası ilk giren
       ilk çıkar eşleşmesi ister, gelişmiş görünüm açılıyor. */
    queueMicrotask(() => {
      const buys = positions.map((p) => ({
        id: nextId("t"),
        side: "buy" as const,
        symbol: p.symbol,
        date: p.boughtAt,
        quantity: String(p.quantity),
        price: String(p.costUsd),
        commission: "",
      }));
      setTrades((prev) => [...buys, ...prev.filter((row) => row.side === "sell")]);
      if (positions.length === 1) {
        setTrades((prev) => prev.map((row) => (row.side === "sell" ? { ...row, symbol: positions[0].symbol, quantity: String(positions[0].quantity) } : row)));
      } else {
        setAdvanced(true);
      }
      setTab("sale");
      setImported(positions.length);
    });
  }, []);

  /* ---- Kapaktaki üç soru sekmeyi seçer ---- */
  useEffect(() => {
    const pick = (value: string | null | undefined) => {
      if (value === "sale" || value === "dividend") setTab(value);
    };
    /* Doğrudan `/vergi#temettu` ile gelen okuyucu da temettüde açılsın.
       Adres sunucuda yok; okuma bir mikro görevde (yukarıdaki gerekçe). */
    queueMicrotask(() => {
      if (window.location.hash === "#temettu") pick("dividend");
    });
    /* Tıklama yakalanıyor, `hashchange` değil: aynı çapaya ikinci kez
       basıldığında adres değişmiyor ve olay hiç gelmiyor. Adres de
       YAZILMIYOR — sığ adres güncellemesi uçuştaki gezinmeyi öldürür
       (CLAUDE.md "İstemci ile sunucu sınırı"). */
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[data-tax-path]");
      pick(link?.getAttribute("data-tax-path"));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const rateDateOf = useCallback(
    (date: string) => (rateDay === "same" ? date : addDays(date, -1)),
    [rateDay],
  );
  const dateUsable = useCallback(
    (date: string) => isIsoDate(date) && date >= TCMB_MIN_DATE && date <= today,
    [today],
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
          !dateUsable(row.date) ||
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
    [trades, dateUsable],
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

  /* ---- Kurlar: eksik günler toplu ve gecikmeli ----
     Hesaba girmiş satırların günleri ARTI yalnızca tarihi girilmiş
     satırların günleri: kur çipi, tarih seçilir seçilmez (fiyat henüz
     yazılmadan) belirsin diye. */
  const neededDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of trades) if (dateUsable(row.date)) set.add(rateDateOf(row.date));
    for (const row of dividends) if (dateUsable(row.date)) set.add(rateDateOf(row.date));
    return [...set].filter((date) => date >= TCMB_MIN_DATE).sort();
  }, [trades, dividends, rateDateOf, dateUsable]);
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
  const complete = results.filter((r) => r.gainTl !== null && r.costTl !== null);
  const rawCostTl = complete.reduce((sum, r) => sum + (r.costTl ?? 0), 0);
  const topRate = rules.brackets[rules.brackets.length - 1].ratePct;
  const taxable = Math.max(0, totals.gainTl);
  const taxLow = progressiveTax(taxable, rules.brackets);
  const taxHigh = (taxable * topRate) / 100;

  const dividendResults = parsedDividends.map((d) =>
    dividendResult(d, rates[rateDateOf(d.date)]?.buying ?? null),
  );
  const dividendDone = dividendResults.filter((d) => d.grossTl !== null);
  const dividendGrossTl = dividendResults.reduce((sum, d) => sum + (d.grossTl ?? 0), 0);
  const dividendWithheldTl = dividendResults.reduce((sum, d) => sum + (d.withheldTl ?? 0), 0);
  const threshold = num(thresholdInput ?? "") ?? rules.dividendThreshold;

  /* ---- Biçimleyiciler: kimlikleri sabit, yuvarlanan sayı her çizimde
     yeniden başlamasın ---- */
  const lira = useCallback((value: number) => formatLira(value, locale), [locale]);
  const liraSigned = useCallback((value: number) => formatLira(value, locale, 2, true), [locale]);
  const usd = useCallback((value: number) => formatPrice(value, locale, { currency: true }), [locale]);
  const quantityText = (value: number) =>
    new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: QUANTITY_DIGITS }).format(value);

  /* ---- Satır düzenleme ---- */
  const buyRow = trades.find((row) => row.side === "buy");
  const sellRow = trades.find((row) => row.side === "sell");
  const canSimple =
    trades.filter((row) => row.side === "buy").length <= 1 && trades.filter((row) => row.side === "sell").length <= 1;
  const simple = !advanced && canSimple;

  const updateTrade = (id: string, patch: Partial<TradeRow>) =>
    setTrades((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeTrade = (id: string) => setTrades((prev) => prev.filter((row) => row.id !== id));
  const addTrade = (side: TradeSide) => setTrades((prev) => [...prev, emptyTrade(nextId("t"), side)]);

  /** Satış günü başka bir vergi yılındaysa yıl onu izler ve bunu söyler. */
  const followSellYear = (date: string) => {
    const sellYear = Number(date.slice(0, 4));
    if (isIsoDate(date) && TAX_YEARS[sellYear] && sellYear !== year) {
      setYear(sellYear);
      setThresholdInput(null);
      setYearNote(sellYear);
    }
  };

  /** Tek alış ve satış görünümü: satır yoksa yaratılır, sembol ortak. */
  const editSimple = (side: TradeSide, patch: Partial<TradeRow>) => {
    setTrades((prev) => {
      let next = prev;
      if (!next.some((row) => row.side === side)) next = [...next, emptyTrade(nextId("t"), side)];
      return next.map((row) => {
        if (row.side === side) return { ...row, ...patch };
        /* Sembol tek alanda: iki satır aynı hisseyi anlatıyor. */
        if (patch.symbol !== undefined) return { ...row, symbol: patch.symbol };
        if (side === "buy" && patch.quantity !== undefined && sellQtyLinked && row.side === "sell") {
          return { ...row, quantity: patch.quantity };
        }
        return row;
      });
    });
    if (side === "sell" && patch.quantity !== undefined) setSellQtyLinked(false);
    if (side === "sell" && patch.date) followSellYear(patch.date);
  };

  const addDividend = () => setDividends((prev) => [...prev, emptyDividend(nextId("d"))]);
  const updateDividend = (id: string, patch: Partial<DividendRow>) => {
    setDividends((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    if (patch.date) {
      const dividendYear = Number(patch.date.slice(0, 4));
      if (TAX_YEARS[dividendYear] && dividendYear !== year) {
        setYear(dividendYear);
        setThresholdInput(null);
        setYearNote(dividendYear);
      }
    }
  };
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
      [labels.proceedsTl, totals.proceedsTl],
      [labels.taxCostTl, totals.costTl],
      [labels.netGain, totals.gainTl],
      [],
      [labels.symbol, labels.paymentDate, labels.grossUsd, labels.withholding, labels.grossTl, labels.withheldTl],
      ...dividendResults.map((d) => [d.symbol, d.date, d.grossUsd, d.withholdingPct, d.grossTl, d.withheldTl]),
      [labels.totalGrossTl, dividendGrossTl],
      [labels.withheldTl, dividendWithheldTl],
    ];
    const blob = new Blob([toCsv(rows, locale)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = labels.csvName.replace("{year}", String(year));
    link.click();
    URL.revokeObjectURL(url);
  };
  const csvDisabled = results.length === 0 && dividendResults.length === 0;

  /* ---- Kur çipi ----
     Canlı bölge DEĞİL: gelişmiş görünümde her satırın çipi ayrı bir
     duyuru olurdu ve kur geldikçe ekran okuyucu art arda konuşurdu. Sonuç
     kartının kararı (`aria-live`) tek duyuru. */
  const rateChip = (date: string) => {
    if (!dateUsable(date)) return null;
    const key = rateDateOf(date);
    const rate = rates[key];
    if (rate === undefined) {
      return (
        <p key={`${key}:wait`} className={styles.chip} data-state="loading">
          {labels.rateLoading}
        </p>
      );
    }
    if (rate === null) {
      return (
        <p key={`${key}:none`} className={styles.chip} data-state="missing">
          {labels.rateMissing} · {formatIsoDate(date, locale)}
        </p>
      );
    }
    return (
      <p key={`${key}:ok`} className={styles.chip}>
        <span>{labels.rateChip.replace("{date}", formatIsoDate(date, locale))}</span>
        <strong>{formatLira(rate.buying, locale, RATE_DIGITS)}</strong>
        {rate.bulletinDate !== date && (
          <span>{labels.bulletinOf.replace("{date}", formatIsoDate(rate.bulletinDate, locale))}</span>
        )}
      </p>
    );
  };

  /* ---- Satış sonucu ---- */
  const saleReady = complete.length > 0;
  const saleVerdict: Verdict = !saleReady ? "wait" : totals.gainTl > 0 ? "yes" : "no";
  const flowSteps = buildFlow({
    labels,
    locale,
    results: complete,
    rawCostTl,
    taxCostTl: totals.costTl,
    proceedsTl: totals.proceedsTl,
    gainTl: totals.gainTl,
    ready: saleReady,
    indexPending: indexMode === "auto" && indexMonths.some((month) => autoIndex[month] === undefined),
    usd,
  });
  const simpleSellBeforeBuy =
    simple && buyRow && sellRow && isIsoDate(buyRow.date) && isIsoDate(sellRow.date) && sellRow.date < buyRow.date;

  /* ---- Temettü sonucu ---- */
  const dividendReady = dividendDone.length > 0;
  const dividendVerdict: Verdict = !dividendReady ? "wait" : dividendGrossTl > threshold ? "yes" : "no";
  const fillDividend = (text: string) =>
    text
      .replace("{total}", formatLira(dividendGrossTl, locale))
      .replace("{year}", String(year))
      .replace("{limit}", formatLira(threshold, locale, 0));

  const manualIndexFields = indexMode === "manual" && indexMonths.length > 0 && (
    <div className="flex flex-col gap-3">
      <p className={styles.help}>{labels.indexManual}</p>
      <div className={styles.fields}>
        {indexMonths.map((month) => (
          <label key={month} className={styles.field}>
            <span className={styles.label}>{labels.indexMonthLabel.replace("{month}", formatIsoMonth(month, locale))}</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={manualIndex[month] ?? ""}
              onChange={(event) => setManualIndex((prev) => ({ ...prev, [month]: event.target.value }))}
              className={styles.input}
            />
          </label>
        ))}
      </div>
    </div>
  );

  const buyDone = !!buyRow && dateUsable(buyRow.date) && num(buyRow.quantity) !== null && num(buyRow.price) !== null && isValidSymbol(buyRow.symbol.trim());
  const sellDone = !!sellRow && dateUsable(sellRow.date) && num(sellRow.price) !== null && num(sellRow.quantity) !== null;

  return (
    <section id="satis" className={cn("panel overflow-hidden", styles.calc)} aria-labelledby="vergi-hesap">
      <span id="temettu" className={styles.anchor} aria-hidden />
      <div className={styles.panelHead}>
        <h2 id="vergi-hesap" className={PANEL_TITLE}>
          {labels.calcTitle}
        </h2>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-body" id="vergi-yil">
            {labels.yearLabel}
          </span>
          <span role="group" aria-labelledby="vergi-yil" className={styles.segment}>
            {TAX_YEAR_LIST.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={year === y}
                onClick={() => {
                  setYear(y);
                  setThresholdInput(null);
                  setYearNote(null);
                }}
              >
                {y}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="px-4 pb-5 pt-4 sm:px-7">
        <div
          role="tablist"
          aria-label={labels.modeLabel}
          className={styles.tabs}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const next: Tab = tab === "sale" ? "dividend" : "sale";
            setTab(next);
            document.getElementById(`vergi-sekme-${next}`)?.focus();
          }}
        >
          {(["sale", "dividend"] as const).map((value) => (
            <button
              key={value}
              id={`vergi-sekme-${value}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`vergi-panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              className={styles.tab}
            >
              {tab === value && (
                <motion.span
                  layoutId="vergi-sekme-hap"
                  className={styles.tabPill}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              {value === "sale" ? <ChartLineUp size={18} weight="duotone" aria-hidden /> : <Coins size={18} weight="duotone" aria-hidden />}
              <span>{value === "sale" ? labels.tabSale : labels.tabDividend}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "sale" ? (
        <div
          id="vergi-panel-sale"
          role="tabpanel"
          aria-labelledby="vergi-sekme-sale"
          className={styles.body}
        >
          <div className={styles.form}>
            <div className={styles.modeSwitch}>
              <span className={styles.segment} role="group" aria-label={labels.advancedOn}>
                <button type="button" aria-pressed={simple} disabled={!canSimple} onClick={() => setAdvanced(false)} className="disabled:opacity-50">
                  {labels.advancedOff}
                </button>
                <button type="button" aria-pressed={!simple} onClick={() => setAdvanced(true)}>
                  {labels.advancedOn}
                </button>
              </span>
            </div>
            {imported > 0 && (
              <p role="status" className="mb-4 text-small text-primary-ink">
                {labels.imported.replace("{count}", String(imported))}
              </p>
            )}
            {yearNote !== null && (
              <p role="status" className="mb-4 text-small text-primary-ink">
                {labels.yearMoved.replaceAll("{year}", String(yearNote))}
              </p>
            )}

            {simple ? (
              <ol className={styles.steps}>
                <li className={styles.step} data-done={buyDone}>
                  <span className={styles.node} aria-hidden>1</span>
                  <h3 className={styles.stepTitle}>{labels.stepBuy}</h3>
                  <div className={styles.fields}>
                    <Field label={labels.symbol}>
                      <input
                        value={buyRow?.symbol ?? ""}
                        maxLength={10}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => editSimple("buy", { symbol: event.target.value.toUpperCase() })}
                        className={cn(styles.input, styles.upper)}
                      />
                    </Field>
                    <Field label={labels.quantity}>
                      <input
                        inputMode="decimal"
                        autoComplete="off"
                        value={buyRow?.quantity ?? ""}
                        onChange={(event) => editSimple("buy", { quantity: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.buyDate}>
                      <input
                        type="date"
                        value={buyRow?.date ?? ""}
                        min={TCMB_MIN_DATE}
                        max={today}
                        onChange={(event) => editSimple("buy", { date: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.priceUsd}>
                      <input
                        inputMode="decimal"
                        autoComplete="off"
                        value={buyRow?.price ?? ""}
                        onChange={(event) => editSimple("buy", { price: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                  </div>
                  {buyRow && rateChip(buyRow.date)}
                </li>

                <li className={styles.step} data-done={sellDone}>
                  <span className={styles.node} aria-hidden>2</span>
                  <h3 className={styles.stepTitle}>{labels.stepSell}</h3>
                  <div className={styles.fields}>
                    <Field label={labels.sellDate} error={simpleSellBeforeBuy ? labels.sellBeforeBuy : undefined}>
                      <input
                        type="date"
                        value={sellRow?.date ?? ""}
                        min={buyRow?.date && isIsoDate(buyRow.date) ? buyRow.date : TCMB_MIN_DATE}
                        max={today}
                        aria-invalid={simpleSellBeforeBuy || undefined}
                        onChange={(event) => editSimple("sell", { date: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.priceUsd}>
                      <input
                        inputMode="decimal"
                        autoComplete="off"
                        value={sellRow?.price ?? ""}
                        onChange={(event) => editSimple("sell", { price: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.sellQuantity}>
                      <input
                        inputMode="decimal"
                        autoComplete="off"
                        value={sellRow?.quantity ?? ""}
                        onChange={(event) => editSimple("sell", { quantity: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                  </div>
                  {sellRow && rateChip(sellRow.date)}
                  <details className={styles.disclosure}>
                    <summary>
                      <Plus size={14} weight="bold" aria-hidden />
                      {labels.commissionToggle}
                    </summary>
                    <div className={cn(styles.fields, "mt-1")}>
                      <Field label={labels.buyCommission}>
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          value={buyRow?.commission ?? ""}
                          onChange={(event) => editSimple("buy", { commission: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                      <Field label={labels.sellCommission}>
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          value={sellRow?.commission ?? ""}
                          onChange={(event) => editSimple("sell", { commission: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                    </div>
                  </details>
                </li>

                {manualIndexFields && (
                  <li className={styles.step} data-done={indexMonths.every((month) => indexOf(month) !== null)}>
                    <span className={styles.node} aria-hidden>3</span>
                    <h3 className={styles.stepTitle}>{labels.stepIndex}</h3>
                    {manualIndexFields}
                  </li>
                )}
              </ol>
            ) : (
              <div className="flex flex-col gap-4">
                <p className={styles.help}>{labels.advancedHint}</p>
                {trades.length === 0 ? (
                  <p className="py-4 text-sm text-muted">{labels.emptyTrades}</p>
                ) : (
                  <ul className={styles.rows}>
                    {trades.map((row, index) => (
                      <li key={row.id} className={styles.row}>
                        <div className={styles.rowHead}>
                          <span className={styles.segment} role="group" aria-label={labels.side}>
                            {(["buy", "sell"] as const).map((side) => (
                              <button
                                key={side}
                                type="button"
                                aria-pressed={row.side === side}
                                onClick={() => updateTrade(row.id, { side })}
                              >
                                {side === "buy" ? labels.sideBuy : labels.sideSell}
                              </button>
                            ))}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeTrade(row.id)}
                            aria-label={labels.removeAria.replace("{row}", String(index + 1))}
                            className={styles.remove}
                          >
                            <Trash size={16} weight="duotone" aria-hidden />
                          </button>
                        </div>
                        <Field label={labels.symbol}>
                          <input
                            value={row.symbol}
                            maxLength={10}
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(event) => updateTrade(row.id, { symbol: event.target.value.toUpperCase() })}
                            className={cn(styles.input, styles.upper)}
                          />
                        </Field>
                        <Field label={labels.date}>
                          <input
                            type="date"
                            value={row.date}
                            min={TCMB_MIN_DATE}
                            max={today}
                            onChange={(event) => {
                              updateTrade(row.id, { date: event.target.value });
                              if (row.side === "sell") followSellYear(event.target.value);
                            }}
                            className={styles.input}
                          />
                        </Field>
                        <Field label={labels.quantity}>
                          <input
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.quantity}
                            onChange={(event) => updateTrade(row.id, { quantity: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <Field label={labels.priceUsd}>
                          <input
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.price}
                            onChange={(event) => updateTrade(row.id, { price: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <Field label={labels.commissionUsd}>
                          <input
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.commission}
                            onChange={(event) => updateTrade(row.id, { commission: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <div className={styles.rowChip}>{rateChip(row.date)}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className={styles.addRow}>
                  <button type="button" onClick={() => addTrade("buy")} className={buttonClass({ variant: "ghost", size: "sm" })}>
                    <Plus size={14} weight="bold" aria-hidden />
                    {labels.addBuy}
                  </button>
                  <button type="button" onClick={() => addTrade("sell")} className={buttonClass({ variant: "ghost", size: "sm" })}>
                    <Plus size={14} weight="bold" aria-hidden />
                    {labels.addSell}
                  </button>
                </div>
                {manualIndexFields && (
                  <section className="border-t border-line-soft pt-4">
                    <h3 className={styles.stepTitle}>{labels.stepIndex}</h3>
                    {manualIndexFields}
                  </section>
                )}
              </div>
            )}

            <Settings labels={labels} rateDay={rateDay} setRateDay={setRateDay} indexMode={indexMode} />
          </div>

          <div className={styles.result}>
            <div className={styles.resultInner} aria-labelledby="vergi-sonuc-satis">
              <h3 id="vergi-sonuc-satis" className="sr-only">
                {labels.resultLabel}
              </h3>
              <div aria-live="polite">
                {saleVerdict === "wait" ? (
                  <p className={styles.verdictBody}>{labels.resultEmptySale}</p>
                ) : (
                  <>
                    <VerdictBadge verdict={saleVerdict} text={saleVerdict === "yes" ? labels.verdictYes : labels.verdictNo} />
                    <p className={styles.verdictBody}>{saleVerdict === "yes" ? labels.verdictYesBody : labels.verdictNoBody}</p>
                  </>
                )}
              </div>

              <div>
                <p className={styles.figureLabel}>{totals.gainTl < 0 ? labels.netLoss : labels.netGain}</p>
                {saleReady ? (
                  <Rolling
                    value={totals.gainTl}
                    format={liraSigned}
                    className={cn(styles.big, directionText(directionOf(totals.gainTl)))}
                  />
                ) : (
                  <span className={cn(styles.big, "text-muted")}>{formatLira(null, locale)}</span>
                )}
              </div>

              <div className={styles.figures}>
                <div>
                  <p className={styles.figureLabel}>{labels.estTax}</p>
                  <p className={cn(styles.mid, "mt-1")}>
                    {saleReady ? (
                      <>
                        <Rolling value={taxLow} format={lira} />
                        {taxHigh > taxLow && (
                          <>
                            <span className={styles.between}>{labels.estTaxBetween}</span>
                            <Rolling value={taxHigh} format={lira} />
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">{formatLira(null, locale)}</span>
                    )}
                  </p>
                  <p className={styles.figureHint}>
                    {labels.estTaxHint.replace("{year}", String(year)).replace("{top}", String(topRate))}
                  </p>
                </div>
              </div>

              <Flow title={labels.flowTitle} steps={flowSteps} />

              {!simple && results.length > 0 && (
                <details className={cn(styles.disclosure, styles.lots)}>
                  <summary>
                    <Plus size={14} weight="bold" aria-hidden />
                    {labels.lotsTitle} ({results.length})
                  </summary>
                  <LotTable labels={labels} locale={locale} results={results} quantityText={quantityText} />
                </details>
              )}

              <Notes
                labels={labels}
                items={[
                  results.length === 0 && parsedTrades.some((t) => t.side === "sell") ? { text: labels.noSalesInYear } : null,
                  ...yearShortfalls.map((s) => ({
                    text: labels.shortfall
                      .replace("{symbol}", s.symbol)
                      .replace("{date}", formatIsoDate(s.date, locale))
                      .replace("{quantity}", quantityText(s.quantity)),
                    warn: true,
                  })),
                  !totals.complete ? { text: labels.incomplete, warn: true } : null,
                  results.some((r) => r.indexed) ? { text: labels.indexNote } : null,
                ]}
                ratesFailed={ratesFailed && !pendingRates}
                onRetry={retryRates}
                onCsv={downloadCsv}
                csvDisabled={csvDisabled}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          id="vergi-panel-dividend"
          role="tabpanel"
          aria-labelledby="vergi-sekme-dividend"
          className={styles.body}
        >
          <div className={styles.form}>
            <p className={cn(styles.help, "mb-5")}>{labels.dividendHint}</p>
            {yearNote !== null && (
              <p role="status" className="mb-4 text-small text-primary-ink">
                {labels.yearMoved.replaceAll("{year}", String(yearNote))}
              </p>
            )}
            <ol className={styles.steps}>
              {dividends.map((row, index) => {
                const done = dateUsable(row.date) && num(row.gross) !== null && isValidSymbol(row.symbol.trim());
                return (
                  <li key={row.id} className={styles.step} data-done={done}>
                    <span className={styles.node} aria-hidden>{index + 1}</span>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={styles.stepTitle}>{row.symbol.trim() || labels.tabDividend}</h3>
                      {dividends.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDividend(row.id)}
                          aria-label={labels.removeAria.replace("{row}", String(index + 1))}
                          className={styles.remove}
                        >
                          <Trash size={16} weight="duotone" aria-hidden />
                        </button>
                      )}
                    </div>
                    <div className={styles.fields}>
                      <Field label={labels.symbol}>
                        <input
                          value={row.symbol}
                          maxLength={10}
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => updateDividend(row.id, { symbol: event.target.value.toUpperCase() })}
                          className={cn(styles.input, styles.upper)}
                        />
                      </Field>
                      <Field label={labels.grossUsd}>
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          value={row.gross}
                          onChange={(event) => updateDividend(row.id, { gross: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                      <Field label={labels.paymentDate}>
                        <input
                          type="date"
                          value={row.date}
                          min={TCMB_MIN_DATE}
                          max={today}
                          onChange={(event) => updateDividend(row.id, { date: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                      <div className={cn(styles.field, styles.fieldWide)}>
                        <span className={styles.label} id={`${row.id}-w8`}>
                          {labels.w8Label}
                        </span>
                        <span className={cn(styles.segment, "w-fit")} role="group" aria-labelledby={`${row.id}-w8`}>
                          {(["w8ben", "none"] as const).map((option) => (
                            <button
                              key={option}
                              type="button"
                              aria-pressed={row.withholding === option}
                              onClick={() => updateDividend(row.id, { withholding: option })}
                            >
                              {option === "w8ben" ? labels.w8Yes : labels.w8No}
                            </button>
                          ))}
                        </span>
                      </div>
                    </div>
                    {rateChip(row.date)}
                  </li>
                );
              })}
            </ol>
            <div className={styles.addRow}>
              <button type="button" onClick={addDividend} className={buttonClass({ variant: "ghost", size: "sm" })}>
                <Plus size={14} weight="bold" aria-hidden />
                {labels.addDividend}
              </button>
            </div>
            <Settings labels={labels} rateDay={rateDay} setRateDay={setRateDay}>
              <label className={styles.field}>
                <span className={styles.label}>{labels.thresholdLabel.replace("{year}", String(year))}</span>
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={thresholdInput ?? String(rules.dividendThreshold)}
                  onChange={(event) => setThresholdInput(event.target.value)}
                  className={cn(styles.input, "max-w-60")}
                />
                <span className={styles.help}>
                  {labels.thresholdSource.replace("{source}", rules.source[locale === "tr" ? "tr" : "en"])}
                </span>
              </label>
            </Settings>
          </div>

          <div className={styles.result}>
            <div className={styles.resultInner}>
              <h3 className="sr-only">{labels.resultLabel}</h3>
              <div aria-live="polite">
                {dividendVerdict === "wait" ? (
                  <p className={styles.verdictBody}>{labels.resultEmptyDividend}</p>
                ) : (
                  <>
                    <VerdictBadge verdict={dividendVerdict} text={dividendVerdict === "yes" ? labels.verdictYes : labels.verdictNo} />
                    <p className={styles.verdictBody}>
                      {fillDividend(dividendVerdict === "yes" ? labels.dividendOver : labels.dividendUnder)}
                    </p>
                  </>
                )}
              </div>

              <div>
                <p className={styles.figureLabel}>{labels.totalGrossTl}</p>
                {dividendReady ? (
                  <Rolling value={dividendGrossTl} format={lira} className={cn(styles.big, "text-strong")} />
                ) : (
                  <span className={cn(styles.big, "text-muted")}>{formatLira(null, locale)}</span>
                )}
                <DividendMeter
                  total={dividendReady ? dividendGrossTl : 0}
                  limit={threshold}
                  leftLabel={formatLira(0, locale, 0)}
                  rightLabel={labels.meterLimit.replace("{limit}", formatLira(threshold, locale, 0))}
                />
              </div>

              <div className={styles.figures}>
                <div>
                  <p className={styles.figureLabel}>{labels.withheldTl}</p>
                  <p className={cn(styles.mid, "mt-1")}>
                    {dividendReady ? (
                      <Rolling value={dividendWithheldTl} format={lira} />
                    ) : (
                      <span className="text-muted">{formatLira(null, locale)}</span>
                    )}
                  </p>
                  <p className={styles.figureHint}>{labels.withheldHint}</p>
                </div>
              </div>

              {dividendDone.length > 1 && (
                <ul className="flex flex-col gap-2 border-t border-line-soft pt-4 text-small">
                  {dividendDone.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-strong">
                        {d.symbol} <span className="font-normal text-muted">{formatIsoDate(d.date, locale)}</span>
                      </span>
                      <span className="numeral text-strong">{formatLira(d.grossTl, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Notes
                labels={labels}
                items={[{ text: labels.thresholdHint }]}
                ratesFailed={ratesFailed && !pendingRates}
                onRetry={retryRates}
                onCsv={downloadCsv}
                csvDisabled={csvDisabled}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Parçalar
   -------------------------------------------------------------------------- */

/** Etiket ÜSTTE, alan altta, hata en altta. Yer tutucu etiket değildir. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={cn(styles.help, styles.warn)}>{error}</span>}
    </label>
  );
}

/**
 * Nadiren değişen ayarlar bir açılırın arkasında: kur günü ve temettü
 * sınırı. Eski ekranda kur günü anahtarı ilk panelin en üstündeydi ve
 * okuyucunun ilk gördüğü denetim, çoğunun hiç değiştirmeyeceği bir seçimdi.
 */
function Settings({
  labels,
  rateDay,
  setRateDay,
  indexMode,
  children,
}: {
  labels: TaxLabels;
  rateDay: "same" | "previous";
  setRateDay: (value: "same" | "previous") => void;
  indexMode?: "auto" | "manual";
  children?: React.ReactNode;
}) {
  return (
    <details className={cn(styles.disclosure, "mt-6 border-t border-line-soft pt-2")}>
      <summary>
        <Plus size={14} weight="bold" aria-hidden />
        {labels.settingsTitle}
      </summary>
      <div className="mt-2 flex flex-col gap-5">
        <div className={styles.field}>
          <span className={styles.label} id="vergi-kur-gunu">
            {labels.rateDayLabel}
          </span>
          <span role="group" aria-labelledby="vergi-kur-gunu" className={cn(styles.segment, "w-fit")}>
            {(["same", "previous"] as const).map((option) => (
              <button key={option} type="button" aria-pressed={rateDay === option} onClick={() => setRateDay(option)}>
                {option === "same" ? labels.rateDaySame : labels.rateDayPrevious}
              </button>
            ))}
          </span>
          <span className={styles.help}>{labels.rateDayHint}</span>
        </div>
        {indexMode && (
          <p className={styles.help}>{indexMode === "auto" ? labels.indexAuto : labels.indexManual}</p>
        )}
        {children}
      </div>
    </details>
  );
}

/** Sonuç kartının dibi: künyeler, uyarılar, CSV ve danışmanlık notu. */
function Notes({
  labels,
  items,
  ratesFailed,
  onRetry,
  onCsv,
  csvDisabled,
}: {
  labels: TaxLabels;
  items: ({ text: string; warn?: boolean } | null)[];
  ratesFailed: boolean;
  onRetry: () => void;
  onCsv: () => void;
  csvDisabled: boolean;
}) {
  const shown = items.filter((item): item is { text: string; warn?: boolean } => item !== null);
  return (
    <div className={styles.notes}>
      {shown.map((item) => (
        <p key={item.text} className={item.warn ? styles.warn : undefined}>
          {item.text}
        </p>
      ))}
      {ratesFailed && (
        <p className={cn(styles.warn, "flex flex-wrap items-center gap-3")} role="status">
          {labels.ratesFailed}
          <button type="button" onClick={onRetry} className={buttonClass({ variant: "ghost", size: "sm" })}>
            {labels.retry}
          </button>
        </p>
      )}
      <div className={cn(styles.actions, "pt-1")}>
        <button type="button" onClick={onCsv} disabled={csvDisabled} className={buttonClass({ variant: "ghost", size: "sm" })}>
          <DownloadSimple size={14} weight="bold" aria-hidden />
          {labels.exportCsv}
        </button>
      </div>
      {/* DANIŞMANLIK NOTU GÖRÜNÜR AMA BAĞIRMIYOR. Eski ekranda sayfanın
          ilk paneliydi ve başlığın hemen altında, okuyucunun ilk gördüğü
          şey bir uyarıydı. Şimdi sonucun dibinde, sonuçla birlikte
          okunuyor: sayının yanında durması, sayının ne olduğunu söylüyor. */}
      <div className={cn(styles.advice, "border-t border-line-soft pt-3")} role="note">
        <WarningCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-brass" aria-hidden />
        <p>
          <strong>{labels.notAdvice}</strong>
          {labels.notAdviceBody}
        </p>
      </div>
    </div>
  );
}

/** Gelişmiş görünümde lot lot döküm — açılır içinde, kaydırma saklanmaz. */
function LotTable({
  labels,
  locale,
  results,
  quantityText,
}: {
  labels: TaxLabels;
  locale: Locale;
  results: LotResult[];
  quantityText: (value: number) => string;
}) {
  return (
    <ScrollEdges
      className="scroll-x-hint mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
      tabIndex={0}
      role="region"
      aria-label={labels.lotsTitle}
    >
      <table className="w-full min-w-[560px] text-small">
        <thead>
          <tr className="border-b border-line-soft text-left text-nano text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">{labels.symbol}</th>
            <th scope="col" className="px-2 py-2 font-medium">{labels.sellDate}</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">{labels.quantity}</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">{labels.taxCostTl}</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">{labels.proceedsTl}</th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">{labels.gainTl}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {results.map((r) => (
            <tr key={`${r.sellId}:${r.buyId}`}>
              <th scope="row" className="py-2 pr-3 text-left font-bold text-strong">
                {r.symbol}
                {r.indexed && <span className="block text-nano font-semibold text-brass-ink">{labels.indexedBadge}</span>}
              </th>
              <td className="numeral px-2 py-2">
                {formatIsoDate(r.sellDate, locale)}
                <span className="block text-nano text-muted">{formatIsoDate(r.buyDate, locale)}</span>
              </td>
              <td className="numeral px-2 py-2 text-right">{quantityText(r.quantity)}</td>
              <td className="numeral px-2 py-2 text-right">{formatLira(r.taxCostTl, locale)}</td>
              <td className="numeral px-2 py-2 text-right">{formatLira(r.proceedsTl, locale)}</td>
              <td className={cn("numeral py-2 pl-2 text-right font-semibold", directionText(directionOf(r.gainTl)))}>
                {formatLira(r.gainTl, locale, 2, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollEdges>
  );
}

/* --------------------------------------------------------------------------
   Şelalenin adımları
   -------------------------------------------------------------------------- */

const PERCENT = 100;

function buildFlow({
  labels,
  locale,
  results,
  rawCostTl,
  taxCostTl,
  proceedsTl,
  gainTl,
  ready,
  indexPending,
  usd,
}: {
  labels: TaxLabels;
  locale: Locale;
  results: LotResult[];
  rawCostTl: number;
  taxCostTl: number;
  proceedsTl: number;
  gainTl: number;
  ready: boolean;
  indexPending: boolean;
  usd: (value: number) => string;
}): FlowStep[] {
  const dash = formatLira(null, locale);
  if (!ready) {
    return [
      { name: labels.flowCostTl, value: dash, from: 0, span: 0, tone: "cost" },
      { name: labels.flowIndexed, value: dash, from: 0, span: 0, tone: "index" },
      { name: labels.flowProceeds, value: dash, from: 0, span: 0, tone: "proceeds" },
      { name: labels.flowGain, value: dash, from: 0, span: 0, tone: "up" },
    ];
  }
  const scale = Math.max(rawCostTl, taxCostTl, proceedsTl) || 1;
  const single = results.length === 1 ? results[0] : null;
  const costUsd = results.reduce((sum, r) => sum + r.costUsd, 0);
  const proceedsUsd = results.reduce((sum, r) => sum + r.proceedsUsd, 0);
  const rateNote = (amountUsd: number, rate: number | null) =>
    single && rate !== null ? `${usd(amountUsd)} × ${formatLira(rate, locale, RATE_DIGITS)}` : `${usd(amountUsd)} · ${labels.flowManyRates}`;
  const pct = (ratio: number) =>
    ((ratio - 1) * PERCENT).toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 1 });

  let indexNote: string;
  if (single) {
    const lossBefore = (single.proceedsTl ?? 0) <= (single.costTl ?? 0);
    if (single.indexed && single.indexRatio !== null) indexNote = labels.flowIndexUp.replace("{pct}", pct(single.indexRatio));
    else if (lossBefore) indexNote = labels.flowIndexNoGain;
    else if (single.indexRatio !== null) indexNote = labels.flowIndexBelow.replace("{pct}", pct(single.indexRatio));
    else indexNote = indexPending ? "…" : labels.flowIndexNone;
  } else {
    const indexedCount = results.filter((r) => r.indexed).length;
    indexNote =
      indexedCount > 0
        ? `${labels.indexedBadge} · ${indexedCount}/${results.length}`
        : indexPending
          ? "…"
          : results.every((r) => r.indexRatio === null)
            ? labels.flowIndexNone
            : labels.flowIndexNoGain;
  }

  const gainUp = gainTl >= 0;
  return [
    {
      name: labels.flowCostTl,
      value: formatLira(rawCostTl, locale),
      note: rateNote(costUsd, single?.buyRate ?? null),
      from: 0,
      span: rawCostTl / scale,
      tone: "cost",
    },
    {
      name: labels.flowIndexed,
      value: formatLira(taxCostTl, locale),
      note: indexNote,
      from: rawCostTl / scale,
      span: Math.max(0, taxCostTl - rawCostTl) / scale,
      tone: "index",
    },
    {
      name: labels.flowProceeds,
      value: formatLira(proceedsTl, locale),
      note: rateNote(proceedsUsd, single?.sellRate ?? null),
      from: 0,
      span: proceedsTl / scale,
      tone: "proceeds",
    },
    {
      name: gainUp ? labels.flowGain : labels.flowLoss,
      value: formatLira(gainTl, locale, 2, true),
      from: (gainUp ? taxCostTl : proceedsTl) / scale,
      span: Math.abs(gainTl) / scale,
      tone: gainUp ? "up" : "down",
    },
  ];
}
