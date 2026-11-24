import { cache } from "react";
import { canonicalSymbol } from "@/lib/symbols";
import { fail, ok, responseDate, type ProviderResult } from "./types";
import { withBody } from "./timeout";
import { retryOnRateLimit } from "./rate-limit";
import { noteProviderResponse } from "./usage";

/**
 * Alpaca kurumsal işlemler — nakit temettüler.
 *
 * NEDEN ALPACA: Finnhub'ın `/stock/dividend` ucu ücretsiz katmanda 403
 * dönüyor (28 Eylül, denendi). Alpaca'nın `/v1/corporate-actions` ucu aynı
 * anahtarla açık ve her kayıtta hak kesim (ex), kayıt (record) ve ödeme
 * (payable) tarihini, hisse başı tutarı ve özel/yabancı bayraklarını
 * veriyor.
 *
 * TARİH SÜZGECİ HAK KESİM GÜNÜNE BAKMIYOR. `start`/`end` ile istenen
 * pencereye hak kesimi pencereden önce, ödemesi pencerenin içinde olan
 * kayıtlar da giriyor (ölçüldü: 28 Eylül–15 Kasım penceresinde ADP'nin
 * 11 Eylül hak kesimli kaydı geldi). Çağıran hak kesim gününe göre
 * kendisi süzüyor; bu dosya yalnızca kayıtları getiriyor.
 *
 * Hata DEĞER olarak döner. Paketlerden biri düşerse sonucun tamamı hata:
 * yarım bir takvim, düşen paketteki şirketler için "temettü yok" demiş
 * olurdu ve bilinmeyen "yok" diye yazılmaz (CLAUDE.md "Veri dürüstlüğü").
 */

const BASE = "https://data.alpaca.markets/v1/corporate-actions";

/** Paket başına sembol — 100 sembolle adres ~600 karakter. */
const SYMBOLS_PER_REQUEST = 100;
/** Sayfa başına kayıt — ucun izin verdiği tavan. */
const PAGE_LIMIT = 1000;
/** Devam sayfası emniyet tavanı. */
const MAX_PAGES = 10;
/** Temettü ilanları günde birkaç kez değişir; altı saat yeterli. */
const DIVIDEND_REVALIDATE_SECONDS = 21_600;

export type CashDividend = {
  symbol: string;
  /** Hak kesim günü, ET "YYYY-MM-DD". */
  exDate: string;
  recordDate: string | null;
  payableDate: string | null;
  /** Hisse başı tutar, dolar. */
  rate: number;
  /** Olağan dışı, tek seferlik ödeme. Yıllık getiri hesabına girmez. */
  special: boolean;
  /** Yabancı ihraççı (ADR): tutar kurla değişebilir. */
  foreign: boolean;
};

type RawDividend = {
  id?: string;
  symbol?: string;
  ex_date?: string;
  record_date?: string | null;
  payable_date?: string | null;
  rate?: number;
  special?: boolean;
  foreign?: boolean;
};

type RawPage = {
  corporate_actions?: { cash_dividends?: RawDividend[] };
  next_page_token?: string | null;
};

function credentials(): { key: string; secret: string } | null {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return null;
  return { key, secret };
}

async function fetchPage(
  params: Record<string, string>,
  creds: { key: string; secret: string },
): Promise<ProviderResult<RawPage>> {
  const url = `${BASE}?${new URLSearchParams(params).toString()}`;
  try {
    /* Süre sınırı gövdeyi de kapsıyor (`withBody`, lib/providers/timeout.ts).
       Kota `alpacaFetch` ile ORTAK (dakikada 200): yanıt sağlık izine
       bildiriliyor, 429'da kısa bekleyip yeniden deneniyor (rate-limit.ts). */
    const { res, body } = await retryOnRateLimit(() => withBody(
      fetch(url, {
        headers: {
          "APCA-API-KEY-ID": creds.key,
          "APCA-API-SECRET-KEY": creds.secret,
          accept: "application/json",
        },
        next: { revalidate: DIVIDEND_REVALIDATE_SECONDS, tags: ["dividends"] },
      }),
      (r) => {
        noteProviderResponse("alpaca", r);
        return r.ok ? r.json() : null;
      },
    ));
    if (res.status === 429) return fail("alpaca", "rate-limited", "Alpaca istek limiti aşıldı");
    if (!res.ok) return fail("alpaca", "upstream-error", `Alpaca kurumsal işlemler ${res.status}`);
    return ok(body as RawPage, "alpaca", { fetchedAt: responseDate(res) });
  } catch (error) {
    return fail("alpaca", "network", error instanceof Error ? error.message : "Alpaca'ya ulaşılamadı");
  }
}

