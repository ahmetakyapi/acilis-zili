import { NextResponse } from "next/server";
import { getStatus, isKnownSymbol } from "@/lib/data";
import { getChartBars, getQuote } from "@/lib/providers";
import { isChartRange, type Bar } from "@/lib/providers/types";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isValidSymbol } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Oran sınırı

   Bu uç yetkisiz, herkese açık ve HER İSTEKTE Alpaca'ya gidebiliyor: her
   farklı sembol Next'in veri önbelleğinde ayrı bir anahtar, yani önbellek
   isabetsiz. `isValidSymbol` yalnızca biçimi doğruladığı için "AAAA" gibi
   milyonlarca uydurma sembol geçerli sayılıyordu ve tek bir döngü Alpaca'nın
   ücretsiz katmanındaki 200 istek/dk sınırını dakikalar içinde tüketiyordu.
   Kota bittiğinde site çökmüyor (önbellekten "güncel değil" damgasıyla
   sürüyor) ama canlı fiyat herkes için ölüyordu.

   Ayrım kota değil KARDİNALİTE üzerinden yapılır:

     TANINAN sembol — `symbols` tablosundaki ~500 hisse. Kapalı bir küme ve
       her yanıtı önbellekli, yani ne kadar gezilirse gezilsin sağlayıcıya
       giden istek sayısının bir tavanı var. Sınır cömert: grafiğin sekiz
       aralığı arasında hızlıca gezinen bir kullanıcı takılmamalı.

     TANINMAYAN sembol — aramanın Finnhub üzerinden bulduğu uzun kuyruk.
       Meşru bir keşif yolu, o yüzden kapatılmıyor; ama sayım saldırısının
       tek girişi de burası ve orası sonsuz bir uzay. Dar tutuluyor: bir
       insan dakikada sekiz bilinmeyen hisseye bakmaz, bir betik saniyede
       bakar.

   DAR SINIRIN BEDELİ ÖĞRENİLDİ. Hisse sayfasında tanınan sembollere de
   dakikada 40 konmuştu; Next'in `<Link>` ön yüklemesi bunu kendiliğinden
   tüketip kullanıcının gerçek tıklamalarını blokladı. Buradaki tavan o
   yüzden gerçek kullanımın çok üstünde tutuluyor — sınır, koruduğu
   kullanıcıyı dışarıda bırakırsa yanlış kurulmuş demektir.

   Sınırlayıcının sunucusuz ortamda örnek başına çalıştığı ve neyi
   çözmediği lib/rate-limit.ts başında yazılı — dağıtık bir saldırıya karşı
   asıl katman Vercel Firewall'daki IP kuralı, bu değil.
   -------------------------------------------------------------------------- */
const KNOWN_LIMIT = 300;
const UNKNOWN_LIMIT = 10;
const WINDOW_MS = 60_000;

export type ChartResponse =
  | {
      ok: true;
      bars: Bar[];
      source: string;
      stale: boolean;
      fetchedAt: string;
      /**
       * Önceki seansın kapanışı — yalnızca 1G için gönderilir. Günlük yüzde
       * TradingView/Midas konvansiyonuyla buna göre hesaplanır; açılış boşluğu
       * (gap) kaybolmaz.
       */
      prevClose?: number;
    }
  | { ok: false; reason: string };

export async function GET(
  request: Request,
  context: RouteContext<"/api/chart/[symbol]">,
) {
  const { symbol: rawSymbol } = await context.params;
  const symbol = rawSymbol.toUpperCase();
  const range = new URL(request.url).searchParams.get("range") ?? "1D";

  if (!isValidSymbol(symbol)) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: "invalid-symbol" },
      { status: 400 },
    );
  }
  if (!isChartRange(range)) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: "invalid-range" },
      { status: 400 },
    );
  }

  /* Sınır sağlayıcıya gitmeden ÖNCE uygulanır; tek maliyeti tanınan sembol
     listesine bakan bir veritabanı sorgusu ve o istek başına önbellekli. */
  const known = await isKnownSymbol(symbol);
  const limited = rateLimit(
    clientKey(request, known ? "chart" : "chart-unknown"),
    known ? KNOWN_LIMIT : UNKNOWN_LIMIT,
    WINDOW_MS,
  );
  if (!limited.allowed) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const status = await getStatus();
  const [result, quoteResult] = await Promise.all([
    getChartBars(symbol, range, status),
    range === "1D" ? getQuote(symbol, status) : Promise.resolve(null),
  ]);

  if (!result.ok) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: result.reason },
      { status: result.reason === "not-found" ? 404 : 502 },
    );
  }

  const prevClose =
    quoteResult?.ok && typeof quoteResult.data.prevClose === "number"
      ? quoteResult.data.prevClose
      : undefined;

  return NextResponse.json<ChartResponse>({
    ok: true,
    bars: result.data,
    source: result.source,
    stale: Boolean(result.stale),
    fetchedAt: result.fetchedAt.toISOString(),
    ...(prevClose !== undefined ? { prevClose } : {}),
  });
}
