import { NextResponse } from "next/server";
import { getFxPath, istanbulToday } from "@/lib/providers/fx-history";
import { dayNumber, isIsoDate, TCMB_MIN_DATE, type FxPath } from "@/lib/fx";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/* --------------------------------------------------------------------------
   İki gün arasındaki USD/TRY yolu — karşılaştırma ekranı ve hisse grafiği.

   `?baslangic=2026-03-27&bitis=2026-09-25` (+ `&reel=1` TÜFE için).
   Dönen şey bir kur DİZİSİ değil, yolun ÇAPALARI: iki ucun TCMB günlük
   kuru ve aradaki ayların FRED ortalaması. Barları istemci çeviriyor
   (`lib/fx.ts` → `convertCloses`), çünkü barlar zaten orada ve aynı yol
   hem grafiğe hem dönem getirisine gidiyor — ikisi aynı hesaptan çıkmalı.

   Aralık üst sınırı yirmi yıl: 5Y en uzun grafik aralığı ve portföyün eski
   alışları için pay. Oran sınırı `/api/karsilastir` ile aynı mertebede:
   okuyucu aralık düğmeleri arasında gezerken her aralık bir yol istiyor.
   -------------------------------------------------------------------------- */

const MAX_SPAN_DAYS = 20 * 366;
const LIMIT = 120;
const WINDOW_MS = 60_000;

export type FxPathResponse =
  | { ok: true; path: FxPath; monthlyAvailable: boolean }
  | { ok: false; reason: "invalid-range" | "rate-limited" | "unavailable" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const start = params.get("baslangic");
  const end = params.get("bitis");
  const real = params.get("reel") === "1";
  const today = istanbulToday();

  if (
    !isIsoDate(start) ||
    !isIsoDate(end) ||
    start < TCMB_MIN_DATE ||
    end > today ||
    start > end ||
    dayNumber(end) - dayNumber(start) > MAX_SPAN_DAYS
  ) {
    return NextResponse.json<FxPathResponse>(
      { ok: false, reason: "invalid-range" },
      { status: 400 },
    );
  }

  const limited = rateLimit(clientKey(request, "kur-yol"), LIMIT, WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json<FxPathResponse>(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const result = await getFxPath(start, end, { real });
  if (!result.ok) {
    return NextResponse.json<FxPathResponse>({ ok: false, reason: "unavailable" });
  }
  return NextResponse.json<FxPathResponse>({
    ok: true,
    path: result.data,
    monthlyAvailable: result.monthlyAvailable ?? false,
  });
}
