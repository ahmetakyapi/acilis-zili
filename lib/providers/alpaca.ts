import { etParts } from "../market-hours";
import {
  fail,
  ok,
  type Bar,
  type ChartRange,
  type ProviderResult,
  type Quote,
} from "./types";
import { withTimeout } from "./timeout";

/**
 * Alpaca Market Data — fiyat ve grafik barları.
 *
 * Ücretsiz katman IEX beslemesini kullanır: gerçek zamanlıdır ama konsolide
 * (SIP) hacmin bir kısmını görür. Ekranda "IEX" damgası bu yüzden gösterilir.
 * Ücretli plana geçilirse tek yapılacak DEFAULT_FEED'i "sip" yapmaktır.
 */

const BASE = "https://data.alpaca.markets/v2/stocks";
const DEFAULT_FEED = "iex";

function credentials(): { key: string; secret: string } | null {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return null;
  return { key, secret };
}

export function isAlpacaConfigured(): boolean {
  return credentials() !== null;
}

type FetchOpts = { revalidate: number; tags?: string[] };

async function alpacaFetch<T>(
  path: string,
  params: Record<string, string>,
  opts: FetchOpts,
): Promise<ProviderResult<T>> {
  const creds = credentials();
  if (!creds) {
    return fail(
      "alpaca",
      "missing-key",
      "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY tanımlı değil",
    );
  }

  const url = `${BASE}${path}?${new URLSearchParams(params).toString()}`;

  try {
    /* Süre sınırı — gerekçe lib/providers/timeout.ts'te. */
    const res = await withTimeout(
      fetch(url, {
        headers: {
          "APCA-API-KEY-ID": creds.key,
          "APCA-API-SECRET-KEY": creds.secret,
          accept: "application/json",
        },
        next: { revalidate: opts.revalidate, tags: opts.tags },
      }),
    );

    if (res.status === 429) {
      return fail("alpaca", "rate-limited", "Alpaca istek limiti aşıldı");
    }
    if (res.status === 404) {
      return fail("alpaca", "not-found", "Sembol bulunamadı");
    }
    if (!res.ok) {
      return fail(
        "alpaca",
        "upstream-error",
        `Alpaca ${res.status}: ${await safeText(res)}`,
      );
    }

    return ok((await res.json()) as T, "alpaca");
  } catch (error) {
    return fail(
      "alpaca",
      "network",
      error instanceof Error ? error.message : "Alpaca'ya ulaşılamadı",
    );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "gövde okunamadı";
  }
}

/* --------------------------------------------------------------------------
   Anlık fiyat
   -------------------------------------------------------------------------- */

type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type AlpacaSnapshot = {
  latestTrade?: { p: number; t: string };
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
  minuteBar?: AlpacaBar;
};

/** Alpaca iki farklı zarf döndürebiliyor; ikisini de aç. */
function unwrapSnapshots(
  payload: unknown,
): Record<string, AlpacaSnapshot> | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.snapshots && typeof record.snapshots === "object") {
    return record.snapshots as Record<string, AlpacaSnapshot>;
  }
  return record as Record<string, AlpacaSnapshot>;
}

function snapshotToQuote(symbol: string, snap: AlpacaSnapshot): Quote | null {
  const price =
    snap.latestTrade?.p ?? snap.minuteBar?.c ?? snap.dailyBar?.c ?? null;
  const prevClose = snap.prevDailyBar?.c ?? null;
  if (price === null) return null;

  /* Önceki kapanış yoksa değişim SIFIR DEĞİL, BİLİNMİYOR. Sıfır yazmak
     ekranda "bugün fiyat hiç değişmedi" cümlesini kuruyordu. */
  const change = prevClose !== null ? price - prevClose : null;
  const changePct =
    change !== null && prevClose !== null && prevClose !== 0
      ? (change / prevClose) * 100
      : null;

  return {
    symbol,
    price,
    change,
    changePct,
    open: snap.dailyBar?.o ?? null,
    high: snap.dailyBar?.h ?? null,
    low: snap.dailyBar?.l ?? null,
    prevClose,
    volume: snap.dailyBar?.v ?? null,
    tradedAt: snap.latestTrade?.t ? new Date(snap.latestTrade.t) : null,
  };
}

