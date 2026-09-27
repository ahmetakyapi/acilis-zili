import { NextResponse } from "next/server";
import { getEvdsMonthly, isEvdsConfigured } from "@/lib/providers/evds";
import { isIsoMonth, monthDiff, type MonthlyValue } from "@/lib/fx";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/* --------------------------------------------------------------------------
   Aylık fiyat endeksi — vergi hesaplayıcısının Yİ-ÜFE sorusu.

   `?seri=yiufe&baslangic=2021-10&bitis=2026-08`. Anahtar (`EVDS_API_KEY`)
   yoksa 200 ile `missing-key` döner, hata kodu değil: bu bir arıza değil,
   kurulumun bilinen bir hâli ve hesaplayıcı buna göre endeks alanlarını
   okuyucuya açıyor.

   Aralık üst sınırı yirmi yıl; oran sınırı `/api/kur` ile aynı gerekçeyle
   dar — yanıt yarım gün önbellekte ama farklı aralıklar EVDS'ye gider.
   -------------------------------------------------------------------------- */

const MAX_SPAN_MONTHS = 240;
const LIMIT = 30;
const WINDOW_MS = 60_000;

const SERIES = { yiufe: "ppi", tufe: "cpi" } as const;

export type IndexResponse =
  | { ok: true; values: MonthlyValue[] }
  | { ok: false; reason: "missing-key" | "invalid" | "rate-limited" | "unavailable" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const seri = params.get("seri");
  const from = params.get("baslangic");
  const to = params.get("bitis");

  if (
    (seri !== "yiufe" && seri !== "tufe") ||
    !isIsoMonth(from) ||
    !isIsoMonth(to) ||
    monthDiff(from, to) < 0 ||
    monthDiff(from, to) > MAX_SPAN_MONTHS
  ) {
    return NextResponse.json<IndexResponse>({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (!isEvdsConfigured()) {
    return NextResponse.json<IndexResponse>({ ok: false, reason: "missing-key" });
  }

  const limited = rateLimit(clientKey(request, "kur-endeks"), LIMIT, WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json<IndexResponse>(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const result = await getEvdsMonthly(SERIES[seri], from, to);
  if (!result.ok) {
    return NextResponse.json<IndexResponse>({
      ok: false,
      reason: result.reason === "missing-key" ? "missing-key" : "unavailable",
    });
  }
  return NextResponse.json<IndexResponse>({ ok: true, values: result.data });
}
