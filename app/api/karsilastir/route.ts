import { NextResponse } from "next/server";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getChartBarsMulti } from "@/lib/providers";
import {
  isCompareRange,
  parseCompareSymbols,
  type CompareSeries,
} from "@/lib/compare";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/* --------------------------------------------------------------------------
   Karşılaştırma serileri — TOPLU.

   NEDEN VAR OLAN `/api/chart/[symbol]` UCU KULLANILMIYOR: o uç tek sembol
   alıyor ve dört sembollük bir ekran onu dört kez çağırmak zorunda kalırdı —
   dört ayrı HTTP isteği ve, daha önemlisi, sağlayıcıya DÖRT ayrı gidiş.
   `getChartBarsMulti` ise Alpaca'nın çok sembollü uç noktasını kullanıyor:
   dört sembol tek istekle geliyor. Ekran aralık düğmelerinin arasında gezmek
   için yazıldığı için bu fark doğrudan gecikmeye yazılıyor.

   Yük de dar: Bar'ın altı alanından yalnızca ikisi (`time`, `close`)
   taşınıyor. Bu ekran açılış/en yüksek/en düşük/hacim okumuyor; tamamı
   gönderilseydi 5Y'de dört sembol ≈ 1.000 bar × 6 alan boşuna geçerdi.

   ---- Oran sınırı ----

   Kalıp `/api/chart/[symbol]` ile aynı ve ayrım kota değil KARDİNALİTE
   üzerinden yapılıyor; gerekçenin tamamı orada yazılı. Kısaca: tanınan
   sembol kapalı bir küme (~500 satır, her yanıtı önbellekli) ve tavanı var;
   tanınmayan sembol sayım saldırısının tek girişi ve orası sonsuz bir uzay.

   SAYAÇ İSTEK BAŞINA, sembol başına değil — ve bu bilinçli: bir istek
   sağlayıcıya BİR gidişe karşılık geliyor (`getBarsMulti` toplu), yani
   dört sembollü bir istek tek sembollü bir istekten daha pahalı değil.
   Sınırın koruduğu şey sağlayıcı kotası, sembol sayısı değil.

   Tanınırlık `getSymbolNames` ile tek sorguda ölçülüyor. `isKnownSymbol`
   sembol başına ayrı bir `select ... limit 1` atıyor; dört sembol neon-http
   üzerinde dört gidiş-dönüş demekti ve karşılaştırma sayfası zaten
   `getSymbolNames`i çağırıyor, yani sorgu isteğin içinde memoize.

   TANINMAYAN TAVANI TEK SEMBOLLÜ UÇTAKİNDEN GENİŞ (10 değil 30) ve gerekçesi
   bu ekranın kullanım biçimi: aralık rayında altı düğme var ve okuyucu
   aralarında geziniyor, üstelik üzerinde durduğu düğme önden yükleniyor. Tek
   bir sayfa görüntülemesi meşru olarak beş-altı istek üretebiliyor; 10'luk
   tavan, uzun kuyruktan bir sembol ekleyen okuyucuyu iki gezinmede kapının
   dışında bırakıyordu. Ucun kendi dersi bunu söylüyor: sınır, koruduğu
   kullanıcıyı dışarıda bırakırsa yanlış kurulmuş demektir. Sayım
   saldırısına karşı koruma da bozulmuyor — 30 istek/dk hâlâ dar bir kapı ve
   dağıtık bir saldırıya karşı asıl katman zaten Vercel Firewall (bkz.
   lib/rate-limit.ts başı).
   -------------------------------------------------------------------------- */

const KNOWN_LIMIT = 300;
const UNKNOWN_LIMIT = 30;
const WINDOW_MS = 60_000;

export type CompareBarsResponse =
  | { ok: true; series: CompareSeries[] }
  | { ok: false; reason: string };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { kept: symbols } = parseCompareSymbols(params.get("semboller") ?? undefined);
  const range = params.get("aralik");

  /* `> MAX_COMPARE_SYMBOLS` dalı ÖLÜYDÜ ve sessizce yanıltıcıydı:
     `parseCompareSymbols` listeyi zaten `slice(0, MAX_COMPARE_SYMBOLS)` ile
     kırpıp döndürüyor (lib/compare.ts), yani `kept` hiçbir girdiyle tavanı
     aşamaz. Denetimi okuyan biri ucun fazla sembollü isteği reddettiğini
     sanıyordu; uç onu kırpıyor. Kırpma davranışı SAYFAYLA AYNI kalmalı —
     beş sembollü paylaşılmış bir bağlantıda sayfa dördünü çizerken barların
     400 dönmesi tabloyu dolu, grafiği boş bırakırdı. */
  if (symbols.length === 0) {
    return NextResponse.json<CompareBarsResponse>(
      { ok: false, reason: "invalid-symbols" },
      { status: 400 },
    );
  }
  if (!isCompareRange(range)) {
    return NextResponse.json<CompareBarsResponse>(
      { ok: false, reason: "invalid-range" },
      { status: 400 },
    );
  }

  /* Sınır sağlayıcıya gitmeden ÖNCE uygulanır; tek maliyeti tanınan sembol
     tablosuna bakan ve istek içinde önbellekli olan bir sorgu. */
  const names = await getSymbolNames(symbols);
  const taninmayanVar = symbols.some((symbol) => !names[symbol]);
  const limited = rateLimit(
    clientKey(request, taninmayanVar ? "compare-unknown" : "compare"),
    taninmayanVar ? UNKNOWN_LIMIT : KNOWN_LIMIT,
    WINDOW_MS,
  );
  if (!limited.allowed) {
    return NextResponse.json<CompareBarsResponse>(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const status = await getStatus();
  const barsBySymbol = await getChartBarsMulti(symbols, range, status);

  /* Sıra ADRESTEKİ sıra — seri renkleri sembolün listedeki yerinden
     türüyor ve sağlayıcının döndürdüğü sıraya güvenmek renkleri
     kaydırırdı. Tek barlık seriler eleniyor: normalize eğri en az iki
     nokta ister. */
  const series: CompareSeries[] = symbols
    .map((symbol) => {
      const bars = barsBySymbol[symbol] ?? [];
      return {
        symbol,
        closes: bars.map((bar) => bar.close),
        times: bars.map((bar) => bar.time),
      };
    })
    .filter((entry) => entry.closes.length >= 2);

  return NextResponse.json<CompareBarsResponse>({ ok: true, series });
}