/**
 * Tek istekte sorulacak sembol sayısı — URL uzunluğu sınırı için.
 * Hem anlık fiyat hem dönemsel değişim uçları bunu kullanır.
 */
const BATCH_SIZE = 200;

/**
 * Anlık fiyatlar — çok sembollü.
 *
 * `getPeriodChanges` gibi BATCH_SIZE'lık paketlere bölünür. Eskiden tüm liste
 * tek URL'ye diziliyordu; Şirketler dizini 513 sembolle çağırdığında sorgu
 * dizesi 2200 karakteri buluyordu — bugün çalışıyor ama evren büyüdüğünde
 * sessizce kırılacak bir sınırın dibinde duruyordu.
 *
 * Paketlerden biri düşerse diğerleri yine döner: kısmi sonuç, hiç sonuç
 * olmamasından iyidir. Hiçbiri dönmezse son hata yukarı taşınır ve çağıran
 * önbelleğe düşer.
 */
export async function getSnapshots(
  symbols: string[],
  revalidate: number,
): Promise<ProviderResult<Record<string, Quote>>> {
  if (symbols.length === 0) return ok({}, "alpaca");

  const unique = [...new Set(symbols)];
  const quotes: Record<string, Quote> = {};
  let fetchedAt: Date | undefined;
  let lastFailure: ProviderResult<Record<string, Quote>> | null = null;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const result = await alpacaFetch<unknown>(
      "/snapshots",
      { symbols: batch.join(","), feed: DEFAULT_FEED },
      { revalidate, tags: ["quotes"] },
    );

    if (!result.ok) {
      lastFailure = result;
      continue;
    }

    const snapshots = unwrapSnapshots(result.data);
    if (!snapshots) {
      lastFailure = fail(
        "alpaca",
        "empty",
        "Snapshot yanıtı beklenen biçimde değil",
      );
      continue;
    }

    for (const symbol of batch) {
      const snap = snapshots[symbol];
      if (!snap) continue;
      const quote = snapshotToQuote(symbol, snap);
      if (quote) quotes[symbol] = quote;
    }

    if (!fetchedAt || result.fetchedAt > fetchedAt) fetchedAt = result.fetchedAt;
  }

  if (Object.keys(quotes).length === 0) {
    return (
      lastFailure ??
      fail("alpaca", "empty", "Hiçbir sembol için fiyat dönmedi")
    );
  }

  return ok(quotes, "alpaca", { fetchedAt });
}

/* --------------------------------------------------------------------------
   Toplu dönemsel değişim

   Şirketler dizininde 500 satır var; her biri için ayrı bar isteği atmak
   mümkün değil. Alpaca'nın /bars ucu `symbols` parametresini virgülle
   ayrılmış liste olarak kabul ediyor ve sonucu sembol → bar dizisi olarak
   döndürüyor, yani tüm dizin birkaç istekle çıkıyor.

   Günlük barla çalışıyoruz: hafta içindeki 5 işlem gününü kapsaması için
   takvimde ~12 gün geriye gidiliyor (hafta sonu + olası tatil payı).
   -------------------------------------------------------------------------- */

/**
 * Verilen sembollerin son `sessions` işlem günündeki yüzde değişimi.
 * Yeterli bar olmayan semboller sonuçta hiç görünmez (null yerine eksik).
 */