function parse(raw: RawDividend): CashDividend | null {
  if (!raw.symbol || !raw.ex_date || typeof raw.rate !== "number" || !Number.isFinite(raw.rate)) {
    return null;
  }
  return {
    symbol: raw.symbol,
    exDate: raw.ex_date,
    recordDate: raw.record_date ?? null,
    payableDate: raw.payable_date ?? null,
    rate: raw.rate,
    special: raw.special === true,
    foreign: raw.foreign === true,
  };
}

async function fetchChunk(
  symbols: string[],
  start: string,
  end: string,
  creds: { key: string; secret: string },
): Promise<ProviderResult<CashDividend[]>> {
  const base = {
    symbols: symbols.join(","),
    types: "cash_dividend",
    start,
    end,
    limit: String(PAGE_LIMIT),
  };
  const out: CashDividend[] = [];
  let token: string | null = null;
  let fetchedAt: Date | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(token ? { ...base, page_token: token } : base, creds);
    if (!result.ok) return result;
    fetchedAt ??= result.fetchedAt;
    for (const raw of result.data.corporate_actions?.cash_dividends ?? []) {
      const parsed = parse(raw);
      if (parsed) out.push(parsed);
    }
    token = result.data.next_page_token ?? null;
    if (!token) return ok(out, "alpaca", { fetchedAt });
  }
  /* Tavana varıldı ve belirteç hâlâ duruyor: liste eksik. Eksik bir
     takvimi tam gibi göstermektense hata dönmek doğru. */
  return fail("alpaca", "upstream-error", "Temettü listesi sayfa tavanını aştı");
}

/* İstek içinde tekil: anahtar sıralı sembol dizesi + pencere (getQuotes ile
   aynı gerekçe — dizi kimliği her çağrıda farklı). */
