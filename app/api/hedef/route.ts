import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { analystTargets } from "@/lib/schema";
import { getStatus, isKnownSymbol } from "@/lib/data";
import { todayEt } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { TARGET_INPUT_SHAPE, targetItemSchema, validateTarget } from "@/lib/analyst-targets";

/**
 * ORTALAMA ANALİST HEDEFİ — yazma ve geri okuma (2 Ekim).
 *
 * POST: günlük bülten rutini takip edilen hisselerin güncel ortalamasını
 * TOPLU yazıyor (docs/claude-rutinler.md § 1, adım 1c). Her kalem
 * `validateTarget`ten geçiyor (kurallar `lib/analyst-targets.ts`);
 * reddedilen kalem sebebiyle dönüyor, kabul edilenler yazılıyor —
 * bir kalemin hatası ötekileri düşürmüyor. Aynı gün aynı sembol tekrar
 * yazılırsa üzerine yazılır (kaynak düzeltmesi).
 * GET `?symbol=`: son on kayıt — rutin bir önceki değeri görüp sıçramayı
 * kendisi de denetleyebilsin.
 */

const bodySchema = z.object({ items: z.array(targetItemSchema).min(1).max(60) });

function authorized(request: Request) {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "invalid-body", expected: TARGET_INPUT_SHAPE, issues: error instanceof z.ZodError ? error.issues.slice(0, 5) : undefined },
      { status: 400 },
    );
  }

  const status = await getStatus();
  const today = todayEt();
  const symbols = [...new Set(parsed.items.map((item) => item.symbol))];
  /* Makullük kontrolünün dayanağı canlı fiyat. Kotasyon alınamazsa kontrol
     atlanıyor; öteki kurallar (tarih, aralık, sıçrama) yine işliyor. */
  const quotes = await getQuotes(symbols, status);

  /* TABLO YOKSA AÇIK HATA. Migration deploy'da uygulanmıyor (CLAUDE.md);
     0024 inmeden rutin yazarsa anlamsız bir 500 yerine sebebi dönüyor. */
  try {
    await db.select({ symbol: analystTargets.symbol }).from(analystTargets).limit(1);
  } catch {
    return NextResponse.json(
      { error: "storage-unavailable", hint: "analyst_targets tablosu yok — migration 0024 uygulanmalı (npm run db:migrate)" },
      { status: 503 },
    );
  }

  const accepted: string[] = [];
  const rejected: { symbol: string; reason: string }[] = [];
  for (const item of parsed.items) {
    if (!(await isKnownSymbol(item.symbol))) {
      rejected.push({ symbol: item.symbol, reason: "unknown-symbol" });
      continue;
    }
    const price = quotes.ok ? quotes.data[item.symbol]?.price ?? null : null;
    const previousRows = await db
      .select({ mean: analystTargets.mean, asOf: analystTargets.asOf })
      .from(analystTargets)
      .where(eq(analystTargets.symbol, item.symbol))
      .orderBy(desc(analystTargets.asOf))
      .limit(2);
    /* Aynı günün kaydı "önceki" sayılmaz — o bir düzeltme. */
    const previous = previousRows.find((row) => row.asOf !== item.as_of) ?? null;
    const verdict = validateTarget(item, { todayEt: today, price, previous });
    if (!verdict.ok) {
      rejected.push({ symbol: item.symbol, reason: verdict.reason });
      continue;
    }
    const values = {
      symbol: item.symbol,
      asOf: item.as_of,
      mean: item.mean,
      median: item.median ?? null,
      high: item.high ?? null,
      low: item.low ?? null,
      analystCount: item.analyst_count,
      source: item.source,
      sourceUrl: item.source_url,
      priceAtWrite: price,
      updatedAt: new Date(),
    };
    await db
      .insert(analystTargets)
      .values(values)
      .onConflictDoUpdate({
        target: [analystTargets.symbol, analystTargets.asOf],
        set: { ...values, updatedAt: sql`now()` },
      });
    accepted.push(item.symbol);
  }
  return NextResponse.json({ ok: true, accepted, rejected });
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "missing-params", expected: "?symbol=MU" }, { status: 400 });
  const rows = await db
    .select()
    .from(analystTargets)
    .where(eq(analystTargets.symbol, symbol))
    .orderBy(desc(analystTargets.asOf))
    .limit(10);
  return NextResponse.json({ symbol, rows });
}