export async function getPeriodChanges(
  symbols: string[],
  sessions: number,
  revalidate: number,
): Promise<ProviderResult<Record<string, number>>> {
  if (symbols.length === 0) return ok({}, "alpaca");

  const unique = [...new Set(symbols)];
  const lookbackDays = Math.max(12, sessions * 2 + 6);
  const start = new Date(Date.now() - lookbackDays * 86400000)
    .toISOString()
    .slice(0, 10);

  const changes: Record<string, number> = {};
  let anyOk = false;
  let lastFailure: ProviderResult<Record<string, number>> | null = null;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const result = await alpacaFetch<{
      bars?: Record<string, AlpacaBar[]>;
    }>(
      "/bars",
      {
        symbols: batch.join(","),
        timeframe: "1Day",
        start,
        limit: String(batch.length * (sessions + 8)),
        adjustment: "split",
        feed: DEFAULT_FEED,
        sort: "asc",
      },
      { revalidate, tags: ["bars", `changes:${sessions}`] },
    );

    if (!result.ok) {
      lastFailure = result;
      continue;
    }
    anyOk = true;

    for (const [symbol, bars] of Object.entries(result.data.bars ?? {})) {
      if (!bars || bars.length < 2) continue;
      const last = bars[bars.length - 1];
      // `sessions` gün öncesi; o kadar bar yoksa eldeki en eskisi kullanılır
      // ve sonuç "kısa dönem" olur — yanlış değil, sadece daha dar.
      const base = bars[Math.max(0, bars.length - 1 - sessions)];
      if (!base?.c || !last?.c) continue;
      changes[symbol] = ((last.c - base.c) / base.c) * 100;
    }
  }

  if (!anyOk && lastFailure) return lastFailure;
  return ok(changes, "alpaca");
}

/* --------------------------------------------------------------------------
   Grafik barları
   -------------------------------------------------------------------------- */

type RangeSpec = {
  timeframe: string;
  /** Başlangıç için geriye gidilecek gün sayısı. */
  lookbackDays: number;
  limit: number;
};

/**
 * Aralık → bar çözünürlüğü.
 * 1G'de 5 dakikalık barlar seansın şeklini korur; 5 yılda haftalık barlar
 * hem yeterli hem de tek istekte sığar.
 */
const RANGE_SPECS: Record<ChartRange, RangeSpec> = {
  "1D": { timeframe: "5Min", lookbackDays: 4, limit: 2000 },
  "1W": { timeframe: "30Min", lookbackDays: 9, limit: 2000 },
  "1M": { timeframe: "1Day", lookbackDays: 35, limit: 500 },
  "3M": { timeframe: "1Day", lookbackDays: 95, limit: 500 },
  "6M": { timeframe: "1Day", lookbackDays: 190, limit: 500 },
  YTD: { timeframe: "1Day", lookbackDays: 0, limit: 500 },
  "1Y": { timeframe: "1Day", lookbackDays: 370, limit: 500 },
  "5Y": { timeframe: "1Week", lookbackDays: 1830, limit: 400 },
};

function startDateFor(range: ChartRange, now: Date): string {
  if (range === "YTD") {
    return `${now.getUTCFullYear()}-01-01`;
  }
  const spec = RANGE_SPECS[range];
  const start = new Date(now.getTime() - spec.lookbackDays * 86400000);
  return start.toISOString().slice(0, 10);
}

export async function getBars(
  symbol: string,
  range: ChartRange,
  revalidate: number,
): Promise<ProviderResult<Bar[]>> {
  const spec = RANGE_SPECS[range];
  const now = new Date();

  const result = await alpacaFetch<{
    bars?: Record<string, AlpacaBar[]> | AlpacaBar[];
  }>(
    "/bars",
    {
      symbols: symbol,
      timeframe: spec.timeframe,
      start: startDateFor(range, now),
      limit: String(spec.limit),
      adjustment: "split",
      feed: DEFAULT_FEED,
      sort: "asc",
    },
    { revalidate, tags: [`bars:${symbol}`] },
  );
  if (!result.ok) return result;

  const raw = result.data.bars;
  const list = Array.isArray(raw) ? raw : (raw?.[symbol] ?? []);

  if (!list || list.length === 0) {
    return fail("alpaca", "empty", `${symbol} için bar verisi yok`);
  }

  let bars: Bar[] = list.map((b) => ({
    time: Math.floor(new Date(b.t).getTime() / 1000),
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v,
  }));

  // 1G yalnızca en son işlem gününü göstermeli; hafta sonu ve tatillerde
  // geriye dönük veri çektiğimiz için son günü ayıklıyoruz.
  if (range === "1D") {
    bars = lastTradingDayOnly(bars);
  }

  return ok(bars, "alpaca", { fetchedAt: result.fetchedAt });
}

