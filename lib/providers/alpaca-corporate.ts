import { cache } from "react";
import { canonicalSymbol } from "@/lib/symbols";
import { fail, ok, responseDate, type ProviderResult } from "./types";
import { withTimeout } from "./timeout";

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
    const res = await withTimeout(
      fetch(url, {
        headers: {
          "APCA-API-KEY-ID": creds.key,
          "APCA-API-SECRET-KEY": creds.secret,
          accept: "application/json",
        },
        next: { revalidate: DIVIDEND_REVALIDATE_SECONDS, tags: ["dividends"] },
      }),
    );
    if (res.status === 429) return fail("alpaca", "rate-limited", "Alpaca istek limiti aşıldı");
    if (!res.ok) return fail("alpaca", "upstream-error", `Alpaca kurumsal işlemler ${res.status}`);
    return ok((await res.json()) as RawPage, "alpaca", { fetchedAt: responseDate(res) });
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
