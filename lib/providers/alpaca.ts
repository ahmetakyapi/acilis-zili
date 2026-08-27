import { etParts, todayEt } from "../market-hours";
import {
  fail,
  ok,
  type Bar,
  type ChartRange,
  type ProviderResult,
  type Quote,
  responseDate,
} from "./types";
import { withTimeout } from "./timeout";

/**
 * Alpaca Market Data — fiyat ve grafik barları.
 *
 * BESLEME SEÇİMİ — ÖLÇÜLEREK DEĞİŞTİ.
 *
 * Uzun süre `iex` kullanıldı: "gerçek zamanlı" olduğu için doğru seçim gibi
 * duruyordu. IEX tek bir borsa ve konsolide tape'in yalnızca küçük bir
 * dilimini görüyor. Ölçüldü (19 Ağustos 2026 kapanışı, ekrandaki sayı /
 * gerçek konsolide hacim):
 *
 *     MRNA 3,67M / 199,3M (%1,8)   ·   INTC  4,43M / 110,3M (%4,0)
 *     NVDA 2,79M /  97,6M (%2,9)   ·   PFE   3,89M /  59,8M (%6,5)
 *
 * Oran sembolden sembole %2 ile %8 arasında değiştiği için asıl zarar
 * sayının küçüklüğü değil SIRALAMANIN BOZULMASIYDI: Şirketler dizini
 * "hacme göre sırala" dendiğinde gerçekte birinci olan MRNA'yı üçüncü,
 * gerçekte listede olmayan CMG ile CMCSA'yı ilk ona koyuyordu. Aynı besleme
 * gün barının açılış/en yüksek/en düşük değerlerini ve ÖNCEKİ KAPANIŞI da
 * kendi dilimiyle üretiyor, yani değişim yüzdesi de resmî kapanışa göre
 * değil IEX'in kendi kapanışına göre hesaplanıyordu.
 *
 * Daha kötüsü seans dışında: IEX'te açılış öncesi ve kapanış sonrası işlem
 * akmıyor. Sabah 05:58 ET'de sorulduğunda IEX'in "son işlemi" DÜNKÜ
 * kapanıştı (14 saat önce), oysa konsolide tape o dakikanın açılış öncesi
 * fiyatını veriyordu. Adı "Açılış Zili" olan ve açılış öncesini anlatan bir
 * sitede bu, ürünün tam merkezindeki veri boşluğuydu.
 *
 * Ücretsiz katman konsolide tape'i 15 dakika gecikmeyle veriyor ve iki
 * kapıdan geçiyor — anlık uçlarda `delayed_sip`, tarihsel bar ucunda `sip`.
 * Bu site gün sonu ve açılış öncesi okunuyor; 15 dakikalık gecikme, hacmin
 * yirmide birini görmekten çok daha ucuz. Ekrandaki künye gecikmeyi yazıyor.
 *
 * TUZAK: tarihsel bar ucunda `sip` yalnızca `end` verilmediğinde (ya da
 * `end` 15 dakikadan eskiyken) çalışıyor; "şimdi"yi kapsayan bir aralık
 * istenirse uç 403 döndürüyor. Bu dosyada `/bars` çağrılarının hiçbiri
 * `end` göndermiyor — Alpaca aralığı kendisi 15 dakika öncesinde kesiyor.
 * Yeni bir çağrı eklerken `end` verme.
 */

const BASE = "https://data.alpaca.markets/v2/stocks";
/** Anlık uçlar (`/snapshots`) — konsolide tape, 15 dakika gecikmeli. */
const SNAPSHOT_FEED = "delayed_sip";
/** Tarihsel bar ucu — aynı tape'in tarihsel kapısı. `end` VERME. */
const BAR_FEED = "sip";

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

    return ok((await res.json()) as T, "alpaca", {
      fetchedAt: responseDate(res),
    });
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

