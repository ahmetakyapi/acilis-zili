"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import {
  Calculator,
  ChartLineUp,
  Coins,
  DownloadSimple,
  FileArrowUp,
  LockSimple,
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
import { formatDecimalInput, isAmbiguous, parseDecimalInput } from "@/lib/decimal-input";
import { parseTaxHandoff, TAX_HANDOFF_KEY } from "@/lib/portfolio";
import {
  dividendResult,
  indexMonthsFor,
  lotResult,
  matchFifo,
  progressiveTax,
  taxYearList,
  type TaxYearRules,
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
import { BracketTable, DividendMeter, Flow, ResultPreview, Rolling, TaxRange, VerdictBadge, type FlowStep, type Verdict } from "./TaxResult";
import type { ImportPayload } from "./StatementImport";
import { PANEL_TITLE, type DividendRow, type TradeRow } from "./tax-ui";
import styles from "./Tax.module.css";
import { DatePicker } from "@/components/ui/DatePicker";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/* EKSTREDEN AKTARIM AYRI BİR PARÇA. Önizleme, ayrıştırıcılar ve (PDF'te)
   pdf.js ancak okuyucu bir dosya seçtiğinde iniyor; sayfanın ilk JS'inde
   yalnızca bırakma alanı var (`ImportDrop`, aşağıda). Ölçüm (28 Eylül,
   `next start`, /vergi, sıkıştırılmış indirilen JS): önce 313 KB, sonra
   317 KB. Dosya seçilince: CSV'de +12 KB (önizleme ve ayrıştırıcılar);
   PDF'te +133 KB ve pdf.js çalışanı (1,2 MB, gzip ~370 KB). */
const StatementImport = dynamic(() => import("./StatementImport").then((m) => m.StatementImport), {
  ssr: false,
  loading: () => <div className={styles.importLoading} aria-hidden />,
});

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

type RateState = Record<string, KurRate | null>;

/** Kur isteğinin bekleme süresi — yazarken her tuşta istek açılmasın. */
const RATE_DEBOUNCE_MS = 500;
/** `/api/kur` toplu istek tavanıyla aynı. */
const RATE_BATCH = 40;
/** Kur dört basamak: TCMB'nin yayımladığı hassasiyet (`formatRate` ile aynı). */
const RATE_DIGITS = 4;
/** Ekstreden gelen stopaj oranında gösterilen ondalık. */
const PCT_DIGITS = 2;
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
  statementPct: null,
});

const blankTrade = (row: TradeRow) =>
  !row.symbol.trim() && !row.date && !row.quantity.trim() && !row.price.trim() && !row.commission.trim();
const blankDividend = (row: DividendRow) => !row.symbol.trim() && !row.date && !row.gross.trim();


