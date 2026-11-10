"use client";

import { EASE_BRAND_POINTS } from "@/lib/motion";

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import {
  ArrowDown,
  Bank,
  Calculator,
  ChartLineUp,
  Check,
  Coins,
  DownloadSimple,
  FileArrowUp,
  HandCoins,
  LockSimple,
  Plus,
  Receipt,
  Scales,
  ShoppingCartSimple,
  Sparkle,
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
import { BracketTable, DividendMeter, ResultPreview, Rolling, TaxRange, VerdictBadge, Waterfall, type Verdict, type WaterfallStep } from "./TaxResult";
import { waterfallOf, type Waterfall as WaterfallGeometry } from "@/lib/tax-waterfall";
import type { ImportPayload } from "./StatementImport";
import { PANEL_TITLE, TAX_EXAMPLE, type DividendRow, type TradeRow } from "./tax-ui";
import { RATE_LOAD_IDLE, rateLoadReducer, ratesFailedOf } from "./rate-load";
import styles from "./Tax.module.css";
import { DatePicker } from "@/components/ui/DatePicker";
import { SymbolField } from "./SymbolField";
import { TaxRibbon, type RibbonValues } from "./TaxRibbon";
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
export type TaxVisualLabels = Dictionary["taxVisuals"];

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
/** CSV'nin blob adresi bu kadar sonra bırakılır — gerekçe `downloadCsv`. */
const CSV_URL_TTL_MS = 40_000;

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
  visuals,
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
  /** Şelale ve dilim bandının metni (`taxVisuals` ad alanı). */
  visuals: TaxVisualLabels;
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
  /* Kur yüklemesinin uçuşu ve düşen günleri tek durumda (rate-load.ts,
     8 Kasım): üç bayrak takılan "yükleniyor" ile hatayı gizliyordu. */
  const [rateLoad, dispatchRateLoad] = useReducer(rateLoadReducer, RATE_LOAD_IDLE);
  const [imported, setImported] = useState(0);
  /* Form örnek işlemle mi dolu: künye bunu söylüyor, ilk düzenlemede kalkıyor. */
  const [exampleOn, setExampleOn] = useState(false);
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
      /* PORTFÖYDE KAYITLI SATIŞLAR (9 Ekim). Satılmış partiler yukarıda alış
         olarak geldi; satışın kendisi aynı gün ve fiyattaki partiler
         birleşerek TEK satış satırı oluyor (portföyde bir satış olayı). */
      const soldGroups = new Map<string, { symbol: string; date: string; price: number; quantity: number }>();
      for (const p of positions) {
        if (!p.soldAt || !p.priceUsd) continue;
        const key = `${p.symbol}|${p.soldAt}|${p.priceUsd}`;
        const group = soldGroups.get(key);
        if (group) group.quantity += p.quantity;
        else soldGroups.set(key, { symbol: p.symbol, date: p.soldAt, price: p.priceUsd, quantity: p.quantity });
      }
      const sells = [...soldGroups.values()].map((sale) => ({
        id: nextId("t"),
        side: "sell" as const,
        symbol: sale.symbol,
        date: sale.date,
        quantity: decimalText(sale.quantity),
        price: formatDecimalInput(sale.price, locale, { money: true }),
        commission: "",
      }));
      if (sells.length > 0) {
        setTrades([...buys, ...sells]);
        setAdvanced(true);
        setTab("sale");
        setImported(positions.length);
        return;
      }
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

  /* ---- Örnek işlem (18 Ekim) ----
     "Nasıl Hesaplanır"daki çalışılmış örnekle AYNI işlem (`TAX_EXAMPLE`,
     tax-ui.ts) tek alış ve satış görünümüne yazılıyor; okuyucunun girdiği
     işlemlerin yerini alıyor (düğme boş sonuçta ve anlatımda, yani çoğu zaman
     form zaten boş). Kurlar gerçek: tarihler girilince her zamanki akışla
     TCMB'den geliyor. Vergi yılı satışın yılına geçiyor. */
  const exampleSymbol = labels.how.exampleSymbol;
  const fillExample = useCallback(() => {
    const E = TAX_EXAMPLE;
    const quantity = decimalText(E.quantity);
    setTrades([
      { ...emptyTrade(nextId("t"), "buy"), symbol: exampleSymbol, date: E.buyDate, quantity, price: decimalText(E.buyPrice) },
      { ...emptyTrade(nextId("t"), "sell"), symbol: exampleSymbol, date: E.sellDate, quantity, price: decimalText(E.sellPrice) },
    ]);
    setSellQtyLinked(true);
    setAdvanced(false);
    setTab("sale");
    setImported(0);
    setYearNote(null);
    const sellYear = Number(E.sellDate.slice(0, 4));
    if (years[sellYear]) {
      setYear(sellYear);
      setThresholdInput(null);
    }
    setExampleOn(true);
  }, [decimalText, exampleSymbol, years]);

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
      const target = event.target as Element | null;
      const link = target?.closest?.("a[data-tax-path]");
      pick(link?.getAttribute("data-tax-path"));
      /* Anlatımdaki "Örnekle Dene" düz bir `#satis` çapası; kaydırma
         tarayıcının, doldurma burada. */
      if (target?.closest?.("a[data-tax-example]")) fillExample();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [fillExample]);

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
  /* İsteği düşen gün de "eksik" sayılmaz: yoksa düşen parti aynı anahtarla
     takılır ve arkasındaki parti hiç sorulmazdı. "Tekrar Dene" kümeyi
     boşaltınca anahtar değişir, efekt yeniden koşar. */
  const missingKey = neededDates.filter((date) => !(date in rates) && !rateLoad.failed.has(date)).join(",");
  const ratesFailed = ratesFailedOf(rateLoad, neededDates, rates);

  useEffect(() => {
    if (!missingKey) return;
    const missing = missingKey.split(",").slice(0, RATE_BATCH);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      dispatchRateLoad({ type: "start" });
      fetch(`/api/kur?tarihler=${missing.join(",")}`)
        .then((res) => res.json() as Promise<KurResponse>)
        .then((data) => {
          if (cancelled) return;
          if (!data.ok) {
            dispatchRateLoad({ type: "settle", dates: missing, ok: false });
            return;
          }
          /* Bulunamayan gün de yazılıyor (null): aynı gün her tuşta yeniden
             sorulmasın. "Tekrar Dene" onları siliyor. */
          setRates((prev) => ({ ...prev, ...data.rates }));
          dispatchRateLoad({ type: "settle", dates: missing, ok: true });
        })
        .catch(() => {
          if (!cancelled) dispatchRateLoad({ type: "settle", dates: missing, ok: false });
        });
    }, RATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      /* Temizlik uçuşu HER DURUMDA bitirir: eski `.finally` `cancelled`
         yüzünden atlanıyor, yeni anahtar boşsa "yükleniyor" takılı kalıyordu. */
      dispatchRateLoad({ type: "cancel" });
    };
  }, [missingKey]);

  const retryRates = () => {
    setRates((prev) => {
      const next: RateState = {};
      for (const [date, rate] of Object.entries(prev)) if (rate) next[date] = rate;
      return next;
    });
    dispatchRateLoad({ type: "retry" });
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
  const liraWhole = useCallback((value: number) => formatLira(Math.round(value), locale, 0), [locale]);
  const liraWholeSigned = useCallback((value: number) => formatLira(Math.round(value), locale, 0, true), [locale]);
  /* Para alanlarının yer tutucusu dile göre ondalık ayraçlı (6 Kasım): alan
     boşken bile "virgülle yaz" der; `readAs` ipucu bu yüzden daha az çıkar. */
  const moneyPlaceholder = locale === "tr" ? "0,00" : "0.00";
  const quantityText = (value: number) =>
    new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: QUANTITY_DIGITS }).format(value);

  /* ---- Satır düzenleme ---- */
  const buyRow = trades.find((row) => row.side === "buy");
  const sellRow = trades.find((row) => row.side === "sell");
  const canSimple =
    trades.filter((row) => row.side === "buy").length <= 1 && trades.filter((row) => row.side === "sell").length <= 1;
  const simple = !advanced && canSimple;

  const updateTrade = (id: string, patch: Partial<TradeRow>) => {
    setExampleOn(false);
    setTrades((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
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
    setExampleOn(false);
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
        /* Dolar tutarları (9 Ekim): dosya geri yüklendiğinde oturum birebir
           kurulabilsin (lib/tax-import/own.ts). Komisyon dahil. */
        labels.costUsdColumn,
        labels.proceedsUsdColumn,
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
        r.costUsd,
        r.proceedsUsd,
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
    /* Bağlantı belgeye takılıp tıklanır, adres GECİKMELİ bırakılır (20
       Ekim): WebKit (Safari, iOS) blob indirmesini tıklamadan sonra
       başlatıyor; aynı adımda `revokeObjectURL` indirmeyi düşürebiliyordu
       ("WebKitBlobResource error 1"). Bu dosya oturumu geri yüklemenin tek
       yolu (lib/tax-import/own.ts). 40 sn, FileSaver'ın da beklediği süre. */
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), CSV_URL_TTL_MS);
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
    /* İsteği düşen gün "getiriliyor"da takılmaz; yok olarak okunur. */
    if (rate === undefined && !rateLoad.failed.has(key)) {
      return (
        <p key={`${key}:wait`} className={styles.chip} data-state="loading">
          {labels.rateLoading}
        </p>
      );
    }
    if (!rate) {
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

  /* Boş sonucun önizlemesi: "Nasıl Hesaplanır"ın varsayımsal örneği, AYNI
     kodla (`lotResult`, `progressiveTax`) ve seçili yılın tarifesiyle
     (`TaxHow` → `TaxExample` ile aynı girdi). Kur ve endeks varsayımsal;
     kart bunu rozetle söylüyor. */
  const examplePreview = useMemo<RibbonValues>(() => {
    const E = TAX_EXAMPLE;
    const lot = lotResult(
      {
        sellId: "ornek-s",
        buyId: "ornek-b",
        symbol: labels.how.exampleSymbol,
        buyDate: E.buyDate,
        sellDate: E.sellDate,
        quantity: E.quantity,
        costUsd: E.quantity * E.buyPrice,
        proceedsUsd: E.quantity * E.sellPrice,
      },
      E.buyRate,
      E.sellRate,
      100,
      100 * E.indexRatio,
    );
    const gain = lot.gainTl ?? 0;
    const base = Math.max(0, gain);
    return {
      gainTl: gain,
      baseTl: base,
      taxTl: progressiveTax(base, rules.brackets),
      taxHighTl: (base * rules.brackets[rules.brackets.length - 1].ratePct) / 100,
      bracketRate: formatPct(rules.brackets.find((b) => b.upTo === null || base <= b.upTo)?.ratePct ?? 0, locale),
      source: {
        priceTl: (lot.proceedsUsd - lot.costUsd) * E.sellRate,
        fxTl: lot.costUsd * (E.sellRate - E.buyRate),
        indexTl: -((lot.taxCostTl ?? 0) - (lot.costTl ?? 0)),
      },
    };
  }, [labels.how.exampleSymbol, rules.brackets, locale]);

  /* ---- Satış sonucu ---- */
  const saleReady = complete.length > 0;
  /* Şeridin sayıları (`TaxRibbon`). Kaynak ayrıştırması tamamlanan lotların
     toplamı — `yearTotals` ile AYNI küme, yani fiyat + kur + endeks tam
     olarak net kazanca eşit. Yeni bir vergi hesabı değil, özdeşlik. */
  const ribbon: RibbonValues = {
    gainTl: totals.gainTl,
    baseTl: taxable,
    taxTl: taxLow,
    /* Üst uç da şeride gidiyor (6 Kasım, inceleme): kart aralık yazarken
       şerit yalnız alt ucu basıyordu. Gerekçe `TaxRibbon.tsx` başında. */
    taxHighTl: taxHigh,
    bracketRate: formatPct(bracketRate, locale),
    source: complete.reduce(
      (sum, lot) => {
        const buy = lot.buyRate ?? 0;
        const sell = lot.sellRate ?? 0;
        return {
          priceTl: sum.priceTl + (lot.proceedsUsd - lot.costUsd) * sell,
          fxTl: sum.fxTl + lot.costUsd * (sell - buy),
          indexTl: sum.indexTl - ((lot.taxCostTl ?? 0) - (lot.costTl ?? 0)),
        };
      },
      { priceTl: 0, fxTl: 0, indexTl: 0 },
    ),
  };
  const saleVerdict: Verdict = !saleReady ? "wait" : totals.gainTl > 0 ? "yes" : "no";
  const flow = buildFlow({
    labels,
    visuals,
    locale,
    results: complete,
    rawCostTl,
    taxCostTl: totals.costTl,
    proceedsTl: totals.proceedsTl,
    gainTl: totals.gainTl,
    baseTl: Math.max(0, totals.gainTl),
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

  /* MOBİLDE SONUÇ ÖZETİ ALTTA (6 Kasım, sahibinin sözü). 1024'ün altında
     sonuç formun ALTINA iniyor; 390'da son alanı dolduran okuyucu sonucu
     görmek için ~700 piksel kaydırıyordu ve bir değeri değiştirince sonucu
     yeniden aramak zorundaydı. Hesaplayıcı ekrandayken ve sonuç kartı
     görünmüyorken alt sekme çubuğunun hemen üstünde tek satır özet duruyor:
     karar, tahmini vergi (temettüde toplam) ve "Sonuca Git". Geniş ekranda
     sonuç kolonu zaten yan yana ve yapışkan; özet orada hiç açılmıyor.

     İnceleme düzeltmeleri (6 Kasım):
     - Gözlemcinin kökü alttan, alt katmanın (sekme çubuğu + özet) boyu kadar
       DARALTILDI (`rootMargin` negatif). Önceden sonuç kartının ilk pikseli
       pencerenin dibine değer değmez — yani hâlâ sekme çubuğunun ve özetin
       ARKASINDAYKEN — özet kayboluyordu. Boy, özetin kendi üst kenarından
       ölçülüyor (konumu CSS'te güvenli alana bağlı: hesaplanmış `bottom` +
       kendi boyu); özet basılmamışsa
       390'daki hesap: 16 + 64 + 8 + ~62 = 150.
     - Bir form alanı odaktayken özet gizli: telefonda klavye açıkken sabit
       katman odaktaki alanın üstüne biniyordu.
     - "Sonuca Git" kaydırınca odak da sonuç başlığına iner (`tabIndex=-1`,
       `preventScroll`); klavye ve ekran okuyucu okuyucusu formda kalmasın. */
  const sectionRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barOn, setBarOn] = useState(false);
  const barReady = tab === "sale" ? saleReady : dividendReady;
  useEffect(() => {
    const result = resultRef.current;
    const section = sectionRef.current;
    if (!result || !section || typeof IntersectionObserver === "undefined") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const bar = barRef.current;
    /* `bottom` + boy: kapalı özetin `translate` kayması ölçüye girmesin. */
    const layer = bar ? Math.round((parseFloat(getComputedStyle(bar).bottom) || 0) + bar.offsetHeight) : 150;
    let resultSeen = true;
    let sectionSeen = false;
    let typing = false;
    const update = () => setBarOn(media.matches && sectionSeen && !resultSeen && !typing);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === result) resultSeen = entry.isIntersecting;
          else sectionSeen = entry.isIntersecting;
        }
        update();
      },
      { rootMargin: `0px 0px -${layer}px 0px` },
    );
    const isField = (node: EventTarget | null) =>
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement ||
      (node instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file", "hidden"].includes(node.type));
    const onFocusIn = (event: FocusEvent) => {
      typing = isField(event.target);
      update();
    };
    const onFocusOut = (event: FocusEvent) => {
      typing = isField(event.relatedTarget) && section.contains(event.relatedTarget as Node);
      update();
    };
    observer.observe(result);
    observer.observe(section);
    section.addEventListener("focusin", onFocusIn);
    section.addEventListener("focusout", onFocusOut);
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      section.removeEventListener("focusin", onFocusIn);
      section.removeEventListener("focusout", onFocusOut);
      media.removeEventListener("change", update);
    };
  }, [tab, barReady]);
  const goToResult = () => {
    const result = resultRef.current;
    if (!result) return;
    result.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    result.querySelector<HTMLElement>("[data-result-heading]")?.focus({ preventScroll: true });
  };

  const buyDone = !!buyRow && dateUsable(buyRow.date) && num(buyRow.quantity) !== null && num(buyRow.price) !== null && isValidSymbol(buyRow.symbol.trim());
  const sellDone = !!sellRow && dateUsable(sellRow.date) && num(sellRow.price) !== null && num(sellRow.quantity) !== null;

  return (
    <section ref={sectionRef} id="satis" className={cn("panel overflow-hidden", styles.calc)} aria-labelledby="vergi-hesap">
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
          <div className={styles.form} onKeyDown={advanceOnEnter}>
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
              <span className={cn(styles.help, styles.kbdHint)}>{labels.form.keyboardHint}</span>
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
            {exampleOn && (
              <p role="status" className={styles.exampleNote}>
                <Sparkle size={16} weight="duotone" aria-hidden />
                {labels.exampleFilled}
              </p>
            )}

            {simple ? (
              <ol className={styles.steps}>
                <li className={styles.step} data-done={buyDone}>
                  <span className={styles.node} aria-hidden>{buyDone ? <Check size={14} weight="bold" /> : 1}</span>
                  <h3 className={styles.stepTitle}>{labels.stepBuy}</h3>
                  <div className={styles.fields}>
                    <SymbolCell
                      label={labels.symbol}
                      error={symbolError(buyRow?.symbol ?? "")}
                      invalid={!!symbolError(buyRow?.symbol ?? "")}
                      value={buyRow?.symbol ?? ""}
                      onChange={(symbol) => editSimple("buy", { symbol })}
                      placeholder={labels.form.symbolPlaceholder}
                      listLabel={labels.form.suggestions}
                      searchingLabel={labels.form.searching}
                      className={styles.input}
                    />
                    <Field label={labels.quantity} suffix={labels.form.unitShares} hint={readAs(buyRow?.quantity ?? "")} error={numberError(buyRow?.quantity ?? "", "positive")}>
                      <input
                        aria-invalid={!!numberError(buyRow?.quantity ?? "", "positive") || undefined}
                        inputMode="decimal"
                        enterKeyHint="next"
                        placeholder="0"
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
                    <Field unit="$" label={labels.priceUsd} hint={readAs(buyRow?.price ?? "")} error={numberError(buyRow?.price ?? "", "nonNegative")}>
                      <input
                        aria-invalid={!!numberError(buyRow?.price ?? "", "nonNegative") || undefined}
                        inputMode="decimal"
                        enterKeyHint="next"
                        placeholder={moneyPlaceholder}
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
                  <span className={styles.node} aria-hidden>{sellDone ? <Check size={14} weight="bold" /> : 2}</span>
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
                    <Field unit="$" label={labels.priceUsd} hint={readAs(sellRow?.price ?? "")} error={numberError(sellRow?.price ?? "", "nonNegative")}>
                      <input
                        aria-invalid={!!numberError(sellRow?.price ?? "", "nonNegative") || undefined}
                        inputMode="decimal"
                        enterKeyHint="next"
                        placeholder={moneyPlaceholder}
                        autoComplete="off"
                        value={sellRow?.price ?? ""}
                        onChange={(event) => editSimple("sell", { price: event.target.value })}
                        className={styles.input}
                      />
                    </Field>
                    <Field label={labels.sellQuantity} suffix={labels.form.unitShares} hint={readAs(sellRow?.quantity ?? "")} error={numberError(sellRow?.quantity ?? "", "positive")}>
                      <input
                        aria-invalid={!!numberError(sellRow?.quantity ?? "", "positive") || undefined}
                        inputMode="decimal"
                        enterKeyHint="next"
                        placeholder="0"
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
                      <Field unit="$" label={labels.buyCommission} hint={readAs(buyRow?.commission ?? "")} error={numberError(buyRow?.commission ?? "", "nonNegative")}>
                        <input
                          aria-invalid={!!numberError(buyRow?.commission ?? "", "nonNegative") || undefined}
                          inputMode="decimal"
                          enterKeyHint="next"
                          placeholder={moneyPlaceholder}
                          autoComplete="off"
                          value={buyRow?.commission ?? ""}
                          onChange={(event) => editSimple("buy", { commission: event.target.value })}
                          className={styles.input}
                        />
                      </Field>
                      <Field unit="$" label={labels.sellCommission} hint={readAs(sellRow?.commission ?? "")} error={numberError(sellRow?.commission ?? "", "nonNegative")}>
                        <input
                          aria-invalid={!!numberError(sellRow?.commission ?? "", "nonNegative") || undefined}
                          inputMode="decimal"
                          enterKeyHint="next"
                          placeholder={moneyPlaceholder}
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
                        <SymbolCell
                          label={labels.symbol}
                          error={symbolError(row.symbol)}
                          invalid={!!symbolError(row.symbol)}
                          value={row.symbol}
                          onChange={(symbol) => updateTrade(row.id, { symbol })}
                          placeholder={labels.form.symbolPlaceholder}
                          listLabel={labels.form.suggestions}
                          searchingLabel={labels.form.searching}
                          className={styles.input}
                        />
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
                        <Field label={labels.quantity} suffix={labels.form.unitShares} hint={readAs(row.quantity)} error={numberError(row.quantity, "positive")}>
                          <input
                            aria-invalid={!!numberError(row.quantity, "positive") || undefined}
                            inputMode="decimal"
                            enterKeyHint="next"
                            placeholder="0"
                            autoComplete="off"
                            value={row.quantity}
                            onChange={(event) => updateTrade(row.id, { quantity: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <Field unit="$" label={labels.priceUsd} hint={readAs(row.price)} error={numberError(row.price, "nonNegative")}>
                          <input
                            aria-invalid={!!numberError(row.price, "nonNegative") || undefined}
                            inputMode="decimal"
                            enterKeyHint="next"
                            placeholder={moneyPlaceholder}
                            autoComplete="off"
                            value={row.price}
                            onChange={(event) => updateTrade(row.id, { price: event.target.value })}
                            className={styles.input}
                          />
                        </Field>
                        <Field unit="$" label={labels.commissionUsd} hint={readAs(row.commission)} error={numberError(row.commission, "nonNegative")}>
                          <input
                            aria-invalid={!!numberError(row.commission, "nonNegative") || undefined}
                            inputMode="decimal"
                            enterKeyHint="next"
                            placeholder={moneyPlaceholder}
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

          <div ref={resultRef} className={styles.result}>
            <div className={styles.resultInner} aria-labelledby="vergi-sonuc-satis">
              <h3 id="vergi-sonuc-satis" className="sr-only" tabIndex={-1} data-result-heading>
                {labels.resultLabel}
              </h3>
              <div aria-live="polite">
                {saleVerdict === "wait" ? (
                  <EmptyLead text={labels.resultEmptySale} how={labels.how.readHow} />
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

                  {/* ŞELALE SAYININ HEMEN ALTINDA (18 Ekim). Kartın dibindeydi,
                      dayanağın da altında; okuyucu büyük sayının nereden
                      geldiğini görmek için matrah, vergi ve tarifeyi geçmek
                      zorundaydı. Sıra artık okuma sırası: kazanç → nasıl
                      oluştu → matrah ve dilim → vergi → tarifedeki yer →
                      dayanak. */}
                  {/* KAZANÇTAN VERGİYE ŞERİDİ (6 Kasım): büyük sayının hemen
                      altında, sonucun kendisi bir çizim. Eski Matrah + Dilim
                      sayı çifti (`.figures`) bu şeridin kulvarlarına indi;
                      gerekçe `TaxRibbon.tsx` başında. */}
                  <TaxRibbon values={ribbon} labels={labels.ribbon} money={lira} moneySigned={liraSigned} />

                  <div className={styles.flowBlock}>
                    <Waterfall
                      title={visuals.waterfall.title}
                      steps={flow.steps}
                      geometry={flow.geometry}
                      ariaLabel={flow.ariaLabel}
                      scaleNote={visuals.waterfall.scaleNote}
                    />
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
                      scale={{
                        title: visuals.band.title,
                        ariaLabel: visuals.band.ariaLabel,
                        next: labels.nextBracket,
                        top: labels.topBracket,
                        merged: visuals.band.merged,
                        hint: visuals.band.hint,
                      }}
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
                </div>
              ) : (
                <SaleEmpty
                  labels={labels}
                  needs={[
                    { done: simple ? buyDone : parsedTrades.some((t) => t.side === "buy") },
                    { done: simple ? sellDone : parsedTrades.some((t) => t.side === "sell") },
                    {
                      done: simple
                        ? [buyRow?.date, sellRow?.date].every((date) => !!date && dateUsable(date) && !!rates[rateDateOf(date)])
                        : neededDates.length > 0 && neededDates.every((date) => !!rates[date]),
                      busy: neededDates.some((date) => rates[date] === undefined && !rateLoad.failed.has(date)) && neededDates.length > 0,
                    },
                  ]}
                  onExample={fillExample}
                  preview={examplePreview}
                  previewLead={labels.preview.lead
                    .replace("{qty}", String(TAX_EXAMPLE.quantity))
                    .replace("{symbol}", labels.how.exampleSymbol)
                    .replace("{buy}", formatPrice(TAX_EXAMPLE.buyPrice, locale, { currency: true, digits: 0 }))
                    .replace("{sell}", formatPrice(TAX_EXAMPLE.sellPrice, locale, { currency: true, digits: 0 }))}
                  money={liraWhole}
                  moneySigned={liraWholeSigned}
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
                ratesFailed={ratesFailed}
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
          <div className={styles.form} onKeyDown={advanceOnEnter}>
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
                      <SymbolCell
                        label={labels.symbol}
                        error={symbolError(row.symbol)}
                        invalid={!!symbolError(row.symbol)}
                        value={row.symbol}
                        onChange={(symbol) => updateDividend(row.id, { symbol })}
                        placeholder={labels.form.symbolPlaceholder}
                        listLabel={labels.form.suggestions}
                        searchingLabel={labels.form.searching}
                        className={styles.input}
                      />
                      <Field unit="$" label={labels.grossUsd} hint={readAs(row.gross)} error={numberError(row.gross, "nonNegative")}>
                        <input
                          aria-invalid={!!numberError(row.gross, "nonNegative") || undefined}
                          inputMode="decimal"
                          enterKeyHint="next"
                          placeholder={moneyPlaceholder}
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

          <div ref={resultRef} className={styles.result}>
            <div className={styles.resultInner}>
              <h3 className="sr-only" tabIndex={-1} data-result-heading>{labels.resultLabel}</h3>
              <div aria-live="polite">
                {dividendVerdict === "wait" ? (
                  <EmptyLead text={labels.resultEmptyDividend} how={labels.how.readHow} />
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
                ratesFailed={ratesFailed}
                onRetry={retryRates}
                onCsv={downloadCsv}
                csvDisabled={csvDisabled}
              />
            </div>
          </div>
        </div>
      )}

      {barReady && (
        <div
          ref={barRef}
          role="region"
          aria-label={labels.mobileBar.label}
          className={styles.mobileBar}
          data-on={barOn || undefined}
          inert={!barOn}
        >
          {/* Bütün şerit tek düğme (390'da ölçüldü: ayrı "Sonuca Git"
              butonu 105 piksel tutup künyeyi iki satıra kırıyordu); ok kendi
              dairesinde, adı ekran okuyucuya `sr-only`. */}
          <button
            type="button"
            onClick={goToResult}
            className={styles.mbButton}
          >
            <span className={styles.mbCopy}>
              <span className={styles.mbLabel}>
                {tab === "sale" ? labels.estTax : labels.totalGrossTl}
                <span className={styles.mbVerdict} data-need={tab === "sale" ? saleVerdict : dividendVerdict}>
                  {(tab === "sale" ? saleVerdict : dividendVerdict) === "yes" ? labels.verdictYes : labels.verdictNo}
                </span>
              </span>
              {/* Aralık burada da (6 Kasım, inceleme): kart "X ile Y" derken
                  çubuk yalnız alt ucu basıyordu — uydurma kesinlik. Biçim
                  şeritle aynı (`TaxRibbon` → aralık tiresi). */}
              {tab === "sale" && taxHigh > taxLow ? (
                <b className="numeral" data-range>
                  {`${lira(taxLow)}\u202F–\u2009${lira(taxHigh)}`}
                </b>
              ) : (
                <b className="numeral">{tab === "sale" ? lira(taxLow) : lira(dividendGrossTl)}</b>
              )}
            </span>
            <span className="sr-only">{labels.mobileBar.show}</span>
            <span className={styles.mbArrow} aria-hidden>
              <ArrowDown size={16} weight="bold" />
            </span>
          </button>
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
          bassın dosya seçici açılıyor.
          GERÇEK BIRAKMA ALANI (6 Kasım, sahibinin sözü: "dosya bırakma alanı
          gibi görünmüyor"). Şerit bir bilgi satırı gibi okunuyordu: ikon,
          başlık, gri künye. Şimdi bırakma alanının üç işareti birden —
          kesikli kenar (gerekçesi `.drop` kuralında), "ya da dosyayı bu alana
          sürükle" ipucu ve sağda buton görünümlü "Dosya Seç" (ayrı bir
          düğme değil, görsel uç: tıklama alttaki düğmenin `::after`ine
          geçer, sekme durağı tek). Biçimler
          künye değil, aracı kurum başına çip. */}
      <button type="button" onClick={onPick} className={styles.dropButton}>
        <span className={styles.dropIcon} aria-hidden>
          <FileArrowUp size={24} weight="duotone" />
        </span>
        <span className={styles.dropCopy}>
          <span className={styles.dropTitle}>{over ? L.drop : L.open}</span>
          <span className={styles.dropHint}>{L.dragHint}</span>
          <span className={styles.dropHintNarrow}>{L.formats}</span>
        </span>
      </button>
      <div className={styles.dropMeta}>
        <p className={styles.dropFormats}>
          <span className="sr-only">{L.formats}</span>
          {L.formats.split(" · ").map((part) => (
            <span key={part} className={styles.dropChip} aria-hidden>
              {part}
            </span>
          ))}
        </p>
        <p className={styles.privacy}>
          <LockSimple size={14} weight="duotone" aria-hidden />
          {L.privacy}
        </p>
      </div>
      <span className={styles.dropCta} aria-hidden>
        {L.choose}
      </span>
    </div>
  );
}

/**
 * ENTER SONRAKİ ALANA (6 Kasım, sahibinin sözü: "klavye ile akıcı"). Form
 * bir <form> değil (gönderilecek bir şey yok, sonuç canlı); Enter hiçbir
 * şey yapmıyordu ve klavyeyle giren okuyucu her alanda Tab'a uzanıyordu.
 * Şimdi Enter alanı bırakır ve sıradaki GÖRÜNÜR alana geçer — kapalı
 * "Komisyon Ekle" katının içindekiler atlanır. Alanın kendi Enter'ı önce
 * çalışır (tarih seçici metni çözer, sembol önerisi seçilir), geçiş bir
 * kare sonra: öneri listesi kapanmış, tarih yazılmış olur.
 *
 * GEÇERSİZ ALANDA DURUR (6 Kasım, inceleme): tarih seçici metni çözemediyse
 * (ya da sayı alanı hatalıysa) alan `aria-invalid` taşır; eskiden Enter yine
 * sonraki alana geçiyor, hata mesajı arkada kalıyordu. Denetim bir kare
 * sonra — alanın kendi Enter'ı durumu yazmış olur (React ayrık olayı
 * eşzamanlı işler).
 */
function advanceOnEnter(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type === "hidden" || target.type === "checkbox") return;
  const root = event.currentTarget;
  event.preventDefault();
  requestAnimationFrame(() => {
    if (target.getAttribute("aria-invalid") === "true") return;
    const inputs = [
      ...root.querySelectorAll<HTMLInputElement>("input:not([type=hidden]):not([type=checkbox]):not([disabled])"),
    ].filter((el) => el.getClientRects().length > 0);
    inputs[inputs.indexOf(target) + 1]?.focus();
  });
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
/**
 * Boş sonucun tek satırı. Altındaki "Nasıl Hesaplanır" bağlantısı (25 Ekim):
 * anlatım hesaplayıcının ALTINA indi ve katlı geliyor (`TaxHow.tsx`); önce
 * kuralı okumak isteyen okuyucunun yolu burası. Düz çapa, katlamayı
 * `TaxHowReveal` açıyor.
 */
/* TEK SATIR (6 Kasım): bağlantı cümlenin ardında, ikonun yanındaki aynı
   blokta. Ayrı satırken boş sonuç 32 piksel daha uzundu; sonuç kolonu
   boşken formdan uzun olmasın diye (ölçüm `SaleEmpty` yorumunda). */
function EmptyLead({ text, how }: { text: string; how: string }) {
  return (
    <div className={styles.emptyLead}>
      <span className={styles.emptyIcon} aria-hidden>
        <Calculator size={20} weight="duotone" />
      </span>
      <p className={styles.emptyText}>
        {text}{" "}
        <a href="#nasil" className={cn(styles.inlineLink, styles.emptyHow)}>
          {how}
          <ArrowDown size={13} weight="bold" aria-hidden />
        </a>
      </p>
    </div>
  );
}

/**
 * BOŞ SATIŞ SONUCU (18 Ekim). Eski hâl üç gri bloktu (Net Kazanç, Matrah,
 * Tahmini Vergi): okuyucu neyin eksik olduğunu ve sonucun neye benzeyeceğini
 * göremiyordu. 18 Ekim'de gerekenler listesi + şelalenin soluk, sayısız
 * taslağı + "Örnekle Dene" oldu.
 *
 * AKIŞ ŞEMASI (31 Ekim, sahibinin sözü: "boş sonuç panelini anlamlı ve
 * görsel bir önizlemeye çevir"). Gri liste ve soluk şelale yan yana iki
 * ayrı dil konuşuyordu; şelale taslağı 1440'ta ~330 piksel yer tutup sayı
 * göstermediği için "bozuk grafik" gibi okunuyordu. Şimdi tek çizim:
 * hesabın kendi yolu, beş düğümlü dikey ray —
 *   Alış → Satış → TCMB Kuru  (girdi: okuyucu doldurdukça işaretlenir)
 *   → Matrah → Tahmini Vergi  (sonuç: kesik halka, girdiler bitince açılır)
 * Rayın dolgusu tamamlanan girdiye kadar uzar (`--ease-brand`); sıradaki
 * girdi mavi halkayla "buradasın" der, kur beklenirken düğüm nabız atar
 * (eski `chip-wait`). Sayı yok: düğümler yalnızca adım ve künye taşır.
 * Sağ üstte "1/3 Girdi Hazır" ölçeği aynı durumu üç dilimle söyler.
 * "Örnekle Dene" en altta kaldı.
 *
 * YATAY RAY + SONUÇ ÖNİZLEMESİ (6 Kasım, sahibinin sözü: "boş halde çok
 * yer kaplıyor, sonuç alanı ilk bakışta değer vermiyor"). Dikey ray
 * 1440'ta 300 piksel tutuyor ve beş satırın üçü "Bekliyor" diyordu: kolon
 * okuyucuya hiçbir sayı göstermeden ekranın yarısını alıyordu. Ray aynı
 * düğümler ve durumlarla YATAY şeride indi (künyeler kalktı; ad + durum
 * kaldı), altına dolu kartın kendi çizimi (`TaxRibbon`) varsayımsal örnekle
 * geldi: "Nasıl Hesaplanır"ın örneği (`TAX_EXAMPLE`, aynı kodla hesaplı,
 * "Varsayımsal Kur ve Endeks" rozetli). Okuyucu boşken sonucun neye
 * benzeyeceğini SAYIYLA görüyor; "Örnekle Dene" o örneği gerçek kurla
 * forma dolduruyor. Ölçüm `.flowRail[data-axis]` kuralında.
 */
function SaleEmpty({
  labels,
  needs,
  onExample,
  preview,
  previewLead,
  money,
  moneySigned,
}: {
  labels: TaxLabels;
  /** Alış, satış, kur — sırası sabit. */
  needs: { done: boolean; busy?: boolean }[];
  onExample: () => void;
  /** Varsayımsal örneğin şerit sayıları (`TAX_EXAMPLE`). */
  preview: RibbonValues;
  previewLead: string;
  money: (value: number) => string;
  moneySigned: (value: number) => string;
}) {
  const F = labels.needFlow;
  const done = needs.filter((need) => need.done).length;
  const ready = done === needs.length;
  const active = needs.findIndex((need) => !need.done);
  const nodes = [
    { icon: ShoppingCartSimple, title: F.buy, hint: F.buyHint },
    { icon: HandCoins, title: F.sell, hint: F.sellHint },
    { icon: Bank, title: F.rate, hint: F.rateHint },
    { icon: Scales, title: F.base, hint: F.baseHint },
    { icon: Receipt, title: F.tax, hint: F.taxHint },
  ] as const;
  return (
    <div className={styles.emptySale}>
      <section aria-labelledby="vergi-gerekenler" className={styles.flowMap}>
        <div className={styles.flowMapHead}>
          <h4 id="vergi-gerekenler" className={styles.basisTitle}>
            {labels.needTitle}
          </h4>
          <span className={styles.flowMeter} role="img" aria-label={F.progressLabel.replace("{done}", String(done))}>
            <span className={styles.flowMeterBars} aria-hidden>
              {needs.map((need, i) => (
                <i key={i} data-on={need.done || undefined} />
              ))}
            </span>
            <span className="numeral" aria-hidden>
              {F.progress.replace("{done}", String(done))}
            </span>
          </span>
        </div>
        <ol className={styles.flowRail} data-axis="x">
          {nodes.map((node, i) => {
            const input = i < needs.length;
            const need = input ? needs[i] : null;
            const state = need
              ? need.done
                ? "done"
                : need.busy
                  ? "busy"
                  : i === active
                    ? "active"
                    : "todo"
              : ready
                ? "active"
                : "outcome";
            /* Dolgu: bu düğümden sonrakine giden ray parçası. Girdide düğüm
               tamamsa, sonuç düğümlerinde üç girdi tamamsa dolu. */
            const filled = input ? !!need?.done : ready;
            const Icon = node.icon;
            return (
              <li
                key={node.title}
                className={styles.flowNode}
                data-state={state}
                data-kind={input ? "input" : "outcome"}
                data-filled={filled || undefined}
                style={{ "--i": i } as React.CSSProperties}
              >
                {i === needs.length && (
                  <span className={styles.flowDivider} aria-hidden>
                    {F.result}
                  </span>
                )}
                <span className={styles.flowDot} aria-hidden>
                  {state === "done" ? <Check size={15} weight="bold" /> : <Icon size={17} weight="duotone" />}
                </span>
                <span className={styles.flowCopy}>
                  <span className={styles.fmTitle}>{node.title}</span>
                  <span className={styles.flowHint}>{node.hint}</span>
                </span>
                {input && (
                  <span className={styles.flowState}>
                    {state === "done" ? labels.needDone : state === "busy" ? F.busy : F.waiting}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <section aria-labelledby="vergi-onizleme" className={styles.samplePreview}>
        <div className={styles.spHead}>
          <h4 id="vergi-onizleme" className={styles.basisTitle}>
            {labels.preview.title}
          </h4>
          <span className={styles.exampleTag}>{labels.how.exampleTag}</span>
        </div>
        <p className={styles.spLead}>{previewLead}</p>
        <TaxRibbon values={preview} labels={labels.ribbon} money={money} moneySigned={moneySigned} sketch />
        <div className={styles.exampleFoot}>
          <button type="button" onClick={onExample} className={buttonClass({ variant: "ghost", size: "sm" })}>
            <Sparkle size={14} weight="duotone" aria-hidden />
            {labels.how.exampleTry}
          </button>
          <span className={styles.help}>{labels.how.exampleTryHint}</span>
        </div>
      </section>
    </div>
  );
}

/** Segmentin kayan parçası: marka eğrisi, portföy penceresiyle aynı süre. */
const THUMB_TRANSITION = { duration: 0.3, ease: EASE_BRAND_POINTS } as const;

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
  unit,
  suffix,
  ids,
  children,
}: {
  label: string;
  error?: string;
  /** Belirsiz sayı girişinin nasıl okunduğu (lib/decimal-input.ts). */
  hint?: string | null;
  /** Alanın içinde, solda duran birim ("$"). Etiket birimi zaten söylüyor;
   *  bu, yazarken gözün alanın içinde de görmesi için (18 Ekim). */
  unit?: string;
  /** Alanın içinde, SAĞDA duran birim ("Adet"; 6 Kasım). Sayının ne
   *  saydığı alanın kendisinde okunuyor; etiket ikinci satıra kırılsa da. */
  suffix?: string;
  /** Etiket ve hata metninin kimliği: alan adını `aria-labelledby` ile
   *  etiketten alan denetimler için (`SymbolCell`). */
  ids?: { label: string; error: string };
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span id={ids?.label} className={styles.label}>{label}</span>
      {unit || suffix ? (
        <span className={styles.affix} data-unit={unit ? "" : undefined} data-suffix={suffix ? "" : undefined}>
          {unit && (
            <span className={styles.affixUnit} aria-hidden>
              {unit}
            </span>
          )}
          {children}
          {suffix && (
            <span className={styles.affixSuffix} aria-hidden>
              {suffix}
            </span>
          )}
        </span>
      ) : (
        children
      )}
      {error ? (
        <span id={ids?.error} className={styles.fieldError}>
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
 * SEMBOL ALANI + ETİKETİ (6 Kasım, inceleme). `SymbolField`in öneri listesi
 * ve "Aranıyor" durumu `<label>`in içinde duruyor; etiketten türeyen
 * erişilebilir ad bu yüzden öneri adlarını da topluyordu ("Sembol AAPL
 * Apple Inc. MSFT …"). Alan adını artık yalnız etiket metninden alıyor
 * (`aria-labelledby`), hata metni de `aria-describedby` ile bağlı.
 */
function SymbolCell({
  label,
  error,
  ...field
}: { label: string; error?: string } & Omit<React.ComponentProps<typeof SymbolField>, "labelledBy" | "describedBy">) {
  const id = useId();
  const ids = { label: `${id}-label`, error: `${id}-error` };
  return (
    <Field label={label} error={error} ids={ids}>
      <SymbolField {...field} labelledBy={ids.label} describedBy={error ? ids.error : undefined} />
    </Field>
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
      {/* KAYDIRMASIZ (10 Kasım 2026, sahibinin sözü: "tablolar sağa sola
          kaymasın"). 560 piksellik taban 390'da 300 küsur piksellik kapta
          kayıyordu ve kazanç sütunu — tablonun cevabı — ekran dışındaydı.
          < 640 adet düşer; < 768 maliyet ve satış hasılatı kendi
          sütunlarını bırakıp kazancın ALTINA küçük satır olarak iner
          ("hasılat − maliyet"). ≥ 768 eski altı sütun. */}
      <table className="w-full text-small">
        <thead>
          <tr className="border-b border-line-soft text-left text-nano text-muted">
            <th scope="col" className="py-2 pr-3 font-semibold">{labels.symbol}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{labels.sellDate}</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-semibold sm:table-cell">{labels.quantity}</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-semibold md:table-cell">{labels.taxCostTl}</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-semibold md:table-cell">{labels.proceedsTl}</th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">{labels.gainTl}</th>
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
              <td className="numeral hidden px-2 py-2 text-right sm:table-cell">{quantityText(r.quantity)}</td>
              <td className="numeral hidden px-2 py-2 text-right md:table-cell">{formatLira(r.taxCostTl, locale)}</td>
              <td className="numeral hidden px-2 py-2 text-right md:table-cell">{formatLira(r.proceedsTl, locale)}</td>
              <td className={cn("numeral py-2 pl-2 text-right font-semibold", directionText(directionOf(r.gainTl)))}>
                {formatLira(r.gainTl, locale, 2, true)}
                <span className="block text-nano font-normal text-muted md:hidden">
                  <span className="sm:hidden">{quantityText(r.quantity)} · </span>
                  {formatLira(r.proceedsTl, locale)} − {formatLira(r.taxCostTl, locale)}
                </span>
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
  visuals,
  locale,
  results,
  rawCostTl,
  taxCostTl,
  proceedsTl,
  gainTl,
  baseTl,
  ready,
  indexPending,
  usd,
}: {
  labels: TaxLabels;
  visuals: TaxVisualLabels;
  locale: Locale;
  results: LotResult[];
  rawCostTl: number;
  taxCostTl: number;
  proceedsTl: number;
  gainTl: number;
  baseTl: number;
  ready: boolean;
  indexPending: boolean;
  usd: (value: number) => string;
}): { steps: WaterfallStep[]; geometry: WaterfallGeometry; ariaLabel: string } {
  const geometry = waterfallOf({
    costTl: ready ? rawCostTl : 0,
    indexedCostTl: ready ? taxCostTl : 0,
    proceedsTl: ready ? proceedsTl : 0,
    gainTl: ready ? gainTl : 0,
    baseTl: ready ? baseTl : 0,
  });
  const gainUp = gainTl >= 0;
  const gainName = gainUp ? labels.flowGain : labels.flowLoss;
  if (!ready) {
    const dash = formatLira(null, locale);
    return {
      geometry,
      ariaLabel: "",
      steps: [labels.flowCostTl, visuals.waterfall.indexStep, labels.flowProceeds, labels.flowGain, labels.taxBase].map(
        (name) => ({ name, value: dash }),
      ),
    };
  }
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

  /* Endeksleme sütununun değeri EKLENEN pay (+12.345 ₺); endeksli maliyetin
     tamamı notta. Eski şeridin değeri endeksli maliyetin kendisiydi ve
     yanındaki TL maliyetle neredeyse aynı sayı iki kez okunuyordu. */
  const indexAdd = Math.max(0, taxCostTl - rawCostTl);
  const lira = (value: number) => formatLira(value, locale);
  const steps: WaterfallStep[] = [
    { name: labels.flowCostTl, value: lira(rawCostTl), note: rateNote(costUsd, single?.buyRate ?? null) },
    {
      name: visuals.waterfall.indexStep,
      value: indexAdd > 0 ? formatLira(indexAdd, locale, 2, true) : lira(0),
      note: indexAdd > 0 ? `${indexNote} · ${labels.flowIndexed} ${lira(taxCostTl)}` : indexNote,
    },
    { name: labels.flowProceeds, value: lira(proceedsTl), note: rateNote(proceedsUsd, single?.sellRate ?? null) },
    { name: gainName, value: formatLira(gainTl, locale, 2, true) },
    /* Matrahın açıklaması hemen alttaki "Matrah" ölçüsünde; burada tekrar
       edilmiyor. */
    { name: labels.taxBase, value: lira(baseTl) },
  ];
  const ariaLabel = visuals.waterfall.ariaLabel
    .replace("{cost}", lira(rawCostTl))
    .replace("{indexed}", lira(taxCostTl))
    .replace("{proceeds}", lira(proceedsTl))
    .replace("{gainName}", gainName.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US"))
    .replace("{gain}", formatLira(gainTl, locale, 2, true))
    .replace("{base}", lira(baseTl));
  return { steps, geometry, ariaLabel };
}
