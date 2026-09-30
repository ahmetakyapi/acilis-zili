import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { economicEvents } from "@/lib/schema";

/**
 * EKONOMİK OLAY BEKLENTİSİ — `economic_events.forecast` yazma ucu.
 *
 * NEDEN VAR (30 Eylül). Bugünün Akışı açıklanan bir verinin yanında
 * "Beklenti" yazmak istiyor (sahibinin isteği) ama alan hiç dolmuyordu:
 * günlük senkron yalnızca FRED'den `actual` ve `previous` çekiyor, FRED
 * konsensüs yayımlamıyor, ve ekranda "Beklenti" yerine hep "Önceki"
 * duruyordu. Uydurma bir sayı basılmaz (CLAUDE.md, veri dürüstlüğü 1);
 * beklentiyi, bülten yazarken zaten konsensüsü doğrulayan günlük rutin
 * buraya gönderiyor (`docs/claude-rutinler.md` § 1, adım 1b).
 *
 * YALNIZCA `forecast`. Gerçekleşen ve önceki değerler senkronun; bu uç
 * onlara dokunmuyor ve olmayan bir olay satırı YARATMIYOR — takvimin
 * kendisi tohumdan ve senkrondan geliyor. Eşleşmeyen satırlar yanıtta
 * `missing` olarak dönüyor ki rutin yanlış anahtarı fark etsin.
 *
 * Değer HAM sayı ("3.3"), birimi satırın kendisinden: `actual` ile aynı
 * biçim, biçimlendirme sunum katmanında (`formatEventValue`). `null`
 * gönderilen beklentiyi siler.
 */

const itemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  date_et: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forecast: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/)
    .nullable(),
});
const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(40) });

const SHAPE = {
  items: [{ slug: "core-pce", date_et: "YYYY-MM-DD", forecast: "3.3 | null" }],
};

export async function POST(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid-body", expected: SHAPE }, { status: 400 });
  }

  const updated: string[] = [];
  const missing: string[] = [];
  for (const item of parsed.items) {
    const rows = await db
      .update(economicEvents)
      .set({ forecast: item.forecast, updatedAt: new Date() })
      .where(and(eq(economicEvents.slug, item.slug), eq(economicEvents.eventDate, item.date_et)))
      .returning({ id: economicEvents.id });
    (rows.length > 0 ? updated : missing).push(`${item.slug}@${item.date_et}`);
  }

  return NextResponse.json({ ok: true, updated, missing });
}