/**
 * Son işlemin üstünden bu kadar geçtiyse sembol "ölü" sayılır.
 *
 * Beş gün: uzun bir hafta sonu + tatil kombinasyonu dört günü buluyor
 * (ör. Şükran Günü haftası) ve canlı bir sembol bu kadar sessiz kalabilir.
 * Beşinci güne ulaşan bir sembol artık işlem görmüyor demektir.
 */
const STALE_TRADE_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * "Önceki kapanış" HANGİ BAR?
 *
 * Alpaca `dailyBar` ile `prevDailyBar` veriyor ve doğal okuma "prevDailyBar
 * önceki kapanıştır" oluyor. Seans açıkken doğru; AÇILIŞ ÖNCESİNDE DEĞİL.
 *
 * 20 Ağustos 2026, 05:41 ET (açılış öncesi) — MRNA'nın anlık görüntüsü:
 *
 *     latestTrade  20 Ağustos 05:41   154,65   ← bu sabahın ön seansı
 *     dailyBar     19 Ağustos         174,38   ← DÜNKÜ seans, henüz kapanmış
 *     prevDailyBar 18 Ağustos          62,96
 *
 * Alpaca gün barını yeni seansa ancak seans ilerleyince çeviriyor, yani o
 * pencerede `prevDailyBar` DÜNÜN DEĞİL ÖNCEKİ GÜNÜN kapanışı. Ekranda MRNA
 * "+%145,64" yazıyordu: bu iki günün toplam hareketiydi ve okuyucu onu
 * bu sabahın hareketi sanıyordu.
 *
 * Kural: fiyatın ait olduğu ET günü, gün barının ET gününden SONRAYSA son
 * kapanmış seans gün barının kendisidir — referans kapanış `dailyBar.c`.
 * Aynı gündeyse gün barı içinde bulunduğumuz seanstır, referans
 * `prevDailyBar.c` kalır. Gün ayrımı ET takvimiyle yapılıyor: UTC ile
 * yapılırsa akşam seansı (20:00 ET = 00:00 UTC) ertesi güne kayıyor.
 */
function referenceClose(
  snap: AlpacaSnapshot,
  tradedAt: Date | null,
): number | null {
  const barDay = snap.dailyBar?.t
    ? etParts(new Date(snap.dailyBar.t)).dateStr
    : null;
  const priceDay = tradedAt ? etParts(tradedAt).dateStr : null;
  if (barDay && priceDay && priceDay > barDay) {
    return snap.dailyBar?.c ?? null;
  }
  return snap.prevDailyBar?.c ?? null;
}

function snapshotToQuote(symbol: string, snap: AlpacaSnapshot): Quote | null {
  const tradedAt = snap.latestTrade?.t ? new Date(snap.latestTrade.t) : null;
  const price =
    snap.latestTrade?.p ?? snap.minuteBar?.c ?? snap.dailyBar?.c ?? null;
  const prevClose = referenceClose(snap, tradedAt);
  if (price === null) return null;

  /* Önceki kapanış yoksa değişim SIFIR DEĞİL, BİLİNMİYOR. Sıfır yazmak
     ekranda "bugün fiyat hiç değişmedi" cümlesini kuruyordu. */
  const change = prevClose !== null ? price - prevClose : null;
  const changePct =
    change !== null && prevClose !== null && prevClose !== 0
      ? (change / prevClose) * 100
      : null;

  /* ÖLÜ SEMBOLÜN DEĞİŞİMİ BUGÜNÜN DEĞİŞİMİ DEĞİL. Borsadan çıkmış ya da
     işlemi durmuş semboller için sağlayıcı son işlem gününün fotoğrafını
     döndürmeye devam ediyor: NLST'nin son işlemi 2021'de, CLSD'ninki
     2025 Kasım'da ve ikisi de o günün yüzdesini taşıyor (−%27,7 gibi).
     Bu sayı "değişime göre sırala" listelerinin tepesine oturuyor ve
     okuyucu bugün böyle bir hareket olduğunu sanıyor — evrende bu durumda
     34 sembol var (ölçüldü).

     Fiyat KALIYOR (son bilinen değer bir bilgidir, künyesi de var), yalnızca
     DEĞİŞİM bilinmiyor sayılıyor: sıfır yazmak da yanlış olurdu, çünkü
     "bugün değişmedi" başka bir iddia. */
  const stale =
    tradedAt !== null && Date.now() - tradedAt.getTime() > STALE_TRADE_MS;

  return {
    symbol,
    price,
    change: stale ? null : change,
    changePct: stale ? null : changePct,
    open: snap.dailyBar?.o ?? null,
    high: snap.dailyBar?.h ?? null,
    low: snap.dailyBar?.l ?? null,
    prevClose,
    volume: snap.dailyBar?.v ?? null,
    tradedAt,
  };
}