const dividendsForKey = cache(async function dividendsForKey(
  key: string,
  start: string,
  end: string,
): Promise<ProviderResult<CashDividend[]>> {
  const creds = credentials();
  if (!creds) {
    return fail("alpaca", "missing-key", "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY tanımlı değil");
  }
  const symbols = key ? key.split(",") : [];
  if (symbols.length === 0) return ok([], "alpaca");
  const chunks: string[][] = [];
  for (let index = 0; index < symbols.length; index += SYMBOLS_PER_REQUEST) {
    chunks.push(symbols.slice(index, index + SYMBOLS_PER_REQUEST));
  }
  const results = await Promise.all(chunks.map((chunk) => fetchChunk(chunk, start, end, creds)));
  const seen = new Set<string>();
  const out: CashDividend[] = [];
  let oldest: Date | undefined;
  for (const result of results) {
    if (!result.ok) return result;
    if (!oldest || result.fetchedAt < oldest) oldest = result.fetchedAt;
    for (const item of result.data) {
      const id = `${item.symbol}:${item.exDate}:${item.rate}:${item.special}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  out.sort((a, b) => a.exDate.localeCompare(b.exDate) || a.symbol.localeCompare(b.symbol));
  return ok(out, "alpaca", { fetchedAt: oldest });
});

/**
 * Verilen sembollerin `start`–`end` penceresine değen nakit temettüleri.
 * Sonuç hak kesim gününe, sonra sembole göre sıralı.
 */
export async function getCashDividends(
  symbols: readonly string[],
  start: string,
  end: string,
): Promise<ProviderResult<CashDividend[]>> {
  const unique = [...new Set(symbols.map(canonicalSymbol))].sort();
  return dividendsForKey(unique.join(","), start, end);
}

/* ------------------------------------------------------------------------
   HİSSE BÖLÜNMELERİ (24 Kasım) — portföy partilerinin düzeltmesi için
   (lib/portfolio-splits.ts, lib/portfolio-split-apply.ts). Aynı uç,
   `forward_split` (8'e 1 bölünme: old_rate 1, new_rate 8) ve
   `reverse_split` (50'de 1 birleşme: old_rate 50, new_rate 1). Önbelleksiz:
   yalnız günde birkaç kez koşan düzeltme işi soruyor ve yazdığı adet kalıcı
   (yazma katmanı bayat veri kullanmaz). Hata yine DEĞER: bir paket düşerse
   sonucun tamamı hata, eksik listeyle "bölünme yok" denmez.
   ------------------------------------------------------------------------ */

export type StockSplitRecord = { symbol: string; exDate: string; oldRate: number; newRate: number };

type RawSplit = { symbol?: string; ex_date?: string; old_rate?: number; new_rate?: number };
type RawSplitPage = {
  corporate_actions?: { forward_splits?: RawSplit[]; reverse_splits?: RawSplit[] };
  next_page_token?: string | null;
};

async function fetchSplitPage(params: Record<string, string>, creds: { key: string; secret: string }): Promise<ProviderResult<RawSplitPage>> {
  const url = `${BASE}?${new URLSearchParams(params).toString()}`;
  try {
    const { res, body } = await retryOnRateLimit(() => withBody(
      fetch(url, {
        headers: { "APCA-API-KEY-ID": creds.key, "APCA-API-SECRET-KEY": creds.secret, accept: "application/json" },
        cache: "no-store",
      }),
      (r) => {
        noteProviderResponse("alpaca", r);
        return r.ok ? r.json() : null;
      },
    ));
    if (res.status === 429) return fail("alpaca", "rate-limited", "Alpaca istek limiti aşıldı");
    if (!res.ok) return fail("alpaca", "upstream-error", `Alpaca kurumsal işlemler ${res.status}`);
    return ok(body as RawSplitPage, "alpaca", { fetchedAt: responseDate(res) });
  } catch (error) {
    return fail("alpaca", "network", error instanceof Error ? error.message : "Alpaca'ya ulaşılamadı");
  }
}

function parseSplit(raw: RawSplit): StockSplitRecord | null {
  const { symbol, ex_date: exDate, old_rate: oldRate, new_rate: newRate } = raw;
  if (!symbol || !exDate || typeof oldRate !== "number" || typeof newRate !== "number") return null;
  if (!(oldRate > 0) || !(newRate > 0) || !Number.isFinite(oldRate) || !Number.isFinite(newRate)) return null;
  return { symbol: canonicalSymbol(symbol), exDate, oldRate, newRate };
}

/** Verilen sembollerin `start`–`end` penceresindeki bölünme ve birleşmeleri. */
export async function getStockSplits(symbols: readonly string[], start: string, end: string): Promise<ProviderResult<StockSplitRecord[]>> {
  const creds = credentials();
  if (!creds) return fail("alpaca", "missing-key", "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY tanımlı değil");
  const unique = [...new Set(symbols.map(canonicalSymbol))].sort();
  const out: StockSplitRecord[] = [];
  for (let index = 0; index < unique.length; index += SYMBOLS_PER_REQUEST) {
    const base = { symbols: unique.slice(index, index + SYMBOLS_PER_REQUEST).join(","), types: "forward_split,reverse_split", start, end, limit: String(PAGE_LIMIT) };
    let token: string | null = null;
    let page = 0;
    for (; page < MAX_PAGES; page++) {
      const result = await fetchSplitPage(token ? { ...base, page_token: token } : base, creds);
      if (!result.ok) return result;
      const actions = result.data.corporate_actions;
      for (const raw of [...(actions?.forward_splits ?? []), ...(actions?.reverse_splits ?? [])]) {
        const parsed = parseSplit(raw);
        if (parsed) out.push(parsed);
      }
      token = result.data.next_page_token ?? null;
      if (!token) break;
    }
    if (page === MAX_PAGES) return fail("alpaca", "upstream-error", "Bölünme listesi sayfa tavanını aştı");
  }
  return ok(out, "alpaca");
}
