import "server-only";

import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { getHolidays, getStatus, getSymbolNames } from "@/lib/data";
import {
  annualYieldPct,
  inferFrequency,
  lastBuyDay,
  regularHistory,
} from "@/lib/dividends";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { getCashDividends, type CashDividend } from "@/lib/providers/alpaca-corporate";
import { canonicalSymbol } from "@/lib/symbols";

/**
 * Temettü takvimi ve hisse panelinin veri tarafı.
 *
 * Kapsam ENDEKS ÜYELERİ (db/seed/indices, üç endeksin birleşimi, çok
 * sınıflı şirketler tek satır): takvim /piyasalar'ın izlediği evreni
 * izliyor. Bin şirketlik dizinin tamamı sorulsaydı Alpaca'ya on paket
 * gidecekti; üye listesi altı paket.
 */

/** Takvimin ileriye baktığı gün sayısı — dört hafta. */
export const DIVIDEND_WINDOW_DAYS = 28;
/**
 * Pencere sonuna eklenen pay: ucun tarih süzgeci hak kesim gününe değil
 * ödeme/işlem gününe bakıyor gibi davranıyor (bkz. alpaca-corporate.ts);
 * hak kesimi pencerede, ödemesi aylar sonra olan kayıt kaçmasın.
 */
const PAYABLE_SLACK_DAYS = 75;
/** Sıklık çıkarımı için geçmiş: iki yıl + pay (yıllık ödeyende iki ödeme). */
const FREQUENCY_HISTORY_DAYS = 760;
/**
 * Hisse panelinin gösterdiği geçmiş: içinde bulunulan yıl + ÖNCEKİ ÜÇ TAM
 * YIL. Pencere bir dönem "bugünden 3 × 366 gün geri" idi ve en eski yılı
 * ortasından kesiyordu: panelde "2023 · 1 Ödeme · 0,24 $" çıktı (AAPL,
 * ölçüldü), yani dört ödemeli bir yıl temettü kesilmiş gibi okunuyordu.
 */
const PANEL_FULL_YEARS = 3;

export type DividendCalendarRow = {
  dividend: CashDividend;
  name: string;
  logoUrl: string | null;
  yieldPct: number | null;
  frequency: number | null;
};

export type DividendCalendarDay = {
  exDate: string;
  /** Almak için son işlem günü; tatil takvimi okunamadıysa null. */
  lastBuy: string | null;
  rows: DividendCalendarRow[];
};

export type DividendCalendarResult =
  | { ok: true; days: DividendCalendarDay[]; fetchedAt: Date; count: number; priced: boolean }
  | { ok: false };

function groupBySymbol(items: readonly CashDividend[]) {
  const map = new Map<string, CashDividend[]>();
  for (const item of items) {
    const list = map.get(item.symbol) ?? [];
    list.push(item);
    map.set(item.symbol, list);
  }
  return map;
}

