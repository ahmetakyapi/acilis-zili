import { NextResponse } from "next/server";
import { and, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { earningsOverrides } from "@/lib/schema";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { reconcileOverrides } from "@/lib/earnings-overrides";

/**
 * BİLANÇO TARİHİ ELLE DÜZELTME — `earnings_overrides` yazma ucu.
 *
 * Teknik rutini sağlayıcının boş bıraktığı tarihi ya da pencereyi şirketin
 * yatırımcı sayfasından doğrulayıp buraya yazıyor (docs/claude-rutinler.md
 * § 5). Kural ve uzlaştırma `lib/earnings-overrides.ts`te: elle kayıt öne
 * geçer, sağlayıcı aynı tarihi ve pencereyi söyleyince kapanır, farklı bir
 * şey söylerse `conflict` olur.
 *
 * Aynı sembol için YENİ bir tarih yazılırsa o sembolün ileri tarihli öteki
 * açık kaydı kapanır (`replaced`): rutin kendi yanlışını düzeltebilsin,
 * iki elle tarih yan yana kalmasın.
 *
 * `source_url` ZORUNLU: elle girilen tarih sağlayıcının önüne geçiyor; neye
 * dayandığı yazılı değilse çelişki çıktığında kimse doğrulayamaz.
 *
 * GET açık kayıtları ve son 30 günde kapananları döner.
 */

const itemSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,9}$/),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timing: z.enum(["bmo", "amc"]),
  source_url: z.string().url().max(500).refine((value) => /^https?:\/\//.test(value), "http(s) bekleniyor"),
});
const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(40) });

const SHAPE = {
  items: [{ symbol: "NVDA", report_date: "YYYY-MM-DD", timing: "bmo | amc", source_url: "https://…" }],
};

export async function POST(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    const issues = error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) : undefined;
    return NextResponse.json({ error: "invalid-body", expected: SHAPE, issues }, { status: 400 });
  }

  const today = todayEt();
  const stale = parsed.items.filter((item) => item.report_date < addEtDays(today, -7));
  if (stale.length > 0) {
    return NextResponse.json(
      { error: "past-date", detail: "Yedi günden eski tarih düzeltilmez.", items: stale.map((item) => item.symbol) },
      { status: 400 },
    );
  }

  const now = new Date();
  try {
    for (const item of parsed.items) {
      await db
        .update(earningsOverrides)
        .set({ status: "closed", closedReason: "replaced", closedAt: now, updatedAt: now })
        .where(sql`${earningsOverrides.symbol} = ${item.symbol}
          and ${earningsOverrides.reportDate} <> ${item.report_date}
          and ${earningsOverrides.reportDate} >= ${today}
          and ${earningsOverrides.status} <> 'closed'`);
      await db
        .insert(earningsOverrides)
        .values({
          symbol: item.symbol,
          reportDate: item.report_date,
          timing: item.timing,
          sourceUrl: item.source_url,
        })
        .onConflictDoUpdate({
          target: [earningsOverrides.symbol, earningsOverrides.reportDate],
          set: {
            timing: item.timing,
            sourceUrl: item.source_url,
            status: "active",
            closedReason: null,
            closedAt: null,
            updatedAt: now,
          },
        });
    }
  } catch (error) {
    /* Tablo yoksa migration uygulanmamış demektir — sessiz başarı değil,
       görünür hata (CLAUDE.md, "Migration'ı uygulamayı unutmak da sessiz
       hatadır"). */
    return NextResponse.json(
      { error: "write-failed", detail: error instanceof Error ? error.message : "?" },
      { status: 500 },
    );
  }

  /* Yazar yazmaz uzlaştır: sağlayıcı zaten aynı şeyi söylüyorsa kayıt
     hemen kapanır ve rutin yanıtta bunu görür. */
  await reconcileOverrides(today);
  const rows = await db
    .select()
    .from(earningsOverrides)
    .where(
      or(
        ...parsed.items.map((item) =>
          and(eq(earningsOverrides.symbol, item.symbol), eq(earningsOverrides.reportDate, item.report_date)),
        ),
      ),
    );

  return NextResponse.json({ ok: true, items: rows.map(present) });
}

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await db
      .select()
      .from(earningsOverrides)
      .where(or(ne(earningsOverrides.status, "closed"), gte(earningsOverrides.closedAt, since)))
      .orderBy(desc(earningsOverrides.updatedAt));
    return NextResponse.json({ items: rows.map(present) });
  } catch {
    return NextResponse.json({ error: "table-missing" }, { status: 503 });
  }
}

function present(row: typeof earningsOverrides.$inferSelect) {
  return {
    symbol: row.symbol,
    report_date: row.reportDate,
    timing: row.timing,
    source_url: row.sourceUrl,
    status: row.status,
    closed_reason: row.closedReason,
    provider_date: row.providerDate,
    provider_timing: row.providerHour,
    updated_at: row.updatedAt.toISOString(),
  };
}