export function TaxCalculator({
  labels,
  locale,
  indexAuto,
  today,
  years,
}: {
  labels: TaxLabels;
  locale: Locale;
  /** Yİ-ÜFE kaynağı (EVDS anahtarı) bu kurulumda açık mı. */
  indexAuto: boolean;
  /** İstanbul'un bugünü — tarih alanlarının üst sınırı. */
  today: string;
  /**
   * Vergi yılları: koddakiler + GİB'den otomatik okunan yeniler
   * (lib/tax-data.ts → getTaxYears). Sunucu çözüyor, prop olarak geliyor.
   */
  years: Record<number, TaxYearRules>;
}) {
  const yearList = taxYearList(years);
  const reduced = useMotionPreference();
  const [tab, setTab] = useState<Tab>("sale");
  const [year, setYear] = useState<number>(yearList[0]);
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
  /* Ekstreden aktarım: seçilen dosyalar önizlemeyi açar, onay kapatır. */
  const [importFiles, setImportFiles] = useState<File[] | null>(null);
  const [importNote, setImportNote] = useState<{ trades: number; dividends: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [autoIndex, setAutoIndex] = useState<Record<string, number>>({});
  const [indexMode, setIndexMode] = useState<"auto" | "manual">(indexAuto ? "auto" : "manual");
  const [manualIndex, setManualIndex] = useState<Record<string, string>>({});
  /* null: yılın kendi sınırı. Boş dize de sınıra düşer ama alan boş kalır —
     okuyucu kendi tutarını baştan yazabilsin. */
  const [thresholdInput, setThresholdInput] = useState<string | null>(null);

  /* ---- Sayı alanları dilin kuralıyla okunur ve yazılır ----
     Eskiden "12,5" ve "12.5" tek kuralla okunuyordu (ilk virgül noktaya) ve
     TR'de "1.845,50" bozuk sayılıyordu; alana yazılan değer de `String()`
     ile ondalık NOKTA taşıyordu. Kural ve belirsiz durum lib/decimal-input.ts
     başında. Hesap (`lib/tax.ts`) değişmedi: yalnızca girdinin okunuşu. */
  const num = useCallback((raw: string) => parseDecimalInput(raw, locale), [locale]);
  const decimalText = useCallback((value: number) => formatDecimalInput(value, locale), [locale]);
  /** "1.845" TR'de bin sekiz yüz kırk beş okunur; alan bunu altında söyler. */
  const readAs = (raw: string) => {
    const value = num(raw);
    return value !== null && isAmbiguous(raw, locale)
      ? /* Gruplamasız: "1.845 olarak okundu" yine aynı belirsizliği taşırdı. */
        labels.readAs.replace("{value}", formatDecimalInput(value, locale))
      : null;
  };

  /* ---- Satır içi doğrulama ----
     Eskiden okunamayan bir alan SESSİZCE hesaptan düşüyordu: "12,5a"
     yazan okuyucu sonucun neden gelmediğini göremiyordu. Hata alanın
     altında, alan boşken hiç konuşmuyor. Kural hesabın kuralıyla aynı
     (`parsedTrades`, `parsedDividends`): yalnızca neyin düştüğünü söylüyor. */
  const symbolError = (raw: string) =>
    raw.trim() && !isValidSymbol(raw.trim().toUpperCase()) ? labels.symbolInvalid : undefined;
  const numberError = (raw: string, rule: "positive" | "nonNegative") => {
    if (!raw.trim()) return undefined;
    const value = num(raw);
    if (value === null) return labels.notNumber;
    if (rule === "positive" && value <= 0) return labels.notPositive;
    if (rule === "nonNegative" && value < 0) return labels.notNegative;
    return undefined;
  };

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
        quantity: decimalText(p.quantity),
        price: formatDecimalInput(p.costUsd, locale, { money: true }),
        commission: "",
      }));
      setTrades((prev) => [...buys, ...prev.filter((row) => row.side === "sell")]);
      if (positions.length === 1) {
        setTrades((prev) => prev.map((row) => (row.side === "sell" ? { ...row, symbol: positions[0].symbol, quantity: decimalText(positions[0].quantity) } : row)));
      } else {
        setAdvanced(true);
      }
      setTab("sale");
      setImported(positions.length);
    });
    /* Yalnızca ilk yüklemede: dil sayfa boyunca değişmiyor. */
  }, [decimalText, locale]);

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
    [trades, dateUsable, num],
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
            withholdingPct:
              row.withholding === "statement" && row.statementPct !== null
                ? row.statementPct
                : US_WITHHOLDING[row.withholding === "none" ? "none" : "w8ben"],
          },
        ];
      }),
    [dividends, yearPrefix, today, num],
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
    [indexMode, autoIndex, manualIndex, num],
  );

  /* ---- Sonuç ---- */
  const rules = years[year];
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

  /* Kazancın düştüğü dilim — tarifenin kendi satırı, yeni bir hesap değil:
     alt uç (`progressiveTax`) bu dilimde bitiyor. */
  const bracketRate =
    rules.brackets.find((bracket) => bracket.upTo === null || taxable <= bracket.upTo)?.ratePct ?? topRate;

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
    if (isIsoDate(date) && years[sellYear] && sellYear !== year) {
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
      if (years[dividendYear] && dividendYear !== year) {
        setYear(dividendYear);
        setThresholdInput(null);
        setYearNote(dividendYear);
      }
    }
  };
  const removeDividend = (id: string) => setDividends((prev) => prev.filter((row) => row.id !== id));

  /* ---- Ekstreden aktarım ----
     Önizlemede onaylanan satırlar hesaplayıcının KENDİ satırları olarak
     ekleniyor; boş başlangıç satırları (ilk açılıştaki alış ve satış)
     atılıyor, okuyucunun yazdıkları kalıyor. Birden fazla işlem ilk giren
     ilk çıkar ister: gelişmiş görünüm açılıyor. Vergi yılı en son SATIŞIN
     yılına geçiyor — ekstre çoğu zaman bir önceki yılın beyanı için
     yükleniyor. Kurlar mevcut akışla, satır satır kendiliğinden geliyor. */
  const applyImport = (payload: ImportPayload) => {
    if (payload.trades.length > 0) {
      setTrades((prev) => [
        ...prev.filter((row) => !blankTrade(row)),
        ...payload.trades.map((row) => ({ ...row, id: nextId("t") })),
      ]);
      setAdvanced(true);
    }
    if (payload.dividends.length > 0) {
      setDividends((prev) => [
        ...prev.filter((row) => !blankDividend(row)),
        ...payload.dividends.map((row) => ({ ...row, id: nextId("d") })),
      ]);
    }
    const importedYears = [
      ...payload.trades.filter((t) => t.side === "sell").map((t) => Number(t.date.slice(0, 4))),
      ...(payload.trades.some((t) => t.side === "sell") ? [] : payload.dividends.map((d) => Number(d.date.slice(0, 4)))),
    ].filter((y) => years[y]);
    const target = importedYears.length > 0 ? Math.max(...importedYears) : null;
    if (target !== null && target !== year) {
      setYear(target);
      setThresholdInput(null);
    }
    setTab(payload.trades.length > 0 ? "sale" : "dividend");
    setImportNote({ trades: payload.trades.length, dividends: payload.dividends.length });
    setImportFiles(null);
  };
  const pickFiles = () => fileInput.current?.click();

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
  /* Hesabın dayanağı: kullanılan kurlar ve kur günü. Tek lotta kurun
     kendisi ve bülten günü; birden fazlasında "Her Lot Kendi Kuruyla"
     (lot lot kurlar CSV'de ve lot dökümünde). */
  const rateDayText = rateDay === "same" ? labels.rateDaySame : labels.rateDayPrevious;
  const bulletinOf = (date: string) => formatIsoDate(rates[rateDateOf(date)]?.bulletinDate ?? rateDateOf(date), locale);
  const singleLot = complete.length === 1 ? complete[0] : null;
  const saleBasis: BasisItem[] = singleLot
    ? [
        { name: labels.buyRate, value: formatLira(singleLot.buyRate, locale, RATE_DIGITS), note: bulletinOf(singleLot.buyDate) },
        { name: labels.sellRate, value: formatLira(singleLot.sellRate, locale, RATE_DIGITS), note: bulletinOf(singleLot.sellDate) },
        { name: labels.rateDayLabel, value: rateDayText },
      ]
    : [
        { name: labels.basisRate, value: labels.flowManyRates },
        { name: labels.rateDayLabel, value: rateDayText },
      ];
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

  const singleDividend = dividendDone.length === 1 ? dividendDone[0] : null;
  const dividendBasis: BasisItem[] = singleDividend
    ? [
        { name: labels.basisRate, value: formatLira(singleDividend.rate, locale, RATE_DIGITS), note: bulletinOf(singleDividend.date) },
        { name: labels.withholding, value: percentText(singleDividend.withholdingPct, locale) },
        { name: labels.rateDayLabel, value: rateDayText },
      ]
    : [
        { name: labels.basisRate, value: labels.flowManyRates },
        { name: labels.rateDayLabel, value: rateDayText },
      ];

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
      {/* BAŞLIK SATIRI: ad, hesap türü, vergi yılı (28 Eylül, ikinci tur).
          Hesap türü bir dönem başlığın altında tam genişlikte, 48 piksel
          yüksekliğinde mavi dolgulu bir anahtardı; sayfanın en ağır nesnesi
          bir seçimdi ve sonuçtan önce göze giriyordu. Şimdi yıl anahtarıyla
          aynı dilde bir segment: çukur ray, seçili parça panel zemininde
          kayıyor. Genişte üçü tek hatta; telefonda ad ile yıl üstte, tür
          altta tam genişlikte (iki parça, başparmak hedefi 44). */}
      <div className={styles.calcHead}>
        <h2 id="vergi-hesap" className={cn(PANEL_TITLE, styles.calcTitle)}>
          {labels.calcTitle}
        </h2>
        <div
          role="tablist"
          aria-label={labels.modeLabel}
          className={cn(styles.segment, styles.tabs)}
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
              className={styles.segItem}
            >
              {tab === value && (
                <motion.span
                  layoutId="vergi-sekme-hap"
                  className={styles.segThumb}
                  transition={reduced ? { duration: 0 } : THUMB_TRANSITION}
                />
              )}
              <span className={styles.segText}>
                {value === "sale" ? <ChartLineUp size={16} weight="duotone" aria-hidden /> : <Coins size={16} weight="duotone" aria-hidden />}
                {value === "sale" ? labels.tabSale : labels.tabDividend}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.yearControl}>
          <span className={styles.yearLabel} id="vergi-yil">
            {labels.yearLabel}
          </span>
          <Segmented
            labelledBy="vergi-yil"
            value={year}
            options={yearList.map((y) => ({ value: y, label: String(y) }))}
            onChange={(y) => {
              setYear(y);
              setThresholdInput(null);
              setYearNote(null);
            }}
          />
        </div>
      </div>

      <div className={styles.importBar}>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          multiple
          hidden
          onChange={(event) => {
            const picked = [...(event.target.files ?? [])];
            event.target.value = "";
            if (picked.length > 0) {
              setImportNote(null);
              setImportFiles(picked);
            }
          }}
        />
        {importFiles ? (
          <StatementImport
            key={importFiles.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|")}
            files={importFiles}
            labels={labels}
            locale={locale}
            today={today}
            onApply={applyImport}
            onCancel={() => setImportFiles(null)}
            onPick={pickFiles}
          />
        ) : (
          <ImportDrop
            labels={labels}
            onPick={pickFiles}
            onFiles={(dropped) => {
              setImportNote(null);
              setImportFiles(dropped);
            }}
          />
        )}
        {importNote && (
          <p role="status" className="mt-3 text-small text-primary-ink">
            {labels.import.applied
              .replace("{trades}", String(importNote.trades))
              .replace("{dividends}", String(importNote.dividends))}
          </p>
        )}
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
              <Segmented
                label={labels.advancedOn}
                value={simple ? "simple" : "many"}
                options={[
                  { value: "simple", label: labels.advancedOff, disabled: !canSimple },
                  { value: "many", label: labels.advancedOn },
                ]}
                onChange={(mode) => setAdvanced(mode === "many")}
              />
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
                    <Field label={labels.symbol} error={symbolError(buyRow?.symbol ?? "")}>
                      <input
                        aria-invalid={!!symbolError(buyRow?.symbol ?? "") || undefined}
                        value={buyRow?.symbol ?? ""}
                        maxLength={10}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => editSimple("buy", { symbol: event.target.value.toUpperCase() })}
                        className={cn(styles.input, styles.upper)}
                      />
                    </Field>
                    <Field label={labels.quantity} hint={readAs(buyRow?.quantity ?? "")} error={numberError(buyRow?.quantity ?? "", "positive")}>
                      <input
                        aria-invalid={!!numberError(buyRow?.quantity ?? "", "positive") || undefined}
                        inputMode="decimal"
                        autoComplete="off"
                        value={buyRow?.quantity ?? ""}
                        onChange={(event) => editSimple("buy", { quantity: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.buyDate}>
                      <DatePicker
                        value={buyRow?.date ?? ""}
                        min={TCMB_MIN_DATE}
                        max={today}
                        today={today}
                        onChange={(value) => editSimple("buy", { date: value })}
                        locale={locale}
                      />
                    </Field>
                    <Field label={labels.priceUsd} hint={readAs(buyRow?.price ?? "")} error={numberError(buyRow?.price ?? "", "nonNegative")}>
                      <input
                        aria-invalid={!!numberError(buyRow?.price ?? "", "nonNegative") || undefined}
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
                      <DatePicker
                        value={sellRow?.date ?? ""}
                        min={buyRow?.date && isIsoDate(buyRow.date) ? buyRow.date : TCMB_MIN_DATE}
                        max={today}
                        today={today}
                        aria-invalid={simpleSellBeforeBuy || undefined}
                        onChange={(value) => editSimple("sell", { date: value })}
                        locale={locale}
                      />
                    </Field>
                    <Field label={labels.priceUsd} hint={readAs(sellRow?.price ?? "")} error={numberError(sellRow?.price ?? "", "nonNegative")}>
                      <input
                        aria-invalid={!!numberError(sellRow?.price ?? "", "nonNegative") || undefined}
                        inputMode="decimal"
                        autoComplete="off"
                        value={sellRow?.price ?? ""}
                        onChange={(event) => editSimple("sell", { price: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.sellQuantity} hint={readAs(sellRow?.quantity ?? "")} error={numberError(sellRow?.quantity ?? "", "positive")}>
                      <input
                        aria-invalid={!!numberError(sellRow?.quantity ?? "", "positive") || undefined}
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
                      <Field label={labels.buyCommission} hint={readAs(buyRow?.commission ?? "")} error={numberError(buyRow?.commission ?? "", "nonNegative")}>
                        <input
                          aria-invalid={!!numberError(buyRow?.commission ?? "", "nonNegative") || undefined}
                          inputMode="decimal"
                          autoComplete="off"
                          value={buyRow?.commission ?? ""}
                          onChange={(event) => editSimple("buy", { commission: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                      <Field label={labels.sellCommission} hint={readAs(sellRow?.commission ?? "")} error={numberError(sellRow?.commission ?? "", "nonNegative")}>
                        <input
                          aria-invalid={!!numberError(sellRow?.commission ?? "", "nonNegative") || undefined}
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
                          <Segmented
                            label={labels.side}
                            value={row.side}
                            options={[
                              { value: "buy", label: labels.sideBuy },
                              { value: "sell", label: labels.sideSell },
                            ]}
                            onChange={(side) => updateTrade(row.id, { side })}
                          />
                          <button
                            type="button"
                            onClick={() => removeTrade(row.id)}
                            aria-label={labels.removeAria.replace("{row}", String(index + 1))}
                            className={styles.remove}
                          >
                            <Trash size={16} weight="duotone" aria-hidden />
                          </button>
                        </div>
                        <Field label={labels.symbol} error={symbolError(row.symbol)}>
                          <input
                            aria-invalid={!!symbolError(row.symbol) || undefined}
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
                          <DatePicker
                            value={row.date}
                            min={TCMB_MIN_DATE}
                            max={today}
                            today={today}
                            onChange={(value) => {
                              updateTrade(row.id, { date: value });
                              if (row.side === "sell") followSellYear(value);
                            }}
                            locale={locale}
                          />
                        </Field>
                        <Field label={labels.quantity} hint={readAs(row.quantity)} error={numberError(row.quantity, "positive")}>
                          <input
                            aria-invalid={!!numberError(row.quantity, "positive") || undefined}
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.quantity}
                            onChange={(event) => updateTrade(row.id, { quantity: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <Field label={labels.priceUsd} hint={readAs(row.price)} error={numberError(row.price, "nonNegative")}>
                          <input
                            aria-invalid={!!numberError(row.price, "nonNegative") || undefined}
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.price}
                            onChange={(event) => updateTrade(row.id, { price: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <Field label={labels.commissionUsd} hint={readAs(row.commission)} error={numberError(row.commission, "nonNegative")}>
                          <input
                            aria-invalid={!!numberError(row.commission, "nonNegative") || undefined}
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
                  <EmptyLead text={labels.resultEmptySale} />
                ) : (
                  <>
                    <VerdictBadge verdict={saleVerdict} text={saleVerdict === "yes" ? labels.verdictYes : labels.verdictNo} />
                    <p className={styles.verdictBody}>{saleVerdict === "yes" ? labels.verdictYesBody : labels.verdictNoBody}</p>
                  </>
                )}
              </div>

              {/* BOŞKEN İSKELET, DOLUNCA SAYI. Eskiden boş kart "Net Kazanç —",
                  "Tahmini Vergi —" ve dört "—" satırlık bir şelaleydi: okuyucu
                  bozuk bir ekrana bakıyordu. Şimdi gelecek sonucun soluk bir
                  önizlemesi duruyor; sayı yok, yalnızca yerleri. */}
              {saleReady ? (
                <div key="sale-ready" className={styles.filled}>
                  <div>
                    <p className={styles.figureLabel}>{totals.gainTl < 0 ? labels.netLoss : labels.netGain}</p>
                    <Rolling
                      value={totals.gainTl}
                      format={liraSigned}
                      className={cn(styles.big, directionText(directionOf(totals.gainTl)))}
                    />
                  </div>

                  <div className={styles.figures} data-cols={taxable > 0 ? "2" : undefined}>
                    <div>
                      <p className={styles.figureLabel}>{labels.taxBase}</p>
                      <p className={cn(styles.mid, "mt-1")}>
                        <Rolling value={taxable} format={lira} />
                      </p>
                      <p className={styles.figureHint}>{labels.taxBaseHint}</p>
                    </div>
                    {taxable > 0 && (
                      <div>
                        <p className={styles.figureLabel}>{labels.bracket}</p>
                        <p className={cn(styles.mid, "mt-1")}>{percentText(bracketRate, locale)}</p>
                        <p className={styles.figureHint}>{labels.bracketHint.replace("{year}", String(year))}</p>
                      </div>
                    )}
                  </div>

                  <div className={styles.taxBlock}>
                    <p className={styles.figureLabel}>{labels.estTax}</p>
                    <p className={cn(styles.mid, "mt-1")}>
                      <Rolling value={taxLow} format={lira} />
                      {taxHigh > taxLow && (
                        <>
                          <span className={styles.between}>{labels.estTaxBetween}</span>
                          <Rolling value={taxHigh} format={lira} />
                        </>
                      )}
                    </p>
                    {taxHigh > 0 && (
                      <TaxRange
                        low={taxLow}
                        high={taxHigh}
                        lowLabel={labels.rangeLow}
                        highLabel={labels.rangeHigh.replace("{top}", String(topRate))}
                        ariaLabel={labels.rangeLabel.replace("{low}", lira(taxLow)).replace("{high}", lira(taxHigh))}
                      />
                    )}
                    <p className={styles.figureHint}>
                      {labels.estTaxHint.replace("{year}", String(year)).replace("{top}", String(topRate))}
                    </p>
                  </div>

                  {taxable > 0 && (
                    <BracketTable
                      title={labels.bracketTableTitle.replace("{year}", String(year))}
                      hint={labels.bracketTableHint}
                      brackets={rules.brackets}
                      base={taxable}
                      /* Eşikler ve dilim vergileri tam lira; kuruş tabloyu
                         kalabalıklaştırıyordu ("190.000,00 ₺"). */
                      formatMoney={(value) => formatLira(Math.round(value), locale, 0)}
                      formatRate={(rate) => percentText(rate, locale)}
                      yoursLabel={labels.bracketYours}
                      overLabel={labels.bracketOver}
                      sliceLabel={labels.bracketSlice}
                      rangeLabel={labels.bracketRange}
                      rateLabel={labels.bracketRate}
                    />
                  )}

                  <Basis title={labels.basisTitle} items={saleBasis} />

                  <Flow title={labels.flowTitle} steps={flowSteps} />
                </div>
              ) : (
                <ResultPreview
                  rows={[
                    { name: labels.netGain, size: "big" },
                    { name: labels.taxBase, size: "mid" },
                    { name: labels.estTax, size: "range" },
                  ]}
                />
              )}

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
                      <Field label={labels.symbol} error={symbolError(row.symbol)}>
                        <input
                          aria-invalid={!!symbolError(row.symbol) || undefined}
                          value={row.symbol}
                          maxLength={10}
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => updateDividend(row.id, { symbol: event.target.value.toUpperCase() })}
                          className={cn(styles.input, styles.upper)}
                        />
                      </Field>
                      <Field label={labels.grossUsd} hint={readAs(row.gross)} error={numberError(row.gross, "nonNegative")}>
                        <input
                          aria-invalid={!!numberError(row.gross, "nonNegative") || undefined}
                          inputMode="decimal"
                          autoComplete="off"
                          value={row.gross}
                          onChange={(event) => updateDividend(row.id, { gross: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                      <Field label={labels.paymentDate}>
                        <DatePicker
                          value={row.date}
                          min={TCMB_MIN_DATE}
                          max={today}
                          today={today}
                          onChange={(value) => updateDividend(row.id, { date: value })}
                          locale={locale}
                        />
                      </Field>
                      <div className={cn(styles.field, styles.fieldWide)}>
                        <span className={styles.label} id={`${row.id}-w8`}>
                          {labels.w8Label}
                        </span>
                        <Segmented
                          labelledBy={`${row.id}-w8`}
                          value={row.withholding}
                          options={(row.statementPct === null ? (["w8ben", "none"] as const) : (["statement", "w8ben", "none"] as const)).map((option) => ({
                            value: option,
                            label:
                              option === "w8ben"
                                ? labels.w8Yes
                                : option === "none"
                                  ? labels.w8No
                                  : labels.w8Statement.replace("{pct}", formatPct(row.statementPct ?? 0, locale)),
                          }))}
                          onChange={(option) => updateDividend(row.id, { withholding: option })}
                        />
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
                  {rules.thresholdCarriedFrom
                    ? labels.thresholdCarried.replace("{year}", String(year)).replace("{from}", String(rules.thresholdCarriedFrom))
                    : labels.thresholdSource.replace("{source}", rules.source[locale === "tr" ? "tr" : "en"])}
                </span>
              </label>
            </Settings>
          </div>

          <div className={styles.result}>
            <div className={styles.resultInner}>
              <h3 className="sr-only">{labels.resultLabel}</h3>
              <div aria-live="polite">
                {dividendVerdict === "wait" ? (
                  <EmptyLead text={labels.resultEmptyDividend} />
                ) : (
                  <>
                    <VerdictBadge verdict={dividendVerdict} text={dividendVerdict === "yes" ? labels.verdictYes : labels.verdictNo} />
                    <p className={styles.verdictBody}>
                      {fillDividend(dividendVerdict === "yes" ? labels.dividendOver : labels.dividendUnder)}
                    </p>
                  </>
                )}
              </div>

              {dividendReady ? (
                <div key="dividend-ready" className={styles.filled}>
                  <div>
                    <p className={styles.figureLabel}>{labels.totalGrossTl}</p>
                    <Rolling value={dividendGrossTl} format={lira} className={cn(styles.big, "text-strong")} />
                    <DividendMeter
                      total={dividendGrossTl}
                      limit={threshold}
                      leftLabel={formatLira(0, locale, 0)}
                      rightLabel={labels.meterLimit.replace("{limit}", formatLira(threshold, locale, 0))}
                    />
                  </div>

                  <div className={styles.figures}>
                    <div>
                      <p className={styles.figureLabel}>{labels.withheldTl}</p>
                      <p className={cn(styles.mid, "mt-1")}>
                        <Rolling value={dividendWithheldTl} format={lira} />
                      </p>
                      <p className={styles.figureHint}>{labels.withheldHint}</p>
                    </div>
                  </div>

                  <Basis title={labels.basisTitle} items={dividendBasis} />
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <ResultPreview
                    rows={[
                      { name: labels.totalGrossTl, size: "big" },
                      { name: labels.withheldTl, size: "mid" },
                    ]}
                  />
                  {/* Sınır boşken de gerçek bir bilgi: çentik yılın sınırında. */}
                  <DividendMeter
                    total={0}
                    limit={threshold}
                    leftLabel={formatLira(0, locale, 0)}
                    rightLabel={labels.meterLimit.replace("{limit}", formatLira(threshold, locale, 0))}
                  />
                </div>
              )}

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

/**
 * Ekstreden aktarımın kapısı — sayfanın ilk JS'inde kalan TEK parçası.
 * Hem düğme hem bırakma alanı: tıklayınca dosya seçici açılıyor, üstüne
 * dosya bırakılınca doğrudan okumaya geçiyor. Gizlilik cümlesi kapının
 * üstünde, okuyucu dosyayı seçmeden ÖNCE görsün diye.
 */
function ImportDrop({
  labels,
  onPick,
  onFiles,
}: {
  labels: TaxLabels;
  onPick: () => void;
  onFiles: (files: File[]) => void;
}) {
  const L = labels.import;
  const [over, setOver] = useState(false);
  return (
    <div
      className={styles.drop}
      data-over={over || undefined}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setOver(true);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const files = [...event.dataTransfer.files];
        if (files.length > 0) onFiles(files);
      }}
    >
      {/* Düğme bütün alanı kaplıyor (`::after`), gizlilik künyesi onun
          üstünde ama tıklamayı geçiriyor: okuyucu şeridin neresine basarsa
          bassın dosya seçici açılıyor. */}
      <button type="button" onClick={onPick} className={styles.dropButton}>
        <span className={styles.dropIcon} aria-hidden>
          <FileArrowUp size={22} weight="duotone" />
        </span>
        <span className="min-w-0">
          <span className={styles.dropTitle}>{over ? L.drop : L.open}</span>
          <span className={styles.dropHint}>{L.formats}</span>
        </span>
      </button>
      <p className={styles.privacy}>
        <LockSimple size={14} weight="duotone" aria-hidden />
        {L.privacy}
      </p>
    </div>
  );
}

/** "%20" (TR) · "20%" (EN). */
function percentText(value: number, locale: Locale): string {
  const text = formatPct(value, locale);
  return locale === "tr" ? `%${text}` : `${text}%`;
}

type BasisItem = { name: string; value: string; note?: string };

/**
 * HESABIN DAYANAĞI — sonucun hangi sayılara dayandığı, künye olarak.
 * Kur eskiden yalnızca formdaki çiplerde duruyordu; sonuç kartına bakan
 * okuyucu sayının hangi kurla bulunduğunu formun yukarısında arıyordu.
 */
function Basis({ title, items }: { title: string; items: BasisItem[] }) {
  return (
    <section className={styles.basis}>
      <h4 className={styles.basisTitle}>{title}</h4>
      <dl className={styles.basisList}>
        {items.map((item) => (
          <div key={item.name}>
            <dt>{item.name}</dt>
            <dd>
              <span className="numeral">{item.value}</span>
              {item.note && <span className={styles.basisNote}>{item.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Sonuç boşken tek cümlelik yönlendirme; ikon formun ne işe yaradığını söylüyor. */
function EmptyLead({ text }: { text: string }) {
  return (
    <p className={styles.emptyLead}>
      <span className={styles.emptyIcon} aria-hidden>
        <Calculator size={20} weight="duotone" />
      </span>
      {text}
    </p>
  );
}

/** Segmentin kayan parçası: marka eğrisi, portföy penceresiyle aynı süre. */
const THUMB_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const;

type SegmentOption<T extends string | number> = { value: T; label: React.ReactNode; disabled?: boolean };

/**
 * SAYFANIN TEK SEÇİM DENETİMİ — yıl, hesap türü dışındaki bütün ikili
 * seçimler (tek/çoklu işlem, alış/satış, W-8BEN, kur günü).
 *
 * Eskiden her biri seçili parçası mavi dolgulu bir hap idi; bir ekranda
 * beş mavi hap, birincil eylem gibi okunuyor ve gerçek eylemle (beyan
 * rozeti) yarışıyordu. Şimdi portföy penceresinin segment dili: çukur ray,
 * seçili parça panel zemininde ve kayarak geçiyor (`layoutId`, örnek başına
 * `useId` ile tekil). Anlamı `aria-pressed` taşıyor, rengi değil. Hareketi
 * azaltan okuyucuda parça yerine atlar.
 */
function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  labelledBy,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  labelledBy?: string;
}) {
  const id = useId();
  const reduced = useMotionPreference();
  return (
    <span role="group" aria-label={label} aria-labelledby={labelledBy} className={styles.segment}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={styles.segItem}
          >
            {on && (
              <motion.span
                layoutId={`${id}-thumb`}
                className={styles.segThumb}
                transition={reduced ? { duration: 0 } : THUMB_TRANSITION}
              />
            )}
            <span className={styles.segText}>{option.label}</span>
          </button>
        );
      })}
    </span>
  );
}

/** Stopaj oranı: "%15" (TR) · "15%" (EN) — iki ondalığa kadar. */
function formatPct(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: PCT_DIGITS }).format(value);
}

/** Etiket ÜSTTE, alan altta, hata en altta. Yer tutucu etiket değildir. */
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  /** Belirsiz sayı girişinin nasıl okunduğu (lib/decimal-input.ts). */
  hint?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error ? (
        <span className={styles.fieldError}>
          <WarningCircle size={14} weight="fill" aria-hidden />
          {error}
        </span>
      ) : (
        hint && <span className={styles.help} role="status">{hint}</span>
      )}
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
          <Segmented
            labelledBy="vergi-kur-gunu"
            value={rateDay}
            options={[
              { value: "same", label: labels.rateDaySame },
              { value: "previous", label: labels.rateDayPrevious },
            ]}
            onChange={setRateDay}
          />
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
      {/* Döküm yokken düğme hiç yok: soluk, basılamayan bir düğme boş
          kartta bir hata gibi duruyordu. */}
      {!csvDisabled && (
        <div className={cn(styles.actions, "pt-1")}>
          <button type="button" onClick={onCsv} className={buttonClass({ variant: "ghost", size: "sm" })}>
            <DownloadSimple size={14} weight="bold" aria-hidden />
            {labels.exportCsv}
          </button>
        </div>
      )}
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
