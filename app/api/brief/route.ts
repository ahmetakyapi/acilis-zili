import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { dailyBriefs, storyRevisions } from "@/lib/schema";
import { isLocale } from "@/lib/i18n/config";
import { weekAnchor } from "@/lib/data";
import { isIsoDay } from "@/lib/date-input";
import {
  BRIEF_INPUT_SHAPE,
  briefInputSchema,
  briefRevisionKey,
  saveBrief,
} from "@/lib/content-write";

/**
 * Günlük özet alım ucu.
 *
 * Kullanıcının KENDİ Claude'u (Claude Code cron'u, zamanlanmış ajan vb.)
 * her sabah /api/brief/context'ten veriyi çekip yazıyı yazar ve buraya
 * gönderir. Site sadece veritabanından okur — API anahtarı maliyeti yok.
 * Sunucu cron'u aynı güne kayıt VARSA dokunmaz; bu uçtan gelen yazı esastır.
 *
 * DOĞRULAMA VE YAZMA BURADA DEĞİL, `lib/content-write.ts`te. Panel de aynı
 * şemayı çağırıyor: bülten iki girişten yazılabiliyor ama tek yoldan
 * geçiyor. Gerekçesi orada yazılı — haftalık kaydın pazartesiye çapalanması
 * ve künyenin kimde kalacağı dahil.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/**
 * Bülteni geri okur — `?date=YYYY-MM-DD&locale=tr|en[&period=weekly]`.
 *
 * NEDEN VAR (13 Ekim). Günlük, Haftalık ve Denetim rutinleri bülteni
 * sayfanın RSC akışından düzenli ifadeyle ayıklıyordu (~25 satırlık betik,
 * üç talimatta). Sayfa düzeni değiştiği gün üçü de "bülten yok" sanırdı ve
 * bunu hata olarak değil, yazılacak boş bir gün olarak okurdu. Mercek ve
 * analiz uçlarının GET'iyle aynı sözleşme: alan adları POST gövdesiyle
 * aynı, okunan paket düzenlenip geri gönderilebilir.
 *
 * Haftalıkta haftanın herhangi bir günü verilebilir; kayıt pazartesiye
 * çapalı (gerekçe `saveBrief`). `updated_at` rutinin son yazışı ile
 * paneldeki son düzeltmenin geç olanı — `generated_at` yalnızca rutinin.
 */
export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const localeParam = url.searchParams.get("locale");
  const period = url.searchParams.get("period") === "weekly" ? "weekly" : "daily";
  if (!dateParam || !isIsoDay(dateParam)) {
    return NextResponse.json(
      { error: "missing-params", detail: "?date=YYYY-MM-DD zorunlu; locale=tr|en, period=daily|weekly opsiyonel. Liste: /api/brief/list" },
      { status: 400 },
    );
  }
  const locale = isLocale(localeParam) ? localeParam : "tr";
  const date = period === "weekly" ? weekAnchor(dateParam) : dateParam;

  const [row] = await db
    .select()
    .from(dailyBriefs)
    .where(and(eq(dailyBriefs.briefDate, date), eq(dailyBriefs.locale, locale), eq(dailyBriefs.period, period)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not-found", date, locale, period }, { status: 404 });
  }

  const [revision] = await db
    .select({ at: storyRevisions.replacedAt })
    .from(storyRevisions)
    .where(and(eq(storyRevisions.slug, briefRevisionKey(date, period)), eq(storyRevisions.locale, locale)))
    .orderBy(desc(storyRevisions.replacedAt))
    .limit(1)
    .catch(() => []);
  const updatedAt = revision && revision.at > row.generatedAt ? revision.at : row.generatedAt;

  return NextResponse.json({
    ok: true,
    headline: row.headline,
    body_md: row.bodyMd,
    locale: row.locale,
    date: row.briefDate,
    period: row.period,
    generated_by: row.generatedBy,
    generated_at: row.generatedAt.toISOString(),
    updated_at: updatedAt.toISOString(),
  });
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  /* `detail`: hangi alanın düştüğü (20 Ekim). Şema artık takvimde olmayan
     günü ve tanınmayan dili de reddediyor; "2026-09-31" `expected`taki
     "YYYY-MM-DD" biçimini zaten tutuyor, sorun listesi olmadan rutin neyi
     düzelteceğini göremiyordu. Biçim `/api/mercek` ile aynı. */
  let parsed;
  try {
    parsed = briefInputSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid-body",
        detail: error instanceof z.ZodError ? error.issues : undefined,
        expected: BRIEF_INPUT_SHAPE,
      },
      { status: 400 },
    );
  }

  const { date, locale, period } = await saveBrief(parsed, "claude");
  return NextResponse.json({ ok: true, date, locale, period });
}
