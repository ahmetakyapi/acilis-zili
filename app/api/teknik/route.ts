import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { technicalAnalyses } from "@/lib/schema";
import { isTechnicalSlot, isTechnicalSymbol } from "@/lib/technical";
import {
  TECHNICAL_INPUT_SHAPE,
  getTechnicalDetail,
  rowForApi,
  saveTechnicalBatch,
} from "@/lib/technical-data";

/**
 * Teknik analiz alım ucu — bülten, mercek ve bilanço köprüsünün dördüncüsü.
 *
 * POST bir işlem gününün bir yayınını TOPLU yazar: `{session_date, slot,
 * items: [...]}`. On iki sembol tek gövdede; doğrulamadan geçemeyen öğe
 * hata listesinde döner, geçenler yazılır. Şema ve yazma
 * `lib/technical-data.ts`te — bu dosya yalnızca kapı.
 *
 * GET kaydı geri okur: `?symbol=NVDA` son analizi, `&date=&slot=` belirli
 * bir yayını. Alan adları POST öğesiyle aynı; okunan paket düzenlenip geri
 * gönderilebilir (fotoğraf salt okunur, gönderilse de yok sayılır).
 */

function authorized(request: Request) {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const date = url.searchParams.get("date")?.trim() ?? null;
  const slot = url.searchParams.get("slot")?.trim() ?? null;

  if (!isTechnicalSymbol(symbol)) {
    return NextResponse.json(
      {
        error: "missing-params",
        detail: "?symbol=NVDA zorunlu (isteğe bağlı &date=YYYY-MM-DD&slot=premarket). Liste: /api/teknik/context",
      },
      { status: 400 },
    );
  }

  if (date || slot) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isTechnicalSlot(slot)) {
      return NextResponse.json(
        { error: "invalid-params", detail: "date ve slot birlikte verilir: &date=YYYY-MM-DD&slot=premarket|midsession" },
        { status: 400 },
      );
    }
    const [row] = await db
      .select()
      .from(technicalAnalyses)
      .where(
        and(
          eq(technicalAnalyses.symbol, symbol),
          eq(technicalAnalyses.sessionDate, date),
          eq(technicalAnalyses.slot, slot),
        ),
      )
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "not-found", symbol, date, slot }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...rowForApi(row) });
  }

  const detail = await getTechnicalDetail(symbol);
  if (!detail) {
    return NextResponse.json({ error: "not-found", symbol }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...rowForApi(detail.row) });
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid-json", expected: TECHNICAL_INPUT_SHAPE },
      { status: 400 },
    );
  }

  const outcome = await saveTechnicalBatch(body);
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, detail: outcome.detail, expected: TECHNICAL_INPUT_SHAPE },
      { status: outcome.status },
    );
  }

  /* HİÇBİRİ YAZILAMADIYSA 400. Kısmi başarıda 200 ve `ok: false`: rutin
     `errors` listesindeki öğeleri düzeltip yalnızca onları yeniden gönderir. */
  const status = outcome.saved.length === 0 ? 400 : 200;
  return NextResponse.json(
    {
      ok: outcome.errors.length === 0,
      session_date: outcome.sessionDate,
      slot: outcome.slot,
      saved: outcome.saved,
      errors: outcome.errors,
      ...(outcome.errors.length > 0 ? { expected: TECHNICAL_INPUT_SHAPE } : {}),
    },
    { status },
  );
}