export async function getDividendCalendar(): Promise<DividendCalendarResult> {
  const today = todayEt();
  const until = addEtDays(today, DIVIDEND_WINDOW_DAYS);
  const members = primaryOnly(ALL_MEMBERS);
  const names = new Map(members.map((member) => [member.symbol, member.name]));

  const upcomingResult = await getCashDividends(
    members.map((member) => member.symbol),
    today,
    addEtDays(until, PAYABLE_SLACK_DAYS),
  );
  if (!upcomingResult.ok) return { ok: false };
  const upcoming = upcomingResult.data.filter((item) => item.exDate >= today && item.exDate <= until);
  const symbols = [...new Set(upcoming.map((item) => item.symbol))];

  const status = await getStatus();
  const [historyResult, quotes, meta, holidays] = await Promise.all([
    getCashDividends(symbols, addEtDays(today, -FREQUENCY_HISTORY_DAYS), today),
    getQuotes(symbols, status),
    getSymbolNames(symbols),
    getHolidays(),
  ]);
  /* Geçmiş okunamazsa takvim yine basılıyor, yalnızca getiri sütunu boş:
     sıklığı kanıtlayamadığımız yerde getiri yazmama kuralının kendisi. */
  const history = historyResult.ok ? groupBySymbol(historyResult.data) : new Map<string, CashDividend[]>();
  const upcomingBySymbol = groupBySymbol(upcoming);
  const knownHolidays = holidays.length > 0 ? holidays : null;

  const days = new Map<string, DividendCalendarRow[]>();
  for (const dividend of upcoming) {
    const frequency = historyResult.ok
      ? inferFrequency(regularHistory([
          ...(history.get(dividend.symbol) ?? []).filter((item) => item.exDate < today),
          ...(upcomingBySymbol.get(dividend.symbol) ?? []),
        ]))
      : null;
    const price = quotes.ok ? quotes.data[dividend.symbol]?.price : null;
    const list = days.get(dividend.exDate) ?? [];
    list.push({
      dividend,
      name: names.get(dividend.symbol) ?? meta[dividend.symbol]?.name ?? dividend.symbol,
      logoUrl: meta[dividend.symbol]?.logoUrl ?? null,
      yieldPct: annualYieldPct(dividend, frequency, price),
      frequency,
    });
    days.set(dividend.exDate, list);
  }

  return {
    ok: true,
    count: upcoming.length,
    priced: quotes.ok,
    fetchedAt: upcomingResult.fetchedAt,
    days: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([exDate, rows]) => ({
        exDate,
        lastBuy: lastBuyDay(exDate, knownHolidays),
        rows: rows.sort((a, b) => a.dividend.symbol.localeCompare(b.dividend.symbol)),
      })),
  };
}

export type SymbolDividends =
  | {
      ok: true;
      past: CashDividend[];
      next: CashDividend | null;
      nextLastBuy: string | null;
      frequency: number | null;
      yieldPct: number | null;
      fetchedAt: Date;
    }
  | { ok: false };

export async function getSymbolDividends(symbol: string): Promise<SymbolDividends> {
  const today = todayEt();
  const status = await getStatus();
  const windowStart = `${Number(today.slice(0, 4)) - PANEL_FULL_YEARS}-01-01`;
  const [result, quotes, holidays] = await Promise.all([
    getCashDividends([symbol], windowStart, addEtDays(today, PAYABLE_SLACK_DAYS + DIVIDEND_WINDOW_DAYS)),
    getQuotes([symbol], status),
    getHolidays(),
  ]);
  if (!result.ok) return { ok: false };
  /* Fiyat `symbol` ile soruluyor (hisse sayfasının başlığıyla aynı anahtar,
     tek tur); temettü kaydı ise kanonik sembolle geliyor (BRK.B). */
  const wanted = canonicalSymbol(symbol);
  /* Hak kesimi pencereden önce olan kayıt da geliyor (ucun süzgeci ödeme
     gününe bakıyor): O'nun 30 Aralık 2022 hak kesimli ödemesi "2022 ·
     1 Ödeme" diye yarım bir yıl açıyordu. */
  const all = result.data.filter((item) => item.symbol === wanted && item.exDate >= windowStart);
  const past = all.filter((item) => item.exDate < today);
  const next = all.find((item) => item.exDate >= today) ?? null;
  const regular = regularHistory(all);
  const frequency = inferFrequency(regular);
  const latestRegular = regular.at(-1) ?? null;
  const price = quotes.ok ? (quotes.data[symbol] ?? quotes.data[wanted])?.price : null;
  return {
    ok: true,
    past,
    next,
    nextLastBuy: next ? lastBuyDay(next.exDate, holidays.length > 0 ? holidays : null) : null,
    frequency,
    yieldPct: latestRegular ? annualYieldPct(latestRegular, frequency, price) : null,
    fetchedAt: result.fetchedAt,
  };
}