/**
 * Alpaca'nın tek istekte döndürdüğü en fazla bar sayısı.
 *
 * `limit` sembol BAŞINA değil, YANITIN TAMAMI için geçerli — çoklu sembol
 * isteğinde tavan aşılırsa yanıt kesiliyor ve `next_page_token` ile devam
 * ediliyor. Sayfalama yapmak yerine istek, tavana sığacak kadar sembolle
 * bölünüyor: `sort=asc` olduğu için kesilme listenin sonundaki sembollerin
 * EN YENİ barlarını düşürürdü, yani grafik sessizce eksik çizilirdi.
 */
const MAX_BARS_PER_REQUEST = 10_000;

/**
 * Birden çok sembolün barları — TEK istekte.
 *
 * `getBars` tek sembolle çalışıyor ve çağıranlar onu döngüde çağırıyordu:
 * ana sayfanın endeks şeridi 4, favori özeti 8, /mercek 12'ye kadar. Her
 * çağrı ayrı bir Alpaca isteği artı ayrı bir `candles_cache` yazması
 * demekti. Alpaca'nın `/bars` ucu virgüllü sembol listesi kabul ediyor ve
 * yanıtı zaten sembol → bar dizisi olarak veriyor.
 *
 * Bulunamayan sembol sonuçta HİÇ görünmez (boş dizi değil): çağıran onu
 * "veri yok" diye ayırt edebilsin.
 */
export async function getBarsMulti(
  symbols: string[],
  range: ChartRange,
  revalidate: number,
): Promise<ProviderResult<Record<string, Bar[]>>> {
  if (symbols.length === 0) return ok({}, "alpaca");

  const spec = RANGE_SPECS[range];
  const unique = [...new Set(symbols)];
  const perRequest = Math.max(
    1,
    Math.min(BATCH_SIZE, Math.floor(MAX_BARS_PER_REQUEST / spec.limit)),
  );
  const start = startDateFor(range, new Date());

  const out: Record<string, Bar[]> = {};
  let anyOk = false;
  let lastFailure: ProviderResult<Record<string, Bar[]>> | null = null;
  let fetchedAt: Date | undefined;

  for (let i = 0; i < unique.length; i += perRequest) {
    const batch = unique.slice(i, i + perRequest);
    const result = await alpacaFetch<{
      bars?: Record<string, AlpacaBar[]>;
    }>(
      "/bars",
      {
        symbols: batch.join(","),
        timeframe: spec.timeframe,
        start,
        limit: String(Math.min(MAX_BARS_PER_REQUEST, spec.limit * batch.length)),
        adjustment: "split",
        feed: DEFAULT_FEED,
        sort: "asc",
      },
      { revalidate, tags: ["bars", `bars:${range}`] },
    );

    if (!result.ok) {
      lastFailure = result;
      continue;
    }
    anyOk = true;
    fetchedAt = result.fetchedAt;

    for (const [symbol, list] of Object.entries(result.data.bars ?? {})) {
      if (!list || list.length === 0) continue;
      let bars: Bar[] = list.map((b) => ({
        time: Math.floor(new Date(b.t).getTime() / 1000),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      }));
      if (range === "1D") bars = lastTradingDayOnly(bars);
      if (bars.length > 0) out[symbol] = bars;
    }
  }

  if (!anyOk && lastFailure) return lastFailure;
  return ok(out, "alpaca", { fetchedAt });
}

/**
 * Gün ayrımı New York takvimine göre yapılır — UTC'ye göre yapılırsa
 * kapanış sonrası barlar (20:00 ET = 00:00 UTC) ertesi güne kayar.
 */
function lastTradingDayOnly(bars: Bar[]): Bar[] {
  if (bars.length === 0) return bars;
  const dayOf = (bar: Bar) => etParts(new Date(bar.time * 1000)).dateStr;
  const lastDay = dayOf(bars[bars.length - 1]);
  return bars.filter((b) => dayOf(b) === lastDay);
}
