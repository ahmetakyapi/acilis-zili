import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { applyPendingSplits } from "@/lib/portfolio-split-apply";

/**
 * HİSSE BÖLÜNMESİ DÜZELTMESİ (24 Kasım, sahibinin isteği) —
 * `deploy/cron-bolunme.sh` hafta içi açılıştan sonra ve her sabah çağırır.
 * Kural lib/portfolio-splits.ts, yazma lib/portfolio-split-apply.ts.
 * Claude çağrısı yok; yanıtta tutar yok, yalnız sayılar ve semboller.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Süreç içi tek koşu kilidi — gerekçe app/api/cron/bilanco/route.ts. */
let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    const run = await applyPendingSplits();
    if (!run.ok) {
      /* Tablo yokken (0047 bekliyor) hata değil: koşu boş döner. */
      if (run.reason === "no-table") return NextResponse.json({ skipped: "no-table" });
      return NextResponse.json({ error: run.reason }, { status: 503 });
    }
    if (run.adjusted.length > 0) {
      revalidatePath("/portfoy");
    }
    return NextResponse.json({
      lots: run.lots,
      symbols: run.symbols,
      splits: run.splits,
      adjusted: run.adjusted.map((item) => ({ symbol: item.symbol, splits: item.applied.map((split) => `${split.exDate}×${+split.ratio.toFixed(4)}`) })),
      skipped: run.skipped,
    });
  } finally {
    running = false;
  }
}