/**
 * Tek istekte sorulacak sembol sayısı — URL uzunluğu sınırı için.
 * Hem anlık fiyat hem dönemsel değişim uçları bunu kullanır.
 */
const BATCH_SIZE = 200;

/** Listeyi `BATCH_SIZE`lık paketlere böler — iki toplu uç da bunu kullanıyor. */
function batches(symbols: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    out.push(symbols.slice(i, i + BATCH_SIZE));
  }
  return out;
}

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

  /* PAKETLER PARALEL. Döngü `await` ile sırayla bekliyordu: 670 sembollük
     şirketler dizini dört pakete bölünüyor ve dördü arka arkaya gidiyordu.
     Ölçüldü — sayfanın yanıtı 2,8 saniye, tek başına bu döngüden. Paketler
     birbirine bağlı değil; hiçbiri ötekinin sonucunu okumuyor. */
  const results = await Promise.all(
    batches(unique).map((batch) =>
      alpacaFetch<unknown>(
        "/snapshots",
        { symbols: batch.join(","), feed: SNAPSHOT_FEED },
        { revalidate, tags: ["quotes"] },
      ).then((result) => ({ batch, result })),
    ),
  );

  for (const { batch, result } of results) {
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

    if (!fetchedAt || result.fetchedAt > fetchedAt)
      fetchedAt = result.fetchedAt;
  }

  if (Object.keys(quotes).length === 0) {
    return (
      lastFailure ?? fail("alpaca", "empty", "Hiçbir sembol için fiyat dönmedi")
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

  /* Paketler PARALEL — gerekçe `getSnapshots` içinde. */
  const results = await Promise.all(
    batches(unique).map((batch) =>
      alpacaFetch<{ bars?: Record<string, AlpacaBar[]> }>(
        "/bars",
        {
          symbols: batch.join(","),
          timeframe: "1Day",
          start,
          limit: String(batch.length * (sessions + 8)),
          adjustment: "split",
          feed: BAR_FEED,
          sort: "asc",
        },
        { revalidate, tags: ["bars", `changes:${sessions}`] },
      ),
    ),
  );

  for (const result of results) {
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
    /* YIL ET'DEN OKUNUR. `getUTCFullYear()` 31 Aralık'ta New York saatiyle
       19:00'dan sonra bir sonraki yılı veriyordu — ET hâlâ eski yılda ama
       istek gelecek yılın 1 Ocak'ından başlayan boş bir aralık istiyor,
       Alpaca bar döndürmüyor ve grafik "veri yok" gösteriyordu. Aynı
       dosyadaki `lastTradingDayOnly` gün ayrımını bilinçli olarak ET ile
       yapıyor; bu satır o kuralın dışında kalmıştı. */
    return `${todayEt(now).slice(0, 4)}-01-01`;
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
      feed: BAR_FEED,
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
        limit: String(
          Math.min(MAX_BARS_PER_REQUEST, spec.limit * batch.length),
        ),
        adjustment: "split",
        feed: BAR_FEED,
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
