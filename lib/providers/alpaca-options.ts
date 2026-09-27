import { canonicalSymbol } from "../symbols";
import { etParts } from "../market-hours";
import { fail, ok, responseDate, type ProviderResult } from "./types";
import { withTimeout } from "./timeout";
import { parseOcc, type DailyClose, type OptionQuote } from "@/lib/expected-move";

/**
 * Alpaca — opsiyon kotasyonları ve bilanço hareketi için uzun günlük seri.
 *
 * Ayrı dosya çünkü iki uç da `alpaca.ts`in sözleşmesinin dışında: opsiyon
 * ucu başka bir kökte (`/v1beta1/options`) ve günlük seri, grafik
 * aralıklarının (`RANGE_SPECS`) hiçbirine uymuyor — bilanço hareketi iki
 * yıllık GÜNLÜK kapanış istiyor; "1Y" bir yıl, "5Y" haftalık.
 *
 * GÖSTERGE BESLEME. Ücretsiz katman opsiyonları `feed=indicative` ile
 * veriyor: OPRA'nın kendisi değil, ondan türetilmiş kotasyonlar. Ekranda
 * "Gösterge Fiyat" diye yazılıyor ve aralığı geniş kontrat hiç
 * kullanılmıyor (`MAX_LEG_SPREAD`).
 */

const DATA = "https://data.alpaca.markets";

function credentials(): { key: string; secret: string } | null {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  return key && secret ? { key, secret } : null;
}

async function get<T>(path: string, params: Record<string, string>, revalidate: number, tag: string): Promise<ProviderResult<T>> {
  const creds = credentials();
  if (!creds) return fail("alpaca", "missing-key", "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY tanımlı değil");
  try {
    const res = await withTimeout(
      fetch(`${DATA}${path}?${new URLSearchParams(params).toString()}`, {
        headers: {
          "APCA-API-KEY-ID": creds.key,
          "APCA-API-SECRET-KEY": creds.secret,
          accept: "application/json",
        },
        next: { revalidate, tags: [tag] },
      }),
    );
    if (res.status === 429) return fail("alpaca", "rate-limited", "Alpaca istek limiti aşıldı");
    if (res.status === 404) return fail("alpaca", "not-found", "Sembol bulunamadı");
    if (!res.ok) return fail("alpaca", "upstream-error", `Alpaca ${res.status}`);
    return ok((await res.json()) as T, "alpaca", { fetchedAt: responseDate(res) });
  } catch (error) {
    return fail("alpaca", "network", error instanceof Error ? error.message : "Alpaca'ya ulaşılamadı");
  }
}

/**
 * Opsiyon kotasyonlarının tazeliği. Kotasyon yalnızca seans içinde
 * değişiyor ve ekrandaki sayı zaten bir tahmin; on beş dakika, sayfa
 * açıldıkça sağlayıcıya gitmemek için.
 */
const OPTIONS_REVALIDATE_S = 15 * 60;
/** Tek sayfada en fazla kontrat — vade ve kullanım fiyatı süzgeçli istekte ~200. */
const OPTIONS_PAGE_LIMIT = 1000;

type RawOptionSnapshot = {
  latestQuote?: { bp?: number; ap?: number; t?: string };
};

/**
 * Bir vade aralığındaki, spota yakın kontratların kotasyonları.
 * Kullanım fiyatı süzgeci istekte: zincirin tamamı NVDA'da binlerce kontrat.
 */
export async function getOptionQuotes(
  underlying: string,
  expiryFrom: string,
  expiryTo: string,
  strikeLow: number,
  strikeHigh: number,
): Promise<ProviderResult<OptionQuote[]>> {
  const result = await get<{ snapshots?: Record<string, RawOptionSnapshot> }>(
    `/v1beta1/options/snapshots/${encodeURIComponent(canonicalSymbol(underlying))}`,
    {
      feed: "indicative",
      expiration_date_gte: expiryFrom,
      expiration_date_lte: expiryTo,
      strike_price_gte: strikeLow.toFixed(2),
      strike_price_lte: strikeHigh.toFixed(2),
      limit: String(OPTIONS_PAGE_LIMIT),
    },
    OPTIONS_REVALIDATE_S,
    `options:${underlying}`,
  );
  if (!result.ok) return result;
  const quotes: OptionQuote[] = [];
  for (const [contract, snap] of Object.entries(result.data.snapshots ?? {})) {
    const parts = parseOcc(contract);
    const q = snap.latestQuote;
    if (!parts || !q || typeof q.bp !== "number" || typeof q.ap !== "number" || !q.t) continue;
    quotes.push({ expiry: parts.expiry, type: parts.type, strike: parts.strike, bid: q.bp, ask: q.ap, at: q.t });
  }
  if (quotes.length === 0) return fail("alpaca", "empty", `${underlying} için opsiyon kotasyonu yok`);
  return ok(quotes, "alpaca", { fetchedAt: result.fetchedAt });
}

/** Günlük seri altı saat önbellekte — geçmiş kapanışlar değişmiyor. */
const DAILY_REVALIDATE_S = 6 * 60 * 60;
/** İki yıllık günlük bar ~505; tek sayfada kalsın. */
const DAILY_LIMIT = 1000;

type RawBar = { t: string; c: number };

/**
 * `start`tan bugüne günlük kapanışlar (ET günü), bölünmeye göre düzeltilmiş.
 * `end` VERİLMİYOR — `sip` beslemesi "şimdi"yi kapsayan bir `end` ile 403
 * dönüyor (gerekçe alpaca.ts başında).
 */
export async function getDailyCloses(symbol: string, start: string): Promise<ProviderResult<DailyClose[]>> {
  const canonical = canonicalSymbol(symbol);
  const result = await get<{ bars?: Record<string, RawBar[] | null> }>(
    "/v2/stocks/bars",
    {
      symbols: canonical,
      timeframe: "1Day",
      start,
      limit: String(DAILY_LIMIT),
      adjustment: "split",
      feed: "sip",
      sort: "asc",
    },
    DAILY_REVALIDATE_S,
    `daily:${symbol}`,
  );
  if (!result.ok) return result;
  const list = result.data.bars?.[canonical] ?? [];
  if (list.length === 0) return fail("alpaca", "empty", `${symbol} için günlük bar yok`);
  return ok(
    list.map((bar) => ({ date: etParts(new Date(bar.t)).dateStr, close: bar.c })),
    "alpaca",
    { fetchedAt: result.fetchedAt },
  );
}
