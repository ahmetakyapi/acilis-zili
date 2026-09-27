import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadAccountExport } from "@/lib/account-export";
import { accountExportCsv, exportFileName } from "@/lib/account-export-format";
import { todayEt } from "@/lib/market-hours";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Verilerimi İndir — `GET /api/hesap/verilerim?bicim=json|csv` (28 Eylül).
 *
 * KVKK veri taşınabilirliği: hesabın tuttuğu her alan tek dosyada.
 * Gerekçe ve içerik lib/account-export-format.ts. Ayarlar'daki iki
 * bağlantı buraya iniyor; dosya tarayıcıda indirilir (`attachment`).
 *
 * YALNIZCA OTURUM SAHİBİ. Kimlik istekten değil oturumdan; oturum yoksa
 * 401. Sayaç IP'ye değil kullanıcıya bağlı (hesap silmedeki kural,
 * lib/rate-limit.ts → DELETE_ACCOUNT_LIMIT): uç kendi verisini veriyor
 * ve IP değiştirmek bir kaçış yolu olmamalı.
 *
 * ÖNBELLEK YOK: yanıt kişisel veri taşıyor, hiçbir ara katmanda
 * saklanmamalı (`private, no-store`).
 */

const LIMIT = 10;
const WINDOW_MS = 10 * 60 * 1000;

const PRIVATE = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: PRIVATE });
  }

  const limit = rateLimit(`verilerim:${userId}`, LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited" },
      { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfter) } },
    );
  }

  const format = new URL(request.url).searchParams.get("bicim") === "csv" ? "csv" : "json";

  let data: Awaited<ReturnType<typeof loadAccountExport>>;
  try {
    data = await loadAccountExport(userId);
  } catch {
    /* Veritabanı düştüyse yarım bir dosya vermek yerine açıkça hata:
       eksik bir dışa aktarım "verim bu kadar" diye okunurdu. */
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: PRIVATE });
  }
  if (!data) {
    return NextResponse.json({ error: "not-found" }, { status: 404, headers: PRIVATE });
  }

  const fileName = exportFileName(todayEt(), format);
  const body = format === "csv" ? accountExportCsv(data) : `${JSON.stringify(data, null, 2)}\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...PRIVATE,
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
